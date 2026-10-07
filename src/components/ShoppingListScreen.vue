<template>
  <div class="page">
    <div class="page-content">
      <button class="back" :disabled="disabled" @click="$emit('back')">← Voltar</button>
      <h1 class="screen-title">Lista de compras</h1>
      <p class="screen-copy">Anote o que está faltando em casa para ninguém esquecer.</p>

      <form class="shopping-list-form" @submit.prevent="submit">
        <label class="label" for="shopping-product">Item que falta</label>
        <input
          id="shopping-product"
          v-model="product"
          class="input"
          maxlength="300"
          placeholder="Ex.: leite"
          :disabled="disabled"
        />
        <button class="btn-primary" type="submit" :disabled="disabled || !product.trim()">
          <span class="btn-primary-text">{{ disabled ? 'Salvando...' : 'Adicionar à lista' }}</span>
          <span class="btn-arrow">{{ disabled ? '…' : '＋' }}</span>
        </button>
      </form>

      <div class="shopping-list-header">
        <p class="section-title">Falta em casa</p>
        <span class="shopping-list-count">{{ items.length }}</span>
      </div>

      <p v-if="loading" class="empty-text">Carregando a lista...</p>
      <div v-else-if="error" class="shopping-list-error">
        <p>{{ error }}</p>
        <button class="link" type="button" @click="$emit('retry')">Tentar novamente</button>
      </div>
      <p v-else-if="items.length === 0" class="empty-text">Nenhum item pendente. A casa está em dia!</p>
      <template v-else>
        <div v-for="item in items" :key="item.id" class="shopping-list-item">
          <div class="shopping-list-item-copy">
            <p class="item-name">{{ item.product }}</p>
            <p class="item-meta">Adicionado por {{ item.addedByName || nameOf(item.addedBy) }}</p>
          </div>
          <button
            class="shopping-list-done"
            type="button"
            :disabled="disabled"
            :aria-label="`Marcar ${item.product} como comprado e remover da lista`"
            @click="$emit('remove', item.id)"
          >
            Já comprei
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  items: { type: Array, default: () => [] },
  users: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  error: { type: String, default: '' },
});

const emit = defineEmits(['back', 'add', 'remove', 'retry']);

const product = ref('');

function nameOf(userId) {
  return props.users.find((user) => String(user.id) === String(userId))?.name || 'Morador';
}

function submit() {
  const value = product.value.trim();
  if (value && !props.disabled) {
    emit('add', value, () => {
      product.value = '';
    });
  }
}
</script>
