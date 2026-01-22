from flask import Blueprint

auth_blueprint = Blueprint('auth', __name__)

from src.routes.auth import routes