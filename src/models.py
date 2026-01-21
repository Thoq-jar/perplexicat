from datetime import datetime
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from src.db import db
from src.login_manager import login_manager


@login_manager.user_loader
def load_user(id):
    return User.query.get(int(id))


class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), index=True, unique=True)
    password_hash = db.Column(db.String(128))
    chats = db.relationship('Chat', backref='author', lazy='dynamic')
    spaces = db.relationship('Space', backref='owner', lazy='dynamic')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class Space(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64))
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    chats = db.relationship('Chat', backref='space', lazy='dynamic')
    created_at = db.Column(db.DateTime, index=True, default=datetime.utcnow)


class Chat(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(140))
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    space_id = db.Column(db.Integer, db.ForeignKey('space.id'), nullable=True)
    created_at = db.Column(db.DateTime, index=True, default=datetime.utcnow)
    messages = db.relationship('Message', backref='chat', lazy='dynamic')


class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    role = db.Column(db.String(10))
    content = db.Column(db.Text)
    chat_id = db.Column(db.Integer, db.ForeignKey('chat.id'))
    created_at = db.Column(db.DateTime, index=True, default=datetime.utcnow)
