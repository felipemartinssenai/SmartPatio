
import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import AuthComponent from './components/Auth';
import DriverDashboard from './components/DriverDashboard';
import AdminDashboard from './components/AdminDashboard';
import Layout from './components/Layout';
import Financials from './components/Financials';
import SolicitacaoColeta from './components/SolicitacaoColeta';
import Patio from './components/Patio';
import Fechamentos from './components/Fechamentos';

export type Page = 'dashboard' | 'collections' | 'checkin' | 'financials' | 'solicitacao_coleta' | 'patio' | 'fechamentos';

const App: React.FC = () => {
  const { session, profile, loading, signOut } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  useEffect(() => {
    if (profile) {
      if (profile.cargo === 'motorista') {
        setCurrentPage('collections');
      } else {
        setCurrentPage('dashboard');
      }
    }
  }, [profile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-white text-xl font-medium">Sincronizando...</div>
        </div>
      </div>
    );
  }

  // Caso: Logado mas sem perfil (erro de banco de dados ou reset de tabelas)
  if (session && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4 text-center">
        <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl max-w-md border border-red-500/30">
          <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Perfil não encontrado</h2>
          <p className="text-gray-400 mb-6 text-sm">
            Você está logado como <span className="text-blue-400 font-mono">{session.user.email}</span>, mas seu registro de perfil foi removido do banco de dados (provavelmente durante um reset de tabelas).
          </p>
          <div className="flex flex-col gap-3">
             <button 
              onClick={() => window.location.reload()} 
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold text-white transition-all shadow-lg"
            >
              Tentar Novamente
            </button>
            <button 
              onClick={signOut} 
              className="w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-bold text-gray-300 transition-all"
            >
              Sair e usar outra conta
            </button>
          </div>
          <div className="mt-8 p-4 bg-gray-900/50 rounded-xl border border-gray-700">
            <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 text-left">Instruções para Admin:</p>
            <p className="text-xs text-gray-400 text-left leading-relaxed">
                Abra o console de administrador e execute o script de **Setup e Reparo** do banco de dados para restaurar os perfis dos usuários existentes.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthComponent />;
  }

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <AdminDashboard />;
      case 'collections':
        return <DriverDashboard />;
      case 'financials':
        return <Financials />;
       case 'fechamentos':
        return <Fechamentos />;
      case 'solicitacao_coleta':
        return <SolicitacaoColeta setCurrentPage={setCurrentPage} />;
      case 'patio':
        return <Patio />;
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <Layout
      profile={profile!}
      signOut={signOut}
      currentPage={currentPage}
      setCurrentPage={setCurrentPage}
    >
      {renderCurrentPage()}
    </Layout>
  );
};

export default App;
