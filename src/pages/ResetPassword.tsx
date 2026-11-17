import { useState, type FormEvent } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';

const INPUT_CLS =
  'w-full min-h-[44px] p-4 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 rounded-xl border border-slate-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500';

// Tela exibida ao abrir o link de "Esqueci minha senha"
export default function ResetPassword() {
  const { finishPasswordRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (password !== confirm) { setError('As senhas não conferem.'); return; }
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(err.message.toLowerCase().includes('different from the old')
        ? 'A nova senha precisa ser diferente da anterior.'
        : 'Não foi possível salvar. O link pode ter expirado — peça outro.');
      return;
    }
    window.location.hash = '/';
    finishPasswordRecovery();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-50 dark:bg-slate-900 font-sans">
      <form onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl border border-transparent dark:border-slate-700">
        <div className="text-center mb-4">
          <div className="inline-flex p-4 bg-blue-600 rounded-2xl mb-4 text-white shadow-lg">
            <KeyRound size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Nova senha</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Escolha uma senha com pelo menos 6 caracteres</p>
        </div>
        <input type="password" placeholder="Nova senha" required minLength={6} autoComplete="new-password"
          className={INPUT_CLS} value={password} onChange={(e) => setPassword(e.target.value)} />
        <input type="password" placeholder="Confirmar senha" required minLength={6} autoComplete="new-password"
          className={INPUT_CLS} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {error && (
          <p role="alert" className="text-red-600 dark:text-red-400 text-sm text-center font-medium bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">{error}</p>
        )}
        <button type="submit" disabled={loading}
          className="w-full min-h-[44px] bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
          {loading && <Loader2 size={18} className="animate-spin" />}
          Salvar nova senha
        </button>
      </form>
    </div>
  );
}
