import React, { useState } from 'react';
import {
  Check,
  Download,
  KeyRound,
  LogOut,
  Save,
  Server,
  Trash2,
  UserCheck,
} from 'lucide-react';
import type { HealthStatus, OutputType } from '../types/artefact';
import { ALL_OUTPUT_TYPES, OUTPUT_META } from '../utils/clientProvenance';
import type { AuthUser, OperatorSettings } from '../utils/storage';

interface SettingsPageProps {
  settings: OperatorSettings;
  onSaveSettings: (updated: OperatorSettings) => void;
  health: HealthStatus | null;
  authUser: AuthUser | null;
  onOpenAuthModal: (mode: 'login' | 'signup' | 'forgot') => void;
  onLogout: () => void;
  onExportAllData: () => void;
  onClearAllData: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  onSaveSettings,
  health,
  authUser,
  onOpenAuthModal,
  onLogout,
  onExportAllData,
  onClearAllData,
}) => {
  const [draft, setDraft] = useState<OperatorSettings>(settings);
  const [savedBanner, setSavedBanner] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const toggleDefaultOutput = (type: OutputType) => {
    setDraft((prev) => {
      const exists = prev.defaultOutputs.includes(type);
      if (exists && prev.defaultOutputs.length === 1) return prev;
      return {
        ...prev,
        defaultOutputs: exists
          ? prev.defaultOutputs.filter((t) => t !== type)
          : [...prev.defaultOutputs, type],
      };
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(draft);
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white border border-[#E8E2F7] rounded-lg p-6 space-y-1">
        <div className="text-xs font-bold uppercase tracking-wider text-[#5E60CE]">
          Workspace & Account Configuration
        </div>
        <h1 className="text-2xl font-extrabold text-[#1C192E]">Operator Settings</h1>
        <p className="text-sm text-[#534D72]">
          Manage your operator account, default transformation controls, server runtime status, and
          saved data.
        </p>
      </div>

      {/* Account & Authentication Section */}
      <div className="bg-white border border-[#E8E2F7] rounded-lg p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-extrabold text-[#1C192E] flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#5E60CE]" />
              <span>Operator Account & Authentication</span>
            </h2>
            <p className="text-xs text-[#534D72]">
              Associate your saved control presets, run history, and default preferences with your
              authenticated account.
            </p>
          </div>

          {authUser ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenAuthModal('forgot')}
                className="px-3 py-2 bg-[#F8F6FF] hover:bg-[#E0AAFF]/30 border border-[#B794F4] text-xs font-semibold text-[#1C192E] rounded-md flex items-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5 text-[#5E60CE]" />
                <span>Reset Password</span>
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="px-3 py-2 bg-[#FEF2F2] hover:bg-[#DC2626] hover:text-white border border-[#DC2626] text-xs font-semibold text-[#DC2626] rounded-md flex items-center gap-1.5 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenAuthModal('login')}
                className="px-4 py-2 bg-[#7B6DFF] hover:bg-[#5E60CE] text-white text-xs font-semibold rounded-md"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => onOpenAuthModal('signup')}
                className="px-4 py-2 bg-[#F8F6FF] hover:bg-[#E0AAFF]/30 border border-[#B794F4] text-xs font-semibold text-[#1C192E] rounded-md"
              >
                Create Account
              </button>
              <button
                type="button"
                onClick={() => onOpenAuthModal('forgot')}
                className="px-3 py-2 text-xs font-semibold text-[#5E60CE] hover:underline"
              >
                Reset Password
              </button>
            </div>
          )}
        </div>

        {authUser && (
          <div className="bg-[#F8F6FF] border border-[#E8E2F7] rounded-md p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-[#534D72] block">Display Name</span>
              <span className="font-bold text-[#1C192E]">{authUser.displayName}</span>
            </div>
            <div>
              <span className="text-[#534D72] block">Email Address</span>
              <span className="font-bold text-[#1C192E]">{authUser.email}</span>
            </div>
            <div>
              <span className="text-[#534D72] block">Account ID</span>
              <span className="font-mono text-[#5E60CE]">{authUser.id}</span>
            </div>
          </div>
        )}
      </div>

      {/* Default Operator Preferences */}
      <form
        onSubmit={handleSave}
        className="bg-white border border-[#E8E2F7] rounded-lg p-6 space-y-5"
      >
        <h2 className="text-base font-extrabold text-[#1C192E]">
          Default Transformation Controls
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#1C192E] mb-1">
              Operator Name (used on approval stamps)
            </label>
            <input
              type="text"
              value={draft.displayName}
              onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
              placeholder="e.g. Communications Duty Officer"
              className="w-full px-3 py-2 text-sm bg-[#F8F6FF] border border-[#E8E2F7] rounded-md"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#1C192E] mb-1">
              Default Output Language
            </label>
            <input
              type="text"
              value={draft.defaultLanguage}
              onChange={(e) => setDraft({ ...draft, defaultLanguage: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-[#F8F6FF] border border-[#E8E2F7] rounded-md"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#1C192E] mb-1">
              Default Target Audience
            </label>
            <input
              type="text"
              value={draft.defaultAudience}
              onChange={(e) => setDraft({ ...draft, defaultAudience: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-[#F8F6FF] border border-[#E8E2F7] rounded-md"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#1C192E] mb-1">
              Default Tone
            </label>
            <input
              type="text"
              value={draft.defaultTone}
              onChange={(e) => setDraft({ ...draft, defaultTone: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-[#F8F6FF] border border-[#E8E2F7] rounded-md"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#1C192E] mb-2">
            Default Selected Output Formats
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {ALL_OUTPUT_TYPES.map((type) => {
              const selected = draft.defaultOutputs.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleDefaultOutput(type)}
                  className={`p-2.5 text-left border rounded-md text-xs font-semibold flex items-center justify-between transition-colors ${
                    selected
                      ? 'bg-[#F8F6FF] border-[#7B6DFF] text-[#1C192E]'
                      : 'bg-white border-[#E8E2F7] text-[#534D72]'
                  }`}
                >
                  <span>{OUTPUT_META[type].label}</span>
                  {selected && <Check className="w-3.5 h-3.5 text-[#7B6DFF]" />}
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-xs font-semibold text-[#1C192E] cursor-pointer">
          <input
            type="checkbox"
            checked={draft.requireHumanApproval}
            onChange={(e) =>
              setDraft({ ...draft, requireHumanApproval: e.target.checked })
            }
            className="rounded border-[#B794F4] text-[#7B6DFF]"
          />
          <span>Require human approval before copying or exporting outputs by default</span>
        </label>

        <div className="flex items-center justify-between pt-2 border-t border-[#E8E2F7]">
          {savedBanner ? (
            <span className="text-xs font-bold text-[#16A34A]">
              Settings saved and synced.
            </span>
          ) : (
            <span />
          )}
          <button
            type="submit"
            className="px-4 py-2 bg-[#7B6DFF] hover:bg-[#5E60CE] text-white text-xs font-semibold rounded-md flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Default Settings</span>
          </button>
        </div>
      </form>

      {/* Server Runtime Status */}
      <div className="bg-white border border-[#E8E2F7] rounded-lg p-6 space-y-3">
        <h2 className="text-base font-extrabold text-[#1C192E] flex items-center gap-2">
          <Server className="w-4 h-4 text-[#5E60CE]" />
          <span>Server & Gemini API Status (Read-Only)</span>
        </h2>
        <p className="text-xs text-[#534D72]">
          The Gemini API key is read strictly on the server from <code className="font-mono">process.env.GEMINI_API_KEY</code> and is never exposed to the browser bundle.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-[#F8F6FF] border border-[#E8E2F7] rounded p-3">
            <span className="text-[#534D72] block">GEMINI_API_KEY Status</span>
            <span
              className={`font-bold ${
                health?.apiKeyConfigured ? 'text-[#16A34A]' : 'text-[#DC2626]'
              }`}
            >
              {health?.apiKeyConfigured ? 'Configured on Server' : 'Not Configured'}
            </span>
          </div>
          <div className="bg-[#F8F6FF] border border-[#E8E2F7] rounded p-3">
            <span className="text-[#534D72] block">Primary Model</span>
            <span className="font-mono font-bold text-[#1C192E]">
              {health?.model || 'gemini-2.5-flash'}
            </span>
          </div>
          <div className="bg-[#F8F6FF] border border-[#E8E2F7] rounded p-3">
            <span className="text-[#534D72] block">Ledger Blocks</span>
            <span className="font-mono font-bold text-[#1C192E]">
              {health?.ledger?.blockCount ?? 0} ({health?.ledger?.valid ? 'Valid' : 'Unverified'})
            </span>
          </div>
        </div>
      </div>

      {/* Data Export & Clear */}
      <div className="bg-white border border-[#E8E2F7] rounded-lg p-6 space-y-4">
        <h2 className="text-base font-extrabold text-[#1C192E]">
          Workspace Data Management
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onExportAllData}
            className="px-4 py-2 bg-[#F8F6FF] hover:bg-[#E0AAFF]/30 border border-[#B794F4] text-xs font-semibold text-[#1C192E] rounded-md flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-[#5E60CE]" />
            <span>Export All Runs & Presets (.JSON)</span>
          </button>

          {!confirmClear ? (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="px-4 py-2 bg-[#FEF2F2] hover:bg-[#DC2626] hover:text-white border border-[#DC2626] text-xs font-semibold text-[#DC2626] rounded-md flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Local Workspace Data</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onClearAllData();
                  setConfirmClear(false);
                }}
                className="px-3 py-2 bg-[#DC2626] text-white text-xs font-bold rounded-md"
              >
                Confirm Clear All
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="px-3 py-2 text-xs text-[#534D72]"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
