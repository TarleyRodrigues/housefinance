// ─── RETROSPECTIVA DO MÊS — stories ──────────────────────────────────────────
// Tela cheia estilo "stories": barras de progresso, toque à direita avança,
// à esquerda volta, segurar pausa. Último slide: compartilhar imagem / rever.

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { X, Share2, RotateCcw, Loader2 } from 'lucide-react';
import { AnimatedNumber } from './AnimatedNumber';
import { formatCurrency } from '../utils';
import { formatRecapDay } from '../utils/monthRecap';
import { shareRecapImage } from '../utils/recapImage';
import type { MonthRecap } from '../types';

const SLIDE_MS = 6500;
const HOLD_MS  = 180;

interface Props {
  data: MonthRecap | null;       // null = carregando
  onClose: () => void;
  showToast: (msg: string, type?: string) => void;
}

interface Slide {
  key: string;
  bg: string;
  content: ReactNode;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Item que entra com atraso (efeito em cascata dentro do slide)
function Rise({ i = 0, children, className = '' }: { i?: number; children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + i * 0.18, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const Emoji = ({ children }: { children: string }) => (
  <motion.div
    initial={{ scale: 0.3, rotate: -25, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }}
    transition={{ type: 'spring', damping: 9, stiffness: 160 }}
    className="text-7xl leading-none mb-6 select-none" aria-hidden="true"
  >
    {children}
  </motion.div>
);

const Label = ({ children }: { children: ReactNode }) => (
  <p className="text-xs font-black uppercase tracking-[0.25em] text-white/70">{children}</p>
);

function Avatar({ name, url }: { name: string; url?: string }) {
  return url
    ? <img src={url} alt="" className="w-12 h-12 rounded-2xl object-cover border-2 border-white/40 shrink-0" />
    : <span className="w-12 h-12 rounded-2xl bg-white/20 border-2 border-white/40 flex items-center justify-center font-black text-lg shrink-0">{name.charAt(0)}</span>;
}

function buildSlides(r: MonthRecap, actions: { share: () => void; sharing: boolean; restart: () => void }): Slide[] {
  const slides: Slide[] = [];
  const month = `${r.monthLabel} ${r.year}`;

  slides.push({
    key: 'intro', bg: 'from-indigo-600 via-violet-600 to-fuchsia-600',
    content: (
      <>
        <Emoji>🎬</Emoji>
        <Rise><Label>Retrospectiva</Label></Rise>
        <Rise i={1}><h2 className="text-5xl font-black tracking-tighter mt-2 leading-none">{month}</h2></Rise>
        <Rise i={2}>
          <p className="text-lg font-medium text-white/85 mt-5 leading-snug">
            {r.count > 0 ? 'Bora ver como foi o mês de vocês? 👀' : 'Nenhum gasto registrado neste mês. Mês zen! 🧘'}
          </p>
        </Rise>
      </>
    ),
  });

  if (r.count === 0) return slides;

  slides.push({
    key: 'total', bg: 'from-blue-600 via-blue-500 to-cyan-500',
    content: (
      <>
        <Emoji>💰</Emoji>
        <Rise><Label>Vocês gastaram</Label></Rise>
        <Rise i={1}><p className="text-5xl font-black tracking-tighter mt-2 leading-none"><AnimatedNumber value={r.total} duration={1.6} /></p></Rise>
        <Rise i={2}><p className="text-lg font-bold text-white/85 mt-4">em {r.count} lançamento{r.count !== 1 ? 's' : ''}</p></Rise>
        <Rise i={3}><p className="text-sm font-medium text-white/75 mt-1">≈ {formatCurrency(r.dailyAvg)} por dia</p></Rise>
        {r.diffPct !== null && (
          <Rise i={4}>
            <span className={`inline-flex items-center gap-2 mt-6 px-4 py-2 rounded-2xl text-sm font-black ${r.diffPct > 0 ? 'bg-red-500/30' : 'bg-emerald-400/30'}`}>
              {r.diffPct > 0
                ? `📈 ${Math.abs(r.diffPct).toFixed(0)}% a mais que o mês anterior`
                : `📉 ${Math.abs(r.diffPct).toFixed(0)}% a menos que o mês anterior — boa!`}
            </span>
          </Rise>
        )}
      </>
    ),
  });

  const top = r.topCategories[0];
  if (top) {
    slides.push({
      key: 'category', bg: 'from-amber-500 via-orange-500 to-orange-600',
      content: (
        <>
          <Emoji>🏆</Emoji>
          <Rise><Label>Categoria campeã</Label></Rise>
          <Rise i={1}><h2 className="text-5xl font-black tracking-tighter mt-2 leading-none break-words">{top.name}</h2></Rise>
          <Rise i={2}><p className="text-lg font-bold text-white/90 mt-3">{formatCurrency(top.total)} · {top.pct.toFixed(0)}% do mês</p></Rise>
          <Rise i={3} className="mt-8 space-y-3 w-full">
            {r.topCategories.map((c, idx) => (
              <div key={c.name}>
                <div className="flex justify-between text-xs font-black uppercase tracking-wider text-white/85 mb-1">
                  <span className="truncate pr-2">{idx + 1}. {c.name}</span><span>{formatCurrency(c.total)}</span>
                </div>
                <div className="h-2.5 rounded-full bg-white/20 overflow-hidden">
                  <motion.div className="h-full rounded-full bg-white"
                    initial={{ width: 0 }} animate={{ width: `${Math.max(c.pct, 3)}%` }}
                    transition={{ delay: 0.9 + idx * 0.15, duration: 0.8, ease: 'easeOut' }} />
                </div>
              </div>
            ))}
          </Rise>
        </>
      ),
    });
  }

  if (r.priciestDay) {
    const d = r.priciestDay;
    slides.push({
      key: 'day', bg: 'from-rose-500 via-pink-500 to-fuchsia-600',
      content: (
        <>
          <Emoji>📅</Emoji>
          <Rise><Label>O dia mais caro foi</Label></Rise>
          <Rise i={1}><h2 className="text-4xl font-black tracking-tighter mt-2 leading-tight">{capitalize(formatRecapDay(d.date))}</h2></Rise>
          <Rise i={2}><p className="text-3xl font-black mt-4">{formatCurrency(d.total)}</p></Rise>
          <Rise i={3}>
            <p className="text-base font-medium text-white/85 mt-3 leading-snug">
              {d.count} gasto{d.count !== 1 ? 's' : ''} nesse dia — o maior foi <strong className="font-black">{d.topDescription}</strong>.
            </p>
          </Rise>
        </>
      ),
    });
  }

  if (r.topMerchant) {
    const m = r.topMerchant;
    slides.push({
      key: 'merchant', bg: 'from-emerald-500 via-teal-500 to-cyan-600',
      content: (
        <>
          <Emoji>🏪</Emoji>
          <Rise><Label>O lugar favorito de vocês</Label></Rise>
          <Rise i={1}><h2 className="text-5xl font-black tracking-tighter mt-2 leading-none break-words">{m.name}</h2></Rise>
          <Rise i={2}><p className="text-lg font-bold text-white/90 mt-4">{m.count} visita{m.count !== 1 ? 's' : ''} · {formatCurrency(m.total)}</p></Rise>
          <Rise i={3}>
            <p className="text-sm font-medium text-white/75 mt-2">
              {m.count >= 8 ? 'Já dá pra pedir música no som ambiente. 🎶' : m.count >= 4 ? 'Clientes VIP, com certeza. ⭐' : 'Sempre um bom lugar pra voltar. 😉'}
            </p>
          </Rise>
        </>
      ),
    });
  }

  if (r.people.length > 0) {
    const maxCount = Math.max(...r.people.map(p => p.count));
    slides.push({
      key: 'people', bg: 'from-sky-500 via-blue-600 to-indigo-700',
      content: (
        <>
          <Emoji>✍️</Emoji>
          <Rise><Label>Quem mais lançou</Label></Rise>
          <Rise i={1}>
            <h2 className="text-4xl font-black tracking-tighter mt-2 leading-tight">
              {r.people.length === 1 ? `${r.people[0].name} cuidou de todos os lançamentos 💪` : `${r.people[0].name} 🥇`}
            </h2>
          </Rise>
          <Rise i={2} className="mt-8 space-y-4 w-full">
            {r.people.map((p, idx) => (
              <div key={p.userId} className="flex items-center gap-3">
                <Avatar name={p.name} url={p.avatarUrl} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-sm font-black">
                    <span className="truncate pr-2">{p.name}</span>
                    <span>{p.count} gasto{p.count !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-white/20 overflow-hidden mt-1.5">
                    <motion.div className="h-full rounded-full bg-white"
                      initial={{ width: 0 }} animate={{ width: `${(p.count / maxCount) * 100}%` }}
                      transition={{ delay: 0.8 + idx * 0.15, duration: 0.8, ease: 'easeOut' }} />
                  </div>
                  <p className="text-[11px] font-bold text-white/70 mt-1">{formatCurrency(p.total)}</p>
                </div>
              </div>
            ))}
          </Rise>
        </>
      ),
    });
  }

  if (r.biggest) {
    const b = r.biggest;
    slides.push({
      key: 'biggest', bg: 'from-violet-600 via-purple-700 to-slate-900',
      content: (
        <>
          <Emoji>💸</Emoji>
          <Rise><Label>O maior gasto do mês</Label></Rise>
          <Rise i={1}><h2 className="text-4xl font-black tracking-tighter mt-2 leading-tight break-words">{b.description}</h2></Rise>
          <Rise i={2}><p className="text-5xl font-black mt-4 tracking-tighter">{formatCurrency(b.amount)}</p></Rise>
          <Rise i={3}><p className="text-sm font-bold text-white/75 mt-3">{b.category} · {formatRecapDay(b.date)}</p></Rise>
        </>
      ),
    });
  }

  if (r.goals) {
    const g = r.goals;
    const ratio = g.within / g.total;
    slides.push({
      key: 'goals', bg: 'from-lime-500 via-emerald-500 to-green-700',
      content: (
        <>
          <Emoji>{ratio === 1 ? '🎯' : ratio >= 0.5 ? '👏' : '🫣'}</Emoji>
          <Rise><Label>Metas do mês</Label></Rise>
          <Rise i={1}><h2 className="text-6xl font-black tracking-tighter mt-2 leading-none">{g.within} de {g.total}</h2></Rise>
          <Rise i={2}><p className="text-lg font-bold text-white/90 mt-3">categorias dentro da meta</p></Rise>
          <Rise i={3}>
            <p className="text-base font-medium text-white/85 mt-5 leading-snug">
              {ratio === 1 ? 'Gabaritaram! Nenhuma meta estourada. 🏆'
                : ratio >= 0.5 ? 'Mandaram bem na maioria. Mês que vem é gabarito!'
                : 'Algumas metas escaparam… mês que vem a gente recupera. 💪'}
            </p>
          </Rise>
        </>
      ),
    });
  }

  slides.push({
    key: 'weekend', bg: 'from-cyan-500 via-sky-600 to-blue-700',
    content: (
      <>
        <Emoji>{r.weekendPct >= 40 ? '🛋️' : '💼'}</Emoji>
        <Rise><Label>Curiosidade</Label></Rise>
        <Rise i={1}><h2 className="text-6xl font-black tracking-tighter mt-2 leading-none">{r.weekendPct.toFixed(0)}%</h2></Rise>
        <Rise i={2}><p className="text-lg font-bold text-white/90 mt-3">do valor foi gasto no fim de semana</p></Rise>
        <Rise i={3}>
          <p className="text-base font-medium text-white/80 mt-5 leading-snug">
            {r.weekendPct >= 50 ? 'Sábado e domingo são sagrados — e caros. 😅'
              : r.weekendPct >= 30 ? 'Equilíbrio entre semana e lazer. 👌'
              : 'Fim de semana tranquilo, gastos na rotina. 🧺'}
          </p>
        </Rise>
      </>
    ),
  });

  slides.push({
    key: 'end', bg: 'from-fuchsia-600 via-purple-600 to-indigo-700',
    content: (
      <>
        <Emoji>🎉</Emoji>
        <Rise><Label>{month}</Label></Rise>
        <Rise i={1}><h2 className="text-4xl font-black tracking-tighter mt-2 leading-tight">Esse foi o mês de vocês!</h2></Rise>
        <Rise i={2}>
          <p className="text-base font-medium text-white/85 mt-4 leading-snug">
            {r.diffPct !== null && r.diffPct < 0
              ? 'Gastaram menos que no mês anterior. Orgulho! 💚'
              : 'Cada lançamento conta a história do casal. Bora pro próximo! 🚀'}
          </p>
        </Rise>
        <Rise i={3} className="mt-10 w-full space-y-3">
          <button
            onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()}
            onClick={actions.share} disabled={actions.sharing}
            className="w-full min-h-[52px] rounded-2xl bg-white text-violet-700 font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all disabled:opacity-70">
            {actions.sharing ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />}
            Compartilhar imagem
          </button>
          <button
            onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()}
            onClick={actions.restart}
            className="w-full min-h-[48px] rounded-2xl bg-white/15 border border-white/30 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all">
            <RotateCcw size={15} /> Ver de novo
          </button>
        </Rise>
      </>
    ),
  });

  return slides;
}

export default function MonthRecapStories({ data, onClose, showToast }: Props) {
  const reduce = useReducedMotion();
  const [index, setIndex]     = useState(0);
  const [paused, setPaused]   = useState(false);
  const [sharing, setSharing] = useState(false);
  const barRef   = useRef<HTMLDivElement>(null);
  const animRef  = useRef<Animation | null>(null);
  const holdRef  = useRef<{ timer?: ReturnType<typeof setTimeout>; held: boolean }>({ held: false });

  const share = useCallback(async () => {
    if (!data || sharing) return;
    setSharing(true);
    try {
      const how = await shareRecapImage(data);
      if (how === 'downloaded') showToast('Imagem salva! 📸');
    } catch (err) {
      if ((err as { name?: string })?.name !== 'AbortError') showToast('Não foi possível gerar a imagem.', 'error');
    } finally {
      setSharing(false);
    }
  }, [data, sharing, showToast]);

  const restart = useCallback(() => setIndex(0), []);

  const slides = useMemo(
    () => (data ? buildSlides(data, { share, sharing, restart }) : []),
    [data, share, sharing, restart],
  );
  const last = slides.length - 1;

  const next = useCallback(() => setIndex(i => Math.min(i + 1, last)), [last]);
  const prev = useCallback(() => setIndex(i => Math.max(i - 1, 0)), []);

  // Barra de progresso do slide atual (Web Animations API — pausável)
  useEffect(() => {
    const el = barRef.current;
    if (!el || slides.length === 0) return;
    const anim = el.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
      { duration: SLIDE_MS, easing: 'linear', fill: 'forwards' });
    anim.onfinish = () => { if (index < last) next(); };
    animRef.current = anim;
    return () => anim.cancel();
  }, [index, last, next, slides.length]);

  useEffect(() => {
    if (paused) animRef.current?.pause(); else animRef.current?.play();
  }, [paused]);

  // Teclado (desktop) + trava a rolagem do fundo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [onClose, next, prev]);

  const onPointerDown = () => {
    holdRef.current.held = false;
    holdRef.current.timer = setTimeout(() => { holdRef.current.held = true; setPaused(true); }, HOLD_MS);
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    clearTimeout(holdRef.current.timer);
    if (holdRef.current.held) { setPaused(false); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX - rect.left < rect.width / 3) prev(); else next();
  };

  const slide = slides[index];

  return createPortal(
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[450] bg-slate-950 flex justify-center"
      role="dialog" aria-modal="true" aria-label="Retrospectiva do mês"
    >
      <div
        className={`relative w-full max-w-md h-full overflow-hidden bg-gradient-to-br ${slide?.bg ?? 'from-indigo-600 via-violet-600 to-fuchsia-600'} text-white transition-[background] select-none touch-manipulation`}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { clearTimeout(holdRef.current.timer); setPaused(false); }}
        onContextMenu={e => e.preventDefault()}
      >
        {/* Bolhas decorativas */}
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -left-20 bottom-10 w-72 h-72 rounded-full bg-white/5 pointer-events-none" />

        {/* Barras de progresso + fechar */}
        <div className="absolute top-0 inset-x-0 z-20 px-3 pt-[max(env(safe-area-inset-top),12px)]">
          <div className="flex gap-1">
            {slides.map((s, i) => (
              <div key={s.key} className="h-1 flex-1 rounded-full bg-white/30 overflow-hidden">
                {i < index && <div className="h-full w-full bg-white" />}
                {i === index && <div ref={barRef} className="h-full w-full bg-white origin-left" style={{ transform: 'scaleX(0)' }} />}
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-2">
            <button
              onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()}
              onClick={onClose} aria-label="Fechar retrospectiva"
              className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        {!data ? (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <Loader2 size={36} className="animate-spin" />
            <p className="text-sm font-black uppercase tracking-widest text-white/80">Preparando a retrospectiva…</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={slide.key}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: -40 }}
              transition={{ duration: 0.28 }}
              className="relative z-10 h-full flex flex-col justify-center px-8 pb-16 pt-24"
            >
              {slide.content}
            </motion.div>
          </AnimatePresence>
        )}

        {paused && (
          <div className="absolute bottom-6 inset-x-0 z-20 text-center text-[10px] font-black uppercase tracking-widest text-white/70">
            Pausado
          </div>
        )}
      </div>
    </motion.div>,
    document.body,
  );
}
