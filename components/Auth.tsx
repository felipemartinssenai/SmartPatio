
import React, { useState } from 'react';
import { supabase } from '../services/supabase';

const AuthComponent: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await (supabase.auth as any).signInWithPassword({ email, password });
      
      if (error) {
        if (error.message.includes('Email not confirmed')) {
          setError('⚠️ ACESSO PENDENTE: Sua conta ainda não foi ativada no banco de dados. Solicite ao administrador que execute o "Script SQL v16.0" no painel do Supabase para liberar seu acesso instantaneamente.');
        } else if (error.message === 'Invalid login credentials') {
          setError('E-mail ou senha incorretos. Verifique seus dados.');
        } else {
          throw error;
        }
      }
    } catch (error: any) {
      setError(error.error_description || error.message || 'Erro ao realizar login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <div className="w-full max-w-md bg-gray-800 rounded-2xl shadow-2xl p-8 space-y-8 border border-gray-700">
        <div className="text-center">
          <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-900/40 transform rotate-3">
             <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter italic">Pátio<span className="text-blue-500">Log</span></h1>
          <p className="text-gray-400 text-[10px] mt-2 font-black uppercase tracking-[0.2em]">Gestão de Pátio e Guinchos</p>
        </div>
        
        {error && (
            <div className={`p-4 rounded-xl text-xs font-bold text-center border leading-relaxed animate-in fade-in slide-in-from-top-1 ${error.includes('⚠️') ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                {error}
            </div>
        )}

        <form onSubmit={handleAuth} className="space-y-5">
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">E-mail Corporativo</label>
            <input
              className="w-full px-5 py-4 bg-gray-900/50 border border-gray-700 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-gray-700 font-medium"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="seu@email.com"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Senha de Acesso</label>
            <input
              className="w-full px-5 py-4 bg-gray-900/50 border border-gray-700 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-gray-700 font-medium"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-blue-600 hover:bg-blue-500 rounded-2xl text-white font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-900/40 disabled:opacity-50 active:scale-95 flex items-center justify-center gap-3 mt-2"
          >
            {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : 'Entrar no Sistema'}
          </button>
        </form>
        
        <div className="pt-4 border-t border-gray-800 text-center">
            <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest">
                v6.2 Enterprise • Autenticação Instantânea
            </p>
        </div>
      </div>
    </div>
  );
};

export default AuthComponent;
