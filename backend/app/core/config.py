from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore', case_sensitive=True)
    APP_NAME: str = 'TransformHub AI'
    APP_ENV: str = 'development'
    DEBUG: bool = False
    # SQLite keeps the local MVP runnable without Docker or a preconfigured database.
    # Deployments can override this with PostgreSQL via the environment.
    DATABASE_URL: str = 'sqlite+aiosqlite:///./transformhub.db'
    JWT_SECRET_KEY: str = 'development-only-change-this-secret-before-deployment'
    JWT_ALGORITHM: str = 'HS256'
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    SESSION_SECRET_KEY: str = 'development-only-change-this-session-secret-before-deployment'

    MINIO_ENDPOINT: str = 'localhost:9000'
    MINIO_ACCESS_KEY: str = 'minioadmin'
    MINIO_SECRET_KEY: str = 'minioadmin'
    MINIO_BUCKET: str = 'transformhub'
    MINIO_SECURE: bool = False

    REDIS_URL: str = 'redis://localhost:6379/0'
    # demo: offline; ollama: local; litellm/vllm: OpenAI-compatible; gemini: Google Gemini API.
    LLM_PROVIDER: str = 'demo'
    GENERATION_PROVIDER: str = ''
    LLM_MODEL: str = 'Qwen/Qwen2.5-7B-Instruct'
    LITELLM_API_BASE: str = 'http://localhost:8001/v1'
    LITELLM_API_KEY: str = 'local-token'
    GEMINI_API_KEY: str = ''
    GEMINI_MODEL: str = 'gemini-3.8-flash'
    OLLAMA_BASE_URL: str = 'http://localhost:11434'
    OLLAMA_MODEL: str = 'qwen2.5:7b'
    OLLAMA_TIMEOUT_SECONDS: int = 180

    EMBEDDING_PROVIDER: str = 'demo'
    EMBEDDING_MODEL: str = 'BAAI/bge-m3'
    EMBEDDING_DIMENSIONS: int = 768
    RAG_TOP_K: int = 5

    FRONTEND_URL: str = 'http://localhost:3000'
    BACKEND_PUBLIC_URL: str = 'http://localhost:8000'
    GOOGLE_CLIENT_ID: str = ''
    GOOGLE_CLIENT_SECRET: str = ''
    FACEBOOK_CLIENT_ID: str = ''
    FACEBOOK_CLIENT_SECRET: str = ''
    FACEBOOK_GRAPH_VERSION: str = 'v24.0'
    X_CLIENT_ID: str = ''
    X_CLIENT_SECRET: str = ''
    LINKEDIN_CLIENT_ID: str = ''
    LINKEDIN_CLIENT_SECRET: str = ''


settings = Settings()
