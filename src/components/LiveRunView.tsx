import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import type {
  GeneratedArtefact,
  OutputType,
  PipelineStepState,
} from '../types/artefact';
import { OUTPUT_META } from '../utils/clientProvenance';

interface LiveRunViewProps {
  steps: PipelineStepState[];
  artefacts: Partial<Record<OutputType, GeneratedArtefact>>;
  selectedOutputs: OutputType[];
  startedAt: number;
  runError?: string | null;
  moderationConfirmPrompt?: string | null;
  onConfirmModerationContinue: () => void;
  onCancelRun: () => void;
  onRetryWholeRun: () => void;
  onOpenResults: () => void;
  isComplete: boolean;
}

export const LiveRunView: React.FC<LiveRunViewProps> = ({
  steps,
  artefacts,
  selectedOutputs,
  startedAt,
  runError,
  moderationConfirmPrompt,
  onConfirmModerationContinue,
  onCancelRun,
  onRetryWholeRun,
  onOpenResults,
  isComplete,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (isComplete || runError || moderationConfirmPrompt) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 500);
    return () => clearInterval(interval);
  }, [startedAt, isComplete, runError, moderationConfirmPrompt]);

  const completedSteps = steps.filter((s) => s.status === 'done').length;
  const totalSteps = steps.length;
  const progressPercent = Math.min(
    100,
    Math.round((completedSteps / Math.max(1, totalSteps)) * 100)
  );

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'done':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#16A34A]">
            <CheckCircle2 className="w-4 h-4" />
            Done
          </span>
        );
      case 'running':
      case 'validating':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5E60CE]">
            <Loader2 className="w-4 h-4 animate-spin" />
            {status === 'validating' ? 'Validating' : 'Running'}
          </span>
        );
      case 'retrying':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B45309]">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Retrying
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#DC2626]">
            <XCircle className="w-4 h-4" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#534D72]">
            <Clock className="w-4 h-4" />
            Waiting
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-[#E8E2F7] rounded-lg p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E8E2F7] pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#1C192E]">
            Live Transformation Pipeline
          </h2>
          <p className="text-sm text-[#534D72] mt-0.5">
            Real-time server events from each agent step.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-xs text-[#534D72] block">Elapsed Time</span>
            <span className="text-base font-mono font-semibold text-[#1C192E]">
              {Math.floor(elapsedSeconds / 60)}m {String(elapsedSeconds % 60).padStart(2, '0')}s
            </span>
          </div>
          {isComplete && (
            <button
              type="button"
              onClick={onOpenResults}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#5E60CE] rounded-md hover:bg-[#7B6DFF] transition-colors whitespace-nowrap"
            >
              View Generated Results
            </button>
          )}
        </div>
      </div>

      {/* Real Progress Bar */}
      <div>
        <div className="flex items-center justify-between text-xs text-[#534D72] mb-1.5">
          <span>Pipeline Progress</span>
          <span className="font-mono font-semibold text-[#1C192E]">{progressPercent}%</span>
        </div>
        <div className="w-full h-2.5 bg-[#F8F6FF] border border-[#E8E2F7] rounded-md overflow-hidden">
          <div
            className="h-full bg-[#5E60CE] transition-all duration-200"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Moderation Confirmation Gate */}
      {moderationConfirmPrompt && (
        <div className="bg-[#F8F6FF] border border-[#B45309] rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#B45309] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-[#1C192E]">
                Operator Confirmation Required
              </h3>
              <p className="text-sm text-[#534D72] mt-1">{moderationConfirmPrompt}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 pl-8">
            <button
              type="button"
              onClick={onConfirmModerationContinue}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#5E60CE] rounded-md hover:bg-[#7B6DFF] transition-colors whitespace-nowrap"
            >
              Confirm and Continue Run
            </button>
            <button
              type="button"
              onClick={onCancelRun}
              className="px-4 py-2 text-xs font-semibold text-[#1C192E] bg-white border border-[#E8E2F7] rounded-md hover:border-[#7B6DFF] transition-colors whitespace-nowrap"
            >
              Cancel Run
            </button>
          </div>
        </div>
      )}

      {/* Fatal Run Error */}
      {runError && (
        <div className="bg-white border border-[#DC2626] rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-[#DC2626]">Pipeline Stopped</h3>
              <p className="text-sm text-[#1C192E] mt-1">{runError}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 pl-8">
            <button
              type="button"
              onClick={onRetryWholeRun}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#5E60CE] rounded-md hover:bg-[#7B6DFF] transition-colors whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Run
            </button>
            <button
              type="button"
              onClick={onCancelRun}
              className="px-4 py-2 text-xs font-semibold text-[#1C192E] bg-[#F8F6FF] border border-[#E8E2F7] rounded-md hover:border-[#7B6DFF] transition-colors whitespace-nowrap"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Pipeline Stages */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-[#1C192E]">Pipeline Steps</h3>
        <div className="divide-y divide-[#E8E2F7] border border-[#E8E2F7] rounded-lg">
          {steps.map((step) => (
            <div
              key={step.id}
              className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div>
                <p className="text-sm font-semibold text-[#1C192E]">{step.label}</p>
                <p className="text-xs text-[#534D72] mt-0.5">
                  {step.message || step.description}
                </p>
              </div>
              <div className="shrink-0">{renderStatusBadge(step.status)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Specialist Output Status Cards */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-[#1C192E]">
          Selected Formats ({selectedOutputs.length})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {selectedOutputs.map((type) => {
            const art = artefacts[type];
            const status = art?.status || 'waiting';
            return (
              <div
                key={type}
                className="p-3.5 bg-[#F8F6FF] border border-[#E8E2F7] rounded-lg flex flex-col justify-between gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[#1C192E]">
                    {OUTPUT_META[type].label}
                  </span>
                  {renderStatusBadge(status)}
                </div>
                {art?.validation?.available && art.validation.score !== null && (
                  <p className="text-xs text-[#534D72]">
                    Validation score:{' '}
                    <span className="font-mono font-semibold text-[#1C192E]">
                      {art.validation.score}/100
                    </span>
                    {art.validation.retried &&
                      art.validation.firstAttemptScore !== undefined && (
                        <span> (retried from {art.validation.firstAttemptScore}/100)</span>
                      )}
                  </p>
                )}
                {art?.error && (
                  <p className="text-xs text-[#DC2626] line-clamp-2">{art.error}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
