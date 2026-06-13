const TRUST_KEY = 'tf_browser_trust'

export function generateToken(): string {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function getLocalToken(): string | null {
  try { return localStorage.getItem(TRUST_KEY) } catch { return null }
}

export function setLocalToken(token: string) {
  try { localStorage.setItem(TRUST_KEY, token) } catch {}
}

export function clearLocalToken() {
  try { localStorage.removeItem(TRUST_KEY) } catch {}
}
