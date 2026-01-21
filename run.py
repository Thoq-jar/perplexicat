from flask import Flask
from src.db import db
from src.config import Config
from src.login_manager import login_manager
from os import path


def create_app() -> Flask:
    app: Flask = Flask(__name__, instance_path=path.join(path.dirname(__file__), 'instance'), static_folder='./static/dist')
    app.config.from_object(Config)
    Config.init_app(app)

    db.init_app(app)
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'

    from src.routes.main.routes import bp as main_bp
    from src.routes.api.routes import bp as api_bp
    from src.routes.auth.routes import bp as auth_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(api_bp, url_prefix='/api')
    app.register_blueprint(auth_bp, url_prefix='/auth')

    with app.app_context():
        from src.models import User, Chat, Space, Message, Attachment
        db.create_all()
        
        import os
        upload_dir = app.config.get('UPLOAD_FOLDER')
        if upload_dir and not os.path.exists(upload_dir):
            os.makedirs(upload_dir)

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, port=5001)
