from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.core.config import settings


def async_database_url(url: str) -> str:
    """Accept Render's standard Postgres URL while preserving asyncpg connections."""
    if url.startswith('postgres://'):
        return 'postgresql+asyncpg://' + url.removeprefix('postgres://')
    if url.startswith('postgresql://'):
        return 'postgresql+asyncpg://' + url.removeprefix('postgresql://')
    return url


engine = create_async_engine(async_database_url(settings.DATABASE_URL), echo=settings.DEBUG, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
async def get_db():
    async with SessionLocal() as session:
        yield session
