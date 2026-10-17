import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeSourceContent } from './contentAnalysis.ts';

test('text preview metrics and excerpts are derived from the actual text', async () => {
  const source = '## Incident Report\nThe team recorded a 24% reduction in response time after the patch. Verify the deployment before expanding the rollout.';
  const result = await analyzeSourceContent(new File([source], 'incident.md', { type: 'text/markdown' }));

  assert.equal(result.wordCount, source.split(/\s+/).length);
  assert.equal(result.keyHeadings[0], 'Incident Report');
  assert.equal(result.keyEntities.includes('24%'), true);
  assert.equal(result.extractedQuotes[0].quote.includes('24% reduction'), true);
  assert.equal(result.suggestedSummary.startsWith('## Incident Report'), true);
});

test('URL and binary previews remain empty until the backend extracts their content', async () => {
  const urlResult = await analyzeSourceContent(null, 'https://example.test/reports/annual.pdf');
  const fileResult = await analyzeSourceContent(
    new File([new Uint8Array([1, 2, 3])], 'annual.pdf', { type: 'application/pdf' }),
  );

  for (const result of [urlResult, fileResult]) {
    assert.equal(result.rawTextPreview, '');
    assert.equal(result.wordCount, 0);
    assert.equal(result.readingTimeMinutes, 0);
    assert.deepEqual(result.keyEntities, []);
    assert.deepEqual(result.keyHeadings, []);
    assert.deepEqual(result.extractedQuotes, []);
    assert.equal(result.suggestedSummary, '');
    assert.equal(result.detectedDomain, 'Unclassified');
  }
  assert.equal(urlResult.suggestedTitle, 'annual');
});
