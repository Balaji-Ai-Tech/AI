import assert from 'node:assert/strict';
import test from 'node:test';
import { translate } from './i18n.ts';

test('translations resolve Telugu, Hindi, and Tamil interface strings', () => {
  assert.equal(translate('Telugu', 'Dashboard'), 'డాష్‌బోర్డ్');
  assert.equal(translate('Hindi', 'Dashboard'), 'डैशबोर्ड');
  assert.equal(translate('Tamil', 'Dashboard'), 'முகப்புப் பலகை');
  for (const language of ['Telugu', 'Hindi', 'Tamil'] as const) {
    assert.notEqual(translate(language, 'Partial results'), 'Partial results');
    assert.notEqual(
      translate(language, 'Successful drafts are saved for review. Return to Configure and select only failed formats to retry.'),
      'Successful drafts are saved for review. Return to Configure and select only failed formats to retry.'
    );
    assert.notEqual(translate(language, 'Uploading & Extracting Source'), 'Uploading & Extracting Source');
    assert.notEqual(
      translate(language, 'deliverables approved and ready for export. Select individual delivery formats (PDF, PPT, DOCX, Markdown, JSON, Text) or download the asset bundle.'),
      'deliverables approved and ready for export. Select individual delivery formats (PDF, PPT, DOCX, Markdown, JSON, Text) or download the asset bundle.'
    );
  }
});

test('English and missing translations fall back to the source string', () => {
  assert.equal(translate('English', 'Dashboard'), 'Dashboard');
  assert.equal(translate('Hindi', 'Untranslated screen'), 'Untranslated screen');
  assert.equal(translate('Unknown', 'Dashboard'), 'Dashboard');
});
