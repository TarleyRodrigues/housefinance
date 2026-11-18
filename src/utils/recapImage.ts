// ─── RETROSPECTIVA — imagem para compartilhar ────────────────────────────────
// Desenha um resumo 1080×1350 (formato de post) com Canvas 2D — sem bibliotecas.
// Compartilha pelo menu nativo do celular quando possível; senão, baixa o PNG.

import { formatCurrency } from './index';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { MonthRecap } from '../types';

const W = 1080;
const H = 1350;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

export async function renderRecapImage(r: MonthRecap): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível');

  // Fundo
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#4f46e5');
  bg.addColorStop(0.55, '#7c3aed');
  bg.addColorStop(1, '#db2777');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Bolhas decorativas
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.arc(W - 80, 120, 260, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(60, H - 60, 200, 0, Math.PI * 2); ctx.fill();

  const pad = 90;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'alphabetic';

  // Cabeçalho
  ctx.globalAlpha = 0.75;
  ctx.font = `800 34px ${FONT}`;
  ctx.fillText('RETROSPECTIVA DO CASAL', pad, 150);
  ctx.globalAlpha = 1;
  ctx.font = `900 92px ${FONT}`;
  ctx.fillText(`${r.monthLabel} ${r.year}`, pad, 250);

  // Total
  ctx.globalAlpha = 0.75;
  ctx.font = `700 34px ${FONT}`;
  ctx.fillText(`Gastamos juntos · ${r.count} lançamentos`, pad, 360);
  ctx.globalAlpha = 1;
  ctx.font = `900 120px ${FONT}`;
  ctx.fillText(formatCurrency(r.total), pad, 480);
  if (r.diffPct !== null) {
    const up = r.diffPct > 0;
    ctx.font = `800 36px ${FONT}`;
    ctx.fillStyle = up ? '#fecaca' : '#bbf7d0';
    ctx.fillText(`${up ? '▲' : '▼'} ${Math.abs(r.diffPct).toFixed(0)}% vs mês anterior`, pad, 545);
    ctx.fillStyle = '#ffffff';
  }

  // Cartões de destaque
  const items: [string, string, string][] = [];
  const top = r.topCategories[0];
  if (top) items.push(['🏆', 'Categoria campeã', `${top.name} · ${formatCurrency(top.total)}`]);
  if (r.priciestDay) items.push(['📅', 'Dia mais caro', `${format(parseISO(r.priciestDay.date), "EEE, d 'de' MMM", { locale: ptBR })} · ${formatCurrency(r.priciestDay.total)}`]);
  if (r.topMerchant) items.push(['🏪', 'Lugar favorito', `${r.topMerchant.name} · ${r.topMerchant.count}x`]);
  if (r.people[0]) items.push(['✍️', 'Quem mais lançou', `${r.people[0].name} · ${r.people[0].count} gastos`]);
  if (r.goals) items.push(['🎯', 'Metas', `${r.goals.within} de ${r.goals.total} dentro da meta`]);

  let y = 600;
  const cardH = 108;
  for (const [emoji, label, value] of items.slice(0, 5)) {
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.roundRect(pad, y, W - pad * 2, cardH, 32);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `56px ${FONT}`;
    ctx.fillText(emoji, pad + 30, y + 76);
    ctx.globalAlpha = 0.75;
    ctx.font = `800 26px ${FONT}`;
    ctx.fillText(label.toUpperCase(), pad + 124, y + 44);
    ctx.globalAlpha = 1;
    ctx.font = `800 38px ${FONT}`;
    ctx.fillText(fitText(ctx, value, W - pad * 2 - 160), pad + 124, y + 88);
    y += cardH + 16;
  }

  // Rodapé
  ctx.globalAlpha = 0.6;
  ctx.font = `800 28px ${FONT}`;
  ctx.fillText('🏠 House Finance', pad, H - 50);
  ctx.globalAlpha = 1;

  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Falha ao gerar imagem'))), 'image/png'));
}

// Menu de compartilhar nativo (celular) ou download (desktop)
export async function shareRecapImage(r: MonthRecap): Promise<'shared' | 'downloaded'> {
  const blob = await renderRecapImage(r);
  const file = new File([blob], `retrospectiva-${r.monthLabel.toLowerCase()}-${r.year}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: `Retrospectiva de ${r.monthLabel}` });
    return 'shared';
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}
