<template>
  <div class="page">
    <div class="page-content">
      <button class="back" @click="$emit('back')">← Voltar</button>
      <h1 class="screen-title">Compras de setembro</h1>
      <p class="screen-copy">{{ items.length }} itens registrados neste mês.</p>

      <section class="month-chart" aria-labelledby="month-chart-title">
        <div class="month-chart-header">
          <div>
            <p class="section-title" id="month-chart-title">Por grupo</p>
            <p class="chart-total">{{ money(categoryTotal) }}</p>
          </div>
          <p class="chart-caption">valor comprado</p>
        </div>

        <div v-if="categoryTotal > 0" class="chart-content">
          <div class="pie-chart" :style="{ background: chartBackground }" aria-label="Gráfico de pizza dos gastos por grupo"></div>
          <div class="chart-legend">
            <div v-for="category in categories" :key="category.name" class="legend-row">
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
          <span class="date-badge-month">SET</span>
        </div>
        <div class="month-info">
          <p class="item-name">{{ item.product }}</p>
          <p class="item-meta">{{ item.market }} • pago por {{ nameOf(item.buyerId) }}</p>
          <p class="participant-summary">
            Dividido com {{ item.sharedWith.map(nameOf).join(', ') }}
          </p>
          <select
            class="category-select"
            :value="categoryFor(item).name"
            :aria-label="`Escolher grupo de ${item.product}`"
            @change="changeCategory(item.id, $event.target.value)"
          >
            <option v-for="group in productGroups" :key="group.name" :value="group.name">
              {{ group.name }}
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
import { classifyProduct, isProductGroup, money, productGroups } from '../lib/api';
import { users } from '../lib/users';

const props = defineProps({
  items: { type: Array, default: () => [] },
});

defineEmits(['back']);

const categoryOverrides = ref(loadCategoryOverrides());

const categories = computed(() => {
  const totals = productGroups.map((category) => ({ ...category, value: 0 }));
  props.items.forEach((item) => {
    const category = totals.find((entry) => entry.name === categoryFor(item).name);
    category.value += Number(item.value) || 0;
  });

  const total = totals.reduce((sum, category) => sum + category.value, 0);
  return totals.map((category) => ({
    ...category,
    percent: total ? Math.round((category.value / total) * 100) : 0,
  }));
});

function categoryFor(item) {
  const savedCategory = categoryOverrides.value[item.id] || item.category;
  const categoryName = isProductGroup(savedCategory) ? savedCategory : classifyProduct(item.product);
  return productGroups.find((category) => category.name === categoryName) || productGroups[productGroups.length - 1];
}

function changeCategory(itemId, categoryName) {
  categoryOverrides.value = { ...categoryOverrides.value, [itemId]: categoryName };
  localStorage.setItem('mandamoney-category-overrides', JSON.stringify(categoryOverrides.value));
}

function loadCategoryOverrides() {
  try {
    return JSON.parse(localStorage.getItem('mandamoney-category-overrides') || '{}');
  } catch {
    return {};
  }
}

const categoryTotal = computed(() => categories.value.reduce((sum, category) => sum + category.value, 0));

const chartBackground = computed(() => {
  if (!categoryTotal.value) return '#e9f0d5';
  let start = 0;
  const stops = categories.value.map((category) => {
    const end = start + (category.value / categoryTotal.value) * 360;
    const stop = `${category.color} ${start}deg ${end}deg`;
    start = end;
    return stop;
  });
  return `conic-gradient(${stops.join(', ')})`;
});

function nameOf(userId) {
  return users.find((user) => user.id === userId)?.name || 'Morador';
}
</script>
