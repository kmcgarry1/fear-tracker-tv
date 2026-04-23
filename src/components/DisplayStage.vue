<script setup lang="ts">
import { Icon } from '@iconify/vue'

import CountdownBoard from './CountdownBoard.vue'
import type { Countdown } from '../lib/tracker-config'

defineProps<{
  icon: string
  fearValueLabel: string
  countdowns: Countdown[]
  fearPulse: 'raise' | 'lower' | ''
  countdownPulses: Record<string, 'advance' | 'complete'>
}>()

const emit = defineEmits<{
  increment: []
  decrement: []
}>()
</script>

<template>
  <main class="display-stage">
    <button
      class="tracker"
      :class="{
        'pulse-raise': fearPulse === 'raise',
        'pulse-lower': fearPulse === 'lower',
      }"
      type="button"
      @click="emit('increment')"
      @contextmenu.prevent="emit('decrement')"
    >
      <span class="tracker-aura" />
      <Icon class="tracker-icon" :icon="icon" />
      <span class="tracker-value">{{ fearValueLabel }}</span>
    </button>
    <CountdownBoard :countdowns="countdowns" :pulses="countdownPulses" />
  </main>
</template>
