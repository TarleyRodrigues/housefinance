import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';
import { Camera, User, Check, Loader2 } from 'lucide-react';

export default function Profile() {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const navigate = useNavigate();

  // Carregar dados existentes
  useEffect(() => {
    async function loadProfile() {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) {
        setName(data.full_name || '');
        setPhotoUrl(data.avatar_url || '');
      }
    }
    if (user) loadProfile();
  }, [user]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const file = e.target.files?.[0];
      if (!file) return;

      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}-${Math.random()}.${fileExt}`;

      // 1. Upload para o bucket 'avatars'
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Pegar a URL pública
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      
      setPhotoUrl(publicUrl);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    
    const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        full_name: name,
        avatar_url: photoUrl,
    }, { onConflict: 'id' }); // Garante que ele atualize se já existir

    if (error) {
        alert("Erro ao salvar: " + error.message);
    } else {
        navigate('/');
    }
    };

  return (
    <div className="max-w-md mx-auto p-6 flex flex-col items-center min-h-screen pt-12 bg-white">
      <h1 className="text-2xl font-bold mb-8">Seu Perfil</h1>
      
      <div className="relative mb-8">
        <div className="w-32 h-32 rounded-full overflow-hidden bg-slate-100 border-4 border-slate-50 shadow-inner flex items-center justify-center">
          {photoUrl ? (
            <img src={photoUrl} className="w-full h-full object-cover" alt="Avatar" />
          ) : (
            <User size={48} className="text-slate-300" />
          )}
        </div>
        <label className="absolute bottom-0 right-0 p-3 bg-blue-600 rounded-full text-white cursor-pointer shadow-lg active:scale-90 transition-all">
          {uploading ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
          <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} />
        </label>
      </div>

      <div className="w-full space-y-6">
        <input
          type="text" placeholder="Seu nome completo"
          className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
          value={name} onChange={(e) => setName(e.target.value)}
        />
        <button 
          onClick={saveProfile}
          className="w-full bg-emerald-500 text-white font-bold py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2"
        >
          <Check size={20} /> Salvar e Entrar
        </button>
      </div>
    </div>
  );
}