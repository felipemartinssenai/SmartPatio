
import React, { useState, useEffect } from 'react';
import { Veiculo } from '../types';

interface CheckInModalProps {
    vehicle: Veiculo | null;
    onClose: () => void;
    onConfirm: (vehicleId: string, valorDiaria: number) => Promise<void>;
}

const CheckInModal: React.FC<CheckInModalProps> = ({ vehicle, onClose, onConfirm }) => {
    const [valorDiaria, setValorDiaria] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Efeito para resetar o estado do modal sempre que ele for reaberto com um novo veículo
    useEffect(() => {
        if (vehicle) {
            setValorDiaria('');
            setError(null);
            setLoading(false);
        }
    }, [vehicle]);

    if (!vehicle) return null;

    const handleConfirm = async () => {
        const valor = parseFloat(valorDiaria);
        if (isNaN(valor) || valor <= 0) {
            setError('Por favor, insira um valor de diária válido.');
            return;
        }
        setError(null);
        setLoading(true);
        try {
            await onConfirm(vehicle.id, valor);
            onClose(); // Fecha o modal em caso de sucesso
        } catch (e: any) {
            setError(e.message || 'Ocorreu um erro ao confirmar o check-in.');
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-white mb-2">Confirmar Check-in</h2>
                <div className="mb-4 bg-gray-700 p-3 rounded-md">
                    <p className="text-gray-400">Veículo: <span className="font-semibold text-white">{vehicle.modelo || 'Não informado'}</span></p>
                    <p className="text-gray-400">Placa: <span className="font-mono text-lg bg-white text-black rounded-md px-2 py-1 inline-block mt-1">{vehicle.placa}</span></p>
                </div>

                <div className="space-y-4">
                     <div>
                        <label htmlFor="valorDiaria" className="block text-sm font-medium text-gray-300 mb-2">Valor da Diária (R$)*</label>
                        <input
                          id="valorDiaria"
                          type="number"
                          value={valorDiaria}
                          onChange={(e) => setValorDiaria(e.target.value)}
                          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                          placeholder="Ex: 50.00"
                          min="0.01"
                          step="0.01"
                        />
                      </div>
                      {error && <p className="text-red-400 text-sm text-center pt-2">{error}</p>}
                </div>

                <div className="mt-6 flex justify-end gap-4">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-md text-white font-semibold transition-colors"
                        disabled={loading}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md text-white font-semibold transition-colors disabled:bg-green-800 disabled:cursor-not-allowed"
                        disabled={loading || !valorDiaria}
                    >
                        {loading ? 'Confirmando...' : 'Confirmar Check-in'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CheckInModal;
