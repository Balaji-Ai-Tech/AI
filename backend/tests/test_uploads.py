import asyncio
from pathlib import Path
from tempfile import NamedTemporaryFile

import pytest
from fastapi import HTTPException, UploadFile

from app.api.uploads import _copy_upload_to_temp


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
