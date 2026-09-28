import type { ControlPreset, OutputType, RunControls, RunRecord } from '../types/artefact';

const BASE_RUNS_KEY = 'artefact_runs_v1';
const BASE_PRESETS_KEY = 'artefact_presets_v1';
const BASE_SETTINGS_KEY = 'artefact_settings_v1';
const TERMS_KEY = 'artefact_terms_accepted_v1';
const AUTH_TOKEN_KEY = 'artefact_auth_token_v1';
const AUTH_USER_KEY = 'artefact_auth_user_v1';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface OperatorSettings {
  displayName: string;
  defaultOutputs: OutputType[];
  defaultAudience: string;
  defaultTone: string;
  defaultLanguage: string;
  defaultDetailLevel: 1 | 2 | 3 | 4 | 5;
  defaultObjective: string;
  defaultContentStyle: string;
  requireHumanApproval: boolean;
}

export const DEFAULT_OPERATOR_SETTINGS: OperatorSettings = {
  displayName: '',
  defaultOutputs: ['linkedin', 'twitter', 'executive_summary'],
  defaultAudience: 'Executives',
  defaultTone: 'Authoritative',
  defaultLanguage: 'English',
  defaultDetailLevel: 3,
  defaultObjective: 'Inform',
  defaultContentStyle: 'Executive style',
  requireHumanApproval: false,
};

export function getAuthToken(): string {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setAuthSession(token: string, user: AuthUser | null): void {
  try {
    if (token && user) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
    }
  } catch {}
}

export function getStoredAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function scopedKey(base: string, userId?: string): string {
  const uid = userId || getStoredAuthUser()?.id;
  return uid ? `${base}_${uid}` : base;
}

export async function syncAccountDataToServer(payload: {
  displayName?: string;
  runs?: RunRecord[];
  presets?: ControlPreset[];
  settings?: OperatorSettings;
}): Promise<void> {
  const token = getAuthToken();
  if (!token) return;
  try {
    await fetch('/api/user/data', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Offline or transient network issue; local storage remains intact
  }
}

export function loadOperatorSettings(userId?: string): OperatorSettings {
  try {
    const raw = localStorage.getItem(scopedKey(BASE_SETTINGS_KEY, userId));
    if (!raw) return DEFAULT_OPERATOR_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_OPERATOR_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_OPERATOR_SETTINGS;
  }
}

export function saveOperatorSettings(settings: OperatorSettings, userId?: string): void {
  try {
    localStorage.setItem(scopedKey(BASE_SETTINGS_KEY, userId), JSON.stringify(settings));
  } catch {}
  void syncAccountDataToServer({
    displayName: settings.displayName,
    settings,
  });
}

export function buildDefaultControlsFromSettings(settings?: OperatorSettings): RunControls {
  const s = settings || loadOperatorSettings();
  return {
    selectedOutputs:
      s.defaultOutputs && s.defaultOutputs.length > 0
        ? [...s.defaultOutputs]
        : ['linkedin', 'twitter', 'executive_summary'],
    targetAudience: s.defaultAudience || 'Executives',
    customAudience: '',
    tone: s.defaultTone || 'Authoritative',
    customTone: '',
    language: s.defaultLanguage || 'English',
    customLanguage: '',
    detailLevel: s.defaultDetailLevel || 3,
    objective: s.defaultObjective || 'Inform',
    customObjective: '',
    contentStyle: s.defaultContentStyle || 'Executive style',
    customStyle: '',
    requireHumanApproval: Boolean(s.requireHumanApproval),
    additionalContext: {
      organisation: '',
      campaign: '',
      mustInclude: '',
      mustAvoid: '',
    },
  };
}

export function loadRuns(userId?: string): RunRecord[] {
  try {
    const raw = localStorage.getItem(scopedKey(BASE_RUNS_KEY, userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRuns(runs: RunRecord[], userId?: string, skipServerSync = false): void {
  const trimmed = runs.slice(0, 50);
  try {
    localStorage.setItem(scopedKey(BASE_RUNS_KEY, userId), JSON.stringify(trimmed));
  } catch {}
  if (!skipServerSync) {
    void syncAccountDataToServer({ runs: trimmed });
  }
}

export function upsertRun(run: RunRecord, userId?: string): RunRecord[] {
  const existing = loadRuns(userId);
  const idx = existing.findIndex((r) => r.runId === run.runId);
  let updated: RunRecord[];
  if (idx >= 0) {
    updated = [...existing];
    updated[idx] = run;
  } else {
    updated = [run, ...existing];
  }
  saveRuns(updated, userId);
  return updated;
}

export function deleteRunById(runId: string, userId?: string): RunRecord[] {
  const updated = loadRuns(userId).filter((r) => r.runId !== runId);
  saveRuns(updated, userId);
  return updated;
}

export function clearAllRuns(userId?: string): void {
  try {
    localStorage.removeItem(scopedKey(BASE_RUNS_KEY, userId));
  } catch {}
  void syncAccountDataToServer({ runs: [] });
}

export function loadPresets(userId?: string): ControlPreset[] {
  try {
    const raw = localStorage.getItem(scopedKey(BASE_PRESETS_KEY, userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePresetsList(
  presets: ControlPreset[],
  userId?: string,
  skipServerSync = false
): void {
  try {
    localStorage.setItem(scopedKey(BASE_PRESETS_KEY, userId), JSON.stringify(presets));
  } catch {}
  if (!skipServerSync) {
    void syncAccountDataToServer({ presets });
  }
}

export function savePreset(name: string, controls: RunControls, userId?: string): ControlPreset[] {
  const presets = loadPresets(userId);
  const newPreset: ControlPreset = {
    id: `preset-${Date.now()}`,
    name: name.trim(),
    createdAt: new Date().toISOString(),
    controls: JSON.parse(JSON.stringify(controls)),
  };
  const updated = [newPreset, ...presets];
  savePresetsList(updated, userId);
  return updated;
}

export function deletePreset(id: string, userId?: string): ControlPreset[] {
  const updated = loadPresets(userId).filter((p) => p.id !== id);
  savePresetsList(updated, userId);
  return updated;
}

export function hasAcceptedTerms(): boolean {
  try {
    return localStorage.getItem(TERMS_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setAcceptedTerms(accepted: boolean): void {
  try {
    if (accepted) {
      localStorage.setItem(TERMS_KEY, 'true');
    } else {
      localStorage.removeItem(TERMS_KEY);
    }
  } catch {}
}

export function clearAllLocalData(userId?: string): void {
  try {
    localStorage.removeItem(scopedKey(BASE_RUNS_KEY, userId));
    localStorage.removeItem(scopedKey(BASE_PRESETS_KEY, userId));
    localStorage.removeItem(scopedKey(BASE_SETTINGS_KEY, userId));
    localStorage.removeItem(TERMS_KEY);
  } catch {}
  void syncAccountDataToServer({ runs: [], presets: [], settings: DEFAULT_OPERATOR_SETTINGS });
}
