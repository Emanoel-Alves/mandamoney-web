<template>
  <div ref="root" class="calendar-picker">
    <button
      :id="id"
      class="calendar-trigger"
      type="button"
      :disabled="disabled"
      :aria-label="ariaLabel"
      :aria-expanded="isOpen"
      aria-haspopup="dialog"
      @click="toggleCalendar"
    >
      <span>{{ triggerLabel }}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
        <path d="M7.5 3v4M16.5 3v4M4 9.5h16" />
      </svg>
    </button>

    <section
      v-if="isOpen"
      class="calendar-popup"
      :class="{ 'calendar-popup-up': opensUp }"
      :style="popupStyle"
      role="dialog"
      :aria-label="ariaLabel"
    >
      <header class="calendar-header">
        <button
          class="calendar-nav"
          type="button"
          :aria-label="mode === 'month' ? 'Ano anterior' : 'Mês anterior'"
          @click="movePeriod(-1)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <p class="calendar-heading">{{ heading }}</p>
        <button
          class="calendar-nav"
          type="button"
          :aria-label="mode === 'month' ? 'Próximo ano' : 'Próximo mês'"
          @click="movePeriod(1)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </header>

      <template v-if="mode === 'month'">
        <div class="calendar-month-grid">
          <button
            v-for="(month, index) in monthNames"
            :key="month"
            class="calendar-month"
            :class="{ 'calendar-selected': isSelectedMonth(index) }"
            type="button"
            @click="selectMonth(index)"
          >
            {{ month }}
          </button>
        </div>
      </template>

      <template v-else>
        <div class="calendar-day-grid calendar-weekdays" aria-hidden="true">
          <span v-for="weekday in weekdays" :key="weekday.short">{{ weekday.short }}</span>
        </div>
        <div class="calendar-day-grid">
          <button
            v-for="day in days"
            :key="day.iso"
            class="calendar-day"
            :class="{
              'calendar-outside-month': !day.inMonth,
              'calendar-today': day.today,
              'calendar-selected': day.selected,
              'calendar-weekend': day.weekend,
            }"
            type="button"
            :aria-label="day.ariaLabel"
            :aria-pressed="day.selected"
            @click="selectDate(day.iso)"
          >
            {{ day.number }}
          </button>
        </div>
      </template>

      <footer class="calendar-footer">
        <button class="calendar-footer-action" type="button" @click="selectToday">
          {{ mode === 'month' ? 'Este mês' : 'Hoje' }}
        </button>
        <button class="calendar-footer-action calendar-close-action" type="button" @click="isOpen = false">
          Fechar
        </button>
      </footer>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  mode: { type: String, default: 'date', validator: (value) => ['date', 'month'].includes(value) },
  ariaLabel: { type: String, default: 'Selecionar data' },
  id: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue']);
const root = ref(null);
const isOpen = ref(false);
const opensUp = ref(false);
const popupMaxHeight = ref(420);
const popupStyle = computed(() => ({ '--calendar-popup-max-height': `${popupMaxHeight.value}px` }));
const viewDate = ref(parseModelValue(props.modelValue, props.mode) || new Date());
const monthNames = Array.from({ length: 12 }, (_, index) =>
  new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(2024, index, 1)).replace('.', ''),
);
const weekdays = [
  { short: 'D', full: 'domingo' },
  { short: 'S', full: 'segunda-feira' },
  { short: 'T', full: 'terça-feira' },
  { short: 'Q', full: 'quarta-feira' },
  { short: 'Q', full: 'quinta-feira' },
  { short: 'S', full: 'sexta-feira' },
  { short: 'S', full: 'sábado' },
];

const heading = computed(() => {
  if (props.mode === 'month') return String(viewDate.value.getFullYear());
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(viewDate.value);
});

const triggerLabel = computed(() => {
  const date = parseModelValue(props.modelValue, props.mode);
  if (!date) return props.mode === 'month' ? 'Selecionar mês' : 'Selecionar data';
  return props.mode === 'month'
    ? new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date)
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(date);
});

const days = computed(() => {
  if (props.mode !== 'date') return [];
  const year = viewDate.value.getFullYear();
  const month = viewDate.value.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const start = new Date(year, month, 1 - firstDay);
  const selected = props.modelValue;
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    const iso = toIsoDate(date);
    return {
      iso,
      number: date.getDate(),
      inMonth: date.getMonth() === month,
      today: iso === toIsoDate(new Date()),
      selected: iso === selected,
      weekend: date.getDay() === 0 || date.getDay() === 6,
      ariaLabel: new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(date),
    };
  });
});

watch(
  () => [props.modelValue, props.mode],
  ([value, mode]) => {
    viewDate.value = parseModelValue(value, mode) || new Date();
  },
);

function parseModelValue(value, mode) {
  const match = String(value || '').match(mode === 'month' ? /^(\d{4})-(\d{2})$/ : /^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day = '1'] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toggleCalendar() {
  if (isOpen.value) {
    isOpen.value = false;
    return;
  }
  viewDate.value = parseModelValue(props.modelValue, props.mode) || new Date();
  isOpen.value = true;
  nextTick(updatePlacement);
}

function updatePlacement() {
  if (!root.value) return;
  const rect = root.value.getBoundingClientRect();
  const gap = 12;
  const spaceAbove = Math.max(0, rect.top - gap);
  const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - gap);
  opensUp.value = spaceAbove > spaceBelow;
  popupMaxHeight.value = Math.max(120, Math.min(420, (opensUp.value ? spaceAbove : spaceBelow) - 8));
}

function updatePlacementWhenOpen() {
  if (isOpen.value) updatePlacement();
}

function movePeriod(amount) {
  viewDate.value = props.mode === 'month'
    ? new Date(viewDate.value.getFullYear() + amount, viewDate.value.getMonth(), 1)
    : new Date(viewDate.value.getFullYear(), viewDate.value.getMonth() + amount, 1);
}

function isSelectedMonth(index) {
  const selected = parseModelValue(props.modelValue, 'month');
  return Boolean(selected && selected.getFullYear() === viewDate.value.getFullYear() && selected.getMonth() === index);
}

function selectMonth(index) {
  emit('update:modelValue', `${viewDate.value.getFullYear()}-${String(index + 1).padStart(2, '0')}`);
  isOpen.value = false;
}

function selectDate(value) {
  emit('update:modelValue', value);
  isOpen.value = false;
}

function selectToday() {
  const today = new Date();
  if (props.mode === 'month') {
    emit('update:modelValue', `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
    isOpen.value = false;
  } else {
    selectDate(toIsoDate(today));
  }
}

function onDocumentPointerDown(event) {
  if (root.value && !root.value.contains(event.target)) isOpen.value = false;
}

function onKeydown(event) {
  if (event.key === 'Escape') isOpen.value = false;
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown);
  document.addEventListener('keydown', onKeydown);
  window.addEventListener('resize', updatePlacementWhenOpen);
  window.addEventListener('scroll', updatePlacementWhenOpen, true);
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown);
  document.removeEventListener('keydown', onKeydown);
  window.removeEventListener('resize', updatePlacementWhenOpen);
  window.removeEventListener('scroll', updatePlacementWhenOpen, true);
});
</script>

<style scoped>
.calendar-picker { position: relative; width: 100%; }
.calendar-trigger {
  width: 100%;
  min-height: 50px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid #d5dfd3;
  border-radius: 14px;
  padding: 11px 14px;
  color: var(--ink);
  background: linear-gradient(135deg, #fff 0%, #fbfcf8 100%);
  text-align: left;
  font-size: 14px;
  text-transform: capitalize;
  box-shadow: 0 2px 6px rgb(32 53 43 / 4%);
  transition: border-color .16s ease, box-shadow .16s ease, transform .16s ease;
}
.calendar-trigger:hover:not(:disabled) { border-color: #9db17d; box-shadow: 0 4px 12px rgb(32 53 43 / 8%); }
.calendar-trigger:focus-visible { outline: 3px solid rgb(184 219 78 / 55%); outline-offset: 2px; border-color: var(--dark); }
.calendar-trigger:disabled { opacity: .55; cursor: not-allowed; }
.calendar-trigger svg { width: 19px; height: 19px; flex: 0 0 auto; fill: none; stroke: #52705c; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.calendar-popup {
  position: absolute;
  z-index: 30;
  top: calc(100% + 7px);
  left: 0;
  width: min(320px, calc(100vw - 44px));
  max-height: min(420px, var(--calendar-popup-max-height, 420px));
  overflow-x: hidden;
  overflow-y: auto;
  padding: 0 14px 12px;
  border: 1px solid #d5dfd3;
  border-radius: 18px;
  background: var(--white);
  box-shadow: 0 18px 42px rgb(23 32 28 / 18%), 0 3px 8px rgb(23 32 28 / 6%);
  animation: calendar-appear .16s ease-out;
}
.calendar-popup-up { top: auto; bottom: calc(100% + 7px); }
.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 56px;
  margin: 0 -14px 12px;
  padding: 0 14px;
  color: #fff;
  background: var(--dark);
}
.calendar-heading { margin: 0; color: #fff; font-size: 15px; font-weight: 800; text-transform: capitalize; letter-spacing: .15px; }
.calendar-nav {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgb(255 255 255 / 20%);
  border-radius: 11px;
  color: #fff;
  background: rgb(255 255 255 / 8%);
  transition: background .16s ease, border-color .16s ease;
}
.calendar-nav:hover { border-color: rgb(255 255 255 / 40%); background: rgb(255 255 255 / 17%); }
.calendar-nav svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.calendar-day-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
.calendar-weekdays { margin-bottom: 6px; color: #87958a; font-size: 10px; font-weight: 800; text-align: center; text-transform: uppercase; }
.calendar-weekdays span { padding: 5px 0; }
.calendar-day,
.calendar-month {
  min-width: 0;
  min-height: 36px;
  border: 1px solid transparent;
  border-radius: 11px;
  color: var(--ink);
  background: transparent;
  font-size: 13px;
  transition: color .14s ease, background .14s ease, border-color .14s ease, transform .14s ease;
}
.calendar-day:hover,
.calendar-month:hover { border-color: #dce5d2; color: var(--dark); background: #f3f7e9; transform: translateY(-1px); }
.calendar-day:focus-visible,
.calendar-month:focus-visible,
.calendar-footer-action:focus-visible,
.calendar-nav:focus-visible { outline: 2px solid var(--green); outline-offset: 2px; }
.calendar-outside-month { color: #b5beb6; }
.calendar-weekend:not(.calendar-outside-month):not(.calendar-selected) { color: #738575; }
.calendar-today:not(.calendar-selected) { border-color: #a6c45b; color: #3e5b3e; background: #f5f9e9; font-weight: 800; }
.calendar-day.calendar-selected,
.calendar-month.calendar-selected { border-color: var(--green); color: var(--dark); background: var(--green); font-weight: 900; box-shadow: 0 3px 8px rgb(184 219 78 / 35%); }
.calendar-month-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; padding: 3px 0 4px; }
.calendar-month { min-height: 42px; text-transform: capitalize; font-weight: 650; }
.calendar-footer { display: flex; justify-content: space-between; border-top: 1px solid #e8eee5; margin-top: 12px; padding-top: 9px; }
.calendar-footer-action { border-radius: 9px; padding: 8px 10px; color: var(--dark); background: transparent; font-size: 12px; font-weight: 800; transition: background .14s ease; }
.calendar-footer-action:hover { background: #eef4df; }
.calendar-close-action { color: #758078; }
@keyframes calendar-appear {
  from { opacity: 0; transform: translateY(-4px) scale(.99); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .calendar-popup,
  .calendar-trigger,
  .calendar-nav,
  .calendar-day,
  .calendar-month,
  .calendar-footer-action { animation: none; transition: none; }
}
</style>
