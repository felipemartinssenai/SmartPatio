
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { Veiculo } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';

const REFRESH_INTERVAL = 10000;

const VehicleCard: React.FC<{ vehicle: Veiculo; onStartCollection: (vehicle: Veiculo) => void; isTracking: boolean }> = ({ vehicle, onStartCollection, isTracking }) => {
  const getStatusChip = (status: Veiculo['status']) => {
    switch (status) {
      case 'aguardando_coleta':
        return <div className="px-2 py-1 text-xs font-semibold text-yellow-800 bg-yellow-300 rounded-full shadow-sm">Disponível</div>;
      case 'em_transito':
        return <div className="px-2 py-1 text-xs font-semibold text-blue-800 bg-blue-300 rounded-full shadow-sm">Em Rota</div>;
      default:
        return null;
    }
  };

  return (
    <div className="bg-gray-800 p-5 rounded-xl shadow-md space-y-4 border border-gray-700 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-bold text-white">{vehicle.modelo || 'Veículo Identificado'}</h3>
          <p className="text-2xl font-mono bg-white text-black rounded-md px-3 py-1 inline-block my-2 shadow-sm font-bold">
            {vehicle.placa}
          </p>
        </div>
        {getStatusChip(vehicle.status)}
      </div>
       <div className="grid grid-cols-2 gap-y-2 text-sm bg-gray-900/40 p-3 rounded-lg border border-gray-700/50">
        <p className="text-gray-400">Cor: <span className="text-gray-200 font-medium">{vehicle.cor || '---'}</span></p>
        <p className="text-gray-400">Ano: <span className="text-gray-200 font-medium">{vehicle.ano || '---'}</span></p>
        <p className="text-gray-500 col-span-2 pt-1 border-t border-gray-700/50 mt-1">Proprietário: <span className="text-gray-200">{vehicle.proprietario_nome || 'Não informado'}</span></p>
      </div>
      {vehicle.status === 'aguardando_coleta' && (
        <button
          onClick={() => onStartCollection(vehicle)}
          className="w-full py-4 bg-green-600 hover:bg-green-700 rounded-xl text-white font-black uppercase tracking-wider transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"></path></svg>
          Iniciar Coleta Agora
        </button>
      )}
      {vehicle.status === 'em_transito' && isTracking && (
        <div className="w-full py-4 bg-blue-800/50 border border-blue-500/50 rounded-xl text-blue-100 font-bold text-center flex items-center justify-center gap-3">
           <div className="animate-pulse w-3 h-3 bg-green-400 rounded-full shadow-[0_0_8px_rgba(74,222,128,0.8)]"></div>
           Rastreamento de Localização Ativo
        </div>
      )}
    </div>
  );
};

const DriverDashboard: React.FC = () => {
  const { user } = useAuth();
  const { sendNotification, requestPermission, permission } = useNotifications();
  const [vehicles, setVehicles] = useState<Veiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [trackingVehicleId, setTrackingVehicleId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const fetchInitialVehicles = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    const { data, error } = await supabase
      .from('veiculos')
      .select('*')
      .in('status', ['aguardando_coleta', 'em_transito']);

    if (error) {
      setError('Falha ao carregar coletas disponíveis.');
    } else {
      setVehicles(data as Veiculo[]);
    }
    if (!isSilent) setLoading(false);
  }, []);

  useEffect(() => {
    // Solicita permissão de notificação assim que o motorista abre o dashboard
    if (permission === 'default') {
      requestPermission();
    }

    fetchInitialVehicles();

    const channel = supabase
      .channel('driver_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'veiculos' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newVehicle = payload.new as Veiculo;
            if (newVehicle.status === 'aguardando_coleta') {
              setVehicles((current) => [newVehicle, ...current]);
              
              // Notificação Nativa do Sistema (Push-like)
              sendNotification('Nova Coleta Disponível! 🚚', {
                body: `Veículo ${newVehicle.modelo || ''} (Placa: ${newVehicle.placa}) aguarda retirada. Clique para ver detalhes.`,
                tag: 'nova-coleta',
                renotify: true
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedVehicle = payload.new as Veiculo;
            if (!['aguardando_coleta', 'em_transito'].includes(updatedVehicle.status)) {
                setVehicles(prev => prev.filter(v => v.id !== updatedVehicle.id));
            } else {
                setVehicles(prev => prev.map(v => v.id === updatedVehicle.id ? updatedVehicle : v));
            }
          }
        }
      )
      .subscribe((status) => {
          setIsConnected(status === 'SUBSCRIBED');
      });

    const pollInterval = setInterval(() => {
        fetchInitialVehicles(true);
    }, REFRESH_INTERVAL);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [fetchInitialVehicles, sendNotification, permission, requestPermission]);

  const filteredVehicles = useMemo(() => {
    if (!searchTerm.trim()) return vehicles;
    const term = searchTerm.toLowerCase().trim();
    return vehicles.filter(v => 
      v.placa.toLowerCase().includes(term) || 
      (v.modelo && v.modelo.toLowerCase().includes(term))
    );
  }, [vehicles, searchTerm]);
  
  const startTracking = async (vehicle: Veiculo) => {
    if (!user) return;
    if (intervalRef.current) clearInterval(intervalRef.current);

    const { error } = await supabase
        .from('veiculos')
        .update({ status: 'em_transito', motorista_id: user.id })
        .eq('id', vehicle.id);
    
    if(error) {
        setError('Não foi possível iniciar a coleta.');
        return;
    }

    fetchInitialVehicles(true);
    setTrackingVehicleId(vehicle.id);

    if(vehicle.lat && vehicle.lng){
        window.open(`https://www.google.com/maps?daddr=${vehicle.lat},${vehicle.lng}`, '_blank');
    }
    
    const updateLoc = () => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          await supabase.from('veiculos').update({ lat: pos.coords.latitude, lng: pos.coords.longitude }).eq('id', vehicle.id);
        },
        null,
        { enableHighAccuracy: true }
      );
    };

    updateLoc();
    intervalRef.current = window.setInterval(updateLoc, 15000);
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
      <header className="p-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-10 space-y-4">
          <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Minhas Coletas</h2>
              <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-gray-800/50 border border-gray-700">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className="text-[10px] font-bold text-gray-500 uppercase">{isConnected ? 'Sincronizado' : 'Offline'}</span>
              </div>
          </div>
          
          <div className="relative">
              <input 
                  type="text"
                  placeholder="Buscar veículo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
              />
          </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar">
        {permission === 'denied' && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded-lg text-yellow-500 text-xs mb-4">
            Atenção: Notificações desativadas. Você não será alertado sobre novas coletas.
          </div>
        )}

        {loading && <div className="text-center py-10 text-gray-500">Buscando coletas...</div>}
        
        {!loading && filteredVehicles.map((v) => (
          <VehicleCard key={v.id} vehicle={v} onStartCollection={startTracking} isTracking={trackingVehicleId === v.id}/>
        ))}
      </main>
    </div>
  );
};

export default DriverDashboard;
