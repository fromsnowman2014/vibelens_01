/**
 * Classification + filtering for webview console messages before they hit
 * the log panel.
 *
 * The webview faithfully forwards everything the embedded app prints —
 * including verbose debug logs from the user's code, framework runtime
 * chatter, and Electron's own security warnings. Forwarding all of it
 * (a) drowns out real errors, (b) causes a zustand store update per line
 * which re-renders the log panel and degrades vibelens responsiveness.
 *
 * Policy:
 *   - Drop info/verbose levels entirely. Real bugs almost never live at
 *     those levels, and "user clicked button → 12 debug lines" is the
 *     dominant source of noise.
 *   - Keep warn/error but recognize a few patterns that should be
 *     downgraded (e.g. an "Electron Security Warning ..." printed via
 *     console.warn is informational once you've seen it once).
 *   - Drop Electron's own security warnings that aren't actionable in
 *     dev: insecure CSP and allowRunningInsecureContent reminders.
 *
 * The `level` integer on Electron's console-message event is documented
 * as 0=verbose, 1=info, 2=warning, 3=error. We also use the message body
 * as a tie-breaker because dev tooling sometimes uses console.log to
 * print errors and console.warn to print info.
 */

const ELECTRON_SECURITY_WARNING = /Electron Security Warning/i
const REACT_DEVTOOLS_TIP = /Download the React DevTools/i

const REAL_ERROR_PATTERNS = [
  /^Uncaught\b/,
  /\bChunkLoadError\b/,
  /\bTypeError\b/,
  /\bReferenceError\b/,
  /\bSyntaxError\b/,
  /\bError:\s/
]

const REAL_WARN_PATTERNS = [/^Warning:\s/i]

export interface RawConsoleMessage {
  level: number
  message: string
  line: number
  sourceId: string
}

export interface ClassifiedMessage {
  level: 'info' | 'warn' | 'error'
  message: string
}

export function classifyPreviewConsoleMessage(
  e: RawConsoleMessage
): ClassifiedMessage | null {
  const text = e.message

  // Always-drop noise — neither informative nor actionable in vibelens.
  if (ELECTRON_SECURITY_WARNING.test(text)) return null
  if (REACT_DEVTOOLS_TIP.test(text)) return null

  // Promote pattern-recognized errors regardless of the numeric level —
  // some frameworks (e.g. Next dev overlay) prints errors via console.error
  // but also via console.log of the same stack.
  if (REAL_ERROR_PATTERNS.some((re) => re.test(text))) {
    return { level: 'error', message: formatLocation(e) }
  }
  if (REAL_WARN_PATTERNS.some((re) => re.test(text))) {
    return { level: 'warn', message: formatLocation(e) }
  }

  // Numeric-level fallback. Electron: 0=verbose, 1=info, 2=warning, 3=error.
  if (e.level >= 3) return { level: 'error', message: formatLocation(e) }
  if (e.level === 2) return { level: 'warn', message: formatLocation(e) }

  // verbose / info / log — drop. Users debugging their own app should
  // open the preview's DevTools (toolbar button) where everything is
  // available with proper formatting.
  return null
}

function formatLocation(e: RawConsoleMessage): string {
  // The default webview sourceId for webpack-internal modules is long and
  // unhelpful; truncate to a tail so the panel stays readable.
  const src = shortenSource(e.sourceId)
  return src ? `[${src}:${e.line}] ${e.message}` : e.message
}

function shortenSource(sourceId: string): string {
  if (!sourceId) return ''
  // "webpack-internal:///(app-pages-browser)/./node_modules/.../foo.js" → "foo.js"
  // "http://127.0.0.1:3000/_next/static/chunks/app/layout.js"           → "layout.js"
  // "file:///.../webpack.js"                                            → "webpack.js"
  const tail = sourceId.split('/').pop() || sourceId
  // Strip any query string ("layout.js?v=12345").
  return tail.split('?')[0]
}
