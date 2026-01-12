
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Veiculo } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';

const VehicleCard: React.FC<{ vehicle: Veiculo; onStartCollection: (vehicle: Veiculo) => void; isTracking: boolean }> = ({ vehicle, onStartCollection, isTracking }) => {
  const getStatusChip = (status: Veiculo['status']) => {
    switch (status) {
      case 'aguardando_coleta':
        return <div className="px-2 py-1 text-xs font-semibold text-yellow-800 bg-yellow-300 rounded-full">Aguardando Coleta</div>;
      case 'em_transito':
        return <div className="px-2 py-1 text-xs font-semibold text-blue-800 bg-blue-300 rounded-full">Em Trânsito</div>;
      default:
        return null;
    }
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-md space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-bold text-white">{vehicle.modelo || 'Modelo não informado'}</h3>
          <p className="text-2xl font-mono bg-white text-black rounded-md px-2 py-1 inline-block my-2">{vehicle.placa}</p>
        </div>
        {getStatusChip(vehicle.status)}
      </div>
       <div className="border-t border-gray-700 pt-3 space-y-2 text-sm">
        <p className="text-gray-400">Cor: <span className="text-gray-200 font-medium">{vehicle.cor || 'Não informado'}</span></p>
        <p className="text-gray-400">Proprietário: <span className="text-gray-200 font-medium">{vehicle.proprietario_nome || 'Não informado'}</span></p>
        <p className="text-gray-400">Telefone: <span className="text-gray-200 font-medium">{vehicle.proprietario_telefone || 'Não informado'}</span></p>
      </div>
      {vehicle.status === 'aguardando_coleta' && (
        <button
          onClick={() => onStartCollection(vehicle)}
          className="w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg text-white font-bold transition-colors"
        >
          Iniciar Coleta
        </button>
      )}
      {vehicle.status === 'em_transito' && isTracking && (
        <div className="w-full py-3 bg-blue-800 rounded-lg text-white font-bold text-center flex items-center justify-center gap-2">
           <div className="animate-pulse w-3 h-3 bg-green-400 rounded-full"></div>
           Rastreamento Ativo
        </div>
      )}
    </div>
  );
};

const DriverDashboard: React.FC = () => {
  const { user } = useAuth();
  const { sendNotification } = useNotifications();
  const [vehicles, setVehicles] = useState<Veiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trackingVehicleId, setTrackingVehicleId] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const fetchInitialVehicles = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('veiculos')
        .select('*')
        .in('status', ['aguardando_coleta', 'em_transito']);

      if (error) {
        setError('Falha ao carregar coletas.');
      } else {
        setVehicles(data as Veiculo[]);
      }
      setLoading(false);
    };

    fetchInitialVehicles();

    const channel = supabase
      .channel('public:veiculos:driver')
      .on<Veiculo>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'veiculos' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newVehicle = payload.new;
            if (newVehicle.status === 'aguardando_coleta') {
              setVehicles((current) => [...current, newVehicle]);
              sendNotification('Nova Coleta Disponível!', {
                body: `Veículo placa ${newVehicle.placa} aguardando coleta.`,
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedVehicle = payload.new;
            setVehicles((current) =>
              current.map((v) => (v.id === updatedVehicle.id ? updatedVehicle : v))
            );
          } else if (payload.eventType === 'DELETE') {
            setVehicles((current) =>
              current.filter((v) => v.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sendNotification]);
  
    useEffect(() => {
    const trackedVehicle = vehicles.find(v => v.id === trackingVehicleId);
    if (trackedVehicle && trackedVehicle.status !== 'em_transito') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setTrackingVehicleId(null);
      sendNotification('Coleta Concluída', { body: `A coleta do veículo ${trackedVehicle.placa} foi finalizada.` });
    }
  }, [vehicles, trackingVehicleId, sendNotification]);


  const updateLocation = (vehicleId: string) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        await supabase
          .from('veiculos')
          .update({ lat: latitude, lng: longitude })
          .eq('id', vehicleId);
      },
      (err) => {
        console.error('Erro de geolocalização:', err);
        setError(`Erro de GPS: ${err.message}`);
      },
      { enableHighAccuracy: true }
    );
  };
  
  const startTracking = async (vehicle: Veiculo) => {
    if (!user) return;
    if (intervalRef.current) {
        clearInterval(intervalRef.current);
    }

    const { error } = await supabase
        .from('veiculos')
        .update({ status: 'em_transito', motorista_id: user.id })
        .eq('id', vehicle.id);
    
    if(error) {
        setError('Não foi possível iniciar a coleta.');
        return;
    }

    setTrackingVehicleId(vehicle.id);

    if(vehicle.lat && vehicle.lng){
        window.location.href = `https://www.google.com/maps?daddr=${vehicle.lat},${vehicle.lng}`;
    }
    
    updateLocation(vehicle.id);
    intervalRef.current = window.setInterval(() => {
        updateLocation(vehicle.id);
    }, 20000);
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-gray-900">
      <main className="flex-1 p-4 overflow-y-auto space-y-4">
        {loading && <p className="text-center text-gray-400">Carregando coletas...</p>}
        {error && <p className="text-red-400">{error}</p>}
        {vehicles.length === 0 && !loading && <p className="text-center text-gray-400 mt-8">Nenhuma coleta disponível no momento.</p>}
        {vehicles.map((v) => (
          <VehicleCard key={v.id} vehicle={v} onStartCollection={startTracking} isTracking={trackingVehicleId === v.id}/>
        ))}
      </main>
    </div>
  );
};

export default DriverDashboard;