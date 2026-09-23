// Como VITE_OCR_URL, dá pra sobrescrever isso num .env (dev) ou como
// secret do GitHub Actions (produção). Sem nada configurado, cai no link
// atual do Apps Script.
export const API_URL =
  import.meta.env.VITE_API_URL ||
  'https://script.google.com/macros/s/AKfycbzHv8SWc51mVQ0NcxjuKWOpCpRZJpWdlrSwKn5VHqb6hDKSo6_evs3IKRA2MS8-MkHK/exec';

// Em produção (GitHub Pages) defina VITE_OCR_URL num arquivo .env antes do
// build, apontando para onde o serviço de OCR estiver hospedado — localhost
// só funciona em desenvolvimento local.
const OCR_BASE_URL = import.meta.env.VITE_OCR_URL || 'http://localhost:8000';
export const OCR_URL = OCR_BASE_URL.replace(/\/$/, '').endsWith('/ocr')
  ? OCR_BASE_URL.replace(/\/$/, '')
  : `${OCR_BASE_URL.replace(/\/$/, '')}/ocr`;

export const money = (value) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
}).format(Number(value) || 0);

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

export const postApi = (payload) => requestApi('', {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
  body: JSON.stringify(payload),
});

export const productGroups = [
  {
    name: 'Carnes',
    color: '#d96c55',
    terms: [
      'carne', 'bovina', 'suina', 'frango', 'galinha', 'peru', 'pato', 'peito', 'asa', 'coxa', 'sobrecoxa',
      'bife', 'file', 'alcatra', 'contrafile', 'contra file', 'picanha', 'maminha', 'fraldinha', 'costela',
      'coxao mole', 'coxao duro', 'acem', 'acém', 'patinho', 'musculo', 'músculo', 'lagarto', 'cupim',
      'carne moida', 'carne moída', 'linguica', 'linguiça', 'salsicha', 'presunto', 'mortadela', 'salame',
      'bacon', 'peixe', 'tilapia', 'tilápia', 'sardinha', 'atum', 'bacalhau', 'camarao', 'camarão', 'marisco',
      'caranguejo', 'lula', 'ovo', 'ovos',
    ],
  },
  {
    name: 'Cereais',
    color: '#d6a84f',
    terms: [
      'arroz', 'feijao', 'feijão', 'lentilha', 'grao de bico', 'grão de bico', 'ervilha seca', 'soja',
      'milho', 'canjica', 'aveia', 'granola', 'cereal', 'quinoa', 'trigo', 'farinha', 'fuba', 'fubá',
      'polvilho', 'tapioca', 'goma', 'macarrao', 'macarrão', 'lasanha', 'massa', 'espaguete', 'talharim',
      'cuscuz', 'pao', 'pão', 'bisnaga', 'torrada', 'biscoito', 'bolacha',
    ],
  },
  {
    name: 'Hortaliças',
    color: '#6ca66b',
    terms: [
      'alface', 'rucula', 'rúcula', 'couve', 'espinafre', 'repolho', 'acelga', 'agriao', 'agrião', 'coentro',
      'salsinha', 'cebolinha', 'manjericao', 'manjericão', 'hortela', 'hortelã', 'pimentinha', 'pimenta',
      'pimentao', 'pimentão', 'pimenta do reino', 'cebola', 'alho', 'tomate', 'pepino', 'cenoura', 'batata',
      'batata doce', 'mandioca', 'macaxeira', 'inhame', 'beterraba', 'abobora', 'abóbora', 'chuchu',
      'berinjela', 'quiabo', 'vagem', 'ervilha', 'milho verde', 'brocolis', 'brócolis', 'couve flor',
      'couve-flor', 'aspargo', 'abacate', 'banana', 'maca', 'maçã', 'laranja', 'limao', 'limão', 'manga',
      'mamão', 'mamao', 'melancia', 'melao', 'melão', 'uva', 'pera', 'abacaxi', 'morango', 'fruta', 'legume',
      'verdura', 'hortalica', 'hortaliça',
    ],
  },
  {
    name: 'Higiene',
    color: '#7197b7',
    terms: [
      'sabonete', 'shampoo', 'xampu', 'condicionador', 'creme dental', 'pasta dental', 'escova dental',
      'fio dental', 'enxaguante', 'desodorante', 'perfume', 'absorvente', 'fralda', 'lenço umedecido',
      'papel higienico', 'papel higiênico', 'algodao', 'algodão', 'cotonete', 'barbeador', 'lamina', 'lâmina',
      'creme de barbear', 'detergente', 'sabao', 'sabão', 'amaciante', 'alvejante', 'agua sanitaria',
      'água sanitária', 'esponja', 'palha de aco', 'palha de aço', 'saco de lixo', 'limpeza', 'higiene',
  ],
  },
  {
    name: 'Alimentícios',
    color: '#9a7bb5',
    terms: [
      'leite', 'queijo', 'mussarela', 'muçarela', 'requeijao', 'requeijão', 'iogurte', 'manteiga', 'margarina',
      'creme de leite', 'leite condensado', 'nata', 'cafe', 'café', 'acucar', 'açúcar', 'sal', 'oleo', 'óleo',
      'azeite', 'vinagre', 'molho', 'ketchup', 'mostarda', 'maionese', 'tempero', 'caldo', 'extrato de tomate',
      'enlatado', 'conserva', 'palmito', 'azeitona', 'sardinha', 'suco', 'refrigerante', 'agua mineral',
      'água mineral', 'cerveja', 'vinho', 'bebida', 'chocolate', 'achocolatado', 'doce', 'geleia', 'mel',
      'sorvete', 'salgadinho', 'pipoca', 'castanha', 'amendoim', 'nozes',
    ],
  },
  { name: 'Outros', color: '#a99f92', terms: [] },
];

const normalizeProduct = (value) => String(value ?? '')
  .toLocaleLowerCase('pt-BR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

export const classifyProduct = (product) => {
  const normalized = normalizeProduct(product);
  return productGroups.find((group) => group.terms.some((term) => normalized.includes(normalizeProduct(term))))?.name || 'Outros';
};

export const isProductGroup = (value) => productGroups.some((group) => group.name === value);

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
  category: String(item.category ?? item.Categoria ?? item.Grupo ?? ''),
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