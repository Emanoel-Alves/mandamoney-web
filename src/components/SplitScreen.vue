<template>
  <div class="page">
    <div class="page-content">
      <button class="back" @click="$emit('cancel')" :disabled="disabled">← Voltar</button>
      <h1 class="screen-title">Separe esta compra</h1>
      <p class="screen-copy">Quem vai participar de cada item? O valor é dividido igualmente entre os selecionados.</p>

      <div class="buyer-notice">
        <span class="notice-icon">✓</span>
        <p class="notice-text">Quem pagou: <span class="bold">{{ user.name }}</span></p>
      </div>

      <div v-for="item in items" :key="item.id" class="product-card">
        <div class="product-header">
          <div>
            <p class="item-name">{{ item.product }}</p>
            <p class="item-meta">{{ item.market }} • {{ item.date }}</p>
          </div>
          <p class="item-value">{{ money(item.value) }}</p>
        </div>

        <p class="participant-label">PARTICIPANTES</p>
        <div class="chips">
          <button
            v-for="person in users"
            :key="person.id"
            class="chip"
            :class="{ 'chip-selected': item.sharedWith.includes(person.id) }"
            :disabled="disabled"
            @click="$emit('toggle', item.id, person.id)"
          >
            {{ person.name === user.name ? 'Você' : person.name }}
          </button>
        </div>

        <p v-if="item.sharedWith.length > 0" class="split-hint">
          {{ money(item.value / item.sharedWith.length) }} por pessoa
        </p>
      </div>

      <button class="btn-primary" :disabled="disabled" @click="$emit('save')">
        <span class="btn-primary-text">{{ disabled ? 'Salvando...' : 'Salvar divisão' }}</span>
        <span class="btn-arrow">{{ disabled ? '…' : '→' }}</span>
      </button>
      <button class="btn-cancel" :disabled="disabled" @click="$emit('cancel')">Cancelar</button>
    </div>
  </div>
</template>

<script setup>
import { money } from '../lib/api';
import { users } from '../lib/users';

defineProps({
  user: { type: Object, required: true },
  items: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
});

defineEmits(['toggle', 'cancel', 'save']);
</script>
