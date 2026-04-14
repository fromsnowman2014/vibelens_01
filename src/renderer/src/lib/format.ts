/** Format a timestamp into a human-friendly relative string */
export function formatRelativeTime(timestamp?: number): string {
  if (!timestamp) return ''
  const now = Date.now()
  const diffMs = now - timestamp
  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return new Date(timestamp).toLocaleDateString()
}

/** Shorten paths by replacing home directory with ~ */
export function shortenPath(fullPath: string): string {
  const home = navigator.platform.toUpperCase().includes('MAC')
    ? `/Users/${fullPath.split('/')[2] ?? ''}`
    : fullPath.split('/').slice(0, 3).join('/')
  if (fullPath.startsWith(home)) {
    return '~' + fullPath.slice(home.length)
  }
  return fullPath
}
