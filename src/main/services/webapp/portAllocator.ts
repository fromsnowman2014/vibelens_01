import net from 'net'

/**
 * Find a free port starting from the preferred port
 * @param preferredPort - The preferred port to start checking from
 * @returns A free port number
 */
export async function findFreePort(preferredPort: number): Promise<number> {
  let port = preferredPort

  while (!(await isPortFree(port))) {
    port++
    if (port > 65535) {
      throw new Error('No free ports available (reached port 65535)')
    }
  }

  return port
}

/**
 * Check if a port is free
 * @param port - Port number to check
 * @returns true if port is free, false otherwise
 */
function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()

    server.once('error', () => {
      resolve(false)
    })

    server.once('listening', () => {
      server.close()
      resolve(true)
    })

    server.listen(port)
  })
}
