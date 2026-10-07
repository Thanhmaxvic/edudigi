export interface TeacherAccount {
  email: string;
  apiKey: string;
  name?: string;
  connectedAt?: string;
}

const STORAGE_KEY = 'edudigi_teacher_account';

export function getSavedTeacherAccount(): TeacherAccount | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data && data.apiKey && data.email) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveTeacherAccount(account: TeacherAccount): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
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
