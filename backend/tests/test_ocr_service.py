import sys
from types import SimpleNamespace
from unittest.mock import Mock

from PIL import Image

from app.services import ocr_service


def test_extract_image_text_uses_paddle_when_tesseract_returns_empty(
    monkeypatch, tmp_path
):
    image_path = tmp_path / 'image.png'
    Image.new('RGB', (20, 20), 'white').save(image_path)
    paddle_text = Mock(return_value='Recognized text')
    monkeypatch.setattr(ocr_service, 'configure_tesseract', lambda _: None)
    monkeypatch.setattr(ocr_service, '_extract_paddle_text', paddle_text)
    monkeypatch.setitem(
        sys.modules,
        'pytesseract',
        SimpleNamespace(image_to_string=Mock(return_value='')),
    )

    assert ocr_service.extract_image_text(str(image_path)) == 'Recognized text'
    paddle_text.assert_called_once_with(str(image_path))


def test_extract_image_text_returns_tesseract_text_without_paddle(
    monkeypatch, tmp_path
):
    image_path = tmp_path / 'image.png'
    Image.new('RGB', (20, 20), 'white').save(image_path)
    paddle_text = Mock()
    monkeypatch.setattr(ocr_service, 'configure_tesseract', lambda _: None)
    monkeypatch.setattr(ocr_service, '_extract_paddle_text', paddle_text)
    monkeypatch.setitem(
        sys.modules,
        'pytesseract',
        SimpleNamespace(image_to_string=Mock(return_value=' Tesseract text ')),
    )

    assert ocr_service.extract_image_text(str(image_path)) == 'Tesseract text'
    paddle_text.assert_not_called()


def test_extract_paddle_text_parses_paddleocr_results(monkeypatch):
    class FakePaddleOCR:
        def __init__(self, **kwargs):
            assert kwargs == {
                'use_doc_orientation_classify': False,
                'use_doc_unwarping': False,
                'use_textline_orientation': True,
                'lang': 'en',
            }

        def predict(self, image_path):
            assert image_path == 'image.png'
            return [
                {'rec_texts': [' First line ', '', None, 'Second line']},
                {'rec_texts': ['Third line']},
            ]

    monkeypatch.setattr(ocr_service, '_paddle_ocr', None)
    monkeypatch.setitem(
        sys.modules,
        'paddleocr',
        SimpleNamespace(PaddleOCR=FakePaddleOCR),
    )

    assert ocr_service._extract_paddle_text('image.png') == (
        'First line\nSecond line\nThird line'
    )
