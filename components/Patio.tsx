
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Veiculo, VehicleStatus, Movimentacao } from '../types';
import CheckInModal from './CheckInModal';
import CheckoutModal from './CheckoutModal';

const REFRESH_INTERVAL = 9000; // 9 segundos conforme solicitado

const STATUS_CONFIG: Record<VehicleStatus, { label: string; bg: string; text: string; border: string }> = {
    'aguardando_coleta': { label: 'Aguardando Coleta', bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500' },
    'em_transito': { label: 'Em Trânsito', bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500' },
    'no_patio': { label: 'No Pátio', bg: 'bg-indigo-500/20', text: 'text-indigo-400', border: 'border-indigo-500' },
    'finalizado': { label: 'Finalizado', bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500' },
};

const VehicleRow: React.FC<{ 
    vehicle: Veiculo, 
    onCheckIn?: (vehicle: Veiculo) => void,
    onCheckout?: (vehicle: Veiculo) => void,
}> = ({ vehicle, onCheckIn, onCheckout }) => {
    const config = STATUS_CONFIG[vehicle.status] || STATUS_CONFIG['aguardando_coleta'];

    return (
        <div className={`bg-gray-800 p-4 rounded-xl shadow-lg border-l-4 ${config.border} flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:bg-gray-750 animate-in fade-in slide-in-from-left-4 duration-300`}>
            <div className="flex items-center gap-4">
                <div className="flex flex-col">
                    <span className="text-2xl font-mono font-bold bg-white text-black px-2 py-1 rounded-md self-start mb-1 shadow-sm">
                        {vehicle.placa}
                    </span>
                    <span className="text-gray-300 font-medium">{vehicle.modelo || 'Sem Modelo'} <span className="text-gray-500 text-sm">• {vehicle.cor || 'Sem Cor'}</span></span>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${config.bg} ${config.text}`}>
                    {config.label}
                </span>
                
                <div className="h-8 w-px bg-gray-700 hidden sm:block"></div>

                <div className="flex-1 sm:flex-none">
                    {(vehicle.status === 'aguardando_coleta' || vehicle.status === 'em_transito') && onCheckIn && (
                        <button 
                            onClick={() => onCheckIn(vehicle)}
                            className="w-full sm:w-auto px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white font-bold transition-all shadow-md active:scale-95"
                        >
                            Check-in
                        </button>
                    )}
                    {vehicle.status === 'no_patio' && onCheckout && (
                        <button 
                            onClick={() => onCheckout(vehicle)}
                            className="w-full sm:w-auto px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white font-bold transition-all shadow-md active:scale-95"
                        >
                            Checkout
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const Patio: React.FC = () => {
    const [vehicles, setVehicles] = useState<Veiculo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<VehicleStatus | 'todos'>('todos');
    const [isConnected, setIsConnected] = useState(false);
    
    const [vehicleForCheckIn, setVehicleForCheckIn] = useState<Veiculo | null>(null);
    const [vehicleForCheckout, setVehicleForCheckout] = useState<Veiculo | null>(null);

    const fetchVehicles = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        const { data, error } = await supabase
            .from('veiculos')
            .select('*')
            .neq('status', 'finalizado')
            .order('created_at', { ascending: false });
        
        if (error) {
            setError('Erro ao carregar dados do pátio.');
        } else {
            setVehicles(data as Veiculo[]);
        }
        if (!isSilent) setLoading(false);
    }, []);

    useEffect(() => {
        fetchVehicles();

        const channel = supabase
            .channel('patio_realtime_9s')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'veiculos' },
                () => fetchVehicles(true)
            )
            .subscribe((status) => setIsConnected(status === 'SUBSCRIBED'));

        const pollInterval = setInterval(() => {
            fetchVehicles(true);
        }, REFRESH_INTERVAL);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(pollInterval);
        };
    }, [fetchVehicles]);

    const filteredVehicles = useMemo(() => {
        return vehicles.filter(v => {
            const matchesSearch = v.placa.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                 v.modelo?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'todos' || v.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [vehicles, searchTerm, statusFilter]);

    const handleConfirmCheckIn = async (vehicleId: string, valorDiaria: number) => {
        const { error: movError } = await supabase
            .from('movimentacoes')
            .insert({
                veiculo_id: vehicleId,
                valor_diaria: valorDiaria,
                data_entrada: new Date().toISOString()
            });

        if (movError) throw movError;

        await supabase
            .from('veiculos')
            .update({ status: 'no_patio' })
            .eq('id', vehicleId);
        
        fetchVehicles(true);
        setVehicleForCheckIn(null);
    };

    const handleConfirmCheckout = async (movimentacao: Movimentacao, totalPago: number) => {
        const dataSaida = new Date().toISOString();

        await supabase
            .from('movimentacoes')
            .update({ data_saida: dataSaida, total_pago: totalPago, forma_pagamento: 'Checkout Pátio' })
            .eq('id', movimentacao.id);

        await supabase
            .from('financeiro')
            .insert({
                tipo: 'entrada',
                valor: totalPago,
                descricao: `Checkout Pátio - Placa ${vehicleForCheckout?.placa}`,
                movimentacao_id: movimentacao.id,
                data: dataSaida,
            });

        await supabase
            .from('veiculos')
            .update({ status: 'finalizado' })
            .eq('id', movimentacao.veiculo_id);
        
        fetchVehicles(true);
        setVehicleForCheckout(null);
    };

    return (
        <div className="p-4 sm:p-8 flex flex-col h-full bg-gray-900">
            <header className="mb-8">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-3xl font-bold text-white">Pátio</h1>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-full shadow-sm">
                        <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                            {isConnected ? 'Sincronizado' : '9s Refresh'}
                        </span>
                    </div>
                </div>
                
                <div className="bg-gray-800 p-4 rounded-xl shadow-lg border border-gray-700 flex flex-col md:flex-row gap-4">
                    <input 
                        type="text" 
                        placeholder="Buscar placa..." 
                        className="flex-1 px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <div className="flex gap-2 overflow-x-auto">
                        {(['todos', 'no_patio', 'em_transito'] as const).map(s => (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase whitespace-nowrap ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}
                            >
                                {s === 'todos' ? 'Todos' : STATUS_CONFIG[s as VehicleStatus]?.label || s}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto space-y-4 custom-scrollbar">
                {loading && !vehicles.length ? (
                    <div className="text-center py-20 text-gray-500">Buscando pátio...</div>
                ) : (
                    filteredVehicles.map(v => (
                        <VehicleRow 
                            key={v.id} 
                            vehicle={v} 
                            onCheckIn={setVehicleForCheckIn}
                            onCheckout={setVehicleForCheckout}
                        />
                    ))
                )}
            </main>

            <CheckInModal 
                vehicle={vehicleForCheckIn}
                onClose={() => setVehicleForCheckIn(null)}
                onConfirm={handleConfirmCheckIn}
            />
            <CheckoutModal
                vehicle={vehicleForCheckout}
                onClose={() => setVehicleForCheckout(null)}
                onConfirm={handleConfirmCheckout}
            />
        </div>
    );
};

export default Patio;
