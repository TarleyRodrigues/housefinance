import React, { useState } from 'react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { Wallet } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const { error } = isRegistering 
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
    } else {
      navigate(isRegistering ? '/profile' : '/');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-50 font-sans">
      <div className="w-full max-w-sm space-y-8 bg-white p-8 rounded-3xl shadow-xl">
        <div className="text-center">
          <div className="inline-flex p-4 bg-blue-600 rounded-2xl mb-4 text-white shadow-lg shadow-blue-200">
            <Wallet size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 italic">Finanças da Casa</h2>
          <p className="text-slate-500 mt-1">Controle compartilhado</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <input
            type="email" placeholder="E-mail" required
            className="w-full p-4 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password" placeholder="Senha" required
            className="w-full p-4 bg-slate-50 rounded-xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-red-500 text-sm text-center font-medium bg-red-50 p-2 rounded-lg">{error}</p>}
          <button className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 transition-all">
            {isRegistering ? 'Criar Conta' : 'Entrar'}
          </button>
        </form>

        <button onClick={() => setIsRegistering(!isRegistering)} className="w-full text-slate-400 text-sm">
          {isRegistering ? 'Já tem conta? Entrar' : 'Não tem conta? Cadastre-se'}
        </button>
      </div>
    </div>
  );
}