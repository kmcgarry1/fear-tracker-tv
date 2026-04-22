import type { TrackerState } from './tracker-config'

export type SessionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

const POLL_INTERVAL_MS = 1200

interface SessionClientOptions {
  sessionId: string
  apiBaseUrl: string
  writeToken: string
  onState: (state: TrackerState) => void
  onStatus: (status: SessionStatus) => void
  onSessionInfo: (info: { sessionId: string; canWrite: boolean }) => void
}

export function createSessionClient(options: SessionClientOptions) {
  let pollTimer: number | undefined
  let disposed = false
  let sessionId = options.sessionId
  let apiBaseUrl = normalizeApiBaseUrl(options.apiBaseUrl)
  let writeToken = options.writeToken
  let canWrite = false
  let knownVersion = -1

  function clearPollTimer() {
    if (pollTimer !== undefined) {
      window.clearInterval(pollTimer)
      pollTimer = undefined
    }
  }

  function normalizeApiBaseUrl(value: string) {
    const trimmed = value.trim()

    if (!trimmed) {
      return '/api'
    }

    if (trimmed.startsWith('/')) {
      return trimmed.startsWith('/api') ? trimmed.replace(/\/$/, '') : '/api'
    }

    try {
      const parsed = new URL(trimmed)

      if (parsed.origin !== window.location.origin) {
        return '/api'
      }

      const normalizedPath = parsed.pathname.replace(/\/$/, '')
      return normalizedPath.startsWith('/api') ? normalizedPath : '/api'
    } catch {
      return '/api'
    }
  }

  async function parseJsonResponse(response: Response) {
    try {
      return (await response.json()) as Record<string, unknown>
    } catch {
      return {}
    }
  }

  function makeEndpoint(path: string, searchParams?: URLSearchParams) {
    const endpoint = new URL(`${apiBaseUrl}${path}`, window.location.origin)

    if (searchParams) {
      endpoint.search = searchParams.toString()
    }

    return endpoint.toString()
  }

  async function pollState() {
    if (disposed || !sessionId) {
      return
    }

    try {
      const query = new URLSearchParams({ session: sessionId })
      const response = await fetch(makeEndpoint('/session/state', query), {
        method: 'GET',
        cache: 'no-store',
      })

      if (!response.ok) {
        if (response.status >= 500) {
          options.onStatus('error')
        }
        return
      }

      const payload = await parseJsonResponse(response)
      const version = Number(payload.version)

      if (!Number.isFinite(version) || version <= knownVersion) {
        return
      }

      knownVersion = version
      const state = payload.state as TrackerState | null

      if (state) {
        options.onState(state)
      }
    } catch {
      options.onStatus('error')
    }
  }

  async function bootstrap() {
    const response = await fetch(makeEndpoint('/session/bootstrap'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        writeToken: writeToken || undefined,
      }),
    })

    if (!response.ok) {
      throw new Error('Bootstrap failed')
    }

    const payload = await parseJsonResponse(response)
    const resolvedSessionId = typeof payload.sessionId === 'string' ? payload.sessionId : sessionId
    const version = Number(payload.version)
    const state = payload.state as TrackerState | null

    canWrite = payload.canWrite === true
    sessionId = resolvedSessionId
    knownVersion = Number.isFinite(version) ? version : -1

    options.onSessionInfo({
      sessionId,
      canWrite,
    })

    if (state) {
      options.onState(state)
    }
  }

  async function connect() {
    clearPollTimer()

    if (disposed || !sessionId || !apiBaseUrl) {
      return
    }

    options.onStatus('connecting')

    try {
      await bootstrap()
      options.onStatus('connected')
      await pollState()
      pollTimer = window.setInterval(() => {
        void pollState()
      }, POLL_INTERVAL_MS)
    } catch {
      options.onStatus('error')
    }
  }

  async function sendState(state: TrackerState) {
    if (!canWrite || !writeToken) {
      return false
    }

    try {
      const response = await fetch(makeEndpoint('/session/state'), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          writeToken,
          state,
        }),
      })

      if (response.status === 401) {
        canWrite = false
        options.onSessionInfo({ sessionId, canWrite: false })
        return false
      }

      if (!response.ok) {
        if (response.status >= 500) {
          options.onStatus('error')
        }
        return false
      }

      const payload = await parseJsonResponse(response)
      const version = Number(payload.version)

      if (Number.isFinite(version) && version > knownVersion) {
        knownVersion = version
      }
      return true
    } catch {
      options.onStatus('error')
      return false
    }
  }

  function updateConnection(nextSessionId: string, nextApiBaseUrl: string, nextWriteToken: string) {
    sessionId = nextSessionId
    apiBaseUrl = normalizeApiBaseUrl(nextApiBaseUrl)
    writeToken = nextWriteToken
    canWrite = false
    knownVersion = -1

    void connect()
  }

  function disconnect() {
    disposed = true
    clearPollTimer()
    options.onStatus('disconnected')
  }

  return {
    connect,
    disconnect,
    sendState,
    updateConnection,
  }
}
