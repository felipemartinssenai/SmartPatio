
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Veiculo, VehicleStatus, AppNotification, Profile } from '../types';
import MapWrapper from './MapWrapper';
import { useNotifications } from '../hooks/useNotifications';
import SqlSetupModal from './SqlSetupModal';
import NotificationContainer from './NotificationContainer';

const STATUS_OPTIONS: { id: VehicleStatus; label: string; color: string }[] = [
  { id: 'aguardando_coleta', label: 'Aguardando Coleta', color: 'yellow' },
  { id: 'em_transito', label: 'Em Trânsito', color: 'blue' },
  { id: 'no_patio', label: 'No Pátio', color: 'indigo' },
  { id: 'finalizado', label: 'Finalizado', color: 'green' },
];

const AdminDashboard: React.FC = () => {
  const { permission, requestPermission } = useNotifications();
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

  const addNotification = useCallback((notification: Omit<AppNotification, 'id'>) => {
    const id = Date.now().toString() + Math.random();
    setNotifications(current => [{ ...notification, id }, ...current]);
    const timer = setTimeout(() => {
        dismissNotification(id);
    }, 6000); 
    return () => clearTimeout(timer);
  }, [dismissNotification]);

  const fetchDrivers = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('cargo', 'motorista')
      .not('lat', 'is', null);
    
    if (!error && data) {
      setDrivers(data as Profile[]);
    }
  }, []);

  useEffect(() => {
    const fetchInitialVehicles = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('veiculos')
        .select(`*, profiles(full_name)`)
        .in('status', ['aguardando_coleta', 'em_transito', 'no_patio', 'finalizado']);

      if (data) setVehicles(data as any);
      setLoading(false);
    };

    fetchInitialVehicles();
    fetchDrivers();

    // Fallback: Busca manual a cada 30 segundos (caso o Realtime esteja desativado no Supabase)
    fetchIntervalRef.current = window.setInterval(() => {
        fetchDrivers();
    }, 30000);

    // Inscrição para mudanças de veículos
    const vehicleChannel = supabase
      .channel('public:veiculos_admin')
      .on<Veiculo>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'veiculos' },
        (payload) => {
          const { new: newVehicle, old: oldVehicle, eventType } = payload;
          if (eventType === 'INSERT') setVehicles((current) => [newVehicle, ...current]);
          else if (eventType === 'UPDATE') setVehicles((current) => current.map((v) => v.id === newVehicle.id ? newVehicle : v));
          else if (eventType === 'DELETE') setVehicles((current) => current.filter((v) => v.id !== oldVehicle.id));
        }
      )
      .subscribe();

    // Inscrição para mudanças de localização de motoristas
    const profileChannel = supabase
      .channel('public:profiles_tracking')
      .on<Profile>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          const updatedProfile = payload.new;
          if (updatedProfile.cargo === 'motorista') {
             setDrivers(current => {
               const exists = current.find(d => d.id === updatedProfile.id);
               if (!exists) return [...current, updatedProfile];
               return current.map(d => d.id === updatedProfile.id ? updatedProfile : d);
             });
          }
        }
      )
      .subscribe();

    return () => {
      if (fetchIntervalRef.current) clearInterval(fetchIntervalRef.current);
      supabase.removeChannel(vehicleChannel);
      supabase.removeChannel(profileChannel);
    };
  }, [fetchDrivers]);

  const handleFilterToggle = (status: VehicleStatus) => {
    setActiveFilters(prev => {
        const newFilters = new Set(prev);
        if (newFilters.has(status)) newFilters.delete(status);
        else newFilters.add(status);
        return newFilters;
    });
  };

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(vehicle => {
      const statusMatch = activeFilters.size === 0 || activeFilters.has(vehicle.status);
      const searchMatch = searchTerm.trim() === '' ||
        vehicle.placa.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vehicle.modelo?.toLowerCase().includes(searchTerm.toLowerCase());
      return statusMatch && searchMatch;
    });
  }, [vehicles, searchTerm, activeFilters]);

  // Filtra motoristas ativos (vistos nos últimos 30 minutos - mais tolerante)
  const activeDrivers = useMemo(() => {
    const now = new Date().getTime();
    const threshold = 30 * 60 * 1000; // 30 minutos
    
    return drivers.filter(d => {
        if (!d.lat || !d.lng || !d.last_seen) return false;
        const lastSeen = new Date(d.last_seen).getTime();
        return (now - lastSeen) < threshold;
    });
  }, [drivers]);

  return (
    <div className="flex flex-col h-full bg-gray-900">
       <SqlSetupModal
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
      />
      
      <NotificationContainer notifications={notifications} onDismiss={dismissNotification} />

      <main className="flex-1 relative">
        {/* Camada de UI do Mapa */}
        <div className="absolute top-4 left-4 right-4 z-[1000] space-y-3 pointer-events-none">
          <div className="bg-gray-900/80 backdrop-blur-md p-4 rounded-3xl border border-gray-700 shadow-2xl pointer-events-auto">
              <input
                type="text"
                placeholder="Buscar por Placa ou Modelo..."
                className="w-full px-5 py-3 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all font-bold text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {STATUS_OPTIONS.map(({ id, label, color }) => (
                  <button
                    key={id}
                    onClick={() => handleFilterToggle(id)}
                    className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-full transition-all border-2 ${
                      activeFilters.has(id)
                        ? `bg-${color}-500 border-${color}-400 text-white shadow-lg`
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
          </div>
          
          <div className="flex items-center gap-3 px-6 py-3 bg-gray-900/90 backdrop-blur-sm rounded-full border border-gray-800 self-start shadow-xl pointer-events-auto w-fit">
             <div className={`w-3 h-3 rounded-full ${activeDrivers.length > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-700'}`}></div>
             <span className="text-[10px] text-white uppercase font-black tracking-widest italic">
                {activeDrivers.length} Motoristas em Rota
             </span>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-full bg-gray-900">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Iniciando Satélites...</p>
          </div>
        ) : (
          <MapWrapper vehicles={filteredVehicles} drivers={activeDrivers} />
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
