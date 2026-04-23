<script setup lang="ts">
import type { Countdown } from '../lib/tracker-config'

defineProps<{
  countdowns: Countdown[]
}>()

function pipRange(max: number) {
  return Array.from({ length: max }, (_, index) => index)
}
</script>

<template>
  <section v-if="countdowns.length" class="countdown-board" aria-label="Scene countdowns">
    <article
      v-for="countdown in countdowns"
      :key="countdown.id"
      class="countdown-card"
      :class="[`countdown-${countdown.kind}`, { complete: countdown.value === 0 }]"
    >
      <div class="countdown-card-header">
        <span class="countdown-kind">{{ countdown.kind }}</span>
        <span class="countdown-value">{{ countdown.value }}/{{ countdown.max }}</span>
      </div>
      <h2>{{ countdown.name }}</h2>
      <div class="countdown-pips" aria-hidden="true">
        <span
          v-for="pip in pipRange(countdown.max)"
          :key="pip"
          class="countdown-pip"
          :class="{ filled: pip < countdown.value }"
        />
      </div>
      <p v-if="countdown.effect" class="countdown-effect">{{ countdown.effect }}</p>
    </article>
  </section>
</template>
