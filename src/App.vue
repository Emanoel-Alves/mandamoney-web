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

  <OcrScanner v-else-if="screen === 'ocr'" @capture="readNfImage" @error="showMessage" @cancel="screen = 'home'" />

  <SplitScreen
    v-else-if="screen === 'split'"
    :user="loggedUser"
    :items="draftItems"
    :disabled="isRequesting"
    @toggle="togglePerson"
    @category="updateDraftCategory"
    @cancel="screen = 'home'"
    @save="saveDraft"
    @add-item="addAnotherManualItem"
  />

  <ManualScreen
    v-else-if="screen === 'manual'"
    v-model:product="product"
    v-model:value="value"
    v-model:market="market"
    v-model:category="category"
    @back="backFromManual"
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
    :unread-count="notifications.unreadCount.value + paymentNotifications.length"
    :show-notifications="showNotifications"
    :notification-items="notificationItems"
    :pay-loading-id="payLoadingId"
    :confirm-loading-id="confirmLoadingId"
    @pay="payBalance"
    @confirm-payment="confirmPayment"
    @qr="startQrImport"
    @ocr="startOcrImport"
    @manual="startManualItem"
    @month="screen = 'month'"
    @logout="logout"
    @open-notifications="openNotifications"
  />

  <MessageModal v-if="modalMessage" :message="modalMessage" @close="modalMessage = ''" />
</template>

<script setup>
import { computed, ref } from 'vue';
import HomeScreen from './components/HomeScreen.vue';
import LoadingScreen from './components/LoadingScreen.vue';
import LoginScreen from './components/LoginScreen.vue';
import ManualScreen from './components/ManualScreen.vue';
import MessageModal from './components/MessageModal.vue';
import MonthScreen from './components/MonthScreen.vue';
import OcrScanner from './components/OcrScanner.vue';
import QrScanner from './components/QrScanner.vue';
import SplitScreen from './components/SplitScreen.vue';
import {
  classifyProduct,
  isCurrentMonth,
  mapApiBalance,
  mapApiItem,
  normalizePhone,
  postApi,
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
const category = ref('');
const isLoggingIn = ref(false);
const isRequesting = ref(false);
const loadingLabel = ref('Entrando na sua casa...');
const balances = ref([]);

const showNotifications = ref(false);
const notificationItems = ref([]);
const paymentNotifications = ref([]);
const payLoadingId = ref('');
const confirmLoadingId = ref('');
const modalMessage = ref('');
const notifications = useNotifications();

const currentMonthItems = computed(() => items.value.filter((item) => isCurrentMonth(item.date)));
const total = computed(() => currentMonthItems.value.reduce((sum, item) => sum + item.value, 0));

function showMessage(message) {
  modalMessage.value = message;
}

function refreshNotifications() {
  notifications.refresh(loggedUser.value?.id, items.value);
}

function openNotifications() {
  notificationItems.value = [...notifications.unreadItems.value, ...paymentNotifications.value];
  showNotifications.value = true;
  notifications.markAllSeen(loggedUser.value.id, items.value);
}

async function refreshPaymentNotifications() {
  if (!loggedUser.value) return;
  try {
    const data = await requestApi(`?action=paymentNotifications&userId=${encodeURIComponent(loggedUser.value.id)}`);
    paymentNotifications.value = data.notifications || [];
  } catch {
    paymentNotifications.value = [];
  }
}

async function refreshBalances() {
  const balancesData = await requestApi('?action=balances');
  balances.value = (balancesData.balances || []).map(mapApiBalance);
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
      await refreshBalances();
    } catch {
      // Saldos são a fonte oficial: recalcular pelos itens recriaria dívidas já pagas.
      balances.value = [];
    }

    await refreshPaymentNotifications();
    refreshNotifications();
    screen.value = 'home';
  } catch (error) {
    screen.value = 'login';
    showMessage(error instanceof Error ? error.message : 'Verifique sua conexão e os dados.');
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
    const data = await postApi({ action: 'readNf', qrCode });
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
    showMessage(error instanceof Error ? error.message : 'Confira o QR Code e tente novamente.');
  } finally {
    isRequesting.value = false;
  }
}

async function readNfImage({ imageBase64, mimeType }) {
  if (!loggedUser.value || isRequesting.value) return;
  isRequesting.value = true;
  loadingLabel.value = 'Lendo a foto da nota...';
  screen.value = 'loading';
  try {
    const data = await postApi({ action: 'readNfGemini', imageBase64, mimeType });
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
    showMessage(error instanceof Error ? error.message : 'Confira a foto e tente novamente.');
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

function updateDraftCategory(itemId, categoryName) {
  draftItems.value = draftItems.value.map((item) =>
    item.id === itemId ? { ...item, category: categoryName } : item,
  );
}

function startManualItem() {
  draftItems.value = [];
  category.value = '';
  screen.value = 'manual';
}

function addAnotherManualItem() {
  product.value = '';
  value.value = '';
  market.value = '';
  category.value = '';
  screen.value = 'manual';
}

function backFromManual() {
  screen.value = draftItems.value.length ? 'split' : 'home';
}

async function saveDraft() {
  if (isRequesting.value) return;
  if (draftItems.value.some((item) => item.sharedWith.length === 0)) {
    showMessage('Cada item precisa ter pelo menos uma pessoa.');
    return;
  }
  isRequesting.value = true;
  loadingLabel.value = 'Salvando divisão...';
  screen.value = 'loading';
  try {
    await postApi({ action: 'saveItems', items: draftItems.value });
    const nextItems = [...draftItems.value, ...items.value];
    items.value = nextItems;
    await refreshBalances();
    draftItems.value = [];
    screen.value = 'home';
    refreshNotifications();
    showMessage('Compra salva! Os itens foram enviados para a planilha.');
  } catch (error) {
    screen.value = 'split';
    showMessage(error instanceof Error ? error.message : 'Verifique a conexão com a planilha.');
  } finally {
    isRequesting.value = false;
  }
}

async function payBalance(balance) {
  if (isRequesting.value) return;
  isRequesting.value = true;
  payLoadingId.value = String(balance.id);
  try {
    await postApi({
      action: 'requestPayment',
      balanceId: balance.id,
      debtorId: balance.debtorId,
      creditorId: balance.creditorId,
      value: balance.value,
    });
    await refreshBalances();
    await refreshPaymentNotifications();
    showMessage('Pagamento informado. A outra pessoa precisa confirmar para quitar o saldo.');
  } catch (error) {
    showMessage(error instanceof Error ? error.message : 'Não foi possível informar o pagamento.');
  } finally {
    isRequesting.value = false;
    payLoadingId.value = '';
  }
}

async function confirmPayment(notification) {
  if (isRequesting.value) return;
  isRequesting.value = true;
  confirmLoadingId.value = String(notification.id);
  try {
    await postApi({
      action: 'confirmPayment',
      notificationId: notification.id,
      balanceId: notification.balanceId,
      creditorId: loggedUser.value.id,
    });
    await refreshBalances();
    paymentNotifications.value = paymentNotifications.value.filter((item) => item.id !== notification.id);
    notificationItems.value = notificationItems.value.filter((item) => item.id !== notification.id);
    showMessage('Pagamento confirmado. A dívida foi quitada.');
  } catch (error) {
    showMessage(error instanceof Error ? error.message : 'Não foi possível confirmar o pagamento.');
  } finally {
    isRequesting.value = false;
    confirmLoadingId.value = '';
  }
}

function addManualItem() {
  const parsedValue = Number(value.value.replace(',', '.'));
  if (!product.value.trim() || !parsedValue || !loggedUser.value) {
    showMessage('Informe o produto e um valor maior que zero.');
    return;
  }
  draftItems.value = [
    ...draftItems.value,
    {
      id: `manual-${Date.now()}-${draftItems.value.length}`,
      product: product.value.trim(),
      category: category.value || classifyProduct(product.value),
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
  category.value = '';
  screen.value = 'split';
}

function logout() {
  loggedUser.value = null;
  screen.value = 'login';
}
</script>
