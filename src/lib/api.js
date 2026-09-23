// Como VITE_OCR_URL, dá pra sobrescrever isso num .env (dev) ou como
// secret do GitHub Actions (produção). Sem nada configurado, cai no link
// atual do Apps Script.
export const API_URL =
  import.meta.env.VITE_API_URL ||
  'https://script.google.com/macros/s/AKfycbw3iRw-w2uBXICRtcX99n-wMbURt-gvVlEV4P9b2SpFa-VtL0iY4mM8ryUnnFxxScN-/exec';

// Em produção (GitHub Pages) defina VITE_OCR_URL num arquivo .env antes do
// build, apontando para onde o serviço de OCR estiver hospedado — localhost
// só funciona em desenvolvimento local.
const OCR_BASE_URL = import.meta.env.VITE_OCR_URL || 'http://localhost:8000';
export const OCR_URL = OCR_BASE_URL.replace(/\/$/, '').endsWith('/ocr')
  ? OCR_BASE_URL.replace(/\/$/, '')
  : `${OCR_BASE_URL.replace(/\/$/, '')}/ocr`;

export const money = (value) => `R$ ${Number(value).toFixed(2).replace('.', ',')}`;

export const formatPaidDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('pt-BR');
};

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

export const requestApi = async (query, options) => {
  const response = await fetch(`${API_URL}${query}`, options);
  const data = await response.json();
  if (!response.ok || data.success === false) throw new Error(data.message || 'Não foi possível acessar a planilha.');
  return data;
};

export const parseParticipantIds = (value) => {
  const values = Array.isArray(value) ? value : [value];
  return values
    .flatMap((entry) => String(entry ?? '').split(/[,.;\s]+/))
    .map((id) => id.trim())
    .filter(Boolean);
};

export const mapApiItem = (item) => ({
  id: String(item.id ?? item.ID_Item ?? Date.now()),
  product: String(item.product ?? item.Produto ?? ''),
  value: Number(item.value ?? item.Valor_Total ?? 0),
  market: String(item.market ?? item.Mercado ?? ''),
  date: String(item.date ?? item.Data ?? ''),
  buyerId: String(item.buyerId ?? item.Comprador_ID ?? item.Comprador ?? ''),
  sharedWith: parseParticipantIds(item.sharedWith ?? item.Pertence_A),
});

export const mapApiBalance = (balance) => ({
  id: String(balance.id ?? balance.ID ?? `${balance.debtorId}-${balance.creditorId}`),
  debtorId: String(balance.debtorId ?? balance.Devedor_ID ?? ''),
  creditorId: String(balance.creditorId ?? balance.Credor_ID ?? ''),
  value: Number(balance.value ?? balance.Valor ?? 0),
  status: String(balance.status ?? balance.Status ?? 'Pendente'),
  paidAt: String(balance.paidAt ?? balance.Data_Pagamento ?? ''),
});

export const calculateBalances = (items) => {
  const totals = {};
  items.forEach((item) => {
    const share = item.sharedWith.length ? item.value / item.sharedWith.length : item.value;
    item.sharedWith.filter((id) => id !== item.buyerId).forEach((debtorId) => {
      const key = `${debtorId}-${item.buyerId}`;
      totals[key] = totals[key] || { id: key, debtorId, creditorId: item.buyerId, value: 0, status: 'Pendente' };
      totals[key].value += share;
    });
  });
  return Object.values(totals);
};

export const isCurrentMonth = (date) => date.includes('09/2026') || date.includes('2026-09') || date.includes('Sep 2026');