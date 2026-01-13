
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { Veiculo } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';

const REFRESH_INTERVAL = 9000; // 9 segundos rigorosos

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
  
  // Ref para rastrear IDs já vistos e evitar notificações no primeiro carregamento
  const seenVehicleIds = useRef<Set<string>>(new Set());
  const initialLoadDone = useRef(false);
  const pollTimerRef = useRef<number | null>(null);

  const syncData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('veiculos')
        .select('*')
        .in('status', ['aguardando_coleta', 'em_transito']);

      if (error) throw error;
      
      if (data) {
        const fetchedVehicles = data as Veiculo[];
        
        // Identifica novos veículos desde a última sincronização
        if (initialLoadDone.current) {
          fetchedVehicles.forEach(v => {
            if (v.status === 'aguardando_coleta' && !seenVehicleIds.current.has(v.id)) {
              console.log('Nova coleta detectada:', v.placa);
              sendNotification('NOVA COLETA! 🚨', {
                body: `Veículo ${v.modelo || ''} (Placa ${v.placa}) disponível para coleta imediata no sistema.`,
                tag: 'new-vehicle-' + v.id
              });
            }
          });
        }

        // Atualiza o set de vistos
        const newSeenSet = new Set<string>();
        fetchedVehicles.forEach(v => newSeenSet.add(v.id));
        seenVehicleIds.current = newSeenSet;
        
        setVehicles(fetchedVehicles);
        initialLoadDone.current = true;
      }
    } catch (err: any) {
      console.error('Erro na sincronização:', err);
      setError('Erro ao sincronizar. Tentando reconectar...');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [sendNotification]);

  // Efeito principal para polling e realtime
  useEffect(() => {
    // Busca inicial imediata
    syncData();

    // Inicia Polling inabalável
    pollTimerRef.current = window.setInterval(() => {
        syncData(true);
    }, REFRESH_INTERVAL);

    // Canal de Realtime para atualizações push instantâneas
    const channel = supabase
      .channel('driver_realtime_stream')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'veiculos' },
        () => {
          console.log('Update push recebido via Realtime');
          syncData(true);
        }
      )
      .subscribe((status) => {
          setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [syncData]);

  const filteredVehicles = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return vehicles;
    return vehicles.filter(v => 
      v.placa.toLowerCase().includes(term) || 
      (v.modelo && v.modelo.toLowerCase().includes(term))
    );
  }, [vehicles, searchTerm]);
  
  const startTracking = async (vehicle: Veiculo) => {
    if (!user) return;
    
    setLoading(true);
    setError(null);

    const { error: updateError } = await supabase
        .from('veiculos')
        .update({ status: 'em_transito', motorista_id: user.id })
        .eq('id', vehicle.id);
    
    if(updateError) {
        setLoading(false);
        setError('Erro ao iniciar coleta. O veículo pode já ter sido pego.');
        return;
    }

    // Atualiza a lista imediatamente para refletir a mudança de estado
    await syncData(true);
    setTrackingVehicleId(vehicle.id);

    // Tenta abrir o GPS
    if(vehicle.lat && vehicle.lng){
        window.open(`https://www.google.com/maps?daddr=${vehicle.lat},${vehicle.lng}`, '_blank');
    }
    
    // Inicia envio de localização persistente
    const sendLocation = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          supabase.from('veiculos')
            .update({ lat: pos.coords.latitude, lng: pos.coords.longitude })
            .eq('id', vehicle.id)
            .then(() => console.log('Loc updated'));
        },
        null,
        { enableHighAccuracy: true }
      );
    };

    sendLocation();
    const locInterval = window.setInterval(sendLocation, 15000);
    return () => clearInterval(locInterval);
  };

  return (
    <div className="flex flex-col h-full bg-gray-900" onClick={() => playChime()}>
      <header className="p-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-10 shadow-xl">
          <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                    <span className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></span>
                    MINHAS COLETAS
                </h2>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Sincronização Ativa (9s)</p>
              </div>
              <div className="flex flex-col items-end">
                <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${isConnected ? 'bg-green-500/20 text-green-500 border border-green-500/30' : 'bg-red-500/20 text-red-500 border border-red-500/30'}`}>
                    {isConnected ? 'ONLINE' : 'POLLING'}
                </div>
              </div>
          </div>
          
          <div className="relative group">
            <input 
                type="text"
                placeholder="Buscar por placa ou modelo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-4 pr-12 py-3 bg-gray-800 border-2 border-gray-700 rounded-xl text-white font-bold focus:border-blue-500 transition-all outline-none"
            />
            <button 
                onClick={() => syncData(false)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-white transition-colors"
            >
                <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            </button>
          </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar bg-gray-900/40">
        {permission !== 'granted' && (
            <button 
                className="w-full p-4 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl text-white font-black text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-3 animate-bounce" 
                onClick={(e) => { e.stopPropagation(); requestPermission(); }}
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                ATIVAR ALERTAS DE COLETAS
            </button>
        )}

        {error && (
            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl text-red-500 text-xs font-bold text-center animate-pulse">
                {error}
            </div>
        )}
        
        {loading && vehicles.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-600">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="font-bold uppercase text-xs">Sincronizando Banco de Dados...</p>
            </div>
        )}
        
        {!loading && filteredVehicles.length === 0 && (
            <div className="text-center py-24 px-6 border-2 border-dashed border-gray-800 rounded-3xl">
                <div className="text-5xl mb-6">🚚</div>
                <h3 className="text-white font-black text-lg uppercase">Nenhuma Coleta</h3>
                <p className="text-gray-500 text-sm mt-2">Estamos monitorando o pátio. Assim que uma nova coleta for aberta, você será notificado com som e vibração.</p>
                <div className="mt-8 flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
                    <span className="text-[10px] font-bold text-gray-600 uppercase">Aguardando Novas Ordens...</span>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 gap-4">
            {filteredVehicles.map((v) => (
              <VehicleCard key={v.id} vehicle={v} onStartCollection={startTracking} isTracking={trackingVehicleId === v.id}/>
            ))}
        </div>
      </main>
      
      {/* Botão de teste rápido de som/vibração (útil para o motorista garantir que o celular não silenciou) */}
      <div className="p-4 bg-gray-800/80 backdrop-blur-sm border-t border-gray-700 flex justify-between items-center">
          <p className="text-[10px] font-bold text-gray-500 uppercase">Sistema de Alerta: <span className="text-green-500">Ativo</span></p>
          <button onClick={playChime} className="text-[10px] font-black text-blue-400 hover:text-blue-300 uppercase underline">Testar Som</button>
      </div>
    </div>
  );
};

export default DriverDashboard;
