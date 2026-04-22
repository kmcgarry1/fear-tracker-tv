import crypto from 'node:crypto'
import { Redis } from '@upstash/redis'

const SESSION_TTL_SECONDS = 60 * 60 * 12
const MAX_STATE_BYTES = 24 * 1024
const MAX_UPDATES_PER_WINDOW = 18
const RATE_WINDOW_MS = 10_000
const SESSION_ID_PATTERN = /^fear-[a-f0-9]{16,48}$/
const WRITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{24,160}$/
const MAX_URL_LENGTH = 600

function getNow() {
  return Date.now()
}

let redisClient = null

function getRedisClient() {
  if (redisClient) {
    return redisClient
  }

  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return null
  }

  redisClient = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  })

  return redisClient
}

function getLocalSessions() {
  if (!globalThis.__fearTrackerSessions) {
    globalThis.__fearTrackerSessions = new Map()
  }

  return globalThis.__fearTrackerSessions
}

function getLocalRateWindow() {
  if (!globalThis.__fearTrackerRateWindow) {
    globalThis.__fearTrackerRateWindow = new Map()
  }

  return globalThis.__fearTrackerRateWindow
}

function hashToken(token) {
  const pepper = process.env.SESSION_TOKEN_PEPPER || ''
  return crypto.createHash('sha256').update(`${pepper}:${token}`).digest('hex')
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

function isSafeHttpUrl(value) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

function sanitizeYoutubeUrl(value) {
  if (typeof value !== 'string') {
    return ''
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return ''
  }

  try {
    const parsed = new URL(trimmed)
    const host = parsed.hostname.toLowerCase()

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return ''
    }

    if (!host.includes('youtube.com') && !host.includes('youtu.be')) {
      return ''
    }

    return trimmed.slice(0, MAX_URL_LENGTH)
  } catch {
    return ''
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function sanitizeString(value, fallback, maxLength) {
  return typeof value === 'string' && value ? value.slice(0, maxLength) : fallback
}

function sanitizeColorValue(value, fallback) {
  if (typeof value !== 'string') {
    return fallback
  }

  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, 40) : fallback
}

function sanitizeFearIcons(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  const normalized = {}
  const entries = Object.entries(value).slice(0, 64)

  for (const [key, icon] of entries) {
    if (!/^\d+$/.test(key)) {
      continue
    }

    if (typeof icon === 'string' && icon.trim()) {
      normalized[key] = icon.trim().slice(0, 120)
    }
  }

  return normalized
}

function sanitizeImageUrls(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry && isSafeHttpUrl(entry))
    .slice(0, 20)
    .map((entry) => entry.slice(0, MAX_URL_LENGTH))
}

export function isValidSessionId(sessionId) {
  return SESSION_ID_PATTERN.test(sessionId)
}

export function isValidWriteToken(token) {
  return WRITE_TOKEN_PATTERN.test(token)
}

export function sanitizeStatePayload(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Invalid state payload')
  }

  const serialized = JSON.stringify(input)

  if (serialized.length > MAX_STATE_BYTES) {
    throw new Error('State payload too large')
  }

  const maxFear = Number.isFinite(input.maxFear) ? clamp(Math.round(input.maxFear), 1, 30) : 12
  const fear = Number.isFinite(input.fear) ? clamp(Math.round(input.fear), 0, maxFear) : 0
  const imageUrls = sanitizeImageUrls(input.imageUrls)
  const activeImageIndex = imageUrls.length === 0 ? 0 : clamp(Math.round(Number(input.activeImageIndex) || 0), 0, imageUrls.length - 1)
  const backgroundMode = input.backgroundMode === 'youtube' || input.backgroundMode === 'images' ? input.backgroundMode : 'none'

  return {
    fear,
    maxFear,
    fontId: sanitizeString(input.fontId, 'cinzel', 40),
    themeId: sanitizeString(input.themeId, 'ember-court', 40),
    colors: {
      background: sanitizeColorValue(input.colors?.background, '#140506'),
      backgroundAccent: sanitizeColorValue(input.colors?.backgroundAccent, '#421216'),
      accent: sanitizeColorValue(input.colors?.accent, '#ff8a5b'),
      glow: sanitizeColorValue(input.colors?.glow, '#ffcc7a'),
      text: sanitizeColorValue(input.colors?.text, '#fff4df'),
      ring: sanitizeColorValue(input.colors?.ring, '#7d1f18'),
      shadow: sanitizeColorValue(input.colors?.shadow, 'rgba(255, 88, 38, 0.35)'),
      vignette: sanitizeColorValue(input.colors?.vignette, 'rgba(9, 1, 2, 0.74)'),
    },
    globalIcon: sanitizeString(input.globalIcon, 'game-icons:skull-crossed-bones', 120),
    fearIcons: sanitizeFearIcons(input.fearIcons),
    backgroundMode,
    youtubeUrl: sanitizeYoutubeUrl(input.youtubeUrl),
    imageUrls,
    activeImageIndex,
    sessionId: sanitizeString(input.sessionId, '', 64),
    syncServerUrl: sanitizeString(input.syncServerUrl, '/api', MAX_URL_LENGTH),
  }
}

function sessionKey(sessionId) {
  return `fear:session:${sessionId}`
}

async function readFromStore(sessionId) {
  const redis = getRedisClient()

  if (redis) {
    return (await redis.get(sessionKey(sessionId))) || null
  }

  return getLocalSessions().get(sessionId) || null
}

async function writeToStore(sessionId, record) {
  const redis = getRedisClient()

  if (redis) {
    await redis.set(sessionKey(sessionId), record, { ex: SESSION_TTL_SECONDS })
    return
  }

  getLocalSessions().set(sessionId, record)
}

async function removeFromStore(sessionId) {
  const redis = getRedisClient()

  if (redis) {
    await redis.del(sessionKey(sessionId))
    return
  }

  getLocalSessions().delete(sessionId)
}

function isExpired(record) {
  return !record || typeof record.expiresAt !== 'number' || record.expiresAt < getNow()
}

export async function getSessionRecord(sessionId) {
  const record = await readFromStore(sessionId)

  if (!record) {
    return null
  }

  if (isExpired(record)) {
    await removeFromStore(sessionId)
    return null
  }

  return record
}

export async function bootstrapSession(sessionId, writeToken) {
  if (!isValidSessionId(sessionId)) {
    throw new Error('Invalid session id')
  }

  let record = await getSessionRecord(sessionId)
  const now = getNow()

  if (!record) {
    record = {
      version: 0,
      state: null,
      tokenHash: writeToken ? hashToken(writeToken) : null,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + SESSION_TTL_SECONDS * 1000,
    }

    await writeToStore(sessionId, record)
    return {
      sessionId,
      version: 0,
      state: null,
      canWrite: Boolean(writeToken),
    }
  }

  let canWrite = false
  const incomingToken = typeof writeToken === 'string' ? writeToken : ''

  if (incomingToken && isValidWriteToken(incomingToken)) {
    if (!record.tokenHash) {
      record.tokenHash = hashToken(incomingToken)
      canWrite = true
    } else {
      canWrite = safeEqual(hashToken(incomingToken), record.tokenHash)
    }
  }

  record.expiresAt = now + SESSION_TTL_SECONDS * 1000
  await writeToStore(sessionId, record)

  return {
    sessionId,
    version: record.version || 0,
    state: record.state || null,
    canWrite,
  }
}

export async function getSessionState(sessionId) {
  const record = await getSessionRecord(sessionId)

  if (!record) {
    return null
  }

  return {
    sessionId,
    version: record.version || 0,
    state: record.state || null,
    updatedAt: record.updatedAt || record.createdAt || getNow(),
  }
}

export async function updateSessionState(sessionId, writeToken, state) {
  const record = await getSessionRecord(sessionId)

  if (!record) {
    return { ok: false, code: 404, message: 'Session not found' }
  }

  if (!record.tokenHash || !writeToken || !isValidWriteToken(writeToken) || !safeEqual(hashToken(writeToken), record.tokenHash)) {
    return { ok: false, code: 401, message: 'Unauthorized controller token' }
  }

  if (!allowWriteForSession(sessionId)) {
    return { ok: false, code: 429, message: 'Too many updates' }
  }

  const sanitized = sanitizeStatePayload(state)
  const now = getNow()

  record.state = sanitized
  record.version = (record.version || 0) + 1
  record.updatedAt = now
  record.expiresAt = now + SESSION_TTL_SECONDS * 1000

  await writeToStore(sessionId, record)

  return {
    ok: true,
    version: record.version,
    updatedAt: record.updatedAt,
  }
}

function allowWriteForSession(sessionId) {
  const now = getNow()
  const windows = getLocalRateWindow()
  const history = windows.get(sessionId) || []
  const recent = history.filter((timestamp) => now - timestamp <= RATE_WINDOW_MS)

  if (recent.length >= MAX_UPDATES_PER_WINDOW) {
    windows.set(sessionId, recent)
    return false
  }

  recent.push(now)
  windows.set(sessionId, recent)
  return true
}

export function parseJsonBody(req) {
  const contentLengthRaw = req.headers?.['content-length']
  const contentLength = Number(Array.isArray(contentLengthRaw) ? contentLengthRaw[0] : contentLengthRaw)

  if (Number.isFinite(contentLength) && contentLength > MAX_STATE_BYTES * 2) {
    return null
  }

  if (req.body && typeof req.body === 'object') {
    return req.body
  }

  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body)
    } catch {
      return null
    }
  }

  return null
}
