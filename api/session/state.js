import {
  getSessionState,
  isValidSessionId,
  isValidWriteToken,
  parseJsonBody,
  updateSessionState,
} from '../_sessionStore.js'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const sessionId = typeof req.query.session === 'string' ? req.query.session.trim() : ''

    if (!isValidSessionId(sessionId)) {
      res.status(400).json({ error: 'Invalid session id format' })
      return
    }

    const snapshot = await getSessionState(sessionId)

    if (!snapshot) {
      res.status(404).json({ error: 'Session not found' })
      return
    }

    res.status(200).json(snapshot)
    return
  }

  if (req.method === 'POST') {
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

    if (!isValidWriteToken(writeToken)) {
      res.status(401).json({ error: 'Missing or invalid controller token' })
      return
    }

    const result = await updateSessionState(sessionId, writeToken, body.state)

    if (!result.ok) {
      res.status(result.code).json({ error: result.message })
      return
    }

    res.status(200).json({
      ok: true,
      version: result.version,
      updatedAt: result.updatedAt,
    })
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
