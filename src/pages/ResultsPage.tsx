import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Download,
  FileText,
  History as HistoryIcon,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sliders,
  XCircle,
} from 'lucide-react';
import { InfographicCanvas } from '../components/InfographicCanvas';
import type {
  AdvisoryOutput,
  ExecutiveSummaryOutput,
  GeneratedArtefact,
  InfographicOutput,
  LinkedInOutput,
  OutputType,
  PresentationOutput,
  RunRecord,
  TwitterOutput,
  VideoPackageOutput,
} from '../types/artefact';
import {
   encodeZeroWidthClient,
  OUTPUT_META,
} from '../utils/clientProvenance';

interface ResultsPageProps {
  run: RunRecord | null;
  operatorName: string;
  onUpdateRun: (updated: RunRecord) => void;
  onNavigate: (route: string) => void;
}

const TUNE_PRESETS = [
  { id: 'shorten', label: 'Shorten' },
  { id: 'expand', label: 'Expand' },
  { id: 'more_assertive', label: 'More assertive' },
  { id: 'more_technical', label: 'More technical' },
  { id: 'bullet_points', label: 'Convert to bullet points' },
  { id: 'simplify_language', label: 'Simplify language' },
];

export const ResultsPage: React.FC<ResultsPageProps> = ({
  run,
  operatorName,
  onUpdateRun,
  onNavigate,
}) => {
  const availableTypes = run
    ? (Object.keys(run.artefacts) as OutputType[])
    : [];
  const [activeTab, setActiveTab] = useState<OutputType>(
    availableTypes[0] || 'linkedin'
  );
  const [slideIndex, setSlideIndex] = useState(0);
  const [showClaims, setShowClaims] = useState(false);
  const [showFactBase, setShowFactBase] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [customTuneText, setCustomTuneText] = useState('');
  const [isTuning, setIsTuning] = useState(false);
  const [tuneError, setTuneError] = useState<string | null>(null);
  const [compareVersionIdx, setCompareVersionIdx] = useState<number | null>(null);
  const [retryingSpecialist, setRetryingSpecialist] = useState(false);
  const [revalidating, setRevalidating] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);

  useEffect(() => {
    if (run) {
      const keys = Object.keys(run.artefacts) as OutputType[];
      if (keys.length > 0 && !keys.includes(activeTab)) {
        setActiveTab(keys[0]);
      }
    }
  }, [run, activeTab]);

  useEffect(() => {
    setSlideIndex(0);
    setCompareVersionIdx(null);
    setTuneError(null);
  }, [activeTab]);

  if (!run) {
    return (
      <div className="bg-white border border-[#E8E2F7] rounded-lg p-8 text-center space-y-4">
        <h1 className="text-2xl font-extrabold text-[#1C192E]">
          No Active Transformation Run
        </h1>
        <p className="text-sm text-[#534D72] max-w-md mx-auto">
          Start a new run on the Dashboard or reopen a previous run from History to inspect
          validated outputs, watermarks, and exports.
        </p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('/dashboard')}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#5E60CE] rounded-md hover:bg-[#7B6DFF]"
          >
            Go to Dashboard
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/history')}
            className="px-4 py-2 text-xs font-semibold text-[#1C192E] bg-[#F8F6FF] border border-[#E8E2F7] rounded-md hover:border-[#7B6DFF]"
          >
            Open History
          </button>
        </div>
      </div>
    );
  }

  const currentArtefact = run.artefacts[activeTab];
  const combinedSourceText = run.sources
    .map((s) => `--- ${s.title} ---\n${s.rawText}`)
    .join('\n\n');

  const handleCopyPlainText = (art: GeneratedArtefact) => {
    if (!art.plainText || !art.watermarkId) return;
    const zw = encodeZeroWidthClient(art.watermarkId);
    const textWithWatermark = `${art.plainText}${zw}`;
    navigator.clipboard.writeText(textWithWatermark);
    setCopiedId(art.type);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleApproveOutput = (type: OutputType) => {
    const target = run.artefacts[type];
    if (!target) return;
    const updatedArtefact: GeneratedArtefact = {
      ...target,
      approvalStatus: 'approved',
      approvedBy: operatorName.trim() || 'Operator',
      approvedAt: new Date().toISOString(),
    };
    const updatedRun: RunRecord = {
      ...run,
      artefacts: {
        ...run.artefacts,
        [type]: updatedArtefact,
      },
    };
    onUpdateRun(updatedRun);
  };

  const handleExportFormat = async (format: string, art?: GeneratedArtefact) => {
    setExportingFormat(format);
    try {
      const bodyPayload =
        format === 'zip'
          ? {
              runId: run.runId,
              runTitle: run.title,
              sourceHash: run.sourceHash,
              batchHash: run.batchHash,
              artefacts: run.artefacts,
            }
          : {
              type: art?.type,
              content: art?.content,
              watermarkId: art?.watermarkId,
              sha256: art?.sha256,
            };

      const res = await fetch(`/api/export/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Export (${format}) failed.`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        format === 'zip'
          ? `artefact-run-${run.runId.slice(0, 8)}.zip`
          : `artefact-${art?.type || 'output'}-${art?.watermarkId || ''}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setTuneError((err as Error).message);
    } finally {
      setExportingFormat(null);
    }
  };

  const handleRetrySingleSpecialist = async (type: OutputType) => {
    if (!run.factBase) return;
    setRetryingSpecialist(true);
    setTuneError(null);
    try {
      const genRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          combinedSource: combinedSourceText,
          factBase: run.factBase,
          controls: run.controls,
          sourceHash: run.sourceHash,
        }),
      });
      const genData = await genRes.json();
      if (!genRes.ok) {
        throw new Error(genData.message || 'Specialist retry failed.');
      }

      const valRes = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          content: genData.content,
          combinedSource: combinedSourceText,
          factBase: run.factBase,
        }),
      });
      const validation = await valRes.json();

      const needsApproval =
        run.controls.requireHumanApproval ||
        !validation.available ||
        validation.score === null ||
        validation.score < 85;

      const updatedArtefact: GeneratedArtefact = {
        type,
        status: 'done',
        content: genData.content,
        plainText: genData.plainText,
        sha256: genData.sha256,
        watermarkId: genData.watermarkId,
        validation,
        approvalStatus: needsApproval ? 'needs_approval' : 'approved',
        versions: [
          {
            versionNumber: 1,
            createdAt: new Date().toISOString(),
            instruction: 'Retried generation',
            content: genData.content,
            plainText: genData.plainText,
            sha256: genData.sha256,
            watermarkId: genData.watermarkId,
            validation,
          },
        ],
      };

      const nextArtefacts = {
        ...run.artefacts,
        [type]: updatedArtefact,
      };

      // Also record updated state in ledger
      await fetch('/api/ledger/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId: `${run.runId}-retry`,
          runTitle: `${run.title} (Retry ${type})`,
          sourceHash: run.sourceHash,
          artefacts: nextArtefacts,
        }),
      });

      const anyFailed = Object.values(nextArtefacts).some((a) => a?.status === 'failed');
      onUpdateRun({
        ...run,
        status: anyFailed ? 'completed_with_errors' : 'completed',
        artefacts: nextArtefacts,
      });
    } catch (err) {
      setTuneError((err as Error).message);
    } finally {
      setRetryingSpecialist(false);
    }
  };

  const handleRevalidate = async (art: GeneratedArtefact) => {
    if (!run.factBase || !art.content) return;
    setRevalidating(true);
    setTuneError(null);
    try {
      const valRes = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: art.type,
          content: art.content,
          combinedSource: combinedSourceText,
          factBase: run.factBase,
        }),
      });
      const validation = await valRes.json();
      const needsApproval =
        run.controls.requireHumanApproval ||
        !validation.available ||
        validation.score === null ||
        validation.score < 85;

      const updatedArt: GeneratedArtefact = {
        ...art,
        validation,
        approvalStatus: needsApproval ? 'needs_approval' : art.approvalStatus,
      };
      onUpdateRun({
        ...run,
        artefacts: {
          ...run.artefacts,
          [art.type]: updatedArt,
        },
      });
    } catch (err) {
      setTuneError((err as Error).message);
    } finally {
      setRevalidating(false);
    }
  };

  const handleTune = async (instruction: string) => {
    if (!currentArtefact || !currentArtefact.content || !run.factBase || !instruction.trim()) {
      return;
    }
    setIsTuning(true);
    setTuneError(null);
    try {
      const res = await fetch('/api/tune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: currentArtefact.type,
          currentContent: currentArtefact.content,
          instruction: instruction.trim(),
          combinedSource: combinedSourceText,
          factBase: run.factBase,
          controls: run.controls,
          sourceHash: run.sourceHash,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Micro-tuning failed.');
      }

      const nextVerNum = (currentArtefact.versions?.length || 1) + 1;
      const newVersion = {
        versionNumber: nextVerNum,
        createdAt: new Date().toISOString(),
        instruction: instruction.trim(),
        content: data.content,
        plainText: data.plainText,
        sha256: data.sha256,
        watermarkId: data.watermarkId,
        validation: data.validation,
      };

      const needsApproval =
        run.controls.requireHumanApproval ||
        !data.validation?.available ||
        data.validation?.score === null ||
        data.validation.score < 85;

      const updatedArtefact: GeneratedArtefact = {
        ...currentArtefact,
        content: data.content,
        plainText: data.plainText,
        sha256: data.sha256,
        watermarkId: data.watermarkId,
        validation: data.validation,
        approvalStatus: needsApproval ? 'needs_approval' : 'approved',
        versions: [...(currentArtefact.versions || []), newVersion],
      };

      const nextArtefacts = {
        ...run.artefacts,
        [currentArtefact.type]: updatedArtefact,
      };

      // Append tuned version to ledger so Verify page recognises it
      await fetch('/api/ledger/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId: `${run.runId}-v${nextVerNum}`,
          runTitle: `${run.title} (Tuned ${currentArtefact.type} v${nextVerNum})`,
          sourceHash: run.sourceHash,
          artefacts: { [currentArtefact.type]: updatedArtefact },
        }),
      });

      onUpdateRun({
        ...run,
        artefacts: nextArtefacts,
      });
      setCustomTuneText('');
      if ((updatedArtefact.versions?.length || 0) >= 2) {
        setCompareVersionIdx(updatedArtefact.versions.length - 2);
      }
    } catch (err) {
      setTuneError((err as Error).message);
    } finally {
      setIsTuning(false);
    }
  };

  const renderFormatView = (art: GeneratedArtefact) => {
    if (!art.content) return null;

    switch (art.type) {
      case 'linkedin': {
        const c = art.content as LinkedInOutput;
        const totalChars = (art.plainText || '').length;
        return (
          <div className="bg-white border border-[#E8E2F7] rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E8E2F7] pb-3">
              <div>
                <span className="text-xs font-semibold text-[#5E60CE]">LINKEDIN POST PREVIEW</span>
                <p className="text-xs text-[#534D72]">
                  Operator Feed Layout · Target audience: {run.controls.targetAudience}
                </p>
              </div>
              <div className="text-right font-mono text-xs">
                <span
                  className={
                    totalChars <= 3000 ? 'text-[#16A34A] font-semibold' : 'text-[#DC2626] font-bold'
                  }
                >
                  {totalChars} / 3000 characters
                </span>
              </div>
            </div>

            <div className="space-y-4 text-sm text-[#1C192E] leading-relaxed">
              <p className="font-bold text-base text-[#1C192E]">{c.hook}</p>
              <div className="whitespace-pre-line">{c.body}</div>
              <p className="font-semibold text-[#5E60CE]">{c.callToAction}</p>
              <div className="pt-2 flex flex-wrap gap-2 text-xs font-mono text-[#5E60CE]">
                {(c.hashtags || []).map((tag, i) => (
                  <span key={i}>{tag.startsWith('#') ? tag : `#${tag}`}</span>
                ))}
              </div>
            </div>
          </div>
        );
      }

      case 'twitter': {
        const c = art.content as TwitterOutput;
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-white border border-[#E8E2F7] rounded-lg px-4 py-3">
              <span className="text-xs font-semibold text-[#5E60CE]">
                TWITTER / X THREAD ({c.tweets.length} TWEET{c.tweets.length === 1 ? '' : 'S'})
              </span>
              <span className="text-xs text-[#534D72]">
                Every tweet verified &le; 280 characters
              </span>
            </div>
            <div className="space-y-3">
              {(c.tweets || []).map((tweet, idx) => {
                const len = tweet.length;
                return (
                  <div
                    key={idx}
                    className="bg-white border border-[#E8E2F7] rounded-lg p-5 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-semibold text-[#5E60CE]">
                        Tweet {idx + 1} of {c.tweets.length}
                      </span>
                      <span
                        className={`font-mono font-semibold ${
                          len <= 280 ? 'text-[#16A34A]' : 'text-[#DC2626]'
                        }`}
                      >
                        {len} / 280 chars
                      </span>
                    </div>
                    <p className="text-sm text-[#1C192E] whitespace-pre-line leading-relaxed">
                      {tweet}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      case 'advisory': {
        const c = art.content as AdvisoryOutput;
        return (
          <div className="bg-white border border-[#E8E2F7] rounded-lg p-6 md:p-8 space-y-6">
            <div className="border-b border-[#E8E2F7] pb-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#5E60CE]">
                <span>REF: {c.referenceId}</span>
                <span>·</span>
                <span>DATE: {c.date}</span>
                <span>·</span>
                <span>AUDIENCE: {c.audience}</span>
              </div>
              <h3 className="text-xl md:text-2xl font-extrabold text-[#1C192E]">{c.title}</h3>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-extrabold text-[#1C192E]">Executive Summary</h4>
              <p className="text-sm text-[#534D72] leading-relaxed whitespace-pre-line">
                {c.summary}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-extrabold text-[#1C192E]">Background</h4>
              <p className="text-sm text-[#534D72] leading-relaxed whitespace-pre-line">
                {c.background}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-extrabold text-[#1C192E]">Key Findings</h4>
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-[#1C192E]">
                {(c.keyFindings || []).map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-extrabold text-[#1C192E]">Impact Analysis</h4>
              <p className="text-sm text-[#534D72] leading-relaxed whitespace-pre-line">
                {c.impact}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-extrabold text-[#1C192E]">Recommended Actions</h4>
              <div className="overflow-x-auto border border-[#E8E2F7] rounded-lg">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-[#F8F6FF] border-b border-[#E8E2F7] text-xs font-bold text-[#1C192E]">
                      <th className="p-3">Priority</th>
                      <th className="p-3">Timeline</th>
                      <th className="p-3">Recommended Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E2F7]">
                    {(c.recommendedActions || []).map((act, i) => (
                      <tr key={i}>
                        <td className="p-3 font-mono text-xs font-semibold text-[#5E60CE] whitespace-nowrap">
                          {act.priority}
                        </td>
                        <td className="p-3 text-xs text-[#534D72] whitespace-nowrap">
                          {act.timeline}
                        </td>
                        <td className="p-3 text-sm text-[#1C192E]">{act.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {c.references && c.references.length > 0 && (
              <div className="space-y-2 border-t border-[#E8E2F7] pt-4">
                <h4 className="text-sm font-extrabold text-[#1C192E]">Source References</h4>
                <ul className="list-disc pl-5 space-y-1 text-xs font-mono text-[#534D72]">
                  {c.references.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      }

      case 'infographic': {
        const c = art.content as InfographicOutput;
        return (
          <InfographicCanvas
            data={c}
            watermarkId={art.watermarkId || 'ARTF-PENDING'}
            sha256={art.sha256 || ''}
          />
        );
      }

      case 'executive_summary': {
        const c = art.content as ExecutiveSummaryOutput;
        return (
          <div className="bg-white border border-[#E8E2F7] rounded-lg p-6 md:p-8 space-y-6">
            <div className="border-b border-[#E8E2F7] pb-4 space-y-1">
              <div className="text-xs font-mono text-[#5E60CE]">
                ONE-PAGE EXECUTIVE BRIEFING · DATE: {c.date} · AUDIENCE: {c.audience}
              </div>
              <h3 className="text-xl md:text-2xl font-extrabold text-[#1C192E]">{c.title}</h3>
            </div>

            <div className="bg-[#F8F6FF] border-l-4 border-[#5E60CE] p-4 rounded-r-md space-y-1">
              <div className="text-xs font-bold text-[#5E60CE]">BOTTOM LINE UP FRONT</div>
              <p className="text-sm font-semibold text-[#1C192E] leading-relaxed">
                {c.bottomLine}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-extrabold text-[#1C192E]">Key Points</h4>
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-[#1C192E]">
                {(c.keyPoints || []).map((pt, i) => (
                  <li key={i}>{pt}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-extrabold text-[#1C192E]">Implications</h4>
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-[#534D72]">
                {(c.implications || []).map((imp, i) => (
                  <li key={i}>{imp}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-2 border-t border-[#E8E2F7] pt-4">
              <h4 className="text-sm font-extrabold text-[#1C192E]">
                Decision Needed / Next Steps
              </h4>
              <ul className="list-disc pl-5 space-y-1.5 text-sm font-medium text-[#1C192E]">
                {(c.decisionNeededOrNextSteps || []).map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            </div>
          </div>
        );
      }

      case 'presentation': {
        const c = art.content as PresentationOutput;
        const slides = c.slides || [];
        const safeIdx = Math.min(Math.max(0, slideIndex), Math.max(0, slides.length - 1));
        const activeSlide = slides[safeIdx];

        return (
          <div className="space-y-4">
            <div className="bg-white border border-[#E8E2F7] rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-[#1C192E]">{c.title}</h3>
                <p className="text-xs text-[#534D72]">{c.subtitle}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
                  disabled={safeIdx === 0}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#1C192E] bg-[#F8F6FF] border border-[#E8E2F7] rounded-md hover:border-[#7B6DFF] disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <span className="text-xs font-mono font-semibold text-[#1C192E] px-2">
                  Slide {safeIdx + 1} of {slides.length}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSlideIndex((i) => Math.min(slides.length - 1, i + 1))
                  }
                  disabled={safeIdx >= slides.length - 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#1C192E] bg-[#F8F6FF] border border-[#E8E2F7] rounded-md hover:border-[#7B6DFF] disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {activeSlide && (
              <div className="bg-white border border-[#E8E2F7] rounded-lg overflow-hidden">
                <div className="bg-[#5E60CE] px-6 py-4 flex items-center justify-between">
                  <h4 className="text-lg font-extrabold text-white">
                    Slide {activeSlide.slideNumber}: {activeSlide.title}
                  </h4>
                  <span className="text-xs font-mono text-[#E0AAFF]">
                    {art.watermarkId}
                  </span>
                </div>
                <div className="p-6 md:p-8 space-y-6">
                  <ul className="list-disc pl-6 space-y-2.5 text-base text-[#1C192E]">
                    {(activeSlide.bullets || []).map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                  <div className="bg-[#F8F6FF] border border-[#E8E2F7] rounded-md p-4 text-xs text-[#534D72]">
                    <strong className="text-[#1C192E]">Visual Suggestion:</strong>{' '}
                    {activeSlide.visualSuggestion}
                  </div>
                  <div className="border-t border-[#E8E2F7] pt-4 text-xs text-[#534D72]">
                    <strong className="text-[#1C192E] block mb-1">Speaker Notes:</strong>
                    <p className="leading-relaxed whitespace-pre-line">
                      {activeSlide.speakerNotes}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Slide Selector Strip */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {slides.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSlideIndex(idx)}
                  className={`px-3 py-2 text-xs font-semibold rounded-md border shrink-0 transition-colors ${
                    idx === safeIdx
                      ? 'bg-[#5E60CE] text-white border-[#5E60CE]'
                      : 'bg-white text-[#534D72] border-[#E8E2F7] hover:border-[#7B6DFF]'
                  }`}
                >
                  {s.slideNumber}. {s.title.slice(0, 24)}
                </button>
              ))}
            </div>
          </div>
        );
      }

      case 'video_package': {
        const c = art.content as VideoPackageOutput;
        return (
          <div className="space-y-6">
            <div className="bg-white border border-[#E8E2F7] rounded-lg p-6 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#5E60CE]">
                <span>TARGET DURATION: {c.targetDuration}</span>
                <span>·</span>
                <span>PLATFORM: {c.platform}</span>
                <span>·</span>
                <span>SCENES: {c.scenes?.length || 0}</span>
              </div>
              <h3 className="text-xl font-extrabold text-[#1C192E]">{c.title}</h3>
              <p className="text-sm text-[#534D72] leading-relaxed">{c.scriptSummary}</p>
              <div className="bg-[#F8F6FF] border border-[#E8E2F7] rounded-md p-3 text-xs text-[#534D72]">
                <strong className="text-[#1C192E]">Music &amp; Sound Direction:</strong>{' '}
                {c.musicAndSoundNotes}
              </div>
            </div>

            {/* Storyboard Timeline */}
            <div className="space-y-3">
              <h4 className="text-sm font-extrabold text-[#1C192E]">
                Storyboard Timeline ({c.scenes?.length || 0} Scenes)
              </h4>
              <div className="space-y-3">
                {(c.scenes || []).map((scene) => (
                  <div
                    key={scene.sceneNumber}
                    className="bg-white border border-[#E8E2F7] rounded-lg p-5 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8E2F7] pb-2">
                      <span className="text-sm font-extrabold text-[#5E60CE]">
                        Scene {scene.sceneNumber}
                      </span>
                      <span className="text-xs font-mono font-semibold text-[#1C192E]">
                        {scene.startTime} - {scene.endTime} ({scene.durationSeconds}s)
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1.5">
                        <p className="text-[#1C192E]">
                          <strong>Narration Script:</strong> {scene.narrationText}
                        </p>
                        <p className="text-[#5E60CE] font-medium">
                          <strong>On-Screen Text:</strong> {scene.onScreenText}
                        </p>
                      </div>
                      <div className="space-y-1.5 text-[#534D72]">
                        <p>
                          <strong className="text-[#1C192E]">Scene Description:</strong>{' '}
                          {scene.sceneDescription}
                        </p>
                        <p>
                          <strong className="text-[#1C192E]">Visual Recommendation:</strong>{' '}
                          {scene.visualRecommendation}
                        </p>
                        <p>
                          <strong className="text-[#1C192E]">Audio / SFX Notes:</strong>{' '}
                          {scene.audioNotes}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Valid SRT Timed Subtitles */}
            <div className="bg-white border border-[#E8E2F7] rounded-lg p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-extrabold text-[#1C192E]">
                  Timed Subtitles (.SRT)
                </h4>
                <button
                  type="button"
                  onClick={() => handleExportFormat('srt', art)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#5E60CE] rounded-md hover:bg-[#7B6DFF]"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download .SRT
                </button>
              </div>
              <pre className="p-4 bg-[#F8F6FF] border border-[#E8E2F7] rounded-md text-xs font-mono text-[#1C192E] overflow-x-auto max-h-64">
                {c.srtSubtitles}
              </pre>
            </div>
          </div>
        );
      }
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Run Top Header */}
      <div className="bg-white border border-[#E8E2F7] rounded-lg p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#534D72]">
              <span>RUN ID: {run.runId}</span>
              <span>·</span>
              <span>{new Date(run.createdAt).toLocaleString()}</span>
              <span>·</span>
              <span
                className={
                  run.status === 'completed'
                    ? 'text-[#16A34A] font-semibold'
                    : run.status === 'completed_with_errors'
                    ? 'text-[#B45309] font-semibold'
                    : 'text-[#DC2626] font-semibold'
                }
              >
                STATUS: {run.status.replace(/_/g, ' ').toUpperCase()}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-[#1C192E]">{run.title}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleExportFormat('zip')}
              disabled={exportingFormat === 'zip'}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#5E60CE] rounded-md hover:bg-[#7B6DFF] transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <Archive className="w-4 h-4" />
              {exportingFormat === 'zip'
                ? 'Building ZIP...'
                : 'Download everything as ZIP'}
            </button>
          </div>
        </div>

        {/* Provenance Summary Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="p-3 bg-[#F8F6FF] border border-[#E8E2F7] rounded-md">
            <span className="text-[#534D72] block">Source Bundle SHA-256</span>
            <span className="font-mono text-[#1C192E] break-all">{run.sourceHash}</span>
          </div>
          <div className="p-3 bg-[#F8F6FF] border border-[#E8E2F7] rounded-md">
            <span className="text-[#534D72] block">Batch SHA-256</span>
            <span className="font-mono text-[#1C192E] break-all">
              {run.batchHash || 'Computed on completion'}
            </span>
          </div>
          <div className="p-3 bg-[#F8F6FF] border border-[#E8E2F7] rounded-md flex items-center justify-between">
            <div>
              <span className="text-[#534D72] block">Local Hash-Chain Ledger</span>
              <span className="font-mono font-semibold text-[#1C192E]">
                {run.ledgerBlockIndex !== undefined
                  ? `Recorded in Block #${run.ledgerBlockIndex}`
                  : 'Recorded'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/ledger')}
              className="text-xs font-semibold text-[#5E60CE] hover:underline"
            >
              Inspect Ledger
            </button>
          </div>
        </div>

        {/* Cross-Output Consistency Banner */}
        {run.consistency && (
          <div
            className={`p-3.5 rounded-md border text-xs flex items-start gap-2.5 ${
              run.consistency.consistent
                ? 'bg-[#F8F6FF] border-[#E8E2F7] text-[#1C192E]'
                : 'bg-[#F8F6FF] border-[#B45309] text-[#1C192E]'
            }`}
          >
            {run.consistency.consistent ? (
              <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="font-semibold">
                {run.consistency.consistent
                  ? 'Cross-Output Consistency Verified: Numbers and factual claims align across all generated outputs.'
                  : `Cross-Output Consistency Alert: ${run.consistency.issues.length} potential discrepancy flagged across outputs.`}
              </p>
              {!run.consistency.consistent &&
                run.consistency.issues.map((iss, i) => (
                  <p key={i} className="text-[#534D72]">
                    • <strong>{iss.item}</strong> ({iss.outputsInvolved.join(', ')}):{' '}
                    {iss.description}
                  </p>
                ))}
            </div>
          </div>
        )}

        {/* Shared Fact Base Accordion */}
        {run.factBase && (
          <div className="border-t border-[#E8E2F7] pt-3">
            <button
              type="button"
              onClick={() => setShowFactBase(!showFactBase)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5E60CE] hover:underline"
            >
              {showFactBase ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  Hide Shared Fact Base ({run.factBase.keyFacts.length} facts ·{' '}
                  {run.factBase.keyNumbers.length} numbers)
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  Inspect Shared Fact Base ({run.factBase.keyFacts.length} facts ·{' '}
                  {run.factBase.keyNumbers.length} numbers)
                </>
              )}
            </button>
            {showFactBase && (
              <div className="mt-3 p-4 bg-[#F8F6FF] border border-[#E8E2F7] rounded-lg space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <strong className="text-[#1C192E] block">Domain:</strong>
                    <span className="text-[#534D72]">{run.factBase.domain}</span>
                  </div>
                  <div>
                    <strong className="text-[#1C192E] block">Detected Intent:</strong>
                    <span className="text-[#534D72]">{run.factBase.detectedIntent}</span>
                  </div>
                  <div>
                    <strong className="text-[#1C192E] block">Suggested Angle:</strong>
                    <span className="text-[#534D72]">{run.factBase.suggestedAngle}</span>
                  </div>
                </div>
                <div>
                  <strong className="text-[#1C192E] block mb-1.5">Extracted Key Facts:</strong>
                  <div className="space-y-1.5">
                    {run.factBase.keyFacts.map((kf) => (
                      <div key={kf.id} className="p-2.5 bg-white border border-[#E8E2F7] rounded-md">
                        <span className="font-mono font-bold text-[#5E60CE] mr-2">[{kf.id}]</span>
                        <span className="text-[#1C192E] font-medium">{kf.statement}</span>
                        <p className="text-[#534D72] mt-1 italic">
                          Source quote: &quot;{kf.sourceQuote}&quot;
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Output Format Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-white border border-[#E8E2F7] rounded-lg">
        {availableTypes.map((type) => {
          const art = run.artefacts[type];
          const isSelected = activeTab === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => setActiveTab(type)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors flex items-center gap-2 whitespace-nowrap ${
                isSelected
                  ? 'bg-[#5E60CE] text-white'
                  : 'text-[#534D72] hover:text-[#1C192E] hover:bg-[#F8F6FF]'
              }`}
            >
              <span>{OUTPUT_META[type].label}</span>
              {art?.status === 'failed' && (
                <span className="text-[10px] font-mono uppercase text-[#DC2626]">Failed</span>
              )}
              {art?.status === 'done' && art.validation?.score !== null && (
                <span
                  className={`font-mono text-[11px] ${
                    isSelected ? 'text-[#E0AAFF]' : 'text-[#5E60CE]'
                  }`}
                >
                  {art.validation?.score}%
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active Output Workspace */}
      {currentArtefact && (
        <div className="space-y-6">
          {/* Failed State with Retry */}
          {currentArtefact.status === 'failed' && (
            <div className="bg-white border border-[#DC2626] rounded-lg p-6 space-y-4">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-base font-extrabold text-[#1C192E]">
                    {OUTPUT_META[currentArtefact.type].label} Generation Failed
                  </h3>
                  <p className="text-sm text-[#DC2626] mt-1">
                    {currentArtefact.error || 'Specialist agent failed to complete.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRetrySingleSpecialist(currentArtefact.type)}
                disabled={retryingSpecialist}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#5E60CE] rounded-md hover:bg-[#7B6DFF] disabled:opacity-50"
              >
                {retryingSpecialist ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Retrying Specialist...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Retry {OUTPUT_META[currentArtefact.type].label}
                  </>
                )}
              </button>
            </div>
          )}

          {/* Completed Artefact Metadata, Approval, Copy & Export Toolbar */}
          {currentArtefact.status === 'done' && (
            <>
              <div className="bg-white border border-[#E8E2F7] rounded-lg p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    {/* Validation Score */}
                    <div>
                      <span className="text-[#534D72] block">Validation Score</span>
                      {currentArtefact.validation?.available &&
                      currentArtefact.validation.score !== null ? (
                        <span
                          className={`font-mono text-sm font-bold ${
                            currentArtefact.validation.score >= 85
                              ? 'text-[#16A34A]'
                              : currentArtefact.validation.score >= 70
                              ? 'text-[#B45309]'
                              : 'text-[#DC2626]'
                          }`}
                        >
                          {currentArtefact.validation.score}/100
                          {currentArtefact.validation.retried &&
                            currentArtefact.validation.firstAttemptScore !== undefined && (
                              <span className="text-xs text-[#534D72] font-normal ml-1.5">
                                (Attempt 1: {currentArtefact.validation.firstAttemptScore}/100 →
                                Attempt 2: {currentArtefact.validation.score}/100)
                              </span>
                            )}
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-[#B45309] font-semibold">
                            Validation unavailable
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRevalidate(currentArtefact)}
                            disabled={revalidating}
                            className="text-[#5E60CE] underline font-semibold"
                          >
                            {revalidating ? 'Validating...' : 'Re-run validation'}
                          </button>
                        </div>
                      )}
                    </div>

                    <span className="text-[#E8E2F7]">|</span>

                    {/* Watermark ID */}
                    <div>
                      <span className="text-[#534D72] block">Watermark ID</span>
                      <span className="font-mono font-semibold text-[#1C192E]">
                        {currentArtefact.watermarkId}
                      </span>
                    </div>

                    <span className="text-[#E8E2F7]">|</span>

                    {/* SHA-256 */}
                    <div>
                      <span className="text-[#534D72] block">Output SHA-256</span>
                      <span className="font-mono text-[#1C192E]">
                        {currentArtefact.sha256?.slice(0, 20)}...
                      </span>
                    </div>

                    <span className="text-[#E8E2F7]">|</span>

                    {/* Approval Status */}
                    <div>
                      <span className="text-[#534D72] block">Approval Gate</span>
                      {currentArtefact.approvalStatus === 'approved' ? (
                        <span className="text-[#16A34A] font-semibold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Approved
                          {currentArtefact.approvedBy ? ` by ${currentArtefact.approvedBy}` : ''}
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-[#B45309] font-semibold">Needs approval</span>
                          <button
                            type="button"
                            onClick={() => handleApproveOutput(currentArtefact.type)}
                            className="px-2.5 py-1 text-xs font-semibold text-white bg-[#16A34A] rounded-md hover:opacity-90"
                          >
                            Approve Output
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Copy & Exports */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyPlainText(currentArtefact)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1C192E] bg-[#F8F6FF] border border-[#E8E2F7] rounded-md hover:border-[#7B6DFF]"
                    >
                      {copiedId === currentArtefact.type ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                          Copied with Watermark
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-[#5E60CE]" />
                          Copy
                        </>
                      )}
                    </button>

                    {/* Standard exports available on every output: TXT, MD, JSON */}
                    {['txt', 'md', 'json'].map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        disabled={
                          currentArtefact.approvalStatus !== 'approved' ||
                          exportingFormat === fmt
                        }
                        title={
                          currentArtefact.approvalStatus !== 'approved'
                            ? 'Approve this output first to enable approved exports'
                            : `Export as .${fmt.toUpperCase()}`
                        }
                        onClick={() => handleExportFormat(fmt, currentArtefact)}
                        className="px-2.5 py-1.5 text-xs font-mono font-semibold text-[#1C192E] bg-[#F8F6FF] border border-[#E8E2F7] rounded-md hover:border-[#7B6DFF] disabled:opacity-40"
                      >
                        .{fmt.toUpperCase()}
                      </button>
                    ))}

                    {/* Format-specific exports per Section 13 */}
                    {(currentArtefact.type === 'advisory' ||
                      currentArtefact.type === 'executive_summary' ||
                      currentArtefact.type === 'video_package') && (
                      <button
                        type="button"
                        disabled={currentArtefact.approvalStatus !== 'approved'}
                        onClick={() => handleExportFormat('docx', currentArtefact)}
                        className="px-2.5 py-1.5 text-xs font-mono font-semibold text-white bg-[#5E60CE] rounded-md hover:bg-[#7B6DFF] disabled:opacity-40"
                      >
                        .DOCX
                      </button>
                    )}

                    {(currentArtefact.type === 'advisory' ||
                      currentArtefact.type === 'executive_summary' ||
                      currentArtefact.type === 'presentation') && (
                      <button
                        type="button"
                        disabled={currentArtefact.approvalStatus !== 'approved'}
                        onClick={() => handleExportFormat('pdf', currentArtefact)}
                        className="px-2.5 py-1.5 text-xs font-mono font-semibold text-white bg-[#5E60CE] rounded-md hover:bg-[#7B6DFF] disabled:opacity-40"
                      >
                        .PDF
                      </button>
                    )}

                    {currentArtefact.type === 'presentation' && (
                      <button
                        type="button"
                        disabled={currentArtefact.approvalStatus !== 'approved'}
                        onClick={() => handleExportFormat('pptx', currentArtefact)}
                        className="px-2.5 py-1.5 text-xs font-mono font-semibold text-white bg-[#5E60CE] rounded-md hover:bg-[#7B6DFF] disabled:opacity-40"
                      >
                        .PPTX
                      </button>
                    )}

                    {currentArtefact.type === 'video_package' && (
                      <button
                        type="button"
                        disabled={currentArtefact.approvalStatus !== 'approved'}
                        onClick={() => handleExportFormat('srt', currentArtefact)}
                        className="px-2.5 py-1.5 text-xs font-mono font-semibold text-white bg-[#5E60CE] rounded-md hover:bg-[#7B6DFF] disabled:opacity-40"
                      >
                        .SRT
                      </button>
                    )}
                  </div>
                </div>

                {currentArtefact.approvalStatus !== 'approved' && (
                  <div className="bg-[#F8F6FF] border border-[#B45309] rounded-md p-3 text-xs text-[#B45309] flex items-center justify-between gap-2">
                    <span>
                      Approval gate active: This output requires operator sign-off before exporting
                      approved files. Review the claims below and click &quot;Approve Output&quot;.
                    </span>
                  </div>
                )}

                {/* Expandable Factual Claim Verification Table */}
                <div className="border-t border-[#E8E2F7] pt-3">
                  <button
                    type="button"
                    onClick={() => setShowClaims(!showClaims)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5E60CE] hover:underline"
                  >
                    {showClaims ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" />
                        Hide Claim-by-Claim Verification (
                        {currentArtefact.validation?.claims?.length || 0} claims checked)
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" />
                        Show Claim-by-Claim Verification (
                        {currentArtefact.validation?.claims?.length || 0} claims checked)
                      </>
                    )}
                  </button>

                  {showClaims && currentArtefact.validation && (
                    <div className="mt-3 overflow-x-auto border border-[#E8E2F7] rounded-lg">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-[#F8F6FF] border-b border-[#E8E2F7] font-bold text-[#1C192E]">
                            <th className="p-3">Status</th>
                            <th className="p-3">Output Claim</th>
                            <th className="p-3">Source Quote</th>
                            <th className="p-3">Validator Note</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E8E2F7]">
                          {(currentArtefact.validation.claims || []).map((cl, idx) => (
                            <tr key={idx}>
                              <td className="p-3 font-mono font-semibold whitespace-nowrap">
                                {cl.status === 'supported' && (
                                  <span className="text-[#16A34A]">SUPPORTED</span>
                                )}
                                {cl.status === 'unsupported' && (
                                  <span className="text-[#B45309]">UNSUPPORTED</span>
                                )}
                                {cl.status === 'contradicted' && (
                                  <span className="text-[#DC2626]">CONTRADICTED</span>
                                )}
                              </td>
                              <td className="p-3 text-[#1C192E] font-medium">{cl.claim}</td>
                              <td className="p-3 text-[#534D72] italic">
                                &quot;{cl.sourceQuote}&quot;
                              </td>
                              <td className="p-3 text-[#534D72]">{cl.note}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Format-Specific Content View */}
              {renderFormatView(currentArtefact)}

              {/* Micro-Tuning & Version History Panel */}
              <div className="bg-white border border-[#E8E2F7] rounded-lg p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#5E60CE]" />
                    <h3 className="text-sm font-extrabold text-[#1C192E]">
                      Micro-Tuning &amp; Version History
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-[#534D72]">
                    Current: v{currentArtefact.versions?.length || 1}
                  </span>
                </div>

                <p className="text-xs text-[#534D72]">
                  Refine this output while keeping its exact structure, re-running claim validation,
                  and computing a new SHA-256 hash and watermark ID.
                </p>

                <div className="flex flex-wrap gap-2">
                  {TUNE_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={isTuning}
                      onClick={() => handleTune(p.id)}
                      className="px-3 py-1.5 text-xs font-semibold text-[#1C192E] bg-[#F8F6FF] border border-[#E8E2F7] rounded-md hover:border-[#7B6DFF] disabled:opacity-50"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={customTuneText}
                    onChange={(e) => setCustomTuneText(e.target.value)}
                    placeholder="Or write a custom tuning instruction (e.g. Emphasise the 72-hour firmware deadline)..."
                    className="flex-1 px-3.5 py-2 text-xs bg-[#F8F6FF] border border-[#E8E2F7] rounded-md text-[#1C192E]"
                  />
                  <button
                    type="button"
                    disabled={isTuning || !customTuneText.trim()}
                    onClick={() => handleTune(customTuneText)}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#5E60CE] rounded-md hover:bg-[#7B6DFF] disabled:opacity-50 whitespace-nowrap"
                  >
                    {isTuning ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Tuning &amp; Validating...
                      </>
                    ) : (
                      'Apply Custom Tune'
                    )}
                  </button>
                </div>

                {tuneError && (
                  <p className="text-xs text-[#DC2626] font-medium">{tuneError}</p>
                )}

                {/* Version History & Before/After Comparison */}
                {currentArtefact.versions && currentArtefact.versions.length > 1 && (
                  <div className="border-t border-[#E8E2F7] pt-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#1C192E] inline-flex items-center gap-1.5">
                        <HistoryIcon className="w-3.5 h-3.5 text-[#5E60CE]" />
                        Saved Versions ({currentArtefact.versions.length})
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {currentArtefact.versions.slice(0, -1).map((v, idx) => (
                          <button
                            key={v.versionNumber}
                            type="button"
                            onClick={() =>
                              setCompareVersionIdx(compareVersionIdx === idx ? null : idx)
                            }
                            className={`px-2.5 py-1 text-xs font-mono rounded-md border ${
                              compareVersionIdx === idx
                                ? 'bg-[#5E60CE] text-white border-[#5E60CE]'
                                : 'bg-[#F8F6FF] text-[#1C192E] border-[#E8E2F7]'
                            }`}
                          >
                            Compare v{v.versionNumber} vs Current (v
                            {currentArtefact.versions.length})
                          </button>
                        ))}
                      </div>
                    </div>

                    {compareVersionIdx !== null &&
                      currentArtefact.versions[compareVersionIdx] && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                          <div className="p-4 bg-[#F8F6FF] border border-[#E8E2F7] rounded-lg space-y-2">
                            <div className="flex items-center justify-between text-xs font-mono">
                              <span className="font-bold text-[#534D72]">
                                BEFORE: Version{' '}
                                {currentArtefact.versions[compareVersionIdx].versionNumber} (
                                {currentArtefact.versions[compareVersionIdx].instruction})
                              </span>
                              <span>
                                Score:{' '}
                                {currentArtefact.versions[compareVersionIdx].validation?.score ??
                                  'N/A'}
                                /100
                              </span>
                            </div>
                            <div className="text-[11px] font-mono text-[#534D72]">
                              Watermark:{' '}
                              {currentArtefact.versions[compareVersionIdx].watermarkId}
                            </div>
                            <pre className="text-xs text-[#1C192E] whitespace-pre-wrap font-sans leading-relaxed max-h-80 overflow-y-auto">
                              {currentArtefact.versions[compareVersionIdx].plainText}
                            </pre>
                          </div>

                          <div className="p-4 bg-white border border-[#5E60CE] rounded-lg space-y-2">
                            <div className="flex items-center justify-between text-xs font-mono">
                              <span className="font-bold text-[#5E60CE]">
                                AFTER: Current Version {currentArtefact.versions.length} (
                                {
                                  currentArtefact.versions[
                                    currentArtefact.versions.length - 1
                                  ].instruction
                                }
                                )
                              </span>
                              <span>
                                Score: {currentArtefact.validation?.score ?? 'N/A'}/100
                              </span>
                            </div>
                            <div className="text-[11px] font-mono text-[#534D72]">
                              Watermark: {currentArtefact.watermarkId}
                            </div>
                            <pre className="text-xs text-[#1C192E] whitespace-pre-wrap font-sans leading-relaxed max-h-80 overflow-y-auto">
                              {currentArtefact.plainText}
                            </pre>
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
