import { postApi, requestApi } from './api';

const isIos = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

const isSupported = () =>
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window &&
  window.isSecureContext;

const registerServiceWorker = () =>
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}service-worker.js`);

export async function inspectPushNotifications() {
  if (!isSupported()) return { status: 'unsupported' };
  if (isIos() && !isInstalled()) return { status: 'install-required' };

  const { publicKey } = await requestApi('/push/public-key', {}, { authenticated: false });
  if (!publicKey) return { status: 'not-configured' };
  if (Notification.permission === 'denied') return { status: 'denied' };

  const registration = await registerServiceWorker();
  const subscription = await registration.pushManager.getSubscription();
  return {
    status: subscription && Notification.permission === 'granted' ? 'enabled' : 'available',
  };
}

export async function enablePushNotifications() {
  if (!isSupported()) throw new Error('Este navegador não oferece suporte a notificações push.');
  if (isIos() && !isInstalled()) {
    throw new Error('No iPhone, adicione o Manda Money à Tela de Início e abra o app instalado para ativar notificações.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'A permissão foi bloqueada. Altere as notificações do Manda Money nos ajustes do navegador.'
        : 'A permissão para notificações não foi concedida.',
    );
  }

  const { publicKey } = await requestApi('/push/public-key', {}, { authenticated: false });
  if (!publicKey) throw new Error('As notificações push ainda não foram configuradas no servidor.');

  const registration = await registerServiceWorker();
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeVapidKey(publicKey),
    });
  }
  await postApi('/push/subscriptions', subscription.toJSON(), { idempotency: false });
  return { status: 'enabled' };
}

export async function disablePushNotifications() {
  if (!isSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  let removalError;
  try {
    await requestApi('/push/subscriptions', {
      method: 'DELETE',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
  } catch (error) {
    removalError = error;
  }
  const unsubscribed = await subscription.unsubscribe();
  if (!unsubscribed) throw new Error('O navegador não confirmou a desativação das notificações.');
  if (removalError) throw removalError;
}

function decodeVapidKey(key) {
  const padding = '='.repeat((4 - (key.length % 4)) % 4);
  const base64 = (key + padding).replace(/-/g, '+').replace(/_/g, '/');
  const decoded = window.atob(base64);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}
