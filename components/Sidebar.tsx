
import React from 'react';
import { Profile } from '../types';
import { Page } from '../App';

interface SidebarProps {
  profile: Profile;
  signOut: () => void;
  currentPage: Page;
  onNavigate: (page: Page) => void;
  isOpen: boolean;
  onClose: () => void;
}

const NavLink: React.FC<{
  // FIX: Replaced JSX.Element with React.ReactElement to resolve namespace issue.
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
          ? 'bg-blue-600 text-white'
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
  // FIX: Replaced JSX.Element with React.ReactElement to resolve namespace issue.
  icon: React.ReactElement;
}

const Sidebar: React.FC<SidebarProps> = ({ profile, signOut, currentPage, onNavigate, isOpen, onClose }) => {
  const isAdminOrOperator = profile.cargo === 'admin' || profile.cargo === 'operador';

  const menuItems: MenuItem[] = isAdminOrOperator
    ? [
        { page: 'solicitacao_coleta', label: 'Solicitar Coleta', icon: <AddIcon /> },
        { page: 'dashboard', label: 'Dashboard Mapa', icon: <MapIcon /> },
        { page: 'patio', label: 'Gerenciar Pátio', icon: <YardIcon /> },
        { page: 'fechamentos', label: 'Fechamentos', icon: <ReportIcon /> },
        { page: 'financials', label: 'Financeiro', icon: <FinancialsIcon /> },
      ]
    : [
        { page: 'collections', label: 'Minhas Coletas', icon: <TowTruckIcon /> },
      ];

  const sidebarContent = (
      <div className="flex flex-col h-full">
        {/* Profile Section */}
        <div className="p-4 border-b border-gray-700">
            <div className="flex items-center">
                <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center font-bold text-xl mr-3">
                    {profile.full_name?.charAt(0).toUpperCase()}
                </div>
                <div>
                    <h2 className="font-semibold text-white truncate">{profile.full_name}</h2>
                    <p className="text-sm text-gray-400 capitalize">{profile.cargo}</p>
                </div>
            </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
            {menuItems.map(item => (
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
            className="flex items-center w-full px-4 py-3 text-left text-gray-300 hover:bg-red-800/50 hover:text-white rounded-lg transition-colors duration-200"
          >
            <span className="mr-3"><LogoutIcon /></span>
            <span className="font-medium">Sair</span>
          </button>
        </div>
      </div>
  );

  return (
    <>
      {/* Mobile Sidebar */}
      <div className={`fixed inset-0 z-40 lg:hidden transition-transform transform ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="relative w-64 h-full bg-gray-800 shadow-lg">
             {sidebarContent}
             <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white lg:hidden">
                <CloseIcon />
            </button>
          </div>
          {/* Overlay */}
          <div onClick={onClose} className="fixed inset-0 bg-black/60 z-30 lg:hidden"></div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:flex-shrink-0">
          <div className="w-64 bg-gray-800">
              {sidebarContent}
          </div>
      </div>
    </>
  );
};

// SVG Icons
const AddIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>;
const YardIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>;
const MapIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13v-6m0-6V4m0 6h6m-6 0H3m6 6l6.553 2.724A1 1 0 0017 18.382V7.618a1 1 0 00-.553-.894L15 4m-6 6v6m6-6h3m-3 0h-6"></path></svg>;
const FinancialsIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>;
const ReportIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V7a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
const TowTruckIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v1m-6 8l-4-4m0 0l4-4m-4 4h12"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 15a2 2 0 11-4 0 2 2 0 014 0zM7 15a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>;
const LogoutIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>;
const CloseIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>;


export default Sidebar;
