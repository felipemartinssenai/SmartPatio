
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Veiculo, VehicleStatus, AppNotification } from '../types';
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
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<VehicleStatus>>(new Set());
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(current => current.filter(n => n.id !== id));
  }, []);

  const addNotification = useCallback((notification: Omit<AppNotification, 'id'>) => {
    const id = Date.now().toString() + Math.random();
    setNotifications(current => [{ ...notification, id }, ...current]);
    const timer = setTimeout(() => {
        dismissNotification(id);
    }, 6000); // Auto-dismiss after 6 seconds
    return () => clearTimeout(timer);
  }, [dismissNotification]);


  useEffect(() => {
    const fetchInitialVehicles = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('veiculos')
        .select(`*, profiles(full_name)`)
        .in('status', ['aguardando_coleta', 'em_transito', 'no_patio', 'finalizado']);

      if (data) {
        setVehicles(data as any);
      }
      setLoading(false);
    };

    fetchInitialVehicles();

    const channel = supabase
      .channel('public:veiculos')
      .on<Veiculo>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'veiculos' },
        (payload) => {
          const { new: newVehicle, old: oldVehicle, eventType } = payload;
          
          if (eventType === 'INSERT') {
            setVehicles((current) => [newVehicle, ...current]);
             if (newVehicle.status === 'aguardando_coleta') {
                addNotification({
                    title: 'Nova Coleta Solicitada',
                    message: `Veículo placa ${newVehicle.placa} aguarda um motorista.`,
                    type: 'info'
                });
            }
          } else if (eventType === 'UPDATE') {
            setVehicles((current) => current.map((v) => v.id === newVehicle.id ? newVehicle : v));
            if (oldVehicle?.status !== newVehicle.status) {
              if (newVehicle.status === 'no_patio') {
                 addNotification({
                    title: 'Veículo Chegou ao Pátio!',
                    message: `O veículo de placa ${newVehicle.placa} deu entrada.`,
                    type: 'success'
                });
              } else if (newVehicle.status === 'finalizado') {
                addNotification({
                    title: 'Movimentação Finalizada',
                    message: `O checkout do veículo ${newVehicle.placa} foi concluído.`,
                    type: 'info'
                });
              }
            }
          } else if (eventType === 'DELETE') {
            setVehicles((current) => current.filter((v) => v.id !== oldVehicle.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [addNotification]);

  const handleFilterToggle = (status: VehicleStatus) => {
    setActiveFilters(prev => {
        const newFilters = new Set(prev);
        if (newFilters.has(status)) {
            newFilters.delete(status);
        } else {
            newFilters.add(status);
        }
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

  return (
    <div className="flex flex-col h-full bg-gray-900">
       <SqlSetupModal
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
      />
      
      <NotificationContainer notifications={notifications} onDismiss={dismissNotification} />

      <main className="flex-1 relative">
        <div className="absolute top-4 left-4 right-4 z-[1000] p-4 bg-gray-900/70 backdrop-blur-sm rounded-xl shadow-2xl space-y-3">
          <input
            type="text"
            placeholder="Buscar por Placa ou Modelo..."
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-300">Filtrar por:</span>
            {STATUS_OPTIONS.map(({ id, label, color }) => (
              <button
                key={id}
                onClick={() => handleFilterToggle(id)}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                  activeFilters.has(id)
                    ? `bg-${color}-500 text-white shadow-lg`
                    : 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="pt-2 border-t border-gray-700 flex justify-between items-center">
             {permission === 'default' && (
                <button onClick={requestPermission} className="text-xs text-blue-400 hover:underline">
                    Ativar notificações de sistema
                </button>
            )}
             <button onClick={() => setIsSetupModalOpen(true)} className="text-xs text-green-400 hover:underline">
                Verificar Setup do Banco
              </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p>Carregando mapa e veículos...</p>
          </div>
        ) : (
          <MapWrapper vehicles={filteredVehicles} />
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
