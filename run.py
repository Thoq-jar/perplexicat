from flask import Flask
import os


def create_app() -> Flask:
    app: Flask = Flask(__name__, template_folder='templates')

    try:
        os.makedirs(app.instance_path)
    except OSError:
        print("warn: could not create instance folder!")
        pass

    from src.routes.main.routes import bp as main_bp
    from src.routes.api.routes import bp as api_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(api_bp)

    return app


app = create_app()

if __name__ == '__main__':
    app.run(debug=True)
