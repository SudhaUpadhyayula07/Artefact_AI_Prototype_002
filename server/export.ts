import {
  Document,
  Footer,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import type {
  AdvisoryOutput,
  ExecutiveSummaryOutput,
  GeneratedArtefact,
  InfographicOutput,
  LinkedInOutput,
  OutputContentMap,
  OutputType,
  PresentationOutput,
  TwitterOutput,
  VideoPackageOutput,
} from '../src/types/artefact.ts';
import {
  artefactToPlainText,
  encodeZeroWidthWatermark,
} from './provenance.ts';

function xmlEscape(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildMarkdownExport<K extends OutputType>(
  type: K,
  content: OutputContentMap[K],
  watermarkId: string,
  sha256: string
): string {
  const zw = encodeZeroWidthWatermark(watermarkId);
  const footer = `\n\n---\nProvenance Watermark ID: ${watermarkId} | SHA-256: ${sha256}${zw}`;

  switch (type) {
    case 'linkedin': {
      const c = content as LinkedInOutput;
      return `# LinkedIn Post\n\n**${c.hook}**\n\n${c.body}\n\n${c.callToAction}\n\n${c.hashtags
        .map((h) => (h.startsWith('#') ? h : `#${h}`))
        .join(' ')}${footer}`;
    }
    case 'twitter': {
      const c = content as TwitterOutput;
      const body = c.tweets
        .map((t, i) => `### Tweet ${i + 1} (${t.length}/280 chars)\n\n${t}`)
        .join('\n\n');
      return `# Twitter / X Thread\n\n${body}${footer}`;
    }
    case 'advisory': {
      const c = content as AdvisoryOutput;
      const actions = c.recommendedActions
        .map((a) => `- **[${a.priority} | ${a.timeline}]** ${a.action}`)
        .join('\n');
      const refs =
        c.references.length > 0
          ? `\n\n## References\n${c.references.map((r) => `- ${r}`).join('\n')}`
          : '';
      return `# ${c.title}\n\n**Reference ID:** ${c.referenceId} | **Date:** ${c.date} | **Audience:** ${c.audience}\n\n## Summary\n${c.summary}\n\n## Background\n${c.background}\n\n## Key Findings\n${c.keyFindings
        .map((f) => `- ${f}`)
        .join('\n')}\n\n## Impact\n${c.impact}\n\n## Recommended Actions\n${actions}${refs}${footer}`;
    }
    case 'infographic': {
      const c = content as InfographicOutput;
      const stats = c.statistics
        .map((s) => `- **${s.value}** - ${s.label} (${s.context})`)
        .join('\n');
      const secs = c.sections
        .map((s) => `### ${s.title}\n${s.summary}`)
        .join('\n\n');
      return `# ${c.headline}\n\n*${c.subtitle}*\n\n## Key Messages\n${c.keyMessages
        .map((m) => `- ${m}`)
        .join('\n')}\n\n## Highlighted Statistics\n${stats}\n\n## Sections\n${secs}\n\n**Call to Action:** ${
        c.callToAction
      }\n\n## Readable Summary\n${c.readableTextVersion}${footer}`;
    }
    case 'executive_summary': {
      const c = content as ExecutiveSummaryOutput;
      return `# ${c.title}\n\n**Date:** ${c.date} | **Audience:** ${c.audience}\n\n## Bottom Line Up Front\n${c.bottomLine}\n\n## Key Points\n${c.keyPoints
        .map((p) => `- ${p}`)
        .join('\n')}\n\n## Implications\n${c.implications
        .map((p) => `- ${p}`)
        .join('\n')}\n\n## Decision Needed / Next Steps\n${c.decisionNeededOrNextSteps
        .map((p) => `- ${p}`)
        .join('\n')}${footer}`;
    }
    case 'presentation': {
      const c = content as PresentationOutput;
      const slides = c.slides
        .map(
          (s) =>
            `## Slide ${s.slideNumber}: ${s.title}\n\n${s.bullets
              .map((b) => `- ${b}`)
              .join('\n')}\n\n*Visual Suggestion:* ${
              s.visualSuggestion
            }\n\n*Speaker Notes:* ${s.speakerNotes}`
        )
        .join('\n\n---\n\n');
      return `# ${c.title}\n\n*${c.subtitle}*\n\n${slides}${footer}`;
    }
    case 'video_package': {
      const c = content as VideoPackageOutput;
      const scenes = c.scenes
        .map(
          (s) =>
            `### Scene ${s.sceneNumber} (${s.startTime} - ${s.endTime}, ${s.durationSeconds}s)\n- **Visual:** ${s.sceneDescription}\n- **On-Screen Text:** ${s.onScreenText}\n- **Narration:** ${s.narrationText}\n- **Visual Recommendation:** ${s.visualRecommendation}\n- **Audio Notes:** ${s.audioNotes}`
        )
        .join('\n\n');
      return `# ${c.title}\n\n**Target Duration:** ${c.targetDuration} | **Platform:** ${c.platform}\n\n## Script Summary\n${c.scriptSummary}\n\n## Storyboard & Script\n${scenes}\n\n## Music & Sound Notes\n${c.musicAndSoundNotes}\n\n## Timed Subtitles (SRT)\n\`\`\`srt\n${c.srtSubtitles}\n\`\`\`${footer}`;
    }
  }
}

export function buildTxtExport<K extends OutputType>(
  type: K,
  content: OutputContentMap[K],
  watermarkId: string,
  sha256: string
): string {
  const plain = artefactToPlainText(type, content);
  const zw = encodeZeroWidthWatermark(watermarkId);
  return `${plain}${zw}\n\n---\nProvenance Watermark ID: ${watermarkId} | SHA-256: ${sha256}`;
}

export function buildJsonExport<K extends OutputType>(
  type: K,
  content: OutputContentMap[K],
  watermarkId: string,
  sha256: string
): string {
  return JSON.stringify(
    {
      artefactType: type,
      provenance: {
        watermarkId,
        sha256,
        exportedAt: new Date().toISOString(),
      },
      content,
    },
    null,
    2
  );
}

export function buildInfographicSvg(
  info: InfographicOutput,
  watermarkId: string,
  sha256: string
): string {
  const stats = (info.statistics || []).slice(0, 6);
  const sections = (info.sections || []).slice(0, 6);
  const statRows = Math.ceil(Math.max(1, stats.length) / 3);
  const totalHeight = 320 + statRows * 140 + sections.length * 125 + 160;

  let statsSvg = '';
  stats.forEach((stat, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const x = 48 + col * 372;
    const y = 210 + row * 135;
    statsSvg += `
      <g transform="translate(${x}, ${y})">
        <rect width="348" height="115" rx="8" fill="#FFFFFF" stroke="#E8E2F7" stroke-width="1.5" />
        <rect x="0" y="0" width="6" height="115" rx="3" fill="#5E60CE" />
        <text x="24" y="46" font-family="Poppins, Inter, sans-serif" font-weight="800" font-size="26" fill="#5E60CE">${xmlEscape(
          stat.value.slice(0, 22)
        )}</text>
        <text x="24" y="74" font-family="Inter, sans-serif" font-weight="600" font-size="14" fill="#1C192E">${xmlEscape(
          stat.label.slice(0, 42)
        )}</text>
        <text x="24" y="96" font-family="Inter, sans-serif" font-weight="400" font-size="12" fill="#534D72">${xmlEscape(
          stat.context.slice(0, 52)
        )}</text>
      </g>
    `;
  });

  const sectionsStartY = 225 + statRows * 135;
  let sectionsSvg = '';
  sections.forEach((sec, idx) => {
    const y = sectionsStartY + idx * 120;
    const summaryLine1 = sec.summary.slice(0, 115);
    const summaryLine2 = sec.summary.slice(115, 230);
    sectionsSvg += `
      <g transform="translate(48, ${y})">
        <rect width="1104" height="104" rx="8" fill="#FFFFFF" stroke="#E8E2F7" stroke-width="1.5" />
        <rect x="20" y="22" width="44" height="44" rx="8" fill="#F8F6FF" stroke="#B794F4" stroke-width="1.5" />
        <text x="42" y="50" text-anchor="middle" font-family="Poppins, sans-serif" font-weight="800" font-size="16" fill="#5E60CE">0${
          idx + 1
        }</text>
        <text x="84" y="40" font-family="Poppins, Inter, sans-serif" font-weight="800" font-size="17" fill="#1C192E">${xmlEscape(
          sec.title.slice(0, 80)
        )}</text>
        <text x="84" y="66" font-family="Inter, sans-serif" font-weight="400" font-size="13" fill="#534D72">${xmlEscape(
          summaryLine1
        )}</text>
        ${
          summaryLine2
            ? `<text x="84" y="86" font-family="Inter, sans-serif" font-weight="400" font-size="13" fill="#534D72">${xmlEscape(
                summaryLine2
              )}</text>`
            : ''
        }
      </g>
    `;
  });

  const ctaY = sectionsStartY + sections.length * 120 + 16;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 ${totalHeight}" width="1200" height="${totalHeight}" fill="none">
  <metadata>Artefact.AI Watermark ID: ${xmlEscape(watermarkId)} | SHA-256: ${xmlEscape(sha256)}</metadata>
  <rect width="1200" height="${totalHeight}" fill="#F8F6FF" />

  <!-- Header Banner (Flat #5E60CE) -->
  <rect x="48" y="36" width="1104" height="148" rx="8" fill="#5E60CE" />
  <rect x="1108" y="52" width="24" height="24" rx="4" fill="#E0AAFF" />
  <text x="80" y="96" font-family="Poppins, Inter, sans-serif" font-weight="800" font-size="28" fill="#FFFFFF">${xmlEscape(
    info.headline.slice(0, 68)
  )}</text>
  <text x="80" y="132" font-family="Inter, sans-serif" font-weight="500" font-size="15" fill="#E0AAFF">${xmlEscape(
    info.subtitle.slice(0, 105)
  )}</text>
  <text x="80" y="162" font-family="JetBrains Mono, monospace" font-weight="400" font-size="11" fill="#FFFFFF">WATERMARK: ${xmlEscape(
    watermarkId
  )}</text>

  <!-- Statistics Grid -->
  ${statsSvg}

  <!-- Content Sections -->
  ${sectionsSvg}

  <!-- Call to Action Footer Box -->
  <g transform="translate(48, ${ctaY})">
    <rect width="1104" height="76" rx="8" fill="#1C192E" />
    <text x="28" y="34" font-family="Poppins, Inter, sans-serif" font-weight="800" font-size="15" fill="#E0AAFF">ACTION SUMMARY</text>
    <text x="28" y="56" font-family="Inter, sans-serif" font-weight="400" font-size="13" fill="#FFFFFF">${xmlEscape(
      info.callToAction.slice(0, 120)
    )}</text>
  </g>

  <!-- Provenance Footer -->
  <text x="48" y="${
    totalHeight - 22
  }" font-family="JetBrains Mono, monospace" font-size="11" fill="#534D72">PROVENANCE WATERMARK: ${xmlEscape(
    watermarkId
  )} | SHA-256: ${xmlEscape(sha256)}</text>
</svg>`;
}

export async function buildDocxExport<K extends OutputType>(
  type: K,
  content: OutputContentMap[K],
  watermarkId: string,
  sha256: string
): Promise<Buffer> {
  const children: Paragraph[] = [];

  const addHeading = (text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) => {
    children.push(
      new Paragraph({
        text,
        heading: level,
        spacing: { before: 240, after: 120 },
      })
    );
  };

  const addBody = (text: string, boldPrefix?: string) => {
    const runs: TextRun[] = [];
    if (boldPrefix) {
      runs.push(new TextRun({ text: `${boldPrefix} `, bold: true, size: 22 }));
    }
    runs.push(new TextRun({ text, size: 22 }));
    children.push(new Paragraph({ children: runs, spacing: { after: 140 } }));
  };

  const addBullet = (text: string) => {
    children.push(
      new Paragraph({
        children: [new TextRun({ text, size: 22 })],
        bullet: { level: 0 },
        spacing: { after: 80 },
      })
    );
  };

  if (type === 'advisory') {
    const c = content as AdvisoryOutput;
    addHeading(c.title, HeadingLevel.HEADING_1);
    addBody(`Reference ID: ${c.referenceId} | Date: ${c.date} | Audience: ${c.audience}`);
    addHeading('Executive Summary', HeadingLevel.HEADING_2);
    addBody(c.summary);
    addHeading('Background', HeadingLevel.HEADING_2);
    addBody(c.background);
    addHeading('Key Findings', HeadingLevel.HEADING_2);
    c.keyFindings.forEach((f) => addBullet(f));
    addHeading('Operational Impact', HeadingLevel.HEADING_2);
    addBody(c.impact);
    addHeading('Recommended Actions', HeadingLevel.HEADING_2);
    c.recommendedActions.forEach((a) =>
      addBullet(`[${a.priority} | ${a.timeline}] ${a.action}`)
    );
    if (c.references.length > 0) {
      addHeading('References', HeadingLevel.HEADING_2);
      c.references.forEach((r) => addBullet(r));
    }
  } else if (type === 'executive_summary') {
    const c = content as ExecutiveSummaryOutput;
    addHeading(c.title, HeadingLevel.HEADING_1);
    addBody(`Date: ${c.date} | Audience: ${c.audience}`);
    addHeading('Bottom Line Up Front', HeadingLevel.HEADING_2);
    addBody(c.bottomLine);
    addHeading('Key Points', HeadingLevel.HEADING_2);
    c.keyPoints.forEach((p) => addBullet(p));
    addHeading('Implications', HeadingLevel.HEADING_2);
    c.implications.forEach((p) => addBullet(p));
    addHeading('Decision Needed / Next Steps', HeadingLevel.HEADING_2);
    c.decisionNeededOrNextSteps.forEach((p) => addBullet(p));
  } else if (type === 'video_package') {
    const c = content as VideoPackageOutput;
    addHeading(c.title, HeadingLevel.HEADING_1);
    addBody(`Target Duration: ${c.targetDuration} | Platform: ${c.platform}`);
    addHeading('Script Summary', HeadingLevel.HEADING_2);
    addBody(c.scriptSummary);
    addHeading('Storyboard & Scene Script', HeadingLevel.HEADING_2);
    c.scenes.forEach((s) => {
      addHeading(
        `Scene ${s.sceneNumber} (${s.startTime} - ${s.endTime}, ${s.durationSeconds}s)`,
        HeadingLevel.HEADING_3
      );
      addBody(s.sceneDescription, 'Scene Description:');
      addBody(s.onScreenText, 'On-Screen Text:');
      addBody(s.narrationText, 'Narration:');
      addBody(s.visualRecommendation, 'Visual Recommendation:');
      addBody(s.audioNotes, 'Audio Notes:');
    });
    addHeading('Music & Sound Notes', HeadingLevel.HEADING_2);
    addBody(c.musicAndSoundNotes);
  } else {
    const plain = artefactToPlainText(type, content);
    addHeading(`Artefact.AI Output (${type})`, HeadingLevel.HEADING_1);
    plain.split('\n\n').forEach((para) => addBody(para));
  }

  // Add provenance section
  addHeading('Provenance & Verification', HeadingLevel.HEADING_2);
  addBody(`Watermark ID: ${watermarkId}`);
  addBody(`SHA-256 Fingerprint: ${sha256}`);

  const doc = new Document({
    title: `Artefact.AI - ${type}`,
    subject: `Watermark ID: ${watermarkId}`,
    creator: 'Artefact.AI',
    description: `Provenance Watermark ID: ${watermarkId} | SHA-256: ${sha256}`,
    sections: [
      {
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Artefact.AI Provenance Watermark: ${watermarkId} | SHA-256: ${sha256.slice(
                      0,
                      24
                    )}...`,
                    size: 16,
                    color: '534D72',
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

export async function buildPptxExport(
  presData: PresentationOutput,
  watermarkId: string,
  sha256: string
): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.title = presData.title;
  pptx.subject = `Watermark ID: ${watermarkId} | SHA-256: ${sha256}`;
  pptx.company = 'Artefact.AI';

  // Title Slide
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: 'F8F6FF' };
  titleSlide.addShape(pptx.ShapeType.rect, {
    x: 0.5,
    y: 0.6,
    w: 9.0,
    h: 3.6,
    fill: { color: '5E60CE' },
  });
  titleSlide.addText(presData.title, {
    x: 0.8,
    y: 1.1,
    w: 8.4,
    h: 1.5,
    fontSize: 28,
    bold: true,
    color: 'FFFFFF',
    fontFace: 'Arial',
  });
  titleSlide.addText(presData.subtitle || '', {
    x: 0.8,
    y: 2.7,
    w: 8.4,
    h: 1.0,
    fontSize: 16,
    color: 'E0AAFF',
    fontFace: 'Arial',
  });
  titleSlide.addText(`Provenance Watermark ID: ${watermarkId} | SHA-256: ${sha256}`, {
    x: 0.5,
    y: 4.9,
    w: 9.0,
    h: 0.4,
    fontSize: 9,
    color: '534D72',
    fontFace: 'Courier New',
  });

  // Content Slides
  for (const s of presData.slides) {
    const slide = pptx.addSlide();
    slide.background = { color: 'F8F6FF' };

    // Top bar
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.5,
      y: 0.4,
      w: 9.0,
      h: 0.75,
      fill: { color: '5E60CE' },
    });

    slide.addText(`Slide ${s.slideNumber}: ${s.title}`, {
      x: 0.7,
      y: 0.5,
      w: 8.6,
      h: 0.55,
      fontSize: 18,
      bold: true,
      color: 'FFFFFF',
      fontFace: 'Arial',
    });

    const bulletItems = (s.bullets || []).map((b) => ({
      text: b,
      options: { bullet: true, breakLine: true, fontSize: 14, color: '1C192E' },
    }));

    slide.addText(bulletItems, {
      x: 0.6,
      y: 1.35,
      w: 8.8,
      h: 2.7,
      valign: 'top',
      fontFace: 'Arial',
    });

    slide.addShape(pptx.ShapeType.rect, {
      x: 0.6,
      y: 4.2,
      w: 8.8,
      h: 0.65,
      fill: { color: 'FFFFFF' },
      line: { color: 'E8E2F7', pt: 1 },
    });

    slide.addText(`Visual Note: ${s.visualSuggestion}`, {
      x: 0.75,
      y: 4.28,
      w: 8.5,
      h: 0.5,
      fontSize: 11,
      italic: true,
      color: '534D72',
      fontFace: 'Arial',
    });

    slide.addText(`Watermark: ${watermarkId} | SHA-256: ${sha256.slice(0, 20)}...`, {
      x: 0.6,
      y: 5.05,
      w: 8.8,
      h: 0.3,
      fontSize: 8,
      color: '534D72',
      fontFace: 'Courier New',
    });

    if (s.speakerNotes) {
      slide.addNotes(`${s.speakerNotes}\n\nProvenance Watermark ID: ${watermarkId}`);
    }
  }

  const out = await pptx.write({ outputType: 'nodebuffer' });
  return Buffer.from(out as ArrayBuffer);
}

export function buildPdfExport<K extends OutputType>(
  type: K,
  content: OutputContentMap[K],
  watermarkId: string,
  sha256: string
): Buffer {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  doc.setProperties({
    title: `Artefact.AI - ${type}`,
    subject: `Watermark ID: ${watermarkId}`,
    creator: 'Artefact.AI',
    keywords: `${watermarkId}, ${sha256}`,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;
  const maxWidth = pageWidth - margin * 2;
  let y = 52;

  const drawFooter = () => {
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(83, 77, 114);
    doc.text(
      `Provenance Watermark ID: ${watermarkId} | SHA-256: ${sha256}`,
      margin,
      pageHeight - 24
    );
  };

  // Header bar
  doc.setFillColor(94, 96, 206); // #5E60CE
  doc.rect(margin, y - 18, maxWidth, 36, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(`ARTEFACT.AI - ${type.replace('_', ' ').toUpperCase()}`, margin + 12, y + 4);
  y += 38;

  const plain = artefactToPlainText(type, content);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(28, 25, 46);

  const lines = doc.splitTextToSize(plain, maxWidth);
  for (const line of lines) {
    if (y > pageHeight - 54) {
      drawFooter();
      doc.addPage();
      y = 52;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      doc.setTextColor(28, 25, 46);
    }
    doc.text(String(line), margin, y);
    y += 15;
  }

  drawFooter();
  const arrayBuf = doc.output('arraybuffer');
  return Buffer.from(arrayBuf);
}

export async function buildRunZipBuffer(params: {
  runId: string;
  runTitle: string;
  sourceHash: string;
  batchHash?: string;
  artefacts: Partial<Record<OutputType, GeneratedArtefact>>;
}): Promise<Buffer> {
  const zip = new JSZip();

  const provenanceManifest = {
    runId: params.runId,
    runTitle: params.runTitle,
    exportedAt: new Date().toISOString(),
    sourceBundleSha256: params.sourceHash,
    batchSha256: params.batchHash || '',
    ledgerScopeNotice:
      'Artefact.AI records hashes in a local tamper-evident SHA-256 hash chain (data/ledger.json), not a public blockchain.',
    outputs: {} as Record<
      string,
      {
        watermarkId: string;
        sha256: string;
        validationScore: number | null;
        approvalStatus: string;
      }
    >,
  };

  for (const [typeKey, art] of Object.entries(params.artefacts)) {
    const type = typeKey as OutputType;
    if (!art || art.status !== 'done' || !art.content || !art.watermarkId || !art.sha256) {
      continue;
    }

    provenanceManifest.outputs[type] = {
      watermarkId: art.watermarkId,
      sha256: art.sha256,
      validationScore: art.validation?.score ?? null,
      approvalStatus: art.approvalStatus,
    };

    const folder = zip.folder(type);
    if (!folder) continue;

    // Always include TXT, MD, JSON for every completed output
    folder.file(
      `${type}.txt`,
      buildTxtExport(type, art.content as any, art.watermarkId, art.sha256)
    );
    folder.file(
      `${type}.md`,
      buildMarkdownExport(type, art.content as any, art.watermarkId, art.sha256)
    );
    folder.file(
      `${type}.json`,
      buildJsonExport(type, art.content as any, art.watermarkId, art.sha256)
    );

    if (type === 'advisory' || type === 'executive_summary' || type === 'video_package') {
      const docxBuf = await buildDocxExport(type, art.content as any, art.watermarkId, art.sha256);
      folder.file(`${type}.docx`, docxBuf);
    }

    if (type === 'advisory' || type === 'executive_summary' || type === 'presentation') {
      const pdfBuf = buildPdfExport(type, art.content as any, art.watermarkId, art.sha256);
      folder.file(`${type}.pdf`, pdfBuf);
    }

    if (type === 'infographic') {
      const svgStr = buildInfographicSvg(
        art.content as InfographicOutput,
        art.watermarkId,
        art.sha256
      );
      folder.file('infographic.svg', svgStr);
    }

    if (type === 'presentation') {
      const pptxBuf = await buildPptxExport(
        art.content as PresentationOutput,
        art.watermarkId,
        art.sha256
      );
      folder.file('presentation.pptx', pptxBuf);
    }

    if (type === 'video_package') {
      const vid = art.content as VideoPackageOutput;
      folder.file('subtitles.srt', vid.srtSubtitles);
    }
  }

  zip.file('provenance.json', JSON.stringify(provenanceManifest, null, 2));

  return zip.generateAsync({ type: 'nodebuffer' });
}
