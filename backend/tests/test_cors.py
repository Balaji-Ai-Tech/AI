import pytest

from app.core.cors import get_cors_origins


def test_cors_origins_follow_configured_frontend_port():
    origins = get_cors_origins('http://localhost:3001')

    assert 'http://localhost:3001' in origins
    assert 'http://127.0.0.1:3001' in origins
    assert 'http://localhost:3000' in origins


def test_cors_origins_support_configured_loopback_ip():
    origins = get_cors_origins('http://127.0.0.1:3001')

    assert 'http://127.0.0.1:3001' in origins
    assert 'http://localhost:3001' in origins


@pytest.mark.parametrize('frontend_url', ['', 'localhost:3000', 'ftp://localhost:3000'])
def test_cors_origins_reject_invalid_frontend_url(frontend_url):
    with pytest.raises(ValueError, match='FRONTEND_URL must be an absolute HTTP'):
        get_cors_origins(frontend_url)
