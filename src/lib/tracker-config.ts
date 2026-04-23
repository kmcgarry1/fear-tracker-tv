export type BackgroundMode = 'none' | 'youtube' | 'images'
export type CountdownKind = 'standard' | 'progress' | 'consequence'
export type RollOutcome = 'critical' | 'success-hope' | 'success-fear' | 'failure-hope' | 'failure-fear'

export interface Countdown {
  id: string
  name: string
  kind: CountdownKind
  value: number
  max: number
  effect?: string
}

export interface ThemeColors {
  background: string
  backgroundAccent: string
  accent: string
  glow: string
  text: string
  ring: string
  shadow: string
  vignette: string
}

export interface ThemePreset {
  id: string
  label: string
  colors: ThemeColors
}

export interface FontOption {
  id: string
  label: string
  family: string
}

export interface IconOption {
  id: string
  label: string
  icon: string
}

export interface TrackerState {
  fear: number
  maxFear: number
  fontId: string
  themeId: string
  colors: ThemeColors
  globalIcon: string
  fearIcons: Record<string, string>
  backgroundMode: BackgroundMode
  youtubeUrl: string
  imageUrls: string[]
  activeImageIndex: number
  countdowns: Countdown[]
  sessionId: string
  syncServerUrl: string
}

export const FONT_OPTIONS: FontOption[] = [
  { id: 'cinzel', label: 'Cinzel', family: "'Cinzel', serif" },
  { id: 'uncial', label: 'Uncial Antiqua', family: "'Uncial Antiqua', serif" },
  { id: 'cormorant', label: 'Cormorant Garamond', family: "'Cormorant Garamond', serif" },
  { id: 'spectral', label: 'Spectral SC', family: "'Spectral SC', serif" },
]

export const ICON_OPTIONS: IconOption[] = [
  { id: 'skull', label: 'Skull', icon: 'game-icons:skull-crossed-bones' },
  { id: 'burning-skull', label: 'Burning Skull', icon: 'game-icons:burning-skull' },
  { id: 'dragon', label: 'Dragon Head', icon: 'game-icons:dragon-head' },
  { id: 'wyrm', label: 'Spiked Wyrm', icon: 'game-icons:spiked-dragon-head' },
  { id: 'witch', label: 'Witch Face', icon: 'game-icons:witch-face' },
  { id: 'orb', label: 'Crystal Ball', icon: 'game-icons:crystal-ball' },
  { id: 'wolf', label: 'Wolf Head', icon: 'game-icons:wolf-head' },
  { id: 'blade', label: 'Broadsword', icon: 'game-icons:broadsword' },
  { id: 'phantom', label: 'Hooded Figure', icon: 'game-icons:hooded-figure' },
]

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'ember-court',
    label: 'Ember Court',
    colors: {
      background: '#140506',
      backgroundAccent: '#421216',
      accent: '#ff8a5b',
      glow: '#ffcc7a',
      text: '#fff4df',
      ring: '#7d1f18',
      shadow: 'rgba(255, 88, 38, 0.35)',
      vignette: 'rgba(9, 1, 2, 0.74)',
    },
  },
  {
    id: 'storm-archive',
    label: 'Storm Archive',
    colors: {
      background: '#08111b',
      backgroundAccent: '#18364d',
      accent: '#77d2ff',
      glow: '#d6f3ff',
      text: '#edf6ff',
      ring: '#26556c',
      shadow: 'rgba(90, 188, 255, 0.33)',
      vignette: 'rgba(2, 7, 14, 0.8)',
    },
  },
  {
    id: 'verdant-relic',
    label: 'Verdant Relic',
    colors: {
      background: '#07120c',
      backgroundAccent: '#133821',
      accent: '#72df87',
      glow: '#d0ffd7',
      text: '#ebfff0',
      ring: '#295d39',
      shadow: 'rgba(83, 191, 103, 0.3)',
      vignette: 'rgba(2, 8, 3, 0.78)',
    },
  },
  {
    id: 'ashen-throne',
    label: 'Ashen Throne',
    colors: {
      background: '#0e0e12',
      backgroundAccent: '#2e2c39',
      accent: '#c5b0ff',
      glow: '#f0e7ff',
      text: '#f4efff',
      ring: '#4d4465',
      shadow: 'rgba(174, 142, 255, 0.32)',
      vignette: 'rgba(3, 3, 8, 0.82)',
    },
  },
  {
    id: 'sunken-opal',
    label: 'Sunken Opal',
    colors: {
      background: '#041216',
      backgroundAccent: '#0c3740',
      accent: '#6de2d7',
      glow: '#dbffff',
      text: '#eaffff',
      ring: '#1f5960',
      shadow: 'rgba(85, 213, 202, 0.32)',
      vignette: 'rgba(1, 7, 9, 0.82)',
    },
  },
  {
    id: 'gilded-night',
    label: 'Gilded Night',
    colors: {
      background: '#161007',
      backgroundAccent: '#41311a',
      accent: '#f2c66f',
      glow: '#fff3d0',
      text: '#fff9ec',
      ring: '#7b6032',
      shadow: 'rgba(228, 183, 84, 0.34)',
      vignette: 'rgba(8, 4, 1, 0.8)',
    },
  },
]

export const DEFAULT_MAX_FEAR = 12
export const DEFAULT_ICON = ICON_OPTIONS[0].icon
export const MAX_COUNTDOWNS = 6
export const MAX_COUNTDOWN_VALUE = 20
export const COUNTDOWN_NAME_MAX_LENGTH = 48
export const COUNTDOWN_EFFECT_MAX_LENGTH = 120

export const ROLL_OUTCOME_OPTIONS: Array<{ id: RollOutcome; label: string }> = [
  { id: 'critical', label: 'Critical' },
  { id: 'success-hope', label: 'Success with Hope' },
  { id: 'success-fear', label: 'Success with Fear' },
  { id: 'failure-hope', label: 'Failure with Hope' },
  { id: 'failure-fear', label: 'Failure with Fear' },
]

export function createDefaultTrackerState(syncServerUrl: string, sessionId: string): TrackerState {
  const preset = THEME_PRESETS[0]

  return {
    fear: 0,
    maxFear: DEFAULT_MAX_FEAR,
    fontId: FONT_OPTIONS[0].id,
    themeId: preset.id,
    colors: { ...preset.colors },
    globalIcon: DEFAULT_ICON,
    fearIcons: {},
    backgroundMode: 'none',
    youtubeUrl: '',
    imageUrls: [],
    activeImageIndex: 0,
    countdowns: [],
    sessionId,
    syncServerUrl,
  }
}

export function clampFear(fear: number, maxFear: number): number {
  return Math.max(0, Math.min(Math.round(fear), Math.max(0, Math.round(maxFear))))
}

export function clampCountdownValue(value: number, max: number): number {
  const normalizedMax = clampCountdownMax(max)
  const rounded = Number.isFinite(value) ? Math.round(value) : normalizedMax
  return Math.max(0, Math.min(rounded, normalizedMax))
}

export function clampCountdownMax(value: number): number {
  return Math.max(1, Math.min(Math.round(value), MAX_COUNTDOWN_VALUE))
}

export function getCountdownAdvance(kind: CountdownKind, outcome: RollOutcome): number {
  if (kind === 'standard') {
    return 1
  }

  if (kind === 'progress') {
    switch (outcome) {
      case 'critical':
        return 3
      case 'success-hope':
        return 2
      case 'success-fear':
        return 1
      default:
        return 0
    }
  }

  switch (outcome) {
    case 'failure-fear':
      return 3
    case 'failure-hope':
      return 2
    case 'success-fear':
      return 1
    default:
      return 0
  }
}

export function normalizeCountdowns(value: unknown): Countdown[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.slice(0, MAX_COUNTDOWNS).map((entry, index) => {
    const input = entry && typeof entry === 'object' ? (entry as Partial<Countdown>) : {}
    const max = clampCountdownMax(Number(input.max) || 1)
    const name = sanitizeText(input.name, `Countdown ${index + 1}`, COUNTDOWN_NAME_MAX_LENGTH)
    const effect = sanitizeText(input.effect, '', COUNTDOWN_EFFECT_MAX_LENGTH)

    return {
      id: sanitizeText(input.id, `countdown-${index + 1}`, 80),
      name,
      kind: normalizeCountdownKind(input.kind),
      value: clampCountdownValue(Number(input.value), max),
      max,
      ...(effect ? { effect } : {}),
    }
  })
}

function normalizeCountdownKind(value: unknown): CountdownKind {
  return value === 'progress' || value === 'consequence' || value === 'standard' ? value : 'standard'
}

function sanitizeText(value: unknown, fallback: string, maxLength: number): string {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : fallback
}

export function normalizeTrackerState(
  input: Partial<TrackerState> | null | undefined,
  defaults: TrackerState,
): TrackerState {
  const maxFear = Number.isFinite(input?.maxFear) ? Math.max(0, Math.round(input?.maxFear ?? defaults.maxFear)) : defaults.maxFear
  const themeId = typeof input?.themeId === 'string' ? input.themeId : defaults.themeId
  const presetTheme = THEME_PRESETS.find((preset) => preset.id === themeId) ?? THEME_PRESETS[0]
  const baseColors = presetTheme.colors
  const imageUrls = Array.isArray(input?.imageUrls)
    ? input.imageUrls.map((value) => value.trim()).filter(Boolean)
    : defaults.imageUrls
  const countdowns = normalizeCountdowns(input?.countdowns)

  return {
    fear: clampFear(input?.fear ?? defaults.fear, maxFear),
    maxFear,
    fontId: typeof input?.fontId === 'string' ? input.fontId : defaults.fontId,
    themeId,
    colors: {
      background: input?.colors?.background ?? baseColors.background,
      backgroundAccent: input?.colors?.backgroundAccent ?? baseColors.backgroundAccent,
      accent: input?.colors?.accent ?? baseColors.accent,
      glow: input?.colors?.glow ?? baseColors.glow,
      text: input?.colors?.text ?? baseColors.text,
      ring: input?.colors?.ring ?? baseColors.ring,
      shadow: input?.colors?.shadow ?? baseColors.shadow,
      vignette: input?.colors?.vignette ?? baseColors.vignette,
    },
    globalIcon: typeof input?.globalIcon === 'string' && input.globalIcon ? input.globalIcon : defaults.globalIcon,
    fearIcons: Object.entries(input?.fearIcons ?? {}).reduce<Record<string, string>>((icons, [key, value]) => {
      if (typeof value === 'string' && value) {
        icons[key] = value
      }
      return icons
    }, {}),
    backgroundMode:
      input?.backgroundMode === 'youtube' || input?.backgroundMode === 'images' || input?.backgroundMode === 'none'
        ? input.backgroundMode
        : defaults.backgroundMode,
    youtubeUrl: typeof input?.youtubeUrl === 'string' ? input.youtubeUrl : defaults.youtubeUrl,
    imageUrls,
    activeImageIndex: imageUrls.length === 0 ? 0 : clampFear(input?.activeImageIndex ?? defaults.activeImageIndex, imageUrls.length - 1),
    countdowns,
    sessionId: typeof input?.sessionId === 'string' && input.sessionId ? input.sessionId : defaults.sessionId,
    syncServerUrl:
      typeof input?.syncServerUrl === 'string' && input.syncServerUrl
        ? input.syncServerUrl
        : defaults.syncServerUrl,
  }
}
