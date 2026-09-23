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

      <label class="label">Grupo do item</label>
      <select class="input category-input" :value="category" @change="$emit('update:category', $event.target.value)">
        <option value="">Detectar automaticamente</option>
        <option v-for="group in productGroups" :key="group.name" :value="group.name">
          {{ group.name }}
        </option>
      </select>

      <button class="btn-primary" @click="$emit('add')">
        <span class="btn-primary-text">Continuar para dividir</span>
        <span class="btn-arrow">→</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { productGroups } from '../lib/api';

defineProps({
  product: { type: String, default: '' },
  value: { type: String, default: '' },
  market: { type: String, default: '' },
  category: { type: String, default: '' },
});

defineEmits(['update:product', 'update:value', 'update:market', 'update:category', 'back', 'add']);
</script>
