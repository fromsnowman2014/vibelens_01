// Thin wrapper that unwraps { ok, data | error } into thrown promises so
// callers can use try/catch instead of checking ok on every call.

type Result<T> = { ok: true; data: T } | { ok: false; error: string }

export async function unwrap<T>(p: Promise<Result<T>>): Promise<T> {
  const r = await p
  if (!r.ok) throw new Error(r.error)
  return r.data
}

export const api = window.vibelens
