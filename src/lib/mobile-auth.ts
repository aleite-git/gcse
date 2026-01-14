import bcrypt from 'bcryptjs';
import type { ActiveSubject } from './active-subjects';

export const USERNAME_MIN_LENGTH = 5;
export const USERNAME_MAX_LENGTH = 15;
export const USERNAME_REGEX = /^[A-Za-z0-9_]+$/;
export const USERNAME_CHANGE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

export interface MobileUserRecord {
  id: string;
  email: string;
  emailLower: string;
  passwordHash: string;
  username: string;
  usernameLower: string;
  usernameChangedAt?: Date | { toDate: () => Date } | number | null;
  activeSubjects?: ActiveSubject[];
  onboardingComplete?: boolean;
  oauthProvider?: 'google' | 'apple';
  oauthSubject?: string;
  createdAt: Date;
}

export interface NewMobileUser {
  email: string;
  emailLower: string;
  passwordHash: string;
  username: string;
  usernameLower: string;
  usernameChangedAt: Date | null;
  activeSubjects: ActiveSubject[];
  onboardingComplete: boolean;
  oauthProvider?: 'google' | 'apple';
  oauthSubject?: string;
  createdAt: Date;
}

export interface MobileUserStore {
  getByEmail(emailLower: string): Promise<MobileUserRecord | null>;
  getByUsername(usernameLower: string): Promise<MobileUserRecord | null>;
  getByOAuth(provider: 'google' | 'apple', subject: string): Promise<MobileUserRecord | null>;
  createUser(user: NewMobileUser): Promise<MobileUserRecord>;
  updateUsername(
    userId: string,
    update: { username: string; usernameLower: string; usernameChangedAt: Date }
  ): Promise<void>;
  updateOAuth(
    userId: string,
    update: { oauthProvider: 'google' | 'apple'; oauthSubject: string }
  ): Promise<void>;
  updateProfile(
    userId: string,
    update: { activeSubjects?: ActiveSubject[]; onboardingComplete?: boolean }
  ): Promise<void>;
}

export interface ProfanityFilter {
  isProfane(text: string): boolean;
}

export interface OAuthProfile {
  provider: 'google' | 'apple';
  subject: string;
  email: string;
  emailLower: string;
  emailVerified: boolean;
}

export class MobileAuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function validateEmailFormat(email: unknown): string | null {
  if (typeof email !== 'string' || email.trim().length === 0) {
    return 'Email is required';
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email.trim())) {
    return 'Invalid email format';
  }

  return null;
}

export function validatePasswordFormat(password: unknown): string | null {
  if (typeof password !== 'string' || password.trim().length === 0) {
    return 'Password is required';
  }

  return null;
}

export function validateUsernameFormat(username: unknown): string | null {
  if (typeof username !== 'string' || username.trim().length === 0) {
    return 'Username is required';
  }

  const trimmed = username.trim();
  if (trimmed.length < USERNAME_MIN_LENGTH || trimmed.length > USERNAME_MAX_LENGTH) {
    return 'Username must be 5-15 characters';
  }

  if (!USERNAME_REGEX.test(trimmed)) {
    return 'Username can only contain letters, numbers, and underscores';
  }

  return null;
}

export function validateUsernameRules(
  username: unknown,
  profanityFilter: ProfanityFilter
): string | null {
  const formatError = validateUsernameFormat(username);
  if (formatError) {
    return formatError;
  }

  const usernameValue = (username as string).trim();
  if (profanityFilter.isProfane(usernameValue)) {
    return 'Username is not allowed';
  }

  return null;
}

function resolveUsernameChangedAt(value: MobileUserRecord['usernameChangedAt']): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate();
  }

  return null;
}

export async function registerMobileUser(
  input: { email: unknown; password: unknown; username: unknown },
  store: MobileUserStore,
  profanityFilter: ProfanityFilter
): Promise<MobileUserRecord> {
  const emailError = validateEmailFormat(input.email);
  if (emailError) {
    throw new MobileAuthError(emailError, 400);
  }

  const passwordError = validatePasswordFormat(input.password);
  if (passwordError) {
    throw new MobileAuthError(passwordError, 400);
  }

  const usernameError = validateUsernameRules(input.username, profanityFilter);
  if (usernameError) {
    throw new MobileAuthError(usernameError, 400);
  }

  const emailValue = input.email as string;
  const passwordValue = input.password as string;
  const usernameValue = input.username as string;

  const emailLower = normalizeEmail(emailValue);
  const usernameLower = normalizeUsername(usernameValue);
  const email = emailValue.trim();
  const username = usernameValue.trim();

  const existingByEmail = await store.getByEmail(emailLower);
  if (existingByEmail) {
    throw new MobileAuthError('Email already in use', 409);
  }

  const existingByUsername = await store.getByUsername(usernameLower);
  if (existingByUsername) {
    throw new MobileAuthError('Username already in use', 409);
  }

  const passwordHash = await bcrypt.hash(passwordValue, 12);

  return store.createUser({
    email,
    emailLower,
    passwordHash,
    username,
    usernameLower,
    usernameChangedAt: null,
    activeSubjects: [],
    onboardingComplete: false,
    createdAt: new Date(),
  });
}

export async function loginMobileUser(
  input: { email?: unknown; username?: unknown; password: unknown },
  store: MobileUserStore
): Promise<MobileUserRecord> {
  const passwordError = validatePasswordFormat(input.password);
  if (passwordError) {
    throw new MobileAuthError(passwordError, 400);
  }

  const emailValue = typeof input.email === 'string' ? input.email : '';
  const usernameValue = typeof input.username === 'string' ? input.username : '';

  let user: MobileUserRecord | null = null;

  if (emailValue.trim().length > 0) {
    const emailError = validateEmailFormat(emailValue);
    if (emailError) {
      throw new MobileAuthError(emailError, 400);
    }
    const emailLower = normalizeEmail(emailValue);
    user = await store.getByEmail(emailLower);
  } else if (usernameValue.trim().length > 0) {
    const usernameLower = normalizeUsername(usernameValue);
    user = await store.getByUsername(usernameLower);
  } else {
    throw new MobileAuthError('Email or username is required', 400);
  }

  if (!user) {
    throw new MobileAuthError('Invalid username or password', 401);
  }

  const passwordValue = input.password as string;
  const isMatch = await bcrypt.compare(passwordValue, user.passwordHash);
  if (!isMatch) {
    throw new MobileAuthError('Invalid username or password', 401);
  }

  return user;
}

export async function loginMobileOAuthUser(
  input: { profile: OAuthProfile; username: unknown },
  store: MobileUserStore,
  profanityFilter: ProfanityFilter
): Promise<MobileUserRecord> {
  const { profile } = input;
  const existingBySubject = await store.getByOAuth(profile.provider, profile.subject);
  if (existingBySubject) {
    return existingBySubject;
  }

  if (profile.emailLower) {
    const existingByEmail = await store.getByEmail(profile.emailLower);
    if (existingByEmail) {
      await store.updateOAuth(existingByEmail.id, {
        oauthProvider: profile.provider,
        oauthSubject: profile.subject,
      });
      return {
        ...existingByEmail,
        email: profile.email || existingByEmail.email,
        emailLower: profile.emailLower || existingByEmail.emailLower,
        oauthProvider: profile.provider,
        oauthSubject: profile.subject,
      };
    }
  }

  if (profile.provider === 'google' && !profile.email) {
    throw new MobileAuthError('Email is required', 400);
  }

  const usernameError = validateUsernameRules(input.username, profanityFilter);
  if (usernameError) {
    throw new MobileAuthError(usernameError, 400);
  }

  const usernameValue = (input.username as string).trim();
  const usernameLower = normalizeUsername(usernameValue);
  const existingByUsername = await store.getByUsername(usernameLower);
  if (existingByUsername) {
    throw new MobileAuthError('Username already in use', 409);
  }

  if (profile.emailLower) {
    const existingByEmail = await store.getByEmail(profile.emailLower);
    if (existingByEmail) {
      throw new MobileAuthError('Email already in use', 409);
    }
  }

  const passwordHash = await bcrypt.hash(profile.subject, 12);

  return store.createUser({
    email: profile.email ? profile.email.trim() : '',
    emailLower: profile.emailLower,
    passwordHash,
    username: usernameValue,
    usernameLower,
    usernameChangedAt: null,
    activeSubjects: [],
    onboardingComplete: false,
    oauthProvider: profile.provider,
    oauthSubject: profile.subject,
    createdAt: new Date(),
  });
}

export async function checkMobileUsernameAvailability(
  input: { username: unknown },
  store: MobileUserStore,
  profanityFilter: ProfanityFilter
): Promise<{ available: boolean; reason?: string; normalized: string }> {
  const usernameError = validateUsernameFormat(input.username);
  if (usernameError) {
    throw new MobileAuthError(usernameError, 400);
  }

  const usernameValue = input.username as string;
  if (profanityFilter.isProfane(usernameValue)) {
    return {
      available: false,
      reason: 'Username is not allowed',
      normalized: normalizeUsername(usernameValue),
    };
  }

  const usernameLower = normalizeUsername(usernameValue);
  const existing = await store.getByUsername(usernameLower);

  if (existing) {
    return {
      available: false,
      reason: 'Username already in use',
      normalized: usernameLower,
    };
  }

  return {
    available: true,
    normalized: usernameLower,
  };
}

export async function updateMobileUsername(
  input: { currentUsername: string; newUsername: unknown },
  store: MobileUserStore,
  profanityFilter: ProfanityFilter
): Promise<{ user: MobileUserRecord }> {
  const usernameError = validateUsernameRules(input.newUsername, profanityFilter);
  if (usernameError) {
    throw new MobileAuthError(usernameError, 400);
  }

  const newUsernameValue = input.newUsername as string;
  const updatedUsername = newUsernameValue.trim();
  const newUsernameLower = normalizeUsername(updatedUsername);
  const currentUsernameLower = normalizeUsername(input.currentUsername);

  if (newUsernameLower === currentUsernameLower) {
    throw new MobileAuthError('Username is unchanged', 400);
  }

  const user = await store.getByUsername(currentUsernameLower);
  if (!user) {
    throw new MobileAuthError('Unauthorized', 401);
  }

  const lastChangedAt = resolveUsernameChangedAt(user.usernameChangedAt ?? null);
  if (lastChangedAt) {
    const elapsed = Date.now() - lastChangedAt.getTime();
    if (elapsed < USERNAME_CHANGE_COOLDOWN_MS) {
      throw new MobileAuthError('Must wait 30 days before changing username again', 403);
    }
  }

  const existing = await store.getByUsername(newUsernameLower);
  if (existing) {
    throw new MobileAuthError('Username already in use', 409);
  }

  const usernameChangedAt = new Date();
  await store.updateUsername(user.id, {
    username: updatedUsername,
    usernameLower: newUsernameLower,
    usernameChangedAt,
  });

  return {
    user: {
      ...user,
      username: updatedUsername,
      usernameLower: newUsernameLower,
      usernameChangedAt,
    },
  };
}
