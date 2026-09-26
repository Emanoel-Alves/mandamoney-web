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
        <p v-if="notificationError" class="balance-details-error">{{ notificationError }}</p>
        <p v-if="notificationItems.length === 0">Nenhuma novidade por aqui.</p>
        <div v-for="item in notificationItems" :key="item.id" class="notification-item">
          <template v-if="item.type === 'contest_request'">
            <p>
              <strong>{{ nameOf(item.debtorId) }}</strong> contestou
              <strong>{{ item.product || 'um item' }}</strong>
              ({{ money(item.value) }}).
            </p>
            <div class="contest-actions">
              <button
                class="confirm-payment-btn"
                :disabled="disabled"
                @click="$emit('resolve-contest', item, 'accepted')"
              >
                {{ contestLoadingId === item.id ? 'Salvando...' : 'Aceitar contestação' }}
              </button>
              <button
                class="reject-contest-btn"
                :disabled="disabled"
                @click="$emit('resolve-contest', item, 'rejected')"
              >
                Recusar
              </button>
            </div>
          </template>
          <template v-else-if="item.type === 'payment_request'">
            <p>
              <strong>{{ nameOf(item.debtorId) }}</strong> informou o pagamento de
              <strong>{{ money(item.value) }}</strong>.
            </p>
            <button class="confirm-payment-btn" :disabled="disabled" @click="$emit('confirm-payment', item)">
              <svg v-if="confirmLoadingId === item.id" class="button-spinner" viewBox="0 0 24 24" aria-label="Confirmando">
                <circle class="button-spinner-track" cx="12" cy="12" r="9" />
                <circle class="button-spinner-path" cx="12" cy="12" r="9" />
              </svg>
              <span v-else>Confirmar pagamento</span>
            </button>
          </template>
          <p v-else>Você foi incluído em <strong>{{ item.product }}</strong></p>
        </div>
      </div>

      <div class="summary">
        <div>
          <p class="summary-label">TOTAL DA CASA</p>
          <p
            class="summary-value"
            :class="{
              'summary-value-long': totalDisplay.length > 12,
              'summary-value-extra-long': totalDisplay.length > 16,
            }"
          >
            {{ totalDisplay }}
          </p>
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
            :style="isSettled(balance) ? { opacity: 0.55 } : {}"
          >
            <button
              class="debt-details-button"
              :aria-expanded="expandedBalanceId === String(balance.id)"
              @click="toggleBalanceDetails(balance)"
            >
              <span class="debt-person">
                <span class="small-avatar">{{ nameOf(balance.debtorId)[0] }}</span>
                <span class="debt-person-copy">
                  <span class="debt-name">{{ nameOf(balance.debtorId) }} deve a {{ nameOf(balance.creditorId) }}</span>
                  <span v-if="isPaid(balance)" class="debt-paid-note">
                    Pago{{ balance.paidAt ? ` em ${formatPaidDate(balance.paidAt)}` : '' }}
                  </span>
                  <span v-else-if="isContested(balance)" class="debt-paid-note">Saldo removido após contestação aceita</span>
                  <span v-else-if="isAwaitingContest(balance)" class="debt-paid-note">Aguardando resposta à contestação</span>
                  <span v-else-if="isAwaitingConfirmation(balance)" class="debt-paid-note">
                    Aguardando confirmação de {{ nameOf(balance.creditorId) }}
                  </span>
                  <span class="debt-details-label">
                    {{ expandedBalanceId === String(balance.id) ? 'Ocultar itens' : 'Ver itens que compõem o saldo' }}
                  </span>
                </span>
              </span>
              <span class="debt-value">{{ money(balance.value) }}</span>
            </button>
            <button
              v-if="!isSettled(balance) && !isAwaitingConfirmation(balance) && !isAwaitingContest(balance)"
              class="pay-btn"
              :disabled="disabled"
              @click="$emit('pay', balance)"
            >
              <svg v-if="payLoadingId === balance.id" class="button-spinner" viewBox="0 0 24 24" aria-label="Solicitando pagamento">
                <circle class="button-spinner-track" cx="12" cy="12" r="9" />
                <circle class="button-spinner-path" cx="12" cy="12" r="9" />
              </svg>
              <span v-else>Quitar</span>
            </button>
            <div v-if="expandedBalanceId === String(balance.id)" class="balance-details">
              <p class="balance-details-title">Itens do saldo • atual {{ money(balance.value) }}</p>
              <p v-if="disputeError" class="balance-details-error">{{ disputeError }}</p>
              <p v-if="balanceItemsLoadingId === String(balance.id)" class="empty-text">Carregando itens...</p>
              <p v-else-if="balanceItemsError" class="balance-details-error">{{ balanceItemsError }}</p>
              <p v-else-if="!Object.prototype.hasOwnProperty.call(balanceItems, String(balance.id))" class="empty-text">
                Toque para carregar os itens deste saldo.
              </p>
              <p v-else-if="balanceItemsFor(balance).length === 0" class="empty-text">
                Não foram encontrados itens associados a este saldo.
              </p>
              <div v-for="entry in balanceItemsFor(balance)" :key="entry.item.id" class="balance-item">
                <div class="balance-item-info">
                  <p class="item-name">{{ entry.item.product }}</p>
                  <p class="item-meta">{{ entry.item.market }} • {{ entry.item.date }}</p>
                  <p v-if="entry.dispute" class="balance-item-status" :class="disputeStatusClass(entry.dispute)">
                    {{ disputeStatusText(entry.dispute) }}
                  </p>
                </div>
                <div class="balance-item-action">
                  <p class="item-value">{{ money(entry.share) }}</p>
                  <button
                    v-if="canContest(balance, entry)"
                    class="contest-item-btn"
                    :disabled="disabled || contestLoadingId === String(entry.item.id)"
                    @click="$emit('contest', { balance, item: entry.item, value: entry.share })"
                  >
                    {{ contestLoadingId === String(entry.item.id) ? 'Enviando...' : 'Contestar' }}
                  </button>
                </div>
              </div>
            </div>
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
import { computed, ref } from 'vue';
import { money, formatPaidDate } from '../lib/api';
import { users } from '../lib/users';

const props = defineProps({
  user: { type: Object, required: true },
  total: { type: Number, required: true },
  balances: { type: Array, default: () => [] },
  items: { type: Array, default: () => [] },
  disputes: { type: Array, default: () => [] },
  balanceItems: { type: Object, default: () => ({}) },
  balanceItemsLoadingId: { type: String, default: '' },
  balanceItemsError: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  unreadCount: { type: Number, default: 0 },
  showNotifications: { type: Boolean, default: false },
  notificationItems: { type: Array, default: () => [] },
  payLoadingId: { type: String, default: '' },
  confirmLoadingId: { type: String, default: '' },
  contestLoadingId: { type: String, default: '' },
  disputeError: { type: String, default: '' },
  notificationError: { type: String, default: '' },
});

const emit = defineEmits(['pay', 'confirm-payment', 'contest', 'resolve-contest', 'details', 'qr', 'ocr', 'manual', 'month', 'logout', 'open-notifications']);

const totalDisplay = computed(() => money(props.total));
const todayLabel = 'TERÇA, 22 SET 2026';
const expandedBalanceId = ref('');

function toggleBalanceDetails(balance) {
  const id = String(balance.id);
  if (expandedBalanceId.value === id) {
    expandedBalanceId.value = '';
    return;
  }
  expandedBalanceId.value = id;
  emit('details', balance);
}

function nameOf(userId) {
  return users.find((candidate) => candidate.id === userId)?.name || 'Morador';
}

function isPaid(balance) {
  return String(balance.status).trim().toLowerCase() === 'pago';
}

function isContested(balance) {
  return String(balance.status).trim().toLowerCase() === 'contestado';
}

function isSettled(balance) {
  return isPaid(balance) || isContested(balance);
}

function isAwaitingConfirmation(balance) {
  return String(balance.status).trim().toLowerCase().includes('aguardando');
}

function isAwaitingContest(balance) {
  return String(balance.status).trim().toLowerCase().includes('contestação pendente');
}

function balanceItemsFor(balance) {
  return (props.balanceItems[String(balance.id)] || []).map((entry) => ({
    item: {
      id: String(entry.itemId),
      product: String(entry.product || ''),
      market: String(entry.market || ''),
      date: String(entry.date || ''),
    },
    share: Number(entry.value) || 0,
    dispute: props.disputes.find((dispute) =>
      String(dispute.balanceId) === String(balance.id) &&
      String(dispute.itemId) === String(entry.itemId),
    ),
  }));
}

function canContest(balance, entry) {
  return String(props.user.id) === String(balance.debtorId) &&
    String(balance.status).toLowerCase() === 'pendente' &&
    !entry.dispute;
}

function disputeStatusText(dispute) {
  const status = String(dispute.status).toLowerCase();
  if (status === 'aceita') return 'Contestação aceita — valor removido do saldo';
  if (status === 'recusada') return 'Contestação recusada — valor mantido no saldo';
  return 'Contestação enviada — aguardando resposta';
}

function disputeStatusClass(dispute) {
  const status = String(dispute.status).toLowerCase();
  if (status === 'aceita') return 'dispute-accepted';
  if (status === 'recusada') return 'dispute-rejected';
  return 'dispute-pending';
}
</script>
