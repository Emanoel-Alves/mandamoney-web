import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// base: './' gera caminhos relativos no build, então funciona tanto em
// https://usuario.github.io/repo/ quanto em domínio raiz, sem precisar
// editar nada aqui quando você criar o repositório.
export default defineConfig({
  plugins: [vue()],
  base: './',
});
