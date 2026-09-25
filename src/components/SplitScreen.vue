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
            <select
              class="category-select split-category-select"
              :value="categoryFor(item)"
              :aria-label="`Escolher grupo de ${item.product}`"
              :disabled="disabled"
              @change="$emit('category', item.id, $event.target.value)"
            >
              <option v-for="group in productGroups" :key="group.name" :value="group.name">
                {{ group.name }}
              </option>
            </select>
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

        <p class="participant-label paid-participant-label">JÁ PAGARAM DIRETAMENTE</p>
        <p class="paid-participant-hint">Marque quem já pagou a parte no caixa. Essa pessoa não ficará com saldo pendente.</p>
        <div class="chips">
          <button
            v-for="person in users.filter((person) => person.id !== item.buyerId && item.sharedWith.includes(person.id))"
            :key="person.id"
            class="chip paid-chip"
            :class="{ 'chip-paid': item.paidWith.includes(person.id) }"
            :disabled="disabled"
            @click="$emit('toggle-paid', item.id, person.id)"
          >
            {{ item.paidWith.includes(person.id) ? '✓ ' : '' }}{{ person.name }}
          </button>
          <span v-if="item.sharedWith.filter((id) => id !== item.buyerId).length === 0" class="paid-participant-hint">
            Nenhum outro participante selecionado.
          </span>
        </div>
      </div>

      <button class="btn-primary" :disabled="disabled" @click="$emit('save')">
        <span class="btn-primary-text">{{ disabled ? 'Salvando...' : 'Salvar divisão' }}</span>
        <span class="btn-arrow">{{ disabled ? '…' : '→' }}</span>
      </button>
      <button class="add-item-button" :disabled="disabled" @click="$emit('add-item')">
        <span class="add-item-icon">＋</span>
        <span>Adicionar outro item</span>
      </button>
      <button class="btn-cancel" :disabled="disabled" @click="$emit('cancel')">Cancelar</button>
    </div>
  </div>
</template>

<script setup>
import { classifyProduct, isProductGroup, money, productGroups } from '../lib/api';
import { users } from '../lib/users';

defineProps({
  user: { type: Object, required: true },
  items: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
});

defineEmits(['toggle', 'toggle-paid', 'category', 'cancel', 'save', 'add-item']);

function categoryFor(item) {
  return isProductGroup(item.category) ? item.category : classifyProduct(item.product);
}
</script>
