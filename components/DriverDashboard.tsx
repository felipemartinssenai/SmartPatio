
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { Veiculo } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import VehicleDetailModal from './VehicleDetailModal';

const REFRESH_INTERVAL = 9000;

const VehicleCard: React.FC<{ 
    vehicle: Veiculo; 
    onStartCollection: (vehicle: Veiculo) => void; 
    onShowDetail: (vehicle: Veiculo) => void;
    isTracking: boolean 
}> = ({ vehicle, onStartCollection, onShowDetail, isTracking }) => {
  const getStatusChip = (status: Veiculo['status']) => {
    switch (status) {
      case 'aguardando_coleta':
        return <div className="px-2 py-1 text-[10px] font-black uppercase text-yellow-900 bg-yellow-400 rounded shadow-sm border border-yellow-500 animate-pulse">Disponível</div>;
      case 'em_transito':
        return <div className="px-2 py-1 text-[10px] font-black uppercase text-blue-100 bg-blue-600 rounded shadow-sm border border-blue-400">Em Rota</div>;
      default:
        return null;
    }
  };

  return (
    <div 
      onClick={() => onShowDetail(vehicle)}
      className="bg-gray-800 p-5 rounded-[24px] shadow-xl space-y-4 border border-gray-700 hover:border-blue-500/30 transition-all duration-300 cursor-pointer active:scale-[0.98] group"
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1 group-hover:text-blue-400 transition-colors">{vehicle.modelo || 'Veículo'}</p>
          <div className="flex items-center gap-3">
              <p className="text-3xl font-mono font-black bg-white text-black rounded-lg px-3 py-1 inline-block shadow-lg">
                {vehicle.placa}
              </p>
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"></path></svg>
              </div>
          </div>
        </div>
        {getStatusChip(vehicle.status)}
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm bg-gray-900/40 p-3 rounded-xl border border-gray-700/30">
        <div>
          <p className="text-gray-500 text-[9px] uppercase font-black">Cor</p>
          <p className="text-gray-200 font-bold">{vehicle.cor || '---'}</p>
        </div>
        <div>
          <p className="text-gray-500 text-[9px] uppercase font-black">Ano</p>
          <p className="text-gray-200 font-bold">{vehicle.ano || '---'}</p>
        </div>
        <div className="col-span-2 pt-2 border-t border-gray-700/50">
          <p className="text-gray-500 text-[9px] uppercase font-black">Solicitante / Proprietário</p>
          <p className="text-gray-200 font-bold truncate">{vehicle.proprietario_nome || 'Não informado'}</p>
        </div>
      </div>

      {vehicle.status === 'aguardando_coleta' && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onStartCollection(vehicle);
          }}
          className="w-full py-4 bg-green-600 hover:bg-green-500 active:bg-green-700 rounded-xl text-white font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-3"
        >
          <span>PEGAR COLETA</span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 5l7 7-7 7M5 5l7 7-7 7"></path></svg>
        </button>
      )}

      {vehicle.status === 'em_transito' && (isTracking || vehicle.motorista_id) && (
        <div className="w-full py-4 bg-blue-900/20 border border-blue-500/30 rounded-xl text-blue-400 font-black text-center flex items-center justify-center gap-3">
           <div className="animate-pulse w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
           COLETA EM ANDAMENTO
        </div>
      )}
    </div>
  );
};

const DriverDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const { sendNotification, playChime, permission, requestPermission } = useNotifications();
  const [vehicles, setVehicles] = useState<Veiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Veiculo | null>(null);
  
  const seenVehicleIds = useRef<Set<string>>(new Set());
  const initialLoadDone = useRef(false);
  const pollTimerRef = useRef<number | null>(null);

  const syncData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('veiculos')
        .select('*')
        .in('status', ['aguardando_coleta', 'em_transito'])
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      
      const currentList = (data as Veiculo[]) || [];
      
      if (initialLoadDone.current) {
        currentList.forEach(v => {
          if (v.status === 'aguardando_coleta' && !seenVehicleIds.current.has(v.id)) {
            sendNotification('NOVA COLETA DISPONÍVEL! 🚚', {
              body: `Veículo ${v.modelo || ''} Placa ${v.placa} pronto para retirada.`,
              tag: v.id,
              renotify: true
            } as any);
            seenVehicleIds.current.add(v.id);
          }
        });
      } else {
        currentList.forEach(v => seenVehicleIds.current.add(v.id));
        initialLoadDone.current = true;
      }

      setVehicles(currentList);
      setError(null);
    } catch (err: any) {
      setError('Tentando reconectar...');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [sendNotification]);

  useEffect(() => {
    syncData();
    const interval = window.setInterval(() => syncData(true), REFRESH_INTERVAL);
    pollTimerRef.current = interval;

    const channel = supabase
      .channel('driver_live_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'veiculos' }, () => syncData(true))
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
  
  const handleStartCollection = async (vehicle: Veiculo) => {
    if (!user) return;
    setLoading(true);
    try {
      const { error: updateError } = await supabase
          .from('veiculos')
          .update({ status: 'em_transito', motorista_id: user.id })
          .eq('id', vehicle.id);
      
      if(updateError) throw updateError;
      if (vehicle.lat && vehicle.lng) {
          window.open(`https://www.google.com/maps/dir/?api=1&destination=${vehicle.lat},${vehicle.lng}`, '_blank');
      }
      await syncData(true);
    } catch (err: any) {
      setError('Coleta não disponível no momento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900" onClick={() => playChime()}>
      
      <VehicleDetailModal 
        vehicle={selectedVehicle} 
        onClose={() => setSelectedVehicle(null)} 
      />

      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between z-20 shadow-lg">
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Servidor {isConnected ? 'Online' : 'Offline'}</span>
             </div>
          </div>
          
          <div className="flex items-center gap-3">
              {permission !== 'granted' && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); requestPermission(); }}
                    className="text-[8px] font-black bg-blue-600 text-white px-3 py-1.5 rounded-full uppercase tracking-widest"
                  >
                    Ativar Alertas 🔔
                  </button>
              )}
              <button onClick={() => syncData(false)} className="p-2 bg-gray-900 rounded-xl border border-gray-700">
                <svg className={`w-4 h-4 text-blue-500 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
              </button>
          </div>
      </div>

      <header className="p-4 border-b border-gray-800 bg-gray-900/90 backdrop-blur-xl sticky top-0 z-10">
          <input 
              type="text"
              placeholder="🔍 Buscar placa ou modelo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-5 py-4 bg-gray-800 border-2 border-gray-700 rounded-2xl text-white font-bold outline-none focus:border-blue-500 transition-all text-sm placeholder:text-gray-600 shadow-inner"
          />
      </header>

      <main className="flex-1 p-4 overflow-y-auto space-y-4 pb-20">
        {vehicles.length === 0 && !loading ? (
            <div className="text-center py-32 opacity-20 flex flex-col items-center">
                <span className="text-6xl mb-4">🚛</span>
                <p className="text-white font-black uppercase text-sm">Pátio Vazio</p>
                <p className="text-white text-[10px] mt-1 tracking-widest uppercase text-center">Aguardando novas coletas...</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 gap-4">
                {filteredVehicles.map((v) => (
                  <VehicleCard 
                    key={v.id} 
                    vehicle={v} 
                    onStartCollection={handleStartCollection} 
                    onShowDetail={setSelectedVehicle}
                    isTracking={v.motorista_id === user?.id} 
                  />
                ))}
            </div>
        )}
      </main>
    </div>
  );
};

export default DriverDashboard;
