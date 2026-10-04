<template>
  <div class="page">
    <div class="page-content">
      <button class="back" @click="$emit('back')">← Voltar</button>
      <h1 class="screen-title">Compras de {{ monthName }} de {{ currentDate.getFullYear() }}</h1>
      <p class="screen-copy">{{ items.length }} itens registrados neste mês.</p>

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

      <div v-for="item in items" :key="item.id" class="month-row">
        <div class="date-badge">
          <span class="date-badge-day">{{ item.date.slice(0, 2) }}</span>
          <span class="date-badge-month">{{ monthAbbreviation }}</span>
        </div>
        <div class="month-info">
          <p class="item-name">{{ item.product }}</p>
          <p class="item-meta">{{ item.market }} • pago por {{ nameOf(item.buyerId) }}</p>
          <p class="participant-summary">Dividido com {{ item.sharedWith.map(nameOf).join(', ') }}</p>
          <select
            class="category-select"
            :value="categoryFor(item).name"
            :aria-label="`Escolher categoria de ${item.product}`"
            @change="changeCategory(item.id, $event.target.value)"
          >
            <option v-for="category in categories" :key="category.id" :value="category.name">
              {{ category.name }}
            </option>
          </select>
        </div>
        <p class="item-value">{{ money(item.value) }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { formatMonthName, money } from '../lib/api';

const props = defineProps({
  items: { type: Array, default: () => [] },
  categories: { type: Array, default: () => [] },
  users: { type: Array, default: () => [] },
  currentDate: { type: Date, default: () => new Date() },
});

defineEmits(['back']);

const categoryOverrides = ref(loadCategoryOverrides());
const monthName = computed(() => formatMonthName(props.currentDate));
const monthAbbreviation = computed(() => formatMonthName(props.currentDate, 'short').replace('.', '').toLocaleUpperCase('pt-BR'));

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
  const savedCategory = categoryOverrides.value[item.id] || item.category;
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

function changeCategory(itemId, categoryName) {
  categoryOverrides.value = {
    ...categoryOverrides.value,
    [itemId]: categoryName,
  };
  localStorage.setItem('mandamoney-category-overrides', JSON.stringify(categoryOverrides.value));
}

function loadCategoryOverrides() {
  try {
    return JSON.parse(localStorage.getItem('mandamoney-category-overrides') || '{}');
  } catch {
    return {};
  }
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
