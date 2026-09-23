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

      <button class="btn-primary" @click="$emit('add')">
        <span class="btn-primary-text">Continuar para dividir</span>
        <span class="btn-arrow">→</span>
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  product: { type: String, default: '' },
  value: { type: String, default: '' },
  market: { type: String, default: '' },
});

defineEmits(['update:product', 'update:value', 'update:market', 'back', 'add']);
</script>
