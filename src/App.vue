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
    :disabled="isRequesting"
    @toggle="togglePerson"
    @toggle-paid="togglePaidPerson"
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
    :categories="categories"
    @back="backFromManual"
    @add="addManualItem"
  />

  <MonthScreen
    v-else-if="screen === 'month'"
    :items="currentMonthItems"
    :categories="categories"
    :users="householdUsers"
    :current-date="currentDate"
    :current-user-id="String(loggedUser.id)"
    :disabled="isRequesting"
    @back="screen = 'home'"
    @category="updateSavedItemCategory"
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
    :disputes="disputes"
    :balance-items="balanceItemsById"
    :balance-items-loading-id="balanceItemsLoadingId"
    :balance-items-error="balanceItemsError"
    :disabled="isRequesting"
    :unread-count="notifications.unreadCount.value + paymentNotifications.length + contestNotifications.length"
    :show-notifications="showNotifications"
    :notification-items="notificationItems"
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
    @month="screen = 'month'"
    @logout="logout"
    @open-notifications="openNotifications"
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
import QrScanner from './components/QrScanner.vue';
import SplitScreen from './components/SplitScreen.vue';
import ShoppingListScreen from './components/ShoppingListScreen.vue';
import {
  addShoppingListItem,
  checkApiReadiness,
  clearApiToken,
  createIdempotencyKey,
  fetchCategories,
  fetchProductCategoryMappings,
  formatCalendarDate,
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
const draftSaveIdempotencyKey = ref('');
const product = ref('');
const value = ref('');
const market = ref('');
const category = ref('');
const isLoggingIn = ref(false);
const isRequesting = ref(false);
const loadingLabel = ref('Entrando na sua casa...');
const balances = ref([]);
const disputes = ref([]);
const contestNotifications = ref([]);
const disputeError = ref('');
const contestNotificationError = ref('');
const paymentNotificationError = ref('');
const balanceItemsById = ref({});
const balanceItemsLoadingId = ref('');
const balanceItemsError = ref('');

const showNotifications = ref(false);
const notificationItems = ref([]);
const paymentNotifications = ref([]);
const payLoadingId = ref('');
const balanceLoadingId = ref('');
const balanceOffsetKeys = ref({});
const confirmLoadingId = ref('');
const contestLoadingId = ref('');
const modalMessage = ref('');
const notifications = useNotifications();
let notificationRefreshTimer;

const currentDate = ref(new Date());
const currentMonthItems = computed(() => items.value.filter((item) => isCurrentMonth(item.date, currentDate.value)));
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

function refreshNotifications() {
  notifications.refresh(loggedUser.value?.id, items.value);
}

async function openNotifications() {
  await Promise.all([refreshDisputes(), refreshPendingNotifications()]);
  notificationItems.value = [...notifications.unreadItems.value, ...paymentNotifications.value, ...contestNotifications.value];
  showNotifications.value = true;
  notifications.markAllSeen(loggedUser.value.id, items.value);
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
  const productMappings = await fetchProductCategoryMappings(
    mappedItems.map((item) => item.product),
  );
  items.value = mappedItems.map((item) => ({
    ...item,
    categoryMapped:
      Boolean(productMappings.get(normalizeProductName(item.product))) ||
      Boolean(
        item.category &&
          normalizeProductName(item.category) !==
            normalizeProductName(defaultCategoryName.value),
      ),
    category: productMappings.get(normalizeProductName(item.product))?.categoryName || item.category,
  }));
  balances.value = (bootstrap.balances || []).map(mapApiBalance);
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
    draftSaveIdempotencyKey.value = '';
    const [data, loadedCategories] = await Promise.all([
      postApi('/imports/nfce/qr', { qrCode }, { idempotency: false }),
      fetchCategories(),
    ]);
    if (!loadedCategories.length) {
      throw new Error('Nenhuma categoria foi cadastrada no banco de dados.');
    }
    categories.value = loadedCategories;
    const parsedItems = (data.items || [])
      .map((item, index) => ({
        id: `nf-${Date.now()}-${index}`,
        product: String(item.product ?? item.Produto ?? ''),
        value: Number(item.value ?? item.Valor_Total ?? item.valor ?? 0),
        market: data.market || String(item.market ?? item.Mercado ?? 'NFC-e'),
        date: data.date || String(item.date ?? item.Data ?? formatCalendarDate()),
        buyerId: loggedUser.value.id,
        sharedWith: [loggedUser.value.id],
        paidWith: [],
      }))
      .filter((item) => item.product && item.value > 0);

    if (!parsedItems.length) throw new Error('A NFC-e não retornou produtos.');
    const productMappings = await fetchProductCategoryMappings(
      parsedItems.map((item) => item.product),
    );
    draftItems.value = parsedItems.map((item) => {
      const mapping = productMappings.get(normalizeProductName(item.product));
      return {
        ...item,
        category: mapping?.categoryName || defaultCategoryName.value,
        categoryMapped: Boolean(mapping),
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
    const parsedItems = (data.items || [])
      .map((item, index) => ({
        id: `ocr-${Date.now()}-${index}`,
        product: String(item.product ?? item.Produto ?? ''),
        value: Number(item.value ?? item.Valor_Total ?? item.valor ?? 0),
        market: data.market || String(item.market ?? item.Mercado ?? 'Compra por OCR'),
        date: data.date || String(item.date ?? item.Data ?? formatCalendarDate()),
        buyerId: loggedUser.value.id,
        sharedWith: [loggedUser.value.id],
        paidWith: [],
      }))
      .filter((item) => item.product && item.value > 0);

    if (!parsedItems.length) throw new Error('O OCR não encontrou produtos. Confira a foto e tente novamente.');
    const productMappings = await fetchProductCategoryMappings(
      parsedItems.map((item) => item.product),
    );
    draftItems.value = parsedItems.map((item) => {
      const mapping = productMappings.get(normalizeProductName(item.product));
      return {
        ...item,
        category: mapping?.categoryName || defaultCategoryName.value,
        categoryMapped: Boolean(mapping),
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
  draftItems.value = draftItems.value.map((item) =>
    item.id !== itemId
      ? item
      : {
          ...item,
          sharedWith: item.sharedWith.includes(userId) ? item.sharedWith.filter((id) => id !== userId) : [...item.sharedWith, userId],
          paidWith: item.sharedWith.includes(userId) ? item.paidWith.filter((id) => id !== userId) : item.paidWith,
        },
  );
}

function togglePaidPerson(itemId, userId) {
  draftSaveIdempotencyKey.value = '';
  draftItems.value = draftItems.value.map((item) => {
    if (item.id !== itemId || !item.sharedWith.includes(userId) || userId === item.buyerId) return item;
    return {
      ...item,
      paidWith: item.paidWith.includes(userId) ? item.paidWith.filter((id) => id !== userId) : [...item.paidWith, userId],
    };
  });
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
}

function startManualItem() {
  draftItems.value = [];
  draftSaveIdempotencyKey.value = '';
  category.value = defaultCategoryName.value;
  screen.value = 'manual';
}

function addAnotherManualItem() {
  draftSaveIdempotencyKey.value = '';
  product.value = '';
  value.value = '';
  market.value = '';
  category.value = defaultCategoryName.value;
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
        participantIds: item.sharedWith,
        paidDirectlyBy: item.paidWith,
      };
    });
    await postApi('/items/batch', { items: payload }, { idempotencyKey: draftSaveIdempotencyKey.value });
    balanceItemsById.value = {};
    await reloadDashboard();
    draftItems.value = [];
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

function addManualItem() {
  const parsedValue = Number(value.value.replace(',', '.'));
  if (!product.value.trim() || !Number.isFinite(parsedValue) || parsedValue <= 0 || !loggedUser.value) {
    showMessage('Informe o produto e um valor maior que zero.');
    return;
  }
  draftItems.value = [
    ...draftItems.value,
    {
      id: `manual-${Date.now()}-${draftItems.value.length}`,
      product: product.value.trim(),
      category: category.value || defaultCategoryName.value,
      value: parsedValue,
      market: market.value.trim() || 'Compra manual',
      date: formatCalendarDate(),
      buyerId: loggedUser.value.id,
      sharedWith: [loggedUser.value.id],
      paidWith: [],
    },
  ];
  draftSaveIdempotencyKey.value = '';
  product.value = '';
  value.value = '';
  market.value = '';
  category.value = '';
  screen.value = 'split';
}

async function logout() {
  let logoutError;
  try {
    if (getApiToken()) await postApi('/auth/logout', {}, { idempotency: false });
  } catch (error) {
    logoutError = error instanceof Error ? error.message : 'Não foi possível encerrar a sessão no servidor.';
  } finally {
    clearApiToken();
    loggedUser.value = null;
    householdUsers.value = [];
    items.value = [];
    shoppingListItems.value = [];
    balances.value = [];
    disputes.value = [];
    paymentNotifications.value = [];
    contestNotifications.value = [];
    balanceItemsById.value = {};
    balanceOffsetKeys.value = {};
    showNotifications.value = false;
    screen.value = 'login';
  }
  if (logoutError) showMessage(`Sessão encerrada neste dispositivo, mas houve um erro ao revogá-la no servidor: ${logoutError}`);
}

async function reloadDashboard() {
  const month = `${currentDate.value.getFullYear()}-${String(currentDate.value.getMonth() + 1).padStart(2, '0')}`;
  const bootstrap = await requestApi(`/bootstrap?month=${month}`);
  await applyBootstrap(bootstrap, month);
  await Promise.all([refreshDisputes(), refreshPendingNotifications()]);
}
</script>
