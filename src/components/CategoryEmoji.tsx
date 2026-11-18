// ─── SELO DE EMOJI DA CATEGORIA ──────────────────────────────────────────────
// Emoji num círculo tingido com a cor da categoria. Sem emoji → bolinha de cor.

interface Props {
  emoji: string | null | undefined;
  color?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  xs: 'w-5 h-5 text-[11px]',
  sm: 'w-7 h-7 text-sm',
  md: 'w-9 h-9 text-lg',
  lg: 'w-11 h-11 text-xl',
};

export function CategoryEmoji({ emoji, color, size = 'sm', className = '' }: Props) {
  const c = color || '#64748b';
  if (!emoji) {
    return (
      <span className={`${SIZES[size]} inline-flex items-center justify-center shrink-0 ${className}`} aria-hidden="true">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
      </span>
    );
  }
  return (
    <span
      className={`${SIZES[size]} inline-flex items-center justify-center rounded-full shrink-0 leading-none select-none ${className}`}
      style={{ backgroundColor: `${c}26`, boxShadow: `inset 0 0 0 1px ${c}40` }}
      aria-hidden="true"
    >
      {emoji}
    </span>
  );
}
