<template>
  <LoginScreen
    v-if="screen === 'login'"
    v-model:phone="phone"
    v-model:birthday="birthday"
    :is-logging-in="isLoggingIn"
    @login="login"
  />

  <LoadingScreen v-else-if="screen === 'loading'" :label="loadingLabel" />

  <QrScanner v-else-if="screen === 'scanner'" @scan="readNf" @cancel="screen = 'home'" />

  <OcrScanner v-else-if="screen === 'ocr'" @capture="readNfImage" @cancel="screen = 'home'" />

  <SplitScreen
    v-else-if="screen === 'split'"
    :user="loggedUser"
    :items="draftItems"
    :disabled="isRequesting"
    @toggle="togglePerson"
    @cancel="screen = 'home'"
    @save="saveDraft"
  />

  <ManualScreen
    v-else-if="screen === 'manual'"
    v-model:product="product"
    v-model:value="value"
    v-model:market="market"
    @back="screen = 'home'"
    @add="addManualItem"
  />

  <MonthScreen v-else-if="screen === 'month'" :items="currentMonthItems" @back="screen = 'home'" />

  <HomeScreen
    v-else
    :user="loggedUser"
    :total="total"
    :balances="balances"
    :items="currentMonthItems"
    :disabled="isRequesting"
    :unread-count="notifications.unreadCount.value"
    :show-notifications="showNotifications"
    :notification-items="notificationItems"
    @pay="payBalance"
    @qr="startQrImport"
    @ocr="startOcrImport"
    @manual="screen = 'manual'"
    @month="screen = 'month'"
    @logout="logout"
    @open-notifications="openNotifications"
  />
</template>

<script setup>
import { computed, ref } from 'vue';
import HomeScreen from './components/HomeScreen.vue';
import LoadingScreen from './components/LoadingScreen.vue';
import LoginScreen from './components/LoginScreen.vue';
import ManualScreen from './components/ManualScreen.vue';
import MonthScreen from './components/MonthScreen.vue';
import OcrScanner from './components/OcrScanner.vue';
import QrScanner from './components/QrScanner.vue';
import SplitScreen from './components/SplitScreen.vue';
import {
  OCR_URL,
  calculateBalances,
  isCurrentMonth,
  mapApiBalance,
  mapApiItem,
  normalizePhone,
  requestApi,
} from './lib/api';
import { useNotifications } from './lib/notifications';
import { initialItems } from './lib/users';

const screen = ref('login');
const loggedUser = ref(null);
const phone = ref('');
const birthday = ref('');
const items = ref(initialItems);
const draftItems = ref([]);
const product = ref('');
const value = ref('');
const market = ref('');
const isLoggingIn = ref(false);
const isRequesting = ref(false);
const loadingLabel = ref('Entrando na sua casa...');
const balances = ref([]);

const showNotifications = ref(false);
const notificationItems = ref([]);
const notifications = useNotifications();

const currentMonthItems = computed(() => items.value.filter((item) => isCurrentMonth(item.date)));
const total = computed(() => currentMonthItems.value.reduce((sum, item) => sum + item.value, 0));

function refreshNotifications() {
  notifications.refresh(loggedUser.value?.id, items.value);
}

function openNotifications() {
  notificationItems.value = [...notifications.unreadItems.value];
  showNotifications.value = true;
  notifications.markAllSeen(loggedUser.value.id, items.value);
}

async function login() {
  if (isLoggingIn.value) return;
  isLoggingIn.value = true;
  isRequesting.value = true;
  loadingLabel.value = 'Entrando na sua casa...';
  screen.value = 'loading';
  try {
    const data = await requestApi(
      `?action=login&phone=${encodeURIComponent(normalizePhone(phone.value))}&birthday=${encodeURIComponent(birthday.value.trim())}`,
    );
    if (!data.user) throw new Error('Usuário não encontrado.');
    const user = { ...data.user, phone: normalizePhone(data.user.phone), birthday: String(data.user.birthday) };
    loggedUser.value = user;

    const itemsData = await requestApi('?action=items');
    const loadedItems = (itemsData.items || []).map(mapApiItem);
    items.value = loadedItems;

    try {
      const balancesData = await requestApi('?action=balances');
      balances.value = (balancesData.balances || []).map(mapApiBalance);
    } catch {
      balances.value = calculateBalances(loadedItems);
    }

    refreshNotifications();
    screen.value = 'home';
  } catch (error) {
    screen.value = 'login';
    alert(error instanceof Error ? error.message : 'Verifique sua conexão e os dados.');
  } finally {
    isLoggingIn.value = false;
    isRequesting.value = false;
  }
}

function startQrImport() {
  if (!loggedUser.value) return;
  screen.value = 'scanner';
}

function startOcrImport() {
  if (!loggedUser.value) return;
  screen.value = 'ocr';
}

async function readNf(qrCode) {
  if (!loggedUser.value || isRequesting.value) return;
  isRequesting.value = true;
  loadingLabel.value = 'Lendo a NFC-e...';
  screen.value = 'loading';
  try {
    const data = await requestApi('', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'readNf', qrCode }),
    });
    const parsedItems = (data.items || [])
      .map((item, index) => ({
        id: `nf-${Date.now()}-${index}`,
        product: String(item.product ?? item.Produto ?? ''),
        value: Number(item.value ?? item.Valor_Total ?? item.valor ?? 0),
        market: data.market || String(item.market ?? item.Mercado ?? 'NFC-e'),
        date: data.date || String(item.date ?? item.Data ?? '22/09/2026'),
        buyerId: loggedUser.value.id,
        sharedWith: [loggedUser.value.id],
      }))
      .filter((item) => item.product && item.value > 0);

    if (!parsedItems.length) throw new Error('A NFC-e não retornou produtos.');
    draftItems.value = parsedItems;
    screen.value = 'split';
  } catch (error) {
    screen.value = 'home';
    alert(error instanceof Error ? error.message : 'Confira o QR Code e tente novamente.');
  } finally {
    isRequesting.value = false;
  }
}

async function readNfImage(imageBase64) {
  if (!loggedUser.value || isRequesting.value) return;
  isRequesting.value = true;
  loadingLabel.value = 'Lendo a foto da nota...';
  screen.value = 'loading';
  try {
    const response = await fetch(OCR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64 }),
    });
    const data = await response.json();
    if (!response.ok || data.success === false) {
      throw new Error(data.message || data.detail || 'O serviço OCR não conseguiu ler a imagem.');
    }
    const parsedItems = (data.items || [])
      .map((item, index) => ({
        id: `ocr-${Date.now()}-${index}`,
        product: String(item.product ?? item.Produto ?? ''),
        value: Number(item.value ?? item.Valor_Total ?? item.valor ?? 0),
        market: data.market || String(item.market ?? item.Mercado ?? 'Compra por OCR'),
        date: data.date || String(item.date ?? item.Data ?? '22/09/2026'),
        buyerId: loggedUser.value.id,
        sharedWith: [loggedUser.value.id],
      }))
      .filter((item) => item.product && item.value > 0);

    if (!parsedItems.length) throw new Error('O OCR não encontrou produtos. Confira a foto e tente novamente.');
    draftItems.value = parsedItems;
    screen.value = 'split';
  } catch (error) {
    screen.value = 'home';
    alert(error instanceof Error ? error.message : 'Confira a foto e tente novamente.');
  } finally {
    isRequesting.value = false;
  }
}

function togglePerson(itemId, userId) {
  draftItems.value = draftItems.value.map((item) =>
    item.id !== itemId
      ? item
      : {
          ...item,
          sharedWith: item.sharedWith.includes(userId)
            ? item.sharedWith.filter((id) => id !== userId)
            : [...item.sharedWith, userId],
        },
  );
}

async function saveDraft() {
  if (isRequesting.value) return;
  if (draftItems.value.some((item) => item.sharedWith.length === 0)) {
    alert('Cada item precisa ter pelo menos uma pessoa.');
    return;
  }
  isRequesting.value = true;
  loadingLabel.value = 'Salvando divisão...';
  screen.value = 'loading';
  try {
    await requestApi('', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'saveItems', items: draftItems.value }),
    });
    const nextItems = [...draftItems.value, ...items.value];
    items.value = nextItems;
    balances.value = calculateBalances(nextItems);
    draftItems.value = [];
    screen.value = 'home';
    refreshNotifications();
    alert('Compra salva! Os itens foram enviados para a planilha.');
  } catch (error) {
    screen.value = 'split';
    alert(error instanceof Error ? error.message : 'Verifique a conexão com a planilha.');
  } finally {
    isRequesting.value = false;
  }
}

async function payBalance(balance) {
  if (isRequesting.value) return;
  isRequesting.value = true;
  loadingLabel.value = 'Atualizando saldo...';
  screen.value = 'loading';
  try {
    await requestApi('', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'payDebt',
        balanceId: balance.id,
        debtorId: balance.debtorId,
        creditorId: balance.creditorId,
      }),
    });
    balances.value = balances.value.map((item) =>
      item.id === balance.id ? { ...item, status: 'Pago', paidAt: new Date().toISOString() } : item,
    );
    screen.value = 'home';
    alert('Dívida quitada! Compras futuras criarão um novo saldo.');
  } catch (error) {
    screen.value = 'home';
    alert(error instanceof Error ? error.message : 'Adicione a ação payDebt no Apps Script.');
  } finally {
    isRequesting.value = false;
  }
}

function addManualItem() {
  const parsedValue = Number(value.value.replace(',', '.'));
  if (!product.value.trim() || !parsedValue || !loggedUser.value) {
    alert('Informe o produto e um valor maior que zero.');
    return;
  }
  draftItems.value = [
    {
      id: `manual-${Date.now()}`,
      product: product.value.trim(),
      value: parsedValue,
      market: market.value.trim() || 'Compra manual',
      date: '22/09/2026',
      buyerId: loggedUser.value.id,
      sharedWith: [loggedUser.value.id],
    },
  ];
  product.value = '';
  value.value = '';
  market.value = '';
  screen.value = 'split';
}

function logout() {
  loggedUser.value = null;
  screen.value = 'login';
}
</script>
