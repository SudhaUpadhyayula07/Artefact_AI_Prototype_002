import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  createPasswordResetToken,
  getUserBySessionToken,
  loginUser,
  logoutSession,
  registerUser,
  resetPasswordWithToken,
  toPublicUser,
  updateUserAccountData,
} from './server/auth.ts';
import {
  runConsistencyCheck,
  runModerationAgent,
  runOrchestratorAgent,
  runSpecialistAgent,
  runTuneAgent,
  runValidatorAgent,
} from './server/agents.ts';
import {
  buildDocxExport,
  buildInfographicSvg,
  buildJsonExport,
  buildMarkdownExport,
  buildPdfExport,
  buildPptxExport,
  buildRunZipBuffer,
  buildTxtExport,
} from './server/export.ts';
import { extractFromFile, extractFromUrl } from './server/extract.ts';
import { MODEL } from './server/config.ts';
import { ensurePublicFavicons } from './server/faviconGenerator.ts';
import {
  checkConfiguredModelHealth,
  isApiKeyConfigured,
} from './server/gemini.ts';
import {
  appendToLedger,
  artefactToPlainText,
  computeBatchHash,
  ensureLedgerFile,
  generateWatermarkId,
  getLedger,
  hashNormalisedContent,
  sha256Hex,
  verifyCandidateContent,
  verifyLedgerIntegrity,
} from './server/provenance.ts';
import type {
  FactBase,
  GeneratedArtefact,
  InfographicOutput,
  OutputType,
  PresentationOutput,
  RunControls,
  SourceItem,
  VideoPackageOutput,
} from './src/types/artefact.ts';

const PORT = 3000;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

// Generate favicons in /public before starting
ensurePublicFavicons(path.resolve(process.cwd(), 'public'));
ensureLedgerFile();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
  },
});

function getPublicSiteUrl(req?: Request): string {
  const pub = (process.env.PUBLIC_SITE_URL || '').trim();
  if (pub && pub !== 'MY_PUBLIC_SITE_URL') return pub.replace(/\/+$/, '');
  const appUrl = (process.env.APP_URL || '').trim();
  if (appUrl && appUrl !== 'MY_APP_URL') return appUrl.replace(/\/+$/, '');
  if (req) {
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host') || `localhost:${PORT}`;
    return `${proto}://${host}`;
  }
  return `http://localhost:${PORT}`;
}

function getContactEmail(): string {
  return (process.env.CONTACT_EMAIL || 'ops@artefact.example.com').trim();
}

// Per-IP rate limiter
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxRequests = 90;

  const bucket = rateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + windowMs });
    return next();
  }
  bucket.count++;
  if (bucket.count > maxRequests) {
    return res.status(429).json({
      error: 'RATE_LIMITED',
      message: 'Too many requests from this IP address. Please wait a moment and try again.',
    });
  }
  return next();
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '15mb' }));
  app.use('/api', rateLimitMiddleware);

  // Dynamic robots.txt and sitemap.xml for custom domain readiness
  app.get('/robots.txt', (req, res) => {
    const baseUrl = getPublicSiteUrl(req);
    res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${baseUrl}/sitemap.xml\n`);
  });

  app.get('/sitemap.xml', (req, res) => {
    const baseUrl = getPublicSiteUrl(req);
    const nowIso = new Date().toISOString().split('T')[0];
    const routes = ['/', '/dashboard', '/verify', '/ledger', '/terms'];
    const urlsXml = routes
      .map(
        (r) =>
          `  <url>\n    <loc>${baseUrl}${r}</loc>\n    <lastmod>${nowIso}</lastmod>\n    <changefreq>weekly</changefreq>\n  </url>`
      )
      .join('\n');
    res
      .type('application/xml')
      .send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlsXml}\n</urlset>`
      );
  });

  // 1. GET /api/health
  app.get('/api/health', async (req, res) => {
    const blocks = getLedger();
    const integrity = verifyLedgerIntegrity();
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const modelHealth = await checkConfiguredModelHealth(forceRefresh);
    res.json({
      ok: true,
      apiKeyConfigured: isApiKeyConfigured(),
      model: MODEL,
      modelWorking: modelHealth.modelWorking,
      modelStatus: modelHealth.modelStatus,
      modelMessage: modelHealth.modelMessage,
      modelRawError: modelHealth.rawError,
      publicSiteUrl: getPublicSiteUrl(req),
      contactEmail: getContactEmail(),
      ledger: {
        exists: true,
        blockCount: blocks.length,
        valid: integrity.valid,
      },
    });
  });

  // 2. POST /api/extract
  app.post(
    '/api/extract',
    (req, res, next) => {
      upload.single('file')(req, res, (err) => {
        if (err) {
          if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
              error: 'FILE_TOO_LARGE',
              message: 'File exceeds the 25 MB limit. Please upload a file under 25 MB.',
            });
          }
          return res.status(400).json({
            error: 'UPLOAD_ERROR',
            message: (err as Error).message || 'File upload failed.',
          });
        }
        next();
      });
    },
    async (req, res) => {
      try {
        if (req.file) {
          const isBinaryNeedingAi =
            req.file.mimetype.startsWith('image/') ||
            req.file.mimetype.startsWith('audio/') ||
            req.file.mimetype.startsWith('video/');
          if (isBinaryNeedingAi && !isApiKeyConfigured()) {
            return res.status(400).json({
              error: 'MISSING_API_KEY',
              message:
                'GEMINI_API_KEY is not configured on the server. Media extraction requires a valid Gemini API key.',
            });
          }
          const result = await extractFromFile(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype
          );
          return res.json({
            ok: true,
            title: result.title,
            text: result.text,
            method: result.method,
          });
        }

        const url = req.body?.url;
        if (typeof url === 'string' && url.trim()) {
          const result = await extractFromUrl(url);
          return res.json({
            ok: true,
            title: result.title,
            text: result.text,
            method: result.method,
          });
        }

        return res.status(400).json({
          error: 'INVALID_INPUT',
          message: 'Provide either a file upload or a valid URL to extract.',
        });
      } catch (err) {
        return res.status(422).json({
          error: 'EXTRACTION_FAILED',
          message:
            (err as Error).message ||
            'Could not extract readable text from this source. Try pasting the text directly.',
        });
      }
    }
  );

  // 3. POST /api/moderate
  app.post('/api/moderate', async (req, res) => {
    if (!isApiKeyConfigured()) {
      return res.status(400).json({
        error: 'MISSING_API_KEY',
        message: 'GEMINI_API_KEY is missing or invalid on the server.',
      });
    }
    const text = String(req.body?.text || '').trim();
    const targetLabel = req.body?.target === 'output' ? 'output' : 'source';
    if (!text) {
      return res.status(400).json({
        error: 'EMPTY_TEXT',
        message: 'Text is required for moderation check.',
      });
    }
    const result = await runModerationAgent(text, targetLabel);
    return res.json(result);
  });

  // 4. POST /api/analyze (Orchestrator)
  app.post('/api/analyze', async (req, res) => {
    if (!isApiKeyConfigured()) {
      return res.status(400).json({
        error: 'MISSING_API_KEY',
        message: 'GEMINI_API_KEY is missing or invalid on the server.',
      });
    }
    try {
      const combinedSource = String(req.body?.combinedSource || '').trim();
      const controls = req.body?.controls as RunControls;
      if (!combinedSource || !controls) {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'Both combinedSource and controls are required.',
        });
      }
      const factBase = await runOrchestratorAgent(combinedSource, controls);
      return res.json({ ok: true, factBase });
    } catch (err) {
      return res.status(500).json({
        error: 'ORCHESTRATOR_FAILED',
        message: (err as Error).message || 'Orchestrator failed to build the shared fact base.',
      });
    }
  });

  // 5. POST /api/generate (Single Specialist)
  app.post('/api/generate', async (req, res) => {
    if (!isApiKeyConfigured()) {
      return res.status(400).json({
        error: 'MISSING_API_KEY',
        message: 'GEMINI_API_KEY is missing or invalid on the server.',
      });
    }
    try {
      const { type, combinedSource, factBase, controls, validatorFeedback, sourceHash } = req.body as {
        type: OutputType;
        combinedSource: string;
        factBase: FactBase;
        controls: RunControls;
        validatorFeedback?: string[];
        sourceHash?: string;
      };

      if (!type || !combinedSource || !factBase || !controls) {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'Missing required fields for specialist generation.',
        });
      }

      const content = await runSpecialistAgent({
        type,
        combinedSource,
        factBase,
        controls,
        validatorFeedback,
      });

      const plainText = artefactToPlainText(type, content);
      const sha256 = hashNormalisedContent(plainText);
      const watermarkId = generateWatermarkId(sourceHash || sha256, type);

      return res.json({
        ok: true,
        type,
        content,
        plainText,
        sha256,
        watermarkId,
      });
    } catch (err) {
      return res.status(500).json({
        error: 'SPECIALIST_FAILED',
        message: (err as Error).message || 'Specialist generation failed.',
      });
    }
  });

  // 6. POST /api/validate (Validator Agent)
  app.post('/api/validate', async (req, res) => {
    if (!isApiKeyConfigured()) {
      return res.status(400).json({
        error: 'MISSING_API_KEY',
        message: 'GEMINI_API_KEY is missing or invalid on the server.',
      });
    }
    const { type, content, combinedSource, factBase } = req.body as {
      type: OutputType;
      content: any;
      combinedSource: string;
      factBase: FactBase;
    };
    if (!type || !content || !combinedSource || !factBase) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'Missing required fields for validation.',
      });
    }
    const validation = await runValidatorAgent({
      type,
      content,
      combinedSource,
      factBase,
    });
    return res.json(validation);
  });

  // 7. POST /api/tune (Micro-tuning Agent)
  app.post('/api/tune', async (req, res) => {
    if (!isApiKeyConfigured()) {
      return res.status(400).json({
        error: 'MISSING_API_KEY',
        message: 'GEMINI_API_KEY is missing or invalid on the server.',
      });
    }
    try {
      const { type, currentContent, instruction, combinedSource, factBase, controls, sourceHash } =
        req.body as {
          type: OutputType;
          currentContent: any;
          instruction: string;
          combinedSource: string;
          factBase: FactBase;
          controls: RunControls;
          sourceHash?: string;
        };

      if (!type || !currentContent || !instruction || !combinedSource || !factBase || !controls) {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'Missing required parameters for micro-tuning.',
        });
      }

      const tunedContent = await runTuneAgent({
        type,
        currentContent,
        instruction,
        combinedSource,
        factBase,
        controls,
      });

      const plainText = artefactToPlainText(type, tunedContent);
      const sha256 = hashNormalisedContent(plainText);
      const watermarkId = generateWatermarkId(sourceHash || sha256, type);
      const validation = await runValidatorAgent({
        type,
        content: tunedContent,
        combinedSource,
        factBase,
      });

      return res.json({
        ok: true,
        content: tunedContent,
        plainText,
        sha256,
        watermarkId,
        validation,
      });
    } catch (err) {
      return res.status(500).json({
        error: 'TUNE_FAILED',
        message: (err as Error).message || 'Micro-tuning failed.',
      });
    }
  });

  // 8. POST /api/run (SSE full pipeline)
  app.post('/api/run', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (event: string, data: unknown) => {
      if (!res.writableEnded) {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    };

    if (!isApiKeyConfigured()) {
      sendEvent('run_error', {
        step: 'init',
        error: 'MISSING_API_KEY',
        message:
          'Gemini API key is not configured or is invalid. Set GEMINI_API_KEY in the server environment before running.',
      });
      return res.end();
    }

    const {
      runId,
      sources,
      controls,
      skipModerationWarning,
    } = req.body as {
      runId: string;
      sources: SourceItem[];
      controls: RunControls;
      skipModerationWarning?: boolean;
    };

    if (!sources || sources.length === 0 || !controls || !controls.selectedOutputs?.length) {
      sendEvent('run_error', {
        step: 'init',
        error: 'INVALID_INPUT',
        message: 'At least one readable source and one selected output format are required.',
      });
      return res.end();
    }

    // Build combined source bundle
    const combinedSourceParts = sources.map(
      (s, idx) =>
        `--- SOURCE ${idx + 1}: ${s.title} (${s.type.toUpperCase()}) ---\n${s.rawText.trim()}`
    );
    if (controls.additionalContext) {
      const ctx = controls.additionalContext;
      const extra: string[] = [];
      if (ctx.organisation?.trim()) extra.push(`Organisation: ${ctx.organisation.trim()}`);
      if (ctx.campaign?.trim()) extra.push(`Campaign: ${ctx.campaign.trim()}`);
      if (ctx.mustInclude?.trim()) extra.push(`Must Include: ${ctx.mustInclude.trim()}`);
      if (ctx.mustAvoid?.trim()) extra.push(`Must Avoid: ${ctx.mustAvoid.trim()}`);
      if (extra.length > 0) {
        combinedSourceParts.push(`--- ADDITIONAL OPERATOR CONTEXT ---\n${extra.join('\n')}`);
      }
    }
    const combinedSource = combinedSourceParts.join('\n\n');
    const sourceHash = sha256Hex(combinedSource);

    try {
      // Step 1: Source Moderation
      sendEvent('step_update', {
        stepId: 'moderation',
        status: 'running',
        message: 'Checking combined source material for safety and policy risks...',
      });

      const inputModeration = await runModerationAgent(combinedSource, 'source');
      sendEvent('moderation_result', { inputModeration, sourceHash });

      if (!inputModeration.available && !skipModerationWarning) {
        sendEvent('step_update', {
          stepId: 'moderation',
          status: 'failed',
          message:
            'Safety check service was unavailable. Confirm to continue without source moderation.',
        });
        sendEvent('moderation_confirm_required', {
          reason:
            inputModeration.error ||
            'Moderation agent could not run. Operator confirmation is required before continuing.',
        });
        return res.end();
      }

      if (inputModeration.blocked) {
        sendEvent('step_update', {
          stepId: 'moderation',
          status: 'failed',
          message: `Blocked by safety policy: ${inputModeration.reason}`,
        });
        sendEvent('run_error', {
          step: 'moderation',
          error: 'CONTENT_BLOCKED',
          message: `Run blocked by safety check: ${inputModeration.reason}`,
        });
        return res.end();
      }

      if (inputModeration.flagged && inputModeration.overallSeverity === 'medium' && !skipModerationWarning) {
        sendEvent('step_update', {
          stepId: 'moderation',
          status: 'waiting',
          message: `Safety warning: ${inputModeration.reason}`,
        });
        sendEvent('moderation_confirm_required', {
          reason: `Source material triggered a medium-severity safety notice (${inputModeration.reason}). Confirm to proceed.`,
        });
        return res.end();
      }

      sendEvent('step_update', {
        stepId: 'moderation',
        status: 'done',
        message: inputModeration.flagged
          ? `Completed with low-severity notice: ${inputModeration.reason}`
          : 'Source material passed safety check.',
      });

      // Step 2: Orchestrator Agent
      sendEvent('step_update', {
        stepId: 'orchestrator',
        status: 'running',
        message: 'Extracting verifiable claims, numbers, entities, and building shared fact base...',
      });

      let factBase: FactBase;
      try {
        factBase = await runOrchestratorAgent(combinedSource, controls);
      } catch (orchErr) {
        const msg = (orchErr as Error).message || 'Orchestrator failed to build the fact base.';
        sendEvent('step_update', {
          stepId: 'orchestrator',
          status: 'failed',
          message: msg,
        });
        sendEvent('run_error', {
          step: 'orchestrator',
          error: 'ORCHESTRATOR_FAILED',
          message: msg,
        });
        return res.end();
      }

      sendEvent('fact_base_ready', { factBase, sourceHash });
      sendEvent('step_update', {
        stepId: 'orchestrator',
        status: 'done',
        message: `Built shared fact base: "${factBase.topic}" (${factBase.keyFacts.length} facts, ${factBase.keyNumbers.length} numbers).`,
      });

      // Step 3, 4, 5, 6: Parallel Specialist Generation + Validation + Retry + Output Moderation
      sendEvent('step_update', {
        stepId: 'specialists',
        status: 'running',
        message: `Running ${controls.selectedOutputs.length} specialist agent(s) with concurrency cap of 3...`,
      });
      sendEvent('step_update', {
        stepId: 'validation',
        status: 'running',
        message: 'Validating generated outputs against the source fact base...',
      });

      const artefacts: Partial<Record<OutputType, GeneratedArtefact>> = {};

      await Promise.all(
        controls.selectedOutputs.map(async (outputType) => {
          sendEvent('artefact_update', {
            type: outputType,
            artefact: {
              type: outputType,
              status: 'running',
              approvalStatus: controls.requireHumanApproval ? 'needs_approval' : 'approved',
              versions: [],
            },
          });

          try {
            let content = await runSpecialistAgent({
              type: outputType,
              combinedSource,
              factBase,
              controls,
            });

            sendEvent('artefact_update', {
              type: outputType,
              artefact: {
                type: outputType,
                status: 'validating',
                content,
                approvalStatus: controls.requireHumanApproval ? 'needs_approval' : 'approved',
                versions: [],
              },
            });

            let validation = await runValidatorAgent({
              type: outputType,
              content,
              combinedSource,
              factBase,
            });

            const hasContradiction = validation.claims.some((c) => c.status === 'contradicted');
            if (
              validation.available &&
              validation.score !== null &&
              (validation.score < 70 || hasContradiction)
            ) {
              const firstScore = validation.score;
              sendEvent('artefact_update', {
                type: outputType,
                artefact: {
                  type: outputType,
                  status: 'retrying',
                  content,
                  validation,
                  approvalStatus: 'needs_approval',
                  versions: [],
                },
              });

              const feedback = [
                ...validation.issues,
                ...validation.claims
                  .filter((c) => c.status !== 'supported')
                  .map((c) => `${c.status.toUpperCase()}: "${c.claim}" - ${c.note}`),
              ];

              content = await runSpecialistAgent({
                type: outputType,
                combinedSource,
                factBase,
                controls,
                validatorFeedback: feedback,
              });

              const secondValidation = await runValidatorAgent({
                type: outputType,
                content,
                combinedSource,
                factBase,
              });

              validation = {
                ...secondValidation,
                firstAttemptScore: firstScore,
                retried: true,
              };
            }

            const plainText = artefactToPlainText(outputType, content);
            const sha256 = hashNormalisedContent(plainText);
            const watermarkId = generateWatermarkId(sourceHash, outputType);
            const outputModeration = await runModerationAgent(plainText, 'output');

            const needsApproval =
              controls.requireHumanApproval ||
              !validation.available ||
              validation.score === null ||
              validation.score < 85 ||
              outputModeration.flagged;

            const finalArtefact: GeneratedArtefact = {
              type: outputType,
              status: 'done',
              content,
              plainText,
              sha256,
              watermarkId,
              validation,
              outputModeration,
              approvalStatus: needsApproval ? 'needs_approval' : 'approved',
              versions: [
                {
                  versionNumber: 1,
                  createdAt: new Date().toISOString(),
                  instruction: 'Initial generation',
                  content,
                  plainText,
                  sha256,
                  watermarkId,
                  validation,
                },
              ],
            };

            artefacts[outputType] = finalArtefact;
            sendEvent('artefact_update', {
              type: outputType,
              artefact: finalArtefact,
            });
          } catch (specErr) {
            const errMsg = (specErr as Error).message || `Failed to generate ${outputType}.`;
            const failedArtefact: GeneratedArtefact = {
              type: outputType,
              status: 'failed',
              error: errMsg,
              approvalStatus: 'needs_approval',
              versions: [],
            };
            artefacts[outputType] = failedArtefact;
            sendEvent('artefact_update', {
              type: outputType,
              artefact: failedArtefact,
            });
          }
        })
      );

      const completedOutputs = Object.values(artefacts).filter(
        (a): a is GeneratedArtefact => Boolean(a && a.status === 'done' && a.plainText)
      );
      const failedOutputs = Object.values(artefacts).filter(
        (a) => a && a.status === 'failed'
      );

      sendEvent('step_update', {
        stepId: 'specialists',
        status: failedOutputs.length === controls.selectedOutputs.length ? 'failed' : 'done',
        message: `${completedOutputs.length} of ${controls.selectedOutputs.length} format(s) generated.`,
      });

      sendEvent('step_update', {
        stepId: 'validation',
        status: completedOutputs.length > 0 ? 'done' : 'failed',
        message: `Validated ${completedOutputs.length} generated output(s) against the source.`,
      });

      // Step 7: Cross-output consistency check
      sendEvent('step_update', {
        stepId: 'consistency',
        status: 'running',
        message: 'Comparing numbers, dates, and claims across all generated formats...',
      });

      const consistency = await runConsistencyCheck(
        completedOutputs.map((a) => ({ type: a.type, plainText: a.plainText! })),
        factBase
      );

      sendEvent('consistency_ready', { consistency });
      sendEvent('step_update', {
        stepId: 'consistency',
        status: 'done',
        message: consistency.consistent
          ? 'All numbers and claims match across generated outputs.'
          : `${consistency.issues.length} cross-output discrepancy notice(s) flagged for review.`,
      });

      // Step 8: Provenance & Ledger Recording
      sendEvent('step_update', {
        stepId: 'provenance',
        status: 'running',
        message: 'Computing SHA-256 hashes, stamping watermarks, and appending to local ledger...',
      });

      let ledgerBlockIndex: number | undefined;
      let batchHash = '';

      if (completedOutputs.length > 0) {
        const block = appendToLedger({
          runId,
          runTitle: factBase.topic || 'Transformation Run',
          sourceHash,
          artefacts,
        });
        ledgerBlockIndex = block.index;
        batchHash = block.batchHash;
        sendEvent('ledger_recorded', { block });
      } else {
        batchHash = computeBatchHash(sourceHash, []);
      }

      sendEvent('step_update', {
        stepId: 'provenance',
        status: completedOutputs.length > 0 ? 'done' : 'failed',
        message:
          completedOutputs.length > 0
            ? `Recorded Block #${ledgerBlockIndex} in local SHA-256 hash chain.`
            : 'No completed outputs to record in ledger.',
      });

      const overallStatus =
        completedOutputs.length === 0
          ? 'failed'
          : failedOutputs.length > 0
          ? 'completed_with_errors'
          : 'completed';

      sendEvent('run_complete', {
        runId,
        title: factBase.topic || 'Transformation Run',
        status: overallStatus,
        sourceHash,
        batchHash,
        ledgerBlockIndex,
      });

      return res.end();
    } catch (err) {
      sendEvent('run_error', {
        step: 'pipeline',
        error: 'PIPELINE_ERROR',
        message: (err as Error).message || 'Unexpected error during pipeline execution.',
      });
      return res.end();
    }
  });

  // 9. Ledger Endpoints
  app.get('/api/ledger', (_req, res) => {
    const blocks = getLedger();
    const verification = verifyLedgerIntegrity();
    res.json({
      blocks,
      verification,
    });
  });

  app.get('/api/ledger/verify', (_req, res) => {
    const verification = verifyLedgerIntegrity();
    res.json(verification);
  });

  app.post('/api/ledger/record', (req, res) => {
    try {
      const { runId, runTitle, sourceHash, artefacts } = req.body;
      if (!runId || !sourceHash || !artefacts) {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'runId, sourceHash, and artefacts are required to record a ledger block.',
        });
      }
      const block = appendToLedger({
        runId,
        runTitle: runTitle || 'Transformation Run',
        sourceHash,
        artefacts,
      });
      return res.json({ ok: true, block });
    } catch (err) {
      return res.status(500).json({
        error: 'LEDGER_WRITE_ERROR',
        message: (err as Error).message || 'Failed to append run to ledger.',
      });
    }
  });

  // 10. POST /api/verify-hash
  app.post('/api/verify-hash', upload.single('file'), async (req, res) => {
    try {
      let contentToVerify = String(req.body?.content || '');
      if (req.file) {
        const extracted = await extractFromFile(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        );
        contentToVerify = extracted.text;
      }
      if (!contentToVerify.trim()) {
        return res.status(400).json({
          error: 'EMPTY_CONTENT',
          message: 'Paste content or upload a file to verify.',
        });
      }
      const result = verifyCandidateContent(contentToVerify);
      return res.json(result);
    } catch (err) {
      return res.status(422).json({
        error: 'VERIFY_ERROR',
        message: (err as Error).message || 'Verification failed.',
      });
    }
  });

  // 11. POST /api/export/:format
  app.post('/api/export/:format', async (req, res) => {
    try {
      const format = String(req.params.format || '').toLowerCase();

      if (format === 'zip') {
        const { runId, runTitle, sourceHash, batchHash, artefacts } = req.body;
        if (!runId || !artefacts) {
          return res.status(400).json({
            error: 'INVALID_REQUEST',
            message: 'Missing run data for ZIP export.',
          });
        }
        const zipBuf = await buildRunZipBuffer({
          runId,
          runTitle: runTitle || 'artefact-run',
          sourceHash: sourceHash || '',
          batchHash,
          artefacts,
        });
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="artefact-run-${runId.slice(0, 8)}.zip"`);
        return res.send(zipBuf);
      }

      const { type, content, watermarkId, sha256 } = req.body as {
        type: OutputType;
        content: any;
        watermarkId: string;
        sha256: string;
      };

      if (!type || !content || !watermarkId || !sha256) {
        return res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'type, content, watermarkId, and sha256 are required for export.',
        });
      }

      if (format === 'txt') {
        const txt = buildTxtExport(type, content, watermarkId, sha256);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="artefact-${type}.txt"`);
        return res.send(txt);
      }

      if (format === 'md') {
        const md = buildMarkdownExport(type, content, watermarkId, sha256);
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="artefact-${type}.md"`);
        return res.send(md);
      }

      if (format === 'json') {
        const json = buildJsonExport(type, content, watermarkId, sha256);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="artefact-${type}.json"`);
        return res.send(json);
      }

      if (format === 'srt') {
        const vid = content as VideoPackageOutput;
        const srtContent = `${vid.srtSubtitles || ''}\n`;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="artefact-subtitles.srt"');
        return res.send(srtContent);
      }

      if (format === 'svg') {
        const svg = buildInfographicSvg(content as InfographicOutput, watermarkId, sha256);
        res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="artefact-infographic.svg"');
        return res.send(svg);
      }

      if (format === 'docx') {
        const docxBuf = await buildDocxExport(type, content, watermarkId, sha256);
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
        res.setHeader('Content-Disposition', `attachment; filename="artefact-${type}.docx"`);
        return res.send(docxBuf);
      }

      if (format === 'pptx') {
        const pptxBuf = await buildPptxExport(content as PresentationOutput, watermarkId, sha256);
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        );
        res.setHeader('Content-Disposition', 'attachment; filename="artefact-presentation.pptx"');
        return res.send(pptxBuf);
      }

      if (format === 'pdf') {
        const pdfBuf = buildPdfExport(type, content, watermarkId, sha256);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="artefact-${type}.pdf"`);
        return res.send(pdfBuf);
      }

      return res.status(400).json({
        error: 'UNSUPPORTED_FORMAT',
        message: `Export format "${format}" is not supported.`,
      });
    } catch (err) {
      return res.status(500).json({
        error: 'EXPORT_FAILED',
        message: (err as Error).message || 'Export generation failed.',
      });
    }
  });

  // 12. Authentication and Account Data Endpoints
  function extractBearerToken(req: Request): string {
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7).trim();
    }
    return '';
  }

  app.post('/api/auth/signup', (req, res) => {
    try {
      const email = String(req.body?.email || '');
      const password = String(req.body?.password || '');
      const displayName = String(req.body?.displayName || '');
      const { user, token, account } = registerUser({ email, password, displayName });
      return res.json({
        ok: true,
        user,
        token,
        runs: account.runs,
        presets: account.presets,
        settings: account.settings || {},
      });
    } catch (err) {
      return res.status(400).json({
        error: 'SIGNUP_FAILED',
        message: (err as Error).message || 'Could not create account.',
      });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    try {
      const email = String(req.body?.email || '');
      const password = String(req.body?.password || '');
      const { user, token, account } = loginUser({ email, password });
      return res.json({
        ok: true,
        user,
        token,
        runs: account.runs,
        presets: account.presets,
        settings: account.settings || {},
      });
    } catch (err) {
      return res.status(401).json({
        error: 'LOGIN_FAILED',
        message: (err as Error).message || 'Invalid credentials.',
      });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = extractBearerToken(req);
    logoutSession(token);
    return res.json({ ok: true });
  });

  app.get('/api/auth/me', (req, res) => {
    const token = extractBearerToken(req);
    const account = getUserBySessionToken(token);
    if (!account) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Session expired or not authenticated.',
      });
    }
    return res.json({
      ok: true,
      user: toPublicUser(account),
      runs: account.runs,
      presets: account.presets,
      settings: account.settings || {},
    });
  });

  app.post('/api/auth/forgot-password', (req, res) => {
    try {
      const email = String(req.body?.email || '');
      const result = createPasswordResetToken(email);
      return res.json({
        ok: true,
        email: result.email,
        resetToken: result.resetToken,
        expiresAt: result.expiresAt,
        message: 'Password reset code generated. Use this code within 30 minutes to set a new password.',
      });
    } catch (err) {
      return res.status(400).json({
        error: 'RESET_REQUEST_FAILED',
        message: (err as Error).message || 'Could not generate password reset code.',
      });
    }
  });

  app.post('/api/auth/reset-password', (req, res) => {
    try {
      const email = String(req.body?.email || '');
      const resetToken = String(req.body?.resetToken || '');
      const newPassword = String(req.body?.newPassword || '');
      const user = resetPasswordWithToken({ email, resetToken, newPassword });
      return res.json({
        ok: true,
        user,
        message: 'Password updated. You can now sign in with your new password.',
      });
    } catch (err) {
      return res.status(400).json({
        error: 'RESET_FAILED',
        message: (err as Error).message || 'Could not reset password.',
      });
    }
  });

  app.put('/api/user/data', (req, res) => {
    const token = extractBearerToken(req);
    const account = getUserBySessionToken(token);
    if (!account) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required to save account data.',
      });
    }
    try {
      const updated = updateUserAccountData(account.id, {
        displayName: req.body?.displayName,
        runs: req.body?.runs,
        presets: req.body?.presets,
        settings: req.body?.settings,
      });
      return res.json({
        ok: true,
        user: toPublicUser(updated),
        runs: updated.runs,
        presets: updated.presets,
        settings: updated.settings || {},
      });
    } catch (err) {
      return res.status(400).json({
        error: 'UPDATE_FAILED',
        message: (err as Error).message || 'Failed to update user account data.',
      });
    }
  });

  // Vite middleware in development, static dist serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Artefact.AI server running on http://0.0.0.0:${PORT} (Model: ${MODEL})`);
    void checkConfiguredModelHealth(true).then((mh) => {
      console.log(`[Startup Model Check] model=${mh.model} working=${mh.modelWorking} status=${mh.modelStatus} msg="${mh.modelMessage}"`);
    });
  });
}

startServer();
