from flask import Blueprint

bp = Blueprint('auth', __name__)

from src.routes.auth import routes
