<template>
  <div class="page">
    <div class="page-content">
      <button class="back" @click="$emit('back')">← Voltar</button>
      <h1 class="screen-title">Compras de {{ monthName }} de {{ currentDate.getFullYear() }}</h1>
      <p class="screen-copy">{{ items.length }} itens registrados neste mês.</p>

      <section class="month-filters month-period-filter" aria-label="Selecionar mês das compras">
        <label class="month-filter-control">
          <span class="participant-label">MÊS</span>
          <CalendarPicker
            mode="month"
            aria-label="Selecionar mês das compras"
            :model-value="selectedMonth"
            @update:model-value="$emit('month-change', $event)"
          />
        </label>
      </section>

      <section class="month-chart" aria-labelledby="month-chart-title">
        <div class="month-chart-header">
          <div>
            <p class="section-title" id="month-chart-title">Por categoria</p>
            <p class="chart-total">{{ money(categoryTotal) }}</p>
          </div>
          <p class="chart-caption">valor comprado</p>
        </div>

        <div v-if="categoryTotal > 0" class="chart-content">
          <div class="pie-chart" :style="{ background: chartBackground }" aria-label="Gráfico de pizza dos gastos por categoria"></div>
          <div class="chart-legend">
            <div v-for="category in categoryTotals" :key="category.id" class="legend-row">
              <span class="legend-color" :style="{ background: category.color }"></span>
              <span class="legend-name">{{ category.name }}</span>
              <span class="legend-value">{{ money(category.value) }}</span>
              <span class="legend-percent">{{ category.percent }}%</span>
            </div>
          </div>
        </div>
        <p v-else class="empty-text">Nenhum valor comprado neste mês.</p>
      </section>

      <p v-if="loading" class="empty-text">Carregando compras do mês...</p>
      <p v-else-if="error" class="month-view-error">{{ error }}</p>

      <section class="month-filters" aria-label="Filtros das compras">
        <div class="month-filter-control">
          <span class="participant-label">COMPRAS DE</span>
          <AppSelect
            v-model="buyerFilter"
            class="month-filter-select"
            :aria-label="'Filtrar compras por pessoa'"
            :options="buyerFilterOptions"
          />
        </div>
        <label class="month-filter-control">
          <span class="participant-label">PRODUTO</span>
          <input v-model="productSearch" class="month-filter-input" type="search" placeholder="Buscar produto" />
        </label>
        <p class="month-filter-count">{{ filteredItems.length }} de {{ items.length }} itens</p>
      </section>

      <div v-for="item in filteredItems" :key="item.id" class="month-row">
        <div class="date-badge">
          <span class="date-badge-day">{{ item.date.slice(0, 2) }}</span>
          <span class="date-badge-month">{{ monthAbbreviation }}</span>
        </div>
        <div class="month-info">
          <p class="item-name">{{ item.product }}</p>
          <p class="item-meta">{{ item.market }} • comprado por {{ nameOf(item.buyerId) }}</p>
          <p class="participant-summary">Dividido com {{ item.sharedWith.map(nameOf).join(', ') }}</p>
          <p v-if="item.paidWith.length" class="participant-summary">
            Pago diretamente por {{ item.paidWith.map(nameOf).join(', ') }}
          </p>
          <p v-if="item.categoryMapped === false" class="category-hint">
            Categoria não identificada. Escolha uma para salvar este produto nas próximas compras.
          </p>
          <AppSelect
            class="category-select"
            :model-value="categoryFor(item).name"
            :aria-label="`Escolher categoria de ${item.product}`"
            :disabled="disabled"
            :options="categoryOptions"
            @update:model-value="$emit('category', item.product, $event)"
          />
        </div>
        <div class="month-item-actions">
          <a
            v-if="item.receiptUrl"
            class="receipt-icon-button"
            :href="item.receiptUrl"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="`Abrir nota fiscal de ${item.product}`"
            :title="`Abrir nota fiscal de ${item.product}`"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
              <path d="M9 8h6M9 12h6M9 16h3" />
            </svg>
          </a>
          <p class="item-value">{{ money(item.value) }}</p>
        </div>
      </div>
      <p v-if="!loading && !error && filteredItems.length === 0" class="empty-text">Nenhuma compra corresponde aos filtros.</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { formatMonthName, money } from '../lib/api';
import CalendarPicker from './CalendarPicker.vue';
import AppSelect from './AppSelect.vue';

const props = defineProps({
  items: { type: Array, default: () => [] },
  categories: { type: Array, default: () => [] },
  users: { type: Array, default: () => [] },
  currentDate: { type: Date, default: () => new Date() },
  disabled: { type: Boolean, default: false },
  currentUserId: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
});

defineEmits(['back', 'category', 'month-change']);

const monthName = computed(() => formatMonthName(props.currentDate));
const monthAbbreviation = computed(() => formatMonthName(props.currentDate, 'short').replace('.', '').toLocaleUpperCase('pt-BR'));
const selectedMonth = computed(
  () => `${props.currentDate.getFullYear()}-${String(props.currentDate.getMonth() + 1).padStart(2, '0')}`,
);
const buyerFilter = ref('all');
const buyerFilterOptions = computed(() => [
  { value: 'all', label: 'Todas as pessoas' },
  { value: 'mine', label: 'Compradas por mim' },
  ...props.users
    .filter((user) => String(user.id) !== String(props.currentUserId))
    .map((user) => ({ value: `buyer:${user.id}`, label: `Compradas por ${user.name}` })),
]);
const categoryOptions = computed(() => props.categories.map((category) => ({ value: category.name, label: category.name })));
const productSearch = ref('');

const filteredItems = computed(() => {
  const query = normalizeSearch(productSearch.value);
  return props.items.filter((item) => {
    const isMine = String(item.buyerId) === String(props.currentUserId);
    const matchesBuyer =
      buyerFilter.value === 'all' ||
      (buyerFilter.value === 'mine' && isMine) ||
      (buyerFilter.value.startsWith('buyer:') && String(item.buyerId) === buyerFilter.value.slice('buyer:'.length));
    const matchesProduct = !query || normalizeSearch(item.product).includes(query);
    return matchesBuyer && matchesProduct;
  });

  function normalizeSearch(value) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR')
      .trim();
  }
});

const categoryTotals = computed(() => {
  const totals = props.categories.map((category) => ({
    ...category,
    value: 0,
  }));
  props.items.forEach((item) => {
    const category = totals.find((entry) => entry.name === categoryFor(item).name);
    if (category) category.value += Number(item.value) || 0;
  });

  const total = totals.reduce((sum, category) => sum + category.value, 0);
  return totals.map((category) => ({
    ...category,
    percent: total ? Math.round((category.value / total) * 100) : 0,
  }));
});

function categoryFor(item) {
  const savedCategory = item.category;
  return (
    props.categories.find((category) => category.name === savedCategory) ||
    props.categories.find((category) => category.name === 'Outros') ||
    props.categories[0] || {
      id: '',
      name: item.category || '',
      color: '#a99f92',
    }
  );
}

const categoryTotal = computed(() => categoryTotals.value.reduce((sum, category) => sum + category.value, 0));

const chartBackground = computed(() => {
  if (!categoryTotal.value) return '#e9f0d5';
  let start = 0;
  const stops = categoryTotals.value.map((category) => {
    const end = start + (category.value / categoryTotal.value) * 360;
    const stop = `${category.color} ${start}deg ${end}deg`;
    start = end;
    return stop;
  });
  return `conic-gradient(${stops.join(', ')})`;
});

function nameOf(userId) {
  return props.users.find((user) => String(user.id) === String(userId))?.name || 'Morador';
}

</script>
