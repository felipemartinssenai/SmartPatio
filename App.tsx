
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
  const { session, profile, loading, signOut } = useAuth();
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

  // REGRA DE OURO: Se não tem sessão, SEMPRE vai para o Auth, independente de estar carregando ou não.
  // Isso evita que o usuário veja "Sincronizando Dados" logo após clicar em Sair.
  if (!session) return <AuthComponent />;

  // Se estiver carregando os dados do perfil pela primeira vez
  if (loading && !profile) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 p-6">
        <div className="relative mb-8">
            <div className="w-16 h-16 border-4 border-blue-500/10 rounded-full"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <h2 className="text-xl font-black text-white italic tracking-tighter mb-1">Pátio<span className="text-blue-500">Log</span></h2>
        <p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.4em] animate-pulse">Sincronizando Dados</p>
      </div>
    );
  }

  // Se houver sessão mas o perfil ainda não carregou (raro com cache local, mas possível)
  if (!profile) {
    return (
       <div className="flex flex-col items-center justify-center h-screen bg-gray-900">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Acessando Perfil...</p>
       </div>
    );
  }

  const renderCurrentPage = () => {
    const isAdmin = profile.cargo === 'admin';
    const permissions = Array.isArray(profile.permissions) ? profile.permissions : [];
    
    if (!isAdmin && !permissions.includes(currentPage)) {
        if (profile.cargo === 'motorista') {
             if (currentPage !== 'collections') setCurrentPage('collections');
        } else {
             if (currentPage !== 'dashboard') setCurrentPage('dashboard');
        }
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
    <Layout profile={profile} signOut={signOut} currentPage={currentPage} setCurrentPage={setCurrentPage}>
      {renderCurrentPage()}
    </Layout>
  );
};

export default App;
