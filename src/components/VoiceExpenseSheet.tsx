// ─── LANÇAR GASTO POR VOZ ────────────────────────────────────────────────────
// Bottom sheet: grava a frase (Web Speech API, pt-BR) e mostra o texto para
// conferir. Sem suporte a reconhecimento de voz → campo de texto (o microfone
// do teclado do celular também serve para ditar).

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Mic, Square, X, Loader2, Sparkles } from 'lucide-react';
import type { SpeechRecognitionCtor, SpeechRecognitionLike } from '../types';

interface Props {
  busy: boolean;
  onSubmit: (text: string) => Promise<void>;
  onClose: () => void;
}

const getRecognition = (): SpeechRecognitionCtor | null => {
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const EXAMPLES = ['52,90 no Mercado Extra ontem', 'Conta de luz 230 reais', 'Almoço de 48 no shopping hoje'];

export function VoiceExpenseSheet({ busy, onSubmit, onClose }: Props) {
  const Recognition = useRef(getRecognition()).current;
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const [listening, setListening] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const stop = useCallback(() => { recRef.current?.stop(); }, []);

  const start = useCallback(() => {
    if (!Recognition) return;
    setError('');
    setText('');
    const rec = new Recognition();
    rec.lang = 'pt-BR';
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let t = '';
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setText(t.trim());
    };
    rec.onerror = (e) => {
      setError(e.error === 'not-allowed' || e.error === 'service-not-allowed'
        ? 'Permita o uso do microfone para falar o gasto.'
        : e.error === 'no-speech' ? 'Não ouvi nada. Toque no microfone e tente de novo.'
        : 'Não foi possível ouvir. Você pode digitar abaixo.');
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setError('Não foi possível iniciar o microfone.'); }
  }, [Recognition]);

  // O microfone só liga por um toque (exigência do Safari/iOS); ao fechar, para tudo
  useEffect(() => () => recRef.current?.abort(), []);

  const submit = async () => {
    const t = text.trim();
    if (!t || busy) return;
    stop();
    await onSubmit(t);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-end justify-center p-4"
      onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="voice-title"
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl space-y-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 id="voice-title" className="font-black text-base uppercase tracking-tight text-violet-600 dark:text-violet-400">
            Falar o gasto
          </h3>
          <button onClick={onClose} aria-label="Fechar"
            className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center active:scale-90 transition-all">
            <X size={16} />
          </button>
        </div>

        {Recognition && (
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={listening ? stop : start} disabled={busy}
              aria-label={listening ? 'Parar de ouvir' : 'Começar a ouvir'}
              className={`relative w-24 h-24 rounded-full flex items-center justify-center text-white shadow-xl active:scale-95 transition-all disabled:opacity-50 ${
                listening ? 'bg-red-500 shadow-red-500/40' : 'bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-violet-500/40'
              }`}
            >
              {listening && (
                <motion.span className="absolute inset-0 rounded-full bg-red-400"
                  animate={{ scale: [1, 1.45], opacity: [0.5, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }} aria-hidden="true" />
              )}
              {listening ? <Square size={30} fill="currentColor" className="relative" /> : <Mic size={36} className="relative" />}
            </button>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400" aria-live="polite">
              {listening ? 'Ouvindo… fale o valor e onde gastou' : 'Toque no microfone para falar'}
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="voice-text" className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">
            {Recognition ? 'O que entendi (pode corrigir)' : 'Descreva o gasto'}
          </label>
          <textarea
            id="voice-text" rows={2} value={text} onChange={e => setText(e.target.value)}
            placeholder={`Ex: ${EXAMPLES[0]}`}
            className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 outline-none text-slate-800 dark:text-slate-100 font-medium text-sm resize-none placeholder:text-slate-400 focus:border-violet-400 dark:focus:border-violet-600 transition-colors"
          />
          {!Recognition && (
            <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 px-1">
              Dica: toque no 🎤 do teclado do celular para ditar.
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-2.5 text-center">{error}</p>
        )}

        {!text && (
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map(ex => (
              <button key={ex} onClick={() => setText(ex)}
                className="px-3 py-2 min-h-[36px] rounded-xl bg-slate-100 dark:bg-slate-700/60 text-[11px] font-bold text-slate-500 dark:text-slate-300 active:scale-95 transition-all">
                “{ex}”
              </button>
            ))}
          </div>
        )}

        <button onClick={submit} disabled={!text.trim() || busy}
          className="w-full min-h-[48px] bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-violet-500/30 active:scale-95 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-50">
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={16} />}
          {busy ? 'Entendendo…' : 'Preencher gasto'}
        </button>
      </motion.div>
    </motion.div>
  );
}
