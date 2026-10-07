<template>
  <div class="login-page">
    <div class="brand-mark">+</div>
    <p class="eyebrow">MANDA MONEY</p>
    <h1 class="login-title">Dividir fica leve quando todo mundo vê.</h1>
    <p class="login-copy">Entre para acompanhar as compras da casa e deixar cada conta no lugar certo.</p>

    <label class="label">Número do telefone</label>
    <input
      class="input"
      type="tel"
      inputmode="numeric"
      placeholder="(88) 9 9999-9999"
      :value="phone"
      @input="$emit('update:phone', formatPhone($event.target.value))"
    />

    <label class="label">Data de aniversário</label>
    <input
      class="input"
      type="text"
      inputmode="numeric"
      maxlength="10"
      placeholder="DD/MM/AAAA"
      :value="birthday"
      @input="onBirthdayInput"
      @keyup.enter="submit"
    />

    <button class="btn-primary" :disabled="isLoggingIn" @click="submit">
      <span class="btn-primary-text">{{ isLoggingIn ? 'Aguarde...' : 'Entrar na minha casa' }}</span>
      <span class="btn-arrow">{{ isLoggingIn ? '…' : '→' }}</span>
    </button>
  </div>
</template>

<script setup>
import { formatBirthday, formatPhone } from '../lib/api';
import { onMounted } from 'vue';

defineProps({
  phone: { type: String, default: '' },
  birthday: { type: String, default: '' },
  isLoggingIn: { type: Boolean, default: false },
});

const emit = defineEmits(['update:phone', 'update:birthday', 'login', 'wake-api']);

onMounted(() => emit('wake-api'));

function onBirthdayInput(event) {
  emit('update:birthday', formatBirthday(event.target.value));
}

function submit() {
  emit('login');
}
</script>
