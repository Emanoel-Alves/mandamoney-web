<template>
  <div v-if="permissionState !== 'granted'" class="scanner-permission">
    <h1 class="screen-title">Fotografar nota</h1>
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
      <div class="scanner-frame" style="width: 88%; height: 62%; max-width: none; max-height: none"></div>
      <p class="scanner-title">Enquadre a lista de produtos</p>
      <p class="scanner-hint">Use boa iluminação e mantenha a nota inteira visível</p>
      <button class="capture-btn" :disabled="capturing" @click="capture">
        <span class="capture-inner"></span>
      </button>
      <p class="scanner-hint">{{ capturing ? 'Processando foto...' : 'Toque no círculo para fotografar' }}</p>
      <button class="scanner-cancel" @click="$emit('cancel')">Cancelar</button>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

const emit = defineEmits(['capture', 'cancel', 'error']);

const videoEl = ref(null);
const canvasEl = ref(null);
const permissionState = ref('pending');
const cameraMessage = ref('Solicitando acesso à câmera para fotografar a nota.');
const capturing = ref(false);
const requesting = ref(false);

let stream = null;
let disposed = false;

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
      video: { facingMode: 'environment' },
    });
    if (disposed) {
      cameraStream.getTracks().forEach((track) => track.stop());
      return;
    }
    stream = cameraStream;
    permissionState.value = 'granted';
    await nextTick();
    if (disposed) return;
    if (!videoEl.value) throw new Error('Elemento de vídeo não foi criado.');
    videoEl.value.srcObject = stream;
    await videoEl.value.play();
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

function capture() {
  if (capturing.value || !videoEl.value) return;
  capturing.value = true;
  try {
    const video = videoEl.value;
    const canvas = canvasEl.value;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // dataURL vem como "data:image/jpeg;base64,XXXX" — mandamos só o base64,
    // igual ao photo.base64 que o app original pegava do expo-camera.
    const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
    const base64 = dataUrl.split(',')[1];
    emit('capture', { imageBase64: base64, mimeType: 'image/jpeg' });
  } catch (error) {
    capturing.value = false;
    emit('error', 'Não foi possível preparar a foto. Tente novamente.');
  }
}

onMounted(requestCamera);

onBeforeUnmount(() => {
  disposed = true;
  if (stream) stream.getTracks().forEach((track) => track.stop());
});

defineExpose({ resetCapturing: () => { capturing.value = false; } });
</script>
