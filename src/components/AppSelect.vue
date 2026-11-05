<template>
  <div ref="root" class="app-select">
    <button
      :id="id"
      ref="trigger"
      class="app-select-trigger"
      type="button"
      :disabled="disabled"
      :aria-label="ariaLabel"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      :aria-controls="listboxId"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <span class="app-select-value" :class="{ 'app-select-placeholder': !selectedOption || selectedOption.disabled }">
        {{ selectedOption?.label || placeholder }}
      </span>
      <svg class="app-select-chevron" :class="{ 'app-select-chevron-open': isOpen }" viewBox="0 0 24 24" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>

    <div
      v-if="isOpen"
      :id="listboxId"
      class="app-select-menu"
      :class="{ 'app-select-menu-up': opensUp }"
      :style="menuStyle"
      role="listbox"
      :aria-label="ariaLabel || placeholder"
    >
      <button
        v-for="(option, index) in options"
        :key="String(option.value)"
        :ref="(element) => setOptionRef(element, index)"
        class="app-select-option"
        :class="{
          'app-select-option-selected': isSelected(option),
          'app-select-option-disabled': option.disabled,
        }"
        type="button"
        role="option"
        :disabled="option.disabled"
        :aria-selected="isSelected(option)"
        @click="select(option)"
        @keydown="onOptionKeydown($event, index)"
      >
        <span>{{ option.label }}</span>
        <svg v-if="isSelected(option)" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m5 12 4 4L19 6" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

let componentCounter = 0;

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] },
  id: { type: String, default: '' },
  ariaLabel: { type: String, default: '' },
  placeholder: { type: String, default: 'Selecione uma opção' },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue']);
const root = ref(null);
const trigger = ref(null);
const optionRefs = ref([]);
const isOpen = ref(false);
const opensUp = ref(false);
const menuMaxHeight = ref(280);
const uniqueId = ++componentCounter;
const listboxId = computed(() => (props.id ? `${props.id}-options` : `app-select-${uniqueId}-options`));
const selectedOption = computed(() => props.options.find((option) => isSelected(option)));
const menuStyle = computed(() => ({ '--app-select-menu-max-height': `${menuMaxHeight.value}px` }));

function isSelected(option) {
  return String(option.value) === String(props.modelValue);
}

function setOptionRef(element, index) {
  if (element) optionRefs.value[index] = element;
}

async function open(focusSelected = false) {
  if (props.disabled) return;
  isOpen.value = true;
  await nextTick();
  updatePlacement();
  const selectedIndex = props.options.findIndex((option) => isSelected(option) && !option.disabled);
  const index = focusSelected && selectedIndex >= 0 ? selectedIndex : props.options.findIndex((option) => !option.disabled);
  optionRefs.value[index]?.focus();
}

function updatePlacement() {
  if (!trigger.value) return;
  const rect = trigger.value.getBoundingClientRect();
  const gap = 12;
  const spaceAbove = Math.max(0, rect.top - gap);
  const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - gap);
  opensUp.value = spaceAbove > spaceBelow;
  menuMaxHeight.value = Math.max(96, Math.min(280, (opensUp.value ? spaceAbove : spaceBelow) - 8));
}

function toggle() {
  if (isOpen.value) isOpen.value = false;
  else open();
}

function select(option) {
  if (option.disabled) return;
  emit('update:modelValue', option.value);
  isOpen.value = false;
  nextTick(() => trigger.value?.focus());
}

function focusOption(index) {
  const enabled = props.options.map((option, optionIndex) => ({ option, optionIndex })).filter(({ option }) => !option.disabled);
  if (!enabled.length) return;
  const current = enabled.findIndex(({ optionIndex }) => optionRefs.value[optionIndex] === document.activeElement);
  const target = enabled.findIndex(({ optionIndex }) => optionIndex === index);
  const next = target >= 0 ? target : Math.max(current, 0);
  optionRefs.value[enabled[next].optionIndex]?.focus();
}

function onTriggerKeydown(event) {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    open();
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    open(true);
  } else if (event.key === 'Escape') {
    isOpen.value = false;
  }
}

function onOptionKeydown(event, index) {
  if (event.key === 'Escape') {
    event.preventDefault();
    isOpen.value = false;
    nextTick(() => trigger.value?.focus());
    return;
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    let next = index + direction;
    while (next >= 0 && next < props.options.length && props.options[next].disabled) next += direction;
    if (next >= 0 && next < props.options.length) focusOption(next);
  } else if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault();
    const indices = props.options.map((option, optionIndex) => option.disabled ? -1 : optionIndex).filter((optionIndex) => optionIndex >= 0);
    if (indices.length) focusOption(event.key === 'Home' ? indices[0] : indices[indices.length - 1]);
  }
}

function closeOnOutsideClick(event) {
  if (root.value && !root.value.contains(event.target)) isOpen.value = false;
}

function closeOnEscape(event) {
  if (event.key === 'Escape' && isOpen.value) {
    isOpen.value = false;
    trigger.value?.focus();
  }
}

function updatePlacementWhenOpen() {
  if (isOpen.value) updatePlacement();
}

onMounted(() => {
  document.addEventListener('pointerdown', closeOnOutsideClick);
  document.addEventListener('keydown', closeOnEscape);
  window.addEventListener('resize', updatePlacementWhenOpen);
  window.addEventListener('scroll', updatePlacementWhenOpen, true);
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', closeOnOutsideClick);
  document.removeEventListener('keydown', closeOnEscape);
  window.removeEventListener('resize', updatePlacementWhenOpen);
  window.removeEventListener('scroll', updatePlacementWhenOpen, true);
});
</script>
