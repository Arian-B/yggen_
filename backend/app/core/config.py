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

    # Auth
    JWT_SECRET_KEY: str = "change_me_in_production"
    GOOGLE_CLIENT_ID: str = "YOUR_GOOGLE_CLIENT_ID_HERE"
    GOOGLE_CLIENT_SECRET: str = "YOUR_GOOGLE_CLIENT_SECRET_HERE"
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/auth/google/callback"

    # Wikipedia / Wikimedia OAuth 2.0
    # Register at: https://meta.wikimedia.org/wiki/Special:OAuthConsumerRegistration
    WIKIPEDIA_CLIENT_ID: str = "YOUR_WIKIPEDIA_CLIENT_ID_HERE"
    WIKIPEDIA_CLIENT_SECRET: str = "YOUR_WIKIPEDIA_CLIENT_SECRET_HERE"
    WIKIPEDIA_REDIRECT_URI: str = "http://localhost:8000/api/auth/wikipedia/callback"

    FRONTEND_URL: str = "http://localhost:5173"

    # Model Defaults
    DEFAULT_FAST_MODEL: str = "llama-3.3-70b-versatile"  # Groq
    DEFAULT_SMART_MODEL: str = "gemini-2.0-flash"         # Gemini
    DEFAULT_FALLBACK_MODEL: str = "gpt-4o-mini"           # OpenRouter

    class Config:
        env_file = ".env"

settings = Settings()
