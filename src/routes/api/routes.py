from flask import Blueprint

bp = Blueprint('main', __name__)


@bp.post("/generate")
def generate() -> str:
    return "Hello World!"
