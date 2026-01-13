
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Veiculo, VehicleStatus, Movimentacao } from '../types';
import CheckInModal from './CheckInModal';
import CheckoutModal from './CheckoutModal';

const REFRESH_INTERVAL = 9000;

const STATUS_CONFIG: Record<VehicleStatus, { label: string; bg: string; text: string; border: string }> = {
    'aguardando_coleta': { label: 'Aguardando', bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500' },
    'em_transito': { label: 'Em Rota', bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500' },
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
        <div className={`bg-gray-800 p-4 rounded-2xl shadow-lg border-l-8 ${config.border} flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:bg-gray-750 duration-300`}>
            <div className="flex items-center gap-4">
                <div className="flex flex-col">
                    <span className="text-2xl font-mono font-black bg-white text-black px-3 py-1 rounded-lg self-start mb-1 shadow-inner">
                        {vehicle.placa}
                    </span>
                    <span className="text-gray-300 font-bold uppercase text-xs tracking-tight">
                        {vehicle.modelo || 'Sem Modelo'} • <span className="text-gray-500">{vehicle.cor || 'Sem Cor'}</span>
                    </span>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${config.bg} ${config.text} ${config.border.replace('border-', 'border-opacity-30 border-')}`}>
                    {config.label}
                </span>
                
                <div className="h-8 w-px bg-gray-700 hidden sm:block"></div>

                <div className="flex-1 sm:flex-none">
                    {(vehicle.status === 'aguardando_coleta' || vehicle.status === 'em_transito') && onCheckIn && (
                        <button 
                            onClick={() => onCheckIn(vehicle)}
                            className="w-full sm:w-auto px-8 py-2.5 bg-green-600 hover:bg-green-500 rounded-xl text-white font-black uppercase text-xs tracking-widest transition-all shadow-lg active:scale-95"
                        >
                            Check-in
                        </button>
                    )}
                    {vehicle.status === 'no_patio' && onCheckout && (
                        <button 
                            onClick={() => onCheckout(vehicle)}
                            className="w-full sm:w-auto px-8 py-2.5 bg-red-600 hover:bg-red-700 rounded-xl text-white font-black uppercase text-xs tracking-widest transition-all shadow-lg active:scale-95"
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
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<VehicleStatus | 'todos'>('todos');
    const [isConnected, setIsConnected] = useState(false);
    const pollRef = useRef<number | null>(null);
    
    const [vehicleForCheckIn, setVehicleForCheckIn] = useState<Veiculo | null>(null);
    const [vehicleForCheckout, setVehicleForCheckout] = useState<Veiculo | null>(null);

    const fetchVehicles = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        const { data, error } = await supabase
            .from('veiculos')
            .select('*')
            .neq('status', 'finalizado')
            .order('created_at', { ascending: false });
        
        if (!error && data) {
            setVehicles(data as Veiculo[]);
        }
        if (!isSilent) setLoading(false);
    }, []);

    useEffect(() => {
        fetchVehicles();

        const channel = supabase
            .channel('patio_live_sync_v2')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'veiculos' }, () => fetchVehicles(true))
            .subscribe((status) => setIsConnected(status === 'SUBSCRIBED'));

        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = window.setInterval(() => {
            fetchVehicles(true);
        }, REFRESH_INTERVAL);

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
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

        await supabase.from('veiculos').update({ status: 'no_patio' }).eq('id', vehicleId);
        
        await fetchVehicles(true);
        setVehicleForCheckIn(null);
    };

    const handleConfirmCheckout = async (movimentacao: Movimentacao, totalPago: number) => {
        const dataSaida = new Date().toISOString();

        await supabase
            .from('movimentacoes')
            .update({ data_saida: dataSaida, total_pago: totalPago, forma_pagamento: 'Checkout Pátio' })
            .eq('id', movimentacao.id);

        await supabase.from('financeiro').insert({
                tipo: 'entrada',
                valor: totalPago,
                descricao: `Checkout Pátio - Placa ${vehicleForCheckout?.placa}`,
                movimentacao_id: movimentacao.id,
                data: dataSaida,
            });

        await supabase.from('veiculos').update({ status: 'finalizado' }).eq('id', movimentacao.veiculo_id);
        
        await fetchVehicles(true);
        setVehicleForCheckout(null);
    };

    return (
        <div className="p-4 sm:p-8 flex flex-col h-full bg-gray-900 overflow-hidden">
            <header className="mb-6 flex-shrink-0">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-3xl font-extrabold text-white tracking-tight">Gestão do Pátio</h1>
                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border-2 border-gray-700 rounded-2xl shadow-xl">
                        <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></div>
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                            {isConnected ? 'Realtime' : 'Sincronizando'}
                        </span>
                    </div>
                </div>
                
                <div className="bg-gray-800 p-4 rounded-3xl border border-gray-700 shadow-2xl space-y-4">
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="Pesquisar por placa ou modelo..." 
                            className="w-full pl-12 pr-4 py-3 bg-gray-900 border-2 border-gray-700 rounded-2xl text-white font-bold outline-none focus:border-blue-500 transition-all shadow-inner"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {(['todos', 'aguardando_coleta', 'em_transito', 'no_patio'] as const).map(s => (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border-2 ${statusFilter === s ? 'bg-blue-600 text-white border-blue-400 shadow-lg' : 'bg-gray-700 text-gray-400 border-gray-600 hover:bg-gray-650'}`}
                            >
                                {s === 'todos' ? 'Ver Todos' : STATUS_CONFIG[s as VehicleStatus]?.label || s}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pb-10">
                {loading && !vehicles.length ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-50">
                        <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="font-black text-xs uppercase tracking-widest text-white">Atualizando Inventário...</p>
                    </div>
                ) : filteredVehicles.length === 0 ? (
                    <div className="text-center py-32 border-4 border-dashed border-gray-800 rounded-[40px] opacity-30">
                        <p className="text-white font-black uppercase text-sm">Nenhum registro encontrado</p>
                    </div>
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
