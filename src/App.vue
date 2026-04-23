<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import ControllerStage from './components/ControllerStage.vue'
import DisplayStage from './components/DisplayStage.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import { useLinkQrCodes } from './composables/useLinkQrCodes'
import { buildYoutubeEmbedUrl, isSafeHttpUrl } from './lib/media-utils'
import { createSessionClient, type SessionStatus } from './lib/session-client'
import {
  buildLinkedUrl,
  createControllerToken,
  normalizeApiBaseInput,
  resolveInitialSessionParams,
} from './lib/session-links'
import {
  FONT_OPTIONS,
  MAX_COUNTDOWNS,
  THEME_PRESETS,
  clampCountdownMax,
  clampCountdownValue,
  clampFear,
  createDefaultTrackerState,
  getCountdownAdvance,
  normalizeTrackerState,
  type BackgroundMode,
  type Countdown,
  type RollOutcome,
  type ThemeColors,
  type TrackerState,
} from './lib/tracker-config'

const STORAGE_KEY = 'daggerheart-fear-tracker-state-v1'
const MAX_SYNC_IMAGE_URLS = 8
const MAX_SYNC_URL_LENGTH = 320

const initialSession = resolveInitialSessionParams(window.location.href)
const viewMode = initialSession.viewMode
const defaultState = createDefaultTrackerState(initialSession.syncServerUrl, initialSession.sessionId)
const state = reactive(loadInitialState())
const sessionWriteToken = ref(
  initialSession.controllerToken || (viewMode === 'controller' ? createControllerToken() : ''),
)
const settingsOpen = ref(viewMode === 'controller')
const interfaceVisible = ref(viewMode === 'controller')
const tabActive = ref(!document.hidden)
const connectionStatus = ref<SessionStatus>('disconnected')
const canWrite = ref(false)
const copyNotice = ref('')
const castNotice = ref('')

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
      .map((entry) => entry.trim().slice(0, MAX_SYNC_URL_LENGTH))
      .filter((entry) => isSafeHttpUrl(entry))
      .slice(0, MAX_SYNC_IMAGE_URLS)

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
const displayLink = computed(() =>
  buildLinkedUrl(window.location.href, 'display', state.sessionId, state.syncServerUrl, sessionWriteToken.value),
)
const controllerLink = computed(() =>
  buildLinkedUrl(window.location.href, 'controller', state.sessionId, state.syncServerUrl, sessionWriteToken.value),
)
const { displayQrDataUrl, controllerQrDataUrl } = useLinkQrCodes(displayLink, controllerLink)

watch(
  () => state.syncServerUrl,
  (nextValue) => {
    const normalized = normalizeApiBaseInput(nextValue)

    if (normalized !== nextValue) {
      state.syncServerUrl = normalized
    }
  },
)

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
  sessionClient.connect()
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
        sessionId: initialSession.sessionId,
        syncServerUrl: initialSession.syncServerUrl,
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

function updateColor(key: keyof ThemeColors, value: string) {
  state.colors = {
    ...state.colors,
    [key]: value,
  }
}

function updateImageUrlsText(value: string) {
  imageUrlsText.value = value
}

function addCountdown() {
  if (state.countdowns.length >= MAX_COUNTDOWNS) {
    return
  }

  state.countdowns = [
    ...state.countdowns,
    {
      id: createCountdownId(),
      name: `Countdown ${state.countdowns.length + 1}`,
      kind: 'standard',
      value: 4,
      max: 4,
    },
  ]
}

function updateCountdown(id: string, patch: Partial<Countdown>) {
  state.countdowns = state.countdowns.map((countdown) => {
    if (countdown.id !== id) {
      return countdown
    }

    const nextMax = patch.max === undefined ? countdown.max : clampCountdownMax(Number(patch.max))
    const nextValue =
      patch.value === undefined ? clampCountdownValue(countdown.value, nextMax) : clampCountdownValue(Number(patch.value), nextMax)

    return {
      ...countdown,
      ...patch,
      max: nextMax,
      value: nextValue,
      effect: patch.effect?.trim() || patch.effect === '' ? patch.effect.trim() : countdown.effect,
    }
  })
}

function deleteCountdown(id: string) {
  state.countdowns = state.countdowns.filter((countdown) => countdown.id !== id)
}

function tickCountdown(id: string, amount: number) {
  state.countdowns = state.countdowns.map((countdown) =>
    countdown.id === id
      ? {
          ...countdown,
          value: clampCountdownValue(countdown.value - amount, countdown.max),
        }
      : countdown,
  )
}

function resetCountdown(id: string) {
  state.countdowns = state.countdowns.map((countdown) =>
    countdown.id === id
      ? {
          ...countdown,
          value: countdown.max,
        }
      : countdown,
  )
}

function completeCountdown(id: string) {
  state.countdowns = state.countdowns.map((countdown) =>
    countdown.id === id
      ? {
          ...countdown,
          value: 0,
        }
      : countdown,
  )
}

function applyRollOutcome(outcome: RollOutcome) {
  state.countdowns = state.countdowns.map((countdown) => ({
    ...countdown,
    value: clampCountdownValue(countdown.value - getCountdownAdvance(countdown.kind, outcome), countdown.max),
  }))
}

function createCountdownId() {
  return `countdown-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
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

    <DisplayStage
      v-if="viewMode === 'display'"
      :icon="iconForFear"
      :fear-value-label="fearValueLabel"
      :countdowns="state.countdowns"
      @increment="incrementFear"
      @decrement="decrementFear"
    />
    <ControllerStage
      v-else
      v-model:fear="state.fear"
      :icon="iconForFear"
      :fear-value-label="fearValueLabel"
      :session-id="state.sessionId"
      :sync-label="syncLabel"
      :max-fear="state.maxFear"
      :can-write="canWrite"
      @decrement="decrementFear"
      @increment="incrementFear"
    />

    <SettingsPanel
      :open="settingsOpen"
      :view-mode="viewMode"
      :state="state"
      :session-write-token="sessionWriteToken"
      :sync-label="syncLabel"
      :can-write="canWrite"
      :display-link="displayLink"
      :controller-link="controllerLink"
      :display-qr-data-url="displayQrDataUrl"
      :controller-qr-data-url="controllerQrDataUrl"
      :copy-notice="copyNotice"
      :cast-notice="castNotice"
      :image-urls-text="imageUrlsText"
      @update-session-id="state.sessionId = $event"
      @update-sync-server-url="state.syncServerUrl = $event"
      @enable-controller-token="sessionWriteToken = createControllerToken()"
      @rotate-controller-token="sessionWriteToken = createControllerToken()"
      @copy-link="copyLink"
      @launch-chromecast-flow="launchChromecastFlow"
      @decrement-fear="decrementFear"
      @increment-fear="incrementFear"
      @update-max-fear="state.maxFear = $event"
      @update-font-id="state.fontId = $event"
      @update-global-icon="state.globalIcon = $event"
      @apply-global-icon="applyGlobalIcon"
      @set-fear-icon="setFearIcon"
      @apply-theme="applyTheme"
      @update-color="updateColor"
      @reset-theme-colors="resetThemeColors"
      @set-background-mode="setBackgroundMode"
      @update-youtube-url="state.youtubeUrl = $event"
      @update-image-urls-text="updateImageUrlsText"
      @cycle-background="cycleBackground"
      @add-countdown="addCountdown"
      @update-countdown="updateCountdown"
      @delete-countdown="deleteCountdown"
      @tick-countdown="tickCountdown"
      @reset-countdown="resetCountdown"
      @complete-countdown="completeCountdown"
      @apply-roll-outcome="applyRollOutcome"
    />
  </div>
</template>
