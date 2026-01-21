from flask import Blueprint, request, jsonify, redirect, url_for
from flask_login import current_user, login_required
from src.models import Chat, Message, Space
from src.db import db
from src.ai import ai_service

bp = Blueprint('api', __name__)


@bp.route("/generate", methods=['POST'])
@login_required
def generate():
    data = request.get_json()
    query = data.get('query')
    chat_id = data.get('chat_id')
    space_id = data.get('space_id')
    model_name = data.get('model', 'gemma3:4b')

    if not query:
        return jsonify({"error": "No query provided"}), 400

    if chat_id:
        chat = Chat.query.get_or_404(chat_id)
        if chat.user_id != current_user.id:
            return jsonify({"error": "Unauthorized"}), 403
    else:
        chat = Chat(title=query[:50], author=current_user)
        if space_id:
            space = Space.query.get(space_id)
            if space and space.user_id == current_user.id:
                chat.space_id = space_id
        db.session.add(chat)
        db.session.commit()

    user_msg = Message(role='user', content=query, chat=chat)
    db.session.add(user_msg)

    assistant_content = ai_service.generate_response(query, model_name=model_name)
    assistant_msg = Message(role='assistant', content=assistant_content, chat=chat)
    db.session.add(assistant_msg)

    db.session.commit()

    return jsonify({
        "chat_id": chat.id,
        "response": assistant_content
    })


@bp.route("/delete_chat/<int:chat_id>", methods=['DELETE'])
@login_required
def delete_chat(chat_id):
    chat = Chat.query.get_or_404(chat_id)
    if chat.user_id != current_user.id:
        return jsonify({"error": "Unauthorized"}), 403
    
    Message.query.filter_by(chat_id=chat_id).delete()
    db.session.delete(chat)
    db.session.commit()
    
    return jsonify({"success": True})


@bp.route("/move_chat_to_space/<int:chat_id>", methods=['POST'])
@login_required
def move_chat_to_space(chat_id):
    chat = Chat.query.get_or_404(chat_id)
    if chat.user_id != current_user.id:
        return jsonify({"error": "Unauthorized"}), 403
    
    data = request.get_json()
    space_id = data.get('space_id')
    
    if space_id is None:
        chat.space_id = None
    else:
        space = Space.query.get(space_id)
        if not space or space.user_id != current_user.id:
            return jsonify({"error": "Invalid space"}), 400
        chat.space_id = space_id
    
    db.session.commit()
    return jsonify({"success": True})


@bp.route("/delete_space/<int:space_id>", methods=['DELETE'])
@login_required
def delete_space(space_id):
    space = Space.query.get_or_404(space_id)
    if space.user_id != current_user.id:
        return jsonify({"error": "Unauthorized"}), 403
    
    Chat.query.filter_by(space_id=space_id).update({Chat.space_id: None})
    db.session.delete(space)
    db.session.commit()
    
    return jsonify({"success": True})
