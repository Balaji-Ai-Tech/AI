"""Text extraction for TransformHub AI source files.

Optional system tools: Tesseract OCR for images/scanned PDFs, FFmpeg for video.
Audio/video transcription uses faster-whisper's small `tiny` model on CPU.
"""
from __future__ import annotations
import html
import os
import re
import subprocess
import tempfile
from pathlib import Path

SUPPORTED_EXTENSIONS = {
    '.pdf', '.docx', '.pptx', '.txt', '.md', '.markdown', '.csv', '.json',
    '.xml', '.html', '.htm', '.log', '.rtf', '.png', '.jpg', '.jpeg',
    '.webp', '.bmp', '.tif', '.tiff', '.mp3', '.wav', '.m4a', '.aac',
    '.flac', '.ogg', '.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v'
}

class _HTMLTextParser:
    def __init__(self):
        from html.parser import HTMLParser
        class Parser(HTMLParser):
            def __init__(self):
                super().__init__(); self.parts=[]
            def handle_data(self, data):
                if data.strip(): self.parts.append(data.strip())
        self.parser = Parser()
    def get_text(self, text):
        self.parser.feed(text)
        return '\n'.join(self.parser.parts)

def _ocr_image(path: str) -> str:
    from app.services.ocr_service import extract_image_text
    return extract_image_text(path)

def extract_pdf_text(path: str) -> str:
    import fitz
    pages=[]
    with fitz.open(path) as doc:
        for page in doc:
            text = page.get_text().strip()
            if not text:
                # OCR scanned pages where possible; Tesseract is an optional system dependency.
                try:
                    import pytesseract
                    from PIL import Image
                    from app.services.ocr_service import configure_tesseract
                    configure_tesseract(pytesseract)
                    pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
                    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp:
                        image_path=temp.name
                    try:
                        pix.save(image_path)
                        with Image.open(image_path) as image:
                            text=pytesseract.image_to_string(image).strip()
                    finally:
                        try: os.remove(image_path)
                        except OSError: pass
                except Exception:
                    text=''
            if text: pages.append(text)
    return '\n\n'.join(pages).strip()

def extract_docx_text(path: str) -> str:
    from docx import Document
    from docx.table import Table
    from docx.text.paragraph import Paragraph
    doc=Document(path)
    parts=[]
    seen=set()
    # python-docx exposes paragraphs and tables separately; walk the body XML so
    # narrative and tabular evidence stay in their actual reading order.
    for block in doc.element.body.iterchildren():
        if block.tag.endswith('}p'):
            paragraph=Paragraph(block, doc)
            text=paragraph.text.strip()
            if not text:
                continue
            style=(paragraph.style.name or '').casefold() if paragraph.style else ''
            if style.startswith('heading'):
                level=re.search(r'(\d+)', style)
                text=f"{'#' * min(int(level.group(1)) if level else 1, 6)} {text}"
            elif style.startswith('list'):
                text=f'- {text}'
            key=' '.join(text.casefold().split())
            # Only remove verbatim, repeated paragraphs. The uploaded original
            # remains intact; similar or short repeated statements are preserved.
            if len(key) >= 45 and key in seen:
                continue
            seen.add(key)
            parts.append(text)
        elif block.tag.endswith('}tbl'):
            table=Table(block, doc)
            for row in table.rows:
                cells=[]
                for cell in row.cells:
                    value=' '.join(cell.text.split())
                    # Merged cells can appear multiple times in a row in the XML.
                    if value and value not in cells:
                        cells.append(value)
                if cells:
                    parts.append(' | '.join(cells))
    return '\n'.join(parts).strip()

def extract_pptx_text(path: str) -> str:
    from pptx import Presentation
    prs=Presentation(path); parts=[]
    for i, slide in enumerate(prs.slides, 1):
        slide_parts=[]
        for shape in slide.shapes:
            if getattr(shape, 'has_text_frame', False) and shape.text.strip():
                slide_parts.append(shape.text.strip())
            if getattr(shape, 'has_table', False):
                for row in shape.table.rows:
                    vals=[cell.text.strip() for cell in row.cells]
                    if any(vals): slide_parts.append(' | '.join(vals))
        if slide_parts: parts.append(f'[Slide {i}]\n'+'\n'.join(slide_parts))
    return '\n\n'.join(parts).strip()

def _transcribe_audio(path: str) -> str:
    try:
        from faster_whisper import WhisperModel
        model=WhisperModel('tiny', device='cpu', compute_type='int8')
        segments, _info = model.transcribe(path, vad_filter=True)
        return '\n'.join(seg.text.strip() for seg in segments if seg.text.strip()).strip()
    except Exception as exc:
        raise ValueError('Audio transcription failed. Check faster-whisper installation and allow its tiny model to download once.') from exc

def _video_to_audio(path: str) -> str:
    fd, wav_path=tempfile.mkstemp(suffix='.wav'); os.close(fd)
    try:
        proc=subprocess.run(['ffmpeg','-y','-i',path,'-vn','-ac','1','-ar','16000',wav_path],capture_output=True,text=True,timeout=300)
        if proc.returncode != 0:
            raise ValueError('Video audio extraction failed. Install FFmpeg and make sure it is available in PATH.')
        return _transcribe_audio(wav_path)
    except FileNotFoundError as exc:
        raise ValueError('Video transcription requires FFmpeg installed and available in PATH.') from exc
    finally:
        try: os.remove(wav_path)
        except OSError: pass

def _sanitize_extracted_text(text: str) -> str:
    return text.replace('\x00', '')

def extract_text(path: str, content_type: str = '') -> str:
    ext=Path(path).suffix.lower()
    if ext == '.pdf' or content_type == 'application/pdf':
        text = extract_pdf_text(path)
    elif ext == '.docx' or 'wordprocessingml' in content_type:
        text = extract_docx_text(path)
    elif ext == '.pptx' or 'presentationml' in content_type:
        text = extract_pptx_text(path)
    elif ext in {'.png','.jpg','.jpeg','.webp','.bmp','.tif','.tiff'}:
        text = _ocr_image(path)
    elif ext in {'.mp3','.wav','.m4a','.aac','.flac','.ogg'}:
        text = _transcribe_audio(path)
    elif ext in {'.mp4','.mov','.webm','.avi','.mkv','.m4v'}:
        text = _video_to_audio(path)
    elif ext in {'.txt','.md','.markdown','.csv','.json','.xml','.log'}:
        text = Path(path).read_text(encoding='utf-8', errors='replace').strip()
    elif ext in {'.html','.htm'}:
        text = _HTMLTextParser().get_text(Path(path).read_text(encoding='utf-8', errors='replace'))
    elif ext == '.rtf':
        raw=Path(path).read_text(encoding='utf-8', errors='replace')
        raw=re.sub(r"\\'[0-9a-fA-F]{2}", ' ', raw)
        raw=re.sub(r'\\[a-zA-Z]+-?\d* ?', ' ', raw)
        text = html.unescape(re.sub(r'[{}]', ' ', raw)).strip()
    else:
        raise ValueError(f'Unsupported file type: {ext or "unknown"}')
    return _sanitize_extracted_text(text)
