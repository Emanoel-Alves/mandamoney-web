<template>
  <div class="loading-page">
    <div class="ml-root">
      <div class="ml-frame">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="140" height="140" class="ml-svg ml-tone-light" focusable="false" aria-hidden="true"><ellipse class="ml-shadow" cx="32" cy="58.4" rx="9.6" ry="2.1" fill="var(--ml-shadow)"/><g class="ml-body"><rect x="27.1" y="46.4" width="4.3" height="9.4" rx="2.1" fill="var(--ml-pants)"/><rect x="32.6" y="46.4" width="4.3" height="9.4" rx="2.1" fill="var(--ml-pants)"/><rect x="24.7" y="32.4" width="14.6" height="16.4" rx="7.3" fill="var(--ml-figure)"/><g class="ml-arm-off"><path d="M25.9 35.6 20.7 41.4" stroke="var(--ml-figure)" stroke-width="3.7" stroke-linecap="round" fill="none"/></g><g class="ml-arm-throw"><path d="M38.1 35.6 45.3 40.6" stroke="var(--ml-figure)" stroke-width="3.7" stroke-linecap="round" fill="none"/><g class="ml-hand-bill"><rect x="42.6" y="37.6" width="7.4" height="4.6" rx="1.2" fill="var(--ml-money)" stroke="var(--ml-money-line)" stroke-width=".7" transform="rotate(-34 46.3 39.9)"/></g></g><circle cx="32" cy="27.6" r="7.7" fill="var(--ml-figure)"/><path d="M24.5 27.2a7.5 7.5 0 0 0 15 0z" fill="var(--ml-accent)"/><rect x="32.6" y="24.6" width="7.4" height="2.2" rx="1.1" fill="var(--ml-accent)"/><circle cx="29.5" cy="27.9" r="1.25" fill="var(--ml-cut)"/><circle cx="34.6" cy="27.9" r="1.25" fill="var(--ml-cut)"/><path d="M29.8 30.6q2.3 2 4.5 0" stroke="var(--ml-cut)" stroke-width="1.4" stroke-linecap="round" fill="none"/></g><g class="ml-coin ml-coin-a"><circle cx="41.4" cy="29.6" r="1.7" fill="var(--ml-coin)" stroke="var(--ml-coin-line)" stroke-width=".5"/></g><g class="ml-coin ml-coin-b"><circle cx="44.8" cy="31.4" r="1.5" fill="var(--ml-coin)" stroke="var(--ml-coin-line)" stroke-width=".5"/></g><g class="ml-bill ml-bill-a"><g transform="translate(43.6 27.4)"><rect x="-4" y="-2.5" width="8" height="5" rx="1.1" fill="var(--ml-money)" stroke="var(--ml-money-line)" stroke-width=".7"/><circle r="1.1" fill="var(--ml-money-line)" opacity=".65"/></g></g><g class="ml-bill ml-bill-b"><g transform="translate(40.2 25.4)"><rect x="-4" y="-2.5" width="8" height="5" rx="1.1" fill="var(--ml-money)" stroke="var(--ml-money-line)" stroke-width=".7"/><circle r="1.1" fill="var(--ml-money-line)" opacity=".65"/></g></g><g class="ml-bill ml-bill-c"><g transform="translate(46.6 30.4)"><rect x="-4" y="-2.5" width="8" height="5" rx="1.1" fill="var(--ml-money)" stroke="var(--ml-money-line)" stroke-width=".7"/><circle r="1.1" fill="var(--ml-money-line)" opacity=".65"/></g></g></svg>
      </div>
      <p class="ml-caption">{{ label }}</p>
    </div>
  </div>
</template>

<script setup>
defineProps({ label: { type: String, default: 'Carregando...' } });
</script>

<style>
/* Sem "scoped" de propósito: o Vue não deixa <style> dentro do <template>,
   então o CSS do SVG (que era embutido no arquivo original) foi movido pra
   cá. Fica global no app, mas os nomes com prefixo "ml-" já evitam colisão
   com o resto do projeto. */

.ml-root { display: inline-flex; flex-direction: column; align-items: center; gap: 0.65rem; }
.ml-frame { display: block; flex: none; }
.ml-svg { display: block; width: 100%; height: 100%; overflow: visible; }
.ml-caption {
  font-size: 0.875rem;
  line-height: 1.3;
  font-weight: 500;
  letter-spacing: -0.01em;
  animation: ml-caption calc(var(--ml-cycle, 2.2s) * 0.78) ease-in-out infinite;
}

.ml-tone-light {
  --ml-figure: #16241e;
  --ml-pants: #2d3d35;
  --ml-cut: #fff;
  --ml-accent: #e2a509;
  --ml-money: #12855a;
  --ml-money-line: #0a5c3c;
  --ml-coin: #f0b71d;
  --ml-coin-line: #a97c05;
  --ml-shadow: #16241e;
  color: #4a5a52;
}

.ml-body { animation: ml-body var(--ml-cycle, 2.2s) cubic-bezier(0.33, 0, 0.2, 1) infinite both; }
.ml-shadow { transform-box: fill-box; transform-origin: center; animation: ml-shadow var(--ml-cycle, 2.2s) ease-in-out infinite both; }
.ml-arm-throw { transform-box: view-box; transform-origin: 38.1px 35.6px; animation: ml-arm-throw var(--ml-cycle, 2.2s) cubic-bezier(0.3, 0, 0.15, 1) infinite both; }
.ml-arm-off { transform-box: view-box; transform-origin: 25.9px 35.6px; animation: ml-arm-off var(--ml-cycle, 2.2s) ease-in-out infinite both; }
.ml-hand-bill { animation: ml-hand-bill var(--ml-cycle, 2.2s) steps(1, end) infinite both; }
.ml-bill, .ml-coin { transform-box: fill-box; transform-origin: center; }
.ml-bill-a { animation: ml-bill-a calc(var(--ml-cycle, 2.2s) * 0.62) linear infinite both; animation-delay: calc(var(--ml-cycle, 2.2s) * 0.21); }
.ml-bill-b { animation: ml-bill-b calc(var(--ml-cycle, 2.2s) * 0.62) linear infinite both; animation-delay: calc(var(--ml-cycle, 2.2s) * 0.29); }
.ml-bill-c { animation: ml-bill-c calc(var(--ml-cycle, 2.2s) * 0.62) linear infinite both; animation-delay: calc(var(--ml-cycle, 2.2s) * 0.37); }
.ml-coin-a { animation: ml-coin-a calc(var(--ml-cycle, 2.2s) * 0.62) ease-out infinite both; animation-delay: calc(var(--ml-cycle, 2.2s) * 0.25); }
.ml-coin-b { animation: ml-coin-b calc(var(--ml-cycle, 2.2s) * 0.62) ease-out infinite both; animation-delay: calc(var(--ml-cycle, 2.2s) * 0.33); }

@keyframes ml-body { 0% { transform: translateY(0); } 8%, 14% { transform: translateY(1.7px); } 24% { transform: translateY(-1.3px); } 34% { transform: translateY(0.7px); } 46% { transform: translateY(0); } 64% { transform: translateY(0.6px); } 84%, 100% { transform: translateY(0); } }
@keyframes ml-arm-throw { 0% { transform: rotate(0); } 8%, 13% { transform: rotate(42deg); } 23% { transform: rotate(-95deg); } 34% { transform: rotate(-88deg); } 56% { transform: rotate(-4deg); } 66% { transform: rotate(3deg); } 84%, 100% { transform: rotate(0); } }
@keyframes ml-arm-off { 0% { transform: rotate(0); } 10% { transform: rotate(24deg); } 24% { transform: rotate(-32deg); } 42% { transform: rotate(-18deg); } 62% { transform: rotate(5deg); } 84%, 100% { transform: rotate(0); } }
@keyframes ml-shadow { 0%, 80%, 100% { transform: scaleX(1); opacity: 0.16; } 10% { transform: scaleX(1.16); opacity: 0.22; } 24% { transform: scaleX(0.82); opacity: 0.11; } 40% { transform: scaleX(1.06); opacity: 0.18; } }
@keyframes ml-hand-bill { 0%, 18% { opacity: 1; } 23%, 100% { opacity: 0; } }
@keyframes ml-bill-a { 0% { transform: translate(0, 0) rotate(0) scale(0.3); opacity: 0; } 9% { transform: translate(-3px, -5px) rotate(-55deg) scale(1); opacity: 1; } 45% { transform: translate(-13px, -20px) rotate(-265deg) scale(1); opacity: 1; } 78% { transform: translate(-17px, -5px) rotate(-465deg) scale(1); opacity: 1; } 100% { transform: translate(-20px, 6px) rotate(-560deg) scale(0.86); opacity: 0; } }
@keyframes ml-bill-b { 0% { transform: translate(0, 0) rotate(0) scale(0.3); opacity: 0; } 9% { transform: translate(-1px, -6px) rotate(45deg) scale(1); opacity: 1; } 45% { transform: translate(-4px, -22px) rotate(225deg) scale(1); opacity: 1; } 78% { transform: translate(-6px, -8px) rotate(425deg) scale(1); opacity: 1; } 100% { transform: translate(-7px, 3px) rotate(520deg) scale(0.86); opacity: 0; } }
@keyframes ml-bill-c { 0% { transform: translate(0, 0) rotate(0) scale(0.3); opacity: 0; } 9% { transform: translate(3px, -5px) rotate(-35deg) scale(1); opacity: 1; } 45% { transform: translate(9px, -18px) rotate(-205deg) scale(1); opacity: 1; } 78% { transform: translate(12px, -4px) rotate(-395deg) scale(1); opacity: 1; } 100% { transform: translate(14px, 7px) rotate(-490deg) scale(0.86); opacity: 0; } }
@keyframes ml-coin-a { 0% { transform: translate(0, 0) scaleX(1) scale(0.4); opacity: 0; } 12% { transform: translate(-2px, -7px) scaleX(0.2) scale(1); opacity: 1; } 45% { transform: translate(-4px, -19px) scaleX(1) scale(1); opacity: 1; } 75% { transform: translate(-5px, -6px) scaleX(0.2) scale(1); opacity: 1; } 100% { transform: translate(-6px, 4px) scaleX(1) scale(0.9); opacity: 0; } }
@keyframes ml-coin-b { 0% { transform: translate(0, 0) scaleX(1) scale(0.4); opacity: 0; } 12% { transform: translate(2px, -6px) scaleX(1) scale(1); opacity: 1; } 45% { transform: translate(5px, -16px) scaleX(0.2) scale(1); opacity: 1; } 75% { transform: translate(7px, -4px) scaleX(1) scale(1); opacity: 1; } 100% { transform: translate(8px, 5px) scaleX(0.2) scale(0.9); opacity: 0; } }
@keyframes ml-caption { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
@keyframes ml-hush { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }

@media (prefers-reduced-motion: reduce) {
  .ml-body, .ml-shadow, .ml-arm-throw, .ml-arm-off, .ml-bill-a, .ml-bill-b, .ml-bill-c, .ml-coin-a, .ml-coin-b { animation: none; }
  .ml-shadow { opacity: 0.16; }
  .ml-hand-bill { animation: none; opacity: 0; }
  .ml-svg { animation: ml-hush 1.9s ease-in-out infinite; }
  .ml-caption { animation: none; }
}
</style>