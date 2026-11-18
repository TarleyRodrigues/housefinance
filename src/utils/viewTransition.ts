// ─── VIEW TRANSITIONS ────────────────────────────────────────────────────────
// Troca com animação nativa do navegador (Chrome/Edge 111+, Safari 18+).
// Com origem: o novo estado "se espalha" num círculo a partir do ponto tocado.
// Sem suporte ou com "reduzir movimento": troca instantânea.

import { flushSync } from 'react-dom';

type DocWithVT = Document & {
  startViewTransition?: (cb: () => void) => { ready: Promise<void> };
};

export function runViewTransition(update: () => void, origin?: { x: number; y: number }) {
  const doc = document as DocWithVT;
  if (!doc.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    update();
    return;
  }
  if (origin) document.documentElement.dataset.vt = 'reveal';
  const transition = doc.startViewTransition(() => flushSync(update));
  if (!origin) return;
  transition.ready.then(() => {
    const { x, y } = origin;
    const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const anim = document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 550, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' },
    );
    anim.finished.finally(() => { delete document.documentElement.dataset.vt; });
  }).catch(() => { delete document.documentElement.dataset.vt; });
}
