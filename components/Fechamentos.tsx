
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { FechamentoReportItem } from '../types';
import FechamentoDetalheModal from './FechamentoDetalheModal';

const Fechamentos: React.FC = () => {
    const [startDate, setStartDate] = useState(() => {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return date.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [reportData, setReportData] = useState<FechamentoReportItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedMovId, setSelectedMovId] = useState<string | null>(null);

    const fetchReportData = useCallback(async () => {
        if (!startDate || !endDate) return;

        setLoading(true);
        setError(null);

        const startOfDay = `${startDate}T00:00:00.000Z`;
        const endOfDay = `${endDate}T23:59:59.999Z`;

        const { data, error } = await supabase
            .from('movimentacoes')
            .select(`
                id,
                data_entrada,
                data_saida,
                total_pago,
                veiculos ( placa )
            `)
            .not('data_saida', 'is', null)
            .not('total_pago', 'is', null)
            .gte('data_saida', startOfDay)
            .lte('data_saida', endOfDay)
            .order('data_saida', { ascending: false });

        if (error) {
            setError('Falha ao carregar o relatório de fechamentos.');
            console.error(error);
        } else {
             const formattedData = data.map((item: any) => ({
                id: item.id,
                placa: item.veiculos?.placa || 'N/A',
                data_entrada: item.data_entrada,
                data_saida: item.data_saida,
                valor_pago: item.total_pago,
            }));
            setReportData(formattedData);
        }
        setLoading(false);
    }, [startDate, endDate]);

    useEffect(() => {
        fetchReportData();
    }, [fetchReportData]);

    const totalFaturado = useMemo(() => {
        return reportData.reduce((acc, item) => acc + item.valor_pago, 0);
    }, [reportData]);

    const handleCloseModal = () => {
        setSelectedMovId(null);
    };

    return (
        <>
            <FechamentoDetalheModal 
                movimentacaoId={selectedMovId}
                onClose={handleCloseModal}
                onUpdate={() => {
                    handleCloseModal();
                    fetchReportData(); // Refresh data after update
                }}
            />
            <div className="p-4 sm:p-8 h-full">
                <h1 className="text-3xl font-bold text-white mb-6">Relatório de Fechamentos</h1>
                
                <div className="bg-gray-800 p-4 rounded-lg shadow-lg mb-6">
                    <div className="flex flex-col sm:flex-row gap-4 items-center">
                        <div className="flex-1 w-full">
                            <label htmlFor="startDate" className="block text-sm font-medium text-gray-300 mb-1">Data de Início</label>
                            <input
                                id="startDate"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                            />
                        </div>
                        <div className="flex-1 w-full">
                            <label htmlFor="endDate" className="block text-sm font-medium text-gray-300 mb-1">Data de Fim</label>
                            <input
                                id="endDate"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-700">
                            <thead className="bg-gray-700/50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Placa</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Entrada</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Saída</th>
                                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Valor Pago</th>
                                </tr>
                            </thead>
                            <tbody className="bg-gray-800 divide-y divide-gray-700">
                                {loading ? (
                                    <tr><td colSpan={4} className="text-center py-8 text-gray-400">Carregando dados...</td></tr>
                                ) : error ? (
                                    <tr><td colSpan={4} className="text-center py-8 text-red-400">{error}</td></tr>
                                ) : reportData.length === 0 ? (
                                    <tr><td colSpan={4} className="text-center py-8 text-gray-500">Nenhum fechamento encontrado para o período selecionado.</td></tr>
                                ) : (
                                    reportData.map((item) => (
                                        <tr key={item.id} onClick={() => setSelectedMovId(item.id)} className="hover:bg-gray-700/50 cursor-pointer">
                                            <td className="px-6 py-4 whitespace-nowrap"><span className="font-mono bg-white text-black rounded-md px-2 py-1 text-sm">{item.placa}</span></td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{new Date(item.data_entrada!).toLocaleString('pt-BR')}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{new Date(item.data_saida!).toLocaleString('pt-BR')}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-green-400 font-semibold text-right">{item.valor_pago.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                     <div className="bg-gray-900/50 px-6 py-4 flex justify-end items-center">
                        <span className="text-sm font-medium text-gray-300 mr-4">TOTAL DO PERÍODO:</span>
                        <span className="text-xl font-bold text-green-400">{totalFaturado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Fechamentos;
