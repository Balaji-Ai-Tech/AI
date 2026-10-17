from io import BytesIO
from types import SimpleNamespace

from pptx import Presentation

from app.services.export_service import (
    create_export,
    render_html_document,
    supported_export_formats,
)


def test_html_export_escapes_untrusted_content_and_renders_sections():
    html = render_html_document(
        '<script>alert(1)</script>',
        'advisory',
        '# Findings\n\n- <script>bad()</script>\n\nA source-grounded paragraph.',
    ).decode('utf-8')

    assert '<title>&lt;script&gt;alert(1)&lt;/script&gt;</title>' in html
    assert '<h2>Findings</h2>' in html
    assert '<li>&lt;script&gt;bad()&lt;/script&gt;</li>' in html
    assert '<script>bad()</script>' not in html
    assert '<p>A source-grounded paragraph.</p>' in html


def test_presentation_export_creates_editable_section_slides():
    output = SimpleNamespace(
        title='Service Update',
        output_type='presentation',
        content='# Key findings\n- Response time improved\n- Reliability increased\n\n'
        '## Recommended actions\n- Continue monitoring\n',
        content_json={},
    )

    body, mime, extension = create_export(output, 'pptx')
    presentation = Presentation(BytesIO(body))

    assert mime == 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    assert extension == 'pptx'
    assert len(presentation.slides) == 3
    assert presentation.slides[0].shapes.title.text == 'Service Update'
    assert presentation.slides[1].shapes.title.text == 'Key findings'
    assert 'Response time improved' in presentation.slides[1].placeholders[1].text
    assert presentation.slides[2].shapes.title.text == 'Recommended actions'


def test_export_formats_follow_output_type_and_keep_legacy_markdown():
    assert supported_export_formats('executive_summary') == (
        'pdf', 'docx', 'txt', 'json', 'md'
    )
    assert 'html' in supported_export_formats('advisory')
    assert supported_export_formats('presentation') == ('pptx', 'pdf', 'md')
    assert 'pptx' not in supported_export_formats('linkedin')
