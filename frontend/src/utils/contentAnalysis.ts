import type { ContentAnalysisResult } from '../types';

const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.markdown', '.csv', '.json', '.log',
]);
const TEXT_MIME_TYPES = new Set(['text/plain', 'text/markdown', 'text/csv', 'application/json']);

function titleForSource(fileName: string): string {
  const title = fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  return title || 'Imported source';
}

function domainForText(text: string): string {
  const content = text.toLowerCase();
  if (/\b(cyber|threat|vulnerability|ransomware|malware|firewall|patch)\b/.test(content)) {
    return 'Cybersecurity & Threat Intelligence';
  }
  if (/\b(budget|revenue|fiscal|ebitda|financial|margin)\b/.test(content)) {
    return 'Financial & Fiscal Strategy';
  }
  if (/\b(compliance|iso|soc2|gdpr|hipaa|audit|regulatory|governance)\b/.test(content)) {
    return 'Regulatory Compliance & Governance';
  }
  if (/\b(cloud|kubernetes|aws|gcp|azure|docker|microservice|latency|architecture)\b/.test(content)) {
    return 'Cloud Infrastructure & Architecture';
  }
  if (/\b(patient|clinical|trial|health|biotech|pharma)\b/.test(content)) {
    return 'Healthcare & Life Sciences';
  }
  if (/\b(product|roadmap|feature|user|sprint|customer)\b/.test(content)) {
    return 'Product Strategy & Engineering';
  }
  return 'Unclassified';
}

export async function analyzeSourceContent(
  file: File | null,
  urlInput?: string,
  rawTextInput?: string
): Promise<ContentAnalysisResult> {
  let fileName = file?.name || 'Pasted Content';
  let extractedText = rawTextInput || '';

  if (file) {
    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (TEXT_EXTENSIONS.has(extension) || TEXT_MIME_TYPES.has(file.type)) {
      extractedText = await file.text();
    } else {
      extractedText = '';
    }
  } else if (urlInput) {
    try {
      const url = new URL(urlInput.startsWith('http') ? urlInput : `https://${urlInput}`);
      fileName = url.pathname.split('/').filter(Boolean).pop() || url.hostname;
    } catch {
      fileName = urlInput;
    }
    extractedText = '';
  }

  extractedText = extractedText.trim();
  const words = extractedText ? extractedText.split(/\s+/).filter(Boolean) : [];
  const keyEntities = Array.from(new Set(
    extractedText.match(/(?:\bCVE-\d{4}-\d{4,}\b|\bISO\s+\d+\b|\b[A-Z]{2,6}\b|\b\d+(?:\.\d+)?%)/g) || []
  )).slice(0, 8);
  const keyHeadings = Array.from(
    extractedText.matchAll(/^(?:#{1,6}\s+|\d+(?:\.\d+)*[.)]?\s+)(.+)$/gm),
    (match) => match[1].trim()
  ).filter((heading) => heading.length > 0 && heading.length < 80).slice(0, 6);
  const sentences = extractedText.match(/[^.!?]+(?:[.!?]+|$)/g)?.map((sentence) => sentence.trim()).filter(Boolean) || [];
  const extractedQuotes = sentences
    .filter((sentence) => sentence.length >= 40 && sentence.length < 500)
    .slice(0, 3)
    .map((quote) => ({ page: 0, section: 'Text preview', quote }));
  const suggestedTitle = titleForSource(fileName);

  return {
    rawTextPreview: extractedText.slice(0, 1200),
    wordCount: words.length,
    readingTimeMinutes: words.length ? Math.max(1, Math.ceil(words.length / 220)) : 0,
    detectedDomain: domainForText(extractedText),
    keyEntities,
    keyHeadings,
    suggestedTitle,
    suggestedSummary: sentences.slice(0, 3).join(' '),
    extractedQuotes,
  };
}
