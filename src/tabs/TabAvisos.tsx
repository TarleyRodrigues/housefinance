// ─── ABA: LEMBRETES / AVISOS ─────────────────────────────────────────────────
// Melhorias aplicadas:
// ✅ insert/update/delete movidos para props onSave/onDelete (arquitetura)
// ✅ confirm() → modal customizado (UX)
// ✅ useMemo nos dias da semana + Set de datas com datas (performance)
// ✅ 4 estados unificados em FormState (qualidade)
// ✅ Lembretes ordenados: futuros primeiro, histórico colapsável (UX 🔥)
// ✅ Scroll automático ao entrar em modo edição (UX)
// ✅ Validação de data mínima = hoje (UX)
// ✅ aria-label em todos os botões, id/for nos inputs (acessibilidade)
// ✅ Checagem de user antes de acessar user.id (segurança)

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Bell, Calendar, Clock, Edit2, Trash2, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import {
  format, parseISO, isBefore, isToday as dateFnsIsToday,
  startOfToday, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import type { Reminder } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────
interface FormState {
  text: string;
  date: string;
  time: string;
  editId: string | null;
}

const EMPTY_FORM: FormState = { text: '', date: '', time: '', editId: null };

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTE: ConfirmDeleteModal
// ─────────────────────────────────────────────────────────────────────────────
interface ConfirmDeleteModalProps {
  reminder: Reminder | null;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDeleteModal({ reminder, onConfirm, onCancel }: ConfirmDeleteModalProps) {
  if (!reminder) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-end justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-reminder-title"
        onClick={onCancel}
      >
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle size={24} className="text-red-500" aria-hidden="true" />
            </div>
            <h3
              id="confirm-delete-reminder-title"
              className="font-black text-slate-800 dark:text-white text-base uppercase tracking-tight"
            >
              Apagar lembrete?
            </h3>
            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              <span className="font-bold text-slate-600 dark:text-slate-300">
                {reminder.text}
              </span>
              <br />
              Esta ação não pode ser desfeita.
            </p>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={onCancel}
              aria-label="Cancelar remoção do lembrete"
              className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-wider active:scale-95 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              aria-label="Confirmar remoção do lembrete"
              className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-black text-xs uppercase tracking-wider active:scale-95 transition-all shadow-lg shadow-red-500/30"
            >
              Apagar
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTE: ReminderCard
// ─────────────────────────────────────────────────────────────────────────────
interface ReminderCardProps {
  reminder: Reminder;
  isPast: boolean;
  onEdit: (rem: Reminder) => void;
  onDelete: (rem: Reminder) => void;
}

function ReminderCard({ reminder, isPast, onEdit, onDelete }: ReminderCardProps) {
  const remDateObj = parseISO(reminder.reminder_date);
  const isHoje = dateFnsIsToday(remDateObj);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`bg-white dark:bg-slate-800 p-4 rounded-2xl border shadow-sm flex items-center justify-between transition-all ${
        isPast
          ? 'opacity-40 grayscale-[0.5] border-slate-100 dark:border-slate-700'
          : isHoje
          ? 'border-blue-200 dark:border-blue-800 shadow-blue-100 dark:shadow-none'
          : 'border-slate-100 dark:border-slate-700'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isPast
              ? 'bg-slate-100 dark:bg-slate-700 text-slate-400'
              : isHoje
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-300/40'
              : 'bg-blue-50 dark:bg-blue-900/20 text-blue-500'
          }`}
          aria-hidden="true"
        >
          <Calendar size={18} />
        </div>
        <div>
          {isHoje && !isPast && (
            <span className="text-[8px] font-black uppercase tracking-widest text-blue-500 block mb-0.5">
              Hoje
            </span>
          )}
          <p
            className={`font-bold text-sm leading-tight ${
              isPast
                ? 'text-slate-500 line-through'
                : 'text-slate-800 dark:text-slate-200'
            }`}
          >
            {reminder.text}
          </p>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">
            {format(remDateObj, "dd 'de' MMM", { locale: ptBR })}
            {reminder.reminder_time && (
              <span className="ml-1 inline-flex items-center gap-0.5">
                <Clock size={8} aria-hidden="true" />
                {reminder.reminder_time.slice(0, 5)}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex gap-2 ml-2 shrink-0">
        <button
          onClick={() => onEdit(reminder)}
          aria-label={`Editar lembrete: ${reminder.text}`}
          className="p-2 text-blue-400 hover:text-blue-600 active:scale-90 transition-all rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20"
        >
          <Edit2 size={15} />
        </button>
        <button
          onClick={() => onDelete(reminder)}
          aria-label={`Apagar lembrete: ${reminder.text}`}
          className="p-2 text-slate-300 dark:text-slate-500 hover:text-red-400 active:scale-90 transition-all rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPS DO COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  reminders: Reminder[];
  fetchData: () => void;
  showToast: (msg: string, type?: string) => void;
  // ✅ Lógica de banco movida para fora — mesma filosofia do TabExtrato
  onSave: (payload: { text: string; date: string; time: string; editId: string | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL: TabAvisos
// ─────────────────────────────────────────────────────────────────────────────
export function TabAvisos({ reminders, fetchData, showToast, onSave, onDelete }: Props) {
  // ✅ Um único estado para o formulário
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const resetForm = useCallback(() => setForm(EMPTY_FORM), []);
  const patch = (partial: Partial<FormState>) => setForm((f) => ({ ...f, ...partial }));

  // Modal de confirmação de deleção
  const [reminderToDelete, setReminderToDelete] = useState<Reminder | null>(null);

  // Histórico colapsado por padrão
  const [historyOpen, setHistoryOpen] = useState(false);

  // Ref para scroll automático ao editar
  const formRef = useRef<HTMLFormElement>(null);

  const today = startOfToday();
  const todayStr = format(today, 'yyyy-MM-dd');

  // ✅ useMemo: dias da semana — só recalcula uma vez por dia
  const daysOfCurrentWeek = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(new Date(), { weekStartsOn: 0 }),
        end: endOfWeek(new Date(), { weekStartsOn: 0 }),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todayStr] // recalcula só quando o dia muda
  );

  // ✅ Set de datas com lembretes — busca O(1) em vez de O(n²)
  const reminderDateSet = useMemo(
    () => new Set(reminders.map((r) => r.reminder_date)),
    [reminders]
  );

  // ✅ Lembretes separados e ordenados
  const { upcoming, past } = useMemo(() => {
    const sorted = [...reminders].sort(
      (a, b) => new Date(a.reminder_date).getTime() - new Date(b.reminder_date).getTime()
    );
    return {
      upcoming: sorted.filter((r) => !isBefore(parseISO(r.reminder_date), today)),
      past: sorted
        .filter((r) => isBefore(parseISO(r.reminder_date), today))
        .reverse(), // mais recente primeiro no histórico
    };
  }, [reminders, today]);

  // ✅ Scroll automático ao entrar em modo edição
  useEffect(() => {
    if (form.editId) {
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [form.editId]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onSave({ text: form.text, date: form.date, time: form.time, editId: form.editId });
      showToast(form.editId ? 'Lembrete atualizado!' : 'Lembrete criado!');
      resetForm();
      fetchData();
    } catch {
      showToast('Erro ao salvar lembrete', 'error');
    }
  };

  const handleEditRequest = useCallback((rem: Reminder) => {
    patch({ text: rem.text, date: rem.reminder_date, time: rem.reminder_time ?? '', editId: rem.id });
  }, []);

  const handleDeleteRequest = useCallback((rem: Reminder) => {
    setReminderToDelete(rem);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!reminderToDelete) return;
    try {
      await onDelete(reminderToDelete.id);
      showToast('Lembrete removido', 'info');
      fetchData();
    } catch {
      showToast('Erro ao remover lembrete', 'error');
    } finally {
      setReminderToDelete(null);
    }
  }, [reminderToDelete, onDelete, showToast, fetchData]);

  return (
    <div className="space-y-6">

      {/* ── 1. AGENDA DA SEMANA ───────────────────────────────────────────────── */}
      <div
        className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden"
        role="region"
        aria-label="Agenda da semana atual"
      >
        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 px-2">
          Agenda da Semana
        </h4>
        <div className="flex justify-between overflow-x-auto no-scrollbar gap-2 pb-2 px-1 snap-x">
          {daysOfCurrentWeek.map((day, i) => {
            const isHoje = isSameDay(day, new Date());
            // ✅ Busca O(1) via Set
            const hasReminder = reminderDateSet.has(format(day, 'yyyy-MM-dd'));

            return (
              <div
                key={i}
                className={`flex flex-col items-center min-w-[45px] py-3 rounded-2xl transition-all snap-center border ${
                  isHoje
                    ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-200 dark:shadow-none text-white'
                    : 'bg-slate-50 dark:bg-slate-900/50 border-transparent text-slate-400 dark:text-slate-500'
                }`}
                aria-label={`${format(day, "EEEE, dd 'de' MMMM", { locale: ptBR })}${hasReminder ? ' — tem lembrete' : ''}${isHoje ? ' (hoje)' : ''}`}
              >
                <span className="text-[9px] font-black uppercase mb-1">
                  {format(day, 'EEE', { locale: ptBR })}
                </span>
                <span className="text-sm font-black">{format(day, 'dd')}</span>
                {hasReminder && (
                  <div
                    className={`w-1.5 h-1.5 rounded-full mt-1 ${isHoje ? 'bg-white' : 'bg-blue-500'}`}
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 2. FORMULÁRIO ────────────────────────────────────────────────────── */}
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4 transition-colors scroll-mt-4"
        aria-label={form.editId ? 'Editar lembrete' : 'Criar novo lembrete'}
      >
        <h3
          className="font-black text-slate-800 dark:text-slate-200 flex items-center gap-2 text-sm uppercase tracking-tighter"
          aria-live="polite"
        >
          <Bell size={16} className="text-blue-500" aria-hidden="true" />
          {form.editId ? 'Editar Lembrete' : 'Novo Lembrete'}
        </h3>

        {/* Texto */}
        <div>
          <label htmlFor="rem-text" className="sr-only">Texto do lembrete</label>
          <input
            id="rem-text"
            className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl outline-none border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-white font-medium placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-blue-300 dark:focus:border-blue-700 transition-colors"
            placeholder="Lembrar de…"
            required
            value={form.text}
            onChange={(e) => patch({ text: e.target.value })}
          />
        </div>

        {/* Data e Hora */}
        <div className="space-y-3">
          <div className="relative">
            <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
            <label htmlFor="rem-date" className="sr-only">Data do lembrete</label>
            <input
              id="rem-date"
              type="date"
              required
              min={todayStr} // ✅ impede datas passadas
              className="w-full p-4 pl-12 bg-slate-50 dark:bg-slate-900/50 rounded-2xl outline-none border border-slate-100 dark:border-slate-700 text-sm text-slate-800 dark:text-white appearance-none focus:border-blue-300 dark:focus:border-blue-700 transition-colors"
              value={form.date}
              onChange={(e) => patch({ date: e.target.value })}
            />
          </div>

          <div className="relative">
            <Clock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
            <label htmlFor="rem-time" className="sr-only">Horário do lembrete (opcional)</label>
            <input
              id="rem-time"
              type="time"
              className="w-full p-4 pl-12 bg-slate-50 dark:bg-slate-900/50 rounded-2xl outline-none border border-slate-100 dark:border-slate-700 text-sm text-slate-800 dark:text-white appearance-none focus:border-blue-300 dark:focus:border-blue-700 transition-colors"
              value={form.time}
              onChange={(e) => patch({ time: e.target.value })}
            />
            {/* ✅ Indicador visual de campo opcional */}
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase text-slate-300 pointer-events-none">
              Opcional
            </span>
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all uppercase tracking-widest text-xs"
          aria-label={form.editId ? 'Salvar alterações do lembrete' : 'Criar novo lembrete'}
        >
          {form.editId ? 'Salvar Alterações' : 'Confirmar'}
        </button>

        <AnimatePresence>
          {form.editId && (
            <motion.button
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              type="button"
              onClick={resetForm}
              aria-label="Cancelar edição do lembrete"
              className="w-full text-[10px] text-slate-400 font-bold uppercase tracking-tighter py-1"
            >
              Cancelar Edição
            </motion.button>
          )}
        </AnimatePresence>
      </form>

      {/* ── 3. LEMBRETES FUTUROS / HOJE ──────────────────────────────────────── */}
      <div className="space-y-3" role="region" aria-label="Próximos lembretes">
        {upcoming.length === 0 ? (
          <p className="text-center text-slate-300 py-10 font-black uppercase text-[10px] tracking-[0.2em]">
            Nenhum lembrete futuro
          </p>
        ) : (
          <AnimatePresence>
            {upcoming.map((rem) => (
              <ReminderCard
                key={rem.id}
                reminder={rem}
                isPast={false}
                onEdit={handleEditRequest}
                onDelete={handleDeleteRequest}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* ── 4. HISTÓRICO COLAPSÁVEL ───────────────────────────────────────────── */}
      {past.length > 0 && (
        <div className="pb-10" role="region" aria-label="Histórico de lembretes passados">
          <button
            onClick={() => setHistoryOpen((v) => !v)}
            aria-expanded={historyOpen}
            aria-controls="history-list"
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-400 font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
          >
            <span>Histórico ({past.length})</span>
            {historyOpen
              ? <ChevronUp size={14} aria-hidden="true" />
              : <ChevronDown size={14} aria-hidden="true" />}
          </button>

          <AnimatePresence>
            {historyOpen && (
              <motion.div
                id="history-list"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 space-y-3 overflow-hidden"
              >
                {past.map((rem) => (
                  <ReminderCard
                    key={rem.id}
                    reminder={rem}
                    isPast={true}
                    onEdit={handleEditRequest}
                    onDelete={handleDeleteRequest}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── 5. MODAL DE CONFIRMAÇÃO ───────────────────────────────────────────── */}
      <ConfirmDeleteModal
        reminder={reminderToDelete}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setReminderToDelete(null)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 📌 LEMBRETE: adicionar em useDashboardData.ts (ou Dashboard.tsx)
// ─────────────────────────────────────────────────────────────────────────────
//
// const saveReminder = async ({ text, date, time, editId }) => {
//   const payload = { text, reminder_date: date, reminder_time: time, user_id: user?.id };
//   if (!user) throw new Error('Usuário não autenticado');
//   if (editId) {
//     const { error } = await supabase.from('reminders').update(payload).eq('id', editId);
//     if (error) throw error;
//   } else {
//     const { error } = await supabase.from('reminders').insert(payload);
//     if (error) throw error;
//   }
// };
//
// const deleteReminder = async (id: string) => {
//   const { error } = await supabase.from('reminders').delete().eq('id', id);
//   if (error) throw error;
// };
//
// Passar para TabAvisos como:
//   <TabAvisos ... onSave={saveReminder} onDelete={deleteReminder} />
// ─────────────────────────────────────────────────────────────────────────────