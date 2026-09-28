import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  Loader2,
  ShieldCheck,
  Upload,
  XCircle,
} from 'lucide-react';
import type { VerifyMatchResult } from '../types/artefact';
import {
  extractZeroWidthClient,
  normaliseForClientHash,
  OUTPUT_META,
  sha256WebCrypto,
} from '../utils/clientProvenance';

export const VerifyPage: React.FC = () => {
  const [content, setContent] = useState('');
  const [clientHash, setClientHash] = useState<string>('');
  const [clientWatermark, setClientWatermark] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerifyMatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function computeLiveHash() {
      if (!content.trim()) {
        setClientHash('');
        setClientWatermark(null);
        return;
      }
      const wm = extractZeroWidthClient(content);
      const norm = normaliseForClientHash(content);
      const hash = await sha256WebCrypto(norm);
      if (active) {
        setClientWatermark(wm);
        setClientHash(hash);
      }
    }
    void computeLiveHash();
    return () => {
      active = false;
    };
  }, [content]);

  const handleVerifyText = async () => {
    if (!content.trim()) return;
    setVerifying(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/verify-hash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Verification request failed.');
      }
      setResult(data as VerifyMatchResult);
    } catch (err) {
      setError((err as Error).message || 'Verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVerifying(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/verify-hash', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'File verification failed.');
      }
      setResult(data as VerifyMatchResult);
    } catch (err) {
      setError((err as Error).message || 'Could not verify uploaded file.');
    } finally {
      setVerifying(false);
      e.target.value = '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white border border-[#E8E2F7] rounded-lg p-6 space-y-2">
        <div className="text-xs font-bold uppercase tracking-wider text-[#5E60CE]">
          Cryptographic Provenance Check
        </div>
        <h1 className="text-2xl font-extrabold text-[#1C192E]">
          Verify Content Authenticity
        </h1>
        <p className="text-sm text-[#534D72]">
          Paste any text or upload an exported file to compute its normalised SHA-256 hash in your
          browser using Web Crypto, inspect invisible zero-width watermark markers, and compare it
          against the server hash-chain ledger.
        </p>
      </div>

      <div className="bg-white border border-[#E8E2F7] rounded-lg p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-sm font-bold text-[#1C192E]">
            Candidate text or exported document
          </label>
          <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#F8F6FF] hover:bg-[#E0AAFF]/30 border border-[#B794F4] text-xs font-semibold text-[#1C192E] rounded-md cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5 text-[#5E60CE]" />
            <span>Upload file to verify (.txt, .md, .docx, .pdf, .json)</span>
            <input
              type="file"
              accept=".txt,.md,.json,.docx,.pdf,.srt"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        <textarea
          rows={8}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste copied output text (including any invisible zero-width watermark or visible watermark footer) to verify..."
          className="w-full p-3 text-sm bg-[#F8F6FF] border border-[#E8E2F7] rounded-md focus:outline-none focus:border-[#5E60CE] font-sans"
        />

        {clientHash && (
          <div className="bg-[#F8F6FF] border border-[#E8E2F7] rounded-md p-3 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-[#1C192E]">
                Live Client Web Crypto SHA-256 (Normalised):
              </span>
              {clientWatermark ? (
                <span className="px-2 py-0.5 bg-[#ECFDF5] border border-[#16A34A] text-[#16A34A] font-mono text-[11px] rounded">
                  Zero-Width Marker Detected: {clientWatermark}
                </span>
              ) : (
                <span className="text-[#534D72] text-[11px]">
                  No zero-width marker detected in raw text
                </span>
              )}
            </div>
            <div className="font-mono text-xs text-[#5E60CE] break-all">{clientHash}</div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          {content && (
            <button
              type="button"
              onClick={() => {
                setContent('');
                setResult(null);
                setError(null);
              }}
              className="px-3 py-2 text-xs font-semibold text-[#534D72] hover:text-[#1C192E]"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            disabled={!content.trim() || verifying}
            onClick={handleVerifyText}
            className="px-5 py-2.5 bg-[#7B6DFF] hover:bg-[#5E60CE] disabled:opacity-50 text-white text-sm font-semibold rounded-md flex items-center gap-2 transition-colors"
          >
            {verifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Checking Ledger...</span>
              </>
            ) : (
              <>
                <FileSearch className="w-4 h-4" />
                <span>Verify Against Ledger</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-[#FEF2F2] border border-[#DC2626] rounded-lg p-4 text-sm text-[#DC2626]">
          {error}
        </div>
      )}

      {result && (
        <div
          className={`bg-white border-2 rounded-lg p-6 space-y-4 ${
            result.status === 'VERIFIED'
              ? 'border-[#16A34A]'
              : result.status === 'MODIFIED'
              ? 'border-[#D97706]'
              : 'border-[#DC2626]'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {result.status === 'VERIFIED' && (
                <CheckCircle2 className="w-7 h-7 text-[#16A34A] shrink-0" />
              )}
              {result.status === 'MODIFIED' && (
                <AlertTriangle className="w-7 h-7 text-[#D97706] shrink-0" />
              )}
              {result.status === 'NOT_FOUND' && (
                <XCircle className="w-7 h-7 text-[#DC2626] shrink-0" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 text-xs font-extrabold uppercase rounded ${
                      result.status === 'VERIFIED'
                        ? 'bg-[#ECFDF5] text-[#16A34A]'
                        : result.status === 'MODIFIED'
                        ? 'bg-[#FFFBEB] text-[#D97706]'
                        : 'bg-[#FEF2F2] text-[#DC2626]'
                    }`}
                  >
                    {result.status}
                  </span>
                  {result.similarityScore > 0 && (
                    <span className="text-xs font-semibold text-[#534D72]">
                      Token Similarity: {Math.round(result.similarityScore * 100)}%
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold text-[#1C192E] mt-1">{result.message}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#E8E2F7] text-xs">
            <div>
              <span className="font-bold text-[#534D72] block mb-1">Computed SHA-256 Hash</span>
              <code className="font-mono text-[11px] text-[#1C192E] break-all bg-[#F8F6FF] p-2 rounded block border border-[#E8E2F7]">
                {result.computedHash}
              </code>
            </div>
            <div>
              <span className="font-bold text-[#534D72] block mb-1">Extracted Watermark ID</span>
              <code className="font-mono text-[11px] text-[#1C192E] bg-[#F8F6FF] p-2 rounded block border border-[#E8E2F7]">
                {result.extractedWatermarkId || 'None detected'}
              </code>
            </div>
          </div>

          {result.matchedRun && (
            <div className="bg-[#F8F6FF] border border-[#B794F4] rounded-md p-4 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-[#1C192E]">
                <ShieldCheck className="w-4 h-4 text-[#5E60CE]" />
                <span>Matched Ledger Record (Block #{result.matchedRun.blockIndex})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[#534D72]">
                <div>
                  <strong className="text-[#1C192E]">Run Title:</strong>{' '}
                  {result.matchedRun.runTitle}
                </div>
                <div>
                  <strong className="text-[#1C192E]">Run ID:</strong>{' '}
                  <span className="font-mono">{result.matchedRun.runId}</span>
                </div>
                <div>
                  <strong className="text-[#1C192E]">Format:</strong>{' '}
                  {OUTPUT_META[result.matchedRun.outputType]?.label ||
                    result.matchedRun.outputType}
                </div>
                <div>
                  <strong className="text-[#1C192E]">Timestamp:</strong>{' '}
                  {new Date(result.matchedRun.timestamp).toLocaleString()}
                </div>
                <div>
                  <strong className="text-[#1C192E]">Watermark ID:</strong>{' '}
                  <span className="font-mono">{result.matchedRun.watermarkId}</span>
                </div>
                <div>
                  <strong className="text-[#1C192E]">Original Ledger Hash:</strong>{' '}
                  <span className="font-mono break-all">{result.matchedRun.originalHash}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
