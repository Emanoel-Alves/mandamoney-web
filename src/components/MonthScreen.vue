<template>
  <div class="page">
    <div class="page-content">
      <button class="back" @click="$emit('back')">← Voltar</button>
      <h1 class="screen-title">Compras de setembro</h1>
      <p class="screen-copy">{{ items.length }} itens registrados neste mês.</p>

      <div v-for="item in items" :key="item.id" class="month-row">
        <div class="date-badge">
          <span class="date-badge-day">{{ item.date.slice(0, 2) }}</span>
          <span class="date-badge-month">SET</span>
        </div>
        <div class="month-info">
          <p class="item-name">{{ item.product }}</p>
          <p class="item-meta">{{ item.market }} • pago por {{ nameOf(item.buyerId) }}</p>
          <p class="participant-summary">
            Dividido com {{ item.sharedWith.map(nameOf).join(', ') }}
          </p>
        </div>
        <p class="item-value">{{ money(item.value) }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { money } from '../lib/api';
import { users } from '../lib/users';

defineProps({
  items: { type: Array, default: () => [] },
});

defineEmits(['back']);

function nameOf(userId) {
  return users.find((user) => user.id === userId)?.name || 'Morador';
}
</script>
