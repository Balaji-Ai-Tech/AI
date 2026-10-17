import asyncio
from pathlib import Path
from tempfile import NamedTemporaryFile

import pytest
from fastapi import HTTPException, UploadFile

from app.api.uploads import _check_source_response, _copy_upload_to_temp
import httpx


def test_copy_upload_to_temp_rejects_files_over_limit():
    size = 50 * 1024 * 1024 + 1
    chunk = b'a' * (1024 * 1024)
    with NamedTemporaryFile() as source:
        for _ in range(size // len(chunk)):
            source.write(chunk)
        source.write(b'a' * (size % len(chunk)))
        source.flush()
        source.seek(0)
        upload_file = UploadFile(filename='large.txt', file=source)
        with pytest.raises(HTTPException) as error:
            asyncio.run(_copy_upload_to_temp(upload_file, '.txt'))

    assert error.value.status_code == 413
    assert '50 MB' in error.value.detail


def test_blocked_source_url_returns_actionable_alternatives():
    response = httpx.Response(403)

    with pytest.raises(HTTPException) as error:
        _check_source_response(response, 'The source URL')

    assert error.value.status_code == 422
    assert 'denied automated access (HTTP 403)' in error.value.detail
    assert 'Save the page as a PDF' in error.value.detail
    assert 'Paste text' in error.value.detail


def test_source_http_errors_are_reported_with_source_context():
    response = httpx.Response(503)

    with pytest.raises(HTTPException) as error:
        _check_source_response(response, 'The RSS feed')

    assert error.value.status_code == 422
    assert error.value.detail == 'The RSS feed returned HTTP 503.'
