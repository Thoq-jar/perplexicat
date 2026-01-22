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
import time
from datetime import datetime, timedelta

api_blueprint = Blueprint("api", __name__)


@api_blueprint.route("/generate", methods=["POST"])
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
            chat = None

            if chat_id is not None and chat_id != 0:
                try:
                    chat_id_int = int(chat_id)
                    chat = Chat.query.get(chat_id_int)
                    if chat:
                        if chat.user_id != current_user.id:
                            yield f"data: {json.dumps({'type': 'error', 'message': 'Unauthorized'})}\n\n"
                            return
                    else:
                        if is_followup:
                            yield f"data: {json.dumps({'type': 'error', 'message': 'Chat not found'})}\n\n"
                            return
                except (ValueError, TypeError):
                    if is_followup:
                        yield f"data: {json.dumps({'type': 'error', 'message': 'Invalid chat_id'})}\n\n"
                        return

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
                yield f"data: {json.dumps({'type': 'chat_created', 'chat_id': chat.id})}\n\n"

            all_messages = (
                Message.query.filter_by(chat_id=chat.id)
                .order_by(Message.created_at.asc())
                .all()
            )
            
            user_message = None
            if all_messages:
                user_messages = [message for message in all_messages if message.role == "user"]
                if user_messages:
                    last_user_message = user_messages[-1]
                    time_diff = datetime.utcnow() - last_user_message.created_at.replace(tzinfo=None) if last_user_message.created_at else timedelta(seconds=999)
                    
                    if (
                        last_user_message.content == query and 
                        time_diff < timedelta(seconds=2)):
                        user_message = last_user_message
            
            if not user_message:
                user_message = Message(role="user", content=query, chat=chat)
                db.session.add(user_message)
                db.session.commit()

            all_messages = (
                Message.query.filter_by(chat_id=chat.id)
                .order_by(Message.created_at.asc())
                .all()
            )
            chat_context = [message for message in all_messages if message.id != user_message.id]
            
            chat_context = [message for message in chat_context if not (message.role == "user" and message.content == query)]

            search_results = []
            searxng_host = current_app.config.get("SEARXNG_HOST")

            if query and searxng_host:
                yield f"data: {json.dumps({'type': 'status', 'status': 'searching'})}\n\n"
                search_results = ai_service.search(query, searxng_host)

            yield f"data: {json.dumps({'type': 'status', 'status': 'thinking'})}\n\n"
            
            assistant_content = ""
            thinking_content = ""
            try:
                for chunk in ai_service.generate_response_stream(
                    query,
                    model_name=model_name,
                    chat_context=chat_context,
                    search_results=search_results,
                ):
                    if not chunk:
                        continue
                        
                    if isinstance(chunk, dict):
                        chunk_type = chunk.get("type")
                        chunk_text = chunk.get("text", "")
                        
                        if chunk_type == "thinking":
                            thinking_content += chunk_text
                            yield f"data: {json.dumps({'type': 'thinking', 'chunk': chunk_text})}\n\n"
                        elif chunk_type == "content":
                            assistant_content += chunk_text
                            yield f"data: {json.dumps({'type': 'chunk', 'chunk': chunk_text})}\n\n"
                    else:
                        assistant_content += chunk
                        chunk_data = f"data: {json.dumps({'type': 'chunk', 'chunk': chunk})}\n\n"
                        yield chunk_data
                    
            except Exception as generation_error:
                error_message = f"Error generating response: {str(generation_error)}"
                assistant_content = error_message
                yield f"data: {json.dumps({'type': 'error', 'message': error_message})}\n\n"
                return
            
            if not assistant_content or not assistant_content.strip():
                assistant_content = "I apologize, but I wasn't able to generate a response. Please try again."

            search_results_json = json.dumps(search_results) if search_results else None
            assistant_message = Message(
                role="assistant", 
                content=assistant_content, 
                thinking=thinking_content if thinking_content else None,
                search_results=search_results_json,
                chat=chat
            )
            db.session.add(assistant_message)
            db.session.commit()

            yield f"data: {json.dumps({'type': 'complete', 'chat_id': chat.id, 'response': assistant_content, 'search_results': search_results})}\n\n"
        except Exception as error:
            db.session.rollback()
            yield f"data: {json.dumps({'type': 'error', 'message': str(error)})}\n\n"

    if use_sse:
        response = Response(
            stream_with_context(generate_stream()),
            mimetype="text/event-stream",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
                "X-Content-Type-Options": "nosniff",
            },
        )
        return response
    else:
        try:
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
                    else:
                        if is_followup:
                            return jsonify({"error": "Chat not found"}), 404
                except (ValueError, TypeError):
                    if is_followup:
                        return jsonify({"error": "Invalid chat_id"}), 400

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

            all_messages = (
                Message.query.filter_by(chat_id=chat.id)
                .order_by(Message.created_at.asc())
                .all()
            )
            
            user_message = None
            if all_messages:
                user_messages = [message for message in all_messages if message.role == "user"]
                if user_messages:
                    last_user_message = user_messages[-1]
                    time_diff = datetime.utcnow() - last_user_message.created_at.replace(tzinfo=None) if last_user_message.created_at else timedelta(seconds=999)
                    
                    if (
                        last_user_message.content == query and 
                        time_diff < timedelta(seconds=2)):
                        user_message = last_user_message
            
            if not user_message:
                user_message = Message(role="user", content=query, chat=chat)
                db.session.add(user_message)
                db.session.commit()

            all_messages = (
                Message.query.filter_by(chat_id=chat.id)
                .order_by(Message.created_at.asc())
                .all()
            )
            chat_context = [message for message in all_messages if message.id != user_message.id]
            
            chat_context = [message for message in chat_context if not (message.role == "user" and message.content == query)]

            search_results = []
            searxng_host = current_app.config.get("SEARXNG_HOST")
            if query and searxng_host:
                search_results = ai_service.search(query, searxng_host)

            assistant_content = ai_service.generate_response(
                query,
                model_name=model_name,
                chat_context=chat_context,
                search_results=search_results,
            )

            search_results_json = json.dumps(search_results) if search_results else None
            assistant_message = Message(
                role="assistant", 
                content=assistant_content, 
                thinking=None,
                search_results=search_results_json,
                chat=chat
            )
            db.session.add(assistant_message)
            db.session.commit()

            return jsonify(
                {
                    "chat_id": chat.id,
                    "response": assistant_content,
                    "search_results": search_results,
                }
            )
        except Exception as error:
            db.session.rollback()
            return jsonify({"error": str(error)}), 500


@api_blueprint.route("/user", methods=["GET"])
@login_required
def get_user():
    return jsonify({
        "id": current_user.id,
        "username": current_user.username,
        "theme": getattr(current_user, 'theme', 'system'),
        "selected_model": getattr(current_user, 'selected_model', 'qwen3-vl:8b'),
    })


@api_blueprint.route("/chats", methods=["GET"])
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


@api_blueprint.route("/chat/<int:chat_id>", methods=["GET"])
@login_required
def get_chat(chat_id):
    chat = Chat.query.get_or_404(chat_id)
    if chat.user_id != current_user.id:
        return jsonify({"error": "Unauthorized"}), 403
    
    messages = Message.query.filter_by(chat_id=chat_id).order_by(Message.created_at.asc()).all()
    
    messages_data = []
    for message in messages:
        message_data = {
            "id": message.id,
            "content": message.content,
            "role": message.role,
            "chat_id": message.chat_id,
            "created_at": message.created_at.isoformat() if message.created_at else None
        }
        if message.thinking:
            message_data["thinking"] = message.thinking
        if message.search_results:
            try:
                message_data["search_results"] = json.loads(message.search_results)
            except (json.JSONDecodeError, TypeError):
                message_data["search_results"] = []
        messages_data.append(message_data)
    
    return jsonify({
        "chat": {
            "id": chat.id,
            "title": chat.title,
            "created_at": chat.created_at.isoformat() if chat.created_at else None,
            "user_id": chat.user_id,
            "space_id": chat.space_id
        },
        "messages": messages_data
    })


@api_blueprint.route("/spaces", methods=["GET"])
@login_required
def get_spaces():
    spaces = Space.query.filter_by(user_id=current_user.id).all()
    return jsonify([{ 
        "id": space.id,
        "name": space.name,
        "user_id": space.user_id,
        "chats": [{"id": chat.id} for chat in Chat.query.filter_by(space_id=space.id).all()]
    } for space in spaces])


@api_blueprint.route("/space/<int:space_id>", methods=["GET"])
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


@api_blueprint.route("/create_space", methods=["POST"])
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


@api_blueprint.route("/update_chat_title/<int:chat_id>", methods=["POST"])
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


@api_blueprint.route("/update_theme", methods=["POST"])
@login_required
def update_theme():
    data = request.get_json()
    theme = data.get("theme", "system")
    
    if hasattr(current_user, 'theme'):
        current_user.theme = theme
        db.session.commit()
    
    return jsonify({"success": True})


@api_blueprint.route("/update_model", methods=["POST"])
@login_required
def update_model():
    data = request.get_json()
    model = data.get("model")
    
    if hasattr(current_user, 'selected_model'):
        current_user.selected_model = model
        db.session.commit()
    
    return jsonify({"success": True})


@api_blueprint.route("/move_chat_to_space", methods=["POST"])
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


@api_blueprint.route("/delete_chat/<int:chat_id>", methods=["DELETE"])
@login_required
def delete_chat(chat_id):
    chat = Chat.query.get_or_404(chat_id)
    if chat.user_id != current_user.id:
        return jsonify({"error": "Unauthorized"}), 403

    Message.query.filter_by(chat_id=chat_id).delete()
    db.session.delete(chat)
    db.session.commit()

    return jsonify({"success": True})


@api_blueprint.route("/delete_all_chats", methods=["DELETE"])
@login_required
def delete_all_chats():
    try:
        user_chats = Chat.query.filter_by(user_id=current_user.id).all()
        for chat in user_chats:
            Message.query.filter_by(chat_id=chat.id).delete()
            db.session.delete(chat)
        db.session.commit()
        return jsonify({"success": True})
    except Exception as error:
        db.session.rollback()
        return jsonify({"error": str(error)}), 500


@api_blueprint.route("/move_chat_to_space/<int:chat_id>", methods=["POST"])
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


@api_blueprint.route("/delete_space/<int:space_id>", methods=["DELETE"])
@login_required
def delete_space(space_id):
    space = Space.query.get_or_404(space_id)
    if space.user_id != current_user.id:
        return jsonify({"error": "Unauthorized"}), 403

    Chat.query.filter_by(space_id=space_id).update({Chat.space_id: None})
    db.session.delete(space)
    db.session.commit()

    return jsonify({"success": True})


@api_blueprint.route("/update_username", methods=["POST"])
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
    except Exception as error:
        db.session.rollback()
        return jsonify({"error": "Failed to update username"}), 500


@api_blueprint.route("/update_password", methods=["POST"])
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
    except Exception as error:
        db.session.rollback()
        return jsonify({"error": "Failed to update password"}), 500


@api_blueprint.route("/delete_account", methods=["DELETE"])
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
    except Exception as error:
        db.session.rollback()
        return jsonify({"error": "Failed to delete account"}), 500
