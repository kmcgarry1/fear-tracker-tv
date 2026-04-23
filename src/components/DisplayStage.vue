<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineProps<{
  icon: string
  fearValueLabel: string
}>()

const emit = defineEmits<{
  increment: []
  decrement: []
}>()
</script>

<template>
  <main class="display-stage">
    <button class="tracker" type="button" @click="emit('increment')" @contextmenu.prevent="emit('decrement')">
      <span class="tracker-aura" />
      <Icon class="tracker-icon" :icon="icon" />
      <span class="tracker-value">{{ fearValueLabel }}</span>
    </button>
  </main>
</template>
