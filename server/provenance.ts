import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  GeneratedArtefact,
  InfographicOutput,
  LedgerBlock,
  LedgerOutputEntry,
  LedgerVerifyReport,
  OutputContentMap,
  OutputType,
  VerifyMatchResult,
} from '../src/types/artefact.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const LEDGER_PATH = path.join(DATA_DIR, 'ledger.json');
const GENESIS_PREV_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

// Zero-width characters for invisible watermarking in plain-text exports
const ZW_START = '\u200B\u200C\u200B';
const ZW_END = '\u200C\u200B\u200C';
const ZW_ZERO = '\u200B'; // zero-width space
const ZW_ONE = '\u200C'; // zero-width non-joiner

export function encodeZeroWidthWatermark(watermarkId: string): string {
  const bytes = Buffer.from(watermarkId, 'ascii');
  let bits = '';
  for (const b of bytes) {
    bits += b.toString(2).padStart(8, '0');
  }
  const encoded = bits
    .split('')
    .map((bit) => (bit === '1' ? ZW_ONE : ZW_ZERO))
    .join('');
  return `${ZW_START}${encoded}${ZW_END}`;
}

export function extractZeroWidthWatermark(text: string): string | null {
  const startIdx = text.indexOf(ZW_START);
  if (startIdx === -1) return null;
  const contentStart = startIdx + ZW_START.length;
  const endIdx = text.indexOf(ZW_END, contentStart);
  if (endIdx === -1) return null;

  const zwSlice = text.slice(contentStart, endIdx);
  if (!zwSlice || zwSlice.length % 8 !== 0) return null;

  let result = '';
  for (let i = 0; i < zwSlice.length; i += 8) {
    const byteChunk = zwSlice.slice(i, i + 8);
    let byteVal = 0;
    for (let b = 0; b < 8; b++) {
      const ch = byteChunk[b];
      if (ch !== ZW_ZERO && ch !== ZW_ONE) return null;
      byteVal = (byteVal << 1) | (ch === ZW_ONE ? 1 : 0);
    }
    result += String.fromCharCode(byteVal);
  }

  if (/^ARTF-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(result)) {
    return result;
  }
  return null;
}

export function stripWatermarkAndNormalise(text: string): string {
  // Remove zero-width characters
  let cleaned = text.replace(/[\u200B\u200C\u200D\uFEFF]/g, '');
  // Remove optional visible watermark footer lines if pasted from export
  cleaned = cleaned.replace(
    /\n*---\n*Provenance Watermark ID:\s*ARTF-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}.*$/is,
    ''
  );
  cleaned = cleaned.replace(
    /\n*Watermark ID:\s*ARTF-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}.*$/im,
    ''
  );
  // Normalise line endings and whitespace
  return cleaned.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();
}

export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

export function generateWatermarkId(seedHash: string, type: OutputType): string {
  const combined = sha256Hex(`${seedHash}:${type}:${Date.now()}:${Math.random()}`).toUpperCase();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let part1 = '';
  let part2 = '';
  let part3 = '';
  for (let i = 0; i < 4; i++) {
    part1 += chars[parseInt(combined.slice(i * 2, i * 2 + 2), 16) % chars.length];
    part2 += chars[parseInt(combined.slice(8 + i * 2, 10 + i * 2), 16) % chars.length];
    part3 += chars[parseInt(combined.slice(16 + i * 2, 18 + i * 2), 16) % chars.length];
  }
  return `ARTF-${part1}-${part2}-${part3}`;
}

export function artefactToPlainText<K extends OutputType>(
  type: K,
  content: OutputContentMap[K]
): string {
  switch (type) {
    case 'linkedin': {
      const c = content as OutputContentMap['linkedin'];
      return `${c.hook}\n\n${c.body}\n\n${c.callToAction}\n\n${c.hashtags
        .map((h) => (h.startsWith('#') ? h : `#${h}`))
        .join(' ')}`.trim();
    }
    case 'twitter': {
      const c = content as OutputContentMap['twitter'];
      return c.tweets.map((t, i) => `${i + 1}/${c.tweets.length} ${t}`).join('\n\n');
    }
    case 'advisory': {
      const c = content as OutputContentMap['advisory'];
      const actions = c.recommendedActions
        .map((a) => `- [${a.priority} | ${a.timeline}] ${a.action}`)
        .join('\n');
      const refs = c.references.length > 0 ? `\n\nReferences:\n${c.references.map((r) => `- ${r}`).join('\n')}` : '';
      return `${c.title}\nReference ID: ${c.referenceId}\nDate: ${c.date}\nAudience: ${c.audience}\n\nSummary:\n${c.summary}\n\nBackground:\n${c.background}\n\nKey Findings:\n${c.keyFindings
        .map((f) => `- ${f}`)
        .join('\n')}\n\nImpact:\n${c.impact}\n\nRecommended Actions:\n${actions}${refs}`.trim();
    }
    case 'infographic': {
      const c = content as InfographicOutput;
      const stats = c.statistics.map((s) => `- ${s.value}: ${s.label} (${s.context})`).join('\n');
      const secs = c.sections.map((s) => `### ${s.title}\n${s.summary}`).join('\n\n');
      return `${c.headline}\n${c.subtitle}\n\nKey Messages:\n${c.keyMessages
        .map((m) => `- ${m}`)
        .join('\n')}\n\nStatistics:\n${stats}\n\n${secs}\n\nCall to Action: ${c.callToAction}\n\nReadable Summary:\n${c.readableTextVersion}`.trim();
    }
    case 'executive_summary': {
      const c = content as OutputContentMap['executive_summary'];
      return `${c.title}\nDate: ${c.date}\nAudience: ${c.audience}\n\nBottom Line:\n${c.bottomLine}\n\nKey Points:\n${c.keyPoints
        .map((p) => `- ${p}`)
        .join('\n')}\n\nImplications:\n${c.implications
        .map((p) => `- ${p}`)
        .join('\n')}\n\nDecision Needed / Next Steps:\n${c.decisionNeededOrNextSteps
        .map((p) => `- ${p}`)
        .join('\n')}`.trim();
    }
    case 'presentation': {
      const c = content as OutputContentMap['presentation'];
      const slides = c.slides
        .map(
          (s) =>
            `Slide ${s.slideNumber}: ${s.title}\n${s.bullets
              .map((b) => `- ${b}`)
              .join('\n')}\nVisual Suggestion: ${s.visualSuggestion}\nSpeaker Notes: ${s.speakerNotes}`
        )
        .join('\n\n');
      return `${c.title}\n${c.subtitle}\n\n${slides}`.trim();
    }
    case 'video_package': {
      const c = content as OutputContentMap['video_package'];
      const scenes = c.scenes
        .map(
          (s) =>
            `Scene ${s.sceneNumber} (${s.startTime} - ${s.endTime}, ${s.durationSeconds}s)\nVisual: ${s.sceneDescription}\nOn-Screen Text: ${s.onScreenText}\nNarration: ${s.narrationText}\nAudio Notes: ${s.audioNotes}`
        )
        .join('\n\n');
      return `${c.title}\nTarget Duration: ${c.targetDuration} | Platform: ${c.platform}\n\nSummary:\n${c.scriptSummary}\n\nStoryboard & Script:\n${scenes}\n\nMusic & Sound Notes:\n${c.musicAndSoundNotes}\n\nSRT Subtitles:\n${c.srtSubtitles}`.trim();
    }
  }
}

export function hashNormalisedContent(plainText: string): string {
  const norm = stripWatermarkAndNormalise(plainText);
  return sha256Hex(norm);
}

export function computeBatchHash(sourceHash: string, outputHashes: Array<{ type: string; hash: string }>): string {
  const sorted = [...outputHashes].sort((a, b) => a.type.localeCompare(b.type));
  const payload = `${sourceHash}|${sorted.map((o) => `${o.type}:${o.hash}`).join('|')}`;
  return sha256Hex(payload);
}

export function computeBlockHash(block: Omit<LedgerBlock, 'blockHash'>): string {
  // Hash core immutable fields
  const outputsCanonical = block.outputHashes.map((o) => ({
    type: o.type,
    watermarkId: o.watermarkId,
    hash: o.hash,
  }));
  const payload = [
    block.index,
    block.runId,
    block.timestamp,
    block.sourceHash,
    JSON.stringify(outputsCanonical),
    block.batchHash,
    block.previousHash,
  ].join('|');
  return sha256Hex(payload);
}

function tokeniseForSimilarity(text: string): string[] {
  const norm = stripWatermarkAndNormalise(text).toLowerCase();
  const words = norm.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 3);
  // Return up to 150 unique tokens for lightweight similarity matching in ledger
  return Array.from(new Set(words)).slice(0, 150);
}

export function ensureLedgerFile(): LedgerBlock[] {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(LEDGER_PATH)) {
    fs.writeFileSync(LEDGER_PATH, JSON.stringify([], null, 2), 'utf8');
    return [];
  }
  try {
    const raw = fs.readFileSync(LEDGER_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getLedger(): LedgerBlock[] {
  return ensureLedgerFile();
}

export function appendToLedger(params: {
  runId: string;
  runTitle: string;
  sourceHash: string;
  artefacts: Partial<Record<OutputType, GeneratedArtefact>>;
}): LedgerBlock {
  const blocks = ensureLedgerFile();
  const index = blocks.length;
  const previousHash = index === 0 ? GENESIS_PREV_HASH : blocks[index - 1].blockHash;
  const timestamp = new Date().toISOString();

  const outputHashes: LedgerOutputEntry[] = [];
  for (const [typeKey, art] of Object.entries(params.artefacts)) {
    if (art && art.status === 'done' && art.sha256 && art.watermarkId && art.plainText) {
      outputHashes.push({
        type: typeKey as OutputType,
        watermarkId: art.watermarkId,
        hash: art.sha256,
        plainTextSnippet: stripWatermarkAndNormalise(art.plainText).slice(0, 240),
        normalisedTokens: tokeniseForSimilarity(art.plainText),
      });
    }
  }

  const batchHash = computeBatchHash(
    params.sourceHash,
    outputHashes.map((o) => ({ type: o.type, hash: o.hash }))
  );

  const partialBlock: Omit<LedgerBlock, 'blockHash'> = {
    index,
    runId: params.runId,
    runTitle: params.runTitle,
    timestamp,
    sourceHash: params.sourceHash,
    outputHashes,
    batchHash,
    previousHash,
  };

  const blockHash = computeBlockHash(partialBlock);
  const newBlock: LedgerBlock = {
    ...partialBlock,
    blockHash,
  };

  blocks.push(newBlock);
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(blocks, null, 2), 'utf8');
  return newBlock;
}

export function verifyLedgerIntegrity(): LedgerVerifyReport {
  const checkedAt = new Date().toISOString();
  if (!fs.existsSync(LEDGER_PATH)) {
    ensureLedgerFile();
    return {
      valid: true,
      totalBlocks: 0,
      checkedAt,
      firstBrokenBlockIndex: null,
      reason: 'Ledger initialized and empty. No tampering detected.',
    };
  }

  let blocks: LedgerBlock[];
  try {
    const raw = fs.readFileSync(LEDGER_PATH, 'utf8');
    blocks = JSON.parse(raw);
    if (!Array.isArray(blocks)) {
      return {
        valid: false,
        totalBlocks: 0,
        checkedAt,
        firstBrokenBlockIndex: 0,
        reason: 'Ledger file does not contain a valid JSON array.',
      };
    }
  } catch (err) {
    return {
      valid: false,
      totalBlocks: 0,
      checkedAt,
      firstBrokenBlockIndex: 0,
      reason: `Ledger file JSON is corrupted: ${(err as Error).message}`,
    };
  }

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.index !== i) {
      return {
        valid: false,
        totalBlocks: blocks.length,
        checkedAt,
        firstBrokenBlockIndex: i,
        reason: `Block at position ${i} has mismatched index ${block.index}.`,
      };
    }

    const expectedPrev = i === 0 ? GENESIS_PREV_HASH : blocks[i - 1].blockHash;
    if (block.previousHash !== expectedPrev) {
      return {
        valid: false,
        totalBlocks: blocks.length,
        checkedAt,
        firstBrokenBlockIndex: i,
        reason: `Block #${i} previousHash (${block.previousHash.slice(0, 12)}...) does not match Block #${
          i - 1
        } blockHash (${expectedPrev.slice(0, 12)}...).`,
      };
    }

    const expectedBatchHash = computeBatchHash(
      block.sourceHash,
      (block.outputHashes || []).map((o) => ({ type: o.type, hash: o.hash }))
    );
    if (block.batchHash !== expectedBatchHash) {
      return {
        valid: false,
        totalBlocks: blocks.length,
        checkedAt,
        firstBrokenBlockIndex: i,
        reason: `Block #${i} batchHash was modified and no longer matches its recorded output hashes.`,
      };
    }

    const recomputed = computeBlockHash(block);
    if (block.blockHash !== recomputed) {
      return {
        valid: false,
        totalBlocks: blocks.length,
        checkedAt,
        firstBrokenBlockIndex: i,
        reason: `Block #${i} hash mismatch. Expected ${recomputed.slice(0, 16)}..., found ${block.blockHash.slice(
          0,
          16
        )}...`,
      };
    }
  }

  return {
    valid: true,
    totalBlocks: blocks.length,
    checkedAt,
    firstBrokenBlockIndex: null,
    reason:
      blocks.length === 0
        ? 'Ledger is empty. Integrity verified.'
        : `All ${blocks.length} block(s) verified from genesis. No tampering detected.`,
  };
}

export function verifyCandidateContent(rawContent: string): VerifyMatchResult {
  const extractedZwWatermark = extractZeroWidthWatermark(rawContent);
  const visibleWatermarkMatch = rawContent.match(/ARTF-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/);
  const extractedWatermarkId = extractedZwWatermark || (visibleWatermarkMatch ? visibleWatermarkMatch[0] : null);

  const normalised = stripWatermarkAndNormalise(rawContent);
  const computedHash = sha256Hex(normalised);
  const blocks = getLedger();

  // 1. Check exact SHA-256 match against any output hash or source hash or JSON representation
  for (let bIdx = blocks.length - 1; bIdx >= 0; bIdx--) {
    const block = blocks[bIdx];
    for (const out of block.outputHashes) {
      if (out.hash === computedHash) {
        return {
          status: 'VERIFIED',
          computedHash,
          extractedWatermarkId: extractedWatermarkId || out.watermarkId,
          similarityScore: 1,
          matchedRun: {
            runId: block.runId,
            runTitle: block.runTitle,
            timestamp: block.timestamp,
            outputType: out.type,
            watermarkId: out.watermarkId,
            originalHash: out.hash,
            blockIndex: block.index,
          },
          message:
            'Exact cryptographic match found in the local provenance ledger. The content is unmodified since generation.',
        };
      }
    }
  }

  // 2. Check if watermark ID matches a recorded output or if token similarity is high (MODIFIED)
  const candidateTokens = tokeniseForSimilarity(rawContent);
  const candidateSet = new Set(candidateTokens);

  let bestMatch: {
    similarity: number;
    block: LedgerBlock;
    out: LedgerOutputEntry;
    watermarkMatched: boolean;
  } | null = null;

  for (let bIdx = blocks.length - 1; bIdx >= 0; bIdx--) {
    const block = blocks[bIdx];
    for (const out of block.outputHashes) {
      const watermarkMatched = Boolean(extractedWatermarkId && out.watermarkId === extractedWatermarkId);
      const outTokens = out.normalisedTokens || [];
      let intersection = 0;
      for (const tok of outTokens) {
        if (candidateSet.has(tok)) intersection++;
      }
      const union = new Set([...candidateTokens, ...outTokens]).size;
      const jaccard = union > 0 ? intersection / union : 0;

      // Also check prefix snippet containment
      const snippetMatch =
        out.plainTextSnippet &&
        normalised.length > 30 &&
        (normalised.includes(out.plainTextSnippet.slice(0, 80)) ||
          out.plainTextSnippet.includes(normalised.slice(0, 80)));

      const effectiveScore = Math.max(
        jaccard,
        snippetMatch ? 0.68 : 0,
        watermarkMatched ? Math.max(jaccard, 0.65) : 0
      );

      if (!bestMatch || effectiveScore > bestMatch.similarity) {
        bestMatch = {
          similarity: effectiveScore,
          block,
          out,
          watermarkMatched,
        };
      }
    }
  }

  if (bestMatch && (bestMatch.watermarkMatched || bestMatch.similarity >= 0.45)) {
    return {
      status: 'MODIFIED',
      computedHash,
      extractedWatermarkId: extractedWatermarkId || bestMatch.out.watermarkId,
      similarityScore: Number(bestMatch.similarity.toFixed(2)),
      matchedRun: {
        runId: bestMatch.block.runId,
        runTitle: bestMatch.block.runTitle,
        timestamp: bestMatch.block.timestamp,
        outputType: bestMatch.out.type,
        watermarkId: bestMatch.out.watermarkId,
        originalHash: bestMatch.out.hash,
        blockIndex: bestMatch.block.index,
      },
      message: bestMatch.watermarkMatched
        ? `Watermark ID ${bestMatch.out.watermarkId} matches a recorded artefact, but the text was edited after generation (SHA-256 hash differs).`
        : `Content closely matches a recorded ${bestMatch.out.type} artefact (${Math.round(
            bestMatch.similarity * 100
          )}% token overlap), but has been modified since generation.`,
    };
  }

  return {
    status: 'NOT_FOUND',
    computedHash,
    extractedWatermarkId,
    similarityScore: bestMatch ? Number(bestMatch.similarity.toFixed(2)) : 0,
    message:
      'No matching output hash or close similarity match was found in the local provenance ledger.',
  };
}
