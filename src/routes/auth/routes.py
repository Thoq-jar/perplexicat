from flask import jsonify, request
from flask_login import login_user, logout_user, current_user
from src.routes.auth import auth_blueprint
from src.models import User
from src.db import db


@auth_blueprint.route('/login', methods=['POST'])
def login():
    if current_user.is_authenticated:
        return jsonify({'success': True, 'message': 'Already logged in'})
    
    data = request.get_json() if request.is_json else None
    if data:
        username = data.get('username')
        password = data.get('password')
    else:
        username = request.form.get('username')
        password = request.form.get('password')
    
    if not username or not password:
        return jsonify({'success': False, 'message': 'Username and password required'}), 400
    
    user = User.query.filter_by(username=username).first()
    if user is None or not user.check_password(password):
        return jsonify({'success': False, 'message': 'Invalid username or password'}), 401
    
    login_user(user)
    return jsonify({'success': True, 'message': 'Login successful'})


@auth_blueprint.route('/logout', methods=['POST'])
def logout():
    logout_user()
    return jsonify({'success': True, 'message': 'Logged out successfully'})


@auth_blueprint.route('/register', methods=['POST'])
def register():
    if current_user.is_authenticated:
        return jsonify({'success': False, 'message': 'Already logged in'}), 400
    
    data = request.get_json() if request.is_json else None
    if data:
        username = data.get('username')
        password = data.get('password')
    else:
        username = request.form.get('username')
        password = request.form.get('password')
    
    if not username or not password:
        return jsonify({'success': False, 'message': 'Username and password required'}), 400
    
    user = User.query.filter_by(username=username).first()
    if user:
        return jsonify({'success': False, 'message': 'Username already exists'}), 409
    
    user = User(username=username)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Registration successful'})