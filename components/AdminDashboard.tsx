
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Veiculo, VehicleStatus, AppNotification, Profile } from '../types';
import MapWrapper from './MapWrapper';
import { useNotifications } from '../hooks/useNotifications';
import SqlSetupModal from './SqlSetupModal';
import NotificationContainer from './NotificationContainer';

const AdminDashboard: React.FC = () => {
  const [vehicles, setVehicles] = useState<Veiculo[]>([]);
  const [drivers, setDrivers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<VehicleStatus>>(new Set());
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const fetchIntervalRef = useRef<number | null>(null);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(current => current.filter(n => n.id !== id));
  }, []);

  const fetchDrivers = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('cargo', 'motorista');
    
    if (!error && data) {
      setDrivers(data as Profile[]);
    }
  }, []);

  const fetchVehicles = useCallback(async () => {
    const { data } = await supabase
      .from('veiculos')
      .select(`*, profiles(full_name)`)
      .in('status', ['aguardando_coleta', 'em_transito', 'no_patio', 'finalizado']);

    if (data) setVehicles(data as any);
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchVehicles(), fetchDrivers()]);
      setLoading(false);
    };

    init();

    fetchIntervalRef.current = window.setInterval(() => {
        fetchDrivers();
        fetchVehicles();
    }, 30000);

    // Canal unificado para atualizações de motoristas
    const profileChannel = supabase
      .channel('public:profiles')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
          const updated = payload.new as Profile;
          if (updated.cargo !== 'motorista') return;

          setDrivers(current => {
              const exists = current.find(d => d.id === updated.id);
              if (!exists) return [...current, updated];
              return current.map(d => d.id === updated.id ? { ...d, ...updated } : d);
          });
      })
      .subscribe();

    const vehicleChannel = supabase
      .channel('public:veiculos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'veiculos' }, () => fetchVehicles())
      .subscribe();

    return () => {
      if (fetchIntervalRef.current) clearInterval(fetchIntervalRef.current);
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(vehicleChannel);
    };
  }, [fetchDrivers, fetchVehicles]);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(vehicle => {
      const statusMatch = activeFilters.size === 0 || activeFilters.has(vehicle.status);
      const searchMatch = searchTerm.trim() === '' ||
        vehicle.placa.toLowerCase().includes(searchTerm.toLowerCase());
      return statusMatch && searchMatch;
    });
  }, [vehicles, searchTerm, activeFilters]);

  // Filtro de motoristas: mostramos qualquer um que tenha lat/lng gravado
  const mapDrivers = useMemo(() => {
    return drivers.filter(d => d.lat && d.lng && d.lat !== 0);
  }, [drivers]);

  return (
    <div className="flex flex-col h-full bg-gray-900">
       <SqlSetupModal isOpen={isSetupModalOpen} onClose={() => setIsSetupModalOpen(false)} />
      
      <NotificationContainer notifications={notifications} onDismiss={dismissNotification} />

      <main className="flex-1 relative">
        {/* Painel Flutuante de Busca */}
        <div className="absolute top-4 left-4 right-4 z-[1000] space-y-3 pointer-events-none">
          <div className="bg-gray-900/90 backdrop-blur-md p-4 rounded-3xl border border-gray-700 shadow-2xl pointer-events-auto max-w-xl mx-auto md:mx-0">
              <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="🔍 Buscar placa..."
                    className="flex-1 px-5 py-3 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all font-bold text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <button onClick={() => setIsSetupModalOpen(true)} className="p-3 bg-gray-800 border-2 border-gray-700 rounded-2xl text-blue-500 hover:bg-gray-700 transition-all" title="Configurações SQL">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path></svg>
                  </button>
              </div>
          </div>
          
          <div className="flex items-center gap-3 px-6 py-3 bg-gray-900/95 backdrop-blur-sm rounded-full border border-gray-800 self-start shadow-xl pointer-events-auto w-fit">
             <div className={`w-3 h-3 rounded-full ${mapDrivers.length > 0 ? 'bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-gray-700'}`}></div>
             <span className="text-[10px] text-white uppercase font-black tracking-widest italic">
                {mapDrivers.length} Motoristas Localizados
             </span>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-full bg-gray-900">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Sincronizando Frota...</p>
          </div>
        ) : (
          <MapWrapper vehicles={filteredVehicles} drivers={mapDrivers} />
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
