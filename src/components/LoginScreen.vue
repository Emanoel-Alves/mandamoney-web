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
      @keyup.enter="$emit('login')"
    />

    <button class="btn-primary" :disabled="isLoggingIn" @click="$emit('login')">
      <span class="btn-primary-text">{{ isLoggingIn ? 'Entrando...' : 'Entrar na minha casa' }}</span>
      <span class="btn-arrow">{{ isLoggingIn ? '…' : '→' }}</span>
    </button>

    <p class="login-hint">Teste: 88999999999 • 01/01/2000</p>
  </div>
</template>

<script setup>
import { formatBirthday, formatPhone } from '../lib/api';

defineProps({
  phone: { type: String, default: '' },
  birthday: { type: String, default: '' },
  isLoggingIn: { type: Boolean, default: false },
});

const emit = defineEmits(['update:phone', 'update:birthday', 'login']);

function onBirthdayInput(event) {
  emit('update:birthday', formatBirthday(event.target.value));
}
</script>
