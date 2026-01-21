from flask import (
    Blueprint,
    request,
    jsonify,
    current_app,
    Response,
    stream_with_context,
)
from flask_login import current_user, login_required
from src.models import Chat, Message, Space, User
from src.db import db
from src.ai import ai_service
import json

bp = Blueprint("api", __name__)


@bp.route("/generate", methods=["POST"])
@login_required
def generate():
    data = request.get_json()
    query = data.get("query", "")
    chat_id = data.get("chat_id")
    space_id = data.get("space_id")
    model_name = data.get("model", "qwen3-vl:8b")
    is_followup = data.get("is_followup", False)
    use_sse = data.get("use_sse", False)

    if not query:
        return jsonify({"error": "No query provided"}), 400

    def generate_stream():
        try:
            print(
                f"Received chat_id: {chat_id}, type: {type(chat_id)}, is_followup: {is_followup}"
            )
            chat = None

            if chat_id or is_followup:
                if not chat_id and is_followup:
                    yield f"data: {json.dumps({'type': 'error', 'message': 'Follow-up requires chat_id'})}\n\n"
                    return

                try:
                    chat_id_int = int(chat_id)
                    chat = Chat.query.get(chat_id_int)
                    if chat:
                        if chat.user_id != current_user.id:
                            yield f"data: {json.dumps({'type': 'error', 'message': 'Unauthorized'})}\n\n"
                            return
                        print(f"Using existing chat_id: {chat.id}")
                    else:
                        if is_followup:
                            yield f"data: {json.dumps({'type': 'error', 'message': 'Chat not found'})}\n\n"
                            return
                        print(f"Chat {chat_id_int} not found, will create new chat")
                except (ValueError, TypeError) as e:
                    if is_followup:
                        yield f"data: {json.dumps({'type': 'error', 'message': 'Invalid chat_id'})}\n\n"
                        return
                    print(f"Error parsing chat_id {chat_id}: {e}, will create new chat")

            if not chat:
                if is_followup:
                    yield f"data: {json.dumps({'type': 'error', 'message': 'Cannot create new chat for follow-up'})}\n\n"
                    return
                title = query[:50] if query else "New Chat"
                chat = Chat(title=title, author=current_user)
                if space_id:
                    space = Space.query.get(space_id)
                    if space and space.user_id == current_user.id:
                        chat.space_id = space_id
                db.session.add(chat)
                db.session.commit()
                print(f"Created new chat_id: {chat.id}")
                yield f"data: {json.dumps({'type': 'chat_created', 'chat_id': chat.id})}\n\n"

            user_msg = Message(role="user", content=query, chat=chat)
            db.session.add(user_msg)
            db.session.commit()

            all_messages = (
                Message.query.filter_by(chat_id=chat.id)
                .order_by(Message.created_at.asc())
                .all()
            )
            chat_context = [msg for msg in all_messages if msg.id != user_msg.id]

            print(
                f"Chat ID: {chat.id}, Total messages: {len(all_messages)}, Context messages: {len(chat_context)}"
            )

            search_results = []
            searxng_host = current_app.config.get("SEARXNG_HOST")
            print(f"Generate endpoint: query='{query}', searxng_host='{searxng_host}'")

            if query and searxng_host:
                yield f"data: {json.dumps({'type': 'status', 'status': 'searching'})}\n\n"
                print(f"Calling search with query: {query}")
                search_results = ai_service.search(query, searxng_host)
                print(f"Search returned {len(search_results)} results")

            yield f"data: {json.dumps({'type': 'status', 'status': 'thinking'})}\n\n"

            assistant_content = ""
            for chunk in ai_service.generate_response_stream(
                query,
                model_name=model_name,
                chat_context=chat_context,
                search_results=search_results,
            ):
                assistant_content += chunk
                yield f"data: {json.dumps({'type': 'chunk', 'chunk': chunk})}\n\n"

            assistant_msg = Message(role="assistant", content=assistant_content, chat=chat)
            db.session.add(assistant_msg)
            db.session.commit()

            yield f"data: {json.dumps({'type': 'complete', 'chat_id': chat.id, 'response': assistant_content, 'search_results': search_results})}\n\n"
        except Exception as e:
            db.session.rollback()
            print(f"Error in generate: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    if use_sse:
        return Response(
            stream_with_context(generate_stream()), mimetype="text/event-stream"
        )
    else:
        try:
            print(
                f"Received chat_id: {chat_id}, type: {type(chat_id)}, is_followup: {is_followup}"
            )
            chat = None

            if chat_id or is_followup:
                if not chat_id and is_followup:
                    return jsonify({"error": "Follow-up requires chat_id"}), 400

                try:
                    chat_id_int = int(chat_id)
                    chat = Chat.query.get(chat_id_int)
                    if chat:
                        if chat.user_id != current_user.id:
                            return jsonify({"error": "Unauthorized"}), 403
                        print(f"Using existing chat_id: {chat.id}")
                    else:
                        if is_followup:
                            return jsonify({"error": "Chat not found"}), 404
                        print(f"Chat {chat_id_int} not found, will create new chat")
                except (ValueError, TypeError) as e:
                    if is_followup:
                        return jsonify({"error": "Invalid chat_id"}), 400
                    print(f"Error parsing chat_id {chat_id}: {e}, will create new chat")

            if not chat:
                if is_followup:
                    return (
                        jsonify({"error": "Cannot create new chat for follow-up"}),
                        400,
                    )
                title = query[:50] if query else "New Chat"
                chat = Chat(title=title, author=current_user)
                if space_id:
                    space = Space.query.get(space_id)
                    if space and space.user_id == current_user.id:
                        chat.space_id = space_id
                db.session.add(chat)
                db.session.commit()
                print(f"Created new chat_id: {chat.id}")

            user_msg = Message(role="user", content=query, chat=chat)
            db.session.add(user_msg)
            db.session.commit()

            all_messages = (
                Message.query.filter_by(chat_id=chat.id)
                .order_by(Message.created_at.asc())
                .all()
            )
            chat_context = [msg for msg in all_messages if msg.id != user_msg.id]

            print(
                f"Chat ID: {chat.id}, Total messages: {len(all_messages)}, Context messages: {len(chat_context)}"
            )

            search_results = []
            searxng_host = current_app.config.get("SEARXNG_HOST")
            print(f"Generate endpoint: query='{query}', searxng_host='{searxng_host}'")
            if query and searxng_host:
                print(f"Calling search with query: {query}")
                search_results = ai_service.search(query, searxng_host)
                print(f"Search returned {len(search_results)} results")
            else:
                print(
                    f"Search skipped: query={bool(query)}, searxng_host={bool(searxng_host)}"
                )

            assistant_content = ai_service.generate_response(
                query,
                model_name=model_name,
                chat_context=chat_context,
                search_results=search_results,
            )

            assistant_msg = Message(role="assistant", content=assistant_content, chat=chat)
            db.session.add(assistant_msg)
            db.session.commit()

            return jsonify(
                {
                    "chat_id": chat.id,
                    "response": assistant_content,
                    "search_results": search_results,
                }
            )
        except Exception as e:
            db.session.rollback()
            print(f"Error in generate: {e}")
            return jsonify({"error": str(e)}), 500


@bp.route("/user", methods=["GET"])
@login_required
def get_user():
    return jsonify({
        "id": current_user.id,
        "username": current_user.username,
        "theme": getattr(current_user, 'theme', 'system'),
        "selected_model": getattr(current_user, 'selected_model', 'qwen3-vl:8b'),
    })


@bp.route("/chats", methods=["GET"])
@login_required
def get_chats():
    chats = Chat.query.filter_by(user_id=current_user.id).order_by(Chat.created_at.desc()).all()
    return jsonify([{
        "id": chat.id,
        "title": chat.title,
        "created_at": chat.created_at.isoformat() if chat.created_at else None,
        "user_id": chat.user_id,
        "space_id": chat.space_id
    } for chat in chats])


@bp.route("/chat/<int:chat_id>", methods=["GET"])
@login_required
def get_chat(chat_id):
    chat = Chat.query.get_or_404(chat_id)
    if chat.user_id != current_user.id:
        return jsonify({"error": "Unauthorized"}), 403
    
    messages = Message.query.filter_by(chat_id=chat_id).order_by(Message.created_at.asc()).all()
    return jsonify({
        "chat": {
            "id": chat.id,
            "title": chat.title,
            "created_at": chat.created_at.isoformat() if chat.created_at else None,
            "user_id": chat.user_id,
            "space_id": chat.space_id
        },
        "messages": [{
            "id": msg.id,
            "content": msg.content,
            "role": msg.role,
            "chat_id": msg.chat_id,
            "created_at": msg.created_at.isoformat() if msg.created_at else None
        } for msg in messages]
    })


@bp.route("/spaces", methods=["GET"])
@login_required
def get_spaces():
    spaces = Space.query.filter_by(user_id=current_user.id).all()
    return jsonify([{
        "id": space.id,
        "name": space.name,
        "user_id": space.user_id,
        "chats": [{"id": c.id} for c in Chat.query.filter_by(space_id=space.id).all()]
    } for space in spaces])


@bp.route("/space/<int:space_id>", methods=["GET"])
@login_required
def get_space(space_id):
    space = Space.query.get_or_404(space_id)
    if space.user_id != current_user.id:
        return jsonify({"error": "Unauthorized"}), 403
    
    chats = Chat.query.filter_by(space_id=space_id).order_by(Chat.created_at.desc()).all()
    return jsonify({
        "space": {
            "id": space.id,
            "name": space.name,
            "user_id": space.user_id
        },
        "chats": [{
            "id": chat.id,
            "title": chat.title,
            "created_at": chat.created_at.isoformat() if chat.created_at else None,
            "user_id": chat.user_id,
            "space_id": chat.space_id
        } for chat in chats]
    })


@bp.route("/create_space", methods=["POST"])
@login_required
def create_space():
    data = request.get_json()
    name = data.get("name", "").strip()
    
    if not name:
        return jsonify({"error": "Space name is required"}), 400
    
    space = Space(name=name, user_id=current_user.id)
    db.session.add(space)
    db.session.commit()
    
    return jsonify({
        "id": space.id,
        "name": space.name,
        "user_id": space.user_id
    })


@bp.route("/update_chat_title/<int:chat_id>", methods=["POST"])
@login_required
def update_chat_title(chat_id):
    chat = Chat.query.get_or_404(chat_id)
    if chat.user_id != current_user.id:
        return jsonify({"error": "Unauthorized"}), 403
    
    data = request.get_json()
    title = data.get("title", "").strip()
    
    if title:
        chat.title = title
        db.session.commit()
    
    return jsonify({"success": True})


@bp.route("/update_theme", methods=["POST"])
@login_required
def update_theme():
    data = request.get_json()
    theme = data.get("theme", "system")
    
    if hasattr(current_user, 'theme'):
        current_user.theme = theme
        db.session.commit()
    
    return jsonify({"success": True})


@bp.route("/update_model", methods=["POST"])
@login_required
def update_model():
    data = request.get_json()
    model = data.get("model", "gemma:4b")
    
    if hasattr(current_user, 'selected_model'):
        current_user.selected_model = model
        db.session.commit()
    
    return jsonify({"success": True})


@bp.route("/move_chat_to_space", methods=["POST"])
@login_required
def move_chat_to_space_api():
    data = request.get_json()
    chat_id = data.get("chat_id")
    space_id = data.get("space_id")
    
    chat = Chat.query.get_or_404(chat_id)
    if chat.user_id != current_user.id:
        return jsonify({"error": "Unauthorized"}), 403
    
    if space_id is None:
        chat.space_id = None
    else:
        space = Space.query.get(space_id)
        if not space or space.user_id != current_user.id:
            return jsonify({"error": "Invalid space"}), 400
        chat.space_id = space_id
    
    db.session.commit()
    return jsonify({"success": True})


@bp.route("/delete_chat/<int:chat_id>", methods=["DELETE"])
@login_required
def delete_chat(chat_id):
    chat = Chat.query.get_or_404(chat_id)
    if chat.user_id != current_user.id:
        return jsonify({"error": "Unauthorized"}), 403

    Message.query.filter_by(chat_id=chat_id).delete()
    db.session.delete(chat)
    db.session.commit()

    return jsonify({"success": True})


@bp.route("/delete_all_chats", methods=["DELETE"])
@login_required
def delete_all_chats():
    try:
        user_chats = Chat.query.filter_by(user_id=current_user.id).all()
        for chat in user_chats:
            Message.query.filter_by(chat_id=chat.id).delete()
            db.session.delete(chat)
        db.session.commit()
        return jsonify({"success": True})
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting all chats: {e}")
        return jsonify({"error": str(e)}), 500


@bp.route("/move_chat_to_space/<int:chat_id>", methods=["POST"])
@login_required
def move_chat_to_space(chat_id):
    chat = Chat.query.get_or_404(chat_id)
    if chat.user_id != current_user.id:
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json()
    space_id = data.get("space_id")

    if space_id is None:
        chat.space_id = None
    else:
        space = Space.query.get(space_id)
        if not space or space.user_id != current_user.id:
            return jsonify({"error": "Invalid space"}), 400
        chat.space_id = space_id

    db.session.commit()
    return jsonify({"success": True})


@bp.route("/delete_space/<int:space_id>", methods=["DELETE"])
@login_required
def delete_space(space_id):
    space = Space.query.get_or_404(space_id)
    if space.user_id != current_user.id:
        return jsonify({"error": "Unauthorized"}), 403

    Chat.query.filter_by(space_id=space_id).update({Chat.space_id: None})
    db.session.delete(space)
    db.session.commit()

    return jsonify({"success": True})


@bp.route("/update_username", methods=["POST"])
@login_required
def update_username():
    data = request.get_json()
    new_username = data.get("username", "").strip()

    if not new_username:
        return jsonify({"error": "Username cannot be empty"}), 400

    if len(new_username) < 3:
        return jsonify({"error": "Username must be at least 3 characters"}), 400

    if len(new_username) > 64:
        return jsonify({"error": "Username must be less than 64 characters"}), 400

    existing_user = User.query.filter_by(username=new_username).first()
    if existing_user and existing_user.id != current_user.id:
        return jsonify({"error": "Username already taken"}), 400

    try:
        current_user.username = new_username
        db.session.commit()
        return jsonify({"success": True})
    except Exception as e:
        db.session.rollback()
        print(f"Error updating username: {e}")
        return jsonify({"error": "Failed to update username"}), 500


@bp.route("/update_password", methods=["POST"])
@login_required
def update_password():
    data = request.get_json()
    new_password = data.get("password", "")

    if not new_password:
        return jsonify({"error": "Password cannot be empty"}), 400

    if len(new_password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    try:
        current_user.set_password(new_password)
        db.session.commit()
        return jsonify({"success": True})
    except Exception as e:
        db.session.rollback()
        print(f"Error updating password: {e}")
        return jsonify({"error": "Failed to update password"}), 500


@bp.route("/delete_account", methods=["DELETE"])
@login_required
def delete_account():
    try:
        user_id = current_user.id

        user_chats = Chat.query.filter_by(user_id=user_id).all()
        for chat in user_chats:
            Message.query.filter_by(chat_id=chat.id).delete()
            db.session.delete(chat)

        user_spaces = Space.query.filter_by(user_id=user_id).all()
        for space in user_spaces:
            db.session.delete(space)

        db.session.delete(current_user)
        db.session.commit()

        return jsonify({"success": True})
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting account: {e}")
        return jsonify({"error": "Failed to delete account"}), 500
