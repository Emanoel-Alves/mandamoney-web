<template>
  <div class="page">
    <div class="page-content">
      <button class="back" :disabled="disabled" @click="$emit('back')">← Voltar</button>
      <h1 class="screen-title">Produtos por categoria</h1>
      <p class="screen-copy">As categorias abaixo vêm do banco de dados. Selecione uma para classificar e cadastrar um produto.</p>

      <form class="catalog-form" @submit.prevent="submit">
        <label class="label" for="catalog-product">Nome do produto</label>
        <input
          id="catalog-product"
          v-model="product"
          class="input"
          maxlength="300"
          placeholder="Ex.: goiaba"
          :disabled="disabled"
        />
        <label class="label" for="catalog-category">Categoria</label>
        <AppSelect
          id="catalog-category"
          v-model="categoryId"
          class="category-input"
          :disabled="disabled"
          :options="catalogCategoryOptions"
          placeholder="Selecione uma categoria"
        />
        <button class="btn-primary" type="submit" :disabled="disabled || !product.trim() || !categoryId">
          <span class="btn-primary-text">{{ disabled ? 'Salvando...' : 'Salvar produto' }}</span>
          <span class="btn-arrow">{{ disabled ? '…' : '＋' }}</span>
        </button>
      </form>

      <div class="catalog-header">
        <p class="section-title">Categorias cadastradas no banco</p>
      </div>
      <section v-for="category in categories" :key="category.id" class="catalog-category">
        <button
          class="catalog-category-heading"
          type="button"
          :aria-pressed="categoryId === category.id"
          @click="categoryId = category.id"
        >
          <span class="catalog-category-title">{{ category.name }}</span>
          <span class="catalog-category-select">{{ categoryId === category.id ? 'Selecionada' : 'Selecionar' }}</span>
        </button>
        <div v-if="productsFor(category).length" class="catalog-product-list">
          <div v-for="item in productsFor(category)" :key="item.key" class="catalog-product-row">
            <div class="catalog-product-copy">
              <span>{{ item.product }}</span>
              <span class="catalog-product-source">{{ item.saved ? 'Cadastrado' : 'Compra recente' }}</span>
            </div>
            <button
              class="icon-action-button catalog-edit-button"
              type="button"
              :aria-label="`Editar categoria de ${item.product}`"
              :title="`Editar categoria de ${item.product}`"
              :disabled="disabled"
              @click="openEditor(item)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m14 5 5 5M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" />
              </svg>
            </button>
          </div>
        </div>
        <p v-else class="catalog-empty">Nenhum produto das compras carregadas nesta categoria.</p>
      </section>
      <p v-if="categories.length === 0" class="empty-text">Nenhuma categoria cadastrada no banco.</p>
    </div>
  </div>

  <div v-if="editingProduct" class="modal-backdrop" @click.self="closeEditor">
    <section class="message-modal product-category-modal" role="dialog" aria-modal="true" aria-labelledby="product-category-title">
      <button class="modal-close" type="button" aria-label="Fechar" @click="closeEditor">×</button>
      <h2 id="product-category-title" class="modal-title">Editar categoria</h2>
      <p class="modal-message">{{ editingProduct.product }}</p>
      <label class="label" for="edit-product-category">Categoria</label>
      <AppSelect
        id="edit-product-category"
        v-model="editingCategoryId"
        class="category-input"
        :disabled="disabled"
        :options="categoryOptions"
      />
      <p v-if="editError" class="balance-details-error">{{ editError }}</p>
      <button class="btn-primary" type="button" :disabled="disabled || !editingCategoryId" @click="saveEditor">
        <span class="btn-primary-text">{{ disabled ? 'Salvando...' : 'Salvar categoria' }}</span>
        <span class="btn-arrow">{{ disabled ? '…' : '→' }}</span>
      </button>
      <button class="btn-cancel" type="button" :disabled="disabled" @click="closeEditor">Cancelar</button>
    </section>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import AppSelect from './AppSelect.vue';

const props = defineProps({
  products: { type: Array, default: () => [] },
  categories: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['back', 'add', 'update-category']);
const product = ref('');
const categoryId = ref('');
const editingProduct = ref(null);
const editingCategoryId = ref('');
const editError = ref('');
const categoryOptions = computed(() => props.categories.map((category) => ({ value: category.id, label: category.name })));
const catalogCategoryOptions = computed(() => [
  { value: '', label: 'Selecione uma categoria', disabled: true },
  ...categoryOptions.value,
]);

watch(
  () => props.categories,
  (categories) => {
    if (!categories.some((category) => category.id === categoryId.value)) {
      categoryId.value = categories[0]?.id || '';
    }
  },
  { immediate: true },
);

function productsFor(category) {
  return props.products
    .filter((item) => item.categoryId === category.id)
    .slice()
    .sort((left, right) => left.product.localeCompare(right.product, 'pt-BR'));
}

function openEditor(item) {
  editingProduct.value = item;
  editingCategoryId.value = item.categoryId;
  editError.value = '';
}

function closeEditor() {
  editingProduct.value = null;
  editingCategoryId.value = '';
  editError.value = '';
}

function saveEditor() {
  if (!editingProduct.value || !editingCategoryId.value || props.disabled) return;
  if (editingCategoryId.value === editingProduct.value.categoryId) {
    closeEditor();
    return;
  }
  emit('update-category', editingProduct.value.product, editingCategoryId.value, (error) => {
    if (error) {
      editError.value = error;
      return;
    }
    closeEditor();
  });
}

function submit() {
  const name = product.value.trim();
  if (!name || !categoryId.value || props.disabled) return;
  emit('add', name, categoryId.value, () => {
    product.value = '';
  });
}
</script>
