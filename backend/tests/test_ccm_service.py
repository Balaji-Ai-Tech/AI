import asyncio
import json

import pytest

from app.core.config import settings
from app.services.ccm_service import build_ccm


def test_gemini_builds_canonical_content(monkeypatch):
    captured = {}

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                'candidates': [{
                    'content': {'parts': [{
                        'text': json.dumps({
                            'doc': {'language': 'English', 'title': 'Project report'},
                            'topics': ['document indexing'],
                            'keywords': [],
                            'entities': [],
                            'events': [],
                            'timeline': [],
                            'claims': [{'id': 'claim-1', 'text': 'The report describes indexing.', 'source_chunk_ids': []}],
                            'evidence': [],
                            'pii': [],
                            'provenance': {},
                        })
                    }]},
                }]
            }

    class FakeClient:
        def __init__(self, **kwargs):
            captured['timeout'] = kwargs.get('timeout')

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, url, headers, json):
            captured.update(url=url, headers=headers, request=json)
            return FakeResponse()

    monkeypatch.setattr(settings, 'LLM_PROVIDER', ' Gemini ')
    monkeypatch.setattr(settings, 'GEMINI_API_KEY', 'test-key')
    monkeypatch.setattr(settings, 'GEMINI_MODEL', 'test-model')
    monkeypatch.setattr('app.services.ccm_service.httpx.AsyncClient', FakeClient)

    result = asyncio.run(build_ccm('The report describes indexing.'))

    assert result['doc']['title'] == 'Project report'
    assert result['claims'][0]['text'] == 'The report describes indexing.'
    assert result['provenance'] == {'extractor': 'gemini', 'model': 'test-model'}
    assert captured['url'].endswith('/models/test-model:generateContent')
    assert captured['headers']['x-goog-api-key'] == 'test-key'
    assert captured['request']['generationConfig']['responseMimeType'] == 'application/json'


def test_gemini_ccm_requires_api_key(monkeypatch):
    monkeypatch.setattr(settings, 'LLM_PROVIDER', 'gemini')
    monkeypatch.setattr(settings, 'GEMINI_API_KEY', '')

    with pytest.raises(RuntimeError, match='GEMINI_API_KEY is missing'):
        asyncio.run(build_ccm('A readable source document.'))


def test_unknown_provider_keeps_source_indexing_available(monkeypatch):
    monkeypatch.setattr(settings, 'LLM_PROVIDER', 'unexpected-provider')

    result = asyncio.run(build_ccm('The source contains a factual statement.'))

    assert result['claims'][0]['text'] == 'The source contains a factual statement.'
    assert result['provenance'] == {
        'extractor': 'offline-demo-provider-fallback',
        'model': 'rule-based-ccm',
        'configured_provider': 'unexpected-provider',
    }

