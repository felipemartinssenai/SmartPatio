
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Veiculo, Movimentacao } from '../types';
import CheckInModal from './CheckInModal';
import CheckoutModal from './CheckoutModal';

const VehicleListItem: React.FC<{ 
    vehicle: Veiculo, 
    statusColor: string, 
    onCheckIn?: (vehicle: Veiculo) => void,
    onCheckout?: (vehicle: Veiculo) => void,
}> = ({ vehicle, statusColor, onCheckIn, onCheckout }) => (
    <div className="bg-gray-800 p-4 rounded-lg shadow-md border-l-4 space-y-3" style={{ borderColor: statusColor }}>
        <div className="flex justify-between items-start">
            <div>
                <p className="text-lg font-mono bg-white text-black rounded-md px-2 py-1 inline-block">{vehicle.placa}</p>
                <p className="text-gray-300 mt-2">{vehicle.modelo || 'Modelo não informado'} - {vehicle.cor || 'Cor não informada'}</p>
            </div>
            <p className="text-sm text-gray-400 flex-shrink-0 ml-2">{new Date(vehicle.created_at).toLocaleDateString('pt-BR')}</p>
        </div>
        {onCheckIn && (
            <button 
                onClick={() => onCheckIn(vehicle)}
                className="w-full mt-2 py-2 px-4 bg-green-600 hover:bg-green-700 rounded-lg text-white font-semibold transition-colors text-sm"
            >
                Realizar Check-in
            </button>
        )}
        {onCheckout && (
             <button 
                onClick={() => onCheckout(vehicle)}
                className="w-full mt-2 py-2 px-4 bg-red-600 hover:bg-red-700 rounded-lg text-white font-semibold transition-colors text-sm"
            >
                Realizar Checkout
            </button>
        )}
    </div>
);

const Patio: React.FC = () => {
    const [aguardandoColeta, setAguardandoColeta] = useState<Veiculo[]>([]);
    const [noPatio, setNoPatio] = useState<Veiculo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [vehicleForCheckIn, setVehicleForCheckIn] = useState<Veiculo | null>(null);
    const [vehicleForCheckout, setVehicleForCheckout] = useState<Veiculo | null>(null);

    useEffect(() => {
        const fetchInitialData = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('veiculos')
                .select('*')
                .in('status', ['aguardando_coleta', 'no_patio'])
                .order('created_at', { ascending: false });
            
            if (error) {
                setError('Falha ao carregar os dados do pátio.');
            } else {
                setAguardandoColeta(data.filter(v => v.status === 'aguardando_coleta'));
                setNoPatio(data.filter(v => v.status === 'no_patio'));
            }
            setLoading(false);
        };

        fetchInitialData();

        const channel = supabase
            .channel('public:veiculos:patio')
            .on<Veiculo>(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'veiculos' },
                (payload) => {
                    const { new: newVehicle, old: oldVehicle, eventType } = payload;
                    
                    const updateState = (setter: React.Dispatch<React.SetStateAction<Veiculo[]>>, vehicle: Veiculo, shouldAdd: boolean) => {
                        setter(current => {
                            const filtered = current.filter(v => v.id !== vehicle.id);
                            if (shouldAdd) {
                                return [vehicle, ...filtered].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                            }
                            return filtered;
                        });
                    };
                    
                    if (eventType === 'INSERT' || eventType === 'UPDATE') {
                        updateState(setAguardandoColeta, newVehicle, newVehicle.status === 'aguardando_coleta');
                        updateState(setNoPatio, newVehicle, newVehicle.status === 'no_patio');
                    } else if (eventType === 'DELETE') {
                         setAguardandoColeta(current => current.filter(v => v.id !== oldVehicle.id));
                         setNoPatio(current => current.filter(v => v.id !== oldVehicle.id));
                    }
                }
            ).subscribe();

        return () => {
            supabase.removeChannel(channel);
        };

    }, []);

    const handleConfirmCheckIn = async (vehicleId: string, valorDiaria: number) => {
        const { error: movError } = await supabase
            .from('movimentacoes')
            .insert({
                veiculo_id: vehicleId,
                valor_diaria: valorDiaria,
                data_entrada: new Date().toISOString()
            });

        if (movError) throw new Error('Falha ao criar o registro de movimentação.');

        const { error: vecError } = await supabase
            .from('veiculos')
            .update({ status: 'no_patio' })
            .eq('id', vehicleId);
        
        if (vecError) throw new Error('Falha ao atualizar o status do veículo.');
    };

    const handleConfirmCheckout = async (movimentacao: Movimentacao, totalPago: number) => {
        const dataSaida = new Date().toISOString();

        // 1. Update movimentacao
        const { error: movError } = await supabase
            .from('movimentacoes')
            .update({ data_saida: dataSaida, total_pago: totalPago, forma_pagamento: 'Confirmado no Sistema' })
            .eq('id', movimentacao.id);

        if(movError) throw new Error('Falha ao atualizar a movimentação.');

        // 2. Create financial record
        const { error: finError } = await supabase
            .from('financeiro')
            .insert({
                tipo: 'entrada',
                valor: totalPago,
                descricao: `Recebimento diárias - Veículo Placa ${vehicleForCheckout?.placa}`,
                movimentacao_id: movimentacao.id,
                data: dataSaida,
            });

        if(finError) throw new Error('Falha ao criar registro financeiro.');

        // 3. Update vehicle status
        const { error: vecError } = await supabase
            .from('veiculos')
            .update({ status: 'finalizado' })
            .eq('id', movimentacao.veiculo_id);
        
        if(vecError) throw new Error('Falha ao finalizar o veículo.');
    };


    if (loading) return <div className="text-center p-8">Carregando dados do pátio...</div>
    if (error) return <div className="text-center p-8 text-red-400">{error}</div>

    return (
        <>
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
            <div className="p-4 sm:p-8 h-full">
                <h1 className="text-3xl font-bold text-white mb-6">Gerenciamento do Pátio</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Coluna Aguardando Coleta */}
                    <div className="bg-gray-800/50 rounded-lg p-4">
                        <h2 className="text-xl font-semibold text-yellow-400 mb-4">Aguardando Coleta ({aguardandoColeta.length})</h2>
                        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
                            {aguardandoColeta.length > 0 ? (
                                aguardandoColeta.map(v => 
                                    <VehicleListItem 
                                        key={v.id} 
                                        vehicle={v} 
                                        statusColor="#FBBF24" 
                                        onCheckIn={setVehicleForCheckIn}
                                    />)
                            ) : (
                                <p className="text-gray-500">Nenhum veículo aguardando coleta.</p>
                            )}
                        </div>
                    </div>

                    {/* Coluna No Pátio */}
                    <div className="bg-gray-800/50 rounded-lg p-4">
                        <h2 className="text-xl font-semibold text-indigo-400 mb-4">Veículos no Pátio ({noPatio.length})</h2>
                        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
                             {noPatio.length > 0 ? (
                                noPatio.map(v => 
                                    <VehicleListItem 
                                        key={v.id} 
                                        vehicle={v} 
                                        statusColor="#818CF8" 
                                        onCheckout={setVehicleForCheckout}
                                    />)
                            ) : (
                                <p className="text-gray-500">Nenhum veículo no pátio.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Patio;
