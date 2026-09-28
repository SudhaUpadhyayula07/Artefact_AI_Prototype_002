import React, { useState } from 'react';
import {
  Copy,
  Download,
  ExternalLink,
  Search,
  Trash2,
} from 'lucide-react';
import type { OutputType, RunRecord } from '../types/artefact';
import { OUTPUT_META } from '../utils/clientProvenance';

interface HistoryPageProps {
  runs: RunRecord[];
  onReopenRun: (run: RunRecord) => void;
  onDuplicateSettings: (run: RunRecord) => void;
  onDeleteRun: (runId: string) => void;
  onClearAllRuns: () => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({
  runs,
  onReopenRun,
  onDuplicateSettings,
  onDeleteRun,
  onClearAllRuns,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [confirmClear, setConfirmClear] = useState(false);

  const filteredRuns = runs.filter((r) => {
    const matchesSearch =
      !searchQuery.trim() ||
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.runId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.sources.some((s) =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase())
      );

    const matchesStatus =
      statusFilter === 'all' || r.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleExportHistoryJson = () => {
    const blob = new Blob([JSON.stringify(runs, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `artefact-history-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#1C192E]">
            Run History
          </h1>
          <p className="text-sm text-[#534D72] mt-1">
            Stored in your browser localStorage. Reopen any run, duplicate its control settings,
            export history, or clear local records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {runs.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleExportHistoryJson}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#1C192E] bg-white border border-[#E8E2F7] rounded-md hover:border-[#7B6DFF]"
              >
                <Download className="w-3.5 h-3.5 text-[#5E60CE]" />
                Export History (.JSON)
              </button>
              {!confirmClear ? (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#DC2626] bg-white border border-[#E8E2F7] rounded-md hover:border-[#DC2626]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear All
                </button>
              ) : (
                <div className="flex items-center gap-1.5 bg-white border border-[#DC2626] rounded-md px-2.5 py-1">
                  <span className="text-xs font-semibold text-[#DC2626]">
                    Confirm clear all?
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onClearAllRuns();
                      setConfirmClear(false);
                    }}
                    className="px-2 py-1 text-xs font-bold text-white bg-[#DC2626] rounded"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="px-2 py-1 text-xs font-semibold text-[#534D72]"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white border border-[#E8E2F7] rounded-lg p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#534D72] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by run title, run ID, or source name..."
            className="w-full pl-9 pr-3.5 py-2 text-sm bg-[#F8F6FF] border border-[#E8E2F7] rounded-md text-[#1C192E]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter runs by status"
          className="px-3.5 py-2 text-sm bg-[#F8F6FF] border border-[#E8E2F7] rounded-md text-[#1C192E]"
        >
          <option value="all">All statuses ({runs.length})</option>
          <option value="completed">Completed</option>
          <option value="completed_with_errors">Completed with errors</option>
          <option value="failed">Failed</option>
          <option value="interrupted">Interrupted</option>
        </select>
      </div>

      {/* Runs List */}
      {filteredRuns.length === 0 ? (
        <div className="bg-white border border-[#E8E2F7] rounded-lg p-8 text-center text-sm text-[#534D72]">
          {runs.length === 0
            ? 'No transformation runs saved in this browser yet.'
            : 'No runs match your current search or status filter.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRuns.map((run) => {
            const sourceTypes = Array.from(
              new Set(run.sources.map((s) => s.type.toUpperCase()))
            ).join(', ');
            const outputKeys = Object.keys(run.artefacts) as OutputType[];

            return (
              <div
                key={run.runId}
                className="bg-white border border-[#E8E2F7] rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                    <span className="text-[#5E60CE] font-semibold">{run.runId}</span>
                    <span className="text-[#534D72]">·</span>
                    <span className="text-[#534D72]">
                      {new Date(run.createdAt).toLocaleString()}
                    </span>
                    <span className="text-[#534D72]">·</span>
                    <span
                      className={
                        run.status === 'completed'
                          ? 'text-[#16A34A] font-semibold'
                          : run.status === 'completed_with_errors'
                          ? 'text-[#B45309] font-semibold'
                          : 'text-[#DC2626] font-semibold'
                      }
                    >
                      {run.status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>

                  <h2 className="text-base font-extrabold text-[#1C192E]">{run.title}</h2>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#534D72]">
                    <span>
                      <strong>Sources ({run.sources.length}):</strong> {sourceTypes || 'TEXT'}
                    </span>
                    <span>
                      <strong>Outputs ({outputKeys.length}):</strong>{' '}
                      {outputKeys.map((k) => OUTPUT_META[k]?.label || k).join(', ')}
                    </span>
                    <span>
                      <strong>Language:</strong> {run.controls.language}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onReopenRun(run)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#5E60CE] rounded-md hover:bg-[#7B6DFF] whitespace-nowrap"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Reopen
                  </button>
                  <button
                    type="button"
                    onClick={() => onDuplicateSettings(run)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#1C192E] bg-[#F8F6FF] border border-[#E8E2F7] rounded-md hover:border-[#7B6DFF] whitespace-nowrap"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#5E60CE]" />
                    Duplicate settings
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteRun(run.runId)}
                    aria-label={`Delete run ${run.title}`}
                    className="p-2 text-[#DC2626] bg-[#F8F6FF] border border-[#E8E2F7] rounded-md hover:border-[#DC2626]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
