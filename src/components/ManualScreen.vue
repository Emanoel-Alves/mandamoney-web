<template>
  <div class="page">
    <div class="page-content">
      <button class="back" @click="$emit('back')">← Voltar</button>
      <h1 class="screen-title">Novo item</h1>
      <p class="screen-copy">Adicione o que comprou quando não houver uma NF-e para ler.</p>

      <label class="label">Produto</label>
      <input
        class="input"
        type="text"
        placeholder="Ex.: Papel higiênico"
        :value="product"
        @input="$emit('update:product', $event.target.value)"
      />

      <label class="label">Valor</label>
      <input
        class="input"
        type="text"
        inputmode="decimal"
        placeholder="0,00"
        :value="value"
        @input="$emit('update:value', $event.target.value)"
      />

      <label class="label">Mercado (opcional)</label>
      <input
        class="input"
        type="text"
        placeholder="Ex.: Mercado da Praça"
        :value="market"
        @input="$emit('update:market', $event.target.value)"
      />

      <label class="label" for="manual-date">Data da compra</label>
      <CalendarPicker
        id="manual-date"
        :model-value="date"
        @update:model-value="$emit('update:date', $event)"
      />

      <label class="label" for="manual-category">Categoria do item</label>
      <AppSelect
        id="manual-category"
        class="category-input"
        :model-value="category"
        aria-label="Categoria do item"
        :options="categoryOptions"
        @update:model-value="$emit('update:category', $event)"
      />

      <button class="btn-primary" @click="$emit('add')">
        <span class="btn-primary-text">Continuar para dividir</span>
        <span class="btn-arrow">→</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import CalendarPicker from './CalendarPicker.vue';
import AppSelect from './AppSelect.vue';

const props = defineProps({
  product: { type: String, default: '' },
  value: { type: String, default: '' },
  market: { type: String, default: '' },
  date: { type: String, default: '' },
  category: { type: String, default: '' },
  categories: { type: Array, default: () => [] },
});

const categoryOptions = computed(() => props.categories.map((item) => ({ value: item.name, label: item.name })));

defineEmits(['update:product', 'update:value', 'update:market', 'update:date', 'update:category', 'back', 'add']);
</script>
