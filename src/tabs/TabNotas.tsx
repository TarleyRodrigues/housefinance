// ─── ABA: NOTAS ──────────────────────────────────────────────────────────────
// ✅ Notas privadas — visíveis só para o autor
// ✅ Separação visual entre notas compartilhadas e privadas
// ✅ Toggle de privacidade no editor com ícone de cadeado
// ✅ Busca por título/conteúdo
// ✅ Aviso de alterações não salvas ao fechar editor

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, X, Save, Trash2, Lock, LockOpen, Users, ChevronDown, Search, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { haptic } from '../utils/haptic';
import type { Note } from '../types';

interface Props {
  notes: Note[];
  fetchData: (force?: boolean) => void;
  showToast: (msg: string, type?: string) => void;
}

const PRESET_COLORS = [
  { name: 'Padrão', hex: '#ffffff' },
  { name: 'Azul',   hex: '#3b82f6' },
  { name: 'Verde',  hex: '#10b981' },
  { name: 'Âmbar',  hex: '#f59e0b' },
  { name: 'Rosa',   hex: '#ec4899' },
  { name: 'Roxo',   hex: '#8b5cf6' },
  { name: 'Ardósia',hex: '#64748b' },
];

// ─── Card de nota ─────────────────────────────────────────────────────────────
function NoteCard({ note, isOwn, onOpen, index }: {
  note: Note;
  isOwn: boolean;
  onOpen: (note: Note) => void;
  index: number;
}) {
  const hasColor = note.color && note.color !== '#ffffff';

  return (
    <motion.button
      layout
      key={note.id}
      onClick={() => onOpen(note)}
      initial={{ opacity: 0, scale: 0.93, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25 }}
      className="text-left rounded-[1.5rem] border shadow-sm active:scale-95 transition-all overflow-hidden relative flex flex-col min-h-[140px] bg-white dark:bg-slate-800"
      style={{
        backgroundColor: hasColor ? `${note.color}12` : undefined,
        borderColor:      hasColor ? `${note.color}30` : undefined,
      }}
    >
      {/* Faixa de cor no topo */}
      {hasColor && (
        <div className="h-1.5 w-full rounded-t-[1.5rem]" style={{ backgroundColor: note.color! }} />
      )}

      <div className="flex-1 p-4">
        {/* Título */}
        <p
          className="font-black text-xs uppercase tracking-tight leading-snug mb-1.5 line-clamp-2 text-slate-800 dark:text-slate-200"
          style={{ color: hasColor ? note.color! : undefined }}
        >
          {note.title}
        </p>

        {/* Conteúdo */}
        {note.content ? (
          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-3 font-medium">
            {note.content}
          </p>
        ) : (
          <p className="text-[10px] text-slate-300 dark:text-slate-600 italic font-medium">Sem conteúdo</p>
        )}
      </div>

      {/* Rodapé */}
      <div className="px-4 pb-3 flex items-center justify-between gap-2">
        <p className="text-[8px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest border-t border-slate-100 dark:border-slate-700/50 pt-2 flex-1">
          {format(parseISO(note.created_at), 'dd MMM yyyy', { locale: ptBR })}
        </p>

        {/* Badges */}
        <div className="flex items-center gap-1 mt-1.5">
          {note.is_private && (
            <span className="flex items-center gap-0.5 bg-slate-800 dark:bg-slate-700 text-white px-1.5 py-0.5 rounded-lg">
              <Lock size={8} strokeWidth={3} />
              <span className="text-[7px] font-black uppercase tracking-wider">Privada</span>
            </span>
          )}
          {!note.is_private && note.profiles?.full_name && (
            <span
              className="text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-lg"
              style={hasColor
                ? { backgroundColor: note.color! + '25', color: note.color! }
                : { backgroundColor: '#3b82f620', color: '#3b82f6' }}
            >
              {note.profiles.full_name.split(' ')[0]}
            </span>
          )}
          {!isOwn && !note.is_private && (
            <span className="flex items-center gap-0.5 text-slate-400 dark:text-slate-500">
              <Users size={8} />
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function TabNotas({ notes, fetchData, showToast }: Props) {
  const { user } = useAuth();

  const [showPrivate, setShowPrivate]     = useState(false);
  const [isEditorOpen, setIsEditorOpen]   = useState(false);
  const [noteTitle, setNoteTitle]         = useState('');
  const [noteContent, setNoteContent]     = useState('');
  const [noteColor, setNoteColor]         = useState('#ffffff');
  const [noteIsPrivate, setNoteIsPrivate] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [isSaving, setIsSaving]           = useState(false);
  const [searchTerm, setSearchTerm]       = useState('');
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [originalNote, setOriginalNote]   = useState<{ title: string; content: string } | null>(null);

  // Filtro de busca + separação compartilhadas/privadas
  const { sharedNotes, privateNotes } = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    const filtered = q
      ? notes.filter(n =>
          n.title.toLowerCase().includes(q) ||
          (n.content || '').toLowerCase().includes(q)
        )
      : notes;
    return {
      sharedNotes:  filtered.filter(n => !n.is_private),
      privateNotes: filtered.filter(n => n.is_private),
    };
  }, [notes, searchTerm]);

  const hasUnsavedChanges = originalNote !== null && (
    noteTitle.trim() !== originalNote.title.trim() ||
    noteContent !== originalNote.content
  );

  const openNew = () => {
    setEditingNoteId(null);
    setNoteTitle('');
    setNoteContent('');
    setNoteColor('#ffffff');
    setNoteIsPrivate(false);
    setOriginalNote({ title: '', content: '' });
    setIsEditorOpen(true);
  };

  const openEdit = (note: Note) => {
    setEditingNoteId(note.id);
    setNoteTitle(note.title);
    setNoteContent(note.content || '');
    setNoteColor(note.color || '#ffffff');
    setNoteIsPrivate(note.is_private ?? false);
    setOriginalNote({ title: note.title, content: note.content || '' });
    setIsEditorOpen(true);
  };

  const handleCloseEditor = () => {
    if (hasUnsavedChanges) {
      setShowCloseWarning(true);
    } else {
      setIsEditorOpen(false);
      setOriginalNote(null);
    }
  };

  const saveNote = async () => {
    if (!noteTitle.trim() || isSaving) return;
    setIsSaving(true);
    const payload = {
      title:      noteTitle.trim(),
      content:    noteContent,
      color:      noteColor,
      is_private: noteIsPrivate,
      user_id:    user.id,
    };

    try {
      if (editingNoteId) {
        const { error } = await supabase.from('notes').update(payload).eq('id', editingNoteId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('notes').insert(payload);
        if (error) throw error;
      }
      haptic('light');
      setIsEditorOpen(false);
      setOriginalNote(null);
      setShowCloseWarning(false);
      showToast('Nota salva!');
      fetchData();
    } catch {
      showToast('Erro ao salvar nota', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteNote = async (id: string) => {
    haptic('heavy');
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) { showToast('Erro ao apagar', 'error'); return; }
    setIsEditorOpen(false);
    setOriginalNote(null);
    showToast('Nota apagada', 'info');
    fetchData();
  };

  const canEdit = (note: Note) => !note.is_private || note.user_id === user?.id;

  return (
    <div className="space-y-5 pb-10">

      {/* Botão nova nota */}
      <button
        onClick={openNew}
        className="w-full p-5 bg-gradient-to-r from-amber-400 to-orange-400 text-slate-900 rounded-[2rem] font-black shadow-lg shadow-amber-400/30 flex items-center justify-center gap-2 active:scale-95 uppercase text-xs tracking-widest transition-all"
      >
        <Plus size={20} strokeWidth={3} /> Criar Anotação
      </button>

      {/* Busca */}
      {notes.length > 0 && (
        <div className="relative">
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar notas..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 text-sm outline-none font-medium text-slate-700 dark:text-slate-300 placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-blue-300 dark:focus:border-blue-700 transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-300 dark:text-slate-600 active:scale-90 transition-all"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {notes.length === 0 ? (
        <p className="text-center text-slate-300 dark:text-slate-600 py-16 font-black uppercase text-[10px] tracking-[0.2em]">
          Nenhuma nota — crie a primeira acima
        </p>
      ) : searchTerm && sharedNotes.length === 0 && privateNotes.length === 0 ? (
        <p className="text-center text-slate-300 dark:text-slate-600 py-10 font-black uppercase text-[10px] tracking-[0.2em]">
          Nenhuma nota encontrada para "{searchTerm}"
        </p>
      ) : null}

      {/* ── Notas compartilhadas ── */}
      {sharedNotes.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users size={12} className="text-slate-400" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Compartilhadas · {sharedNotes.length}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {sharedNotes.map((note, i) => (
              <NoteCard
                key={note.id}
                note={note}
                isOwn={note.user_id === user?.id}
                onOpen={(n) => canEdit(n) && openEdit(n)}
                index={i}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Notas privadas (colapsável) ── */}
      {privateNotes.length > 0 && (
        <div>
          <button
            onClick={() => setShowPrivate(v => !v)}
            className="w-full flex items-center justify-between px-1 py-2 mb-1 active:opacity-70 transition-opacity"
          >
            <div className="flex items-center gap-2">
              <Lock size={12} className="text-slate-500" />
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                Suas notas privadas · {privateNotes.length}
              </span>
            </div>
            <ChevronDown
              size={14}
              className={`text-slate-400 transition-transform duration-200 ${showPrivate ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence>
            {showPrivate && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-3 pt-2">
                  {privateNotes.map((note, i) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      isOwn={true}
                      onOpen={openEdit}
                      index={i}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Editor fullscreen ── */}
      <AnimatePresence>
        {isEditorOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-0 bg-white dark:bg-slate-900 z-[100] flex flex-col p-6 transition-colors relative"
          >
            {/* Header do editor */}
            <div className="flex items-center justify-between mb-5">
              <button
                onClick={handleCloseEditor}
                className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 transition-colors active:scale-90"
              >
                <X size={22} />
              </button>

              <h3 className="font-black text-slate-800 dark:text-slate-200 uppercase text-sm tracking-widest">
                {editingNoteId ? 'Editar' : 'Nova'} Nota
              </h3>

              <button
                onClick={saveNote}
                disabled={isSaving || !noteTitle.trim()}
                className="p-3 bg-blue-600 rounded-full text-white shadow-lg shadow-blue-500/30 transition-all active:scale-90 disabled:opacity-40"
              >
                <Save size={22} />
              </button>
            </div>

            {/* Toggle privacidade */}
            <button
              type="button"
              onClick={() => setNoteIsPrivate(v => !v)}
              className={`flex items-center justify-between px-4 py-3 rounded-2xl border mb-4 transition-all ${
                noteIsPrivate
                  ? 'bg-slate-900 dark:bg-slate-700 border-slate-700 dark:border-slate-600'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-3">
                {noteIsPrivate
                  ? <Lock size={15} className="text-white" />
                  : <LockOpen size={15} className="text-slate-400" />
                }
                <div className="text-left">
                  <p className={`text-xs font-black uppercase tracking-wider ${
                    noteIsPrivate ? 'text-white' : 'text-slate-500 dark:text-slate-400'
                  }`}>
                    {noteIsPrivate ? 'Nota privada' : 'Nota compartilhada'}
                  </p>
                  <p className={`text-[9px] font-medium mt-0.5 ${
                    noteIsPrivate ? 'text-slate-400' : 'text-slate-400'
                  }`}>
                    {noteIsPrivate ? 'Só você consegue ver' : 'Visível para o casal'}
                  </p>
                </div>
              </div>
              <div className={`w-10 h-5.5 rounded-full transition-colors relative flex-shrink-0 ${
                noteIsPrivate ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-600'
              }`} style={{ height: '22px', width: '40px' }}>
                <div className={`absolute top-0.5 w-4.5 h-4.5 rounded-full shadow transition-all ${
                  noteIsPrivate
                    ? 'left-[18px] bg-white'
                    : 'left-0.5 bg-white dark:bg-slate-400'
                }`} style={{ width: '18px', height: '18px' }} />
              </div>
            </button>

            {/* Seletor de cores */}
            <div className="flex items-center gap-2.5 mb-6 overflow-x-auto no-scrollbar py-1">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.hex}
                  onClick={() => setNoteColor(c.hex)}
                  className={`w-9 h-9 rounded-full border-4 shrink-0 transition-all ${
                    noteColor === c.hex
                      ? 'border-blue-500 scale-110 shadow-md'
                      : 'border-slate-100 dark:border-slate-800 opacity-60'
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>

            {/* Título */}
            <input
              className="text-3xl font-black text-slate-800 dark:text-white outline-none mb-5 bg-transparent placeholder:text-slate-200 dark:placeholder:text-slate-700"
              placeholder="Título..."
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              autoFocus={!editingNoteId}
            />

            {/* Conteúdo */}
            <textarea
              className="flex-1 w-full outline-none text-slate-600 dark:text-slate-400 text-base resize-none bg-transparent leading-relaxed"
              placeholder="Escreva aqui..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
            />

            {/* Botão deletar */}
            {editingNoteId && (
              <button
                onClick={() => deleteNote(editingNoteId)}
                className="mt-4 p-4 text-red-500 font-black text-[10px] border-2 border-red-50 dark:border-red-900/30 rounded-2xl uppercase tracking-[0.2em] active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Trash2 size={14} /> Apagar Nota
              </button>
            )}

            {/* Overlay: alterações não salvas */}
            <AnimatePresence>
              {showCloseWarning && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-5 p-8"
                >
                  <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                    <AlertTriangle size={28} className="text-amber-500" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-black text-slate-800 dark:text-white text-base uppercase tracking-tight mb-2">
                      Alterações não salvas
                    </h3>
                    <p className="text-sm text-slate-400 font-medium leading-relaxed">
                      Se fechar agora, suas alterações serão perdidas.
                    </p>
                  </div>
                  <div className="flex gap-3 w-full">
                    <button
                      onClick={() => { setShowCloseWarning(false); setIsEditorOpen(false); setOriginalNote(null); }}
                      className="flex-1 py-3 rounded-2xl bg-red-50 dark:bg-red-900/30 text-red-500 font-black text-xs uppercase tracking-wider active:scale-95 transition-all"
                    >
                      Descartar
                    </button>
                    <button
                      onClick={() => setShowCloseWarning(false)}
                      className="flex-1 py-3 rounded-2xl bg-blue-600 text-white font-black text-xs uppercase tracking-wider active:scale-95 transition-all shadow-lg shadow-blue-500/30"
                    >
                      Continuar
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
