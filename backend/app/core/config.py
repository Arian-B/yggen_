from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # App
    API_PREFIX: str = "/api"
    PROJECT_NAME: str = "Yggen API"
    
    # ArangoDB
    ARANGO_HOST: str = "http://localhost:8529"
    ARANGO_DB: str = "yggen_db"
    ARANGO_USERNAME: str = "root"
    ARANGO_PASSWORD: str = "root"  # Change in production

    # AI
    # AI - OpenAI (Legacy/Fallback)
    OPENAI_API_KEY: str = "placeholder_key"
    
    # AI - Primary Providers
    GROQ_API_KEY: str = "placeholder_key"
    GEMINI_API_KEY: str = "placeholder_key"
    COHERE_API_KEY: str = "placeholder_key"
    OPENROUTER_API_KEY: str = "placeholder_key"

    # Model Defaults
    DEFAULT_FAST_MODEL: str = "llama3-70b-8192" # Groq
    DEFAULT_SMART_MODEL: str = "gemini-1.5-pro" # Gemini
    DEFAULT_FALLBACK_MODEL: str = "gpt-4o-mini" # OpenRouter

    class Config:
        env_file = ".env"

settings = Settings()
