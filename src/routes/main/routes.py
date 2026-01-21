from flask import Blueprint, render_template, redirect, url_for, request
from flask_login import current_user, login_required
from src.models import Chat, Space, Message
from src.db import db

bp = Blueprint('main', __name__)


@bp.route('/')
def index() -> str:
    chats = []
    spaces = []
    if current_user.is_authenticated:
        chats = Chat.query.filter_by(user_id=current_user.id).order_by(Chat.created_at.desc()).limit(10).all()
        spaces = Space.query.filter_by(user_id=current_user.id).all()
    return render_template('main.html', chats=chats, spaces=spaces)


@bp.route('/chat/<int:chat_id>')
@login_required
def chat_view(chat_id):
    chat = Chat.query.get_or_404(chat_id)
    if chat.user_id != current_user.id:
        return redirect(url_for('main.index'))
    chats = Chat.query.filter_by(user_id=current_user.id).order_by(Chat.created_at.desc()).limit(10).all()
    spaces = Space.query.filter_by(user_id=current_user.id).all()
    return render_template('chat.html', chat=chat, chats=chats, spaces=spaces)


@bp.route('/spaces')
@login_required
def spaces_list():
    chats = Chat.query.filter_by(user_id=current_user.id).order_by(Chat.created_at.desc()).limit(10).all()
    spaces = Space.query.filter_by(user_id=current_user.id).all()
    return render_template('spaces.html', chats=chats, spaces=spaces)


@bp.route('/space/new', methods=['POST'])
@login_required
def create_space():
    name = request.form.get('name')
    if name:
        space = Space(name=name, owner=current_user)
        db.session.add(space)
        db.session.commit()
    return redirect(url_for('main.spaces_list'))


@bp.route('/settings')
@login_required
def settings():
    chats = Chat.query.filter_by(user_id=current_user.id).order_by(Chat.created_at.desc()).limit(10).all()
    spaces = Space.query.filter_by(user_id=current_user.id).all()
    return render_template('settings.html', chats=chats, spaces=spaces)
