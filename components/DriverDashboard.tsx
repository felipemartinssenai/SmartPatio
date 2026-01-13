
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
        return <div className="px-2 py-1 text-xs font-black uppercase text-yellow-800 bg-yellow-400 rounded-md shadow-sm border border-yellow-500">Disponível</div>;
      case 'em_transito':
        return <div className="px-2 py-1 text-xs font-black uppercase text-blue-100 bg-blue-600 rounded-md shadow-sm border border-blue-400">Em Rota</div>;
      default:
        return null;
    }
  };

  return (
    <div className="bg-gray-800 p-5 rounded-2xl shadow-xl space-y-4 border border-gray-700 hover:border-blue-500/50 transition-all duration-300 transform active:scale-[0.98]">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">{vehicle.modelo || 'Veículo'}</h3>
          <p className="text-3xl font-mono font-black bg-white text-black rounded-lg px-3 py-1 inline-block shadow-inner ring-2 ring-gray-600">
            {vehicle.placa}
          </p>
        </div>
        {getStatusChip(vehicle.status)}
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm bg-gray-900/60 p-4 rounded-xl border border-gray-700/50">
        <div>
          <p className="text-gray-500 text-[10px] uppercase font-bold">Cor</p>
          <p className="text-gray-200 font-medium">{vehicle.cor || '---'}</p>
        </div>
        <div>
          <p className="text-gray-500 text-[10px] uppercase font-bold">Ano</p>
          <p className="text-gray-200 font-medium">{vehicle.ano || '---'}</p>
        </div>
        <div className="col-span-2 pt-2 border-t border-gray-700/50">
          <p className="text-gray-500 text-[10px] uppercase font-bold">Proprietário</p>
          <p className="text-gray-200 font-medium truncate">{vehicle.proprietario_nome || 'Não informado'}</p>
        </div>
      </div>

      {vehicle.status === 'aguardando_coleta' && (
        <button
          onClick={(e) => {
            e.preventDefault();
            onStartCollection(vehicle);
          }}
          className="w-full py-4 bg-green-600 hover:bg-green-500 active:bg-green-700 rounded-xl text-white font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-3 group"
        >
          <span>Iniciar Coleta</span>
          <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 5l7 7-7 7M5 5l7 7-7 7"></path></svg>
        </button>
      )}

      {vehicle.status === 'em_transito' && isTracking && (
        <div className="w-full py-4 bg-blue-900/30 border-2 border-blue-500/30 rounded-xl text-blue-400 font-black text-center flex items-center justify-center gap-3">
           <div className="animate-ping w-2 h-2 bg-green-400 rounded-full"></div>
           RASTREAMENTO ATIVO
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
  
  const seenVehicleIds = useRef<Set<string>>(new Set());
  const initialLoadDone = useRef(false);
  const pollTimerRef = useRef<number | null>(null);

  const syncData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('veiculos')
        .select('*')
        .in('status', ['aguardando_coleta', 'em_transito']);

      if (fetchError) throw fetchError;
      
      const fetchedVehicles = (data as Veiculo[]) || [];
      
      // Lógica de Notificação de Novas Coletas
      if (initialLoadDone.current) {
        fetchedVehicles.forEach(v => {
          if (v.status === 'aguardando_coleta' && !seenVehicleIds.current.has(v.id)) {
            sendNotification('NOVA COLETA! 🚚', {
              body: `Placa ${v.placa} disponível para retirada imediata.`,
              tag: v.id
            });
            seenVehicleIds.current.add(v.id);
          }
        });
      } else {
        // Popula o set inicial sem notificar
        fetchedVehicles.forEach(v => seenVehicleIds.current.add(v.id));
        initialLoadDone.current = true;
      }

      setVehicles(fetchedVehicles);
    } catch (err: any) {
      console.error('Falha na sincronização:', err);
      setError('Falha de conexão. O sistema tentará novamente em instantes.');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [sendNotification]);

  // Efeito principal de Pooling e Realtime
  useEffect(() => {
    syncData();

    // Polling de 9 segundos inquebrável
    pollTimerRef.current = window.setInterval(() => {
      syncData(true);
    }, REFRESH_INTERVAL);

    // Canal Realtime para atualizações instantâneas do pátio
    const channel = supabase
      .channel('driver_main_stream')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'veiculos' }, () => {
          syncData(true);
      })
      .subscribe((status) => setIsConnected(status === 'SUBSCRIBED'));

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [syncData]);

  const filteredVehicles = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return vehicles.filter(v => 
      v.placa.toLowerCase().includes(term) || 
      (v.modelo && v.modelo.toLowerCase().includes(term))
    );
  }, [vehicles, searchTerm]);
  
  const startTracking = async (vehicle: Veiculo) => {
    if (!user) return;
    
    setLoading(true);
    setError(null);

    try {
      // 1. Atualiza no Supabase
      const { error: updateError } = await supabase
          .from('veiculos')
          .update({ 
            status: 'em_transito', 
            motorista_id: user.id 
          })
          .eq('id', vehicle.id);
      
      if(updateError) throw updateError;

      // 2. Atualiza estado local IMEDIATAMENTE (Otimista)
      setVehicles(prev => prev.map(v => v.id === vehicle.id ? { ...v, status: 'em_transito', motorista_id: user.id } : v));
      setTrackingVehicleId(vehicle.id);
      
      // 3. Força um sync silencioso para confirmar dados
      await syncData(true);

      // 4. Direciona para o Mapa
      if (vehicle.lat && vehicle.lng) {
          const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${vehicle.lat},${vehicle.lng}`;
          window.open(mapsUrl, '_blank');
      }

      // 5. Inicia rastreamento GPS em background
      const trackLoc = () => {
        navigator.geolocation.getCurrentPosition((pos) => {
          supabase.from('veiculos').update({ lat: pos.coords.latitude, lng: pos.coords.longitude }).eq('id', vehicle.id);
        }, null, { enableHighAccuracy: true });
      };
      trackLoc();
      window.setInterval(trackLoc, 15000);

    } catch (err: any) {
      console.error(err);
      setError('Esta coleta já foi iniciada por outro motorista ou houve um erro de rede.');
      syncData(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900" onClick={() => playChime()}>
      <header className="p-4 border-b border-gray-800 bg-gray-900/80 backdrop-blur-xl sticky top-0 z-10 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-black text-white italic tracking-tighter">MINHAS COLETAS</h2>
                <div className="flex items-center gap-2 mt-1">
                   <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                   <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{isConnected ? 'Sincronizado' : 'Reconectando...'}</span>
                </div>
              </div>
              <button 
                  onClick={() => syncData(false)}
                  className="p-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-400 hover:text-white transition-all active:rotate-180 duration-500"
              >
                  <svg className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
              </button>
          </div>
          
          <input 
              type="text"
              placeholder="🔍 Filtrar placa ou modelo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-5 py-4 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-bold focus:border-blue-500 transition-all outline-none shadow-inner"
          />
      </header>

      <main className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-900/40">
        {permission !== 'granted' && (
            <button 
                className="w-full p-4 bg-blue-600 hover:bg-blue-500 rounded-2xl text-white font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 animate-pulse" 
                onClick={(e) => { e.stopPropagation(); requestPermission(); }}
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                Ativar Alertas de Chamada
            </button>
        )}

        {error && (
            <div className="bg-red-500/20 border-2 border-red-500/30 p-4 rounded-2xl text-red-400 text-xs font-black text-center uppercase tracking-wider">
                ⚠️ {error}
            </div>
        )}
        
        {loading && vehicles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                <p className="font-black text-gray-600 uppercase tracking-widest text-sm">Consultando Pátio...</p>
            </div>
        ) : filteredVehicles.length === 0 ? (
            <div className="text-center py-32 px-10 border-4 border-dashed border-gray-800 rounded-[40px] opacity-40">
                <span className="text-7xl mb-6 block">📭</span>
                <h3 className="text-white font-black text-xl uppercase tracking-tighter">Nenhuma Coleta</h3>
                <p className="text-gray-400 text-sm mt-3 font-medium">Fique atento! Novas solicitações aparecem aqui automaticamente.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 gap-5">
                {filteredVehicles.map((v) => (
                  <VehicleCard 
                      key={v.id} 
                      vehicle={v} 
                      onStartCollection={startTracking} 
                      isTracking={trackingVehicleId === v.id || v.motorista_id === user?.id}
                  />
                ))}
            </div>
        )}
      </main>
      
      <div className="p-4 bg-gray-800/90 border-t border-gray-700 flex justify-between items-center safe-area-bottom">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Alerta Online</p>
          </div>
          <button onClick={playChime} className="text-[10px] font-black text-blue-400 uppercase underline decoration-2 underline-offset-4">Testar Som</button>
      </div>
    </div>
  );
};

export default DriverDashboard;
