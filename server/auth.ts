import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { ControlPreset, RunRecord } from '../src/types/artefact.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

export interface StoredUserAccount {
  id: string;
  email: string;
  displayName: string;
  passwordSalt: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
  runs: RunRecord[];
  presets: ControlPreset[];
  settings?: Record<string, unknown>;
}

interface SessionRecord {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: number;
}

interface PasswordResetRecord {
  token: string;
  userId: string;
  email: string;
  expiresAt: number;
  used: boolean;
}

interface UsersStore {
  users: StoredUserAccount[];
  sessions: SessionRecord[];
  resets: PasswordResetRecord[];
}

function ensureUsersFile(): UsersStore {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(USERS_FILE)) {
    const initial: UsersStore = { users: [], sessions: [], resets: [] };
    fs.writeFileSync(USERS_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<UsersStore>;
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      resets: Array.isArray(parsed.resets) ? parsed.resets : [],
    };
  } catch {
    const fallback: UsersStore = { users: [], sessions: [], resets: [] };
    fs.writeFileSync(USERS_FILE, JSON.stringify(fallback, null, 2), 'utf-8');
    return fallback;
  }
}

function saveUsersStore(store: UsersStore): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const now = Date.now();
  store.sessions = store.sessions.filter((s) => s.expiresAt > now);
  store.resets = store.resets.filter((r) => r.expiresAt > now && !r.used);
  fs.writeFileSync(USERS_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

function hashPassword(password: string, saltHex: string): string {
  const derived = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), 64);
  return derived.toString('hex');
}

function verifyPassword(password: string, saltHex: string, expectedHashHex: string): boolean {
  const derived = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), 64);
  const expected = Buffer.from(expectedHashHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export interface PublicUserProfile {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export function toPublicUser(u: StoredUserAccount): PublicUserProfile {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    createdAt: u.createdAt,
  };
}

export function registerUser(params: {
  email: string;
  password: string;
  displayName: string;
}): { user: PublicUserProfile; token: string; account: StoredUserAccount } {
  const email = params.email.trim().toLowerCase();
  const displayName = params.displayName.trim() || email.split('@')[0];
  const password = params.password;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Please provide a valid email address.');
  }
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  const store = ensureUsersFile();
  const existing = store.users.find((u) => u.email.toLowerCase() === email);
  if (existing) {
    throw new Error('An account with this email address already exists.');
  }

  const saltHex = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, saltHex);
  const nowIso = new Date().toISOString();

  const newUser: StoredUserAccount = {
    id: `usr_${crypto.randomBytes(8).toString('hex')}`,
    email,
    displayName,
    passwordSalt: saltHex,
    passwordHash,
    createdAt: nowIso,
    updatedAt: nowIso,
    runs: [],
    presets: [],
    settings: {},
  };

  const token = crypto.randomBytes(32).toString('hex');
  store.users.push(newUser);
  store.sessions.push({
    token,
    userId: newUser.id,
    createdAt: nowIso,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  });
  saveUsersStore(store);

  return {
    user: toPublicUser(newUser),
    token,
    account: newUser,
  };
}

export function loginUser(params: {
  email: string;
  password: string;
}): { user: PublicUserProfile; token: string; account: StoredUserAccount } {
  const email = params.email.trim().toLowerCase();
  const password = params.password || '';

  const store = ensureUsersFile();
  const account = store.users.find((u) => u.email.toLowerCase() === email);
  if (!account || !verifyPassword(password, account.passwordSalt, account.passwordHash)) {
    throw new Error('Invalid email or password.');
  }

  const token = crypto.randomBytes(32).toString('hex');
  store.sessions.push({
    token,
    userId: account.id,
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });
  saveUsersStore(store);

  return {
    user: toPublicUser(account),
    token,
    account,
  };
}

export function logoutSession(token: string): void {
  if (!token) return;
  const store = ensureUsersFile();
  store.sessions = store.sessions.filter((s) => s.token !== token);
  saveUsersStore(store);
}

export function getUserBySessionToken(token: string): StoredUserAccount | null {
  if (!token) return null;
  const store = ensureUsersFile();
  const now = Date.now();
  const session = store.sessions.find((s) => s.token === token && s.expiresAt > now);
  if (!session) return null;
  const user = store.users.find((u) => u.id === session.userId);
  return user || null;
}

export function createPasswordResetToken(emailInput: string): {
  resetToken: string;
  expiresAt: string;
  email: string;
} {
  const email = emailInput.trim().toLowerCase();
  if (!email) {
    throw new Error('Please enter your account email address.');
  }
  const store = ensureUsersFile();
  const user = store.users.find((u) => u.email.toLowerCase() === email);
  if (!user) {
    throw new Error('No account found with that email address.');
  }

  // Generate an 8-character uppercase alphanumeric reset code
  const rawBytes = crypto.randomBytes(5).toString('hex').toUpperCase();
  const resetToken = `RST-${rawBytes.slice(0, 4)}-${rawBytes.slice(4, 8)}`;
  const expiresAtMs = Date.now() + 30 * 60 * 1000; // 30 minutes

  store.resets = store.resets.filter((r) => r.userId !== user.id);
  store.resets.push({
    token: resetToken,
    userId: user.id,
    email: user.email,
    expiresAt: expiresAtMs,
    used: false,
  });
  saveUsersStore(store);

  return {
    resetToken,
    expiresAt: new Date(expiresAtMs).toISOString(),
    email: user.email,
  };
}

export function resetPasswordWithToken(params: {
  email: string;
  resetToken: string;
  newPassword: string;
}): PublicUserProfile {
  const email = params.email.trim().toLowerCase();
  const resetToken = params.resetToken.trim().toUpperCase();
  const newPassword = params.newPassword || '';

  if (newPassword.length < 8) {
    throw new Error('New password must be at least 8 characters long.');
  }

  const store = ensureUsersFile();
  const now = Date.now();
  const resetRecord = store.resets.find(
    (r) =>
      r.email.toLowerCase() === email &&
      r.token.toUpperCase() === resetToken &&
      !r.used &&
      r.expiresAt > now
  );

  if (!resetRecord) {
    throw new Error('Invalid or expired password reset code.');
  }

  const user = store.users.find((u) => u.id === resetRecord.userId);
  if (!user) {
    throw new Error('Account no longer exists.');
  }

  const newSalt = crypto.randomBytes(16).toString('hex');
  user.passwordSalt = newSalt;
  user.passwordHash = hashPassword(newPassword, newSalt);
  user.updatedAt = new Date().toISOString();
  resetRecord.used = true;

  // Invalidate existing sessions on password reset for security
  store.sessions = store.sessions.filter((s) => s.userId !== user.id);
  saveUsersStore(store);

  return toPublicUser(user);
}

export function updateUserAccountData(
  userId: string,
  updates: {
    displayName?: string;
    runs?: RunRecord[];
    presets?: ControlPreset[];
    settings?: Record<string, unknown>;
  }
): StoredUserAccount {
  const store = ensureUsersFile();
  const user = store.users.find((u) => u.id === userId);
  if (!user) {
    throw new Error('User account not found.');
  }

  if (typeof updates.displayName === 'string' && updates.displayName.trim()) {
    user.displayName = updates.displayName.trim();
  }
  if (Array.isArray(updates.runs)) {
    user.runs = updates.runs.slice(0, 50);
  }
  if (Array.isArray(updates.presets)) {
    user.presets = updates.presets.slice(0, 50);
  }
  if (updates.settings && typeof updates.settings === 'object') {
    user.settings = { ...(user.settings || {}), ...updates.settings };
  }
  user.updatedAt = new Date().toISOString();
  saveUsersStore(store);
  return user;
}
