import asyncio
import os

import pytest
from fastapi import HTTPException

from app.api.uploads import _copy_upload_to_temp
from app.core.config import settings
from app.services.ollama_service import OllamaGenerationError, generate_text


class ChunkedUpload:
    def __init__(self, content: bytes):
        self.content = content

    async def read(self, size: int) -> bytes:
        chunk, self.content = self.content[:size], self.content[size:]
        return chunk


def test_upload_copy_accepts_files_at_configured_limit():
    path, size = asyncio.run(_copy_upload_to_temp(ChunkedUpload(b'1234'), '.txt', max_bytes=4))
    try:
        assert size == 4
        with open(path, 'rb') as uploaded:
            assert uploaded.read() == b'1234'
    finally:
        os.remove(path)


def test_upload_copy_rejects_files_over_configured_limit():
    with pytest.raises(HTTPException) as error:
        asyncio.run(_copy_upload_to_temp(ChunkedUpload(b'12345'), '.txt', max_bytes=4))

    assert error.value.status_code == 413


def test_unavailable_ollama_returns_a_clear_generation_error(monkeypatch):
    monkeypatch.setattr(settings, 'OLLAMA_BASE_URL', 'http://127.0.0.1:1')

    with pytest.raises(OllamaGenerationError, match='Cannot reach Ollama at'):
        asyncio.run(generate_text('Source evidence for this test.', 'Executive Summary', 'en', max_tokens=8))
