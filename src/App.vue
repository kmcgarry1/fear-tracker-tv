<script setup lang="ts">
import { Icon } from '@iconify/vue'
import QRCode from 'qrcode'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import { createSessionClient, type SessionStatus } from './lib/session-client'
import {
  FONT_OPTIONS,
  ICON_OPTIONS,
  THEME_PRESETS,
  clampFear,
  createDefaultTrackerState,
  normalizeTrackerState,
  type BackgroundMode,
  type ThemeColors,
  type TrackerState,
} from './lib/tracker-config'

const STORAGE_KEY = 'daggerheart-fear-tracker-state-v1'
const pageUrl = new URL(window.location.href)
const viewMode = pageUrl.searchParams.get('mode') === 'controller' ? 'controller' : 'display'
const defaultSessionId = pageUrl.searchParams.get('session')?.trim() || createSessionId()
const defaultSyncServerUrl =
  pageUrl.searchParams.get('sync')?.trim() ||
  '/api'
const initialControllerToken = normalizeToken(pageUrl.searchParams.get('token') || '')
const defaultState = createDefaultTrackerState(defaultSyncServerUrl, defaultSessionId)
const state = reactive(loadInitialState())
const sessionWriteToken = ref(initialControllerToken)
const settingsOpen = ref(viewMode === 'controller')
const interfaceVisible = ref(viewMode === 'controller')
const tabActive = ref(!document.hidden)
const connectionStatus = ref<SessionStatus>('disconnected')
const canWrite = ref(false)
const copyNotice = ref('')
const castNotice = ref('')
const displayQrDataUrl = ref('')
const controllerQrDataUrl = ref('')

let hideInterfaceTimer = 0
let copyNoticeTimer = 0
let castNoticeTimer = 0
let imageRotationTimer = 0
let applyingRemoteState = false

const sessionClient = createSessionClient({
  sessionId: state.sessionId,
  apiBaseUrl: state.syncServerUrl,
  writeToken: sessionWriteToken.value,
  onState: (nextState) => {
    applyingRemoteState = true
    Object.assign(
      state,
      normalizeTrackerState(
        {
          ...nextState,
          sessionId: state.sessionId,
          syncServerUrl: state.syncServerUrl,
        },
        defaultState,
      ),
    )
    queueMicrotask(() => {
      applyingRemoteState = false
    })
  },
  onStatus: (status) => {
    connectionStatus.value = status
  },
  onSessionInfo: (info) => {
    canWrite.value = info.canWrite

    if (info.sessionId !== state.sessionId) {
      state.sessionId = info.sessionId
    }
  },
})

const activeFont = computed(() => FONT_OPTIONS.find((option) => option.id === state.fontId) ?? FONT_OPTIONS[0])
const activeTheme = computed(() => THEME_PRESETS.find((preset) => preset.id === state.themeId) ?? THEME_PRESETS[0])
const fearRatio = computed(() => (state.maxFear === 0 ? 0 : clampFear(state.fear, state.maxFear) / state.maxFear))
const fearStateClass = computed(() => {
  if (fearRatio.value >= 0.75) {
    return 'fear-high'
  }

  if (fearRatio.value >= 0.4) {
    return 'fear-rising'
  }

  return 'fear-low'
})
const fearValueLabel = computed(() => String(state.fear).padStart(2, '0'))
const iconForFear = computed(() => state.fearIcons[String(state.fear)] || state.globalIcon)
const showSettingsToggle = computed(
  () => viewMode === 'display' && tabActive.value && (interfaceVisible.value || settingsOpen.value),
)
const trackerStyle = computed(() => ({
  '--tracker-font': activeFont.value.family,
  '--theme-background': state.colors.background,
  '--theme-background-accent': state.colors.backgroundAccent,
  '--theme-accent': state.colors.accent,
  '--theme-glow': state.colors.glow,
  '--theme-text': state.colors.text,
  '--theme-ring': state.colors.ring,
  '--theme-shadow': state.colors.shadow,
  '--theme-vignette': state.colors.vignette,
}))
const fearSlots = computed(() => Array.from({ length: state.maxFear + 1 }, (_, index) => index))
const imageUrlsText = computed({
  get: () => state.imageUrls.join('\n'),
  set: (value: string) => {
    state.imageUrls = value
      .split(/\r?\n|,/) 
      .map((entry) => entry.trim())
      .filter(Boolean)

    if (state.activeImageIndex >= state.imageUrls.length) {
      state.activeImageIndex = 0
    }
  },
})
const activeImageUrl = computed(() => state.imageUrls[state.activeImageIndex] ?? state.imageUrls[0] ?? '')
const youtubeEmbedUrl = computed(() => buildYoutubeEmbedUrl(state.youtubeUrl))
const syncLabel = computed(() => {
  switch (connectionStatus.value) {
    case 'connected':
      return 'linked'
    case 'connecting':
      return 'linking'
    case 'error':
      return 'relay unavailable'
    default:
      return 'local only'
  }
})
const displayLink = computed(() => buildLinkedUrl('display'))
const controllerLink = computed(() => buildLinkedUrl('controller'))

watch([displayLink, controllerLink], () => {
  void refreshQrCodes()
})

watch(
  () => [state.sessionId, state.syncServerUrl, sessionWriteToken.value] as const,
  ([nextSessionId, nextServerUrl, nextWriteToken], [previousSessionId, previousServerUrl, previousWriteToken]) => {
    if (
      nextSessionId === previousSessionId &&
      nextServerUrl === previousServerUrl &&
      nextWriteToken === previousWriteToken
    ) {
      return
    }

    sessionClient.updateConnection(nextSessionId, nextServerUrl, nextWriteToken)
  },
)

watch(
  () => settingsOpen.value,
  (isOpen) => {
    if (isOpen) {
      interfaceVisible.value = true
    }
  },
)

watch(
  state,
  () => {
    state.fear = clampFear(state.fear, state.maxFear)
    persistState()

    if (!applyingRemoteState) {
      void sessionClient.sendState(snapshotState())
    }
  },
  { deep: true },
)

watch(
  () => state.backgroundMode,
  () => {
    if (state.backgroundMode !== 'images') {
      state.activeImageIndex = 0
    }
  },
)

onMounted(() => {
  if (viewMode === 'controller' && !sessionWriteToken.value) {
    sessionWriteToken.value = createControllerToken()
  }

  sessionClient.connect()
  void refreshQrCodes()
  window.addEventListener('mousemove', revealInterface, { passive: true })
  window.addEventListener('pointerdown', revealInterface, { passive: true })
  window.addEventListener('touchstart', revealInterface, { passive: true })
  window.addEventListener('keydown', handleKeyboardShortcuts)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  imageRotationTimer = window.setInterval(rotateImages, 18000)

  if (viewMode === 'display') {
    revealInterface()
  }
})

onBeforeUnmount(() => {
  sessionClient.disconnect()
  window.removeEventListener('mousemove', revealInterface)
  window.removeEventListener('pointerdown', revealInterface)
  window.removeEventListener('touchstart', revealInterface)
  window.removeEventListener('keydown', handleKeyboardShortcuts)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.clearTimeout(hideInterfaceTimer)
  window.clearTimeout(copyNoticeTimer)
  window.clearTimeout(castNoticeTimer)
  window.clearInterval(imageRotationTimer)
})

function loadInitialState(): TrackerState {
  try {
    const savedState = window.localStorage.getItem(STORAGE_KEY)

    if (!savedState) {
      return normalizeTrackerState(defaultState, defaultState)
    }

    return normalizeTrackerState(
      {
        ...(JSON.parse(savedState) as Partial<TrackerState>),
        sessionId: defaultSessionId,
        syncServerUrl: defaultSyncServerUrl,
      },
      defaultState,
    )
  } catch {
    return normalizeTrackerState(defaultState, defaultState)
  }
}

function snapshotState(): TrackerState {
  return normalizeTrackerState(state, defaultState)
}

function persistState() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshotState()))
}

function createSessionId() {
  return `fear-${secureHex(8)}`
}

function createControllerToken() {
  return secureBase64Url(24)
}

function normalizeToken(token: string) {
  return /^[A-Za-z0-9_-]{24,160}$/.test(token) ? token : ''
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

function buildLinkedUrl(mode: 'display' | 'controller') {
  const linkedUrl = new URL(window.location.href)
  linkedUrl.searchParams.set('session', state.sessionId)
  linkedUrl.searchParams.set('sync', state.syncServerUrl)

  if (mode === 'controller') {
    linkedUrl.searchParams.set('mode', 'controller')
    if (sessionWriteToken.value) {
      linkedUrl.searchParams.set('token', sessionWriteToken.value)
    } else {
      linkedUrl.searchParams.delete('token')
    }
  } else {
    linkedUrl.searchParams.delete('mode')
    linkedUrl.searchParams.delete('token')
  }

  return linkedUrl.toString()
}

function enableControllerToken() {
  if (!sessionWriteToken.value) {
    sessionWriteToken.value = createControllerToken()
  }
}

function rotateControllerToken() {
  sessionWriteToken.value = createControllerToken()
}

function buildYoutubeEmbedUrl(source: string) {
  const videoId = extractYoutubeId(source)

  if (!videoId) {
    return ''
  }

  return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${videoId}&modestbranding=1&playsinline=1&rel=0`
}

function extractYoutubeId(source: string) {
  if (!source.trim()) {
    return ''
  }

  try {
    const youtubeUrl = new URL(source)

    if (youtubeUrl.hostname.includes('youtu.be')) {
      return youtubeUrl.pathname.replace('/', '')
    }

    if (youtubeUrl.searchParams.get('v')) {
      return youtubeUrl.searchParams.get('v') ?? ''
    }

    const segments = youtubeUrl.pathname.split('/').filter(Boolean)

    if ((segments[0] === 'shorts' || segments[0] === 'embed') && segments[1]) {
      return segments[1]
    }
  } catch {
    return source.trim()
  }

  return source.trim()
}

function handleKeyboardShortcuts(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null

  if (target?.closest('input, textarea, select, button')) {
    return
  }

  if (viewMode === 'display') {
    revealInterface()
  }

  if (event.key === 'ArrowUp' || event.key === 'ArrowRight' || event.key === '+') {
    event.preventDefault()
    incrementFear()
    return
  }

  if (event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === '-') {
    event.preventDefault()
    decrementFear()
    return
  }

  if (/^[0-9]$/.test(event.key)) {
    if (!canWrite.value) {
      return
    }

    state.fear = clampFear(Number(event.key), state.maxFear)
  }
}

function handleVisibilityChange() {
  tabActive.value = !document.hidden

  if (document.hidden) {
    interfaceVisible.value = false
    settingsOpen.value = false
  } else if (viewMode === 'display') {
    revealInterface()
  }
}

function revealInterface() {
  if (viewMode !== 'display' || document.hidden) {
    return
  }

  interfaceVisible.value = true
  window.clearTimeout(hideInterfaceTimer)
  hideInterfaceTimer = window.setTimeout(() => {
    if (!settingsOpen.value) {
      interfaceVisible.value = false
    }
  }, 2400)
}

function rotateImages() {
  if (viewMode !== 'display' || state.backgroundMode !== 'images' || state.imageUrls.length < 2) {
    return
  }

  state.activeImageIndex = (state.activeImageIndex + 1) % state.imageUrls.length
}

function incrementFear() {
  if (!canWrite.value) {
    return
  }

  state.fear = clampFear(state.fear + 1, state.maxFear)
}

function decrementFear() {
  if (!canWrite.value) {
    return
  }

  state.fear = clampFear(state.fear - 1, state.maxFear)
}

function applyTheme(presetId: string) {
  const preset = THEME_PRESETS.find((entry) => entry.id === presetId)

  if (!preset) {
    return
  }

  state.themeId = preset.id
  state.colors = { ...preset.colors }
}

function applyGlobalIcon() {
  const icons = { ...state.fearIcons }

  for (const fear of fearSlots.value) {
    icons[String(fear)] = state.globalIcon
  }

  state.fearIcons = icons
}

function setFearIcon(fear: number, icon: string) {
  state.fearIcons = {
    ...state.fearIcons,
    [String(fear)]: icon,
  }
}

function resetThemeColors() {
  applyTheme(activeTheme.value.id)
}

async function copyLink(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    copyNotice.value = `${label} copied`
  } catch {
    copyNotice.value = `${label} unavailable`
  }

  window.clearTimeout(copyNoticeTimer)
  copyNoticeTimer = window.setTimeout(() => {
    copyNotice.value = ''
  }, 1800)
}

async function launchChromecastFlow() {
  try {
    await navigator.clipboard.writeText(displayLink.value)
  } catch {
    // Clipboard permission can fail; cast flow still works with manual copy.
  }

  window.open(displayLink.value, '_blank', 'noopener,noreferrer')
  castNotice.value = 'Display link opened. In Chrome use menu > Cast, save, and share your full screen or this tab.'

  window.clearTimeout(castNoticeTimer)
  castNoticeTimer = window.setTimeout(() => {
    castNotice.value = ''
  }, 4200)
}

async function refreshQrCodes() {
  try {
    const [displayQr, controllerQr] = await Promise.all([
      QRCode.toDataURL(displayLink.value, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 220,
      }),
      QRCode.toDataURL(controllerLink.value, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 220,
      }),
    ])

    displayQrDataUrl.value = displayQr
    controllerQrDataUrl.value = controllerQr
  } catch {
    displayQrDataUrl.value = ''
    controllerQrDataUrl.value = ''
  }
}

function setBackgroundMode(mode: BackgroundMode) {
  state.backgroundMode = mode
}

function cycleBackground(direction: 1 | -1) {
  if (state.imageUrls.length === 0) {
    state.activeImageIndex = 0
    return
  }

  const nextIndex = state.activeImageIndex + direction
  const total = state.imageUrls.length
  state.activeImageIndex = ((nextIndex % total) + total) % total
}

function trackerClick() {
  if (viewMode === 'display') {
    incrementFear()
  }
}

function trackerContextMenu() {
  if (viewMode === 'display') {
    decrementFear()
  }
}

function updateColor(key: keyof ThemeColors, value: string) {
  state.colors = {
    ...state.colors,
    [key]: value,
  }
}

function handleFearIconChange(fear: number, event: Event) {
  const target = event.target as HTMLSelectElement | null

  if (target) {
    setFearIcon(fear, target.value)
  }
}

function handleThemeSelect(event: Event) {
  const target = event.target as HTMLSelectElement | null

  if (target) {
    applyTheme(target.value)
  }
}

function handleColorChange(key: keyof ThemeColors, event: Event) {
  const target = event.target as HTMLInputElement | null

  if (target) {
    updateColor(key, target.value)
  }
}
</script>

<template>
  <div class="app-shell" :class="[`mode-${viewMode}`, fearStateClass]" :style="trackerStyle">
    <div class="background-stack" aria-hidden="true">
      <iframe
        v-if="state.backgroundMode === 'youtube' && youtubeEmbedUrl"
        class="youtube-layer"
        :src="youtubeEmbedUrl"
        title="Ambient background video"
        allow="autoplay; encrypted-media; picture-in-picture"
      />
      <div
        v-else-if="state.backgroundMode === 'images' && activeImageUrl"
        class="image-layer"
        :style="{ backgroundImage: `url(${activeImageUrl})` }"
      />
      <div class="ambient-gradient" />
      <div class="screen-noise" />
      <div class="screen-vignette" />
    </div>

    <button
      v-if="showSettingsToggle"
      class="settings-toggle"
      type="button"
      :aria-pressed="settingsOpen"
      aria-label="Open settings"
      @click="settingsOpen = !settingsOpen"
    >
      <Icon icon="mdi:cog-outline" />
    </button>

    <main v-if="viewMode === 'display'" class="display-stage">
      <button class="tracker" type="button" @click="trackerClick" @contextmenu.prevent="trackerContextMenu">
        <span class="tracker-aura" />
        <Icon class="tracker-icon" :icon="iconForFear" />
        <span class="tracker-value">{{ fearValueLabel }}</span>
      </button>
    </main>

    <main v-else class="controller-stage">
      <section class="controller-hero">
        <div class="controller-preview">
          <Icon class="controller-icon" :icon="iconForFear" />
          <span class="controller-value">{{ fearValueLabel }}</span>
          <span class="controller-status">Session {{ state.sessionId }} · {{ syncLabel }}</span>
        </div>
        <div class="controller-actions">
          <button type="button" class="control-button" :disabled="!canWrite" @click="decrementFear">-1 Fear</button>
          <button type="button" class="control-button emphasis" :disabled="!canWrite" @click="incrementFear">+1 Fear</button>
        </div>
        <label class="field-group">
          <span>Fear value</span>
          <input v-model.number="state.fear" type="range" min="0" :max="state.maxFear" :disabled="!canWrite" />
        </label>
      </section>
    </main>

    <aside class="settings-panel" :class="{ open: settingsOpen || viewMode === 'controller' }">
      <div class="settings-scroll">
        <section class="settings-section">
          <div class="section-heading">
            <h2>Session</h2>
            <span>{{ syncLabel }}</span>
          </div>
          <p class="inline-note">Role: {{ canWrite ? 'controller write access' : 'display read only' }}</p>
          <label class="field-group">
            <span>Session code</span>
            <input v-model.trim="state.sessionId" type="text" maxlength="32" placeholder="fear-a1b2c3d4" />
          </label>
          <label class="field-group">
            <span>Sync API base</span>
            <input v-model.trim="state.syncServerUrl" type="text" placeholder="/api or https://your-app.vercel.app/api" />
          </label>
          <div class="button-row">
            <button v-if="!sessionWriteToken" type="button" class="soft-button" @click="enableControllerToken">Generate controller token</button>
            <button v-else type="button" class="soft-button" @click="rotateControllerToken">Rotate controller token</button>
          </div>
          <div class="button-row">
            <button type="button" class="soft-button" @click="copyLink(displayLink, 'Display link')">Copy display link</button>
            <button type="button" class="soft-button" @click="copyLink(controllerLink, 'Controller link')">Copy controller link</button>
          </div>
          <div class="qr-grid">
            <figure class="qr-card">
              <img v-if="displayQrDataUrl" :src="displayQrDataUrl" alt="QR code for display link" />
              <p>Display QR</p>
            </figure>
            <figure class="qr-card">
              <img v-if="controllerQrDataUrl" :src="controllerQrDataUrl" alt="QR code for controller link" />
              <p>Controller QR</p>
            </figure>
          </div>
          <p v-if="!displayQrDataUrl || !controllerQrDataUrl" class="inline-note">QR generation unavailable. Use copy link buttons.</p>
          <p class="inline-note">Only controller links include the secure write token.</p>
          <p v-if="copyNotice" class="inline-note">{{ copyNotice }}</p>
        </section>

        <section class="settings-section">
          <div class="section-heading">
            <h2>Cast to TV</h2>
            <span>Free options by platform</span>
          </div>
          <div class="button-row">
            <button type="button" class="soft-button emphasis" @click="launchChromecastFlow">Chromecast from Chrome</button>
          </div>
          <ul class="quick-list">
            <li>Chromecast: open the display link in Chrome and use Cast tab or Cast screen.</li>
            <li>Apple TV: open the display link in Safari on iPhone or iPad and use AirPlay screen mirror.</li>
            <li>Windows to smart TV: use Windows + K to connect with Miracast then fullscreen browser.</li>
            <li>Android TV: use Smart View, Cast, or Screen Share from quick settings.</li>
            <li>Universal fallback: HDMI cable from laptop or tablet to TV.</li>
          </ul>
          <p v-if="castNotice" class="inline-note">{{ castNotice }}</p>
          <p class="inline-note">Use the display link on the casted screen and the controller link on your phone.</p>
        </section>

        <fieldset class="settings-fieldset" :disabled="!canWrite">

        <section class="settings-section">
          <div class="section-heading">
            <h2>Tracker</h2>
            <span>TV-safe drift stays on automatically</span>
          </div>
          <div class="button-row compact">
            <button type="button" class="soft-button" @click="decrementFear">Lower fear</button>
            <button type="button" class="soft-button emphasis" @click="incrementFear">Raise fear</button>
          </div>
          <label class="field-group">
            <span>Maximum fear</span>
            <input v-model.number="state.maxFear" type="number" min="1" max="30" />
          </label>
          <label class="field-group">
            <span>Font</span>
            <select v-model="state.fontId">
              <option v-for="font in FONT_OPTIONS" :key="font.id" :value="font.id">{{ font.label }}</option>
            </select>
          </label>
        </section>

        <section class="settings-section">
          <div class="section-heading">
            <h2>Icons</h2>
            <span>Default is a skull, then override per value</span>
          </div>
          <label class="field-group">
            <span>Icon for all fear values</span>
            <select v-model="state.globalIcon">
              <option v-for="icon in ICON_OPTIONS" :key="icon.id" :value="icon.icon">{{ icon.label }}</option>
            </select>
          </label>
          <button type="button" class="soft-button" @click="applyGlobalIcon">Apply current icon to every slot</button>
          <div class="fear-icon-grid">
            <label v-for="fear in fearSlots" :key="fear" class="slot-card">
              <span>Fear {{ fear }}</span>
              <select :value="state.fearIcons[String(fear)] || state.globalIcon" @change="handleFearIconChange(fear, $event)">
                <option v-for="icon in ICON_OPTIONS" :key="`${fear}-${icon.id}`" :value="icon.icon">{{ icon.label }}</option>
              </select>
            </label>
          </div>
        </section>

        <section class="settings-section">
          <div class="section-heading">
            <h2>Color story</h2>
            <span>Preset moods inspired by the book without naming them directly</span>
          </div>
          <label class="field-group">
            <span>Preset palette</span>
            <select :value="state.themeId" @change="handleThemeSelect">
              <option v-for="theme in THEME_PRESETS" :key="theme.id" :value="theme.id">{{ theme.label }}</option>
            </select>
          </label>
          <div class="color-grid">
            <label class="field-group color-field">
              <span>Accent</span>
              <input :value="state.colors.accent" type="color" @input="handleColorChange('accent', $event)" />
            </label>
            <label class="field-group color-field">
              <span>Glow</span>
              <input :value="state.colors.glow" type="color" @input="handleColorChange('glow', $event)" />
            </label>
            <label class="field-group color-field">
              <span>Text</span>
              <input :value="state.colors.text" type="color" @input="handleColorChange('text', $event)" />
            </label>
            <label class="field-group color-field">
              <span>Ring</span>
              <input :value="state.colors.ring" type="color" @input="handleColorChange('ring', $event)" />
            </label>
            <label class="field-group color-field">
              <span>Backdrop</span>
              <input :value="state.colors.backgroundAccent" type="color" @input="handleColorChange('backgroundAccent', $event)" />
            </label>
            <label class="field-group color-field">
              <span>Base</span>
              <input :value="state.colors.background" type="color" @input="handleColorChange('background', $event)" />
            </label>
          </div>
          <button type="button" class="soft-button" @click="resetThemeColors">Reset to current preset</button>
        </section>

        <section class="settings-section">
          <div class="section-heading">
            <h2>Background</h2>
            <span>Use motion or image cycling to reduce TV burn-in</span>
          </div>
          <div class="button-row compact">
            <button type="button" class="soft-button" :class="{ active: state.backgroundMode === 'none' }" @click="setBackgroundMode('none')">No media</button>
            <button type="button" class="soft-button" :class="{ active: state.backgroundMode === 'youtube' }" @click="setBackgroundMode('youtube')">YouTube</button>
            <button type="button" class="soft-button" :class="{ active: state.backgroundMode === 'images' }" @click="setBackgroundMode('images')">Images</button>
          </div>
          <label class="field-group">
            <span>YouTube link</span>
            <input v-model.trim="state.youtubeUrl" type="url" placeholder="https://www.youtube.com/watch?v=..." />
          </label>
          <label class="field-group">
            <span>Background image URLs</span>
            <textarea v-model="imageUrlsText" rows="4" placeholder="One URL per line" />
          </label>
          <div class="button-row compact">
            <button type="button" class="soft-button" @click="cycleBackground(-1)">Previous image</button>
            <button type="button" class="soft-button" @click="cycleBackground(1)">Next image</button>
          </div>
        </section>
        </fieldset>
      </div>
    </aside>
  </div>
</template>
