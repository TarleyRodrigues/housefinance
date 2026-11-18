// ─── EFEITO DE FUNDO DOS TEMAS ESPECIAIS ─────────────────────────────────────
// Neve (Natal) ou coraçõezinhos (Amor) caindo/subindo devagar atrás do conteúdo.
// Poucas partículas e só transform/opacity — leve no celular.
// Desligado com "reduzir movimento".

import { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface Props {
  kind: 'snow' | 'hearts';
}

const COUNT = 18;

export function SeasonalOverlay({ kind }: Props) {
  const reduce = useReducedMotion();
  const parts = useMemo(() => Array.from({ length: COUNT }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    size: kind === 'snow' ? 3 + Math.random() * 5 : 10 + Math.random() * 10,
    dur: 14 + Math.random() * 14,
    delay: -Math.random() * 28,          // começa já espalhado pela tela
    drift: (Math.random() - 0.5) * 60,
    opacity: kind === 'snow' ? 0.35 + Math.random() * 0.4 : 0.18 + Math.random() * 0.22,
  })), [kind]);

  if (reduce) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {parts.map(p => (
        <motion.span
          key={p.id}
          className="absolute block select-none"
          style={{
            left: `${p.left}%`,
            top: kind === 'snow' ? -20 : undefined,
            bottom: kind === 'hearts' ? -30 : undefined,
            width: kind === 'snow' ? p.size : undefined,
            height: kind === 'snow' ? p.size : undefined,
            borderRadius: kind === 'snow' ? '50%' : undefined,
            backgroundColor: kind === 'snow' ? '#ffffff' : undefined,
            fontSize: kind === 'hearts' ? p.size : undefined,
            opacity: p.opacity,
            willChange: 'transform',
          }}
          animate={kind === 'snow'
            ? { y: ['0vh', '110vh'], x: [0, p.drift, 0] }
            : { y: ['0vh', '-115vh'], x: [0, p.drift, 0], rotate: [0, 12, -12, 0] }}
          transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: 'linear' }}
        >
          {kind === 'hearts' ? '💗' : null}
        </motion.span>
      ))}
    </div>
  );
}
