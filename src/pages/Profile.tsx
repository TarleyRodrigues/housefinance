import { useState, useEffect, useCallback, useRef, type ChangeEvent } from 'react';
import { AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Camera, User, Check, Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { Toast } from '../components/ui';
import type { ToastState } from '../types';

const MAX_PHOTO_MB = 5;

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName]           = useState('');
  const [photoUrl, setPhotoUrl]   = useState('');
  const [hasProfile, setHasProfile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState<(ToastState & { id: number }) | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((msg: string, type: string) => {
    clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), msg, type });
    toastTimer.current = setTimeout(() => setToast(null), type === 'error' ? 4500 : 3000);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // Carregar dados existentes
  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setHasProfile(true);
        setName(data.full_name || '');
        setPhotoUrl(data.avatar_url || '');
      });
  }, [user]);

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      showToast(`A foto precisa ter até ${MAX_PHOTO_MB} MB.`, 'error');
      return;
    }
    setUploading(true);
    try {
      const fileExt  = file.name.split('.').pop() || 'jpg';
      const filePath = `${user.id}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      setPhotoUrl(publicUrl);
      showToast('Foto enviada! Toque em salvar para confirmar.', 'info');
    } catch (err) {
      console.error('[Profile] upload', err);
      showToast('Erro ao enviar a foto. Tente novamente.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    if (!user || saving) return;
    if (!name.trim()) { showToast('Informe seu nome.', 'error'); return; }
    setSaving(true);
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      full_name: name.trim(),
      avatar_url: photoUrl,
    }, { onConflict: 'id' });
    setSaving(false);
    if (error) {
      console.error('[Profile] save', error);
      showToast('Erro ao salvar. Tente novamente.', 'error');
      return;
    }
    navigate('/');
  };

  return (
    <div className="max-w-md mx-auto p-6 flex flex-col items-center min-h-screen pt-12 bg-white dark:bg-slate-900">
      <AnimatePresence>
        {toast && <Toast key={toast.id} message={toast.msg} type={toast.type} />}
      </AnimatePresence>

      <div className="w-full flex items-center mb-8">
        {hasProfile && (
          <button onClick={() => navigate('/')} aria-label="Voltar"
            className="w-11 h-11 -ml-2 rounded-2xl flex items-center justify-center text-slate-500 dark:text-slate-400 active:scale-90 transition-transform">
            <ArrowLeft size={22} />
          </button>
        )}
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex-1 text-center">Seu Perfil</h1>
        {hasProfile && <span className="w-11" />}
      </div>

      <div className="relative mb-8">
        <div className="w-32 h-32 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 border-4 border-slate-50 dark:border-slate-700 shadow-inner flex items-center justify-center">
          {photoUrl ? (
            <img src={photoUrl} className="w-full h-full object-cover" alt="Avatar" />
          ) : (
            <User size={48} className="text-slate-300 dark:text-slate-600" />
          )}
        </div>
        <label aria-label="Trocar foto"
          className="absolute bottom-0 right-0 w-12 h-12 flex items-center justify-center bg-blue-600 rounded-full text-white cursor-pointer shadow-lg active:scale-90 transition-all">
          {uploading ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
          <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} />
        </label>
      </div>

      <div className="w-full space-y-6">
        <input
          type="text" placeholder="Seu nome completo" autoComplete="name"
          className="w-full min-h-[44px] p-4 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 rounded-2xl border border-slate-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
          value={name} onChange={(e) => setName(e.target.value)}
        />
        <button
          onClick={saveProfile}
          disabled={saving || uploading}
          className="w-full min-h-[44px] bg-emerald-500 text-white font-bold py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60"
        >
          {saving ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
          {hasProfile ? 'Salvar' : 'Salvar e Entrar'}
        </button>
      </div>
    </div>
  );
}
