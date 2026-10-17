from __future__ import annotations

from html import escape
import io
import json
import re
from typing import Any


COMMON_EXPORT_FORMATS = ('pdf', 'docx', 'txt', 'json', 'md', 'html')
EXPORT_FORMATS_BY_OUTPUT_TYPE = {
    'executive_summary': ('pdf', 'docx', 'txt', 'json', 'md'),
    'advisory': ('pdf', 'docx', 'html', 'json', 'md'),
    'presentation': ('pptx', 'pdf', 'md'),
    'linkedin': ('txt', 'docx', 'html', 'json', 'md'),
    'x_post': ('txt', 'docx', 'html', 'json', 'md'),
    'x_thread': ('txt', 'docx', 'html', 'json', 'md'),
    'infographic': ('pdf', 'html', 'json', 'md'),
    'image_prompt': COMMON_EXPORT_FORMATS,
    'video_package': ('docx', 'pdf', 'txt', 'json', 'md'),
}

OUTPUT_TYPE_NAMES = {
    'executive_summary': 'Executive Summary',
    'advisory': 'Advisory Report',
    'presentation': 'Presentation Slides',
    'linkedin': 'Social Media Post',
    'x_post': 'Social Media Post',
    'x_thread': 'Social Media Post',
    'infographic': 'Infographic',
    'video_package': 'Video Package',
}

MIME_TYPES = {
    'json': 'application/json',
    'md': 'text/markdown; charset=utf-8',
    'txt': 'text/plain; charset=utf-8',
    'html': 'text/html; charset=utf-8',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'pdf': 'application/pdf',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}


def supported_export_formats(output_type: str) -> tuple[str, ...]:
    return EXPORT_FORMATS_BY_OUTPUT_TYPE.get(output_type, COMMON_EXPORT_FORMATS)


def render_html_document(title: str, output_type: str, content: str) -> bytes:
    safe_title = escape(title)
    type_label = escape(OUTPUT_TYPE_NAMES.get(output_type, output_type.replace('_', ' ').title()))
    blocks: list[str] = []
    list_items: list[str] = []

    def flush_list() -> None:
        if list_items:
            blocks.append('<ul>' + ''.join(list_items) + '</ul>')
            list_items.clear()

    for line in content.splitlines():
        stripped = line.strip()
        if not stripped:
            flush_list()
        elif stripped.startswith(('-', '*', '•')):
            list_items.append(f'<li>{escape(stripped.lstrip("-*• ").strip())}</li>')
        else:
            flush_list()
            heading = re.match(r'^(#{1,3})\s+(.+)$', stripped)
            if heading:
                level = min(len(heading.group(1)) + 1, 4)
                blocks.append(f'<h{level}>{escape(heading.group(2))}</h{level}>')
            else:
                blocks.append(f'<p>{escape(stripped)}</p>')
    flush_list()

    html = f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{safe_title}</title>
  <style>
    body {{ font-family: Arial, sans-serif; line-height: 1.6; max-width: 850px; margin: 2rem auto; padding: 0 1rem; color: #172033; }}
    header {{ border-bottom: 2px solid #4f46e5; margin-bottom: 1.5rem; }}
    .kind {{ color: #4f46e5; font-size: .85rem; text-transform: uppercase; }}
    li {{ margin: .4rem 0; }}
  </style>
</head>
<body>
  <header><p class="kind">{type_label} · TransformHub AI</p><h1>{safe_title}</h1></header>
  <main>{''.join(blocks)}</main>
</body>
</html>'''
    return html.encode('utf-8')


def _presentation_sections(content: str) -> list[tuple[str, list[str]]]:
    sections: list[tuple[str, list[str]]] = []
    current_title = ''
    current_lines: list[str] = []
    for line in content.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        heading = re.match(r'^#{1,3}\s+(.+)$', stripped)
        if heading:
            if current_title or current_lines:
                sections.append((current_title, current_lines))
            current_title = heading.group(1).strip()
            current_lines = []
        elif stripped.startswith(('-', '*', '•')):
            current_lines.append(stripped.lstrip('-*• ').strip())
        else:
            current_lines.append(stripped)
    if current_title or current_lines:
        sections.append((current_title, current_lines))

    if not sections:
        return [('Key points', ['No slide content was provided.'])]

    normalized: list[tuple[str, list[str]]] = []
    for index, (section_title, lines) in enumerate(sections, 1):
        title = section_title or f'Key points {index}'
        parts = [line for line in lines if line]
        for start in range(0, len(parts), 6):
            chunk = parts[start:start + 6]
            chunk_title = title if start == 0 else f'{title} (continued)'
            normalized.append((chunk_title, chunk))
    return normalized


def build_presentation(title: str, content: str) -> bytes:
    from pptx import Presentation
    from pptx.util import Inches, Pt

    presentation = Presentation()
    presentation.slide_width = Inches(13.333)
    presentation.slide_height = Inches(7.5)

    title_slide = presentation.slides.add_slide(presentation.slide_layouts[0])
    title_slide.shapes.title.text = title
    if len(title_slide.placeholders) > 1:
        title_slide.placeholders[1].text = 'Presentation Slides · TransformHub AI'

    for section_title, bullet_lines in _presentation_sections(content):
        slide = presentation.slides.add_slide(presentation.slide_layouts[1])
        slide.shapes.title.text = section_title[:200]
        frame = slide.placeholders[1].text_frame
        frame.clear()
        frame.word_wrap = True
        for index, line in enumerate(bullet_lines):
            paragraph = frame.paragraphs[0] if index == 0 else frame.add_paragraph()
            paragraph.text = line[:500]
            paragraph.level = 0
            paragraph.font.size = Pt(22)

    buffer = io.BytesIO()
    presentation.save(buffer)
    return buffer.getvalue()


def create_export(output: Any, export_format: str) -> tuple[bytes, str, str]:
    title = str(output.title)
    content = str(output.content)
    output_type = str(output.output_type)

    if export_format == 'json':
        body = json.dumps(
            {
                'title': title,
                'type': output_type,
                'content': content,
                'evidence': (output.content_json or {}).get('evidence', []),
            },
            ensure_ascii=False,
            indent=2,
        ).encode('utf-8')
    elif export_format in {'md', 'txt'}:
        text = f'# {title}\n\n{content}' if export_format == 'md' else f'{title}\n\n{content}'
        body = text.encode('utf-8')
    elif export_format == 'html':
        body = render_html_document(title, output_type, content)
    elif export_format == 'docx':
        from docx import Document

        document = Document()
        document.add_heading(title, 0)
        for line in content.splitlines():
            document.add_paragraph(line)
        buffer = io.BytesIO()
        document.save(buffer)
        body = buffer.getvalue()
    elif export_format == 'pdf':
        import fitz

        pdf = fitz.open()
        page = pdf.new_page(width=595, height=842)
        y = 54
        for line in f'{title}\n\n{content}'.splitlines():
            wrapped = [line[i:i + 90] for i in range(0, max(len(line), 1), 90)] or ['']
            for part in wrapped:
                if y > 790:
                    page = pdf.new_page(width=595, height=842)
                    y = 54
                page.insert_text((42, y), part[:120], fontsize=10, fontname='helv')
                y += 14
        body = pdf.tobytes()
        pdf.close()
    elif export_format == 'pptx':
        body = build_presentation(title, content)
    else:
        raise ValueError(f'Unsupported export format: {export_format}')

    return body, MIME_TYPES[export_format], export_format
