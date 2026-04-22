/**
 * Parse a Git commit message into subject and body.
 *
 * @param message - The full commit message (may include multiple lines)
 * @returns Object containing subject (first line) and body (remaining lines)
 */
export function parseCommitMessage(message: string) {
  if (!message) {
    return {
      subject: '',
      body: '',
      hasBody: false
    }
  }

  const lines = message.split('\n')
  const subject = lines[0] || ''
  const bodyLines = lines.slice(1)

  // Remove leading empty lines
  while (bodyLines.length > 0 && bodyLines[0].trim() === '') {
    bodyLines.shift()
  }

  const body = bodyLines.join('\n').trim()

  return {
    subject,
    body,
    hasBody: body.length > 0
  }
}
