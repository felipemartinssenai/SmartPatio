
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Veiculo, VehicleStatus, Movimentacao } from '../types';
import CheckInModal from './CheckInModal';
import CheckoutModal from './CheckoutModal';

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

    const fetchVehicles = useCallback(async () => {
        setLoading(true);
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
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchVehicles();

        const channel = supabase
            .channel('patio_realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'veiculos' },
                (payload) => {
                    // Sincronização inteligente sem recarregar tudo do servidor se não necessário
                    if (payload.eventType === 'INSERT') {
                        const newVehicle = payload.new as Veiculo;
                        if (newVehicle.status !== 'finalizado') {
                            setVehicles(prev => [newVehicle, ...prev]);
                        }
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedVehicle = payload.new as Veiculo;
                        if (updatedVehicle.status === 'finalizado') {
                            setVehicles(prev => prev.filter(v => v.id !== updatedVehicle.id));
                        } else {
                            setVehicles(prev => prev.map(v => v.id === updatedVehicle.id ? updatedVehicle : v));
                        }
                    } else if (payload.eventType === 'DELETE') {
                        setVehicles(prev => prev.filter(v => v.id !== payload.old.id));
                    }
                }
            )
            .subscribe((status) => {
                setIsConnected(status === 'SUBSCRIBED');
            });

        return () => {
            supabase.removeChannel(channel);
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

        const { error: vecError } = await supabase
            .from('veiculos')
            .update({ status: 'no_patio' })
            .eq('id', vehicleId);
        
        if (vecError) throw vecError;
        
        setVehicleForCheckIn(null);
    };

    const handleConfirmCheckout = async (movimentacao: Movimentacao, totalPago: number) => {
        const dataSaida = new Date().toISOString();

        const { error: movError } = await supabase
            .from('movimentacoes')
            .update({ data_saida: dataSaida, total_pago: totalPago, forma_pagamento: 'Checkout Pátio' })
            .eq('id', movimentacao.id);

        if(movError) throw movError;

        const { error: finError } = await supabase
            .from('financeiro')
            .insert({
                tipo: 'entrada',
                valor: totalPago,
                descricao: `Checkout Pátio - Placa ${vehicleForCheckout?.placa}`,
                movimentacao_id: movimentacao.id,
                data: dataSaida,
            });

        if(finError) throw finError;

        const { error: vecError } = await supabase
            .from('veiculos')
            .update({ status: 'finalizado' })
            .eq('id', movimentacao.veiculo_id);
        
        if(vecError) throw vecError;

        setVehicleForCheckout(null);
    };

    return (
        <div className="p-4 sm:p-8 flex flex-col h-full bg-gray-900">
            <header className="mb-8">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-3xl font-bold text-white">Gerenciamento do Pátio</h1>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-full shadow-sm">
                        <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                            {isConnected ? 'Sincronizado' : 'Reconectando...'}
                        </span>
                    </div>
                </div>
                
                <div className="bg-gray-800 p-4 rounded-xl shadow-lg border border-gray-700 flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        <input 
                            type="text" 
                            placeholder="Buscar por placa ou modelo..." 
                            className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                        {(['todos', 'aguardando_coleta', 'em_transito', 'no_patio'] as const).map(s => (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all duration-200 ${
                                    statusFilter === s 
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-800' 
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                            >
                                {s === 'todos' ? 'Todos' : STATUS_CONFIG[s as VehicleStatus].label}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                {loading && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="text-gray-400">Carregando inventário...</p>
                    </div>
                )}

                {error && <div className="bg-red-500/20 text-red-300 p-4 rounded-lg text-center border border-red-500/50">{error}</div>}

                {!loading && filteredVehicles.length === 0 && (
                    <div className="text-center py-20 bg-gray-800/30 rounded-xl border border-dashed border-gray-700">
                        <p className="text-gray-500 text-lg">Nenhum veículo encontrado para os filtros ativos.</p>
                    </div>
                )}

                {filteredVehicles.map(v => (
                    <VehicleRow 
                        key={v.id} 
                        vehicle={v} 
                        onCheckIn={setVehicleForCheckIn}
                        onCheckout={setVehicleForCheckout}
                    />
                ))}
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
