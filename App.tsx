
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

  // Se estiver carregando OU se tiver sessão mas o perfil ainda não chegou, mantém o loading
  if (loading || (session && !profile)) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 space-y-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] animate-pulse">Iniciando PátioLog...</p>
      </div>
    );
  }

  if (!session) return <AuthComponent />;

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
