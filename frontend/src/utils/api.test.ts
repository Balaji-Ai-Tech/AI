import assert from 'node:assert/strict';
import test from 'node:test';
import { apiRequest, generateTransformationOutputs, getTransformationExportUrl } from './api.ts';
import { CONTENT_LANGUAGES, normalizeContentLanguage, toggleContentLanguage } from './contentLanguages.ts';

test('generation sends output formats and selected language codes in the request body', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = '';
  let requestBody = '';
  const failures = [{ output_type: 'advisory', language: 'en', error: 'Output stopped at the token limit.' }];
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestBody = String(init?.body);
    return Response.json({ transformation_id: 'tx-1', status: 'partial_in_review', outputs: [], failed_outputs: failures });
  };

  try {
    const response = await generateTransformationOutputs('tx-1', ['executive_summary'], ['te', 'hi']);
    assert.match(requestUrl, /\/api\/transformations\/tx-1\/generate$/);
    assert.deepEqual(JSON.parse(requestBody), {
      output_types: ['executive_summary'],
      languages: ['te', 'hi'],
    });
    assert.deepEqual(response.failed_outputs, failures);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('HTML export uses the output export endpoint URL', () => {
  const url = getTransformationExportUrl('tx-1', 'out-1', 'html');
  assert.match(url, /\/api\/transformations\/tx-1\/outputs\/out-1\/export\?format=html$/);
});

test('content language selection uses native labels, normalizes legacy names, and keeps one selected', () => {
  assert.deepEqual(
    CONTENT_LANGUAGES.slice(0, 12).map(({ code }) => code),
    ['en', 'te', 'ta', 'hi', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa', 'ur', 'or'],
  );
  assert.equal(CONTENT_LANGUAGES.find(({ code }) => code === 'te')?.nativeName, 'తెలుగు');
  assert.equal(normalizeContentLanguage('Telugu'), 'te');
  assert.deepEqual(toggleContentLanguage(['English', 'Hindi'], 'hi'), ['en']);
  assert.deepEqual(toggleContentLanguage(['en'], 'ta'), ['en', 'ta']);
  assert.deepEqual(toggleContentLanguage(['en'], 'en'), ['en']);
});

test('API errors surface backend detail and bounded-request timeouts', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async () => Response.json(
    { detail: 'Multilingual generation requires a configured language model.' },
    { status: 503 },
  );
  await assert.rejects(
    apiRequest('/api/transformations/tx-1/generate'),
    /Multilingual generation requires a configured language model/,
  );

  globalThis.fetch = async () => {
    throw new DOMException('The operation timed out', 'TimeoutError');
  };
  await assert.rejects(
    apiRequest('/api/transformations/tx-1/generate'),
    /request timed out.*retry/i,
  );
});
