import os

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'chatbot_db'),
    'port': int(os.getenv('DB_PORT', '3306')),
}

USE_OLLAMA = os.getenv('USE_OLLAMA', 'false').lower() == 'true'
OLLAMA_MODEL = os.getenv('OLLAMA_MODEL', 'deepseek')
OLLAMA_VISION_MODEL = os.getenv('OLLAMA_VISION_MODEL', 'llava')

API_KEY = (
    os.getenv('GROQ_API_KEY')
    or os.getenv('API_KEY')
    or os.getenv('CHATBOT_API_KEY')
)
API_URL = (
    os.getenv('GROQ_API_URL')
    or os.getenv('API_URL')
    or os.getenv('CHATBOT_API_URL')
    or 'https://api.groq.com/openai/v1/chat/completions'
)
AI_MODEL = os.getenv('GROQ_MODEL', os.getenv('AI_MODEL', 'openai/gpt-oss-120b'))
VISION_MODEL = os.getenv('GROQ_VISION_MODEL', 'qwen/qwen3.8-27b')