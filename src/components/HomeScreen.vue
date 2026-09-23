<template>
  <div class="page">
    <div class="page-content">
      <div class="top-line">
        <div>
          <p class="eyebrow">{{ todayLabel }}</p>
          <h1 class="greeting">Olá, {{ user.name.split(' ')[0] }}</h1>
        </div>
        <div class="top-actions">
          <button class="bell" @click="$emit('open-notifications')" aria-label="Notificações">
            🔔
            <span v-if="unreadCount > 0" class="bell-dot"></span>
          </button>
          <button class="avatar" @click="$emit('logout')">{{ user.name[0] }}</button>
        </div>
      </div>

      <div v-if="showNotifications" class="notifications-panel">
        <h3>Notificações</h3>
        <p v-if="notificationItems.length === 0">Nenhuma novidade por aqui.</p>
        <p v-for="item in notificationItems" :key="item.id">
          Você foi incluído em <strong>{{ item.product }}</strong>
        </p>
      </div>

      <div class="summary">
        <div>
          <p class="summary-label">TOTAL DA CASA</p>
          <p class="summary-value">{{ money(total) }}</p>
          <p class="summary-caption">em setembro</p>
        </div>
        <div class="summary-month">
          <p class="summary-label">MÊS ATUAL</p>
          <p class="month-value">SET</p>
          <p class="summary-caption">2026</p>
        </div>
      </div>

      <p class="section-title">Adicionar compra</p>
      <div class="actions">
        <button class="action-card action-card-dark" @click="$emit('qr')">
          <span class="action-icon">▣</span>
          <span>
            <span class="action-title" style="display:block">Ler QR Code</span>
            <span class="action-description">Importar pela NFC-e</span>
          </span>
        </button>
        <button class="action-card action-card-green" @click="$emit('manual')">
          <span class="action-icon">＋</span>
          <span>
            <span class="action-title" style="display:block">Adicionar item</span>
            <span class="action-description">Sem nota eletrônica</span>
          </span>
        </button>
      </div>

      <button class="ocr-row" @click="$emit('ocr')">
        <span class="ocr-icon">▤</span>
        <span>
          <span class="ocr-title" style="display:block">Fotografar nota (OCR)</span>
          <span class="ocr-subtitle">Ler os produtos pela imagem</span>
        </span>
      </button>

      <div class="section-header">
        <p class="section-title">Saldos da casa</p>
        <button class="link" @click="$emit('month')">Ver compras do mês →</button>
      </div>

      <div class="debt-card">
        <p v-if="balances.length === 0" class="empty-text">Nenhuma divisão registrada neste mês.</p>
        <template v-else>
          <div
            v-for="balance in balances"
            :key="balance.id"
            class="debt-row"
            :style="isPaid(balance) ? { opacity: 0.55 } : {}"
          >
            <div class="debt-person">
              <div class="small-avatar">{{ nameOf(balance.debtorId)[0] }}</div>
              <div>
                <p class="debt-name">{{ nameOf(balance.debtorId) }} deve a {{ nameOf(balance.creditorId) }}</p>
                <p v-if="isPaid(balance)" class="debt-paid-note">
                  Pago{{ balance.paidAt ? ` em ${formatPaidDate(balance.paidAt)}` : '' }}
                </p>
              </div>
            </div>
            <p class="debt-value">{{ money(balance.value) }}</p>
            <button v-if="!isPaid(balance)" class="pay-btn" :disabled="disabled" @click="$emit('pay', balance)">
              Quitar
            </button>
          </div>
        </template>
      </div>

      <p class="section-title">Últimos itens</p>
      <div class="list">
        <div v-for="item in items.slice(0, 3)" :key="item.id" class="list-row">
          <div>
            <p class="item-name">{{ item.product }}</p>
            <p class="item-meta">{{ item.market }} • {{ item.date }}</p>
          </div>
          <p class="item-value">{{ money(item.value) }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { money, formatPaidDate } from '../lib/api';
import { users } from '../lib/users';

defineProps({
  user: { type: Object, required: true },
  total: { type: Number, required: true },
  balances: { type: Array, default: () => [] },
  items: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
  unreadCount: { type: Number, default: 0 },
  showNotifications: { type: Boolean, default: false },
  notificationItems: { type: Array, default: () => [] },
});

defineEmits(['pay', 'qr', 'ocr', 'manual', 'month', 'logout', 'open-notifications']);

const todayLabel = 'TERÇA, 22 SET 2026';

function nameOf(userId) {
  return users.find((candidate) => candidate.id === userId)?.name || 'Morador';
}

function isPaid(balance) {
  return balance.status.toLowerCase() === 'pago';
}
</script>
