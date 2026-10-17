from app.services.document_service import extract_text


def test_extracted_text_is_safe_for_database_storage(tmp_path):
    source = tmp_path / 'source.txt'
    source.write_bytes(b'Water\x00 conservation reduces waste.')

    assert extract_text(str(source)) == 'Water conservation reduces waste.'


def test_docx_paragraphs_and_tables_keep_reading_order_and_duplicate_boilerplate(tmp_path):
    from docx import Document

    path=tmp_path / 'report.docx'
    document=Document()
    document.add_paragraph('Cover information repeated across copies')
    boilerplate='Department of Computer Science, Example College, project report submission information.'
    document.add_paragraph(boilerplate)
    document.add_paragraph(boilerplate)
    document.add_paragraph('## Project objectives and scope', style='Heading 1')
    document.add_paragraph('The system addresses a documented processing problem and defines its objectives.')
    table=document.add_table(rows=2, cols=2)
    table.cell(0, 0).text='Metric'
    table.cell(0, 1).text='Result'
    table.cell(1, 0).text='Latency'
    table.cell(1, 1).text='Reduced by 30 percent in the April pilot.'
    document.add_paragraph('## Implementation and results', style='Heading 1')
    document.add_paragraph('The report describes the implemented architecture and test outcomes.')
    document.save(path)

    extracted=extract_text(str(path))
    assert extracted.index('objectives and scope') < extracted.index('Metric | Result')
    assert extracted.index('Metric | Result') < extracted.index('Implementation and results')
    assert 'Reduced by 30 percent' in extracted
    assert extracted.count('Cover information') == 1
    assert extracted.count(boilerplate) == 1
