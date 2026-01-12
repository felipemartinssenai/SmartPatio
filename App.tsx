
import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import AuthComponent from './components/Auth';
import DriverDashboard from './components/DriverDashboard';
import AdminDashboard from './components/AdminDashboard';
import Layout from './components/Layout';
import Financials from './components/Financials';
import CheckIn from './components/CheckIn';
import SolicitacaoColeta from './components/SolicitacaoColeta';
import Patio from './components/Patio';
import Fechamentos from './components/Fechamentos';

export type Page = 'dashboard' | 'collections' | 'checkin' | 'financials' | 'solicitacao_coleta' | 'patio' | 'fechamentos';

const App: React.FC = () => {
  const { session, profile, loading, signOut } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  useEffect(() => {
    // Set the initial page based on user role
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
        <div className="text-white text-2xl">Carregando...</div>
      </div>
    );
  }

  if (!session || !profile) {
    return <AuthComponent />;
  }

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <AdminDashboard />;
      case 'collections':
        return <DriverDashboard />;
      case 'checkin':
        return <CheckIn />;
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
      profile={profile}
      signOut={signOut}
      currentPage={currentPage}
      setCurrentPage={setCurrentPage}
    >
      {renderCurrentPage()}
    </Layout>
  );
};

export default App;
