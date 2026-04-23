<script setup lang="ts">
import { computed } from 'vue'

import {
  MAX_COUNTDOWNS,
  FONT_OPTIONS,
  ICON_OPTIONS,
  ROLL_OUTCOME_OPTIONS,
  THEME_PRESETS,
  type BackgroundMode,
  type Countdown,
  type CountdownKind,
  type RollOutcome,
  type ThemeColors,
  type TrackerState,
} from '../lib/tracker-config'
import type { ViewMode } from '../lib/session-links'

const props = defineProps<{
  open: boolean
  viewMode: ViewMode
  state: TrackerState
  sessionWriteToken: string
  syncLabel: string
  canWrite: boolean
  displayLink: string
  controllerLink: string
  displayQrDataUrl: string
  controllerQrDataUrl: string
  copyNotice: string
  castNotice: string
  imageUrlsText: string
}>()

const emit = defineEmits<{
  'update-session-id': [value: string]
  'update-sync-server-url': [value: string]
  'enable-controller-token': []
  'rotate-controller-token': []
  'copy-link': [value: string, label: string]
  'launch-chromecast-flow': []
  'decrement-fear': []
  'increment-fear': []
  'update-max-fear': [value: number]
  'update-font-id': [value: string]
  'update-global-icon': [value: string]
  'apply-global-icon': []
  'set-fear-icon': [fear: number, icon: string]
  'apply-theme': [themeId: string]
  'update-color': [key: keyof ThemeColors, value: string]
  'reset-theme-colors': []
  'set-background-mode': [mode: BackgroundMode]
  'update-youtube-url': [value: string]
  'update-image-urls-text': [value: string]
  'cycle-background': [direction: 1 | -1]
  'add-countdown': []
  'update-countdown': [id: string, patch: Partial<Countdown>]
  'delete-countdown': [id: string]
  'tick-countdown': [id: string, amount: number]
  'reset-countdown': [id: string]
  'complete-countdown': [id: string]
  'apply-roll-outcome': [outcome: RollOutcome]
}>()

const fearSlots = computed(() => Array.from({ length: props.state.maxFear + 1 }, (_, index) => index))

function getFieldValue(event: Event) {
  const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null
  return target?.value ?? ''
}

function updateNumber(event: Event, eventName: 'update-max-fear') {
  const value = Number(getFieldValue(event))

  if (Number.isFinite(value)) {
    emit(eventName, value)
  }
}

function updateFearIcon(fear: number, event: Event) {
  emit('set-fear-icon', fear, getFieldValue(event))
}

function updateColor(key: keyof ThemeColors, event: Event) {
  emit('update-color', key, getFieldValue(event))
}

function updateCountdownKind(id: string, event: Event) {
  emit('update-countdown', id, { kind: getFieldValue(event) as CountdownKind })
}

function updateCountdownNumber(id: string, field: 'value' | 'max', event: Event) {
  const value = Number(getFieldValue(event))

  if (Number.isFinite(value)) {
    emit('update-countdown', id, { [field]: value })
  }
}
</script>

<template>
  <aside class="settings-panel" :class="{ open: open || viewMode === 'controller' }">
    <div class="settings-scroll">
      <section class="settings-section">
        <div class="section-heading">
          <h2>Session</h2>
          <span>{{ syncLabel }}</span>
        </div>
        <p class="inline-note">Role: {{ canWrite ? 'controller write access' : 'display read only' }}</p>
        <label class="field-group">
          <span>Session code</span>
          <input
            :value="state.sessionId"
            type="text"
            maxlength="32"
            placeholder="fear-a1b2c3d4"
            @input="emit('update-session-id', getFieldValue($event).trim())"
          />
        </label>
        <label class="field-group">
          <span>Sync API base</span>
          <input
            :value="state.syncServerUrl"
            type="text"
            placeholder="/api or https://your-app.vercel.app/api"
            @input="emit('update-sync-server-url', getFieldValue($event).trim())"
          />
        </label>
        <div class="button-row">
          <button
            v-if="!sessionWriteToken"
            type="button"
            class="soft-button"
            @click="emit('enable-controller-token')"
          >
            Generate controller token
          </button>
          <button v-else type="button" class="soft-button" @click="emit('rotate-controller-token')">
            Rotate controller token
          </button>
        </div>
        <div class="button-row">
          <button type="button" class="soft-button" @click="emit('copy-link', displayLink, 'Display link')">
            Copy display link
          </button>
          <button type="button" class="soft-button" @click="emit('copy-link', controllerLink, 'Controller link')">
            Copy controller link
          </button>
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
        <p v-if="!displayQrDataUrl || !controllerQrDataUrl" class="inline-note">
          QR generation unavailable. Use copy link buttons.
        </p>
        <p class="inline-note">Only controller links include the secure write token.</p>
        <p v-if="copyNotice" class="inline-note">{{ copyNotice }}</p>
      </section>

      <section class="settings-section">
        <div class="section-heading">
          <h2>Cast to TV</h2>
          <span>Free options by platform</span>
        </div>
        <div class="button-row">
          <button type="button" class="soft-button emphasis" @click="emit('launch-chromecast-flow')">
            Chromecast from Chrome
          </button>
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
            <button type="button" class="soft-button" @click="emit('decrement-fear')">Lower fear</button>
            <button type="button" class="soft-button emphasis" @click="emit('increment-fear')">Raise fear</button>
          </div>
          <label class="field-group">
            <span>Maximum fear</span>
            <input :value="state.maxFear" type="number" min="1" max="30" @input="updateNumber($event, 'update-max-fear')" />
          </label>
          <label class="field-group">
            <span>Font</span>
            <select :value="state.fontId" @change="emit('update-font-id', getFieldValue($event))">
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
            <select :value="state.globalIcon" @change="emit('update-global-icon', getFieldValue($event))">
              <option v-for="icon in ICON_OPTIONS" :key="icon.id" :value="icon.icon">{{ icon.label }}</option>
            </select>
          </label>
          <button type="button" class="soft-button" @click="emit('apply-global-icon')">
            Apply current icon to every slot
          </button>
          <div class="fear-icon-grid">
            <label v-for="fear in fearSlots" :key="fear" class="slot-card">
              <span>Fear {{ fear }}</span>
              <select :value="state.fearIcons[String(fear)] || state.globalIcon" @change="updateFearIcon(fear, $event)">
                <option v-for="icon in ICON_OPTIONS" :key="`${fear}-${icon.id}`" :value="icon.icon">{{ icon.label }}</option>
              </select>
            </label>
          </div>
        </section>

        <section class="settings-section">
          <div class="section-heading">
            <h2>Countdowns</h2>
            <span>{{ state.countdowns.length }}/{{ MAX_COUNTDOWNS }} public stakes</span>
          </div>
          <div class="button-row compact">
            <button
              type="button"
              class="soft-button emphasis"
              :disabled="state.countdowns.length >= MAX_COUNTDOWNS"
              @click="emit('add-countdown')"
            >
              Add countdown
            </button>
          </div>
          <div v-if="state.countdowns.length" class="roll-outcome-grid">
            <button
              v-for="outcome in ROLL_OUTCOME_OPTIONS"
              :key="outcome.id"
              type="button"
              class="soft-button"
              @click="emit('apply-roll-outcome', outcome.id)"
            >
              {{ outcome.label }}
            </button>
          </div>
          <p v-else class="inline-note">Add a countdown to show public scene pressure on the TV display.</p>

          <div v-if="state.countdowns.length" class="countdown-editor-list">
            <article v-for="countdown in state.countdowns" :key="countdown.id" class="countdown-editor">
              <label class="field-group">
                <span>Name</span>
                <input
                  :value="countdown.name"
                  type="text"
                  maxlength="48"
                  placeholder="Ritual completes"
                  @input="emit('update-countdown', countdown.id, { name: getFieldValue($event) })"
                />
              </label>
              <label class="field-group">
                <span>Type</span>
                <select :value="countdown.kind" @change="updateCountdownKind(countdown.id, $event)">
                  <option value="standard">Standard</option>
                  <option value="progress">Progress</option>
                  <option value="consequence">Consequence</option>
                </select>
              </label>
              <div class="countdown-number-grid">
                <label class="field-group">
                  <span>Remaining</span>
                  <input
                    :value="countdown.value"
                    type="number"
                    min="0"
                    :max="countdown.max"
                    @input="updateCountdownNumber(countdown.id, 'value', $event)"
                  />
                </label>
                <label class="field-group">
                  <span>Starting value</span>
                  <input
                    :value="countdown.max"
                    type="number"
                    min="1"
                    max="20"
                    @input="updateCountdownNumber(countdown.id, 'max', $event)"
                  />
                </label>
              </div>
              <label class="field-group">
                <span>Public stakes</span>
                <textarea
                  :value="countdown.effect || ''"
                  rows="2"
                  maxlength="120"
                  placeholder="What happens when this reaches zero?"
                  @input="emit('update-countdown', countdown.id, { effect: getFieldValue($event) })"
                />
              </label>
              <div class="button-row compact">
                <button type="button" class="soft-button" @click="emit('tick-countdown', countdown.id, 1)">Tick</button>
                <button type="button" class="soft-button" @click="emit('tick-countdown', countdown.id, -1)">Restore</button>
                <button type="button" class="soft-button" @click="emit('reset-countdown', countdown.id)">Reset</button>
                <button type="button" class="soft-button" @click="emit('complete-countdown', countdown.id)">Complete</button>
                <button type="button" class="soft-button danger" @click="emit('delete-countdown', countdown.id)">Delete</button>
              </div>
            </article>
          </div>
        </section>

        <section class="settings-section">
          <div class="section-heading">
            <h2>Color story</h2>
            <span>Preset moods inspired by the book without naming them directly</span>
          </div>
          <label class="field-group">
            <span>Preset palette</span>
            <select :value="state.themeId" @change="emit('apply-theme', getFieldValue($event))">
              <option v-for="theme in THEME_PRESETS" :key="theme.id" :value="theme.id">{{ theme.label }}</option>
            </select>
          </label>
          <div class="color-grid">
            <label class="field-group color-field">
              <span>Accent</span>
              <input :value="state.colors.accent" type="color" @input="updateColor('accent', $event)" />
            </label>
            <label class="field-group color-field">
              <span>Glow</span>
              <input :value="state.colors.glow" type="color" @input="updateColor('glow', $event)" />
            </label>
            <label class="field-group color-field">
              <span>Text</span>
              <input :value="state.colors.text" type="color" @input="updateColor('text', $event)" />
            </label>
            <label class="field-group color-field">
              <span>Ring</span>
              <input :value="state.colors.ring" type="color" @input="updateColor('ring', $event)" />
            </label>
            <label class="field-group color-field">
              <span>Backdrop</span>
              <input
                :value="state.colors.backgroundAccent"
                type="color"
                @input="updateColor('backgroundAccent', $event)"
              />
            </label>
            <label class="field-group color-field">
              <span>Base</span>
              <input :value="state.colors.background" type="color" @input="updateColor('background', $event)" />
            </label>
          </div>
          <button type="button" class="soft-button" @click="emit('reset-theme-colors')">
            Reset to current preset
          </button>
        </section>

        <section class="settings-section">
          <div class="section-heading">
            <h2>Background</h2>
            <span>Use motion or image cycling to reduce TV burn-in</span>
          </div>
          <div class="button-row compact">
            <button
              type="button"
              class="soft-button"
              :class="{ active: state.backgroundMode === 'none' }"
              @click="emit('set-background-mode', 'none')"
            >
              No media
            </button>
            <button
              type="button"
              class="soft-button"
              :class="{ active: state.backgroundMode === 'youtube' }"
              @click="emit('set-background-mode', 'youtube')"
            >
              YouTube
            </button>
            <button
              type="button"
              class="soft-button"
              :class="{ active: state.backgroundMode === 'images' }"
              @click="emit('set-background-mode', 'images')"
            >
              Images
            </button>
          </div>
          <label class="field-group">
            <span>YouTube link</span>
            <input
              :value="state.youtubeUrl"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              @input="emit('update-youtube-url', getFieldValue($event).trim())"
            />
          </label>
          <label class="field-group">
            <span>Background image URLs</span>
            <textarea
              :value="imageUrlsText"
              rows="4"
              placeholder="One URL per line"
              @input="emit('update-image-urls-text', getFieldValue($event))"
            />
          </label>
          <div class="button-row compact">
            <button type="button" class="soft-button" @click="emit('cycle-background', -1)">Previous image</button>
            <button type="button" class="soft-button" @click="emit('cycle-background', 1)">Next image</button>
          </div>
        </section>
      </fieldset>
    </div>
  </aside>
</template>
