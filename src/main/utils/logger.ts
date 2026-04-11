/* eslint-disable no-console */
const prefix = '[VibeLens]'

export const logger = {
  info: (...args: unknown[]) => console.log(prefix, ...args),
  warn: (...args: unknown[]) => console.warn(prefix, ...args),
  error: (...args: unknown[]) => console.error(prefix, ...args)
}
