const API_BASE_URL = (import.meta.env.VITE_MANDAMONEY_API_URL || (import.meta.env.DEV ? 'http://localhost:3000/api/v1' : '')).replace(
  /\/$/,
  '',
);
const ACCESS_TOKEN_KEY = 'mandamoney_api_access_token';
let accessToken;

export const money = (value) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value) || 0);

export const formatPaidDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('pt-BR');
};

export const formatPurchaseDate = (value) => {
  if (!value) return '';
  const text = String(value).trim();

  const isoDate = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;

  const brazilianDate = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brazilianDate) return text;

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};

export const formatCalendarDate = (date = new Date()) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
};

export const formatTodayLabel = (date = new Date()) => {
  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(date);
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', '');
  const day = date.getDate();
  const year = date.getFullYear();
  return `${weekday.charAt(0).toLocaleUpperCase('pt-BR')}${weekday.slice(1)}, ${day} de ${month} de ${year}`;
};

export const formatMonthName = (date = new Date(), style = 'long') => new Intl.DateTimeFormat('pt-BR', { month: style }).format(date);

export const normalizePhone = (value) => value.replace(/\D/g, '');

export const formatPhone = (value) => {
  const digits = normalizePhone(value).slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3, 7)}-${digits.slice(7)}`;
};

export const formatBirthday = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export const setApiToken = (token) => {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new Error('A API retornou um token de sessão inválido.');
  }
  accessToken = token;
  sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
};

export const getApiToken = () => accessToken || sessionStorage.getItem(ACCESS_TOKEN_KEY) || '';

export const clearApiToken = () => {
  accessToken = '';
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
};

export const createIdempotencyKey = () => {
  if (!globalThis.crypto?.randomUUID) throw new Error('Este navegador não oferece geração segura de chaves para a API.');
  return globalThis.crypto.randomUUID();
};

export const requestApi = async (path, options = {}, { authenticated = true } = {}) => {
  if (!API_BASE_URL) {
    throw new Error('Configure VITE_MANDAMONEY_API_URL com a URL base da API.');
  }
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  if (authenticated) {
    const token = getApiToken();
    if (!token) throw new ApiError('Sua sessão expirou. Entre novamente.', 401, 'UNAUTHORIZED');
    headers.set('Authorization', `Bearer ${token}`);
  }
  const requestUrl = /^https?:\/\//i.test(path) ? path : `${API_BASE_URL}${path}`;
  const response = await fetch(requestUrl, { ...options, headers });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new ApiError('A API retornou uma resposta inválida.', response.status, 'INVALID_RESPONSE');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new ApiError('A API retornou uma resposta inválida.', response.status, 'INVALID_RESPONSE');
  }
  if (response.status === 401 && authenticated) clearApiToken();
  if (!response.ok) {
    const code = data.error?.code || 'API_ERROR';
    const messages = {
      INVALID_REQUEST: 'Os dados informados são inválidos. Confira e tente novamente.',
      FORBIDDEN: 'Você não tem permissão para realizar esta ação.',
      NOT_FOUND: 'O registro não foi encontrado ou você não tem acesso a ele.',
      CONFLICT: 'Os dados mudaram. Atualize a tela e tente novamente.',
      IDEMPOTENCY_CONFLICT: 'Esta operação já foi enviada com dados diferentes.',
      RATE_LIMITED: 'Muitas tentativas em pouco tempo. Aguarde e tente novamente.',
      SERVICE_UNAVAILABLE: 'O serviço está temporariamente indisponível.',
      INTERNAL_ERROR: 'Ocorreu um erro inesperado. Tente novamente.',
    };
    let message = messages[code] || data.error?.message || 'Não foi possível acessar a API.';
    if (code === 'UNAUTHORIZED') {
      if (path === '/auth/login') message = 'Telefone ou data de aniversário incorretos.';
      else message = 'Sua sessão expirou. Entre novamente.';
    } else if (code === 'AUTH_NOT_CONFIGURED') {
      message = 'O acesso ainda não foi configurado no servidor. Verifique LEGACY_AUTH_PEPPER.';
    }
    throw new ApiError(message, response.status, code);
  }
  return data;
};

export const postApi = (path, payload, { authenticated = true, idempotency = true, idempotencyKey } = {}) => {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (idempotency) {
    headers.set('Idempotency-Key', idempotencyKey || createIdempotencyKey());
  }
  return requestApi(path, { method: 'POST', headers, body: JSON.stringify(payload) }, { authenticated });
};

export const checkApiReadiness = () =>
  requestApi(new URL('/health/ready', API_BASE_URL).toString(), {}, { authenticated: false });

export const fetchShoppingList = async () => {
  const data = await requestApi('/shopping-list');
  if (!Array.isArray(data.items)) throw new Error('A API retornou uma lista de compras inválida.');
  return data.items.map((item) => {
    const id = String(item.id ?? '');
    const product = String(item.product ?? '').trim();
    if (!id || !product) throw new Error('A API retornou um item inválido na lista de compras.');
    return {
      id,
      product,
      addedBy: String(item.addedBy ?? ''),
      addedByName: String(item.addedByName ?? '').trim(),
      createdAt: String(item.createdAt ?? ''),
    };
  });
};

export const addShoppingListItem = async (product) => {
  const data = await postApi('/shopping-list', { product: String(product).trim() }, { idempotency: false });
  const item = data.item;
  if (!item?.id || !item?.product || !item?.addedBy) {
    throw new Error('A API não confirmou o item adicionado à lista de compras.');
  }
  return {
    id: String(item.id),
    product: String(item.product),
    addedBy: String(item.addedBy),
    addedByName: String(item.addedByName ?? '').trim(),
    createdAt: String(item.createdAt ?? ''),
  };
};

export const removeShoppingListItem = (itemId) =>
  requestApi(`/shopping-list/${encodeURIComponent(itemId)}`, { method: 'DELETE' });

export const fetchCategories = async () => {
  const data = await requestApi('/categories', {}, { authenticated: false });
  if (!Array.isArray(data.categories)) throw new Error('A API retornou uma lista de categorias inválida.');
  return data.categories.map((category) => {
    const name = String(category.name ?? '').trim();
    const color = String(category.color ?? '');
    if (!category.id || !name || !/^#[0-9a-f]{6}$/i.test(color)) {
      throw new Error('A API retornou uma categoria inválida.');
    }
    return { id: String(category.id), name, color };
  });
};

export const normalizeProductName = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

export const fetchProductCategoryMappings = async (products) => {
  const uniqueProducts = [...new Set(products.map((product) => String(product).trim()).filter(Boolean))];
  const mappings = [];
  for (let index = 0; index < uniqueProducts.length; index += 10) {
    const query = new URLSearchParams();
    uniqueProducts.slice(index, index + 10).forEach((product) => query.append('products', product));
    const data = await requestApi(`/categories/product-mappings?${query}`);
    if (!Array.isArray(data.mappings)) {
      throw new Error('A API retornou uma lista de classificações de produtos inválida.');
    }
    mappings.push(...data.mappings.map((mapping) => {
      const product = String(mapping.product ?? '').trim();
      const normalizedProduct = String(mapping.normalizedProduct ?? '');
      const categoryId = String(mapping.categoryId ?? '');
      const categoryName = String(mapping.categoryName ?? '').trim();
      if (
        !product ||
        !normalizedProduct ||
        !categoryId ||
        !categoryName ||
        normalizeProductName(product) !== normalizedProduct
      ) {
        throw new Error('A API retornou uma classificação de produto inválida.');
      }
      return { product, normalizedProduct, categoryId, categoryName };
    }));
  }
  return new Map(mappings.map((mapping) => [mapping.normalizedProduct, mapping]));
};

export const saveProductCategoryMapping = async (product, categoryId) => {
  const data = await postApi(
    '/categories/product-mappings',
    { product: String(product).trim(), categoryId: String(categoryId) },
    { idempotency: false },
  );
  const mapping = data.mapping;
  if (
    !mapping?.product ||
    !mapping.normalizedProduct ||
    !mapping.categoryId ||
    !mapping.categoryName ||
    normalizeProductName(mapping.product) !== mapping.normalizedProduct
  ) {
    throw new Error('A API não confirmou a classificação salva.');
  }
  return mapping;
};

export const parseParticipantIds = (value) => {
  const values = Array.isArray(value) ? value : [value];
  return values
    .flatMap((entry) => String(entry ?? '').split(/[,.;\s]+/))
    .map((id) => id.trim())
    .filter(Boolean);
};

export const mapApiItem = (item) => {
  const product = String(item.product ?? item.Produto ?? '');
  const savedCategory = String(item.category ?? item.Categoria ?? item.Grupo ?? '').trim();

  return {
    id: String(item.id ?? item.ID_Item ?? Date.now()),
    product,
    category: savedCategory,
    value: Number(item.valueCents != null ? item.valueCents / 100 : (item.value ?? item.Valor_Total ?? 0)),
    market: String(item.market ?? item.Mercado ?? ''),
    date: formatPurchaseDate(item.date ?? item.Data ?? ''),
    buyerId: String(item.buyerId ?? item.Comprador_ID ?? item.Comprador ?? ''),
    sharedWith: parseParticipantIds(item.participantIds ?? item.sharedWith ?? item.Pertence_A),
    paidWith: parseParticipantIds(item.paidDirectlyBy ?? item.paidWith ?? item.Pago_Direto_Por),
  };
};

const balanceStatuses = {
  pending: 'Pendente',
  awaiting_confirmation: 'Aguardando confirmação',
  contest_pending: 'Contestação pendente',
  paid: 'Pago',
  contested: 'Contestado',
  offset: 'Balanceado',
};

export const mapApiBalance = (balance) => ({
  id: String(balance.id ?? balance.ID ?? `${balance.debtorId}-${balance.creditorId}`),
  debtorId: String(balance.debtorId ?? balance.Devedor_ID ?? ''),
  creditorId: String(balance.creditorId ?? balance.Credor_ID ?? ''),
  value: Number(balance.amountCents != null ? balance.amountCents / 100 : (balance.value ?? balance.Valor ?? 0)),
  status: balanceStatuses[String(balance.status ?? '').toLowerCase()] || String(balance.status ?? balance.Status ?? 'Pendente').trim(),
  paidAt: String(balance.paidAt ?? balance.Data_Pagamento ?? ''),
});

export const mapApiDispute = (dispute) => ({
  id: String(dispute.id ?? dispute.ID ?? ''),
  balanceId: String(dispute.balanceId ?? dispute.Saldo_ID ?? ''),
  itemId: String(dispute.itemId ?? dispute.Item_ID ?? ''),
  debtorId: String(dispute.debtorId ?? dispute.Devedor_ID ?? ''),
  creditorId: String(dispute.creditorId ?? dispute.Credor_ID ?? ''),
  value: Number(dispute.amountCents != null ? dispute.amountCents / 100 : (dispute.value ?? dispute.Valor ?? 0)),
  status:
    { pending: 'Pendente', accepted: 'Aceita', rejected: 'Recusada' }[String(dispute.status ?? '').toLowerCase()] ||
    String(dispute.status ?? dispute.Status ?? 'Pendente').trim(),
  requestedAt: String(dispute.requestedAt ?? dispute.Data_Solicitacao ?? ''),
  resolvedAt: String(dispute.resolvedAt ?? dispute.Data_Resolucao ?? ''),
  product: String(dispute.product ?? dispute.Produto ?? ''),
});

export const mapApiBalanceItem = (item) => ({
  itemId: String(item.itemId ?? item.Item_ID ?? ''),
  value: Number(
    item.shareCents != null ? item.shareCents / 100 : item.valueCents != null ? item.valueCents / 100 : (item.value ?? item.Valor ?? 0),
  ),
  product: String(item.product ?? item.Produto ?? ''),
  market: String(item.market ?? item.Mercado ?? ''),
  date: formatPurchaseDate(item.date ?? item.Data ?? ''),
});

export const mapApiPaymentRequest = (request) => ({
  ...request,
  id: String(request.id ?? ''),
  balanceId: String(request.balanceId ?? ''),
  debtorId: String(request.debtorId ?? ''),
  creditorId: String(request.creditorId ?? ''),
  value: Number(request.amountCents != null ? request.amountCents / 100 : (request.value ?? 0)),
  type: 'payment_request',
});

export const calculateBalances = (items) => {
  const totals = {};
  items.forEach((item) => {
    const share = item.sharedWith.length ? item.value / item.sharedWith.length : item.value;
    item.sharedWith
      .filter((id) => id !== item.buyerId && !item.paidWith?.includes(id))
      .forEach((debtorId) => {
        const creditorId = item.buyerId;
        const key = `${debtorId}-${creditorId}`;
        totals[key] = totals[key] || {
          id: key,
          debtorId,
          creditorId,
          value: 0,
          status: 'Pendente',
        };
        totals[key].value += share;
      });
  });
  return Object.values(totals);
};

export const isCurrentMonth = (value, currentDate = new Date()) => {
  const text = String(value ?? '').trim();
  const isoDate = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  const brazilianDate = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const year = Number(isoDate?.[1] ?? brazilianDate?.[3]);
  const month = Number(isoDate?.[2] ?? brazilianDate?.[2]);

  if (Number.isInteger(year) && Number.isInteger(month)) {
    return year === currentDate.getFullYear() && month === currentDate.getMonth() + 1;
  }

  const parsedDate = new Date(text);
  return (
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.getFullYear() === currentDate.getFullYear() &&
    parsedDate.getMonth() === currentDate.getMonth()
  );
};
