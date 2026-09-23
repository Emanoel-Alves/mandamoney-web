<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <section class="message-modal" role="dialog" aria-modal="true" aria-labelledby="message-modal-title">
      <button class="modal-close" type="button" aria-label="Fechar" @click="$emit('close')">×</button>
      <h2 id="message-modal-title" class="modal-title">{{ title }}</h2>
      <p class="modal-message">{{ message }}</p>
      <button class="btn-primary modal-button" type="button" @click="$emit('close')">
        <span class="btn-primary-text">Entendi</span>
        <span class="btn-arrow">→</span>
      </button>
    </section>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, default: 'Atenção' },
  message: { type: String, required: true },
});

defineEmits(['close']);
</script>