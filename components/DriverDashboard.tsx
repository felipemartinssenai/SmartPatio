
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { Veiculo } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';

const REFRESH_INTERVAL = 9000; // 9 segundos cravados

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
  const { sendNotification, requestPermission, permission, playChime } = useNotifications();
  const [vehicles, setVehicles] = useState<Veiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [trackingVehicleId, setTrackingVehicleId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Ref para rastrear IDs já vistos e evitar notificações duplicadas
  const seenVehicleIds = useRef<Set<string>>(new Set());
  const intervalRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);

  const fetchInitialVehicles = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    const { data, error } = await supabase
      .from('veiculos')
      .select('*')
      .in('status', ['aguardando_coleta', 'em_transito']);

    if (error) {
      setError('Erro na sincronização de dados.');
    } else if (data) {
      const vehicleList = data as Veiculo[];
      
      // Lógica de Notificação para novos itens
      vehicleList.forEach(v => {
          if (v.status === 'aguardando_coleta' && !seenVehicleIds.current.has(v.id)) {
              sendNotification('Nova Coleta Disponível! 🚚', {
                  body: `Placa: ${v.placa} - ${v.modelo || 'Veículo identificado'}`,
                  tag: 'nova-coleta-' + v.id
              });
              seenVehicleIds.current.add(v.id);
          }
      });

      // Limpar IDs que não estão mais na lista (opcional, para manter o Set limpo)
      const currentIds = new Set(vehicleList.map(v => v.id));
      seenVehicleIds.current.forEach(id => {
          if (!currentIds.has(id)) seenVehicleIds.current.delete(id);
      });

      setVehicles(vehicleList);
    }
    if (!isSilent) setLoading(false);
  }, [sendNotification]);

  useEffect(() => {
    if (permission === 'default') {
      requestPermission();
    }

    // Primeira busca
    fetchInitialVehicles();

    // Setup Realtime
    const channel = supabase
      .channel('driver_realtime_v3')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'veiculos' },
        () => fetchInitialVehicles(true)
      )
      .subscribe((status) => setIsConnected(status === 'SUBSCRIBED'));

    // Configuração do Polling de 9 segundos
    pollRef.current = window.setInterval(() => {
        fetchInitialVehicles(true);
    }, REFRESH_INTERVAL);

    return () => {
      supabase.removeChannel(channel);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchInitialVehicles, permission, requestPermission]);

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
    
    setLoading(true);

    const { error } = await supabase
        .from('veiculos')
        .update({ status: 'em_transito', motorista_id: user.id })
        .eq('id', vehicle.id);
    
    if(error) {
        setLoading(false);
        setError('Falha ao iniciar coleta. Verifique sua conexão.');
        return;
    }

    // ATUALIZAÇÃO IMEDIATA: Remove o loading e força o fetch
    await fetchInitialVehicles(true);
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
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(updateLoc, 15000);
  };

  return (
    <div className="flex flex-col h-full bg-gray-900" onClick={() => playChime()}>
      <header className="p-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-10 space-y-3">
          <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Minhas Coletas</h2>
              <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-gray-800/50 border border-gray-700">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className="text-[10px] font-bold text-gray-500 uppercase">{isConnected ? 'Sincronizado' : 'Refresh 9s'}</span>
              </div>
          </div>
          
          <div className="flex gap-2">
            <input 
                type="text"
                placeholder="Buscar placa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
            />
            <button 
                onClick={() => fetchInitialVehicles(false)}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors"
                title="Atualizar Agora"
            >
                <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            </button>
          </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar">
        {permission !== 'granted' && (
            <button 
                className="w-full p-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm font-bold flex items-center justify-center gap-2 mb-2 transition-all shadow-lg animate-pulse" 
                onClick={(e) => { e.stopPropagation(); requestPermission(); }}
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                ATIVAR ALERTAS SONOROS
            </button>
        )}
        
        {loading && vehicles.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p>Buscando atualizações...</p>
            </div>
        )}
        
        {!loading && filteredVehicles.length === 0 && (
            <div className="text-center py-20">
                <div className="text-gray-600 mb-2">🚚</div>
                <p className="text-gray-500 text-sm">Nenhuma nova coleta pendente.</p>
                <p className="text-gray-600 text-xs mt-1">Atualizando automaticamente em {REFRESH_INTERVAL / 1000}s</p>
            </div>
        )}

        {filteredVehicles.map((v) => (
          <VehicleCard key={v.id} vehicle={v} onStartCollection={startTracking} isTracking={trackingVehicleId === v.id}/>
        ))}
      </main>
    </div>
  );
};

export default DriverDashboard;
