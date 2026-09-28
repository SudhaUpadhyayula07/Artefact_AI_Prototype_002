import dotenv from 'dotenv';

// Load .env and override any stale container-level default so GEMINI_MODEL reflects current configuration
dotenv.config({ override: true });

const rawEnvModel = (process.env.GEMINI_MODEL || '').trim().replace(/^models\//i, '');

export const MODEL: string = rawEnvModel || 'gemini-3.8-flash';
