// ─── NÚMERO ANIMADO ──────────────────────────────────────────────────────────
// Conta do valor anterior até o novo (na montagem, a partir de 0).
// Atualiza o texto direto no DOM a cada quadro — sem re-render do React.
// Respeita "reduzir movimento" do sistema.

import { useEffect, useLayoutEffect, useRef } from 'react';
import { animate, useReducedMotion } from 'motion/react';
import { formatCurrency } from '../utils';

interface Props {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}

export function AnimatedNumber({ value, format = formatCurrency, duration = 0.9, className }: Props) {
  const ref     = useRef<HTMLSpanElement>(null);
  const shown   = useRef(0);          // último valor exibido
  const formatRef = useRef(format);
  formatRef.current = format;
  const reduce  = useReducedMotion();

  // Texto inicial antes da primeira pintura
  useLayoutEffect(() => {
    if (ref.current) ref.current.textContent = formatRef.current(reduce ? value : shown.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce || shown.current === value) {
      el.textContent = formatRef.current(value);
      shown.current = value;
      return;
    }
    const controls = animate(shown.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => { shown.current = v; el.textContent = formatRef.current(v); },
      onComplete: () => { shown.current = value; el.textContent = formatRef.current(value); },
    });
    return () => controls.stop();
  }, [value, duration, reduce]);

  return (
    <>
      <span ref={ref} className={className} aria-hidden="true" />
      <span className="sr-only">{format(value)}</span>
    </>
  );
}
