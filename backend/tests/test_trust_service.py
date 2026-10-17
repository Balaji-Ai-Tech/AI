from app.services.trust_service import detect_pii, validate_output


def test_detect_pii_masks_email_and_phone():
    findings = detect_pii('Contact test.person@example.com or call 9876543210')
    assert any(item['type'] == 'email' for item in findings)
    assert any(item['type'] == 'phone' for item in findings)
    assert all('test.person@example.com' not in item['masked_sample'] for item in findings)


def test_validation_flags_unmapped_claim():
    result = validate_output(
        'A short summary.',
        {'evidence': [{'chunk_id': 'chunk-1'}], 'claims': [{'text': 'A claim', 'evidence_chunk_ids': []}]},
        {'chunk-1'},
    )
    assert result['passed'] is False
    assert result['unmapped_claim_count'] == 1


def test_validation_accepts_mapped_claim_without_pii():
    result = validate_output(
        'A short summary.',
        {'evidence': [{'chunk_id': 'chunk-1'}], 'claims': [{'text': 'A claim', 'evidence_chunk_ids': ['chunk-1']}]},
        {'chunk-1'},
    )
    assert result['passed'] is True


def test_validation_flags_unknown_evidence_reference():
    result = validate_output(
        'A short summary.',
        {'evidence': [{'chunk_id': 'chunk-x'}], 'claims': [{'text': 'A claim', 'evidence_chunk_ids': ['not-in-this-document']}]},
        {'chunk-x'},
    )
    assert result['passed'] is False
    assert result['invalid_evidence_reference_count'] == 1


def test_validation_flags_empty_output():
    result = validate_output('', {'evidence': [], 'claims': []}, set())
    assert result['passed'] is False
    assert 'Output content is empty.' in result['issues']


def test_pii_scan_limits_findings():
    text = ' '.join(f'user{i}@example.com' for i in range(70))
    assert len(detect_pii(text)) <= 50
