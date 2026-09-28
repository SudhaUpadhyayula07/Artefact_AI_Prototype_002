import * as cheerio from 'cheerio';
import dns from 'dns';
import mammoth from 'mammoth';
import net from 'net';
import { MODEL } from './config.ts';
import {
  buildMediaPart,
  callGeminiWithBackoff,
  stripEmDashesDeep,
} from './gemini.ts';

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_URL_BYTES = 4 * 1024 * 1024; // 4 MB
const URL_TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 3;

function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map((n) => parseInt(n, 10));
    if (parts.length !== 4 || parts.some((n) => isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
    if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a >= 224) return true; // Multicast & reserved
    return false;
  }

  if (net.isIPv6(ip)) {
    const norm = ip.toLowerCase();
    if (norm === '::1' || norm === '::' || norm === '0:0:0:0:0:0:0:1') return true;
    if (norm.startsWith('fe80:') || norm.startsWith('fe90:') || norm.startsWith('fea0:') || norm.startsWith('feb0:')) {
      return true; // link-local
    }
    if (norm.startsWith('fc') || norm.startsWith('fd')) {
      return true; // unique local address
    }
    if (norm.startsWith('::ffff:')) {
      const v4Part = norm.slice(7);
      if (net.isIPv4(v4Part)) return isPrivateOrReservedIp(v4Part);
    }
    return false;
  }

  return true;
}

async function assertSafeUrlTarget(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL format. Include http:// or https://.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS URLs are permitted.');
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === 'metadata.google.internal'
  ) {
    throw new Error('URL target is blocked by SSRF security policy (local or internal host).');
  }

  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new Error('URL target IP is blocked by SSRF security policy (private, loopback, or link-local range).');
    }
    return parsed;
  }

  let records: dns.LookupAddress[];
  try {
    records = await dns.promises.lookup(hostname, { all: true });
  } catch {
    throw new Error(`Could not resolve domain name: ${hostname}`);
  }

  if (!records || records.length === 0) {
    throw new Error(`No DNS records found for domain: ${hostname}`);
  }

  for (const rec of records) {
    if (isPrivateOrReservedIp(rec.address)) {
      throw new Error('Domain resolves to a private, loopback, or reserved IP range and is blocked.');
    }
  }

  return parsed;
}

export async function extractFromUrl(rawUrl: string): Promise<{
  text: string;
  title: string;
  method: string;
}> {
  let currentUrl = rawUrl.trim();
  let redirects = 0;

  while (true) {
    const validatedUrl = await assertSafeUrlTarget(currentUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), URL_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(validatedUrl.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'ArtefactAI-Extractor/1.0',
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5',
        },
      });
    } catch (err) {
      clearTimeout(timer);
      const msg = (err as Error).name === 'AbortError' ? 'Request timed out after 10 seconds.' : (err as Error).message;
      throw new Error(`Failed to fetch URL: ${msg}`);
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) {
        throw new Error(`URL returned redirect (${res.status}) with no Location header.`);
      }
      redirects++;
      if (redirects > MAX_REDIRECTS) {
        throw new Error(`Too many redirects (maximum ${MAX_REDIRECTS} allowed).`);
      }
      currentUrl = new URL(location, validatedUrl).toString();
      continue;
    }

    if (!res.ok) {
      throw new Error(`Remote server returned HTTP ${res.status} (${res.statusText}).`);
    }

    const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_URL_BYTES) {
      throw new Error('Remote page exceeds the 4 MB size limit.');
    }

    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error('Unable to read response stream from URL.');
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > MAX_URL_BYTES) {
          await reader.cancel();
          throw new Error('Remote page response exceeded the 4 MB size cap.');
        }
        chunks.push(value);
      }
    }

    const rawHtml = Buffer.concat(chunks).toString('utf8');
    const contentType = (res.headers.get('content-type') || '').toLowerCase();

    if (contentType.includes('text/plain')) {
      const clean = stripEmDashesDeep(rawHtml.trim());
      if (clean.length < 20) {
        throw new Error('The URL returned almost no readable text. Please paste the text directly.');
      }
      return {
        text: clean,
        title: validatedUrl.hostname,
        method: 'Plain text URL fetch',
      };
    }

    const $ = cheerio.load(rawHtml);
    $('script, style, noscript, iframe, svg, canvas, nav, footer, aside, form, button, header').remove();

    const pageTitle =
      $('meta[property="og:title"]').attr('content')?.trim() ||
      $('title').first().text().trim() ||
      $('h1').first().text().trim() ||
      validatedUrl.hostname;

    const metaDesc =
      $('meta[name="description"]').attr('content')?.trim() ||
      $('meta[property="og:description"]').attr('content')?.trim() ||
      '';

    // Prefer article or main container
    let rootSelector = 'body';
    if ($('article').length > 0 && $('article').text().trim().length > 200) {
      rootSelector = 'article';
    } else if ($('main').length > 0 && $('main').text().trim().length > 200) {
      rootSelector = 'main';
    }

    const blocks: string[] = [];
    if (pageTitle) blocks.push(`Title: ${pageTitle}`);
    if (metaDesc) blocks.push(`Summary: ${metaDesc}`);

    $(rootSelector)
      .find('h1, h2, h3, h4, p, li, blockquote, pre')
      .each((_, el) => {
        const text = $(el).text().replace(/\s+/g, ' ').trim();
        if (text.length >= 25 && !blocks.includes(text)) {
          blocks.push(text);
        }
      });

    let extracted = blocks.join('\n\n').trim();
    if (extracted.length < 120) {
      // Fallback to body text
      extracted = $('body').text().replace(/\s+/g, ' ').trim();
    }

    extracted = stripEmDashesDeep(extracted);

    if (extracted.length < 40) {
      throw new Error(
        'Could not extract readable article text from this URL (it may require client-side JavaScript). Please paste the text directly.'
      );
    }

    return {
      text: extracted,
      title: stripEmDashesDeep(pageTitle),
      method: 'Readability HTML extraction',
    };
  }
}

async function extractPdfBuffer(buffer: Buffer, originalName: string): Promise<{ text: string; method: string }> {
  let parsedText = '';
  try {
    const pdfParseModule = await import('pdf-parse');
    // Handle both v1 function default export and v2 PDFParse class
    const modAny = pdfParseModule as Record<string, unknown>;
    if (typeof modAny.PDFParse === 'function') {
      const ParserClass = modAny.PDFParse as new (opts: { data: Buffer }) => {
        getText: () => Promise<{ text: string }>;
        destroy?: () => Promise<void>;
      };
      const parser = new ParserClass({ data: buffer });
      const res = await parser.getText();
      parsedText = (res?.text || '').trim();
      if (typeof parser.destroy === 'function') {
        await parser.destroy();
      }
    } else if (typeof modAny.default === 'function') {
      const fn = modAny.default as (buf: Buffer) => Promise<{ text: string }>;
      const res = await fn(buffer);
      parsedText = (res?.text || '').trim();
    }
  } catch {
    // Will fall back to Gemini OCR below
  }

  const compactLength = parsedText.replace(/\s+/g, '').length;
  if (compactLength >= 50) {
    return {
      text: stripEmDashesDeep(parsedText),
      method: 'PDF text layer extraction',
    };
  }

  // Scanned or empty PDF fallback: Gemini OCR / document reading
  const { part, cleanup } = await buildMediaPart(buffer, 'application/pdf', originalName);
  try {
    const response = await callGeminiWithBackoff({
      model: MODEL,
      contents: {
        parts: [
          part,
          {
            text: 'Extract all visible text, headings, tables, and factual figures from this PDF document verbatim. Do not invent anything. Do not use em dashes.',
          },
        ],
      },
    });
    const ocrText = stripEmDashesDeep((response.text || '').trim());
    if (ocrText.length < 15) {
      throw new Error(
        'This PDF appears to be empty or unreadable even with OCR. Please paste the text directly.'
      );
    }
    return {
      text: ocrText,
      method: 'Gemini PDF OCR reading',
    };
  } finally {
    await cleanup();
  }
}

export async function extractFromFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<{
  text: string;
  title: string;
  method: string;
}> {
  if (!buffer || buffer.length === 0) {
    throw new Error('The uploaded file is empty. Please choose a valid file or paste the text directly.');
  }
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error('File exceeds the 25 MB limit. Please upload a file under 25 MB.');
  }

  const lowerName = originalName.toLowerCase();
  const lowerMime = (mimeType || '').toLowerCase();

  // 1. Plain text files
  if (
    lowerMime.startsWith('text/') ||
    lowerName.endsWith('.txt') ||
    lowerName.endsWith('.md') ||
    lowerName.endsWith('.csv')
  ) {
    const text = stripEmDashesDeep(buffer.toString('utf8').trim());
    if (text.length < 5) {
      throw new Error('The text file contains no readable content. Please paste the text directly.');
    }
    return {
      text,
      title: originalName,
      method: 'Direct UTF-8 text read',
    };
  }

  // 2. DOCX files
  if (
    lowerMime.includes('wordprocessingml') ||
    lowerName.endsWith('.docx')
  ) {
    const result = await mammoth.extractRawText({ buffer });
    const text = stripEmDashesDeep((result.value || '').trim());
    if (text.length < 10) {
      throw new Error('No readable text could be extracted from this DOCX file. Please paste the text directly.');
    }
    return {
      text,
      title: originalName,
      method: 'DOCX document text extraction',
    };
  }

  // 3. PDF files
  if (lowerMime === 'application/pdf' || lowerName.endsWith('.pdf')) {
    const { text, method } = await extractPdfBuffer(buffer, originalName);
    return {
      text,
      title: originalName,
      method,
    };
  }

  // 4. Images (PNG, JPG, WEBP)
  if (
    lowerMime.startsWith('image/') ||
    lowerName.endsWith('.png') ||
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.jpeg') ||
    lowerName.endsWith('.webp')
  ) {
    const resolvedMime = lowerMime.startsWith('image/')
      ? lowerMime
      : lowerName.endsWith('.png')
      ? 'image/png'
      : lowerName.endsWith('.webp')
      ? 'image/webp'
      : 'image/jpeg';

    const { part, cleanup } = await buildMediaPart(buffer, resolvedMime, originalName);
    try {
      const response = await callGeminiWithBackoff({
        model: MODEL,
        contents: {
          parts: [
            part,
            {
              text: 'Read this image carefully. Provide: 1) Every piece of visible text, label, number, and chart value verbatim. 2) A concise, strictly factual description of what is shown. Do not guess or invent unseen details. Do not use em dashes.',
            },
          ],
        },
      });
      const out = stripEmDashesDeep((response.text || '').trim());
      if (out.length < 10) {
        throw new Error('No readable text or visual detail could be extracted from this image. Please paste the text directly.');
      }
      return {
        text: out,
        title: originalName,
        method: 'Gemini Vision OCR & factual description',
      };
    } finally {
      await cleanup();
    }
  }

  // 5. Audio files
  if (
    lowerMime.startsWith('audio/') ||
    lowerName.endsWith('.mp3') ||
    lowerName.endsWith('.wav') ||
    lowerName.endsWith('.m4a') ||
    lowerName.endsWith('.ogg') ||
    lowerName.endsWith('.flac') ||
    lowerName.endsWith('.aac')
  ) {
    const resolvedMime = lowerMime.startsWith('audio/')
      ? lowerMime
      : lowerName.endsWith('.wav')
      ? 'audio/wav'
      : lowerName.endsWith('.ogg')
      ? 'audio/ogg'
      : lowerName.endsWith('.m4a')
      ? 'audio/mp4'
      : 'audio/mp3';

    const { part, cleanup } = await buildMediaPart(buffer, resolvedMime, originalName);
    try {
      const response = await callGeminiWithBackoff({
        model: MODEL,
        contents: {
          parts: [
            part,
            {
              text: 'Transcribe this audio accurately word for word. Do not add commentary or invent details. Do not use em dashes.',
            },
          ],
        },
      });
      const out = stripEmDashesDeep((response.text || '').trim());
      if (out.length < 5) {
        throw new Error('No speech or transcript could be extracted from this audio file. Please paste the text directly.');
      }
      return {
        text: out,
        title: originalName,
        method: 'Gemini Audio Transcription',
      };
    } finally {
      await cleanup();
    }
  }

  // 6. Video files
  if (
    lowerMime.startsWith('video/') ||
    lowerName.endsWith('.mp4') ||
    lowerName.endsWith('.webm') ||
    lowerName.endsWith('.mov') ||
    lowerName.endsWith('.mkv')
  ) {
    const resolvedMime = lowerMime.startsWith('video/')
      ? lowerMime
      : lowerName.endsWith('.webm')
      ? 'video/webm'
      : lowerName.endsWith('.mov')
      ? 'video/quicktime'
      : 'video/mp4';

    const { part, cleanup } = await buildMediaPart(buffer, resolvedMime, originalName);
    try {
      const response = await callGeminiWithBackoff({
        model: MODEL,
        contents: {
          parts: [
            part,
            {
              text: 'Process this video and return two clearly labelled sections:\n1. Transcript: full spoken audio and any visible on-screen text.\n2. Scene-by-Scene Summary: factual description of each scene with timestamps.\nDo not invent details. Do not use em dashes.',
            },
          ],
        },
      });
      const out = stripEmDashesDeep((response.text || '').trim());
      if (out.length < 10) {
        throw new Error('Could not extract transcript or scenes from this video file. Please paste the text directly.');
      }
      return {
        text: out,
        title: originalName,
        method: 'Gemini Video Transcript & Scene Analysis',
      };
    } finally {
      await cleanup();
    }
  }

  throw new Error(
    `Unsupported file type (${originalName}). Supported inputs: PDF, DOCX, TXT, PNG, JPG, WEBP, Audio (MP3/WAV/M4A/OGG), and Video (MP4/WEBM/MOV).`
  );
}
