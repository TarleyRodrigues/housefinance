// ─── ABA: NOTAS ──────────────────────────────────────────────────────────────

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, StickyNote, ChevronRight, X, Save } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import type { Note } from '../types';

interface Props {
  notes: Note[];
  fetchData: () => void;
  showToast: (msg: string, type?: string) => void;
}

export function TabNotas({ notes, fetchData, showToast }: Props) {
  const { user } = useAuth();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  const openNew = () => {
    setEditingNoteId(null);
    setNoteTitle('');
    setNoteContent('');
    setIsEditorOpen(true);
  };

  const openEdit = (note: Note) => {
    setEditingNoteId(note.id);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setIsEditorOpen(true);
  };

  const saveNote = async () => {
    if (!noteTitle) return;
    const p = { title: noteTitle, content: noteContent, user_id: user.id };
    if (editingNoteId) {
      await supabase.from('notes').update(p).eq('id', editingNoteId);
    } else {
      await supabase.from('notes').insert(p);
    }
    setIsEditorOpen(false);
    showToast('Nota salva!');
    fetchData();
  };

  const deleteNote = async (id: string) => {
    if (confirm('Apagar nota permanentemente?')) {
      await supabase.from('notes').delete().eq('id', id);
      setIsEditorOpen(false);
      showToast('Nota apagada', 'info');
      fetchData();
    }
  };

  return (
    <div className="space-y-4 pb-10">
      <button
        onClick={openNew}
        className="w-full p-5 bg-amber-400 text-slate-900 rounded-[2rem] font-black shadow-lg flex items-center justify-center gap-2 active:scale-95 uppercase text-xs tracking-widest transition-all"
      >
        <Plus size={20} /> Criar Anotação
      </button>

      <div className="grid grid-cols-1 gap-3">
        {notes.map((note) => (
          <motion.button
            layout
            key={note.id}
            onClick={() => openEdit(note)}
            className="bg-white dark:bg-slate-800 p-5 rounded-[1.5rem] border border-slate-100 dark:border-slate-700 shadow-sm text-left flex items-center justify-between transition-colors"
          >
            <div className="flex items-center gap-4 overflow-hidden">
              <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center text-amber-500 shrink-0">
                <StickyNote size={24} />
              </div>
              <div className="overflow-hidden">
                <p className="font-black text-slate-800 dark:text-slate-200 truncate uppercase tracking-tighter text-sm leading-none mb-1">{note.title}</p>
                <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest">
                  {format(parseISO(note.created_at), 'dd MMM yyyy', { locale: ptBR })}
                </p>
              </div>
            </div>
            <ChevronRight size={16} className="text-slate-300" />
          </motion.button>
        ))}
      </div>

      {/* Editor fullscreen */}
      <AnimatePresence>
        {isEditorOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed inset-0 bg-white dark:bg-slate-900 z-[100] flex flex-col p-6 transition-colors"
          >
            <div className="flex items-center justify-between mb-8">
              <button onClick={() => setIsEditorOpen(false)} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 transition-colors">
                <X size={24} />
              </button>
              <h3 className="font-black text-slate-800 dark:text-slate-200 uppercase text-sm">Anotação</h3>
              <button onClick={saveNote} className="p-3 bg-blue-600 rounded-full text-white shadow-lg transition-transform active:scale-90">
                <Save size={24} />
              </button>
            </div>
            <input
              className="text-3xl font-black text-slate-800 dark:text-white outline-none mb-6 bg-transparent"
              placeholder="Título..."
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
            />
            <textarea
              className="flex-1 w-full outline-none text-slate-600 dark:text-slate-400 text-lg resize-none bg-transparent"
              placeholder="Escreva..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
            />
            {editingNoteId && (
              <button
                onClick={() => deleteNote(editingNoteId)}
                className="mt-4 p-4 text-red-400 font-black text-[10px] border-2 border-red-50 dark:border-red-900/50 rounded-2xl uppercase tracking-widest active:scale-95 transition-all"
              >
                Apagar Nota
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
