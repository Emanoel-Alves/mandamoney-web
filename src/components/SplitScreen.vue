<template>
  <div class="page">
    <div class="page-content">
      <button class="back" @click="$emit('cancel')" :disabled="disabled">← Voltar</button>
      <h1 class="screen-title">Separe esta compra</h1>
      <p class="screen-copy">Marque quem participa da divisão. Quem já pagou a própria parte no caixa não ficará devendo.</p>

      <div class="buyer-notice">
        <span class="notice-icon">✓</span>
        <p class="notice-text">
          A compra foi registrada por <span class="bold">{{ user.name }}</span>
        </p>
      </div>

      <div v-for="item in items" :key="item.id" class="product-card">
        <div class="product-header">
          <div>
            <p class="item-name">{{ item.product }}</p>
            <p class="item-meta">{{ item.market }} • {{ item.date }}</p>
            <p v-if="item.categoryMapped === false" class="category-hint">
              Categoria não identificada. Escolha uma para salvar este produto e reutilizar nas próximas compras.
            </p>
            <select
              class="category-select split-category-select"
              :value="categoryFor(item).name"
              :aria-label="`Escolher categoria de ${item.product}`"
              :disabled="disabled"
              @change="$emit('category', item.product, $event.target.value)"
            >
              <option v-for="category in categories" :key="category.id" :value="category.name">
                {{ category.name }}
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

        <p v-if="item.sharedWith.length > 0" class="split-hint">{{ money(item.value / item.sharedWith.length) }} por pessoa</p>

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
import { money } from '../lib/api';

defineEmits(['toggle', 'toggle-paid', 'category', 'cancel', 'save', 'add-item']);

const props = defineProps({
  user: { type: Object, required: true },
  items: { type: Array, default: () => [] },
  users: { type: Array, default: () => [] },
  categories: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
});

function categoryFor(item) {
  return (
    props.categories.find((category) => category.name === item.category) ||
    props.categories.find((category) => category.name === 'Outros') ||
    props.categories[0] || { name: item.category || '', color: '#a99f92' }
  );
}
</script>
