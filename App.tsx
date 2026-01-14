
import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { useLocationTracking } from './hooks/useLocationTracking';
import AuthComponent from './components/Auth';
import DriverDashboard from './components/DriverDashboard';
import AdminDashboard from './components/AdminDashboard';
import Layout from './components/Layout';
import Financials from './components/Financials';
import SolicitacaoColeta from './components/SolicitacaoColeta';
import Patio from './components/Patio';
import Fechamentos from './components/Fechamentos';
import UserManagement from './components/UserManagement';
import PaymentMethodManagement from './components/PaymentMethodManagement';
import InvoicesManagement from './components/InvoicesManagement';
import Settings from './components/Settings';
import { Page } from './types';

const App: React.FC = () => {
  const { session, profile, loading, error, signOut, retry } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  useLocationTracking(profile);

  useEffect(() => {
    const savedPage = localStorage.getItem('last_page');
    if (savedPage) setCurrentPage(savedPage as Page);
  }, []);

  useEffect(() => {
    if (currentPage) localStorage.setItem('last_page', currentPage);
  }, [currentPage]);

  useEffect(() => {
    if (profile && !localStorage.getItem('last_page')) {
      if (profile.cargo === 'motorista') setCurrentPage('collections');
      else setCurrentPage('dashboard');
    }
  }, [profile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) return <AuthComponent />;

  // Tela de erro caso o perfil (profiles) não exista para o usuário logado (auth.users)
  if (session && !profile) {
    return (
      <div className="h-screen bg-gray-900 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/30">
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
        </div>
        <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Erro de Acesso</h2>
        <p className="text-gray-400 text-sm max-w-xs mb-8 leading-relaxed">
            Seu login foi validado, mas não encontramos as permissões da sua conta no banco de dados.
            {error && (
              <div className="mt-4 p-3 bg-black/50 rounded-xl border border-red-900/50">
                <span className="block text-red-400 font-mono text-[10px] break-all">{error}</span>
              </div>
            )}
        </p>
        <div className="flex flex-col w-full max-w-xs gap-3">
            <button onClick={retry} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black uppercase text-xs tracking-widest transition-all">Tentar Novamente</button>
            <button onClick={signOut} className="w-full py-4 bg-gray-800 text-gray-400 rounded-2xl font-black uppercase text-xs tracking-widest border border-gray-700 hover:bg-gray-700 transition-all">Sair do Sistema</button>
        </div>
        <div className="mt-8 p-4 bg-blue-500/5 rounded-2xl border border-blue-500/20 max-w-xs">
            <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest leading-normal">
                DICA PARA O DESENVOLVEDOR:<br/>
                Execute o script SQL v15.0 para criar perfis automaticamente.
            </p>
        </div>
      </div>
    );
  }

  const renderCurrentPage = () => {
    const isAdmin = profile?.cargo === 'admin';
    const permissions = Array.isArray(profile?.permissions) ? profile.permissions : [];
    
    if (profile && !isAdmin && !permissions.includes(currentPage)) {
        const fallback = profile.cargo === 'motorista' ? 'collections' : 'dashboard';
        setCurrentPage(fallback as Page);
    }

    switch (currentPage) {
      case 'dashboard': return <AdminDashboard />;
      case 'collections': return <DriverDashboard />;
      case 'financials': return <Financials />;
      case 'fechamentos': return <Fechamentos />;
      case 'solicitacao_coleta': return <SolicitacaoColeta setCurrentPage={setCurrentPage} />;
      case 'patio': return <Patio />;
      case 'user_management': return <UserManagement />;
      case 'payment_methods': return <PaymentMethodManagement />;
      case 'invoices': return <InvoicesManagement />;
      case 'settings': return <Settings />;
      default: return <AdminDashboard />;
    }
  };

  return (
    <Layout profile={profile!} signOut={signOut} currentPage={currentPage} setCurrentPage={setCurrentPage}>
      {renderCurrentPage()}
    </Layout>
  );
};

export default App;
