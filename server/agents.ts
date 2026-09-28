import { Schema, Type } from '@google/genai';
import type {
  AdvisoryOutput,
  ConsistencyReport,
  ExecutiveSummaryOutput,
  FactBase,
  InfographicOutput,
  LinkedInOutput,
  ModerationResult,
  OutputContentMap,
  OutputType,
  PresentationOutput,
  RunControls,
  TwitterOutput,
  ValidationResult,
  VideoPackageOutput,
  VideoScene,
} from '../src/types/artefact.ts';
import { MODEL } from './config.ts';
import { generateStructuredJson, stripEmDashesDeep } from './gemini.ts';
import { artefactToPlainText } from './provenance.ts';

function formatControlsPrompt(controls: RunControls): string {
  const audience =
    controls.targetAudience === 'custom' && controls.customAudience
      ? controls.customAudience
      : controls.targetAudience;
  const tone =
    controls.tone === 'custom' && controls.customTone ? controls.customTone : controls.tone;
  const language =
    controls.language === 'custom' && controls.customLanguage
      ? controls.customLanguage
      : controls.language;
  const objective =
    controls.objective === 'custom' && controls.customObjective
      ? controls.customObjective
      : controls.objective;
  const style =
    controls.contentStyle === 'custom' && controls.customStyle
      ? controls.customStyle
      : controls.contentStyle;

  const detailLabels: Record<number, string> = {
    1: '1 - Essential snapshot (concise, shortest length)',
    2: '2 - Brief overview (compact length)',
    3: '3 - Standard operational briefing (balanced depth)',
    4: '4 - Detailed analysis (comprehensive depth)',
    5: '5 - Exhaustive specification (maximum depth and length)',
  };

  const ctx = controls.additionalContext;
  const contextLines: string[] = [];
  if (ctx.organisation?.trim()) contextLines.push(`Organisation: ${ctx.organisation.trim()}`);
  if (ctx.campaign?.trim()) contextLines.push(`Campaign / Initiative: ${ctx.campaign.trim()}`);
  if (ctx.mustInclude?.trim()) contextLines.push(`Must Include: ${ctx.mustInclude.trim()}`);
  if (ctx.mustAvoid?.trim()) contextLines.push(`Must Avoid: ${ctx.mustAvoid.trim()}`);

  return [
    `Target Audience: ${audience}`,
    `Tone: ${tone}`,
    `Output Language: ${language} (Write all content values in ${language}; keep JSON property keys in English)`,
    `Level of Detail: ${detailLabels[controls.detailLevel] || controls.detailLevel}`,
    `Communication Objective: ${objective}`,
    `Content Style: ${style}`,
    ...(contextLines.length > 0 ? ['Additional Operator Context:', ...contextLines] : []),
  ].join('\n');
}

// 1. MODERATION AGENT
const moderationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    overallSeverity: {
      type: Type.STRING,
      description: 'Overall severity: none, low, medium, or high',
    },
    blocked: {
      type: Type.BOOLEAN,
      description: 'True only if overallSeverity is high and content poses severe harm',
    },
    flagged: {
      type: Type.BOOLEAN,
      description: 'True if any category has severity low, medium, or high',
    },
    reason: {
      type: Type.STRING,
      description: 'Plain-language summary of findings',
    },
    categories: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: {
            type: Type.STRING,
            description:
              'One of: hate, harassment, dangerous_content, sexual_content, misinformation_risk, personal_data',
          },
          severity: {
            type: Type.STRING,
            description: 'One of: none, low, medium, high',
          },
          flagged: {
            type: Type.BOOLEAN,
          },
          note: {
            type: Type.STRING,
          },
        },
        required: ['category', 'severity', 'flagged', 'note'],
      },
    },
  },
  required: ['overallSeverity', 'blocked', 'flagged', 'reason', 'categories'],
};

export async function runModerationAgent(
  text: string,
  targetLabel: 'source' | 'output' = 'source'
): Promise<ModerationResult> {
  try {
    const raw = await generateStructuredJson<Omit<ModerationResult, 'available'>>({
      systemInstruction:
        'You are the Moderation and Safety Agent for Artefact.AI. Evaluate the provided text for six categories: hate, harassment, dangerous_content, sexual_content, misinformation_risk, and personal_data (PII). Legitimate cybersecurity advisories, threat intelligence reports, policy documents, medical research, and incident reports discussing vulnerabilities or threats defensively are NOT dangerous_content unless they provide actionable instructions for illegal harm. Return accurate severity levels (none, low, medium, high). Block only when overallSeverity is high.',
      prompt: `Evaluate this ${targetLabel} text for safety and policy risks:\n\n${text.slice(0, 35000)}`,
      schema: moderationSchema,
      temperature: 0.1,
    });

    const validSeverities = ['none', 'low', 'medium', 'high'] as const;
    const normSev = validSeverities.includes(raw.overallSeverity as any)
      ? (raw.overallSeverity as 'none' | 'low' | 'medium' | 'high')
      : 'none';

    return {
      available: true,
      overallSeverity: normSev,
      blocked: normSev === 'high' || Boolean(raw.blocked),
      flagged: normSev !== 'none' || Boolean(raw.flagged),
      reason: raw.reason || 'Safety evaluation completed.',
      categories: Array.isArray(raw.categories) ? raw.categories : [],
    };
  } catch (err) {
    return {
      available: false,
      overallSeverity: 'none',
      blocked: false,
      flagged: false,
      reason: 'Moderation check could not be completed.',
      categories: [],
      error: (err as Error).message,
    };
  }
}

// 2. ORCHESTRATOR AGENT
const factBaseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    topic: {
      type: Type.STRING,
      description: 'Clear, specific title or topic of the source bundle',
    },
    detectedIntent: {
      type: Type.STRING,
      description: 'Primary purpose or intent of the source material',
    },
    domain: {
      type: Type.STRING,
      description: 'Domain such as Cybersecurity, Public Policy, Corporate Communications, Healthcare, Finance, Research, Education, or Operations',
    },
    keyFacts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: 'Fact ID such as F1, F2, F3' },
          statement: { type: Type.STRING, description: 'Factual claim stated clearly' },
          sourceQuote: {
            type: Type.STRING,
            description: 'Exact verbatim quote or segment from the source supporting this fact',
          },
        },
        required: ['id', 'statement', 'sourceQuote'],
      },
    },
    keyNumbers: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING, description: 'What the number measures' },
          value: { type: Type.STRING, description: 'Exact number, percentage, date, or metric from the source' },
          context: { type: Type.STRING, description: 'Context from the source' },
        },
        required: ['label', 'value', 'context'],
      },
    },
    entities: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Named organisations, people, systems, locations, or identifiers mentioned in the source',
    },
    risksOrCaveats: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Explicit limitations, risks, or caveats noted in the source',
    },
    suggestedAngle: {
      type: Type.STRING,
      description: 'Recommended communication angle aligned with the operator controls',
    },
  },
  required: [
    'topic',
    'detectedIntent',
    'domain',
    'keyFacts',
    'keyNumbers',
    'entities',
    'risksOrCaveats',
    'suggestedAngle',
  ],
};

export async function runOrchestratorAgent(
  combinedSource: string,
  controls: RunControls
): Promise<FactBase> {
  return generateStructuredJson<FactBase>({
    systemInstruction: `You are the Orchestrator Agent for Artefact.AI. Your single job is to read the operator's source material and build a rigorous, verifiable shared FactBase that all downstream specialist agents will use.
GLOBAL RULE: Use ONLY facts, numbers, dates, names, quotes, and identifiers explicitly present in the provided source. Never invent statistics, never extrapolate numbers, and never fabricate references or CVE IDs. If no numbers exist in the source, return an empty keyNumbers array.`,
    prompt: `SOURCE MATERIAL:\n${combinedSource}\n\nOPERATOR CONTROLS:\n${formatControlsPrompt(
      controls
    )}\n\nBuild the shared FactBase JSON strictly from the source material above.`,
    schema: factBaseSchema,
    temperature: 0.1,
    validate: (fb) => Boolean(fb && typeof fb.topic === 'string' && Array.isArray(fb.keyFacts)),
  });
}

// 3. SPECIALIST AGENTS (ALL 7)

const linkedInSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    hook: { type: Type.STRING, description: 'Compelling opening line grounded in the source' },
    body: {
      type: Type.STRING,
      description: 'Main post body with clear paragraph breaks (use \\n\\n between paragraphs)',
    },
    callToAction: { type: Type.STRING, description: 'Closing call to action or question' },
    hashtags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Between 3 and 6 relevant hashtags',
    },
  },
  required: ['hook', 'body', 'callToAction', 'hashtags'],
};

const twitterSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    tweets: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'List of tweets in the thread. Every single tweet MUST be 260 characters or fewer.',
    },
  },
  required: ['tweets'],
};

const advisorySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    referenceId: {
      type: Type.STRING,
      description: 'Reference ID from source, or ARTF-ADV-YYYYMMDD if none in source. Never invent a fake CVE ID.',
    },
    date: { type: Type.STRING },
    audience: { type: Type.STRING },
    summary: { type: Type.STRING },
    background: { type: Type.STRING },
    keyFindings: { type: Type.ARRAY, items: { type: Type.STRING } },
    impact: { type: Type.STRING },
    recommendedActions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          action: { type: Type.STRING },
          priority: { type: Type.STRING, description: 'Immediate, High, Medium, or Low' },
          timeline: { type: Type.STRING },
        },
        required: ['action', 'priority', 'timeline'],
      },
    },
    references: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Only references or citations explicitly mentioned in the source. Empty array if none.',
    },
  },
  required: [
    'title',
    'referenceId',
    'date',
    'audience',
    'summary',
    'background',
    'keyFindings',
    'impact',
    'recommendedActions',
    'references',
  ],
};

const infographicSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING },
    subtitle: { type: Type.STRING },
    keyMessages: { type: Type.ARRAY, items: { type: Type.STRING } },
    statistics: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          value: {
            type: Type.STRING,
            description: 'Exact number or short factual figure from the source only',
          },
          label: { type: Type.STRING },
          context: { type: Type.STRING },
        },
        required: ['value', 'label', 'context'],
      },
      description: '3 to 6 highlighted statistics or factual figures strictly from the source',
    },
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          summary: { type: Type.STRING },
          iconName: {
            type: Type.STRING,
            description: 'Icon identifier such as shield, alert, chart, check, file, globe, users, clock, lock, cpu',
          },
        },
        required: ['title', 'summary', 'iconName'],
      },
    },
    colorPalette: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    layoutRecommendation: { type: Type.STRING },
    callToAction: { type: Type.STRING },
    readableTextVersion: { type: Type.STRING },
  },
  required: [
    'headline',
    'subtitle',
    'keyMessages',
    'statistics',
    'sections',
    'colorPalette',
    'layoutRecommendation',
    'callToAction',
    'readableTextVersion',
  ],
};

const executiveSummarySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    date: { type: Type.STRING },
    audience: { type: Type.STRING },
    bottomLine: {
      type: Type.STRING,
      description: 'The single most important takeaway upfront (BLUF)',
    },
    keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
    implications: { type: Type.ARRAY, items: { type: Type.STRING } },
    decisionNeededOrNextSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    'title',
    'date',
    'audience',
    'bottomLine',
    'keyPoints',
    'implications',
    'decisionNeededOrNextSteps',
  ],
};

const presentationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    subtitle: { type: Type.STRING },
    slides: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          slideNumber: { type: Type.INTEGER },
          title: { type: Type.STRING },
          bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
          visualSuggestion: { type: Type.STRING },
          speakerNotes: { type: Type.STRING },
        },
        required: ['slideNumber', 'title', 'bullets', 'visualSuggestion', 'speakerNotes'],
      },
    },
  },
  required: ['title', 'subtitle', 'slides'],
};

const videoPackageSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    targetDuration: { type: Type.STRING },
    platform: { type: Type.STRING },
    scriptSummary: { type: Type.STRING },
    scenes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sceneNumber: { type: Type.INTEGER },
          startTime: { type: Type.STRING, description: 'Format MM:SS, e.g. 00:00' },
          endTime: { type: Type.STRING, description: 'Format MM:SS, e.g. 00:08' },
          durationSeconds: { type: Type.INTEGER },
          sceneDescription: { type: Type.STRING },
          narrationText: { type: Type.STRING },
          onScreenText: { type: Type.STRING },
          visualRecommendation: { type: Type.STRING },
          audioNotes: { type: Type.STRING },
        },
        required: [
          'sceneNumber',
          'startTime',
          'endTime',
          'durationSeconds',
          'sceneDescription',
          'narrationText',
          'onScreenText',
          'visualRecommendation',
          'audioNotes',
        ],
      },
    },
    musicAndSoundNotes: { type: Type.STRING },
    srtSubtitles: {
      type: Type.STRING,
      description: 'Valid SubRip (.srt) timed subtitles matching the scenes',
    },
  },
  required: [
    'title',
    'targetDuration',
    'platform',
    'scriptSummary',
    'scenes',
    'musicAndSoundNotes',
    'srtSubtitles',
  ],
};

export function getSchemaForOutputType(type: OutputType): Schema {
  switch (type) {
    case 'linkedin':
      return linkedInSchema;
    case 'twitter':
      return twitterSchema;
    case 'advisory':
      return advisorySchema;
    case 'infographic':
      return infographicSchema;
    case 'executive_summary':
      return executiveSummarySchema;
    case 'presentation':
      return presentationSchema;
    case 'video_package':
      return videoPackageSchema;
  }
}

export function hardTrimTweet(tweet: string, maxLen = 280): string {
  const cleaned = stripEmDashesDeep(tweet.trim());
  if (cleaned.length <= maxLen) return cleaned;

  const slice = cleaned.slice(0, maxLen);
  // Try sentence boundary first
  const sentenceMatch = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? ')
  );
  if (sentenceMatch >= 140) {
    return slice.slice(0, sentenceMatch + 1).trim();
  }

  // Otherwise word boundary with ellipsis
  const sub = cleaned.slice(0, maxLen - 3);
  const lastSpace = sub.lastIndexOf(' ');
  if (lastSpace > 80) {
    return `${sub.slice(0, lastSpace).trim()}...`;
  }
  return `${sub}...`;
}

function formatSrtTime(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
    seconds
  ).padStart(2, '0')},000`;
}

export function isValidSrt(srt: string): boolean {
  if (!srt || typeof srt !== 'string') return false;
  const trimmed = srt.trim();
  if (!trimmed) return false;
  const blocks = trimmed.split(/\r?\n\r?\n/);
  if (blocks.length === 0) return false;
  const timecodeRegex = /^\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}$/;
  for (const block of blocks) {
    const lines = block.trim().split(/\r?\n/);
    if (lines.length < 3) return false;
    if (!/^\d+$/.test(lines[0].trim())) return false;
    if (!timecodeRegex.test(lines[1].trim())) return false;
  }
  return true;
}

export function rebuildSrtFromScenes(scenes: VideoScene[]): string {
  let currentSec = 0;
  const srtBlocks: string[] = [];

  scenes.forEach((scene, idx) => {
    const dur = Math.max(3, Number(scene.durationSeconds) || 6);
    const startStr = formatSrtTime(currentSec);
    const endStr = formatSrtTime(currentSec + dur);
    currentSec += dur;
    const text = (scene.narrationText || scene.onScreenText || scene.sceneDescription || '').trim();
    srtBlocks.push(`${idx + 1}\n${startStr} --> ${endStr}\n${text}`);
  });

  return srtBlocks.join('\n\n');
}

export async function enforceOutputConstraints<K extends OutputType>(
  type: K,
  rawOutput: OutputContentMap[K],
  controls: RunControls,
  factBase: FactBase
): Promise<OutputContentMap[K]> {
  const output = stripEmDashesDeep(rawOutput);

  if (type === 'linkedin') {
    const li = output as LinkedInOutput;
    li.hashtags = (li.hashtags || [])
      .map((h) => h.trim().replace(/^#?/, '#'))
      .filter((h) => h.length > 1)
      .slice(0, 6);
    while (li.hashtags.length < 3) {
      const fallbackTag = `#${(factBase.domain || 'Briefing').replace(/[^a-zA-Z0-9]/g, '')}`;
      if (!li.hashtags.includes(fallbackTag)) li.hashtags.push(fallbackTag);
      else li.hashtags.push(`#Update${li.hashtags.length + 1}`);
    }
    const fullText = artefactToPlainText('linkedin', li);
    if (fullText.length > 2980) {
      const excess = fullText.length - 2950;
      li.body = li.body.slice(0, Math.max(200, li.body.length - excess)).trim() + '...';
    }
    return li as OutputContentMap[K];
  }

  if (type === 'twitter') {
    const tw = output as TwitterOutput;
    const targetCounts: Record<number, number> = { 1: 2, 2: 4, 3: 6, 4: 8, 5: 10 };
    const maxTweets = targetCounts[controls.detailLevel] || 6;
    tw.tweets = (tw.tweets || []).map((t) => t.replace(/^\d+\/\d+\s*/, '').trim()).filter(Boolean).slice(0, 10);
    if (tw.tweets.length > maxTweets + 1) {
      tw.tweets = tw.tweets.slice(0, maxTweets);
    }

    // Check if any tweet exceeds 280 chars; if so, re-ask the model once
    if (tw.tweets.some((t) => t.length > 280)) {
      try {
        const shortened = await generateStructuredJson<TwitterOutput>({
          systemInstruction:
            'Shorten any tweet that is over 260 characters so that every tweet in the array is strictly under 260 characters while preserving exact facts and numbers. Never use em dashes.',
          prompt: `Shorten the over-length tweets in this thread:\n${JSON.stringify(tw.tweets, null, 2)}`,
          schema: twitterSchema,
          temperature: 0.1,
        });
        if (Array.isArray(shortened.tweets) && shortened.tweets.length > 0) {
          tw.tweets = shortened.tweets;
        }
      } catch {
        // Proceed to hard-trim fallback below
      }
    }

    // Hard-trim at sentence/word boundary as last resort so no tweet > 280 ever appears
    tw.tweets = tw.tweets.map((t) => hardTrimTweet(t, 280));
    return tw as OutputContentMap[K];
  }

  if (type === 'infographic') {
    const info = output as InfographicOutput;
    info.statistics = (info.statistics || []).slice(0, 6);
    info.colorPalette = ['#5E60CE', '#7B6DFF', '#B794F4', '#E0AAFF', '#1C192E'];
    return info as OutputContentMap[K];
  }

  if (type === 'presentation') {
    const pres = output as PresentationOutput;
    pres.slides = (pres.slides || []).map((s, idx) => ({
      ...s,
      slideNumber: idx + 1,
    }));
    return pres as OutputContentMap[K];
  }

  if (type === 'video_package') {
    const vid = output as VideoPackageOutput;
    let runningSec = 0;
    vid.scenes = (vid.scenes || []).map((s, idx) => {
      const dur = Math.max(3, Number(s.durationSeconds) || 6);
      const startMin = Math.floor(runningSec / 60);
      const startRem = runningSec % 60;
      const endSec = runningSec + dur;
      const endMin = Math.floor(endSec / 60);
      const endRem = endSec % 60;
      runningSec = endSec;
      return {
        ...s,
        sceneNumber: idx + 1,
        durationSeconds: dur,
        startTime: `${String(startMin).padStart(2, '0')}:${String(startRem).padStart(2, '0')}`,
        endTime: `${String(endMin).padStart(2, '0')}:${String(endRem).padStart(2, '0')}`,
      };
    });
    if (!isValidSrt(vid.srtSubtitles)) {
      vid.srtSubtitles = rebuildSrtFromScenes(vid.scenes);
    }
    return vid as OutputContentMap[K];
  }

  return output;
}

export async function runSpecialistAgent<K extends OutputType>(params: {
  type: K;
  combinedSource: string;
  factBase: FactBase;
  controls: RunControls;
  validatorFeedback?: string[];
}): Promise<OutputContentMap[K]> {
  const { type, combinedSource, factBase, controls, validatorFeedback } = params;
  const detail = controls.detailLevel;

  const specialistInstructions: Record<OutputType, string> = {
    linkedin: `You are the LinkedIn Specialist Agent for Artefact.AI.
Write a professional LinkedIn post strictly grounded in the FactBase and source.
- Include a strong hook, structured body paragraphs, a clear call to action, and 3 to 6 relevant hashtags.
- Total length must be under 3000 characters. Detail level is ${detail}/5 (${
      detail <= 2 ? 'concise 120-220 words' : detail === 3 ? 'balanced 220-350 words' : 'in-depth 350-500 words'
    }).`,

    twitter: `You are the Twitter/X Thread Specialist Agent for Artefact.AI.
Write a thread of ${
      detail === 1 ? '1 to 2' : detail === 2 ? '3 to 4' : detail === 3 ? '5 to 6' : detail === 4 ? '7 to 8' : '9 to 10'
    } tweets strictly grounded in the FactBase and source.
- Every single tweet MUST be 260 characters or fewer.
- Do not prefix tweets with "1/5" numbering (the UI renders tweet cards with counters automatically).`,

    advisory: `You are the Formal Advisory Specialist Agent for Artefact.AI.
Produce a structured operational, security, policy, or domain advisory strictly grounded in the FactBase and source.
- Adapt terminology to the detected domain (${factBase.domain}).
- Never invent CVE identifiers, URLs, or external references that do not appear in the source. If no reference ID is in the source, use "ARTF-ADV-SOURCE".
- Provide concrete recommended actions with priority (Immediate, High, Medium, Low) and timeline based on the source. Detail level is ${detail}/5.`,

    infographic: `You are the Infographic Architect Agent for Artefact.AI.
Design a structured infographic specification strictly grounded in the FactBase and source.
- Provide a headline, subtitle, keyMessages, 3 to 6 statistics (using ONLY exact numbers or factual figures from the source; never invent statistics), ${
      detail <= 2 ? '3' : detail <= 4 ? '4' : '5'
    } visual sections with iconName, layoutRecommendation, callToAction, and a full readableTextVersion.`,

    executive_summary: `You are the Executive Summary Specialist Agent for Artefact.AI.
Write a one-page executive briefing strictly grounded in the FactBase and source.
- Lead with the Bottom Line Up Front (bottomLine).
- Follow with keyPoints, implications, and decisionNeededOrNextSteps.
- Scale depth to detail level ${detail}/5 (${
      detail <= 2 ? '3-4 concise points per section' : detail === 3 ? '4-5 points per section' : '6-8 comprehensive points per section'
    }).`,

    presentation: `You are the Presentation Deck Specialist Agent for Artefact.AI.
Build a slide deck with exactly ${
      detail === 1 ? 4 : detail === 2 ? 6 : detail === 3 ? 8 : detail === 4 ? 10 : 12
    } slides strictly grounded in the FactBase and source.
- Each slide must include slideNumber, title, 3 to 5 concise bullets, a concrete visualSuggestion, and detailed speakerNotes.`,

    video_package: `You are the Video Production Package Specialist Agent for Artefact.AI.
Create a complete video script and storyboard with ${
      detail === 1 ? 3 : detail === 2 ? 4 : detail === 3 ? 6 : detail === 4 ? 8 : 10
    } scenes strictly grounded in the FactBase and source.
- Each scene must have sceneNumber, startTime (MM:SS), endTime (MM:SS), durationSeconds, sceneDescription, narrationText, onScreenText, visualRecommendation, and audioNotes.
- Also generate valid SubRip (.srt) timed subtitles in srtSubtitles matching the scenes.`,
  };

  const feedbackBlock =
    validatorFeedback && validatorFeedback.length > 0
      ? `\n\nCRITICAL CORRECTION REQUIRED (FROM PREVIOUS VALIDATION ATTEMPT):\nYour previous draft had unsupported or contradicted claims:\n${validatorFeedback
          .map((issue) => `- ${issue}`)
          .join('\n')}\nRemove or fix every single issue above using ONLY verbatim facts and numbers from the source.`
      : '';

  const raw = await generateStructuredJson<OutputContentMap[K]>({
    systemInstruction: `${specialistInstructions[type]}
GLOBAL FACTUALITY RULE: Use ONLY facts, numbers, dates, names, quotes, and references present in the provided source and FactBase. Never invent numbers or extrapolate statistics. If a detail is missing from the source, leave it out.`,
    prompt: `SHARED FACT BASE:\n${JSON.stringify(
      factBase,
      null,
      2
    )}\n\nOPERATOR CONTROLS:\n${formatControlsPrompt(
      controls
    )}\n\nFULL SOURCE MATERIAL:\n${combinedSource.slice(0, 35000)}${feedbackBlock}`,
    schema: getSchemaForOutputType(type),
    temperature: validatorFeedback ? 0.1 : 0.2,
  });

  return enforceOutputConstraints(type, raw, controls, factBase);
}

// 4. VALIDATOR AGENT
const validationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    score: {
      type: Type.INTEGER,
      description: 'Factual grounding score from 0 to 100. Deduct heavily for unsupported or contradicted claims.',
    },
    claims: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          claim: { type: Type.STRING, description: 'Factual claim, number, name, or date in the generated output' },
          status: {
            type: Type.STRING,
            description: 'One of: supported, unsupported, contradicted',
          },
          sourceQuote: {
            type: Type.STRING,
            description: 'Supporting or contradicting quote from the source (or "Not found in source")',
          },
          note: { type: Type.STRING, description: 'Brief explanation of verification' },
        },
        required: ['claim', 'status', 'sourceQuote', 'note'],
      },
    },
    issues: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'List of specific factual errors, unsupported claims, or contradictions that need correction. Empty if all claims are supported.',
    },
  },
  required: ['score', 'claims', 'issues'],
};

export async function runValidatorAgent<K extends OutputType>(params: {
  type: K;
  content: OutputContentMap[K];
  combinedSource: string;
  factBase: FactBase;
}): Promise<ValidationResult> {
  try {
    const plainText = artefactToPlainText(params.type, params.content);
    const raw = await generateStructuredJson<{
      score: number;
      claims: Array<{
        claim: string;
        status: 'supported' | 'unsupported' | 'contradicted';
        sourceQuote: string;
        note: string;
      }>;
      issues: string[];
    }>({
      systemInstruction: `You are the Factual Validator Agent for Artefact.AI.
Your job is to inspect one generated output against the full source and shared FactBase.
1. List every factual claim, number, statistic, name, and date in the generated output.
2. Mark each claim as "supported", "unsupported", or "contradicted" with the exact sourceQuote and a note.
3. Ignore purely stylistic or structural items such as colour hex codes, layout names, icon names, slide numbers, or subtitle timecodes.
4. Compute a score from 0 to 100 based strictly on factual fidelity to the source.`,
      prompt: `GENERATED OUTPUT (${params.type}):\n${plainText}\n\nSHARED FACT BASE:\n${JSON.stringify(
        params.factBase,
        null,
        2
      )}\n\nFULL SOURCE:\n${params.combinedSource.slice(0, 35000)}`,
      schema: validationSchema,
      temperature: 0.1,
    });

    const claims = (raw.claims || []).map((c) => ({
      claim: c.claim,
      status: (['supported', 'unsupported', 'contradicted'].includes(c.status)
        ? c.status
        : 'supported') as 'supported' | 'unsupported' | 'contradicted',
      sourceQuote: c.sourceQuote || '',
      note: c.note || '',
    }));

    const clampedScore = Math.max(0, Math.min(100, Math.round(Number(raw.score) || 0)));

    return {
      available: true,
      score: clampedScore,
      retried: false,
      claims,
      issues: Array.isArray(raw.issues) ? raw.issues : [],
    };
  } catch (err) {
    return {
      available: false,
      score: null,
      retried: false,
      claims: [],
      issues: [],
      error: (err as Error).message,
    };
  }
}

// 5. CROSS-OUTPUT CONSISTENCY CHECK
const consistencySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    consistent: {
      type: Type.BOOLEAN,
      description: 'True if all numbers, dates, and core claims match across all outputs in the run',
    },
    issues: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          item: { type: Type.STRING, description: 'The number, metric, or claim that differs' },
          outputsInvolved: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Output types involved in the mismatch',
          },
          description: { type: Type.STRING, description: 'Clear explanation of the discrepancy' },
        },
        required: ['item', 'outputsInvolved', 'description'],
      },
    },
  },
  required: ['consistent', 'issues'],
};

export async function runConsistencyCheck(
  outputs: Array<{ type: OutputType; plainText: string }>,
  factBase: FactBase
): Promise<ConsistencyReport> {
  const checkedAt = new Date().toISOString();
  if (outputs.length <= 1) {
    return {
      checkedAt,
      consistent: true,
      issues: [],
    };
  }

  try {
    const bundleText = outputs
      .map((o) => `=== OUTPUT: ${o.type} ===\n${o.plainText}`)
      .join('\n\n');

    const raw = await generateStructuredJson<{
      consistent: boolean;
      issues: Array<{ item: string; outputsInvolved: OutputType[]; description: string }>;
    }>({
      systemInstruction:
        'You are the Cross-Output Consistency Auditor for Artefact.AI. Compare numbers, percentages, dates, and factual claims across all generated outputs in this run. Flag any numerical or factual contradiction between two or more outputs. Different lengths or levels of summarization are normal and NOT inconsistencies unless two outputs state conflicting numbers or facts.',
      prompt: `SHARED FACT BASE:\n${JSON.stringify(
        factBase.keyNumbers,
        null,
        2
      )}\n\nGENERATED OUTPUTS:\n${bundleText}`,
      schema: consistencySchema,
      temperature: 0.1,
    });

    return {
      checkedAt,
      consistent: Boolean(raw.consistent) && (!raw.issues || raw.issues.length === 0),
      issues: Array.isArray(raw.issues) ? raw.issues : [],
    };
  } catch {
    return {
      checkedAt,
      consistent: true,
      issues: [],
    };
  }
}

// 6. MICRO-TUNING AGENT
export async function runTuneAgent<K extends OutputType>(params: {
  type: K;
  currentContent: OutputContentMap[K];
  instruction: string;
  combinedSource: string;
  factBase: FactBase;
  controls: RunControls;
}): Promise<OutputContentMap[K]> {
  const presetMap: Record<string, string> = {
    shorten: 'Make the content more concise and tighter by roughly 25-35% while keeping key facts.',
    expand: 'Expand with additional supporting detail and context from the provided FactBase and source.',
    more_assertive: 'Use a more direct, decisive, and action-oriented tone while staying strictly factual.',
    more_technical: 'Use precise domain and technical terminology supported by the source.',
    bullet_points: 'Structure body sections using clear, scannable bulleted points where appropriate.',
    simplify_language: 'Rewrite in plain, accessible language suitable for a general reader while preserving exact numbers.',
  };

  const resolvedInstruction = presetMap[params.instruction] || params.instruction;

  const raw = await generateStructuredJson<OutputContentMap[K]>({
    systemInstruction: `You are the Micro-Tuning Agent for Artefact.AI.
Modify the existing ${params.type} JSON output according to the operator's tuning instruction.
- Return the output in the EXACT same JSON schema as the original type.
- Use ONLY facts, numbers, dates, and names from the provided source and FactBase. Never invent new numbers or claims.`,
    prompt: `TUNING INSTRUCTION:\n${resolvedInstruction}\n\nCURRENT ${params.type.toUpperCase()} JSON:\n${JSON.stringify(
      params.currentContent,
      null,
      2
    )}\n\nSHARED FACT BASE:\n${JSON.stringify(
      params.factBase,
      null,
      2
    )}\n\nSOURCE MATERIAL:\n${params.combinedSource.slice(0, 30000)}`,
    schema: getSchemaForOutputType(params.type),
    temperature: 0.2,
  });

  return enforceOutputConstraints(params.type, raw, params.controls, params.factBase);
}
