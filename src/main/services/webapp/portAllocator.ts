import net from 'net'

const LOG = '[portAllocator]'

/**
 * Find a free port starting from the preferred port.
 * Each candidate is probed by binding on `0.0.0.0` — the same host the dev
 * server uses — to avoid false negatives where the port is free on `127.0.0.1`
 * but already taken on a wildcard bind.
 */
export async function findFreePort(preferredPort: number): Promise<number> {
  let port = preferredPort
  while (true) {
    if (await isPortFree(port)) {
      console.log(`${LOG} allocated port ${port} (preferred=${preferredPort})`)
      return port
    }
    console.log(`${LOG} port ${port} in use, trying ${port + 1}`)
    port++
    if (port > 65535) {
      throw new Error('No free ports available (reached port 65535)')
    }
  }
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()
    let settled = false
    const settle = (free: boolean) => {
      if (settled) return
      settled = true
      try {
        server.close()
      } catch {
        /* ignore */
      }
      resolve(free)
    }

    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code !== 'EADDRINUSE') {
        console.warn(`${LOG} unexpected error probing port ${port}:`, err.code || err.message)
      }
      settle(false)
    })

    server.once('listening', () => {
      settle(true)
    })

    // Bind on 0.0.0.0 to match the dev server's bind. SO_REUSEADDR-style
    // false-positives where a port appears free on one interface but not
    // another are then avoided.
    server.listen(port, '0.0.0.0')
  })
}
