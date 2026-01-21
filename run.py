from flask import Flask
from src.db import db
from src.config import Config
from src.login_manager import login_manager


def create_app() -> Flask:
    app: Flask = Flask(__name__, template_folder='./templates', static_folder='./static')
    app.config.from_object(Config)

    db.init_app(app)
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'

    from src.routes.main.routes import bp as main_bp
    from src.routes.api.routes import bp as api_bp
    from src.routes.auth.routes import bp as auth_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(api_bp, url_prefix='/api')
    app.register_blueprint(auth_bp)

    with app.app_context():
        from src.models import User, Chat, Space
        db.create_all()

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True)
