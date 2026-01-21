import torch
from transformers import AutoModelForCausalLM, AutoTokenizer


class AIService:
    _instance = None
    _models = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(AIService, cls).__new__(cls)
        return cls._instance

    def get_model_and_tokenizer(self, model_name):
        if model_name not in self._models:
            print(f"Loading model: {model_name}")
            tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
            device = "cpu"
            if torch.cuda.is_available():
                device = "cuda"
            elif torch.backends.mps.is_available():
                device = "mps"

            model = AutoModelForCausalLM.from_pretrained(
                model_name,
                trust_remote_code=True,
                torch_dtype=torch.float32
            ).to(device)
            self._models[model_name] = (model, tokenizer, device)
        return self._models[model_name]

    def generate_response(self, query, model_name="microsoft/phi-1_5"):
        try:
            model, tokenizer, device = self.get_model_and_tokenizer(model_name)

            inputs = tokenizer(query, return_tensors="pt").to(device)
            outputs = model.generate(**inputs, max_length=200, pad_token_id=tokenizer.eos_token_id)
            response = tokenizer.decode(outputs[0], skip_special_tokens=True)

            if response.startswith(query):
                response = response[len(query):].strip()

            return response
        except Exception as exception:
            print(f"Error in generation: {exception}")
            return f"Error: {str(exception)}. (PyTorch model loading might have failed due to resources)"


ai_service = AIService()
