export type ViewRoute = 
  | 'splash'
  | 'dashboard'
  | 'transformation/new'
  | 'templates'
  | 'history'
  | 'analytics'
  | 'settings'
  | 'profile';

export type TransformationStep = 
  | 'upload'
  | 'title-summary'
  | 'configure'
  | 'templates'
  | 'generate'
  | 'review'
  | 'approve'
  | 'export';

export interface UserProfile {
  name: string;
  email: string;
  role: string;
  organization: string;
  twoFactorEnabled: boolean;
  avatarUrl?: string;
}

export type AudienceType = 'Executives' | 'Analysts' | 'General Public';
export type ToneType = 'Formal' | 'Technical' | 'Urgent' | 'Simple';
export type ObjectiveType = 'Inform' | 'Educate' | 'Alert' | 'Summarize';
export type DetailLevel = 'Brief' | 'Balanced' | 'Detailed';

export interface TransformationConfig {
  outputTypes: string[];
  audience: AudienceType;
  tone: ToneType;
  languages: string[];
  objective: ObjectiveType;
  detail: DetailLevel;
}

export interface ContentAnalysisResult {
  rawTextPreview: string;
  wordCount: number;
  readingTimeMinutes: number;
  detectedDomain: string;
  keyEntities: string[];
  keyHeadings: string[];
  suggestedTitle: string;
  suggestedSummary: string;
  extractedQuotes: { page: number; section: string; quote: string }[];
}

export interface SourceDocument {
  name: string;
  size: number;
  type: string;
  lastModified?: number;
  uploadedAt: string;
  contentSample?: string;
  sourceKind?: 'file' | 'url' | 'rss';
  sourceUrl?: string;
  analysis?: ContentAnalysisResult;
}

export interface EvidenceCitation {
  id: string;
  page: number;
  section: string;
  quote: string;
  confidenceScore: number;
}

export interface GeneratedOutputItem {
  id: string;
  type: string;
  title: string;
  keyFacts: string[];
  impact: string;
  recommendations: string[];
  rawText?: string;
  evidence: EvidenceCitation[];
  approved: boolean;
  rejectedReason?: string;
  status: 'pending' | 'generating' | 'ready' | 'approved' | 'rejected';
}

export interface TransformationTemplate {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  recommendedOutputs: string[];
  defaultAudience: AudienceType;
  defaultTone: ToneType;
  defaultObjective: ObjectiveType;
  samplePreview: string;
}

export interface CurrentTransformationState {
  source: SourceDocument | null;
  backendTransformationId?: string | null;
  title: string;
  summary: string;
  configuration: TransformationConfig;
  selectedTemplateId: string | null;
  outputs: GeneratedOutputItem[];
  currentStep: TransformationStep;
}

export interface CompletedTransformationRecord {
  id: string;
  backendTransformationId?: string;
  title: string;
  summary: string;
  sourceName: string;
  sourceType: string;
  sourceSize: number;
  outputTypes: string[];
  outputs: GeneratedOutputItem[];
  configuration: TransformationConfig;
  createdAt: string;
  completedAt: string;
  status: 'Completed' | 'In Review' | 'Failed';
  processingDurationSeconds: number;
  templateName?: string;
}

export interface AppSettings {
  general: {
    language: string;
    theme: 'dark' | 'light' | 'system';
    emailNotifications: boolean;
  };
  security: {
    twoFactorEnabled: boolean;
    sessionTimeoutMinutes: number;
  };
  transformationDefaults: {
    defaultAudience: AudienceType;
    defaultTone: ToneType;
    defaultLanguage: string;
    defaultOutput: string;
  };
  data: {
    retentionDays: number;
    allowTelemetry: boolean;
  };
}

export type SyncStateMode = 'synced' | 'syncing' | 'offline' | 'saved';

export interface SyncStatus {
  state: SyncStateMode;
  lastSyncedAt: Date | null;
  message?: string;
  isOnline: boolean;
}
