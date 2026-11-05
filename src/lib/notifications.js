import { computed, ref } from 'vue';

const SEEN_KEY_PREFIX = 'mandamoney_seen_items_';

// Guardamos no localStorage quais itens cada usuário já viu neste navegador.
// O envio de notificações push para os aparelhos é feito pela API.

function loadSeenIds(userId) {
  try {
    const raw = localStorage.getItem(SEEN_KEY_PREFIX + userId);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveSeenIds(userId, seenSet) {
  try {
    localStorage.setItem(SEEN_KEY_PREFIX + userId, JSON.stringify([...seenSet]));
  } catch {
    // localStorage pode estar indisponível (modo privado, etc.) — ignora.
  }
}

export function useNotifications() {
  const unreadItems = ref([]);
  const unreadCount = computed(() => unreadItems.value.length);

  const refresh = (userId, items) => {
    if (!userId) {
      unreadItems.value = [];
      return;
    }
    const seen = loadSeenIds(userId);
    unreadItems.value = items.filter(
      (item) => item.sharedWith.includes(userId) && item.buyerId !== userId && !seen.has(item.id),
    );
  };

  const markAllSeen = (userId, items) => {
    if (!userId) return;
    const seen = loadSeenIds(userId);
    items.forEach((item) => seen.add(item.id));
    saveSeenIds(userId, seen);
    unreadItems.value = [];
  };

  return { unreadItems, unreadCount, refresh, markAllSeen };
}
