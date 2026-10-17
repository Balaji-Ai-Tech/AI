from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from app.core.config import settings
from app.core.cors import get_cors_origins
from app.db.database import engine
from app.db.models import Base
from app.api.transformations import router as transformations_router
from app.api.uploads import router as uploads_router
from app.api.rag import router as rag_router
from app.api.generation import router as generation_router
from app.api.auth import router as auth_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # MVP bootstrap. Replace with Alembic migrations before production.
    async with engine.begin() as conn:
        if engine.dialect.name == 'postgresql':
            await conn.exec_driver_sql('CREATE EXTENSION IF NOT EXISTS vector')
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()

app = FastAPI(title=settings.APP_NAME, version='3.0.0', lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(settings.FRONTEND_URL),
    allow_credentials=True, allow_methods=['*'], allow_headers=['*'],
)
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SESSION_SECRET_KEY or settings.JWT_SECRET_KEY,
    same_site='lax',
    https_only=settings.APP_ENV.lower() == 'production',
)
app.include_router(transformations_router)
app.include_router(uploads_router)
app.include_router(rag_router)
app.include_router(generation_router)
app.include_router(auth_router)

@app.get('/api/integrations/status', tags=['Integrations'])
async def integrations_status():
    """Expose non-secret provider settings so the UI can show the active integration mode."""
    generation_provider = (settings.GENERATION_PROVIDER or settings.LLM_PROVIDER).strip().lower()
    generation_model = settings.OLLAMA_MODEL if generation_provider == 'ollama' else settings.GEMINI_MODEL if generation_provider == 'gemini' else settings.LLM_MODEL
    return {
        'generation': {
            'provider': generation_provider,
            'model': generation_model,
            'mode': 'offline demo' if generation_provider == 'demo' else 'live provider',
        },
        'embeddings': {
            'provider': settings.EMBEDDING_PROVIDER.strip().lower(),
            'model': settings.EMBEDDING_MODEL,
            'dimensions': settings.EMBEDDING_DIMENSIONS,
        },
        'configuration_source': 'backend environment',
    }

@app.get('/')
async def root(): return {'name': settings.APP_NAME, 'status': 'running'}

@app.get('/health')
async def health():
    """Liveness probe: confirms the API process is responding."""
    return {'status': 'healthy', 'service': settings.APP_NAME}

@app.get('/health/ready')
async def readiness():
    """Readiness probe: verifies the API can reach PostgreSQL."""
    try:
        async with engine.connect() as connection:
            await connection.exec_driver_sql('SELECT 1')
    except Exception as exc:
        # Do not expose database credentials or connection details in the response.
        raise HTTPException(status_code=503, detail='Database is not ready') from exc
    return {'status': 'ready', 'checks': {'database': 'ok'}}
