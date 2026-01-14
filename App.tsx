
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

  // Inicia o rastreamento se for motorista
  useLocationTracking(profile);

  // Recuperar última página visitada para melhorar experiência
  useEffect(() => {
    const savedPage = localStorage.getItem('last_page');
    if (savedPage) setCurrentPage(savedPage as Page);
  }, []);

  useEffect(() => {
    if (currentPage) localStorage.setItem('last_page', currentPage);
  }, [currentPage]);

  // Redirecionamento baseado em cargo (Apenas no primeiro login)
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

  // Se tem sessão mas perfil ainda não carregou (raro), mostra esqueleto
  if (session && !profile) {
    return <div className="h-screen bg-gray-900 flex items-center justify-center text-gray-500 uppercase text-[10px] font-black tracking-widest">Carregando Acessos...</div>;
  }

  const renderCurrentPage = () => {
    const isAdmin = profile?.cargo === 'admin';
    const permissions = Array.isArray(profile?.permissions) ? profile.permissions : [];
    
    // Verificação de segurança de rota
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
