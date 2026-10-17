import assert from 'node:assert/strict';
import test from 'node:test';
import type { GeneratedOutput } from './api.ts';
import { OUTPUT_TYPE_MAP, toOutputItem } from './transformationOutputs.ts';

const generatedOutput = (overrides: Partial<GeneratedOutput> = {}): GeneratedOutput => ({
  id: 'output-1',
  transformation_id: 'tx-1',
  output_type: 'executive_summary',
  title: 'Executive Summary',
  content: 'A generated draft based on the supplied source.',
  content_json: {},
  status: 'needs_review',
  created_at: '',
  updated_at: '',
  ...overrides,
});

test('shared batch and wizard output mappings use supported backend format keys', () => {
  assert.equal(OUTPUT_TYPE_MAP['X / Twitter Thread'], 'x_thread');
  assert.equal(OUTPUT_TYPE_MAP['Video Script & Storyboard'], 'video_package');
});

test('the content studio exposes the requested business and social formats', () => {
  assert.equal(OUTPUT_TYPE_MAP['LinkedIn Post'], 'linkedin');
  assert.equal(OUTPUT_TYPE_MAP['Instagram Caption'], 'instagram_caption');
  assert.equal(OUTPUT_TYPE_MAP['Professional Email'], 'professional_email');
  assert.equal(OUTPUT_TYPE_MAP['Blog Post'], 'blog_post');
  assert.equal(OUTPUT_TYPE_MAP['Detailed Report'], 'report');
});

test('generated drafts do not get synthetic recommendations or approval status', () => {
  const result = toOutputItem(generatedOutput());

  assert.equal(result.rawText, 'A generated draft based on the supplied source.');
  assert.deepEqual(result.recommendations, []);
  assert.equal(result.status, 'ready');
  assert.equal(result.approved, false);
});

test('source evidence excerpts are retained without pretending chunk indexes are page numbers', () => {
  const result = toOutputItem(generatedOutput({
    content_json: {
      evidence: [{ chunk_id: 'chunk-6', chunk_index: 5, excerpt: 'An excerpt from the uploaded source.' }],
    },
  }));

  assert.deepEqual(result.evidence, [{
    id: 'chunk-6',
    page: 0,
    section: 'Source segment 6',
    quote: 'An excerpt from the uploaded source.',
    confidenceScore: 0,
  }]);
});
