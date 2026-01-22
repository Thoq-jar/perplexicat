import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024
    SEARXNG_HOST = os.environ.get('SEARXNG_HOST', 'https://searxng.site/searxng')
    
    @staticmethod
    def init_app(app):
        instance_path = app.instance_path
        if not os.path.exists(instance_path):
            os.makedirs(instance_path)
        
        db_path = os.path.join(instance_path, "perplexicat.db")
        app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
        app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
            'connect_args': {'timeout': 20, 'check_same_thread': False}
        }
        app.config['UPLOAD_FOLDER'] = os.path.join(instance_path, 'uploads')
        app.config['SEARXNG_HOST'] = Config.SEARXNG_HOST