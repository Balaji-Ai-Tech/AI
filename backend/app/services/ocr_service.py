"""OCR adapter. Tesseract is the lightweight default; PaddleOCR is optional."""
from __future__ import annotations

import os
import shutil
from pathlib import Path

_paddle_ocr = None


def configure_tesseract(pytesseract) -> None:
    if shutil.which('tesseract'):
        return

    if os.name == 'nt':
        install_dir = Path(os.environ.get('ProgramFiles', r'C:\Program Files'))
        executable = install_dir / 'Tesseract-OCR' / 'tesseract.exe'
        if executable.is_file():
            pytesseract.pytesseract.tesseract_cmd = str(executable)


def _extract_paddle_text(image_path: str) -> str:
    global _paddle_ocr

    from paddleocr import PaddleOCR

    if _paddle_ocr is None:
        _paddle_ocr = PaddleOCR(
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=True,
            lang='en',
        )

    results = _paddle_ocr.predict(image_path)
    lines = []
    for result in results or []:
        texts = result.get('rec_texts', [])
        lines.extend(text.strip() for text in texts if isinstance(text, str) and text.strip())
    return '\n'.join(lines).strip()


def extract_image_text(image_path: str) -> str:
    tesseract_error = None
    try:
        from PIL import Image
        import pytesseract
        configure_tesseract(pytesseract)
        with Image.open(image_path) as image:
            text = pytesseract.image_to_string(image).strip()
        if text:
            return text
    except Exception as exc:
        tesseract_error = exc
    try:
        text = _extract_paddle_text(image_path)
        if text:
            return text
    except Exception as exc:
        if tesseract_error is None:
            raise ValueError('PaddleOCR fallback failed while processing the image.') from exc
        raise ValueError(
            'Image OCR failed in both Tesseract and PaddleOCR. Check the image quality and OCR installation.'
        ) from exc
    if tesseract_error:
        raise ValueError(
            'No readable text was found by Tesseract or PaddleOCR. Try a clearer image; cursive handwriting may not be recognized.'
        ) from tesseract_error
    raise ValueError(
        'No readable text was found. Try a clearer image; cursive handwriting may not be recognized.'
    )
