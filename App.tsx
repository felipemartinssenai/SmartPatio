
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

  // Caso: Logado mas sem perfil (erro de banco de dados)
  if (session && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4 text-center">
        <div className="bg-gray-800 p-8 rounded-xl shadow-2xl max-w-md border border-red-500/30">
          <h2 className="text-2xl font-bold text-red-400 mb-4">Perfil não encontrado</h2>
          <p className="text-gray-300 mb-6">
            Você está logado como <strong>{session.user.email}</strong>, mas sua conta ainda não foi inicializada no sistema.
          </p>
          <div className="flex flex-col gap-3">
             <button 
              onClick={() => window.location.reload()} 
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold"
            >
              Tentar Novamente
            </button>
            <button 
              onClick={signOut} 
              className="w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium"
            >
              Sair e usar outra conta
            </button>
          </div>
          <p className="mt-6 text-xs text-gray-500">
            Se o erro persistir, o administrador deve verificar o script de Setup do Banco.
          </p>
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
