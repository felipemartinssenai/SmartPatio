
import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { UserRole } from '../types';

const AuthComponent: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('motorista');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              cargo: role,
            },
          },
        });
        if (error) throw error;
        if(data.user?.identities?.length === 0){
            setMessage('Usuário já existe. Tente fazer login.');
        } else {
            setMessage('Verifique seu e-mail para confirmar o cadastro!');
        }
      }
    } catch (error: any) {
      setError(error.error_description || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <div className="w-full max-w-md bg-gray-800 rounded-xl shadow-lg p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">PátioLog</h1>
          <p className="text-gray-400">{isLogin ? 'Bem-vindo de volta!' : 'Crie sua conta'}</p>
        </div>
        
        {error && <div className="bg-red-500/20 text-red-300 p-3 rounded-md text-center">{error}</div>}
        {message && <div className="bg-blue-500/20 text-blue-300 p-3 rounded-md text-center">{message}</div>}

        <form onSubmit={handleAuth} className="space-y-6">
          {!isLogin && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="fullName">Nome Completo</label>
                <input
                  id="fullName"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="role">Cargo</label>
                <select
                  id="role"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  required
                >
                  <option value="motorista">Motorista</option>
                  <option value="operador">Operador</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="email">Email</label>
            <input
              id="email"
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="password">Senha</label>
            <input
              id="password"
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition-colors disabled:bg-blue-800 disabled:cursor-not-allowed"
          >
            {loading ? 'Processando...' : (isLogin ? 'Entrar' : 'Cadastrar')}
          </button>
        </form>
        <p className="text-center text-sm text-gray-400">
          {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
          <button onClick={() => { setIsLogin(!isLogin); setError(null); }} className="font-medium text-blue-400 hover:underline ml-1">
            {isLogin ? 'Cadastre-se' : 'Faça login'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default AuthComponent;
