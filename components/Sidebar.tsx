
import React from 'react';
import { Profile, Page } from '../types';

interface SidebarProps {
  profile: Profile;
  signOut: () => void;
  currentPage: Page;
  onNavigate: (page: Page) => void;
  isOpen: boolean;
  onClose: () => void;
}

const NavLink: React.FC<{
  icon: React.ReactElement;
  label: string;
  page: Page;
  currentPage: Page;
  onClick: (page: Page) => void;
}> = ({ icon, label, page, currentPage, onClick }) => {
  const isActive = currentPage === page;
  return (
    <button
      onClick={() => onClick(page)}
      className={`flex items-center w-full px-4 py-3 text-left rounded-lg transition-colors duration-200 ${
        isActive
          ? 'bg-blue-600 text-white shadow-lg'
          : 'text-gray-300 hover:bg-gray-700 hover:text-white'
      }`}
    >
      <span className="mr-3">{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
};

interface MenuItem {
  page: Page;
  label: string;
  icon: React.ReactElement;
}

const Sidebar: React.FC<SidebarProps> = ({ profile, signOut, currentPage, onNavigate, isOpen, onClose }) => {
  const isAdmin = profile?.cargo === 'admin';
  const userPermissions = Array.isArray(profile?.permissions) ? profile.permissions : [];

  const ALL_MENU_ITEMS: MenuItem[] = [
    { page: 'dashboard', label: 'Dashboard Mapa', icon: <MapIcon /> },
    { page: 'solicitacao_coleta', label: 'Solicitar Coleta', icon: <AddIcon /> },
    { page: 'patio', label: 'Gerenciar Pátio', icon: <YardIcon /> },
    { page: 'fechamentos', label: 'Relatórios', icon: <ReportIcon /> },
    { page: 'financials', label: 'Financeiro', icon: <FinancialsIcon /> },
    { page: 'collections', label: 'Minhas Coletas', icon: <TowTruckIcon /> },
    { page: 'payment_methods', label: 'Pagamentos', icon: <PaymentIcon /> },
    { page: 'user_management', label: 'Usuários', icon: <UserIcon /> },
  ];

  // Regra de Exibição: Admins veem tudo. Outros veem o que está no array.
  const filteredMenuItems = ALL_MENU_ITEMS.filter(item => 
    isAdmin || userPermissions.includes(item.page)
  );

  const sidebarContent = (
      <div className="flex flex-col h-full bg-gray-800">
        {/* Profile Section */}
        <div className="p-4 border-b border-gray-700">
            <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-xl mr-3 flex-shrink-0 shadow-lg shadow-blue-900/40">
                    {profile?.full_name?.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="min-w-0">
                    <h2 className="font-bold text-white truncate text-sm">{profile?.full_name || 'Usuário'}</h2>
                    <p className="text-[10px] text-blue-400 uppercase font-black tracking-widest">{profile?.cargo || '---'}</p>
                </div>
            </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
            {filteredMenuItems.map(item => (
                <NavLink 
                    key={item.page}
                    {...item}
                    currentPage={currentPage}
                    onClick={onNavigate}
                />
            ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={signOut}
            className="flex items-center w-full px-4 py-3 text-left text-gray-400 hover:bg-red-900/20 hover:text-red-400 rounded-lg transition-colors duration-200"
          >
            <span className="mr-3"><LogoutIcon /></span>
            <span className="font-medium">Sair do Sistema</span>
          </button>
        </div>
      </div>
  );

  return (
    <>
      <div className={`fixed inset-0 z-[3000] lg:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div onClick={onClose} className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}></div>
          <div className={`absolute top-0 left-0 w-72 h-full transition-transform duration-300 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
             <div className="relative h-full shadow-2xl">
                {sidebarContent}
                <button onClick={onClose} className="absolute top-4 -right-12 text-white bg-gray-800 p-2 rounded-r-md lg:hidden shadow-md"><CloseIcon /></button>
             </div>
          </div>
      </div>

      <div className="hidden lg:flex lg:flex-shrink-0 z-20">
          <div className="w-64 bg-gray-800 border-r border-gray-700">
              {sidebarContent}
          </div>
      </div>
    </>
  );
};

// SVG Icons
const AddIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>;
const YardIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>;
const MapIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13v-6m0-6V4m0 6h6m-6 0H3m6 6l6.553 2.724A1 1 0 0017 18.382V7.618a1 1 0 00-.553-.894L15 4m-6 6v6m6-6h3m-3 0h-6"></path></svg>;
const FinancialsIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>;
const ReportIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V7a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
const TowTruckIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v1m-6 8l-4-4m0 0l4-4m-4 4h12"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 15a2 2 0 11-4 0 2 2 0 014 0zM7 15a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>;
const UserIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>;
const PaymentIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>;
const LogoutIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>;
const CloseIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>;

export default Sidebar;
