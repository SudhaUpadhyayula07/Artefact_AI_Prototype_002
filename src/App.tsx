import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  FileCheck,
  FileText,
  History as HistoryIcon,
  Home,
  LayoutDashboard,
  Link2,
  LogIn,
  LogOut,
  Menu,
  Scale,
  Settings,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { AuthModal } from './components/AuthModal';
import { LiveRunView } from './components/LiveRunView';
import { DashboardPage } from './pages/DashboardPage';
import { HistoryPage } from './pages/HistoryPage';
import { HomePage } from './pages/HomePage';
import { LedgerPage } from './pages/LedgerPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ResultsPage } from './pages/ResultsPage';
import { SettingsPage } from './pages/SettingsPage';
import { TermsPage } from './pages/TermsPage';
import { VerifyPage } from './pages/VerifyPage';
import type {
  ConsistencyReport,
  ControlPreset,
  FactBase,
  GeneratedArtefact,
  HealthStatus,
  ModerationResult,
  OutputType,
  PipelineStepState,
  RunControls,
  RunRecord,
  SourceItem,
} from './types/artefact';
import {
  buildDefaultControlsFromSettings,
  clearAllLocalData,
  clearAllRuns,
  deletePreset,
  deleteRunById,
  getAuthToken,
  getStoredAuthUser,
  hasAcceptedTerms,
  loadOperatorSettings,
  loadPresets,
  loadRuns,
  saveOperatorSettings,
  savePreset,
  savePresetsList,
  saveRuns,
  setAcceptedTerms,
  setAuthSession,
  upsertRun,
  type AuthUser,
  type OperatorSettings,
} from './utils/storage';

const INITIAL_STEPS: PipelineStepState[] = [
  {
    id: 'moderation',
    label: '1. Source Safety & Policy Check',
    description: 'Evaluating combined source material across 6 risk categories.',
    status: 'waiting',
  },
  {
    id: 'orchestrator',
    label: '2. Orchestrator Fact Base',
    description: 'Extracting verifiable claims, numbers, entities, and angle.',
    status: 'waiting',
  },
  {
    id: 'specialists',
    label: '3. Parallel Specialist Generation',
    description: 'Transforming fact base into selected communication formats.',
    status: 'waiting',
  },
  {
    id: 'validation',
    label: '4. Grounding & Fact Validation',
    description: 'Checking every claim against source quotes with auto-retry.',
    status: 'waiting',
  },
  {
    id: 'consistency',
    label: '5. Cross-Output Consistency Check',
    description: 'Comparing numbers, dates, and claims across generated formats.',
    status: 'waiting',
  },
  {
    id: 'provenance',
    label: '6. Provenance & Hash-Chain Ledger',
    description: 'Computing SHA-256 hashes, watermarks, and recording ledger block.',
    status: 'waiting',
  },
];

export default function App() {
  const [route, setRoute] = useState<string>(() => window.location.pathname || '/');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Health & Server state
  const [health, setHealth] = useState<HealthStatus | null>(null);

  // Auth state
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => getStoredAuthUser());
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup' | 'forgot' | null>(null);

  // Operator settings, presets, runs
  const [settings, setSettings] = useState<OperatorSettings>(() =>
    loadOperatorSettings(getStoredAuthUser()?.id)
  );
  const [runs, setRuns] = useState<RunRecord[]>(() => loadRuns(getStoredAuthUser()?.id));
  const [presets, setPresets] = useState<ControlPreset[]>(() =>
    loadPresets(getStoredAuthUser()?.id)
  );
  const [termsAccepted, setTermsAccepted] = useState<boolean>(() => hasAcceptedTerms());

  // Current Dashboard state
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [controls, setControls] = useState<RunControls>(() =>
    buildDefaultControlsFromSettings(loadOperatorSettings(getStoredAuthUser()?.id))
  );
  const [activeRun, setActiveRun] = useState<RunRecord | null>(() => {
    const existing = loadRuns(getStoredAuthUser()?.id);
    return existing[0] || null;
  });

  // Live Run modal state
  const [liveRunOpen, setLiveRunOpen] = useState(false);
  const [liveSteps, setLiveSteps] = useState<PipelineStepState[]>(INITIAL_STEPS);
  const [liveArtefacts, setLiveArtefacts] = useState<Partial<Record<OutputType, GeneratedArtefact>>>({});
  const [liveStartedAt, setLiveStartedAt] = useState<number>(Date.now());
  const [liveError, setLiveError] = useState<string | null>(null);
  const [moderationConfirmPrompt, setModerationConfirmPrompt] = useState<string | null>(null);
  const [liveComplete, setLiveComplete] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const navigate = (nextRoute: string) => {
    window.history.pushState({}, '', nextRoute);
    setRoute(nextRoute);
    setMobileNavOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const onPopState = () => setRoute(window.location.pathname || '/');
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((data: HealthStatus) => setHealth(data))
      .catch(() => {});
  }, []);

  // Verify existing session token on mount
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          setAuthSession('', null);
          setAuthUser(null);
          return;
        }
        const data = await res.json();
        if (data.user) {
          setAuthSession(token, data.user);
          setAuthUser(data.user);
          if (Array.isArray(data.runs)) {
            saveRuns(data.runs, data.user.id, true);
            setRuns(data.runs);
            if (data.runs.length > 0 && !activeRun) {
              setActiveRun(data.runs[0]);
            }
          }
          if (Array.isArray(data.presets)) {
            savePresetsList(data.presets, data.user.id, true);
            setPresets(data.presets);
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleAuthenticated = (payload: {
    user: AuthUser;
    token: string;
    runs: RunRecord[];
    presets: ControlPreset[];
    settings?: Partial<OperatorSettings>;
  }) => {
    setAuthSession(payload.token, payload.user);
    setAuthUser(payload.user);

    const localUserRuns = loadRuns(payload.user.id);
    const mergedRuns = payload.runs.length > 0 ? payload.runs : localUserRuns;
    saveRuns(mergedRuns, payload.user.id);
    setRuns(mergedRuns);
    if (mergedRuns.length > 0) {
      setActiveRun(mergedRuns[0]);
    }

    const localUserPresets = loadPresets(payload.user.id);
    const mergedPresets = payload.presets.length > 0 ? payload.presets : localUserPresets;
    savePresetsList(mergedPresets, payload.user.id);
    setPresets(mergedPresets);

    const baseSettings = loadOperatorSettings(payload.user.id);
    const mergedSettings: OperatorSettings = {
      ...baseSettings,
      ...(payload.settings || {}),
      displayName:
        payload.user.displayName || payload.settings?.displayName || baseSettings.displayName,
    };
    saveOperatorSettings(mergedSettings, payload.user.id);
    setSettings(mergedSettings);
  };

  const handleLogout = async () => {
    const token = getAuthToken();
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {}
    }
    setAuthSession('', null);
    setAuthUser(null);
    const guestSettings = loadOperatorSettings();
    setSettings(guestSettings);
    setRuns(loadRuns());
    setPresets(loadPresets());
  };

  const handleAcceptTermsChange = (accepted: boolean) => {
    setTermsAccepted(accepted);
    setAcceptedTerms(accepted);
  };

  const handleSavePreset = (name: string) => {
    const updated = savePreset(name, controls, authUser?.id);
    setPresets(updated);
  };

  const handleDeletePreset = (id: string) => {
    const updated = deletePreset(id, authUser?.id);
    setPresets(updated);
  };

  const executeRunPipeline = async (skipModerationWarning = false) => {
    const readableSources = sources.filter(
      (s) => s.extractionStatus === 'ready' && s.rawText.trim().length > 0
    );
    if (readableSources.length === 0 || controls.selectedOutputs.length === 0) return;

    const runId = `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const nowStart = Date.now();
    setLiveStartedAt(nowStart);
    setLiveError(null);
    setModerationConfirmPrompt(null);
    setLiveComplete(false);
    setLiveSteps(INITIAL_STEPS.map((s) => ({ ...s, status: 'waiting', message: undefined })));

    const initialArtefacts: Partial<Record<OutputType, GeneratedArtefact>> = {};
    controls.selectedOutputs.forEach((t) => {
      initialArtefacts[t] = {
        type: t,
        status: 'waiting',
        approvalStatus: controls.requireHumanApproval ? 'needs_approval' : 'approved',
        versions: [],
      };
    });
    setLiveArtefacts(initialArtefacts);
    setLiveRunOpen(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let accSourceHash = '';
    let accInputMod: ModerationResult | undefined;
    let accFactBase: FactBase | undefined;
    let accConsistency: ConsistencyReport | undefined;
    const accArtefacts: Partial<Record<OutputType, GeneratedArtefact>> = { ...initialArtefacts };

    try {
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId,
          sources: readableSources,
          controls,
          skipModerationWarning,
        }),
        signal: abortController.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Run request failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() || '';

        for (const chunk of chunks) {
          const lines = chunk.split('\n');
          let eventName = 'message';
          let dataRaw = '';
          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              dataRaw += line.slice(5).trim();
            }
          }
          if (!dataRaw) continue;
          let payload: any;
          try {
            payload = JSON.parse(dataRaw);
          } catch {
            continue;
          }

          if (eventName === 'step_update') {
            setLiveSteps((prev) =>
              prev.map((step) =>
                step.id === payload.stepId
                  ? { ...step, status: payload.status, message: payload.message }
                  : step
              )
            );
          } else if (eventName === 'moderation_result') {
            accInputMod = payload.inputModeration;
            accSourceHash = payload.sourceHash || accSourceHash;
          } else if (eventName === 'moderation_confirm_required') {
            setModerationConfirmPrompt(payload.reason);
          } else if (eventName === 'fact_base_ready') {
            accFactBase = payload.factBase;
            accSourceHash = payload.sourceHash || accSourceHash;
          } else if (eventName === 'artefact_update') {
            const t = payload.type as OutputType;
            accArtefacts[t] = payload.artefact;
            setLiveArtefacts({ ...accArtefacts });
          } else if (eventName === 'consistency_ready') {
            accConsistency = payload.consistency;
          } else if (eventName === 'run_error') {
            setLiveError(payload.message || 'Pipeline failed.');
          } else if (eventName === 'run_complete') {
            const completedRun: RunRecord = {
              runId: payload.runId || runId,
              title: payload.title || accFactBase?.topic || readableSources[0]?.title || 'Run',
              createdAt: new Date(nowStart).toISOString(),
              completedAt: new Date().toISOString(),
              status: payload.status || 'completed',
              sources: readableSources,
              controls: JSON.parse(JSON.stringify(controls)),
              sourceHash: payload.sourceHash || accSourceHash,
              batchHash: payload.batchHash,
              inputModeration: accInputMod,
              factBase: accFactBase,
              artefacts: { ...accArtefacts },
              consistency: accConsistency,
              ledgerBlockIndex: payload.ledgerBlockIndex,
            };
            const updatedRuns = upsertRun(completedRun, authUser?.id);
            setRuns(updatedRuns);
            setActiveRun(completedRun);
            setLiveComplete(true);
            // Refresh health block count
            fetch('/api/health')
              .then((r) => r.json())
              .then((d: HealthStatus) => setHealth(d))
              .catch(() => {});
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setLiveError('Run cancelled by operator.');
      } else {
        setLiveError((err as Error).message || 'Connection interrupted during run.');
      }
    }
  };

  const handleUpdateRun = (updated: RunRecord) => {
    const nextRuns = upsertRun(updated, authUser?.id);
    setRuns(nextRuns);
    setActiveRun(updated);
  };

  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/results', label: 'Results', icon: FileCheck },
    { path: '/history', label: 'History', icon: HistoryIcon },
    { path: '/verify', label: 'Verify', icon: ShieldCheck },
    { path: '/ledger', label: 'Ledger', icon: Link2 },
    { path: '/settings', label: 'Settings', icon: Settings },
    { path: '/terms', label: 'Terms', icon: Scale },
  ];

  const operatorDisplayName =
    authUser?.displayName || settings.displayName || 'Authenticated Operator';

  return (
    <div className="min-h-screen bg-[#F8F6FF] text-[#1C192E] flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#E8E2F7]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex items-center gap-2.5 text-left group"
            >
              <div className="w-8 h-8 rounded-md bg-[#7B6DFF] group-hover:bg-[#5E60CE] flex items-center justify-center text-white font-extrabold text-sm transition-colors">
                A
              </div>
              <div>
                <span className="text-base font-extrabold tracking-tight text-[#1C192E] block leading-none">
                  Artefact.AI
                </span>
                <span className="text-[10px] font-semibold text-[#534D72] block mt-0.5">
                  Verified Multi-Format Transformation
                </span>
              </div>
            </button>

            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = route === item.path;
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => navigate(item.path)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      active
                        ? 'bg-[#7B6DFF] text-white'
                        : 'text-[#534D72] hover:text-[#1C192E] hover:bg-[#F8F6FF]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
            {health && !health.apiKeyConfigured && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-[#FEF2F2] border border-[#DC2626] rounded text-[11px] font-semibold text-[#DC2626]">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>GEMINI_API_KEY Missing</span>
              </div>
            )}

            {authUser ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/settings')}
                  className="px-2.5 py-1.5 bg-[#F8F6FF] border border-[#B794F4] rounded-md text-xs font-bold text-[#1C192E] hover:bg-[#E0AAFF]/30 transition-colors"
                >
                  {authUser.displayName}
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Log out"
                  className="px-2.5 py-1.5 bg-white hover:bg-[#FEF2F2] border border-[#E8E2F7] hover:border-[#DC2626] text-xs font-semibold text-[#534D72] hover:text-[#DC2626] rounded-md flex items-center gap-1 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Log out</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAuthModalMode('login')}
                  className="px-3 py-1.5 bg-[#F8F6FF] hover:bg-[#E0AAFF]/30 border border-[#B794F4] text-xs font-semibold text-[#1C192E] rounded-md flex items-center gap-1.5 transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5 text-[#5E60CE]" />
                  <span>Sign In</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAuthModalMode('signup')}
                  className="px-3 py-1.5 bg-[#7B6DFF] hover:bg-[#5E60CE] text-white text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Up</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="lg:hidden p-2 text-[#534D72] hover:text-[#1C192E] rounded-md"
              aria-label="Toggle navigation menu"
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileNavOpen && (
          <div className="lg:hidden border-t border-[#E8E2F7] bg-white px-4 py-3 grid grid-cols-2 gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = route === item.path;
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={`px-3 py-2 rounded-md text-xs font-semibold flex items-center gap-2 ${
                    active
                      ? 'bg-[#7B6DFF] text-white'
                      : 'text-[#534D72] hover:bg-[#F8F6FF]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6">
        {route === '/' && (
          <HomePage
            onNavigate={navigate}
            contactEmail={health?.contactEmail || 'ops@artefact.example.com'}
          />
        )}

        {route === '/dashboard' && (
          <DashboardPage
            sources={sources}
            setSources={setSources}
            controls={controls}
            setControls={setControls}
            presets={presets}
            onSavePreset={handleSavePreset}
            onDeletePreset={handleDeletePreset}
            termsAccepted={termsAccepted}
            onAcceptTermsChange={handleAcceptTermsChange}
            onOpenTerms={() => navigate('/terms')}
            apiKeyConfigured={health ? health.apiKeyConfigured : true}
            onStartRun={() => executeRunPipeline(false)}
          />
        )}

        {route === '/results' && (
          <ResultsPage
            run={activeRun}
            operatorName={operatorDisplayName}
            onUpdateRun={handleUpdateRun}
            onNavigate={navigate}
          />
        )}

        {route === '/history' && (
          <HistoryPage
            runs={runs}
            onReopenRun={(r) => {
              setActiveRun(r);
              navigate('/results');
            }}
            onDuplicateSettings={(r) => {
              setControls(JSON.parse(JSON.stringify(r.controls)));
              setSources(JSON.parse(JSON.stringify(r.sources)));
              navigate('/dashboard');
            }}
            onDeleteRun={(runId) => {
              const updated = deleteRunById(runId, authUser?.id);
              setRuns(updated);
              if (activeRun?.runId === runId) {
                setActiveRun(updated[0] || null);
              }
            }}
            onClearAllRuns={() => {
              clearAllRuns(authUser?.id);
              setRuns([]);
              setActiveRun(null);
            }}
          />
        )}

        {route === '/verify' && <VerifyPage />}

        {route === '/ledger' && <LedgerPage />}

        {route === '/settings' && (
          <SettingsPage
            settings={settings}
            onSaveSettings={(updated) => {
              saveOperatorSettings(updated, authUser?.id);
              setSettings(updated);
            }}
            health={health}
            authUser={authUser}
            onOpenAuthModal={(m) => setAuthModalMode(m)}
            onLogout={handleLogout}
            onExportAllData={() => {
              const blob = new Blob(
                [JSON.stringify({ user: authUser, settings, presets, runs }, null, 2)],
                { type: 'application/json;charset=utf-8' }
              );
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `artefact-workspace-${new Date().toISOString().slice(0, 10)}.json`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
            onClearAllData={() => {
              clearAllLocalData(authUser?.id);
              setRuns([]);
              setPresets([]);
              setActiveRun(null);
            }}
          />
        )}

        {route === '/terms' && (
          <TermsPage contactEmail={health?.contactEmail || 'ops@artefact.example.com'} />
        )}

        {!['/', '/dashboard', '/results', '/history', '/verify', '/ledger', '/settings', '/terms'].includes(
          route
        ) && <NotFoundPage onNavigate={navigate} />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#E8E2F7] mt-12">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-5 flex flex-wrap items-center justify-between gap-4 text-xs text-[#534D72]">
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-[#5E60CE]" />
            <span>
              Artefact.AI: Multi-Format Content Transformation, Validation, and Provenance Engine
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/verify')}
              className="hover:text-[#1C192E] underline"
            >
              Verify Content
            </button>
            <button
              type="button"
              onClick={() => navigate('/ledger')}
              className="hover:text-[#1C192E] underline"
            >
              Hash-Chain Ledger
            </button>
            <button
              type="button"
              onClick={() => navigate('/terms')}
              className="hover:text-[#1C192E] underline"
            >
              Terms & Conditions
            </button>
          </div>
        </div>
      </footer>

      {/* Live Run Modal */}
      {liveRunOpen && (
        <LiveRunView
          steps={liveSteps}
          artefacts={liveArtefacts}
          selectedOutputs={controls.selectedOutputs}
          startedAt={liveStartedAt}
          runError={liveError}
          moderationConfirmPrompt={moderationConfirmPrompt}
          onConfirmModerationContinue={() => executeRunPipeline(true)}
          onCancelRun={() => {
            abortControllerRef.current?.abort();
            setLiveRunOpen(false);
          }}
          onRetryWholeRun={() => executeRunPipeline(false)}
          onOpenResults={() => {
            setLiveRunOpen(false);
            navigate('/results');
          }}
          isComplete={liveComplete}
        />
      )}

      {/* Auth Modal */}
      {authModalMode && (
        <AuthModal
          initialMode={authModalMode}
          onClose={() => setAuthModalMode(null)}
          onAuthenticated={handleAuthenticated}
        />
      )}
    </div>
  );
}
