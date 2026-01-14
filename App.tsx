
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
  const [showTimeoutUI, setShowTimeoutUI] = useState(false);

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

  // Timer de segurança para evitar hang infinito
  useEffect(() => {
    let timer: number;
    if (loading || (session && !profile)) {
      timer = window.setTimeout(() => setShowTimeoutUI(true), 7000);
    } else {
      setShowTimeoutUI(false);
    }
    return () => clearTimeout(timer);
  }, [loading, session, profile]);

  // TELA DE CARREGAMENTO COM RECUPERAÇÃO DE ERRO
  if (loading || (session && !profile)) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 p-6">
        <div className="relative mb-8">
            <div className="w-20 h-20 border-4 border-blue-500/20 rounded-full"></div>
            <div className="absolute inset-0 w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            </div>
        </div>
        
        <h2 className="text-xl font-black text-white italic tracking-tighter mb-2">Pátio<span className="text-blue-500">Log</span></h2>
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] animate-pulse mb-8">Iniciando Sistema...</p>

        {showTimeoutUI && (
          <div className="max-w-xs w-full space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-center">
                <p className="text-xs font-bold text-red-400 mb-1">A conexão está demorando mais que o esperado.</p>
                <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest leading-tight">Isso pode ser causado por sinal de internet fraco ou falta de permissão no banco de dados.</p>
             </div>
             
             <div className="flex flex-col gap-2">
                <button 
                  onClick={() => retry()}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-900/40 transition-all active:scale-95"
                >
                  Tentar Reconectar
                </button>
                <button 
                  onClick={() => signOut()}
                  className="w-full py-4 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-gray-700 transition-all active:scale-95"
                >
                  Sair e Entrar Novamente
                </button>
             </div>
          </div>
        )}
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
