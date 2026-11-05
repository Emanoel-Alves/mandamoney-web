<template>
  <LoginScreen
    v-if="screen === 'login'"
    v-model:phone="phone"
    v-model:birthday="birthday"
    :is-logging-in="isLoggingIn"
    @login="login"
    @wake-api="wakeApi"
  />

  <LoadingScreen v-else-if="screen === 'loading'" :label="loadingLabel" />

  <QrScanner v-else-if="screen === 'scanner'" @scan="readNf" @cancel="screen = 'home'" />

  <OcrScanner v-else-if="screen === 'ocr'" @capture="readNfImage" @error="showMessage" @cancel="screen = 'home'" />

  <SplitScreen
    v-else-if="screen === 'split'"
    :user="loggedUser"
    :items="draftItems"
    :users="householdUsers"
    :categories="categories"
    :receipt-group="draftReceipt"
    :receipt-prompt="receiptPrompt"
    :receipt-prompt-error="receiptPromptError"
    :disabled="isRequesting"
    @toggle="togglePerson"
    @toggle-paid="togglePaidPerson"
    @toggle-not-consuming="toggleNotConsuming"
    @category="updateDraftCategory"
    @edit-item="editDraftItem"
    @remove-item="removeDraftItem"
    @update-date="updateDraftDate"
    @update-receipt-date="updateReceiptDate"
    @continue-receipt="continueReceiptImport"
    @discard-receipt="discardReceiptImport"
    @cancel="screen = 'home'"
    @save="saveDraft"
    @add-item="addAnotherManualItem"
  />

  <ManualScreen
    v-else-if="screen === 'manual'"
    :product="product"
    @update:product="updateManualProduct"
    v-model:value="value"
    v-model:market="market"
    v-model:date="purchaseDate"
    v-model:category="category"
    :categories="categories"
    @back="backFromManual"
    @add="addManualItem"
  />

  <ProductCatalogScreen
    v-else-if="screen === 'catalog'"
    :products="catalogProducts"
    :categories="categories"
    :disabled="isRequesting"
    @back="screen = 'home'"
    @add="addCatalogProduct"
    @update-category="updateCatalogProductCategory"
  />

  <MonthScreen
    v-else-if="screen === 'month'"
    :items="monthViewItems"
    :categories="categories"
    :users="householdUsers"
    :current-date="monthViewDate"
    :current-user-id="String(loggedUser.id)"
    :disabled="isRequesting"
    :loading="monthViewLoading"
    :error="monthViewError"
    @back="screen = 'home'"
    @category="updateSavedItemCategory"
    @month-change="loadMonthView"
  />

  <ShoppingListScreen
    v-else-if="screen === 'shopping-list'"
    :items="shoppingListItems"
    :users="householdUsers"
    :loading="shoppingListLoading"
    :disabled="isRequesting"
    :error="shoppingListError"
    @back="screen = 'home'"
    @add="addShoppingItem"
    @remove="removeShoppingItem"
    @retry="refreshShoppingList"
  />

  <HomeScreen
    v-else
    :user="loggedUser"
    :users="householdUsers"
    :total="total"
    :balances="balances"
    :items="currentMonthItems"
    :current-date="currentDate"
    :accumulated-purchases="accumulatedPurchases"
    :disputes="disputes"
    :balance-items="balanceItemsById"
    :balance-items-loading-id="balanceItemsLoadingId"
    :balance-items-error="balanceItemsError"
    :disabled="isRequesting"
    :unread-count="notifications.unreadCount.value + paymentNotifications.length + contestNotifications.length"
    :show-notifications="showNotifications"
    :notification-items="notificationItems"
    :push-status="pushStatus"
    :push-error="pushError"
    :push-loading="pushLoading"
    :pay-loading-id="payLoadingId"
    :balance-loading-id="balanceLoadingId"
    :confirm-loading-id="confirmLoadingId"
    :contest-loading-id="contestLoadingId"
    :dispute-error="disputeError"
    :notification-error="paymentNotificationError || contestNotificationError"
    @pay="payBalance"
    @balance="balanceDebts"
    @confirm-payment="confirmPayment"
    @contest="requestContest"
    @resolve-contest="resolveContest"
    @details="loadBalanceItems"
    @qr="startQrImport"
    @ocr="startOcrImport"
    @manual="startManualItem"
    @shopping-list="openShoppingList"
    @catalog="openCatalog"
    @month="openMonth"
    @logout="logout"
    @open-notifications="openNotifications"
    @enable-push="enableDevicePush"
    @disable-push="disableDevicePush"
  />

  <MessageModal v-if="modalMessage" :message="modalMessage" @close="modalMessage = ''" />
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import HomeScreen from './components/HomeScreen.vue';
import LoadingScreen from './components/LoadingScreen.vue';
import LoginScreen from './components/LoginScreen.vue';
import ManualScreen from './components/ManualScreen.vue';
import MessageModal from './components/MessageModal.vue';
import MonthScreen from './components/MonthScreen.vue';
import OcrScanner from './components/OcrScanner.vue';
import ProductCatalogScreen from './components/ProductCatalogScreen.vue';
import QrScanner from './components/QrScanner.vue';
import SplitScreen from './components/SplitScreen.vue';
import ShoppingListScreen from './components/ShoppingListScreen.vue';
import {
  addShoppingListItem,
  checkApiReadiness,
  checkReceiptAlreadyAdded,
  clearApiToken,
  createIdempotencyKey,
  fetchCategories,
  fetchProductCategoryMappings,
  formatCalendarDate,
  formatPurchaseDate,
  getApiToken,
  isCurrentMonth,
  mapApiBalance,
  mapApiBalanceItem,
  mapApiDispute,
  mapApiItem,
  mapApiPaymentRequest,
  normalizeProductName,
  normalizePhone,
  postApi,
  saveProductCategoryMapping,
  fetchShoppingList,
  removeShoppingListItem,
  setApiToken,
  requestApi,
} from './lib/api';
import { useNotifications } from './lib/notifications';
import {
  disablePushNotifications,
  enablePushNotifications,
  inspectPushNotifications,
} from './lib/push-notifications';
import { guessProductCategory } from './lib/product-categories';

const screen = ref('login');
const loggedUser = ref(null);
const phone = ref('');
const birthday = ref('');
const items = ref([]);
const shoppingListItems = ref([]);
const shoppingListLoading = ref(false);
const shoppingListError = ref('');
const householdUsers = ref([]);
const categories = ref([]);
const draftItems = ref([]);
const draftReceipt = ref(null);
const receiptPrompt = ref('');
const receiptPromptError = ref('');
const draftSaveIdempotencyKey = ref('');
const product = ref('');
const value = ref('');
const market = ref('');
const purchaseDate = ref(toInputDate(new Date()));
const category = ref('');
const isLoggingIn = ref(false);
const isRequesting = ref(false);
const loadingLabel = ref('Entrando na sua casa...');
const balances = ref([]);
const accumulatedPurchases = ref(null);
const disputes = ref([]);
const contestNotifications = ref([]);
const disputeError = ref('');
const contestNotificationError = ref('');
const paymentNotificationError = ref('');
const balanceItemsById = ref({});
const balanceItemsLoadingId = ref('');
const balanceItemsError = ref('');
const monthViewItems = ref([]);
const monthViewDate = ref(new Date());
const monthViewLoading = ref(false);
const monthViewError = ref('');

const showNotifications = ref(false);
const notificationItems = ref([]);
const paymentNotifications = ref([]);
const pushStatus = ref('unknown');
const pushError = ref('');
const pushLoading = ref(false);
const payLoadingId = ref('');
const balanceLoadingId = ref('');
const balanceOffsetKeys = ref({});
const confirmLoadingId = ref('');
const contestLoadingId = ref('');
const modalMessage = ref('');
const notifications = useNotifications();
let notificationRefreshTimer;
let monthLoadRequestId = 0;

const currentDate = ref(new Date());
const currentMonthItems = computed(() => items.value.filter((item) => isCurrentMonth(item.date, currentDate.value)));
const catalogProducts = computed(() => {
  const productsByCategory = new Map();
  items.value.forEach((item) => {
    const category = categories.value.find((entry) => entry.name === item.category);
    if (!category || !item.product.trim()) return;
    const key = `${normalizeProductName(item.product)}:${category.id}`;
    const existing = productsByCategory.get(key);
    productsByCategory.set(key, {
      key,
      product: item.product,
      categoryId: category.id,
      saved: Boolean(item.categoryMapped) || Boolean(existing?.saved),
    });
  });
  return [...productsByCategory.values()];
});
const total = computed(() => currentMonthItems.value.reduce((sum, item) => sum + item.value, 0));
const defaultCategoryName = computed(
  () => categories.value.find((item) => item.name === 'Outros')?.name || categories.value[0]?.name || '',
);

onMounted(() => {
  if (getApiToken()) void restoreSession();
  notificationRefreshTimer = window.setInterval(() => {
    currentDate.value = new Date();
    if (!loggedUser.value || showNotifications.value) return;
    void refreshPendingNotifications();
  }, 30000);
});

onUnmounted(() => {
  window.clearInterval(notificationRefreshTimer);
});

function showMessage(message) {
  modalMessage.value = message;
}

function toInputDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateForMonth(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(year, monthNumber - 1, 1);
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function isHttpUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

async function wakeApi() {
  try {
    await checkApiReadiness();
  } catch (error) {
    console.warn('API readiness check failed while opening login:', error);
  }
}

async function refreshShoppingList() {
  shoppingListLoading.value = true;
  shoppingListError.value = '';
  try {
    shoppingListItems.value = await fetchShoppingList();
  } catch (error) {
    shoppingListError.value =
      error instanceof Error ? error.message : 'Não foi possível carregar a lista de compras.';
  } finally {
    shoppingListLoading.value = false;
  }
}

async function openShoppingList() {
  screen.value = 'shopping-list';
  await refreshShoppingList();
}

async function openCatalog() {
  if (isRequesting.value) return;
  isRequesting.value = true;
  try {
    const loadedCategories = await fetchCategories();
    if (!loadedCategories.length) throw new Error('Nenhuma categoria foi cadastrada no banco de dados.');
    categories.value = loadedCategories;
    screen.value = 'catalog';
  } catch (error) {
    showMessage(error instanceof Error ? error.message : 'Não foi possível carregar as categorias do banco.');
  } finally {
    isRequesting.value = false;
  }
}

async function addShoppingItem(productName, onSuccess) {
  if (isRequesting.value) return;
  isRequesting.value = true;
  try {
    const item = await addShoppingListItem(productName);
    shoppingListItems.value = [item, ...shoppingListItems.value];
    onSuccess?.();
  } catch (error) {
    showMessage(error instanceof Error ? error.message : 'Não foi possível adicionar o item.');
  } finally {
    isRequesting.value = false;
  }
}

async function removeShoppingItem(itemId) {
  if (isRequesting.value) return;
  isRequesting.value = true;
  try {
    await removeShoppingListItem(itemId);
    shoppingListItems.value = shoppingListItems.value.filter((item) => item.id !== itemId);
  } catch (error) {
    showMessage(error instanceof Error ? error.message : 'Não foi possível remover o item da lista.');
  } finally {
    isRequesting.value = false;
  }
}

function toApiDate(value) {
  const text = String(value ?? '').trim();
  const isoDate = text.match(/^(\d{4}-\d{2}-\d{2})(?:$|T)/);
  if (isoDate) return isoDate[1];
  const brazilianDate = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brazilianDate) return `${brazilianDate[3]}-${brazilianDate[2]}-${brazilianDate[1]}`;
  throw new Error('A data da compra é inválida. Revise a data e tente novamente.');
}

function importedReceiptDate(value) {
  const formattedDate = formatPurchaseDate(value || formatCalendarDate());
  const match = formattedDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return formatCalendarDate();
  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? formattedDate
    : formatCalendarDate();
}

function refreshNotifications() {
  notifications.refresh(loggedUser.value?.id, items.value);
}

async function openNotifications() {
  if (showNotifications.value) {
    showNotifications.value = false;
    return;
  }
  await Promise.all([refreshDisputes(), refreshPendingNotifications(), refreshPushStatus()]);
  notificationItems.value = [...notifications.unreadItems.value, ...paymentNotifications.value, ...contestNotifications.value];
  showNotifications.value = true;
  notifications.markAllSeen(loggedUser.value.id, items.value);
}

async function refreshPushStatus() {
  pushError.value = '';
  try {
    const state = await inspectPushNotifications();
    pushStatus.value = state.status;
  } catch (error) {
    pushStatus.value = 'error';
    pushError.value = error instanceof Error ? error.message : 'Não foi possível verificar as notificações deste aparelho.';
  }
}

async function enableDevicePush() {
  pushLoading.value = true;
  pushError.value = '';
  try {
    const state = await enablePushNotifications();
    pushStatus.value = state.status;
  } catch (error) {
    pushError.value = error instanceof Error ? error.message : 'Não foi possível ativar as notificações neste aparelho.';
  } finally {
    pushLoading.value = false;
  }
}

async function disableDevicePush() {
  pushLoading.value = true;
  pushError.value = '';
  try {
    await disablePushNotifications();
    pushStatus.value = 'available';
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível desativar as notificações neste aparelho.';
    await refreshPushStatus();
    pushError.value = message;
  } finally {
    pushLoading.value = false;
  }
}

async function refreshPendingNotifications() {
  if (!loggedUser.value) return;
  try {
    const data = await requestApi('/notifications');
    paymentNotifications.value = (data.paymentRequests || []).map(mapApiPaymentRequest);
    contestNotifications.value = (data.disputes || []).map((item) => ({
      ...mapApiDispute(item),
      type: 'contest_request',
    }));
    paymentNotificationError.value = '';
    contestNotificationError.value = '';
  } catch (error) {
    paymentNotificationError.value = error instanceof Error ? error.message : 'Não foi possível carregar as notificações de pagamento.';
    contestNotificationError.value = error instanceof Error ? error.message : 'Não foi possível carregar as notificações de contestação.';
  }
}

async function refreshDisputes() {
  if (!loggedUser.value) return;
  try {
    const data = await requestApi('/disputes');
    if (!Array.isArray(data.disputes)) throw new Error('A API retornou uma lista de contestações inválida.');
    disputes.value = data.disputes.map(mapApiDispute);
    disputeError.value = '';
  } catch (error) {
    disputeError.value = error instanceof Error ? error.message : 'Não foi possível carregar as contestações.';
  }
}

async function refreshBalances() {
  const balancesData = await requestApi('/balances');
  balances.value = (balancesData.balances || []).map(mapApiBalance);
}

async function loadBalanceItems(balance) {
  if (!loggedUser.value) return;
  const balanceId = String(balance.id);
  if (Object.prototype.hasOwnProperty.call(balanceItemsById.value, balanceId)) return;
  balanceItemsError.value = '';
  balanceItemsLoadingId.value = balanceId;
  try {
    const data = await requestApi(`/balances/${encodeURIComponent(balanceId)}/items`);
    if (!Array.isArray(data.items)) {
      throw new Error('A API retornou uma lista de itens inválida.');
    }
    balanceItemsById.value = {
      ...balanceItemsById.value,
      [balanceId]: {
        items: data.items.map(mapApiBalanceItem),
        adjustments: (data.adjustments || []).map((adjustment) => ({
          id: String(adjustment.id || ''),
          value: Number(adjustment.amountCents != null ? adjustment.amountCents / 100 : adjustment.value) || 0,
          date: String(adjustment.createdAt || adjustment.date || ''),
        })),
      },
    };
  } catch (error) {
    balanceItemsError.value = error instanceof Error ? error.message : 'Não foi possível carregar os itens do saldo.';
  } finally {
    balanceItemsLoadingId.value = '';
  }
}

async function balanceDebts(balance) {
  if (!loggedUser.value || isRequesting.value) return;
  isRequesting.value = true;
  balanceLoadingId.value = String(balance.id);
  try {
    const balanceId = String(balance.id);
    const idempotencyKey = balanceOffsetKeys.value[balanceId] || (balanceOffsetKeys.value[balanceId] = createIdempotencyKey());
    await postApi(`/balances/${encodeURIComponent(balanceId)}/offset`, {}, { idempotencyKey });
    balanceItemsById.value = {};
    await refreshBalances();
    const updatedPair = balances.value.filter(
      (entry) =>
        String(entry.id) === String(balance.id) ||
        (String(entry.debtorId) === String(balance.creditorId) && String(entry.creditorId) === String(balance.debtorId)),
    );
    for (const updatedBalance of updatedPair) {
      await loadBalanceItems(updatedBalance);
    }
    const nextOffsetKeys = { ...balanceOffsetKeys.value };
    delete nextOffsetKeys[balanceId];
    balanceOffsetKeys.value = nextOffsetKeys;
    showMessage('Contas balanceadas com sucesso.');
  } catch (error) {
    showMessage(error instanceof Error ? error.message : 'Não foi possível balancear as contas.');
  } finally {
    isRequesting.value = false;
    balanceLoadingId.value = '';
  }
}

async function login() {
  if (isLoggingIn.value) return;
  isLoggingIn.value = true;
  isRequesting.value = true;
  loadingLabel.value = 'Entrando na sua casa...';
  screen.value = 'loading';
  try {
    if (!normalizePhone(phone.value) || !birthday.value.trim()) {
      throw new Error('Informe seu telefone e sua data de aniversário.');
    }
    const session = await postApi(
      '/auth/login',
      { phone: normalizePhone(phone.value), birthday: birthday.value.trim() },
      { authenticated: false, idempotency: false },
    );
    setApiToken(session.accessToken);
    if (!session.user?.id || !session.user?.name) throw new Error('A API retornou uma sessão incompleta.');
    await initializeSession(session.user);
  } catch (error) {
    clearApiToken();
    loggedUser.value = null;
    screen.value = 'login';
    showMessage(error instanceof Error ? error.message : 'Verifique sua conexão e os dados.');
  } finally {
    isLoggingIn.value = false;
    isRequesting.value = false;
  }
}

async function restoreSession() {
  isRequesting.value = true;
  loadingLabel.value = 'Carregando sua casa...';
  screen.value = 'loading';
  try {
    const session = await requestApi('/auth/me');
    await initializeSession(session.user);
  } catch (error) {
    if (error?.status === 401) {
      clearApiToken();
      screen.value = 'login';
    } else {
      loggedUser.value = null;
      screen.value = 'login';
      showMessage(error instanceof Error ? error.message : 'Não foi possível restaurar a sessão.');
    }
  } finally {
    isRequesting.value = false;
  }
}

async function initializeSession(user) {
  loggedUser.value = user;
  const month = `${currentDate.value.getFullYear()}-${String(currentDate.value.getMonth() + 1).padStart(2, '0')}`;
  const [loadedCategories, bootstrap, household] = await Promise.all([
    fetchCategories(),
    requestApi(`/bootstrap?month=${month}`),
    requestApi('/household/users'),
  ]);
  if (!loadedCategories.length) throw new Error('Nenhuma categoria foi cadastrada no banco de dados.');
  if (!Array.isArray(household.users) || !household.users.some((member) => String(member.id) === String(user.id))) {
    throw new Error('A API não retornou os moradores da casa.');
  }
  categories.value = loadedCategories;
  householdUsers.value = household.users.map((member) => ({ id: String(member.id), name: String(member.name) }));
  await applyBootstrap(bootstrap, month);
  balanceItemsById.value = {};
  balanceOffsetKeys.value = {};
  await Promise.all([refreshDisputes(), refreshPendingNotifications()]);
  refreshNotifications();
  screen.value = 'home';
}

async function applyBootstrap(bootstrap, month) {
  const loadedItems = [...(bootstrap.items || [])];
  let cursor = bootstrap.itemsNextCursor;
  while (cursor) {
    const page = await requestApi(`/items?month=${month}&cursor=${encodeURIComponent(cursor)}&limit=100`);
    loadedItems.push(...(page.items || []));
    cursor = page.nextCursor;
  }
  const mappedItems = loadedItems.map(mapApiItem);
  items.value = await categorizeItems(mappedItems);
  balances.value = (bootstrap.balances || []).map(mapApiBalance);
  const accumulated = bootstrap.accumulatedPurchases;
  if (accumulated === undefined || accumulated === null) {
    accumulatedPurchases.value = null;
  } else {
    if (
      typeof accumulated !== 'object' ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(accumulated.fromMonth || '')) ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(accumulated.toMonth || '')) ||
      !Number.isSafeInteger(accumulated.amountCents) ||
      accumulated.amountCents < 0 ||
      !Array.isArray(accumulated.openMonths) ||
      accumulated.openMonths.some(
        (month) => !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month)),
      )
    ) {
      throw new Error('A API retornou um resumo acumulado de compras inválido.');
    }
    accumulatedPurchases.value = {
      fromMonth: accumulated.fromMonth,
      toMonth: accumulated.toMonth,
      amountCents: accumulated.amountCents,
      openMonths: accumulated.openMonths,
    };
  }
}

async function categorizeItems(mappedItems) {
  const productMappings = await fetchProductCategoryMappings(
    mappedItems.map((item) => item.product),
  );
  return mappedItems.map((item) => ({
    ...item,
    categoryMapped:
      Boolean(productMappings.get(normalizeProductName(item.product))) ||
      Boolean(
        item.category &&
          normalizeProductName(item.category) !==
            normalizeProductName(defaultCategoryName.value),
      ),
    categorySuggested:
      !productMappings.get(normalizeProductName(item.product)) &&
      !(
        item.category &&
        normalizeProductName(item.category) !== normalizeProductName(defaultCategoryName.value)
      ) &&
      Boolean(guessProductCategory(item.product, categories.value)),
    category:
      productMappings.get(normalizeProductName(item.product))?.categoryName ||
      (item.category &&
      normalizeProductName(item.category) !== normalizeProductName(defaultCategoryName.value)
        ? item.category
        : guessProductCategory(item.product, categories.value) || item.category || defaultCategoryName.value),
  }));
}

function openMonth() {
  monthLoadRequestId += 1;
  monthViewDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth(), 1);
  monthViewItems.value = currentMonthItems.value;
  monthViewLoading.value = false;
  monthViewError.value = '';
  screen.value = 'month';
}

async function loadMonthView(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    showMessage('Selecione um mês válido.');
    return;
  }
  const requestId = ++monthLoadRequestId;
  const selectedDate = dateForMonth(month);
  monthViewDate.value = selectedDate;
  monthViewError.value = '';
  if (month === monthKey(currentDate.value)) {
    monthViewItems.value = currentMonthItems.value;
    monthViewLoading.value = false;
    return;
  }
  monthViewItems.value = [];
  monthViewLoading.value = true;
  try {
    const loadedItems = [];
    let cursor = '';
    do {
      const query = new URLSearchParams({ month, limit: '100' });
      if (cursor) query.set('cursor', cursor);
      const page = await requestApi(`/items?${query}`);
      if (!Array.isArray(page.items)) throw new Error('A API retornou uma lista de compras inválida.');
      loadedItems.push(...page.items.map(mapApiItem));
      cursor = String(page.nextCursor || '');
    } while (cursor && requestId === monthLoadRequestId);
    if (requestId !== monthLoadRequestId) return;
    monthViewItems.value = await categorizeItems(loadedItems);
  } catch (error) {
    if (requestId !== monthLoadRequestId) return;
    monthViewError.value = error instanceof Error ? error.message : 'Não foi possível carregar as compras deste mês.';
  } finally {
    if (requestId === monthLoadRequestId) monthViewLoading.value = false;
  }
}

function startQrImport() {
  if (!loggedUser.value) return;
  draftReceipt.value = null;
  receiptPrompt.value = '';
  receiptPromptError.value = '';
  screen.value = 'scanner';
}

function startOcrImport() {
  if (!loggedUser.value) return;
  draftReceipt.value = null;
  receiptPrompt.value = '';
  receiptPromptError.value = '';
  screen.value = 'ocr';
}

async function readNf(qrCode) {
  if (!loggedUser.value || isRequesting.value) return;
  isRequesting.value = true;
  loadingLabel.value = 'Lendo a NFC-e...';
  screen.value = 'loading';
  try {
    draftSaveIdempotencyKey.value = '';
    draftReceipt.value = null;
    receiptPrompt.value = '';
    receiptPromptError.value = '';
    const [data, loadedCategories] = await Promise.all([
      postApi('/imports/nfce/qr', { qrCode }, { idempotency: false }),
      fetchCategories(),
    ]);
    if (!loadedCategories.length) {
      throw new Error('Nenhuma categoria foi cadastrada no banco de dados.');
    }
    categories.value = loadedCategories;
    const receiptUrl = isHttpUrl(data.receiptUrl || data.receiptLink || qrCode)
      ? String(data.receiptUrl || data.receiptLink || qrCode)
      : '';
    const receiptIdentifier = /^\d{44}$/.test(String(data.receiptIdentifier || ''))
      ? String(data.receiptIdentifier)
      : '';
    const receiptGroupId = createIdempotencyKey();
    const receiptDate = importedReceiptDate(data.date);
    const parsedItems = (data.items || [])
      .map((item, index) => ({
        id: `nf-${Date.now()}-${index}`,
        receiptGroupId,
        product: String(item.product ?? item.Produto ?? ''),
        value: Number(item.value ?? item.Valor_Total ?? item.valor ?? 0),
        market: data.market || String(item.market ?? item.Mercado ?? 'NFC-e'),
        date: receiptDate,
        receiptUrl,
        ...(receiptIdentifier ? { receiptIdentifier } : {}),
        buyerId: loggedUser.value.id,
        sharedWith: [loggedUser.value.id],
        paidWith: [],
      }))
      .filter((item) => item.product && item.value > 0);

    if (!parsedItems.length) throw new Error('A NFC-e não retornou produtos.');
    draftReceipt.value = {
      id: receiptGroupId,
      date: receiptDate,
      receiptUrl,
      receiptIdentifier,
    };
    if (receiptIdentifier) {
      try {
        const alreadyAdded = await checkReceiptAlreadyAdded(receiptIdentifier);
        receiptPrompt.value = alreadyAdded ? 'duplicate' : '';
      } catch (error) {
        receiptPrompt.value = 'unverified';
        receiptPromptError.value =
          error instanceof Error ? error.message : 'Não foi possível verificar a nota.';
      }
    }
    const productMappings = await fetchProductCategoryMappings(
      parsedItems.map((item) => item.product),
    );
    draftItems.value = parsedItems.map((item) => {
      const mapping = productMappings.get(normalizeProductName(item.product));
      const suggestedCategory = guessProductCategory(item.product, categories.value);
      return {
        ...item,
        category: mapping?.categoryName || suggestedCategory || defaultCategoryName.value,
        categoryMapped: Boolean(mapping),
        categorySuggested: !mapping && Boolean(suggestedCategory),
      };
    });
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
    draftSaveIdempotencyKey.value = '';
    draftReceipt.value = null;
    receiptPrompt.value = '';
    receiptPromptError.value = '';
    const [data, loadedCategories] = await Promise.all([
      postApi(
        '/imports/receipt/ocr',
        {
          imageBase64,
          mimeType,
        },
        { idempotency: false },
      ),
      fetchCategories(),
    ]);
    if (!loadedCategories.length) {
      throw new Error('Nenhuma categoria foi cadastrada no banco de dados.');
    }
    categories.value = loadedCategories;
    const receiptUrl = isHttpUrl(data.receiptUrl || data.receiptLink)
      ? String(data.receiptUrl || data.receiptLink)
      : '';
    const receiptIdentifier = /^\d{44}$/.test(String(data.receiptIdentifier || ''))
      ? String(data.receiptIdentifier)
      : '';
    const receiptGroupId = createIdempotencyKey();
    const receiptDate = importedReceiptDate(data.date);
    const parsedItems = (data.items || [])
      .map((item, index) => ({
        id: `ocr-${Date.now()}-${index}`,
        receiptGroupId,
        product: String(item.product ?? item.Produto ?? ''),
        value: Number(item.value ?? item.Valor_Total ?? item.valor ?? 0),
        market: data.market || String(item.market ?? item.Mercado ?? 'Compra por OCR'),
        date: receiptDate,
        receiptUrl,
        ...(receiptIdentifier ? { receiptIdentifier } : {}),
        buyerId: loggedUser.value.id,
        sharedWith: [loggedUser.value.id],
        paidWith: [],
      }))
      .filter((item) => item.product && item.value > 0);

    if (!parsedItems.length) throw new Error('O OCR não encontrou produtos. Confira a foto e tente novamente.');
    draftReceipt.value = {
      id: receiptGroupId,
      date: receiptDate,
      receiptUrl,
      receiptIdentifier,
    };
    if (receiptIdentifier) {
      try {
        const alreadyAdded = await checkReceiptAlreadyAdded(receiptIdentifier);
        receiptPrompt.value = alreadyAdded ? 'duplicate' : '';
      } catch (error) {
        receiptPrompt.value = 'unverified';
        receiptPromptError.value =
          error instanceof Error ? error.message : 'Não foi possível verificar a nota.';
      }
    }
    const productMappings = await fetchProductCategoryMappings(
      parsedItems.map((item) => item.product),
    );
    draftItems.value = parsedItems.map((item) => {
      const mapping = productMappings.get(normalizeProductName(item.product));
      const suggestedCategory = guessProductCategory(item.product, categories.value);
      return {
        ...item,
        category: mapping?.categoryName || suggestedCategory || defaultCategoryName.value,
        categoryMapped: Boolean(mapping),
        categorySuggested: !mapping && Boolean(suggestedCategory),
      };
    });
    screen.value = 'split';
  } catch (error) {
    screen.value = 'home';
    showMessage(error instanceof Error ? error.message : 'Confira a foto e tente novamente.');
  } finally {
    isRequesting.value = false;
  }
}

function togglePerson(itemId, userId) {
  draftSaveIdempotencyKey.value = '';
  draftItems.value = draftItems.value.map((item) => {
    if (item.id !== itemId) return item;
    const sharedWith = item.sharedWith.includes(userId)
      ? item.sharedWith.filter((id) => id !== userId)
      : [...item.sharedWith, userId];
    const paidWith = item.paidWith.filter((id) => sharedWith.includes(id));
    const notConsuming = (item.notConsuming || []).filter((id) => sharedWith.includes(id));
    return {
      ...item,
      sharedWith,
      paidWith,
      notConsuming,
      cashContributions: buildCashContributions(item.value, sharedWith, paidWith, item.buyerId),
    };
  });
}

function togglePaidPerson(itemId, userId) {
  draftSaveIdempotencyKey.value = '';
  draftItems.value = draftItems.value.map((item) => {
    if (item.id !== itemId || userId === item.buyerId) return item;
    const paidWith = item.paidWith.includes(userId)
      ? item.paidWith.filter((id) => id !== userId)
      : [...item.paidWith, userId];
    return {
      ...item,
      paidWith,
      cashContributions: buildCashContributions(item.value, item.sharedWith, paidWith, item.buyerId),
    };
  });
}

function toggleNotConsuming(itemId, userId) {
  draftSaveIdempotencyKey.value = '';
  draftItems.value = draftItems.value.map((item) => {
    if (item.id !== itemId || !item.sharedWith.includes(userId)) return item;
    const current = item.notConsuming || [];
    return {
      ...item,
      notConsuming: current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    };
  });
}

function buildCashContributions(value, splitWith, paidWith, buyerId) {
  const totalCents = Math.round((Number(value) + Number.EPSILON) * 100);
  const shares = allocateDraftShares(value, splitWith);
  const contributions = paidWith
    .filter((id) => id !== String(buyerId) && splitWith.includes(id))
    .map((userId) => ({ userId, amountCents: shares.get(userId) || 0 }));
  const paidByOthers = contributions.reduce((total, entry) => total + entry.amountCents, 0);
  const buyerPaidCents = totalCents - paidByOthers;
  if (buyerPaidCents > 0 || contributions.length === 0) {
    contributions.push({ userId: String(buyerId), amountCents: Math.max(0, buyerPaidCents) });
  }
  return contributions;
}

function allocateDraftShares(value, participantIds) {
  const amountCents = Math.round((Number(value) + Number.EPSILON) * 100);
  const uniqueIds = [...new Set(participantIds.map(String))].sort();
  const base = uniqueIds.length ? Math.floor(amountCents / uniqueIds.length) : 0;
  let remainder = uniqueIds.length ? amountCents - base * uniqueIds.length : 0;
  return new Map(
    uniqueIds.map((id) => {
      const cents = base + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
      return [id, cents];
    }),
  );
}

function editDraftItem(itemId, changes) {
  draftItems.value = draftItems.value.map((item) =>
    item.id === itemId
      ? {
          ...item,
          ...changes,
          ...(changes.value !== undefined && item.cashContributions
            ? {
                cashContributions: buildCashContributions(
                  changes.value,
                  item.sharedWith,
                  item.paidWith,
                  item.buyerId,
                ),
              }
            : {}),
        }
      : item,
  );
  draftSaveIdempotencyKey.value = '';
}

function removeDraftItem(itemId) {
  draftItems.value = draftItems.value.filter((item) => item.id !== itemId);
  if (
    draftReceipt.value &&
    !draftItems.value.some((item) => item.receiptGroupId === draftReceipt.value.id)
  ) {
    draftReceipt.value = null;
    receiptPrompt.value = '';
    receiptPromptError.value = '';
  }
  draftSaveIdempotencyKey.value = '';
}

function updateDraftDate(itemId, date) {
  if (!date) return;
  draftItems.value = draftItems.value.map((item) =>
    item.id === itemId ? { ...item, date: formatPurchaseDate(date) } : item,
  );
  draftSaveIdempotencyKey.value = '';
}

function updateReceiptDate(date) {
  if (!draftReceipt.value || !date) return;
  const formattedDate = formatPurchaseDate(date);
  const groupId = draftReceipt.value.id;
  draftReceipt.value = { ...draftReceipt.value, date: formattedDate };
  draftItems.value = draftItems.value.map((item) =>
    item.receiptGroupId === groupId ? { ...item, date: formattedDate } : item,
  );
  draftSaveIdempotencyKey.value = '';
}

function discardReceiptImport() {
  draftItems.value = [];
  draftReceipt.value = null;
  receiptPrompt.value = '';
  receiptPromptError.value = '';
  draftSaveIdempotencyKey.value = '';
  screen.value = 'home';
}

function continueReceiptImport() {
  receiptPrompt.value = '';
  receiptPromptError.value = '';
}

async function updateDraftCategory(productName, categoryName) {
  await persistSelectedProductCategory(productName, categoryName);
}

async function updateSavedItemCategory(productName, categoryName) {
  await persistSelectedProductCategory(productName, categoryName);
}

async function persistSelectedProductCategory(productName, categoryName) {
  if (isRequesting.value) return;
  const selectedCategory = categories.value.find(
    (item) => item.name === categoryName,
  );
  if (!selectedCategory) {
    showMessage('A categoria selecionada não está disponível.');
    return;
  }
  isRequesting.value = true;
  try {
    const mapping = await saveProductCategoryMapping(
      productName,
      selectedCategory.id,
    );
    applyProductCategoryMapping(mapping);
  } catch (error) {
    showMessage(
      error instanceof Error
        ? error.message
        : 'Não foi possível salvar a categoria deste produto.',
    );
  } finally {
    isRequesting.value = false;
  }
}

async function addCatalogProduct(productName, categoryId, onSuccess) {
  const selectedCategory = categories.value.find((item) => item.id === categoryId);
  if (!selectedCategory) {
    showMessage('A categoria selecionada não está disponível.');
    return;
  }
  if (isRequesting.value) return;
  isRequesting.value = true;
  try {
    const mapping = await saveProductCategoryMapping(productName, selectedCategory.id);
    applyProductCategoryMapping(mapping);
    onSuccess?.();
  } catch (error) {
    showMessage(error instanceof Error ? error.message : 'Não foi possível cadastrar este produto.');
  } finally {
    isRequesting.value = false;
  }
}

async function updateCatalogProductCategory(productName, categoryId, onComplete) {
  const selectedCategory = categories.value.find((item) => item.id === categoryId);
  if (!selectedCategory) {
    onComplete?.('A categoria selecionada não está disponível.');
    return;
  }
  if (isRequesting.value) {
    onComplete?.('Aguarde a operação atual terminar.');
    return;
  }
  isRequesting.value = true;
  try {
    const mapping = await saveProductCategoryMapping(productName, selectedCategory.id);
    applyProductCategoryMapping(mapping);
    onComplete?.();
  } catch (error) {
    onComplete?.(error instanceof Error ? error.message : 'Não foi possível atualizar a categoria do produto.');
  } finally {
    isRequesting.value = false;
  }
}

function applyProductCategoryMapping(mapping) {
  const normalizedProduct = mapping.normalizedProduct;
  draftSaveIdempotencyKey.value = '';
  draftItems.value = draftItems.value.map((item) =>
    normalizeProductName(item.product) === normalizedProduct
      ? { ...item, category: mapping.categoryName, categoryMapped: true }
      : item,
  );
  items.value = items.value.map((item) =>
    normalizeProductName(item.product) === normalizedProduct
      ? { ...item, category: mapping.categoryName, categoryMapped: true }
      : item,
  );
  monthViewItems.value = monthViewItems.value.map((item) =>
    normalizeProductName(item.product) === normalizedProduct
      ? { ...item, category: mapping.categoryName, categoryMapped: true }
      : item,
  );
}

function startManualItem() {
  draftItems.value = [];
  draftReceipt.value = null;
  receiptPrompt.value = '';
  receiptPromptError.value = '';
  draftSaveIdempotencyKey.value = '';
  category.value = defaultCategoryName.value;
  purchaseDate.value = toInputDate(new Date());
  screen.value = 'manual';
}

function addAnotherManualItem() {
  draftSaveIdempotencyKey.value = '';
  product.value = '';
  value.value = '';
  market.value = '';
  purchaseDate.value = toInputDate(new Date());
  category.value = defaultCategoryName.value;
  screen.value = 'manual';
}

function backFromManual() {
  screen.value = draftItems.value.length ? 'split' : 'home';
}

async function saveDraft() {
  if (isRequesting.value) return;
  if (!draftItems.value.length) {
    showMessage('Adicione ao menos um produto antes de salvar a compra.');
    return;
  }
  if (draftItems.value.some((item) => item.sharedWith.length === 0 || item.sharedWith.every((id) => (item.notConsuming || []).includes(id)))) {
    showMessage('Cada item precisa ter pelo menos uma pessoa.');
    return;
  }
  isRequesting.value = true;
  loadingLabel.value = 'Salvando divisão...';
  screen.value = 'loading';
  try {
    const itemsToSave = draftItems.value.map((item) => ({
      ...item,
      category: item.category || defaultCategoryName.value,
    }));
    if (!draftSaveIdempotencyKey.value) draftSaveIdempotencyKey.value = createIdempotencyKey();
    const payload = itemsToSave.map((item) => {
      const valueCents = Math.round((Number(item.value) + Number.EPSILON) * 100);
      if (!Number.isSafeInteger(valueCents) || valueCents <= 0) {
        throw new Error(`O valor de "${item.product}" precisa ser positivo e válido.`);
      }
      return {
        date: toApiDate(item.date),
        market: item.market,
        product: item.product,
        category: item.category,
        valueCents,
        ...(item.receiptUrl ? { receiptUrl: item.receiptUrl } : {}),
        ...(item.receiptIdentifier ? { receiptIdentifier: item.receiptIdentifier } : {}),
        participantIds: item.sharedWith.filter((id) => !(item.notConsuming || []).includes(id)),
        paidDirectlyBy: item.paidWith,
        cashContributions: item.cashContributions || [
          {
            userId: String(item.buyerId),
            amountCents: valueCents,
          },
        ],
      };
    });
    await postApi('/items/batch', { items: payload }, { idempotencyKey: draftSaveIdempotencyKey.value });
    balanceItemsById.value = {};
    await reloadDashboard();
    draftItems.value = [];
    draftReceipt.value = null;
    receiptPrompt.value = '';
    receiptPromptError.value = '';
    draftSaveIdempotencyKey.value = '';
    screen.value = 'home';
    refreshNotifications();
    showMessage('Compra salva com sucesso.');
  } catch (error) {
    screen.value = 'split';
    showMessage(error instanceof Error ? error.message : 'Não foi possível salvar a compra.');
  } finally {
    isRequesting.value = false;
  }
}

async function payBalance(balance) {
  if (isRequesting.value) return;
  if (String(balance.debtorId) !== String(loggedUser.value?.id)) {
    showMessage('Somente quem está devendo pode solicitar a quitação desta conta. Atualize os saldos e confira a conta conectada.');
    return;
  }
  isRequesting.value = true;
  payLoadingId.value = String(balance.id);
  try {
    await postApi(`/balances/${encodeURIComponent(balance.id)}/payment-requests`, {}, { idempotencyKey: `payment-request:${balance.id}` });
    await refreshBalances();
    await refreshPendingNotifications();
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
    await postApi(
      `/payment-requests/${encodeURIComponent(notification.id)}/confirm`,
      {},
      { idempotencyKey: `confirm-payment:${notification.id}` },
    );
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

async function requestContest({ balance, item }) {
  if (!loggedUser.value || isRequesting.value) return;
  isRequesting.value = true;
  contestLoadingId.value = String(item.id);
  try {
    await postApi(
      `/balances/${encodeURIComponent(balance.id)}/disputes`,
      { itemId: item.id },
      { idempotencyKey: `dispute:${balance.id}:${item.id}` },
    );
    await Promise.all([refreshBalances(), refreshDisputes(), refreshPendingNotifications()]);
    notificationItems.value = [
      ...notificationItems.value.filter((notification) => notification.type !== 'contest_request'),
      ...contestNotifications.value,
    ];
    showMessage('Contestação enviada. A outra pessoa receberá uma notificação para aceitar ou recusar.');
  } catch (error) {
    showMessage(error instanceof Error ? error.message : 'Não foi possível contestar este item.');
  } finally {
    isRequesting.value = false;
    contestLoadingId.value = '';
  }
}

async function resolveContest(notification, decision) {
  if (!loggedUser.value || isRequesting.value) return;
  isRequesting.value = true;
  contestLoadingId.value = String(notification.id);
  try {
    await postApi(
      `/disputes/${encodeURIComponent(notification.id)}/resolve`,
      { decision },
      { idempotencyKey: `resolve-dispute:${notification.id}:${decision}` },
    );
    await Promise.all([refreshBalances(), refreshDisputes(), refreshPendingNotifications()]);
    notificationItems.value = notificationItems.value.filter((item) => item.id !== notification.id);
    showMessage(
      decision === 'accepted'
        ? 'Contestação aceita. O valor foi removido do saldo devedor.'
        : 'Contestação recusada. O valor continua no saldo devedor.',
    );
  } catch (error) {
    showMessage(error instanceof Error ? error.message : 'Não foi possível responder à contestação.');
  } finally {
    isRequesting.value = false;
    contestLoadingId.value = '';
  }
}

function updateManualProduct(productName) {
  product.value = productName;
  const suggestedCategory = guessProductCategory(productName, categories.value);
  category.value = suggestedCategory || defaultCategoryName.value;
}

async function addManualItem() {
  const parsedValue = Number(value.value.replace(',', '.'));
  if (!product.value.trim() || !Number.isFinite(parsedValue) || parsedValue <= 0 || !loggedUser.value) {
    showMessage('Informe o produto e um valor maior que zero.');
    return;
  }
  if (isRequesting.value) return;
  isRequesting.value = true;
  let savedMapping;
  try {
    const mappings = await fetchProductCategoryMappings([product.value.trim()]);
    savedMapping = mappings.get(normalizeProductName(product.value));
  } catch (error) {
    showMessage(
      error instanceof Error
        ? error.message
        : 'Não foi possível consultar a categoria já salva para este produto.',
    );
    isRequesting.value = false;
    return;
  }
  const suggestedCategory = guessProductCategory(product.value, categories.value);
  draftItems.value = [
    ...draftItems.value,
    {
      id: `manual-${Date.now()}-${draftItems.value.length}`,
      product: product.value.trim(),
      category: savedMapping?.categoryName || category.value || suggestedCategory || defaultCategoryName.value,
      categoryMapped: Boolean(savedMapping),
      categorySuggested: !savedMapping && Boolean(suggestedCategory),
      value: parsedValue,
      market: market.value.trim() || 'Compra manual',
      date: formatPurchaseDate(purchaseDate.value || toInputDate(new Date())),
      buyerId: loggedUser.value.id,
      sharedWith: [loggedUser.value.id],
      paidWith: [],
    },
  ];
  draftSaveIdempotencyKey.value = '';
  product.value = '';
  value.value = '';
  market.value = '';
  purchaseDate.value = toInputDate(new Date());
  category.value = '';
  screen.value = 'split';
  isRequesting.value = false;
}

async function logout() {
  const logoutErrors = [];
  if (getApiToken()) {
    try {
      await disablePushNotifications();
    } catch (error) {
      logoutErrors.push(
        error instanceof Error
          ? `Não foi possível remover este aparelho das notificações: ${error.message}`
          : 'Não foi possível remover este aparelho das notificações.',
      );
    }
    try {
      await postApi('/auth/logout', {}, { idempotency: false });
    } catch (error) {
      logoutErrors.push(
        error instanceof Error ? error.message : 'Não foi possível encerrar a sessão no servidor.',
      );
    }
  }
  clearApiToken();
  loggedUser.value = null;
  householdUsers.value = [];
  items.value = [];
  accumulatedPurchases.value = null;
  draftReceipt.value = null;
  receiptPrompt.value = '';
  receiptPromptError.value = '';
  monthViewItems.value = [];
  monthViewLoading.value = false;
  monthViewError.value = '';
  monthLoadRequestId += 1;
  shoppingListItems.value = [];
  balances.value = [];
  disputes.value = [];
  paymentNotifications.value = [];
  contestNotifications.value = [];
  pushStatus.value = 'unknown';
  pushError.value = '';
  balanceItemsById.value = {};
  balanceOffsetKeys.value = {};
  showNotifications.value = false;
  screen.value = 'login';
  if (logoutErrors.length) showMessage(`Sessão encerrada neste dispositivo, mas ocorreram erros: ${logoutErrors.join(' ')}`);
}

async function reloadDashboard() {
  const month = `${currentDate.value.getFullYear()}-${String(currentDate.value.getMonth() + 1).padStart(2, '0')}`;
  const bootstrap = await requestApi(`/bootstrap?month=${month}`);
  await applyBootstrap(bootstrap, month);
  await Promise.all([refreshDisputes(), refreshPendingNotifications()]);
}
</script>
