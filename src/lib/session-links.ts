export type ViewMode = 'display' | 'controller'

export interface InitialSessionParams {
  viewMode: ViewMode
  sessionId: string
  syncServerUrl: string
  controllerToken: string
}

export function resolveInitialSessionParams(href: string): InitialSessionParams {
  const pageUrl = new URL(href)
  const viewMode: ViewMode = pageUrl.searchParams.get('mode') === 'controller' ? 'controller' : 'display'

  return {
    viewMode,
    sessionId: pageUrl.searchParams.get('session')?.trim() || createSessionId(),
    syncServerUrl: normalizeApiBaseInput(pageUrl.searchParams.get('sync')?.trim() || '/api'),
    controllerToken: normalizeToken(pageUrl.searchParams.get('token') || ''),
  }
}

export function buildLinkedUrl(
  href: string,
  mode: ViewMode,
  sessionId: string,
  syncServerUrl: string,
  writeToken: string,
) {
  const linkedUrl = new URL(href)
  linkedUrl.searchParams.set('session', sessionId)
  linkedUrl.searchParams.set('sync', normalizeApiBaseInput(syncServerUrl))

  if (mode === 'controller') {
    linkedUrl.searchParams.set('mode', 'controller')

    if (writeToken) {
      linkedUrl.searchParams.set('token', writeToken)
    } else {
      linkedUrl.searchParams.delete('token')
    }
  } else {
    linkedUrl.searchParams.delete('mode')
    linkedUrl.searchParams.delete('token')
  }

  return linkedUrl.toString()
}

export function createSessionId() {
  return `fear-${secureHex(8)}`
}

export function createControllerToken() {
  return secureBase64Url(24)
}

export function normalizeToken(token: string) {
  return /^[A-Za-z0-9_-]{24,160}$/.test(token) ? token : ''
}

export function normalizeApiBaseInput(value: string) {
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

function secureHex(bytes: number) {
  const data = new Uint8Array(bytes)
  crypto.getRandomValues(data)
  return Array.from(data, (value) => value.toString(16).padStart(2, '0')).join('')
}

function secureBase64Url(bytes: number) {
  const data = new Uint8Array(bytes)
  crypto.getRandomValues(data)
  const binary = Array.from(data, (value) => String.fromCharCode(value)).join('')
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
