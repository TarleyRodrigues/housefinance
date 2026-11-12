// ─── CARTEIRINHA ESTUDANTIL (modelo demonstrativo) ───────────────────────────
// Frente/verso em proporção de cartão (85,6 × 54 mm). Todo o dimensionamento
// interno usa unidades `cqw` (container query) — escala igual em qualquer largura.
// QR Code é fictício: padrão visual determinístico gerado a partir do código de uso.

import { useMemo, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap, X, RefreshCw, ShieldCheck, UserRound, Maximize2, Minimize2 } from 'lucide-react';
import type { StudentCardView } from '../types';
import {
  cardYear, formatDateBR, formatMonthYear, hashString, seededRandom,
} from '../utils/studentCard';

// ─────────────────────────────────────────────────────────────────────────────
// QR Code fictício
// ─────────────────────────────────────────────────────────────────────────────
const QR_SIZE = 25;

function buildFakeQrPath(seed: string): string {
  const rnd = seededRandom(hashString(seed));
  const cells: boolean[][] = Array.from({ length: QR_SIZE }, () => Array<boolean>(QR_SIZE).fill(false));
  const reserved: boolean[][] = Array.from({ length: QR_SIZE }, () => Array<boolean>(QR_SIZE).fill(false));

  // Padrões de posição (3 cantos) + separador branco
  const finder = (ox: number, oy: number) => {
    for (let y = -1; y <= 7; y++) {
      for (let x = -1; x <= 7; x++) {
        const cx = ox + x, cy = oy + y;
        if (cx < 0 || cy < 0 || cx >= QR_SIZE || cy >= QR_SIZE) continue;
        reserved[cy][cx] = true;
        const ring = Math.max(Math.abs(x - 3), Math.abs(y - 3));
        cells[cy][cx] = ring === 3 || ring <= 1;
      }
    }
  };
  finder(0, 0);
  finder(QR_SIZE - 7, 0);
  finder(0, QR_SIZE - 7);

  // Linhas de temporização
  for (let i = 8; i < QR_SIZE - 8; i++) {
    reserved[6][i] = reserved[i][6] = true;
    cells[6][i] = cells[i][6] = i % 2 === 0;
  }

  // Área central livre para o selo
  const c = Math.floor(QR_SIZE / 2);
  for (let y = c - 2; y <= c + 2; y++) for (let x = c - 2; x <= c + 2; x++) reserved[y][x] = true;

  let d = '';
  for (let y = 0; y < QR_SIZE; y++) {
    for (let x = 0; x < QR_SIZE; x++) {
      const on = reserved[y][x] ? cells[y][x] : rnd() > 0.5;
      if (on) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return d;
}

function FakeQrCode({ seed, className = '' }: { seed: string; className?: string }) {
  const path = useMemo(() => buildFakeQrPath(seed), [seed]);
  return (
    <div className={`relative aspect-square ${className}`}>
      <svg viewBox={`-1 -1 ${QR_SIZE + 2} ${QR_SIZE + 2}`} shapeRendering="crispEdges" className="w-full h-full" aria-hidden="true">
        <rect x="-1" y="-1" width={QR_SIZE + 2} height={QR_SIZE + 2} fill="#ffffff" />
        <path d={path} fill="#0f172a" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-[22%] h-[22%] rounded-full bg-white flex items-center justify-center">
          <GraduationCap className="w-[80%] h-[80%] text-blue-700" strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Moldura: define o container (cqw) e a proporção do cartão
// ─────────────────────────────────────────────────────────────────────────────
export function CardFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`@container w-full ${className}`}>
      <div className="relative w-full aspect-[1.586/1]">{children}</div>
    </div>
  );
}

const BrandMark = ({ light = false }: { light?: boolean }) => (
  <div className="flex items-center gap-[1.6cqw]">
    <div className={`w-[8.5cqw] h-[8.5cqw] rounded-[2.2cqw] flex items-center justify-center ${light ? 'bg-white/15' : 'bg-blue-700'}`}>
      <GraduationCap className="w-[5.6cqw] h-[5.6cqw] text-white" strokeWidth={2.2} />
    </div>
    <div className={`leading-[1.1] font-bold text-[2.5cqw] ${light ? 'text-white' : 'text-blue-800'}`}>
      Carteira<br />Estudantil Digital
    </div>
  </div>
);

const DemoBadge = () => (
  <span className="inline-block rounded-full bg-amber-400 text-amber-950 font-black uppercase tracking-wider text-[1.6cqw] px-[1.6cqw] py-[0.4cqw] leading-none">
    Modelo demonstrativo
  </span>
);

// ─────────────────────────────────────────────────────────────────────────────
// FRENTE
// ─────────────────────────────────────────────────────────────────────────────
export function StudentCardFront({ data }: { data: StudentCardView }) {
  return (
    <div className="absolute inset-0 rounded-[4.5cqw] overflow-hidden bg-gradient-to-br from-indigo-50 via-slate-50 to-blue-100 shadow-2xl shadow-black/30 select-none">
      {/* Arcos decorativos */}
      <div className="absolute -left-[10cqw] -bottom-[26cqw] w-[48cqw] h-[48cqw] rounded-full border-[7cqw] border-fuchsia-600/85" />
      <div className="absolute -right-[18cqw] -bottom-[34cqw] w-[70cqw] h-[50cqw] rounded-full border-[3cqw] border-blue-700/90" />

      <div className="relative h-full p-[4cqw] pr-[3.5cqw]">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-[2cqw]">
          <BrandMark />
          <div className="text-right max-w-[42cqw]">
            <p className="text-[1.7cqw] font-bold uppercase tracking-wider text-slate-500 leading-none">Instituição de ensino</p>
            <p className="text-[3.1cqw] font-black uppercase text-slate-800 leading-tight mt-[0.6cqw] line-clamp-2">
              {data.institution || 'Sua Faculdade'}
            </p>
          </div>
        </div>

        {/* Nome */}
        <div className="mt-[1.6cqw] max-w-[68cqw]">
          <DemoBadge />
          <p className="text-[4.4cqw] font-black text-slate-800 leading-tight truncate mt-[0.8cqw]">{data.fullName}</p>
        </div>

        {/* Foto + dados */}
        <div className="flex gap-[3cqw] mt-[1.2cqw] max-w-[69cqw]">
          <div className="relative z-10 w-[21cqw] shrink-0 aspect-[3/4] bg-white p-[0.8cqw] shadow-md">
            {data.photoUrl ? (
              <img src={data.photoUrl} alt={`Foto de ${data.fullName}`} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                <UserRound className="w-[10cqw] h-[10cqw] text-slate-300" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 text-slate-700 text-[2.5cqw] leading-snug">
            <p className="truncate">CPF: <span className="font-bold text-slate-900">{data.cpf || '—'}</span></p>
            <p className="truncate">Data nasc.: <span className="font-bold text-slate-900">{formatDateBR(data.birthDate) || '—'}</span></p>
            <p className="mt-[2.4cqw] text-slate-500">{data.educationLevel} em:</p>
            <p className="text-[3.5cqw] font-black text-slate-900 leading-tight line-clamp-2">{data.course || 'Seu Curso'}</p>
            <p className="text-[2.5cqw] font-bold text-slate-700 leading-tight truncate mt-[0.4cqw]">{data.institution || 'Sua Faculdade'}</p>
          </div>
        </div>
      </div>

      {/* Coluna direita: QR, código, ano e validade */}
      <div className="absolute right-[4cqw] top-[20cqw] bottom-0 w-[23cqw] bg-white rounded-t-[1.2cqw] flex flex-col items-center pt-[2cqw] px-[1.5cqw] shadow-sm">
        <FakeQrCode seed={data.usageCode} className="w-[17cqw]" />
        <p className="text-[1.9cqw] font-semibold text-slate-600 mt-[1cqw] leading-none">Cód. de uso</p>
        <p className="text-[2.9cqw] font-black text-slate-900 tracking-wide leading-tight mt-[0.4cqw]">{data.usageCode}</p>
        <p style={{ fontFamily: "'Montserrat', 'Arial Black', sans-serif", fontWeight: 900 }}
          className="text-[7.4cqw] text-blue-800 leading-none mt-auto tracking-[-0.06em]">{cardYear(data.validUntil)}</p>
        <p className="text-[1.8cqw] text-slate-500 mt-[0.8cqw] leading-none">Validade</p>
        <p className="text-[2.2cqw] font-bold text-slate-700 mb-[2cqw] mt-[0.4cqw] leading-none">{formatMonthYear(data.validUntil)}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VERSO
// ─────────────────────────────────────────────────────────────────────────────
const BackField = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <p className="text-[1.7cqw] font-bold uppercase tracking-wider text-blue-200/70 leading-none">{label}</p>
    <p className="text-[2.6cqw] font-bold text-white leading-tight truncate mt-[0.5cqw]">{value || '—'}</p>
  </div>
);

export function StudentCardBack({ data }: { data: StudentCardView }) {
  const signature = useMemo(
    () => hashString(`${data.usageCode}|${data.fullName}|${data.validUntil}`).toString(16).toUpperCase().padStart(8, '0'),
    [data.usageCode, data.fullName, data.validUntil],
  );
  const issued = new Date(data.issuedAt).toLocaleDateString('pt-BR');

  return (
    <div className="absolute inset-0 rounded-[4.5cqw] overflow-hidden bg-gradient-to-br from-blue-800 via-blue-900 to-indigo-950 shadow-2xl shadow-black/30 text-white select-none">
      <div className="absolute -right-[14cqw] -top-[20cqw] w-[50cqw] h-[50cqw] rounded-full border-[5cqw] border-fuchsia-500/30" />
      <div className="absolute left-0 right-0 top-[5cqw] h-[8cqw] bg-slate-950/70" />

      <div className="relative h-full flex flex-col p-[4cqw] pt-[15cqw]">
        <div className="flex gap-[3cqw]">
          <div className="flex-1 grid grid-cols-2 gap-x-[3cqw] gap-y-[2cqw]">
            <BackField label="Nível de ensino" value={data.educationLevel} />
            <BackField label="Curso" value={data.course} />
            <BackField label="Instituição" value={data.institution} />
            <BackField label="Data de nascimento" value={formatDateBR(data.birthDate)} />
            <BackField label="Emissão" value={issued} />
            <BackField label="Validade" value={formatDateBR(data.validUntil)} />
          </div>
          <div className="w-[17cqw] shrink-0 flex flex-col items-center">
            <div className="bg-white p-[1cqw] rounded-[1cqw] w-full">
              <FakeQrCode seed={`${data.usageCode}-verso`} className="w-full" />
            </div>
            <p className="text-[1.6cqw] text-blue-100/80 text-center leading-tight mt-[1cqw]">Escaneie para validar</p>
          </div>
        </div>

        <p className="text-[1.9cqw] text-blue-100/80 leading-snug mt-[2.4cqw]">
          Documento de identificação estudantil para acesso ao benefício de meia-entrada
          (Lei nº 12.933/2013). Apresente junto a um documento oficial com foto.
        </p>

        <div className="mt-auto flex items-end justify-between gap-[2cqw]">
          <div className="flex items-center gap-[1.2cqw] min-w-0">
            <ShieldCheck className="w-[3.6cqw] h-[3.6cqw] text-emerald-300 shrink-0" />
            <p className="text-[1.8cqw] font-mono text-blue-100/80 truncate">
              Assinatura digital · {signature} · {data.usageCode}
            </p>
          </div>
          <BrandMark light />
        </div>
        <p className="text-[1.6cqw] text-amber-300 font-bold uppercase tracking-wider mt-[1.4cqw] leading-none">
          Modelo demonstrativo — sem validade legal
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VISUALIZADOR (tela cheia, frente/verso com giro 3D)
// ─────────────────────────────────────────────────────────────────────────────
interface StudentCardViewerProps {
  isOpen: boolean;
  data: StudentCardView;
  onClose: () => void;
}

const faceStyle = { backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' } as const;

// Modo ampliado: cartão girado 90° ocupando a tela (lado maior = altura útil)
const ZOOM_LONG_SIDE = 'min(calc(100dvh - 230px), calc((100vw - 32px) * 1.586))';

export function StudentCardViewer({ isOpen, data, onClose }: StudentCardViewerProps) {
  const [flipped, setFlipped] = useState(false);
  const [zoomed, setZoomed]   = useState(false);

  const card = (
    <CardFrame>
      <motion.button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? 'Mostrar frente' : 'Mostrar verso'}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        className="absolute inset-0 text-left"
        style={{ transformStyle: 'preserve-3d' }}
      >
        <div className="absolute inset-0" style={faceStyle}>
          <StudentCardFront data={data} />
        </div>
        <div className="absolute inset-0" style={{ ...faceStyle, transform: 'rotateY(180deg)' }}>
          <StudentCardBack data={data} />
        </div>
      </motion.button>
    </CardFrame>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] bg-slate-950/95 backdrop-blur-sm flex flex-col"
          role="dialog" aria-modal="true" aria-label="Carteirinha estudantil"
        >
          <div className="flex items-center justify-between px-5 pt-5">
            <div>
              <p className="text-white font-black uppercase tracking-tight text-sm">Carteirinha Estudantil</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Toque no cartão para virar</p>
            </div>
            <button onClick={onClose} aria-label="Fechar carteirinha"
              className="min-h-[44px] min-w-[44px] rounded-2xl bg-white/10 text-white flex items-center justify-center active:scale-95 transition-all">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center px-4 gap-6">
            {zoomed ? (
              // Caixa com as dimensões do cartão já girado; o cartão gira 90° dentro dela
              <motion.div
                key="zoomed"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="relative flex items-center justify-center"
                style={{ height: ZOOM_LONG_SIDE, width: `calc(${ZOOM_LONG_SIDE} / 1.586)` }}
              >
                <div className="absolute rotate-90" style={{ width: ZOOM_LONG_SIDE, perspective: 1600 }}>
                  {card}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="normal"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md" style={{ perspective: 1400 }}
              >
                {card}
              </motion.div>
            )}

            <div className="flex p-1 bg-white/10 rounded-2xl" role="tablist">
              {([['Frente', false], ['Verso', true]] as const).map(([label, value]) => (
                <button key={label} role="tab" aria-selected={flipped === value}
                  onClick={() => setFlipped(value)}
                  className={`min-h-[44px] px-6 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    flipped === value ? 'bg-white text-slate-900 shadow' : 'text-white/70'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="px-5 pb-8 flex gap-3 max-w-md w-full mx-auto">
            <button onClick={() => setFlipped((f) => !f)} aria-label="Virar cartão"
              className="min-h-[44px] min-w-[44px] px-3 rounded-2xl bg-white/10 text-white flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest active:scale-95 transition-all">
              <RefreshCw size={14} /> Virar
            </button>
            <button onClick={() => setZoomed((z) => !z)} aria-pressed={zoomed} aria-label={zoomed ? 'Reduzir cartão' : 'Ampliar cartão'}
              className={`min-h-[44px] min-w-[44px] px-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest active:scale-95 transition-all ${
                zoomed ? 'bg-white text-slate-900' : 'bg-white/10 text-white'
              }`}>
              {zoomed ? <Minimize2 size={14} /> : <Maximize2 size={14} />} {zoomed ? 'Reduzir' : 'Ampliar'}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
