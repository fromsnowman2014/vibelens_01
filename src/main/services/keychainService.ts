import { safeStorage } from 'electron'
import Store from 'electron-store'
import { logger } from '../utils/logger'

const SERVICE = 'VibeLens'

// Encrypted fallback store (used if native keytar fails to load at runtime).
// Uses Electron safeStorage which wraps the macOS Keychain as well — still
// safe but avoids the native-module dependency path.
const fallbackStore = new Store<{ keys: Record<string, string> }>({
  name: 'vibelens-keys',
  defaults: { keys: {} }
})

let keytarRef: typeof import('keytar') | null | 'failed' = null
function getKeytar(): typeof import('keytar') | null {
  if (keytarRef === 'failed') return null
  if (keytarRef) return keytarRef
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    keytarRef = require('keytar') as typeof import('keytar')
    return keytarRef
  } catch (e) {
    logger.warn('keytar failed to load, falling back to safeStorage', e)
    keytarRef = 'failed'
    return null
  }
}

export type ProviderId = 'claude'

export async function saveKey(provider: ProviderId, key: string): Promise<void> {
  const kt = getKeytar()
  if (kt) {
    try {
      await kt.setPassword(SERVICE, provider, key)
      return
    } catch (e) {
      logger.warn('keytar.setPassword failed, falling back', e)
    }
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'Neither keytar nor safeStorage is available on this system to store the API key.'
    )
  }
  const encrypted = safeStorage.encryptString(key).toString('base64')
  const current = fallbackStore.get('keys')
  fallbackStore.set('keys', { ...current, [provider]: encrypted })
}

export async function getKey(provider: ProviderId): Promise<string | null> {
  const kt = getKeytar()
  if (kt) {
    try {
      const key = await kt.getPassword(SERVICE, provider)
      if (key) return key
    } catch (e) {
      logger.warn('keytar.getPassword failed, falling back', e)
    }
  }
  const current = fallbackStore.get('keys')
  const encrypted = current[provider]
  if (!encrypted) return null
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
  } catch (e) {
    logger.warn('safeStorage decrypt failed', e)
    return null
  }
}

export async function deleteKey(provider: ProviderId): Promise<void> {
  const kt = getKeytar()
  if (kt) {
    try {
      await kt.deletePassword(SERVICE, provider)
    } catch (e) {
      logger.warn('keytar.deletePassword failed', e)
    }
  }
  const current = fallbackStore.get('keys')
  const next = { ...current }
  delete next[provider]
  fallbackStore.set('keys', next)
}

export async function hasKey(provider: ProviderId): Promise<boolean> {
  const k = await getKey(provider)
  return !!k && k.length > 0
}
