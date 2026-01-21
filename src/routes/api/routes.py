from flask import Blueprint, request, jsonify, redirect, url_for
from flask_login import current_user, login_required
from src.models import Chat, Message
from src.db import db
from src.ai import ai_service

bp = Blueprint('api', __name__)


@bp.route("/generate", methods=['POST'])
@login_required
def generate():
    data = request.get_json()
    query = data.get('query')
    chat_id = data.get('chat_id')
    model_name = data.get('model', 'microsoft/phi-1_5')

    if not query:
        return jsonify({"error": "No query provided"}), 400

    if chat_id:
        chat = Chat.query.get_or_404(chat_id)
        if chat.user_id != current_user.id:
            return jsonify({"error": "Unauthorized"}), 403
    else:
        chat = Chat(title=query[:50], author=current_user)
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
