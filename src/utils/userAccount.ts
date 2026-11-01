export interface TeacherAccount {
  email: string;
  apiKey: string;
  name?: string;
  connectedAt?: string;
}

const STORAGE_KEY = 'edudigi_teacher_account';

/**
 * Strips invisible zero-width characters, surrounding quotes, and accidental whitespace/newlines
 * when teachers copy & paste their Gemini API key from Google AI Studio, Zalo, Word, or Email.
 */
export function sanitizeApiKey(rawKey?: string | null): string {
  if (!rawKey || typeof rawKey !== 'string') return '';
  return rawKey
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\s+/g, '');
}

/**
 * Ensures header values contain only ISO-8859-1 / ASCII characters so browser fetch()
 * never throws "Failed to execute 'fetch' on 'Window': String contains non ISO-8859-1 code point".
 */
export function toSafeAsciiHeader(value?: string | null): string {
  if (!value || typeof value !== 'string') return '';
  return value.replace(/[^\x20-\x7E]/g, '').trim();
}

export function getSavedTeacherAccount(): TeacherAccount | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const cleanKey = sanitizeApiKey(data?.apiKey);
    if (data && cleanKey && data.email) {
      return {
        ...data,
        email: String(data.email).trim(),
        apiKey: cleanKey,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveTeacherAccount(account: TeacherAccount): void {
  try {
    const normalized: TeacherAccount = {
      ...account,
      email: account.email.trim(),
      apiKey: sanitizeApiKey(account.apiKey),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new Event('edudigi_account_changed'));
  } catch (err) {
    console.error('Error saving account to localStorage:', err);
  }
}

export function clearTeacherAccount(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event('edudigi_account_changed'));
  } catch (err) {
    console.error('Error clearing account from localStorage:', err);
  }
}
