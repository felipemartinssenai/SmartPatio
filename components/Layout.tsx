
import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { Profile, Page } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  profile: Profile;
  signOut: () => void;
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
}

// Added 'payment_methods' to satisfy Record<Page, string> requirement
const PAGE_TITLES: Record<Page, string> = {
  dashboard: 'Dashboard Operacional',
  collections: 'Minhas Coletas',
  financials: 'Controle Financeiro',
  solicitacao_coleta: 'Solicitar Nova Coleta',
  patio: 'Gerenciamento do Pátio',
  fechamentos: 'Relatório de Fechamentos',
  user_management: 'Gestão de Usuários',
  payment_methods: 'Formas de Pagamento',
};


const Layout: React.FC<LayoutProps> = ({ children, profile, signOut, currentPage, setCurrentPage }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleNavigate = (page: Page) => {
    setCurrentPage(page);
    setIsSidebarOpen(false); // Close sidebar on mobile after navigation
  };

  return (
    <div className="h-screen w-screen bg-gray-900 text-gray-100 flex overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        profile={profile}
        signOut={signOut}
        currentPage={currentPage}
        onNavigate={handleNavigate}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header - z-index adjust to be above map search but below sidebar overlay */}
        <header className="bg-gray-800 shadow-md flex items-center justify-between p-4 z-[1001] lg:hidden">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="text-white p-1 -ml-1 focus:outline-none hover:bg-gray-700 rounded-md transition-colors"
            aria-label="Abrir menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </button>
          <h1 className="text-xl font-bold text-white truncate px-2">{PAGE_TITLES[currentPage]}</h1>
          <div className="w-8"></div> {/* Spacer for centering */}
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto relative">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;