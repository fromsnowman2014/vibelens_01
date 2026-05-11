/**
 * Persists user consent decisions for downloading managed runtime binaries.
 * Stored separately from Settings because the shape is internal to vibelens —
 * we don't expose it on the settings page, and we don't want to churn the
 * Settings schema (with its migration logic) every time a new runtime kind
 * is added.
 *
 * The shape is intentionally additive: a missing kind means "never asked".
 * A kind set to { granted: false } means "user explicitly declined";
 * { granted: true } means consent persisted.
 */

import Store from 'electron-store'

export type RuntimeKind = 'node'

interface ConsentEntry {
  granted: boolean
  decidedAt: number
}

type ConsentStore = Partial<Record<RuntimeKind, ConsentEntry>>

const store = new Store<ConsentStore>({
  name: 'vibelens-runtime-consents',
  defaults: {}
})

export function getConsent(kind: RuntimeKind): ConsentEntry | undefined {
  return (store.store as ConsentStore)[kind]
}

export function setConsent(kind: RuntimeKind, granted: boolean): void {
  const next: ConsentStore = {
    ...(store.store as ConsentStore),
    [kind]: { granted, decidedAt: Date.now() }
  }
  store.store = next
}

export function clearConsent(kind: RuntimeKind): void {
  const cur = { ...(store.store as ConsentStore) }
  delete cur[kind]
  store.store = cur
}
