<template>
  <div class="page">
    <div class="page-content">
      <button class="back" @click="$emit('cancel')" :disabled="disabled">← Voltar</button>
      <h1 class="screen-title">Separe esta compra</h1>
      <p class="screen-copy">Escolha com quem dividir, quem pagou diretamente e quem não vai consumir.</p>

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
            <a v-if="item.receiptUrl" class="receipt-link" :href="item.receiptUrl" target="_blank" rel="noopener noreferrer">
              Abrir nota fiscal
            </a>
            <AppSelect
              class="category-select split-category-select"
              :model-value="categoryFor(item).name"
              :aria-label="`Escolher categoria de ${item.product}`"
              :disabled="disabled"
              :options="categories.map((category) => ({ value: category.name, label: category.name }))"
              @update:model-value="$emit('category', item.product, $event)"
            />
          </div>
          <div class="split-item-actions">
            <p class="item-value">{{ money(item.value) }}</p>
            <div class="split-item-icon-actions">
              <button
                class="icon-action-button split-edit-button"
                type="button"
                :aria-label="`Editar ${item.product}`"
                :title="`Editar ${item.product}`"
                :disabled="disabled"
                @click="openEditor(item)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m14 5 5 5M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" />
                </svg>
              </button>
              <button
                class="icon-action-button split-delete-button"
                type="button"
                :aria-label="`Excluir ${item.product}`"
                :title="`Excluir ${item.product}`"
                :disabled="disabled"
                @click="$emit('remove-item', item.id)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <label class="participant-label split-date-label" :for="`item-date-${item.id}`">DATA DA COMPRA</label>
        <CalendarPicker
          :id="`item-date-${item.id}`"
          class="split-date-picker"
          :model-value="dateInputValue(item.date)"
          :disabled="disabled"
          @update:model-value="$emit('update-date', item.id, $event)"
        />

        <p class="participant-label">DIVIDIR COM</p>
        <div class="chips">
          <button
            v-for="person in users"
            :key="person.id"
            class="chip"
            :class="{ 'chip-selected': item.sharedWith.includes(person.id) }"
            :disabled="disabled"
            @click="$emit('toggle', item.id, person.id)"
          >
            {{ person.id === user.id ? 'Você' : person.name }}
          </button>
        </div>
        <p v-if="item.sharedWith.length > 0" class="split-hint">
          {{ money(item.value / item.sharedWith.length) }} por pessoa
        </p>

        <p class="participant-label paid-participant-label">JÁ PAGARAM DIRETAMENTE</p>
        <div class="chips">
          <button
            v-for="person in users.filter((person) => person.id !== user.id && item.sharedWith.includes(person.id))"
            :key="person.id"
            class="chip"
            :class="{ 'chip-selected': item.paidWith.includes(person.id) }"
            :disabled="disabled"
            @click="$emit('toggle-paid', item.id, person.id)"
          >
            {{ person.name }}
          </button>
          <span v-if="item.sharedWith.filter((id) => id !== user.id).length === 0" class="paid-participant-hint">
            Nenhum outro participante selecionado.
          </span>
        </div>

        <p class="participant-label consumer-label">NÃO VAI CONSUMIR</p>
        <div class="chips">
          <button
            v-for="person in users.filter((person) => item.sharedWith.includes(person.id))"
            :key="person.id"
            class="chip"
            :class="{ 'chip-selected': item.notConsuming?.includes(person.id) }"
            :aria-pressed="item.notConsuming?.includes(person.id) || false"
            :disabled="disabled"
            @click="$emit('toggle-not-consuming', item.id, person.id)"
          >
            {{ person.name === user.name ? 'Você' : person.name }}
          </button>
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

  <div v-if="editingItem" class="modal-backdrop" @click.self="closeEditor">
    <section class="message-modal item-edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-item-title">
      <button class="modal-close" type="button" aria-label="Fechar" @click="closeEditor">×</button>
      <h2 id="edit-item-title" class="modal-title">Editar produto da nota</h2>
      <label class="label" for="edit-item-product">Nome</label>
      <input id="edit-item-product" v-model="editProduct" class="input" maxlength="300" />
      <label class="label" for="edit-item-value">Valor</label>
      <input id="edit-item-value" v-model="editValue" class="input" inputmode="decimal" placeholder="0,00" />
      <p v-if="editError" class="balance-details-error">{{ editError }}</p>
      <button class="btn-primary" type="button" :disabled="disabled" @click="saveEditor">
        <span class="btn-primary-text">Salvar alterações</span>
        <span class="btn-arrow">→</span>
      </button>
      <button class="btn-cancel" type="button" :disabled="disabled" @click="closeEditor">Cancelar</button>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { money } from '../lib/api';
import CalendarPicker from './CalendarPicker.vue';
import AppSelect from './AppSelect.vue';

const emit = defineEmits(['toggle', 'toggle-paid', 'category', 'cancel', 'save', 'add-item', 'edit-item', 'remove-item', 'update-date']);

const props = defineProps({
  user: { type: Object, required: true },
  items: { type: Array, default: () => [] },
  users: { type: Array, default: () => [] },
  categories: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
});

const editingItem = ref(null);
const editProduct = ref('');
const editValue = ref('');
const editError = ref('');

function openEditor(item) {
  editingItem.value = item;
  editProduct.value = item.product;
  editValue.value = String(item.value).replace('.', ',');
  editError.value = '';
}

function closeEditor() {
  editingItem.value = null;
  editError.value = '';
}

function saveEditor() {
  const product = editProduct.value.trim();
  const value = Number(editValue.value.trim().replace(',', '.'));
  if (!product || !Number.isFinite(value) || value <= 0) {
    editError.value = 'Informe um nome e um valor maior que zero.';
    return;
  }
  emit('edit-item', editingItem.value.id, { product, value });
  closeEditor();
}

function dateInputValue(value) {
  const match = String(value ?? '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  const isoMatch = String(value ?? '').match(/^(\d{4}-\d{2}-\d{2})/);
  return isoMatch?.[1] || '';
}

function categoryFor(item) {
  return (
    props.categories.find((category) => category.name === item.category) ||
    props.categories.find((category) => category.name === 'Outros') ||
    props.categories[0] || { name: item.category || '', color: '#a99f92' }
  );
}
</script>
