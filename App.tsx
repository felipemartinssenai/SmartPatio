
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
import UserManagement from './components/UserManagement';
import PaymentMethodManagement from './components/PaymentMethodManagement';
import SqlSetupModal from './components/SqlSetupModal';
import { Page } from './types';

const App: React.FC = () => {
  const { session, profile, loading, signOut } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);

  // Lógica de Redirecionamento Baseada em Permissões
  useEffect(() => {
    if (profile) {
      const isAdmin = profile.cargo === 'admin';
      const userPermissions = Array.isArray(profile.permissions) ? profile.permissions : [];
      
      // Administradores têm acesso total, não precisam de redirecionamento de segurança
      if (isAdmin) return;

      // Se a página atual não estiver nas permissões, redireciona para a primeira permitida
      if (!userPermissions.includes(currentPage)) {
        if (userPermissions.length > 0) {
          setCurrentPage(userPermissions[0] as Page);
        } else {
          // Fallback para motoristas se não houver array configurado
          setCurrentPage(profile.cargo === 'motorista' ? 'collections' : 'dashboard');
        }
      }
    }
  }, [profile, currentPage]);

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

  // Caso: Logado mas sem perfil (Pode acontecer logo após o primeiro login ou se o trigger falhar)
  if (session && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4 text-center">
        <SqlSetupModal isOpen={isSetupModalOpen} onClose={() => setIsSetupModalOpen(false)} />
        
        <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl max-w-md border border-red-500/30">
          <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Perfil não configurado</h2>
          <p className="text-gray-400 mb-6 text-sm">
            Seu registro de perfil não foi localizado para <span className="text-blue-400 font-mono">{session?.user?.email}</span>.
          </p>
          <div className="flex flex-col gap-3">
             <button 
              onClick={() => setIsSetupModalOpen(true)} 
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2"
            >
              Configurar Admin Root & Tabelas
            </button>
            <button 
              onClick={signOut} 
              className="w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-bold text-gray-300 transition-all"
            >
              Sair e tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthComponent />;
  }

  const renderCurrentPage = () => {
    // Verificação de segurança: Super Admin ignora array de permissões
    const isAdmin = profile?.cargo === 'admin';
    const permissions = Array.isArray(profile?.permissions) ? profile.permissions : [];
    
    if (profile && !isAdmin && !permissions.includes(currentPage)) {
      return (
        <div className="flex items-center justify-center h-full p-8 text-center flex-col gap-4">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m0 0v2m0-2h2m-2 0H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <div>
                <h3 className="text-xl font-bold text-white">Acesso Negado</h3>
                <p className="text-gray-400 max-w-xs mx-auto mt-2">Você não possui permissão para visualizar esta página. Entre em contato com o administrador.</p>
            </div>
            <button onClick={() => setCurrentPage(profile.cargo === 'motorista' ? 'collections' : 'dashboard')} className="px-6 py-2 bg-gray-700 rounded-lg text-sm font-bold">Voltar ao Início</button>
        </div>
      );
    }

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
      case 'user_management':
        return <UserManagement />;
      case 'payment_methods':
        return <PaymentMethodManagement />;
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
