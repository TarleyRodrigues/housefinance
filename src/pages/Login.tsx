import { useState, type FormEvent } from 'react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { Wallet, Loader2, Eye, EyeOff } from 'lucide-react';

type Mode = 'login' | 'register' | 'reset';

// Mensagens do Supabase Auth → pt-BR
const translateAuthError = (msg: string): string => {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed'))       return 'Confirme seu e-mail antes de entrar.';
  if (m.includes('already registered'))        return 'Este e-mail já está cadastrado.';
  if (m.includes('password should be'))        return 'A senha precisa ter pelo menos 6 caracteres.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas. Aguarde alguns minutos.';
  if (m.includes('invalid email') || m.includes('unable to validate email')) return 'E-mail inválido.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sem conexão. Verifique sua internet.';
  return 'Não foi possível continuar. Tente novamente.';
};

const INPUT_CLS =
  'w-full min-h-[44px] p-4 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 rounded-xl border border-slate-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500';

export default function Login() {
  const [mode, setMode]         = useState<Mode>('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [info, setInfo]         = useState('');
  const navigate = useNavigate();

  const switchMode = (next: Mode) => { setMode(next); setError(''); setInfo(''); };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(''); setInfo('');
    setLoading(true);
    try {
      if (mode === 'reset') {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}${window.location.pathname}`,
        });
        if (err) throw err;
        setInfo('Enviamos um link de redefinição para o seu e-mail.');
        return;
      }
      const { error: err } = mode === 'register'
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      navigate(mode === 'register' ? '/profile' : '/');
    } catch (err) {
      setError(translateAuthError(err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const submitLabel = mode === 'register' ? 'Criar Conta' : mode === 'reset' ? 'Enviar link' : 'Entrar';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-50 dark:bg-slate-900 font-sans">
      <div className="w-full max-w-sm space-y-8 bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl border border-transparent dark:border-slate-700">
        <div className="text-center">
          <div className="inline-flex p-4 bg-blue-600 rounded-2xl mb-4 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/40">
            <Wallet size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 italic">Finanças da Casa</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {mode === 'reset' ? 'Recuperar senha' : 'Controle compartilhado'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email" placeholder="E-mail" required autoComplete="email" inputMode="email"
            className={INPUT_CLS}
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
          {mode !== 'reset' && (
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'} placeholder="Senha" required minLength={6}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                className={`${INPUT_CLS} pr-12`}
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" onClick={() => setShowPass(v => !v)}
                aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-slate-400">
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="text-red-600 dark:text-red-400 text-sm text-center font-medium bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">{error}</p>
          )}
          {info && (
            <p role="status" className="text-emerald-700 dark:text-emerald-400 text-sm text-center font-medium bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded-lg">{info}</p>
          )}
          <button type="submit" disabled={loading}
            className="w-full min-h-[44px] bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {loading && <Loader2 size={18} className="animate-spin" />}
            {submitLabel}
          </button>
        </form>

        <div className="space-y-1">
          {mode === 'login' && (
            <button type="button" onClick={() => switchMode('reset')}
              className="w-full min-h-[44px] text-blue-500 text-sm font-medium">
              Esqueci minha senha
            </button>
          )}
          <button type="button" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
            className="w-full min-h-[44px] text-slate-400 text-sm">
            {mode === 'login' ? 'Não tem conta? Cadastre-se' : 'Voltar para o login'}
          </button>
        </div>
      </div>
    </div>
  );
}
