from datetime import datetime, timezone

from app.db.models import User


def test_render_postgres_connection_urls_are_normalized_to_asyncpg():
    from app.db.database import async_database_url

    assert async_database_url('postgresql://db:5432/app') == 'postgresql+asyncpg://db:5432/app'
    assert async_database_url('postgres://db:5432/app') == 'postgresql+asyncpg://db:5432/app'
    assert async_database_url('sqlite+aiosqlite:///./local.db') == 'sqlite+aiosqlite:///./local.db'


def test_user_created_at_default_is_utc_without_timezone():
    before = datetime.now(timezone.utc).replace(tzinfo=None)
    created_at = User.__table__.c.created_at.default.arg(None)
    after = datetime.now(timezone.utc).replace(tzinfo=None)

    assert created_at.tzinfo is None
    assert before <= created_at <= after
