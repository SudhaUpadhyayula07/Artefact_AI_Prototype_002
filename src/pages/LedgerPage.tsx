import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Link as LinkIcon,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import type { LedgerBlock, LedgerVerifyReport } from '../types/artefact';
import { OUTPUT_META } from '../utils/clientProvenance';

export const LedgerPage: React.FC = () => {
  const [blocks, setBlocks] = useState<LedgerBlock[]>([]);
  const [verification, setVerification] = useState<LedgerVerifyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyingChain, setVerifyingChain] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLedger = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ledger');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Could not load ledger.');
      }
      setBlocks(Array.isArray(data.blocks) ? data.blocks : []);
      setVerification(data.verification || null);
    } catch (err) {
      setError((err as Error).message || 'Failed to load ledger.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyChain = async () => {
    setVerifyingChain(true);
    setError(null);
    try {
      const res = await fetch('/api/ledger/verify');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Chain verification failed.');
      }
      setVerification(data as LedgerVerifyReport);
    } catch (err) {
      setError((err as Error).message || 'Could not verify chain integrity.');
    } finally {
      setVerifyingChain(false);
    }
  };

  useEffect(() => {
    void fetchLedger();
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white border border-[#E8E2F7] rounded-lg p-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="text-xs font-bold uppercase tracking-wider text-[#5E60CE]">
            Local Tamper-Evident Audit Trail
          </div>
          <h1 className="text-2xl font-extrabold text-[#1C192E]">
            SHA-256 Hash-Chain Ledger
          </h1>
          <p className="text-sm text-[#534D72]">
            Every completed run appends a block linking the source hash, individual output hashes,
            batch hash, and previous block hash in <code className="font-mono">data/ledger.json</code>.
            This is a local cryptographic hash chain and not a public blockchain.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchLedger}
            disabled={loading}
            className="px-3 py-2 bg-[#F8F6FF] hover:bg-[#E0AAFF]/30 border border-[#B794F4] text-xs font-semibold text-[#1C192E] rounded-md flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleVerifyChain}
            disabled={verifyingChain}
            className="px-4 py-2 bg-[#7B6DFF] hover:bg-[#5E60CE] text-white text-xs font-semibold rounded-md flex items-center gap-1.5"
          >
            {verifyingChain ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5" />
            )}
            <span>Verify Chain Integrity</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-[#FEF2F2] border border-[#DC2626] rounded-lg p-4 text-sm text-[#DC2626]">
          {error}
        </div>
      )}

      {verification && (
        <div
          className={`bg-white border-2 rounded-lg p-5 flex flex-wrap items-center justify-between gap-4 ${
            verification.valid ? 'border-[#16A34A]' : 'border-[#DC2626]'
          }`}
        >
          <div className="flex items-center gap-3">
            {verification.valid ? (
              <CheckCircle2 className="w-6 h-6 text-[#16A34A] shrink-0" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-[#DC2626] shrink-0" />
            )}
            <div>
              <div className="text-sm font-extrabold text-[#1C192E]">
                {verification.valid
                  ? `Chain Integrity Verified (${verification.totalBlocks} Block${
                      verification.totalBlocks === 1 ? '' : 's'
                    })`
                  : `Chain Integrity Broken at Block #${verification.firstBrokenBlockIndex}`}
              </div>
              <div className="text-xs text-[#534D72]">{verification.reason}</div>
            </div>
          </div>
          <div className="text-xs text-[#534D72] font-mono">
            Checked: {new Date(verification.checkedAt).toLocaleTimeString()}
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-[#E8E2F7] rounded-lg p-12 flex items-center justify-center gap-2 text-sm text-[#534D72]">
          <Loader2 className="w-4 h-4 animate-spin text-[#7B6DFF]" />
          <span>Loading hash-chain blocks...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {blocks.map((block) => (
            <div
              key={block.index}
              className="bg-white border border-[#E8E2F7] rounded-lg p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8E2F7] pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 bg-[#F8F6FF] border border-[#B794F4] text-[#5E60CE] font-mono text-xs font-bold rounded">
                    Block #{block.index}
                  </span>
                  <span className="text-sm font-extrabold text-[#1C192E]">
                    {block.runTitle}
                  </span>
                </div>
                <div className="text-xs text-[#534D72] font-mono">
                  {new Date(block.timestamp).toLocaleString()} | Run ID: {block.runId}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-[#F8F6FF] border border-[#E8E2F7] rounded p-2.5">
                  <span className="font-bold text-[#534D72] block mb-0.5">Block Hash</span>
                  <code className="font-mono text-[11px] text-[#1C192E] break-all">
                    {block.blockHash}
                  </code>
                </div>
                <div className="bg-[#F8F6FF] border border-[#E8E2F7] rounded p-2.5">
                  <span className="font-bold text-[#534D72] flex items-center gap-1 mb-0.5">
                    <LinkIcon className="w-3 h-3 text-[#5E60CE]" />
                    <span>Previous Block Hash</span>
                  </span>
                  <code className="font-mono text-[11px] text-[#534D72] break-all">
                    {block.previousHash}
                  </code>
                </div>
                <div className="bg-[#F8F6FF] border border-[#E8E2F7] rounded p-2.5">
                  <span className="font-bold text-[#534D72] block mb-0.5">Source Bundle Hash</span>
                  <code className="font-mono text-[11px] text-[#1C192E] break-all">
                    {block.sourceHash}
                  </code>
                </div>
                <div className="bg-[#F8F6FF] border border-[#E8E2F7] rounded p-2.5">
                  <span className="font-bold text-[#534D72] block mb-0.5">Batch Merkle/Root Hash</span>
                  <code className="font-mono text-[11px] text-[#1C192E] break-all">
                    {block.batchHash}
                  </code>
                </div>
              </div>

              {block.outputHashes.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-[#1C192E]">
                    Stamped Artefact Hashes ({block.outputHashes.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {block.outputHashes.map((oh, i) => (
                      <div
                        key={`${oh.watermarkId}-${i}`}
                        className="border border-[#E8E2F7] rounded p-2.5 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-[#1C192E]">
                            {OUTPUT_META[oh.type]?.label || oh.type}
                          </span>
                          <span className="font-mono text-[11px] text-[#5E60CE] font-semibold">
                            {oh.watermarkId}
                          </span>
                        </div>
                        <div className="font-mono text-[10px] text-[#534D72] break-all">
                          SHA-256: {oh.hash}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
