import requests


class AIService:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(AIService, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        import os
        self.ollama_base_url = os.environ.get('OLLAMA_BASE_URL', 'http://localhost:11434')

    def generate_response(self, query, model_name="gemma3:4b"):
        try:
            url = f"{self.ollama_base_url}/api/generate"
            payload = {
                "model": model_name,
                "prompt": query,
                "stream": False
            }
            response = requests.post(url, json=payload, timeout=60)
            response.raise_for_status()
            result = response.json()
            return result.get("response", "").strip()
        except Exception as exception:
            print(f"Error in generation: {exception}")
            return f"Error: {str(exception)}"


ai_service = AIService()
