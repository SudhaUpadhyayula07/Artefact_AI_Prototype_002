import { GoogleGenAI, GenerateContentParameters, GenerateContentResponse, Schema } from '@google/genai';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { MODEL } from './config.ts';

export function getApiKey(): string {
  return (process.env.GEMINI_API_KEY || '').trim();
}

export function isApiKeyConfigured(): boolean {
  const key = getApiKey();
  return Boolean(key && key !== 'MY_GEMINI_API_KEY' && key.length > 10);
}

export function getModelName(): string {
  return MODEL;
}

export function createGenAIClient(): GoogleGenAI {
  const apiKey = getApiKey();
  if (!isApiKeyConfigured()) {
    throw new Error(
      'Gemini API key is missing or invalid. Configure GEMINI_API_KEY in the server environment before running.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface ModelHealthResult {
  model: string;
  modelWorking: boolean;
  modelStatus: 'ok' | 'not_found' | 'quota_or_busy' | 'error' | 'unconfigured';
  modelMessage: string;
  rawError?: string;
  checkedAt: string;
}

let cachedModelHealth: ModelHealthResult | null = null;
let lastHealthCheckTime = 0;
let inFlightHealthCheck: Promise<ModelHealthResult> | null = null;

export async function checkConfiguredModelHealth(forceRefresh = false): Promise<ModelHealthResult> {
  const model = MODEL;
  const now = Date.now();

  if (!isApiKeyConfigured()) {
    const res: ModelHealthResult = {
      model,
      modelWorking: false,
      modelStatus: 'unconfigured',
      modelMessage: `GEMINI_API_KEY is not configured on the server.`,
      checkedAt: new Date().toISOString(),
    };
    cachedModelHealth = res;
    return res;
  }

  if (!forceRefresh && cachedModelHealth && cachedModelHealth.model === model && now - lastHealthCheckTime < 60_000) {
    return cachedModelHealth;
  }

  if (inFlightHealthCheck) {
    return inFlightHealthCheck;
  }

  inFlightHealthCheck = (async () => {
    try {
      const ai = createGenAIClient();
      await ai.models.generateContent({
        model,
        contents: 'OK',
        config: {
          maxOutputTokens: 4,
          temperature: 0,
        },
      });
      const result: ModelHealthResult = {
        model,
        modelWorking: true,
        modelStatus: 'ok',
        modelMessage: `Model ${model} is available and responding.`,
        checkedAt: new Date().toISOString(),
      };
      cachedModelHealth = result;
      lastHealthCheckTime = Date.now();
      return result;
    } catch (err) {
      const raw = String((err as Error)?.message || err);
      const lower = raw.toLowerCase();
      const status = (err as { status?: number })?.status;
      const isNotFound =
        status === 404 ||
        lower.includes('404') ||
        lower.includes('not_found') ||
        lower.includes('no longer available') ||
        lower.includes('not found');

      if (isNotFound) {
        const result: ModelHealthResult = {
          model,
          modelWorking: false,
          modelStatus: 'not_found',
          modelMessage: `Model ${model} is unavailable. Set GEMINI_MODEL to a currently supported model.`,
          rawError: raw,
          checkedAt: new Date().toISOString(),
        };
        cachedModelHealth = result;
        lastHealthCheckTime = Date.now();
        return result;
      }

      const isQuotaOrBusy =
        status === 429 ||
        status === 503 ||
        lower.includes('429') ||
        lower.includes('resource_exhausted') ||
        lower.includes('quota') ||
        lower.includes('503') ||
        lower.includes('high demand') ||
        lower.includes('overloaded');

      if (isQuotaOrBusy) {
        const result: ModelHealthResult = {
          model,
          modelWorking: false,
          modelStatus: 'quota_or_busy',
          modelMessage: lower.includes('quota') || lower.includes('429')
            ? `Model ${model} exists, but the current API key has reached its rate or quota limit.`
            : `Model ${model} is currently experiencing high demand (503).`,
          rawError: raw,
          checkedAt: new Date().toISOString(),
        };
        cachedModelHealth = result;
        lastHealthCheckTime = Date.now();
        return result;
      }

      const result: ModelHealthResult = {
        model,
        modelWorking: false,
        modelStatus: 'error',
        modelMessage: `Model ${model} check failed: ${raw.slice(0, 180)}`,
        rawError: raw,
        checkedAt: new Date().toISOString(),
      };
      cachedModelHealth = result;
      lastHealthCheckTime = Date.now();
      return result;
    } finally {
      inFlightHealthCheck = null;
    }
  })();

  return inFlightHealthCheck;
}

// Concurrency limiter (max 3 parallel Gemini calls)
class ConcurrencyQueue {
  private active = 0;
  private readonly maxConcurrency: number;
  private readonly queue: Array<() => void> = [];

  constructor(maxConcurrency = 3) {
    this.maxConcurrency = maxConcurrency;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.maxConcurrency) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

export const geminiLimiter = new ConcurrencyQueue(3);

function isRetryableError(err: unknown): boolean {
  if (!err) return false;
  const msg = String((err as Error)?.message || err).toLowerCase();
  const status = (err as { status?: number })?.status;
  if (status === 429 || (status && status >= 500 && status < 600)) return true;
  return (
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('resource_exhausted') ||
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('overloaded') ||
    msg.includes('high demand')
  );
}

export async function callGeminiWithBackoff(
  params: GenerateContentParameters,
  maxRetries = 2
): Promise<GenerateContentResponse> {
  return geminiLimiter.run(async () => {
    const ai = createGenAIClient();
    let attempt = 0;
    let delayMs = 1500;

    while (true) {
      try {
        return await ai.models.generateContent({
          ...params,
          model: params.model || MODEL,
        });
      } catch (err) {
        attempt++;
        const msg = String((err as Error)?.message || err).toLowerCase();
        // Do not retry daily quota exhaustion or 404 model not found
        const isDailyQuota = msg.includes('generaterequestsperday') || msg.includes('perday');
        if (attempt > maxRetries || isDailyQuota || !isRetryableError(err)) {
          throw err;
        }
        await new Promise((r) => setTimeout(r, delayMs));
        delayMs *= 2;
      }
    }
  });
}

export function stripEmDashesDeep<T>(val: T): T {
  if (typeof val === 'string') {
    return val.replace(/\s*[\u2014\u2013]\s*/g, ' - ') as unknown as T;
  }
  if (Array.isArray(val)) {
    return val.map((item) => stripEmDashesDeep(item)) as unknown as T;
  }
  if (val && typeof val === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      out[k] = stripEmDashesDeep(v);
    }
    return out as T;
  }
  return val;
}

export function cleanJsonText(rawText: string): string {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let start = -1;
  let end = -1;
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    start = firstBrace;
    end = cleaned.lastIndexOf('}');
  } else if (firstBracket !== -1) {
    start = firstBracket;
    end = cleaned.lastIndexOf(']');
  }
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }
  return cleaned;
}

export async function generateStructuredJson<T>(options: {
  model?: string;
  systemInstruction: string;
  prompt: string;
  schema: Schema;
  temperature?: number;
  validate?: (parsed: T) => boolean;
}): Promise<T> {
  const model = options.model || MODEL;
  const baseSystem = `${options.systemInstruction}\n\nSTRICT RULES:\n1. Never use em dashes or en dashes anywhere in your output. Use commas, colons, or standard hyphens (-).\n2. Never use empty marketing phrases such as "unlock the power", "revolutionise", "seamless", "supercharge", or "game-changing".\n3. Return valid JSON matching the requested schema.`;

  const response = await callGeminiWithBackoff({
    model,
    contents: options.prompt,
    config: {
      systemInstruction: baseSystem,
      responseMimeType: 'application/json',
      responseSchema: options.schema,
      temperature: options.temperature ?? 0.2,
    },
  });

  const rawText = response.text || '';
  const cleaned = cleanJsonText(rawText);

  try {
    const parsed = stripEmDashesDeep(JSON.parse(cleaned) as T);
    if (options.validate && !options.validate(parsed)) {
      throw new Error('Output JSON did not pass shape validation.');
    }
    return parsed;
  } catch (firstErr) {
    const repairResponse = await callGeminiWithBackoff({
      model,
      contents: `The previous JSON output was malformed or incomplete. Repair it so it strictly conforms to the schema without changing any factual content.\n\nBroken output:\n${rawText}\n\nError: ${(firstErr as Error).message}`,
      config: {
        systemInstruction: baseSystem,
        responseMimeType: 'application/json',
        responseSchema: options.schema,
        temperature: 0.1,
      },
    });
    const repairedClean = cleanJsonText(repairResponse.text || '');
    const repaired = stripEmDashesDeep(JSON.parse(repairedClean) as T);
    if (options.validate && !options.validate(repaired)) {
      throw new Error('Output JSON failed shape validation after repair attempt.');
    }
    return repaired;
  }
}

export async function buildMediaPart(
  buffer: Buffer,
  mimeType: string,
  originalName: string
): Promise<{
  part: { inlineData?: { mimeType: string; data: string }; fileData?: { mimeType: string; fileUri: string } };
  cleanup: () => Promise<void>;
}> {
  const INLINE_LIMIT_BYTES = 12 * 1024 * 1024;
  if (buffer.length <= INLINE_LIMIT_BYTES) {
    return {
      part: {
        inlineData: {
          mimeType,
          data: buffer.toString('base64'),
        },
      },
      cleanup: async () => {},
    };
  }

  const ai = createGenAIClient();
  const ext = path.extname(originalName) || '.bin';
  const tempPath = path.join(os.tmpdir(), `artefact-upload-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  await fs.promises.writeFile(tempPath, buffer);

  let uploadedName: string | undefined;
  try {
    const uploadResult = await ai.files.upload({
      file: tempPath,
      config: { mimeType },
    });
    uploadedName = uploadResult.name;
    return {
      part: {
        fileData: {
          mimeType: uploadResult.mimeType || mimeType,
          fileUri: uploadResult.uri || '',
        },
      },
      cleanup: async () => {
        try {
          await fs.promises.unlink(tempPath);
        } catch {}
        if (uploadedName) {
          try {
            await ai.files.delete({ name: uploadedName });
          } catch {}
        }
      },
    };
  } catch (err) {
    try {
      await fs.promises.unlink(tempPath);
    } catch {}
    throw err;
  }
}
