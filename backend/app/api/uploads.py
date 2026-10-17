import os
import tempfile
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.auth import get_current_user
from app.db.database import get_db
from app.db.models import User, Transformation, UploadedFile
from app.schemas.transformation import UploadResponse
from app.services.ai_service import summarize
from app.services.document_service import extract_text
from app.services.storage_service import upload
from app.services.index_service import index_source

router = APIRouter(prefix='/api/uploads', tags=['Uploads'])
PDF = 'application/pdf'
DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
ALLOWED = {PDF, DOCX}
MAX_INGESTED_CONTENT_BYTES = 50 * 1024 * 1024


async def _summarize_source(text: str) -> dict:
    try:
        return await summarize(text)
    except Exception as exc:
        raise HTTPException(
            503,
            'Source extraction succeeded, but summarization failed. Check the configured language model and try again.',
        ) from exc


async def _copy_upload_to_temp(
    file: UploadFile,
    suffix: str,
    max_bytes: int = MAX_INGESTED_CONTENT_BYTES,
) -> tuple[str, int]:
    fd, path = tempfile.mkstemp(suffix=suffix)
    size = 0
    try:
        with os.fdopen(fd, 'wb') as out:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > max_bytes:
                    raise HTTPException(413, 'Uploaded file exceeds the 50 MB per-file limit.')
                out.write(chunk)
        return path, size
    except Exception:
        try:
            os.remove(path)
        except OSError:
            pass
        raise

@router.post('', response_model=UploadResponse)
async def upload_document(
    transformation_id: str = Form(...),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if file.content_type not in ALLOWED:
        raise HTTPException(400, 'Only PDF and DOCX are supported in this ingestion stage.')
    transformation = (await db.execute(select(Transformation).where(
        Transformation.id == transformation_id, Transformation.user_id == user.id
    ))).scalar_one_or_none()
    if not transformation:
        raise HTTPException(404, 'Transformation not found')

    suffix = '.pdf' if file.content_type == PDF else '.docx'
    path, size = await _copy_upload_to_temp(file, suffix)
    try:
        if not size:
            raise HTTPException(400, 'Uploaded file is empty')
        text = extract_text(path, file.content_type)
        key = f'{user.id}/{transformation_id}/{file.filename}'
        upload(path, key, file.content_type)
        analysis = await _summarize_source(text) if text else {'title': file.filename, 'summary': ''}
        title = str(analysis.get('title') or file.filename).strip()[:500]
        summary = str(analysis.get('summary') or '').strip()

        source = UploadedFile(
            transformation_id=transformation_id, filename=file.filename,
            object_key=key, content_type=file.content_type, extracted_text=text,
        )
        db.add(source)
        await db.flush()
        transformation.title = title
        transformation.summary = summary
        try:
            await index_source(db, source, transformation)
        except Exception as exc:
            transformation.status = 'extracted'
            await db.commit()
            raise HTTPException(503, f'AI indexing failed. Check the configured language and embedding providers: {exc}')
        await db.commit()
        await db.refresh(source)
        return UploadResponse(
            file_id=source.id, transformation_id=transformation_id,
            filename=file.filename, content_type=file.content_type,
            object_key=key, title=title, summary=summary, text_length=len(text),
        )
    finally:
        try: os.remove(path)
        except OSError: pass


# Multi-file ingestion endpoint. The original single-file endpoint remains compatible.
from pathlib import Path
from uuid import uuid4
from app.services.ccm_service import build_ccm

BATCH_MAX_FILES = 10
ALLOWED_EXTENSIONS = {
    '.pdf', '.docx', '.pptx', '.txt', '.md', '.markdown', '.csv', '.json',
    '.xml', '.html', '.htm', '.log', '.rtf', '.png', '.jpg', '.jpeg',
    '.webp', '.bmp', '.tif', '.tiff', '.mp3', '.wav', '.m4a', '.aac',
    '.flac', '.ogg', '.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v'
}

def _content_type(filename: str, provided: str | None) -> str:
    import mimetypes
    guessed = mimetypes.guess_type(filename)[0]
    return provided if provided and provided != 'application/octet-stream' else (guessed or 'application/octet-stream')

@router.post('/batch')
async def upload_documents_batch(
    transformation_id: str = Form(...),
    files: list[UploadFile] = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not files:
        raise HTTPException(400, 'Choose at least one file.')
    if len(files) > BATCH_MAX_FILES:
        raise HTTPException(400, f'Upload no more than {BATCH_MAX_FILES} files at once.')
    transformation = (await db.execute(select(Transformation).where(
        Transformation.id == transformation_id, Transformation.user_id == user.id
    ))).scalar_one_or_none()
    if not transformation:
        raise HTTPException(404, 'Transformation not found')

    stored_sources=[]
    combined_parts=[]
    total_bytes=0
    try:
        for file in files:
            filename = Path(file.filename or 'uploaded-file').name
            ext = Path(filename).suffix.lower()
            if ext not in ALLOWED_EXTENSIONS:
                raise HTTPException(400, f'{filename}: unsupported file type {ext or "(no extension)"}.')
            content_type=_content_type(filename, file.content_type)
            temp_path, file_size = await _copy_upload_to_temp(file, ext)
            try:
                if not file_size:
                    raise HTTPException(400, f'{filename}: file is empty.')
                total_bytes += file_size
                extracted=extract_text(temp_path, content_type)
                if not extracted.strip():
                    extracted='[No readable text extracted from this file. It may be blank, unsupported internally, or require OCR/transcription dependencies.]'
                key=f'{user.id}/{transformation_id}/{uuid4()}-{filename}'
                upload(temp_path, key, content_type)
                source=UploadedFile(
                    transformation_id=transformation_id, filename=filename,
                    object_key=key, content_type=content_type, extracted_text=extracted,
                )
                db.add(source)
                await db.flush()
                try:
                    await index_source(db, source, transformation)
                except Exception as exc:
                    raise HTTPException(503, f'Indexing failed for {filename}. Check the configured language and embedding providers: {exc}') from exc
                stored_sources.append({
                    'file_id': source.id, 'filename': filename, 'content_type': content_type,
                    'object_key': key, 'size_bytes': file_size, 'text_length': len(extracted),
                })
                combined_parts.append(f'===== SOURCE: {filename} =====\n{extracted}')
            finally:
                try: os.remove(temp_path)
                except OSError: pass

        combined_text='\n\n'.join(combined_parts)
        analysis=await _summarize_source(combined_text[:50000])
        title=str(analysis.get('title') or 'Combined source analysis').strip()[:500]
        summary=str(analysis.get('summary') or '').strip()
        transformation.title=title
        transformation.summary=summary
        transformation.canonical_content=await build_ccm(combined_text[:100000])
        transformation.status='indexed'
        await db.commit()
        return {
            'transformation_id': transformation_id,
            'title': title,
            'summary': summary,
            'file_count': len(stored_sources),
            'total_size_bytes': total_bytes,
            'total_text_length': len(combined_text),
            'files': stored_sources,
        }
    except HTTPException:
        await db.rollback()
        raise
    except Exception as exc:
        await db.rollback()
        raise HTTPException(500, f'Batch upload failed: {exc}') from exc

# Paste-text and public-URL ingestion are also supported, so every source type follows the
# same storage → extraction → canonical content → embedding index path.
from pydantic import BaseModel, Field
from urllib.parse import urljoin, urlparse
import ipaddress
import socket
import httpx


class TextUploadRequest(BaseModel):
    transformation_id: str = Field(min_length=1, max_length=36)
    filename: str = Field(default='pasted-source.txt', min_length=1, max_length=200)
    content: str = Field(min_length=20, max_length=2_000_000)


class UrlUploadRequest(BaseModel):
    transformation_id: str = Field(min_length=1, max_length=36)
    url: str = Field(min_length=8, max_length=2048)


async def _owned_transformation(transformation_id: str, user: User, db: AsyncSession) -> Transformation:
    row = (await db.execute(select(Transformation).where(
        Transformation.id == transformation_id, Transformation.user_id == user.id
    ))).scalar_one_or_none()
    if not row:
        raise HTTPException(404, 'Transformation not found')
    return row


async def _ingest_bytes(*, transformation_id: str, user: User, db: AsyncSession, filename: str,
                        content_type: str, data: bytes) -> UploadResponse:
    filename = Path(filename).name[:200] or 'uploaded-source.txt'
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f'Unsupported file type: {ext or "(no extension)"}.')
    if not data:
        raise HTTPException(400, 'Source content is empty.')
    if len(data) > MAX_INGESTED_CONTENT_BYTES:
        raise HTTPException(413, 'Source exceeds the 50 MB limit.')
    transformation = await _owned_transformation(transformation_id, user, db)
    fd, temp_path = tempfile.mkstemp(suffix=ext)
    os.close(fd)
    try:
        with open(temp_path, 'wb') as out:
            out.write(data)
        try:
            extracted = extract_text(temp_path, content_type)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        if not extracted.strip():
            raise HTTPException(422, 'No readable text could be extracted. For scanned PDFs, verify Tesseract OCR is installed.')
        key = f'{user.id}/{transformation_id}/{uuid4()}-{filename}'
        upload(temp_path, key, content_type or 'application/octet-stream')
        source = UploadedFile(
            transformation_id=transformation_id, filename=filename,
            object_key=key, content_type=content_type or 'application/octet-stream', extracted_text=extracted,
        )
        db.add(source)
        await db.flush()
        try:
            await index_source(db, source, transformation)
        except Exception as exc:
            await db.rollback()
            raise HTTPException(503, f'Source extraction succeeded but indexing failed. Check the configured language and embedding providers: {exc}') from exc
        analysis = await _summarize_source(extracted[:50000])
        transformation.title = str(analysis.get('title') or filename).strip()[:500]
        transformation.summary = str(analysis.get('summary') or '').strip()[:5000]
        transformation.status = 'indexed'
        await db.commit()
        await db.refresh(source)
        return UploadResponse(
            file_id=source.id, transformation_id=transformation_id, filename=source.filename,
            content_type=source.content_type, object_key=source.object_key,
            title=transformation.title, summary=transformation.summary or '', text_length=len(extracted),
        )
    finally:
        try: os.remove(temp_path)
        except OSError: pass


@router.post('/text', response_model=UploadResponse, status_code=201)
async def upload_pasted_text(req: TextUploadRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    filename = req.filename if Path(req.filename).suffix else f'{req.filename}.txt'
    safe_name = Path(filename).name
    if Path(safe_name).suffix.lower() not in {'.txt', '.md', '.markdown', '.csv', '.json', '.xml', '.html', '.log', '.rtf'}:
        safe_name = f'{Path(safe_name).stem}.txt'
    return await _ingest_bytes(
        transformation_id=req.transformation_id, user=user, db=db, filename=safe_name,
        content_type='text/plain', data=req.content.encode('utf-8'),
    )


def _assert_public_http_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {'https', 'http'} or not parsed.hostname or parsed.username or parsed.password:
        raise HTTPException(400, 'Use a valid public http/https URL without embedded credentials.')
    host = parsed.hostname.rstrip('.').lower()
    if host in {'localhost', 'localhost.localdomain'} or host.endswith(('.local', '.internal', '.localhost')):
        raise HTTPException(400, 'Private and local network URLs are not allowed.')
    try:
        addresses = {entry[4][0] for entry in socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == 'https' else 80), type=socket.SOCK_STREAM)}
    except OSError as exc:
        raise HTTPException(400, 'The source URL hostname could not be resolved.') from exc
    if not addresses or any(not ipaddress.ip_address(address).is_global for address in addresses):
        raise HTTPException(400, 'Private, local, and reserved network addresses are not allowed.')


@router.post('/url', response_model=UploadResponse, status_code=201)
async def upload_public_url(req: UrlUploadRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    current_url = req.url.strip()
    if not current_url.startswith(('http://', 'https://')):
        current_url = 'https://' + current_url
    # Re-check each redirect target to avoid a URL-fetch SSRF bypass.
    response = None
    async with httpx.AsyncClient(timeout=20, follow_redirects=False, headers={'User-Agent': 'TransformHubAI/1.0'}) as client:
        for _ in range(4):
            _assert_public_http_url(current_url)
            response = await client.get(current_url)
            if response.status_code in {301, 302, 303, 307, 308}:
                location = response.headers.get('location')
                if not location:
                    raise HTTPException(422, 'The source URL returned an invalid redirect.')
                current_url = urljoin(current_url, location)
                continue
            break
    if response is None or response.status_code in {301, 302, 303, 307, 308}:
        raise HTTPException(422, 'The source URL redirected too many times.')
    if response.status_code >= 400:
        raise HTTPException(422, f'The source URL returned HTTP {response.status_code}.')
    data = response.content
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(413, 'URL content exceeds the 8 MB web-source limit.')
    content_type = response.headers.get('content-type', 'text/html').split(';')[0].lower()
    if content_type not in {'text/html', 'text/plain', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}:
        raise HTTPException(415, f'Unsupported URL content type: {content_type}. Supported: HTML, text, PDF, DOCX.')
    path = urlparse(current_url).path
    if content_type == 'application/pdf':
        filename = Path(path).name or 'web-source.pdf'
        if not filename.lower().endswith('.pdf'): filename += '.pdf'
    elif 'wordprocessingml' in content_type:
        filename = Path(path).name or 'web-source.docx'
        if not filename.lower().endswith('.docx'): filename += '.docx'
    elif content_type == 'text/plain':
        filename = Path(path).name or 'web-source.txt'
        if Path(filename).suffix.lower() not in {'.txt', '.md', '.csv', '.json', '.xml', '.log', '.rtf'}: filename = 'web-source.txt'
    else:
        filename = Path(path).name or 'web-source.html'
        if not filename.lower().endswith(('.html', '.htm')): filename += '.html'
    return await _ingest_bytes(
        transformation_id=req.transformation_id, user=user, db=db, filename=filename,
        content_type=content_type, data=data,
    )


@router.post('/rss', response_model=UploadResponse, status_code=201)
async def upload_rss_feed(req: UrlUploadRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Read a public RSS/Atom feed and index up to 50 recent feed entries as plain text."""
    import xml.etree.ElementTree as ET
    from html import unescape
    from html.parser import HTMLParser

    current_url = req.url.strip()
    if not current_url.startswith(('http://', 'https://')):
        current_url = 'https://' + current_url
    response = None
    async with httpx.AsyncClient(timeout=20, follow_redirects=False, headers={'User-Agent': 'TransformHubAI/1.0 RSS reader'}) as client:
        for _ in range(4):
            _assert_public_http_url(current_url)
            response = await client.get(current_url)
            if response.status_code in {301, 302, 303, 307, 308}:
                location = response.headers.get('location')
                if not location:
                    raise HTTPException(422, 'RSS feed returned an invalid redirect.')
                current_url = urljoin(current_url, location)
                continue
            break
    if response is None or response.status_code in {301, 302, 303, 307, 308}:
        raise HTTPException(422, 'RSS feed redirected too many times.')
    if response.status_code >= 400:
        raise HTTPException(422, f'RSS feed returned HTTP {response.status_code}.')
    if len(response.content) > 8 * 1024 * 1024:
        raise HTTPException(413, 'RSS feed exceeds the 8 MB limit.')
    try:
        root = ET.fromstring(response.content)
    except ET.ParseError as exc:
        raise HTTPException(422, 'The URL did not return valid RSS/Atom XML.') from exc

    def local_name(tag: str) -> str:
        return tag.split('}', 1)[-1].lower()

    def child_text(node, names):
        for child in list(node):
            if local_name(child.tag) in names:
                text_value = ''.join(child.itertext()).strip()
                if not text_value:
                    href = child.attrib.get('href', '')
                    text_value = href.strip()
                if text_value:
                    return text_value
        return ''

    class StripMarkup(HTMLParser):
        def __init__(self): super().__init__(); self.parts=[]
        def handle_data(self, data):
            if data.strip(): self.parts.append(data.strip())

    def clean_markup(value: str) -> str:
        parser = StripMarkup()
        try: parser.feed(value)
        except Exception: pass
        return unescape(' '.join(parser.parts)).strip() or unescape(value).strip()

    items = [node for node in root.iter() if local_name(node.tag) in {'item', 'entry'}]
    if not items:
        # Some feeds expose a lone channel with a title/description but no entries.
        title = child_text(root, {'title'})
        desc = child_text(root, {'description', 'subtitle', 'summary'})
        if title or desc:
            items = [root]
    if not items:
        raise HTTPException(422, 'The feed contains no RSS/Atom entries.')

    feed_lines = [f'RSS / Atom feed imported from: {current_url}', '']
    for index, item in enumerate(items[:50], 1):
        title = child_text(item, {'title'}) or f'Feed entry {index}'
        link = child_text(item, {'link'})
        description = child_text(item, {'description', 'summary', 'content', 'encoded'})
        date = child_text(item, {'pubdate', 'published', 'updated', 'date'})
        feed_lines.extend([f'{index}. {title}', f'Date: {date}' if date else '', f'Link: {link}' if link else '', clean_markup(description) if description else '', ''])
    text_data = '\n'.join(line for line in feed_lines).strip()
    return await _ingest_bytes(
        transformation_id=req.transformation_id, user=user, db=db, filename='rss-feed.txt',
        content_type='text/plain', data=text_data.encode('utf-8'),
    )
