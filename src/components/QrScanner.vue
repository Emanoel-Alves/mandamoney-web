<template>
  <div v-if="permissionState !== 'granted'" class="scanner-permission">
    <h1 class="screen-title">Ler NFC-e</h1>
    <p class="screen-copy">
      {{ cameraMessage }}
    </p>
    <button class="btn-primary" :disabled="requesting" @click="requestCamera">
      <span class="btn-primary-text">{{ requesting ? 'Solicitando acesso...' : 'Permitir acesso à câmera' }}</span>
      <span class="btn-arrow">→</span>
    </button>
    <button class="btn-cancel" @click="$emit('cancel')">Voltar</button>
  </div>

  <div v-else class="scanner-page">
    <video ref="videoEl" class="scanner-video" autoplay playsinline muted></video>
    <canvas ref="canvasEl" style="display: none"></canvas>
    <div class="scanner-overlay">
      <div class="scanner-frame"></div>
      <p class="scanner-title">Aponte para o QR Code da NFC-e</p>
      <p class="scanner-hint">{{ scanHint }}</p>
      <button class="scanner-cancel" @click="$emit('cancel')">Cancelar</button>
    </div>
  </div>
</template>

<script setup>
import jsQR from 'jsqr';
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

const emit = defineEmits(['scan', 'cancel']);

const videoEl = ref(null);
const canvasEl = ref(null);
const permissionState = ref('pending'); // pending | granted | denied
const cameraMessage = ref('Solicitando acesso à câmera para ler o QR Code da nota.');
const requesting = ref(false);
const scanHint = ref('A leitura acontece automaticamente');

let stream = null;
let rafId = null;
let hintTimeoutId = null;
let lastScanTime = 0;
let barcodeDetector = null;
let scanned = false;
let disposed = false;
const scanIntervalMs = 120;
const maxScanDimension = 1600;

async function requestCamera() {
  if (requesting.value) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    permissionState.value = 'denied';
    cameraMessage.value = 'A câmera exige HTTPS. Abra o endereço publicado ou um link HTTPS do túnel no celular.';
    return;
  }

  requesting.value = true;
  try {
    const cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        focusMode: { ideal: 'continuous' },
      },
    });
    if (disposed) {
      cameraStream.getTracks().forEach((track) => track.stop());
      return;
    }
    stream = cameraStream;
    await configureBarcodeDetector();
    if (disposed) {
      cameraStream.getTracks().forEach((track) => track.stop());
      return;
    }
    permissionState.value = 'granted';
    await nextTick();
    if (disposed) return;
    if (!videoEl.value) throw new Error('Elemento de vídeo não foi criado.');
    videoEl.value.srcObject = stream;
    await videoEl.value.play();
    hintTimeoutId = window.setTimeout(() => {
      scanHint.value =
        'Use boa iluminação, evite reflexos e aproxime até o QR ocupar boa parte do quadro.';
    }, 8000);
    tick();
  } catch (error) {
    if (disposed) return;
    permissionState.value = 'denied';
    if (stream) stream.getTracks().forEach((track) => track.stop());
    stream = null;
    cameraMessage.value = `Não foi possível acessar a câmera (${error?.name || 'erro desconhecido'}). Verifique a permissão deste site e tente novamente.`;
  } finally {
    requesting.value = false;
  }
}

async function tick() {
  const video = videoEl.value;
  const canvas = canvasEl.value;
  if (!video || !canvas || scanned) return;

  const now = performance.now();
  if (
    video.readyState === video.HAVE_ENOUGH_DATA &&
    now - lastScanTime >= scanIntervalMs
  ) {
    lastScanTime = now;
    const code = await scanFrame(video, canvas);
    if (code) {
      scanned = true;
      emit('scan', code);
      return;
    }
  }
  if (disposed) return;
  rafId = requestAnimationFrame(tick);
}

async function configureBarcodeDetector() {
  if (!('BarcodeDetector' in window)) return;
  try {
    const formats = await window.BarcodeDetector.getSupportedFormats();
    if (formats.includes('qr_code')) {
      barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
    }
  } catch {
    barcodeDetector = null;
  }
}

async function scanFrame(video, canvas) {
  if (barcodeDetector) {
    try {
      const [code] = await barcodeDetector.detect(video);
      if (code?.rawValue) return code.rawValue;
    } catch {
      barcodeDetector = null;
    }
  }

  const scale = Math.min(1, maxScanDimension / video.videoWidth);
  const width = Math.round(video.videoWidth * scale);
  const height = Math.round(video.videoHeight * scale);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Não foi possível preparar a imagem da câmera.');

  canvas.width = width;
  canvas.height = height;
  context.drawImage(video, 0, 0, width, height);
  let imageData = context.getImageData(0, 0, width, height);
  let code = jsQR(imageData.data, width, height, {
    inversionAttempts: 'dontInvert',
  });
  if (code?.data) return code.data;

  const cropX = Math.floor(width * 0.15);
  const cropY = Math.floor(height * 0.15);
  const cropWidth = width - cropX * 2;
  const cropHeight = height - cropY * 2;
  canvas.width = cropWidth;
  canvas.height = cropHeight;
  context.drawImage(
    video,
    Math.round(video.videoWidth * 0.15),
    Math.round(video.videoHeight * 0.15),
    Math.round(video.videoWidth * 0.7),
    Math.round(video.videoHeight * 0.7),
    0,
    0,
    cropWidth,
    cropHeight,
  );
  imageData = context.getImageData(0, 0, cropWidth, cropHeight);
  code = jsQR(imageData.data, cropWidth, cropHeight, {
    inversionAttempts: 'attemptBoth',
  });
  return code?.data || '';
}

onMounted(requestCamera);

onBeforeUnmount(() => {
  disposed = true;
  if (rafId) cancelAnimationFrame(rafId);
  if (hintTimeoutId) window.clearTimeout(hintTimeoutId);
  if (stream) stream.getTracks().forEach((track) => track.stop());
});
</script>
