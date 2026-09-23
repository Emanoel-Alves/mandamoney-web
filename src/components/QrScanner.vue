<template>
  <div v-if="permissionState !== 'granted'" class="scanner-permission">
    <h1 class="screen-title">Ler NFC-e</h1>
    <p class="screen-copy">
      {{ cameraMessage }}
    </p>
    <button class="btn-primary" @click="requestCamera">
      <span class="btn-primary-text">Ativar câmera</span>
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
      <p class="scanner-hint">A leitura acontece automaticamente</p>
      <button class="scanner-cancel" @click="$emit('cancel')">Cancelar</button>
    </div>
  </div>
</template>

<script setup>
import jsQR from 'jsqr';
import { onBeforeUnmount, ref } from 'vue';

const emit = defineEmits(['scan', 'cancel']);

const videoEl = ref(null);
const canvasEl = ref(null);
const permissionState = ref('pending'); // pending | granted | denied
const cameraMessage = ref('Toque no botão para permitir o acesso à câmera e ler o QR Code da nota.');

let stream = null;
let rafId = null;
let scanned = false;

async function requestCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    permissionState.value = 'denied';
    cameraMessage.value = 'A câmera exige HTTPS. Abra o endereço publicado ou um link HTTPS do túnel no celular.';
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
    });
    permissionState.value = 'granted';
    videoEl.value.srcObject = stream;
    await videoEl.value.play();
    tick();
  } catch (error) {
    permissionState.value = 'denied';
    cameraMessage.value = 'Não foi possível acessar a câmera. Verifique a permissão deste site e tente novamente.';
  }
}

function tick() {
  const video = videoEl.value;
  const canvas = canvasEl.value;
  if (!video || !canvas || scanned) return;

  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code && code.data) {
      scanned = true;
      emit('scan', code.data);
      return;
    }
  }
  rafId = requestAnimationFrame(tick);
}

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId);
  if (stream) stream.getTracks().forEach((track) => track.stop());
});
</script>
