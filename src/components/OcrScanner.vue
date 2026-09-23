<template>
  <div v-if="permissionState === 'denied'" class="scanner-permission">
    <h1 class="screen-title">Fotografar nota</h1>
    <p class="screen-copy">
      Permita o acesso à câmera nas configurações do navegador para reconhecer os produtos da nota.
    </p>
    <button class="btn-primary" @click="requestCamera">
      <span class="btn-primary-text">Tentar novamente</span>
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
import { onBeforeUnmount, onMounted, ref } from 'vue';

const emit = defineEmits(['capture', 'cancel']);

const videoEl = ref(null);
const canvasEl = ref(null);
const permissionState = ref('pending');
const capturing = ref(false);

let stream = null;

async function requestCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
    });
    permissionState.value = 'granted';
    videoEl.value.srcObject = stream;
    await videoEl.value.play();
  } catch (error) {
    permissionState.value = 'denied';
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
    emit('capture', base64);
  } catch (error) {
    capturing.value = false;
    alert('Não foi possível preparar a foto. Tente novamente.');
  }
}

onMounted(requestCamera);

onBeforeUnmount(() => {
  if (stream) stream.getTracks().forEach((track) => track.stop());
});

defineExpose({ resetCapturing: () => { capturing.value = false; } });
</script>
