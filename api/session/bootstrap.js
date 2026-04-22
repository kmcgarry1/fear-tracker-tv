import {
  bootstrapSession,
  isValidSessionId,
  isValidWriteToken,
  parseJsonBody,
} from '../_sessionStore.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const body = parseJsonBody(req)

  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Invalid JSON payload' })
    return
  }

  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
  const writeToken = typeof body.writeToken === 'string' ? body.writeToken.trim() : ''

  if (!isValidSessionId(sessionId)) {
    res.status(400).json({ error: 'Invalid session id format' })
    return
  }

  if (writeToken && !isValidWriteToken(writeToken)) {
    res.status(400).json({ error: 'Invalid write token format' })
    return
  }

  try {
    const bootstrap = await bootstrapSession(sessionId, writeToken || null)
    res.status(200).json(bootstrap)
  } catch {
    res.status(500).json({ error: 'Failed to bootstrap session' })
  }
}
