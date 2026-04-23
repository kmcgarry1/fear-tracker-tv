<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineProps<{
  icon: string
  fearValueLabel: string
  sessionId: string
  syncLabel: string
  fear: number
  maxFear: number
  canWrite: boolean
}>()

const emit = defineEmits<{
  decrement: []
  increment: []
  'update:fear': [value: number]
}>()

function updateFear(event: Event) {
  const target = event.target as HTMLInputElement | null

  if (target) {
    emit('update:fear', Number(target.value))
  }
}
</script>

<template>
  <main class="controller-stage">
    <section class="controller-hero">
      <div class="controller-preview">
        <Icon class="controller-icon" :icon="icon" />
        <span class="controller-value">{{ fearValueLabel }}</span>
        <span class="controller-status">Session {{ sessionId }} &middot; {{ syncLabel }}</span>
      </div>
      <div class="controller-actions">
        <button type="button" class="control-button" :disabled="!canWrite" @click="emit('decrement')">-1 Fear</button>
        <button type="button" class="control-button emphasis" :disabled="!canWrite" @click="emit('increment')">+1 Fear</button>
      </div>
      <label class="field-group">
        <span>Fear value</span>
        <input :value="fear" type="range" min="0" :max="maxFear" :disabled="!canWrite" @input="updateFear" />
      </label>
    </section>
  </main>
</template>
