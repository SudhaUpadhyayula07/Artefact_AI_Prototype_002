import type { OutputType } from '../types/artefact';

const ZW_START = '\u200B\u200C\u200B';
const ZW_END = '\u200C\u200B\u200C';
const ZW_ZERO = '\u200B';
const ZW_ONE = '\u200C';

export function encodeZeroWidthClient(watermarkId: string): string {
  let bits = '';
  for (let i = 0; i < watermarkId.length; i++) {
    bits += watermarkId.charCodeAt(i).toString(2).padStart(8, '0');
  }
  const encoded = bits
    .split('')
    .map((b) => (b === '1' ? ZW_ONE : ZW_ZERO))
    .join('');
  return `${ZW_START}${encoded}${ZW_END}`;
}

export function extractZeroWidthClient(text: string): string | null {
  const startIdx = text.indexOf(ZW_START);
  if (startIdx === -1) return null;
  const contentStart = startIdx + ZW_START.length;
  const endIdx = text.indexOf(ZW_END, contentStart);
  if (endIdx === -1) return null;
  const slice = text.slice(contentStart, endIdx);
  if (!slice || slice.length % 8 !== 0) return null;

  let out = '';
  for (let i = 0; i < slice.length; i += 8) {
    let byteVal = 0;
    for (let b = 0; b < 8; b++) {
      const ch = slice[i + b];
      if (ch !== ZW_ZERO && ch !== ZW_ONE) return null;
      byteVal = (byteVal << 1) | (ch === ZW_ONE ? 1 : 0);
    }
    out += String.fromCharCode(byteVal);
  }
  if (/^ARTF-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(out)) {
    return out;
  }
  return null;
}

export function normaliseForClientHash(rawText: string): string {
  let cleaned = rawText.replace(/[\u200B\u200C\u200D\uFEFF]/g, '');
  cleaned = cleaned.replace(
    /\n*---\n*Provenance Watermark ID:\s*ARTF-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}.*$/is,
    ''
  );
  cleaned = cleaned.replace(
    /\n*Watermark ID:\s*ARTF-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}.*$/im,
    ''
  );
  return cleaned.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();
}

export async function sha256WebCrypto(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const OUTPUT_META: Record<
  OutputType,
  {
    label: string;
    shortDesc: string;
    sentence: string;
  }
> = {
  linkedin: {
    label: 'LinkedIn post',
    shortDesc: 'Hook, structured body paragraphs, call to action, and 3 to 6 hashtags.',
    sentence:
      'A structured professional post with an opening hook, body paragraphs, a call to action, and 3 to 6 hashtags under 3,000 characters.',
  },
  twitter: {
    label: 'Twitter/X post or thread',
    shortDesc: '1 to 10 connected tweets, strictly 280 characters or fewer per tweet.',
    sentence:
      'A single post or numbered thread of 1 to 10 tweets where every tweet is checked to stay within 280 characters.',
  },
  advisory: {
    label: 'Advisory',
    shortDesc: 'Reference ID, findings, impact, and prioritised recommended actions.',
    sentence:
      'A formal security, policy, or operational advisory with findings, impact analysis, and prioritised actions with timelines.',
  },
  infographic: {
    label: 'Infographic',
    shortDesc: 'Rendered SVG visual canvas with source statistics, sections, and PNG/SVG download.',
    sentence:
      'A visual infographic rendered directly as SVG and downloadable as PNG or SVG, featuring 3 to 6 source statistics and structured sections.',
  },
  executive_summary: {
    label: 'Executive summary',
    shortDesc: 'One-page briefing leading with the bottom line, key points, and next steps.',
    sentence:
      'A one-page briefing for decision-makers that leads with the bottom line upfront, followed by key points, implications, and next steps.',
  },
  presentation: {
    label: 'Presentation',
    shortDesc: 'Slide deck with bullets, visual notes, speaker notes, and real PPTX export.',
    sentence:
      'A multi-slide deck with slide titles, bullet points, visual suggestions, speaker notes, an interactive viewer, and real PPTX download.',
  },
  video_package: {
    label: 'Video package',
    shortDesc: 'Storyboard scenes, narration script, visual cues, and timed SRT subtitles.',
    sentence:
      'A complete production package containing a storyboard timeline, narration script, on-screen text, audio notes, and valid SRT timed subtitles.',
  },
};

export const ALL_OUTPUT_TYPES: OutputType[] = [
  'linkedin',
  'twitter',
  'advisory',
  'infographic',
  'executive_summary',
  'presentation',
  'video_package',
];
