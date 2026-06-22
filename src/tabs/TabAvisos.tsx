// ─── ABA: LEMBRETES / AVISOS ─────────────────────────────────────────────────

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  Bell, Calendar, Clock, Edit2, Trash2,
  ChevronDown, ChevronUp, AlertTriangle, ChevronLeft, ChevronRight,
} from 'lucide-react';
import {
  format, parseISO, isBefore, isToday as dateFnsIsToday,
  startOfToday, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay,
  startOfMonth, endOfMonth, isSameMonth, addMonths, subMonths, getYear,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import type { Reminder } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Feriados Nacionais Brasileiros
// ─────────────────────────────────────────────────────────────────────────────

function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getBrazilianHolidays(year: number): Map<string, string> {
  const add = (d: Date, days: number): Date => {
    const r = new Date(d);
    r.setDate(r.getDate() + days);
    return r;
  };
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
  const easter = getEasterDate(year);

  return new Map<string, string>([
    [`${year}-01-01`, 'Confraternização Universal'],
    [`${year}-04-21`, 'Tiradentes'],
    [`${year}-05-01`, 'Dia do Trabalho'],
    [`${year}-09-07`, 'Independência do Brasil'],
    [`${year}-10-12`, 'Nossa Senhora Aparecida'],
    [`${year}-11-02`, 'Finados'],
    [`${year}-11-15`, 'Proclamação da República'],
    [`${year}-12-25`, 'Natal'],
    [fmt(add(easter, -48)), 'Carnaval (Seg)'],
    [fmt(add(easter, -47)), 'Carnaval (Ter)'],
    [fmt(add(easter, -2)),  'Sexta-Feira Santa'],
    [fmt(easter),           'Páscoa'],
    [fmt(add(easter, 60)),  'Corpus Christi'],
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB: MonthCalendar
// ─────────────────────────────────────────────────────────────────────────────
function MonthCalendar({ reminders, reminderDateSet }: {
  reminders: Reminder[];
  reminderDateSet: Set<string>;
}) {
  const [isOpen, setIsOpen]           = useState(false);
  const [calMonth, setCalMonth]       = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const year       = getYear(calMonth);
  const holidayMap = useMemo(() => getBrazilianHolidays(year), [year]);

  const remindersByDate = useMemo(() => {
    const map = new Map<string, Reminder[]>();
    reminders.forEach((r) => {
      const list = map.get(r.reminder_date) ?? [];
      map.set(r.reminder_date, [...list, r]);
    });
    return map;
  }, [reminders]);

  const calDays = useMemo(() => {
    const first = startOfMonth(calMonth);
    const last  = endOfMonth(calMonth);
    return eachDayOfInterval({
      start: startOfWeek(first, { weekStartsOn: 0 }),
      end:   endOfWeek(last,   { weekStartsOn: 0 }),
    });
  }, [calMonth]);

  const remindersThisMonth = useMemo(() => {
    const prefix = format(calMonth, 'yyyy-MM');
    return [...reminderDateSet].filter((d) => d.startsWith(prefix)).length;
  }, [reminderDateSet, calMonth]);

  return (
    <div
      className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-3xl border border-white/80 dark:border-slate-700/50 shadow-[0_2px_20px_rgba(0,0,0,0.06)] dark:shadow-slate-900/30 overflow-hidden"
      role="region"
      aria-label="Calendário mensal"
    >
      {/* ── Toggle ── */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between p-4 active:bg-slate-50 dark:active:bg-slate-700/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Calendar size={15} className="text-blue-500" aria-hidden="true" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 capitalize">
            {format(calMonth, 'MMMM yyyy', { locale: ptBR })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {remindersThisMonth > 0 && (
            <span className="text-[8px] font-black text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-lg">
              {remindersThisMonth} lembrete{remindersThisMonth !== 1 ? 's' : ''}
            </span>
          )}
          <ChevronDown
            size={15}
            aria-hidden="true"
            className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* ── Conteúdo expansível ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {/* Navegação de mês */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setCalMonth((m) => subMonths(m, 1))}
                  aria-label="Mês anterior"
                  className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 active:scale-90 transition-all"
                >
                  <ChevronLeft size={13} aria-hidden="true" />
                </button>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 capitalize">
                  {format(calMonth, 'MMMM yyyy', { locale: ptBR })}
                </span>
                <button
                  onClick={() => setCalMonth((m) => addMonths(m, 1))}
                  aria-label="Próximo mês"
                  className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 active:scale-90 transition-all"
                >
                  <ChevronRight size={13} aria-hidden="true" />
                </button>
              </div>

              {/* Cabeçalho dos dias */}
              <div className="grid grid-cols-7">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
                  <div key={d} className="text-center text-[8px] font-black uppercase text-slate-300 dark:text-slate-600 py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Grade de dias */}
              <div className="grid grid-cols-7 gap-0.5">
                {calDays.map((day) => {
                  const dateStr     = format(day, 'yyyy-MM-dd');
                  const inMonth     = isSameMonth(day, calMonth);
                  const hasReminder = reminderDateSet.has(dateStr);
                  const holiday     = holidayMap.get(dateStr);
                  const isToday     = isSameDay(day, new Date());
                  const isSelected  = selectedDay === dateStr;
                  const isClickable = (hasReminder || Boolean(holiday)) && inMonth;

                  return (
                    <div
                      key={dateStr}
                      title={holiday ?? undefined}
                      aria-label={`${format(day, "d 'de' MMMM", { locale: ptBR })}${hasReminder ? ' — tem lembrete' : ''}${holiday ? ` — ${holiday}` : ''}`}
                      onClick={isClickable ? () => setSelectedDay((prev) => prev === dateStr ? null : dateStr) : undefined}
                      className={[
                        'flex flex-col items-center justify-center rounded-xl py-1.5 min-h-[34px] transition-colors',
                        isClickable ? 'cursor-pointer' : '',
                        !inMonth    ? 'opacity-20'    : '',
                        isSelected && !isToday ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-white dark:ring-offset-slate-800' : '',
                        isToday     ? 'bg-blue-600'   : '',
                        holiday && !isToday ? 'bg-red-50 dark:bg-red-900/20' : '',
                        !isToday && !holiday && inMonth ? 'hover:bg-slate-50 dark:hover:bg-slate-700/30' : '',
                      ].join(' ')}
                    >
                      <span className={`text-[10px] font-black leading-none ${
                        isToday  ? 'text-white'
                        : holiday ? 'text-red-500 dark:text-red-400'
                        : 'text-slate-700 dark:text-slate-300'
                      }`}>
                        {format(day, 'd')}
                      </span>
                      {(hasReminder || (holiday && !isToday)) && (
                        <div className="flex gap-[2px] mt-0.5" aria-hidden="true">
                          {hasReminder && (
                            <div className={`w-1 h-1 rounded-full ${isToday ? 'bg-white/80' : 'bg-blue-500'}`} />
                          )}
                          {holiday && !isToday && (
                            <div className="w-1 h-1 rounded-full bg-red-400" />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Painel de detalhes do dia selecionado */}
              <AnimatePresence>
                {selectedDay && (remindersByDate.has(selectedDay) || holidayMap.has(selectedDay)) && (
                  <motion.div
                    key={selectedDay}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-3 space-y-2 border border-slate-100 dark:border-slate-700">
                      <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                        {format(parseISO(selectedDay), "dd 'de' MMMM", { locale: ptBR })}
                      </p>
                      {holidayMap.get(selectedDay) && (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" aria-hidden="true" />
                          <span className="text-[11px] font-bold text-red-500 dark:text-red-400">
                            {holidayMap.get(selectedDay)}
                          </span>
                        </div>
                      )}
                      {(remindersByDate.get(selectedDay) ?? []).map((rem) => (
                        <div key={rem.id} className="flex items-start gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1" aria-hidden="true" />
                          <div>
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                              {rem.text}
                            </span>
                            {rem.reminder_time && (
                              <span className="text-[9px] text-slate-400 font-bold flex items-center gap-0.5 mt-0.5">
                                <Clock size={8} aria-hidden="true" />
                                {rem.reminder_time.slice(0, 5)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Legenda */}
              <div className="flex items-center gap-4 pt-2 border-t border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-blue-500" aria-hidden="true" />
                  <span className="text-[8px] font-black uppercase text-slate-400">Lembrete</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-400" aria-hidden="true" />
                  <span className="text-[8px] font-black uppercase text-slate-400">Feriado nacional</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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
// SUB: ConfirmDeleteModal
// ─────────────────────────────────────────────────────────────────────────────
function ConfirmDeleteModal({ reminder, onConfirm, onCancel }: {
  reminder: Reminder | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!reminder) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-end justify-center p-4"
        role="dialog" aria-modal="true" aria-labelledby="confirm-delete-reminder-title"
        onClick={onCancel}
      >
        <motion.div
          initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle size={24} className="text-red-500" aria-hidden="true" />
            </div>
            <h3 id="confirm-delete-reminder-title"
              className="font-black text-slate-800 dark:text-white text-base uppercase tracking-tight">
              Apagar lembrete?
            </h3>
            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              <span className="font-bold text-slate-600 dark:text-slate-300">{reminder.text}</span>
              <br />Esta ação não pode ser desfeita.
            </p>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={onCancel}
              className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-wider active:scale-95 transition-all">
              Cancelar
            </button>
            <button onClick={onConfirm}
              className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-black text-xs uppercase tracking-wider active:scale-95 transition-all shadow-lg shadow-red-500/30">
              Apagar
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB: ReminderCard
// ─────────────────────────────────────────────────────────────────────────────
function ReminderCard({ reminder, isPast, onEdit, onDelete }: {
  reminder: Reminder;
  isPast: boolean;
  onEdit: (rem: Reminder) => void;
  onDelete: (rem: Reminder) => void;
}) {
  const remDateObj = parseISO(reminder.reminder_date);
  const isHoje     = dateFnsIsToday(remDateObj);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
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
          aria-hidden="true"
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isPast  ? 'bg-slate-100 dark:bg-slate-700 text-slate-400'
            : isHoje ? 'bg-blue-600 text-white shadow-lg shadow-blue-300/40'
            : 'bg-blue-50 dark:bg-blue-900/20 text-blue-500'
          }`}
        >
          <Calendar size={18} />
        </div>
        <div>
          {isHoje && !isPast && (
            <span className="text-[8px] font-black uppercase tracking-widest text-blue-500 block mb-0.5">
              Hoje
            </span>
          )}
          <p className={`font-bold text-sm leading-tight ${
            isPast ? 'text-slate-500 line-through' : 'text-slate-800 dark:text-slate-200'
          }`}>
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
        <button onClick={() => onEdit(reminder)} aria-label={`Editar lembrete: ${reminder.text}`}
          className="p-2 text-blue-400 hover:text-blue-600 active:scale-90 transition-all rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20">
          <Edit2 size={15} />
        </button>
        <button onClick={() => onDelete(reminder)} aria-label={`Apagar lembrete: ${reminder.text}`}
          className="p-2 text-slate-300 dark:text-slate-500 hover:text-red-400 active:scale-90 transition-all rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20">
          <Trash2 size={15} />
        </button>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  reminders: Reminder[];
  fetchData: () => void;
  showToast: (msg: string, type?: string) => void;
  onSave: (payload: { text: string; date: string; time: string; editId: string | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export function TabAvisos({ reminders, fetchData, showToast, onSave, onDelete }: Props) {
  const [form, setForm]                   = useState<FormState>(EMPTY_FORM);
  const resetForm                         = useCallback(() => setForm(EMPTY_FORM), []);
  const patch = (partial: Partial<FormState>) => setForm((f) => ({ ...f, ...partial }));

  const [reminderToDelete, setReminderToDelete] = useState<Reminder | null>(null);
  const [historyOpen, setHistoryOpen]           = useState(false);
  const [formOpen, setFormOpen]                 = useState(false);

  const formRef = useRef<HTMLDivElement>(null);

  const today    = startOfToday();
  const todayStr = format(today, 'yyyy-MM-dd');

  // Dias da semana atual
  const daysOfCurrentWeek = useMemo(
    () => eachDayOfInterval({
      start: startOfWeek(new Date(), { weekStartsOn: 0 }),
      end:   endOfWeek(new Date(),   { weekStartsOn: 0 }),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todayStr]
  );

  // Set de datas com lembretes — O(1)
  const reminderDateSet = useMemo(
    () => new Set(reminders.map((r) => r.reminder_date)),
    [reminders]
  );

  // Lembretes separados e ordenados
  const { upcoming, past } = useMemo(() => {
    const sorted = [...reminders].sort(
      (a, b) => new Date(a.reminder_date).getTime() - new Date(b.reminder_date).getTime()
    );
    return {
      upcoming: sorted.filter((r) => !isBefore(parseISO(r.reminder_date), today)),
      past: sorted.filter((r) => isBefore(parseISO(r.reminder_date), today)).reverse(),
    };
  }, [reminders, today]);

  // Abre e scrolla o form ao entrar em modo de edição
  useEffect(() => {
    if (form.editId) {
      setFormOpen(true);
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
  }, [form.editId]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSubmit = async (e: { preventDefault(): void }) => {
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

  const handleDeleteRequest  = useCallback((rem: Reminder) => setReminderToDelete(rem), []);

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

      {/* ── 1. CALENDÁRIO MENSAL ─────────────────────────────────────────────── */}
      <MonthCalendar reminders={reminders} reminderDateSet={reminderDateSet} />

      {/* ── 2. AGENDA DA SEMANA ──────────────────────────────────────────────── */}
      <div
        className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm p-4 rounded-3xl border border-white/80 dark:border-slate-700/50 shadow-[0_2px_20px_rgba(0,0,0,0.06)] dark:shadow-slate-900/30 overflow-hidden"
        role="region" aria-label="Agenda da semana atual"
      >
        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 px-2">
          Esta Semana
        </h4>
        <div className="flex justify-between overflow-x-auto no-scrollbar gap-2 pb-2 px-1 snap-x">
          {daysOfCurrentWeek.map((day, i) => {
            const isHoje      = isSameDay(day, new Date());
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

      {/* ── 3. FORMULÁRIO (colapsável) ───────────────────────────────────────── */}
      <div
        ref={formRef}
        className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-3xl border border-white/80 dark:border-slate-700/50 shadow-[0_2px_20px_rgba(0,0,0,0.06)] dark:shadow-slate-900/30 overflow-hidden scroll-mt-4"
      >
        {/* Toggle */}
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          aria-expanded={formOpen}
          className="w-full flex items-center justify-between p-4 active:bg-slate-50 dark:active:bg-slate-700/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Bell size={15} className="text-blue-500" aria-hidden="true" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400" aria-live="polite">
              {form.editId ? 'Editar Lembrete' : 'Novo Lembrete'}
            </span>
          </div>
          <ChevronDown
            size={15}
            aria-hidden="true"
            className={`text-slate-400 transition-transform duration-200 ${formOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Conteúdo expansível */}
        <AnimatePresence>
          {formOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <form
                onSubmit={handleSubmit}
                className="px-5 pb-5 space-y-4"
                aria-label={form.editId ? 'Editar lembrete' : 'Criar novo lembrete'}
              >
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

                <div className="space-y-3">
                  {/* Data */}
                  <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden focus-within:border-blue-300 dark:focus-within:border-blue-700 transition-colors">
                    <label htmlFor="rem-date" className="flex items-center gap-1.5 px-4 pt-3 pb-1 cursor-pointer">
                      <Calendar size={12} className="text-slate-400" aria-hidden="true" />
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Data</span>
                    </label>
                    <input
                      id="rem-date" type="date" required min={todayStr}
                      className="w-full px-4 pb-3 bg-transparent outline-none text-sm text-slate-800 dark:text-white font-bold"
                      value={form.date}
                      onChange={(e) => patch({ date: e.target.value })}
                    />
                  </div>

                  {/* Hora */}
                  <div className="relative">
                    <Clock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
                    <label htmlFor="rem-time" className="sr-only">Horário (opcional)</label>
                    <input
                      id="rem-time" type="time"
                      className="w-full p-4 pl-12 bg-slate-50 dark:bg-slate-900/50 rounded-2xl outline-none border border-slate-100 dark:border-slate-700 text-sm text-slate-800 dark:text-white appearance-none focus:border-blue-300 dark:focus:border-blue-700 transition-colors"
                      value={form.time}
                      onChange={(e) => patch({ time: e.target.value })}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase text-slate-300 pointer-events-none">
                      Opcional
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all uppercase tracking-widest text-xs"
                >
                  {form.editId ? 'Salvar Alterações' : 'Confirmar'}
                </button>

                <AnimatePresence>
                  {form.editId && (
                    <motion.button
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      type="button" onClick={resetForm}
                      className="w-full text-[10px] text-slate-400 font-bold uppercase tracking-tighter py-1"
                    >
                      Cancelar Edição
                    </motion.button>
                  )}
                </AnimatePresence>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── 4. LEMBRETES FUTUROS ─────────────────────────────────────────────── */}
      <div className="space-y-3" role="region" aria-label="Próximos lembretes">
        {upcoming.length === 0 ? (
          <p className="text-center text-slate-300 py-10 font-black uppercase text-[10px] tracking-[0.2em]">
            Nenhum lembrete futuro
          </p>
        ) : (
          <AnimatePresence>
            {upcoming.map((rem) => (
              <ReminderCard key={rem.id} reminder={rem} isPast={false}
                onEdit={handleEditRequest} onDelete={handleDeleteRequest} />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* ── 5. HISTÓRICO COLAPSÁVEL ───────────────────────────────────────────── */}
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
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 space-y-3 overflow-hidden"
              >
                {past.map((rem) => (
                  <ReminderCard key={rem.id} reminder={rem} isPast={true}
                    onEdit={handleEditRequest} onDelete={handleDeleteRequest} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── 6. MODAL DE CONFIRMAÇÃO ───────────────────────────────────────────── */}
      <ConfirmDeleteModal
        reminder={reminderToDelete}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setReminderToDelete(null)}
      />
    </div>
  );
}
