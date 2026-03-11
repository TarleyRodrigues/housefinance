// ─── ABA: NOTAS ──────────────────────────────────────────────────────────────

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, StickyNote, ChevronRight, X, Save, Trash2 } from 'lucide-react';
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

// Cores pré-definidas para as notas
const PRESET_COLORS = [
  { name: 'Padrão', hex: '#ffffff' },
  { name: 'Azul', hex: '#3b82f6' },
  { name: 'Verde', hex: '#10b981' },
  { name: 'Amarelo', hex: '#f59e0b' },
  { name: 'Rosa', hex: '#ec4899' },
  { name: 'Roxo', hex: '#8b5cf6' },
];

export function TabNotas({ notes, fetchData, showToast }: Props) {
  const { user } = useAuth();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteColor, setNoteColor] = useState('#ffffff');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  const openNew = () => {
    setEditingNoteId(null);
    setNoteTitle('');
    setNoteContent('');
    setNoteColor('#ffffff');
    setIsEditorOpen(true);
  };

  const openEdit = (note: Note) => {
    setEditingNoteId(note.id);
    setNoteTitle(note.title);
    setNoteContent(note.content || '');
    setNoteColor(note.color || '#ffffff');
    setIsEditorOpen(true);
  };

  const saveNote = async () => {
    if (!noteTitle) return;
    const p = { 
      title: noteTitle, 
      content: noteContent, 
      color: noteColor, // Salva a cor selecionada
      user_id: user.id 
    };

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
        <Plus size={20} strokeWidth={3} /> Criar Anotação
      </button>

      <div className="grid grid-cols-1 gap-3">
        {notes.map((note) => (
          <motion.button
            layout
            key={note.id}
            onClick={() => openEdit(note)}
            className="bg-white dark:bg-slate-800 p-5 rounded-[1.5rem] border border-slate-100 dark:border-slate-700 shadow-sm text-left flex items-center justify-between transition-colors overflow-hidden relative"
          >
            {/* Faixa de cor lateral */}
            {note.color && note.color !== '#ffffff' && (
              <div 
                className="absolute left-0 top-0 bottom-0 w-1.5" 
                style={{ backgroundColor: note.color }}
              />
            )}

            <div className="flex items-center gap-4 overflow-hidden pl-1">
              <div 
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors"
                style={{ backgroundColor: note.color && note.color !== '#ffffff' ? `${note.color}20` : undefined }}
              >
                <StickyNote 
                  size={24} 
                  className={note.color && note.color !== '#ffffff' ? '' : 'text-amber-500'}
                  style={{ color: note.color && note.color !== '#ffffff' ? note.color : undefined }}
                />
              </div>
              <div className="overflow-hidden">
                <p className="font-black text-slate-800 dark:text-slate-200 truncate uppercase tracking-tighter text-sm leading-none mb-1">
                  {note.title}
                </p>
                <p className="text-[9px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-widest">
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
            <div className="flex items-center justify-between mb-6">
              <button onClick={() => setIsEditorOpen(false)} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 transition-colors active:scale-90">
                <X size={24} />
              </button>
              <h3 className="font-black text-slate-800 dark:text-slate-200 uppercase text-sm tracking-widest">Anotação</h3>
              <button onClick={saveNote} className="p-3 bg-blue-600 rounded-full text-white shadow-lg transition-transform active:scale-90">
                <Save size={24} />
              </button>
            </div>

            {/* SELETOR DE CORES (NOVO) */}
            <div className="flex items-center gap-3 mb-8 overflow-x-auto no-scrollbar py-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.hex}
                  onClick={() => setNoteColor(c.hex)}
                  className={`w-10 h-10 rounded-full border-4 shrink-0 transition-all ${
                    noteColor === c.hex ? 'border-blue-500 scale-110 shadow-md' : 'border-slate-100 dark:border-slate-800 opacity-60'
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>

            <input
              className="text-3xl font-black text-slate-800 dark:text-white outline-none mb-6 bg-transparent placeholder:text-slate-200 dark:placeholder:text-slate-800"
              placeholder="Título..."
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
            />
            <textarea
              className="flex-1 w-full outline-none text-slate-600 dark:text-slate-400 text-lg resize-none bg-transparent leading-relaxed"
              placeholder="Escreva aqui as informações importantes..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
            />
            
            {editingNoteId && (
              <button
                onClick={() => deleteNote(editingNoteId)}
                className="mt-4 p-4 text-red-500 font-black text-[10px] border-2 border-red-50 dark:border-red-900/30 rounded-2xl uppercase tracking-[0.2em] active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Trash2 size={14} /> Apagar Nota
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}