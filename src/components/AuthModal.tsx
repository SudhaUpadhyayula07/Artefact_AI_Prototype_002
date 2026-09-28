import React, { useState } from 'react';
import { KeyRound, Loader2, Lock, Mail, ShieldCheck, User, X } from 'lucide-react';
import type { ControlPreset, RunRecord } from '../types/artefact';
import type { AuthUser, OperatorSettings } from '../utils/storage';

interface AuthModalProps {
  initialMode?: 'login' | 'signup' | 'forgot';
  onClose: () => void;
  onAuthenticated: (payload: {
    user: AuthUser;
    token: string;
    runs: RunRecord[];
    presets: ControlPreset[];
    settings?: Partial<OperatorSettings>;
  }) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  initialMode = 'login',
  onClose,
  onAuthenticated,
}) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'reset'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleLoginOrSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          displayName: displayName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Authentication failed.');
      }
      onAuthenticated({
        user: data.user,
        token: data.token,
        runs: Array.isArray(data.runs) ? data.runs : [],
        presets: Array.isArray(data.presets) ? data.presets : [],
        settings: data.settings || {},
      });
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setGeneratedCode(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Could not generate reset code.');
      }
      setGeneratedCode(data.resetToken);
      setResetToken(data.resetToken);
      setNotice(data.message || 'Reset code generated. Enter a new password below.');
      setMode('reset');
    } catch (err) {
      setError((err as Error).message || 'Reset request failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          resetToken: resetToken.trim(),
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Password reset failed.');
      }
      setNotice('Password has been reset. Please sign in with your new password.');
      setPassword('');
      setGeneratedCode(null);
      setMode('login');
    } catch (err) {
      setError((err as Error).message || 'Password reset failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1C192E]/60 flex items-center justify-center p-4">
      <div className="bg-white border border-[#E8E2F7] rounded-lg max-w-md w-full p-6 space-y-5 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#5E60CE]">
              Operator Account
            </span>
            <h2 className="text-xl font-extrabold text-[#1C192E] mt-0.5">
              {mode === 'login' && 'Sign in to Artefact.AI'}
              {mode === 'signup' && 'Create an operator account'}
              {mode === 'forgot' && 'Reset your password'}
              {mode === 'reset' && 'Set a new password'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#534D72] hover:text-[#1C192E] hover:bg-[#F8F6FF] rounded-md"
            aria-label="Close authentication modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[#534D72] leading-relaxed">
          {mode === 'login' &&
            'Sign in to sync your saved control presets, run history, and operator profile across sessions.'}
          {mode === 'signup' &&
            'Create a secure account. Passwords are salted and hashed with scrypt on the server.'}
          {mode === 'forgot' &&
            'Enter your account email to generate a time-limited password recovery verification code.'}
          {mode === 'reset' &&
            'Provide your verification code and choose a new password (minimum 8 characters).'}
        </p>

        {error && (
          <div className="bg-[#FEF2F2] border border-[#DC2626] rounded-md p-3 text-xs text-[#DC2626]">
            {error}
          </div>
        )}

        {notice && (
          <div className="bg-[#ECFDF5] border border-[#16A34A] rounded-md p-3 text-xs text-[#16A34A] space-y-1">
            <div>{notice}</div>
            {generatedCode && (
              <div className="font-mono text-xs font-bold text-[#1C192E] bg-white border border-[#E8E2F7] rounded px-2 py-1 mt-1">
                Recovery Code: {generatedCode}
              </div>
            )}
          </div>
        )}

        {(mode === 'login' || mode === 'signup') && (
          <form onSubmit={handleLoginOrSignup} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-bold text-[#1C192E] mb-1">
                  Operator display name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#534D72] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Priya Sharma, Comms Lead"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-[#F8F6FF] border border-[#E8E2F7] rounded-md focus:outline-none focus:border-[#5E60CE]"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#1C192E] mb-1">
                Email address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#534D72] absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@organisation.org"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-[#F8F6FF] border border-[#E8E2F7] rounded-md focus:outline-none focus:border-[#5E60CE]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-[#1C192E]">
                  Password
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setNotice(null);
                      setMode('forgot');
                    }}
                    className="text-xs font-semibold text-[#5E60CE] hover:text-[#7B6DFF]"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#534D72] absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-[#F8F6FF] border border-[#E8E2F7] rounded-md focus:outline-none focus:border-[#5E60CE]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#7B6DFF] hover:bg-[#5E60CE] disabled:opacity-50 text-white text-sm font-semibold rounded-md flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>{mode === 'signup' ? 'Create Account' : 'Sign In'}</span>
                </>
              )}
            </button>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleRequestReset} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#1C192E] mb-1">
                Account email address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#534D72] absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@organisation.org"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-[#F8F6FF] border border-[#E8E2F7] rounded-md focus:outline-none focus:border-[#5E60CE]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#7B6DFF] hover:bg-[#5E60CE] disabled:opacity-50 text-white text-sm font-semibold rounded-md flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating Reset Code...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Generate Password Reset Code</span>
                </>
              )}
            </button>
          </form>
        )}

        {mode === 'reset' && (
          <form onSubmit={handleConfirmReset} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#1C192E] mb-1">
                Account email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#F8F6FF] border border-[#E8E2F7] rounded-md focus:outline-none focus:border-[#5E60CE]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1C192E] mb-1">
                Reset verification code
              </label>
              <input
                type="text"
                required
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                placeholder="RST-XXXX-XXXX"
                className="w-full px-3 py-2 text-sm font-mono bg-[#F8F6FF] border border-[#E8E2F7] rounded-md focus:outline-none focus:border-[#5E60CE]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1C192E] mb-1">
                New password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full px-3 py-2 text-sm bg-[#F8F6FF] border border-[#E8E2F7] rounded-md focus:outline-none focus:border-[#5E60CE]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#7B6DFF] hover:bg-[#5E60CE] disabled:opacity-50 text-white text-sm font-semibold rounded-md flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Confirm Password Reset</span>
                </>
              )}
            </button>
          </form>
        )}

        <div className="pt-3 border-t border-[#E8E2F7] flex items-center justify-between text-xs text-[#534D72]">
          {mode === 'login' ? (
            <>
              <span>New operator?</span>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setNotice(null);
                  setMode('signup');
                }}
                className="font-bold text-[#5E60CE] hover:text-[#7B6DFF]"
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              <span>Already have an account?</span>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setNotice(null);
                  setMode('login');
                }}
                className="font-bold text-[#5E60CE] hover:text-[#7B6DFF]"
              >
                Back to sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
