import type { GeneratedOutput } from './api';
import type { EvidenceCitation, GeneratedOutputItem } from '../types';
import { CONTENT_LANGUAGES } from './contentLanguages.ts';

export const OUTPUT_TYPE_MAP: Record<string, string> = {
  'Executive Summary': 'executive_summary',
  Advisory: 'advisory',
  'Detailed Report': 'report',
  'Presentation Deck (Slides)': 'presentation',
  'LinkedIn Post': 'linkedin',
  'Instagram Caption': 'instagram_caption',
  'Facebook Post': 'facebook_post',
  'Carousel Copy': 'carousel',
  'X / Twitter Thread': 'x_thread',
  'Infographic Blueprint': 'infographic',
  'Image Brief & Generation Prompt': 'image_prompt',
  'Video Script & Storyboard': 'video_package',
  'Press Release': 'press_release',
  'Professional Email': 'professional_email',
  Newsletter: 'newsletter',
  'Blog Post': 'blog_post',
  Proposal: 'proposal',
  'Product Description': 'product_description',
  'Business Brief': 'business_brief',
  'Meeting Summary': 'meeting_summary',
  'Research Summary': 'research_summary',
  'Project Description': 'project_description',
  'Technical Explanation': 'technical_explanation',
  Documentation: 'documentation',
  'FAQ & Talking Points': 'faq',
  'Technical Whitepaper': 'whitepaper',
  'Compliance Checklist': 'compliance_checklist',
};

function outputTypeLabel(outputType: string): string {
  return Object.entries(OUTPUT_TYPE_MAP).find(([, value]) => value === outputType)?.[0]
    || outputType.replaceAll('_', ' ');
}

export function toOutputItem(row: GeneratedOutput): GeneratedOutputItem {
  const contentJson = row.content_json || {};
  const content = String(row.content || contentJson.content || '').trim();
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const bullets = lines
    .map((line) => line.replace(/^#{1,6}\s*|^[-*•]\s*|^\[ \]\s*/, '').trim())
    .filter((line) => line.length > 12);
  const claims = Array.isArray(contentJson.claims) ? contentJson.claims : [];
  const sourceEvidence = Array.isArray(contentJson.evidence) ? contentJson.evidence : [];
  const evidence = sourceEvidence.flatMap((item: unknown, index): EvidenceCitation[] => {
    if (!item || typeof item !== 'object') return [];
    const value = item as Record<string, unknown>;
    const quote = String(value.excerpt || value.content || '').slice(0, 500);
    if (!quote) return [];
    const chunkIndex = Number(value.chunk_index ?? index);
    return [{
      id: String(value.chunk_id || `source-${index + 1}`),
      page: 0,
      section: `Source segment ${Number.isFinite(chunkIndex) ? chunkIndex + 1 : index + 1}`,
      quote,
      confidenceScore: 0,
    }];
  });
  const recommendations = bullets
    .filter((line) => /recommend|action|review|verify|should|must|next step|confirm|validate/i.test(line))
    .slice(0, 6);
  const keyFacts = bullets
    .filter((line) => !/review notes|human review|required before|target audience|tone:|language:/i.test(line))
    .slice(0, 8);
  const languageCode = typeof contentJson.language_code === 'string' ? contentJson.language_code : null;
  const languageName = typeof contentJson.language === 'string' ? contentJson.language : null;
  const language = CONTENT_LANGUAGES.find((item) => item.code === languageCode);
  const languageLabel = language ? `${language.name} (${language.nativeName})` : languageName;
  const label = outputTypeLabel(row.output_type);

  return {
    id: String(row.id),
    type: languageLabel ? `${label} · ${languageLabel}` : label,
    title: String(row.title || label),
    keyFacts: keyFacts.length ? keyFacts : claims.flatMap((claim: unknown) => {
      if (!claim || typeof claim !== 'object') return [];
      const text = (claim as Record<string, unknown>).text;
      return typeof text === 'string' && text ? [text] : [];
    }).slice(0, 8),
    impact: String(contentJson.summary || contentJson.impact || lines.slice(0, 2).join(' ')).slice(0, 1500),
    recommendations,
    rawText: content,
    evidence,
    approved: row.status === 'approved',
    status: row.status === 'approved' ? 'approved' : row.status === 'rejected' ? 'rejected' : 'ready',
  };
}
