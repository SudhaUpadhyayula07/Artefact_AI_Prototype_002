export type SourceInputType =
  | 'text'
  | 'prompt'
  | 'document'
  | 'image'
  | 'audio'
  | 'video'
  | 'url';

export interface SourceItem {
  id: string;
  type: SourceInputType;
  title: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  url?: string;
  rawText: string;
  extractionStatus: 'idle' | 'extracting' | 'ready' | 'error';
  extractionError?: string;
  extractionMethod?: string;
}

export type OutputType =
  | 'linkedin'
  | 'twitter'
  | 'advisory'
  | 'infographic'
  | 'executive_summary'
  | 'presentation'
  | 'video_package';

export interface RunControls {
  selectedOutputs: OutputType[];
  targetAudience: string;
  customAudience?: string;
  tone: string;
  customTone?: string;
  language: string;
  customLanguage?: string;
  detailLevel: 1 | 2 | 3 | 4 | 5;
  objective: string;
  customObjective?: string;
  contentStyle: string;
  customStyle?: string;
  requireHumanApproval: boolean;
  additionalContext: {
    organisation: string;
    campaign: string;
    mustInclude: string;
    mustAvoid: string;
  };
}

export interface ControlPreset {
  id: string;
  name: string;
  createdAt: string;
  controls: RunControls;
}

export interface ModerationCategoryResult {
  category:
    | 'hate'
    | 'harassment'
    | 'dangerous_content'
    | 'sexual_content'
    | 'misinformation_risk'
    | 'personal_data';
  severity: 'none' | 'low' | 'medium' | 'high';
  flagged: boolean;
  note: string;
}

export interface ModerationResult {
  available: boolean;
  overallSeverity: 'none' | 'low' | 'medium' | 'high';
  blocked: boolean;
  flagged: boolean;
  reason: string;
  categories: ModerationCategoryResult[];
  error?: string;
}

export interface KeyFact {
  id: string;
  statement: string;
  sourceQuote: string;
}

export interface KeyNumber {
  label: string;
  value: string;
  context: string;
}

export interface FactBase {
  topic: string;
  detectedIntent: string;
  domain: string;
  keyFacts: KeyFact[];
  keyNumbers: KeyNumber[];
  entities: string[];
  risksOrCaveats: string[];
  suggestedAngle: string;
}

export interface LinkedInOutput {
  hook: string;
  body: string;
  callToAction: string;
  hashtags: string[];
}

export interface TwitterOutput {
  tweets: string[];
}

export interface AdvisoryAction {
  action: string;
  priority: 'Immediate' | 'High' | 'Medium' | 'Low';
  timeline: string;
}

export interface AdvisoryOutput {
  title: string;
  referenceId: string;
  date: string;
  audience: string;
  summary: string;
  background: string;
  keyFindings: string[];
  impact: string;
  recommendedActions: AdvisoryAction[];
  references: string[];
}

export interface InfographicStat {
  value: string;
  label: string;
  context: string;
}

export interface InfographicSection {
  title: string;
  summary: string;
  iconName: string;
}

export interface InfographicOutput {
  headline: string;
  subtitle: string;
  keyMessages: string[];
  statistics: InfographicStat[];
  sections: InfographicSection[];
  colorPalette: string[];
  layoutRecommendation: string;
  callToAction: string;
  readableTextVersion: string;
}

export interface ExecutiveSummaryOutput {
  title: string;
  date: string;
  audience: string;
  bottomLine: string;
  keyPoints: string[];
  implications: string[];
  decisionNeededOrNextSteps: string[];
}

export interface PresentationSlide {
  slideNumber: number;
  title: string;
  bullets: string[];
  visualSuggestion: string;
  speakerNotes: string;
}

export interface PresentationOutput {
  title: string;
  subtitle: string;
  slides: PresentationSlide[];
}

export interface VideoScene {
  sceneNumber: number;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  sceneDescription: string;
  narrationText: string;
  onScreenText: string;
  visualRecommendation: string;
  audioNotes: string;
}

export interface VideoPackageOutput {
  title: string;
  targetDuration: string;
  platform: string;
  scriptSummary: string;
  scenes: VideoScene[];
  musicAndSoundNotes: string;
  srtSubtitles: string;
}

export type OutputContentMap = {
  linkedin: LinkedInOutput;
  twitter: TwitterOutput;
  advisory: AdvisoryOutput;
  infographic: InfographicOutput;
  executive_summary: ExecutiveSummaryOutput;
  presentation: PresentationOutput;
  video_package: VideoPackageOutput;
};

export interface ValidationClaim {
  claim: string;
  status: 'supported' | 'unsupported' | 'contradicted';
  sourceQuote: string;
  note: string;
}

export interface ValidationResult {
  available: boolean;
  score: number | null;
  firstAttemptScore?: number | null;
  retried: boolean;
  claims: ValidationClaim[];
  issues: string[];
  error?: string;
}

export interface OutputVersion<T = unknown> {
  versionNumber: number;
  createdAt: string;
  instruction: string;
  content: T;
  plainText: string;
  sha256: string;
  watermarkId: string;
  validation: ValidationResult;
}

export interface GeneratedArtefact<K extends OutputType = OutputType> {
  type: K;
  status: 'waiting' | 'running' | 'validating' | 'retrying' | 'done' | 'failed';
  content?: OutputContentMap[K];
  plainText?: string;
  sha256?: string;
  watermarkId?: string;
  validation?: ValidationResult;
  outputModeration?: ModerationResult;
  approvalStatus: 'approved' | 'needs_approval' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  error?: string;
  versions: OutputVersion<OutputContentMap[K]>[];
}

export interface ConsistencyIssue {
  item: string;
  outputsInvolved: OutputType[];
  description: string;
}

export interface ConsistencyReport {
  checkedAt: string;
  consistent: boolean;
  issues: ConsistencyIssue[];
}

export type PipelineStepStatus = 'waiting' | 'running' | 'retrying' | 'done' | 'failed';

export interface PipelineStepState {
  id: string;
  label: string;
  description: string;
  status: PipelineStepStatus;
  startedAt?: number;
  completedAt?: number;
  message?: string;
}

export interface RunRecord {
  runId: string;
  title: string;
  createdAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'completed_with_errors' | 'failed' | 'interrupted';
  sources: SourceItem[];
  controls: RunControls;
  sourceHash: string;
  batchHash?: string;
  inputModeration?: ModerationResult;
  factBase?: FactBase;
  artefacts: Partial<Record<OutputType, GeneratedArtefact>>;
  consistency?: ConsistencyReport;
  ledgerBlockIndex?: number;
  error?: string;
}

export interface LedgerOutputEntry {
  type: OutputType;
  watermarkId: string;
  hash: string;
  plainTextSnippet: string;
  normalisedTokens: string[];
}

export interface LedgerBlock {
  index: number;
  runId: string;
  runTitle: string;
  timestamp: string;
  sourceHash: string;
  outputHashes: LedgerOutputEntry[];
  batchHash: string;
  previousHash: string;
  blockHash: string;
}

export interface LedgerVerifyReport {
  valid: boolean;
  totalBlocks: number;
  checkedAt: string;
  firstBrokenBlockIndex: number | null;
  reason: string;
}

export interface VerifyMatchResult {
  status: 'VERIFIED' | 'MODIFIED' | 'NOT_FOUND';
  computedHash: string;
  extractedWatermarkId: string | null;
  similarityScore: number;
  matchedRun?: {
    runId: string;
    runTitle: string;
    timestamp: string;
    outputType: OutputType;
    watermarkId: string;
    originalHash: string;
    blockIndex: number;
  };
  message: string;
}

export interface HealthStatus {
  ok: boolean;
  apiKeyConfigured: boolean;
  model: string;
  modelWorking?: boolean;
  modelStatus?: 'ok' | 'not_found' | 'quota_or_busy' | 'error' | 'unconfigured';
  modelMessage?: string;
  modelRawError?: string;
  publicSiteUrl: string;
  contactEmail: string;
  ledger: {
    exists: boolean;
    blockCount: number;
    valid: boolean;
  };
}
