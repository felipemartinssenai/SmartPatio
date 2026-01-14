
import React, { useState, useEffect, useCallback } from 'react';
import { AsaasService } from '../services/asaas';
import { supabase } from '../services/supabase';

const STATUS_BADGES: Record<string, { label: string, color: string }> = {
    'PENDING': { label: 'Pendente', color: 'bg-amber-500/20 text-amber-400 border-amber-500/50' },
    'RECEIVED': { label: 'Recebido', color: 'bg-green-500/20 text-green-400 border-green-500/50' },
    'CONFIRMED': { label: 'Confirmado', color: 'bg-blue-500/20 text-blue-400 border-blue-500/50' },
    'OVERDUE': { label: 'Vencido', color: 'bg-red-500/20 text-red-400 border-red-500/50' },
    'REFUNDED': { label: 'Estornado', color: 'bg-purple-500/20 text-purple-400 border-purple-500/50' },
    'CANCELLED': { label: 'Cancelado', color: 'bg-gray-500/20 text-gray-400 border-gray-500/50' },
    'RECEIVED_IN_CASH': { label: 'Em Espécie', color: 'bg-green-600/20 text-green-300 border-green-600/50' },
};

const InvoicesManagement: React.FC = () => {
    const [payments, setPayments] = useState<any[]>([]);
    const [customerNames, setCustomerNames] = useState<Record<string, string>>({});
    const [vehicleCache, setVehicleCache] = useState<Record<string, { modelo: string, cor: string }>>({});
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const fetchPayments = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        setError(null);
        try {
            const data = await AsaasService.listPayments({ status: statusFilter });
            const paymentList = data.data || [];
            setPayments(paymentList);

            // Carregar Nomes de Clientes de forma otimizada
            const uniqueCustomerIds = [...new Set(paymentList.map((p: any) => p.customer))] as string[];
            const missingCustomers = uniqueCustomerIds.filter(id => !customerNames[id]);

            if (missingCustomers.length > 0) {
                const results = await Promise.all(missingCustomers.map(async id => {
                    try {
                        const c = await AsaasService.getCustomer(id);
                        return { id, name: c.name };
                    } catch {
                        return { id, name: "Desconhecido" };
                    }
                }));
                
                setCustomerNames(prev => {
                    const next = { ...prev };
                    results.forEach(r => next[r.id] = r.name);
                    return next;
                });
            }

            // Extrair Placas e Buscar Modelo/Cor
            const platesFound = paymentList
                .map((p: any) => p.description?.match(/Placa\s+([A-Z0-9-]{7,8})/i)?.[1]?.toUpperCase())
                .filter(Boolean) as string[];

            const uniquePlates = [...new Set(platesFound)];
            const missingPlates = uniquePlates.filter(plate => !vehicleCache[plate]);

            if (missingPlates.length > 0) {
                const { data: vData } = await supabase
                    .from('veiculos')
                    .select('placa, modelo, cor')
                    .in('placa', missingPlates);

                if (vData) {
                    setVehicleCache(prev => {
                        const next = { ...prev };
                        vData.forEach(v => {
                            next[v.placa] = { modelo: v.modelo || 'Não inf.', cor: v.cor || 'Não inf.' };
                        });
                        return next;
                    });
                }
            }
        } catch (err: any) {
            console.error("Erro ao listar faturas:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        fetchPayments();
    }, [fetchPayments]);

    const handleAction = async (paymentId: string, action: 'confirm' | 'refund' | 'cancel', value?: number) => {
        const confirmMsg = action === 'cancel' ? 'Confirmar CANCELAMENTO da fatura?' : 
                         action === 'refund' ? 'Confirmar ESTORNO do valor ao cliente?' : 
                         'Confirmar RECEBIMENTO MANUAL em dinheiro?';
        
        if (!confirm(confirmMsg)) return;
        
        setActionLoading(paymentId);
        try {
            if (action === 'confirm') await AsaasService.confirmManualReceipt(paymentId, value || 0);
            else if (action === 'refund') await AsaasService.refundPayment(paymentId);
            else if (action === 'cancel') await AsaasService.cancelPayment(paymentId);
            
            // Sucesso! Atualiza a lista
            await fetchPayments(true);
        } catch (err: any) {
            alert(`Falha na ação: ${err.message}`);
        } finally {
            setActionLoading(null);
        }
    };

    const filteredPayments = payments.filter(p => {
        const clientName = customerNames[p.customer] || '';
        const search = searchTerm.toLowerCase();
        return (
            p.id.toLowerCase().includes(search) || 
            p.description?.toLowerCase().includes(search) ||
            p.invoiceNumber?.toLowerCase().includes(search) ||
            clientName.toLowerCase().includes(search)
        );
    });

    return (
        <div className="p-4 sm:p-8 bg-gray-900 h-full overflow-y-auto">
            <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white mb-1 uppercase tracking-tighter italic">Gestão de <span className="text-blue-500">Faturamento</span></h1>
                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Controle financeiro integrado ao Asaas</p>
                </div>
                <button 
                    onClick={() => fetchPayments()}
                    className="p-3 bg-gray-800 hover:bg-gray-700 rounded-2xl border border-gray-700 text-blue-400 transition-all active:scale-95 flex items-center gap-2 group"
                >
                    <svg className={`w-6 h-6 ${loading ? 'animate-spin text-white' : 'group-hover:rotate-180 transition-transform'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                    <span className="hidden sm:inline font-black text-[10px] uppercase">Sincronizar</span>
                </button>
            </header>

            {/* Filtros */}
            <div className="bg-gray-800 p-6 rounded-[32px] border border-gray-700 shadow-2xl mb-8 flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <input 
                        type="text" 
                        placeholder="Buscar por cliente, fatura ou placa..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-900 border-2 border-gray-700 rounded-2xl p-4 pl-12 text-white font-bold focus:border-blue-500 outline-none transition-all placeholder:text-gray-600"
                    />
                    <svg className="w-6 h-6 absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
                <select 
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-4 text-white font-black uppercase text-[10px] tracking-widest outline-none focus:border-blue-500 transition-all cursor-pointer"
                >
                    <option value="">Status: Todos</option>
                    <option value="PENDING">Pendentes</option>
                    <option value="RECEIVED">Recebidos</option>
                    <option value="CONFIRMED">Confirmados</option>
                    <option value="RECEIVED_IN_CASH">Recebidos em Espécie</option>
                    <option value="OVERDUE">Vencidos</option>
                    <option value="CANCELLED">Cancelados</option>
                </select>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl text-red-400 text-xs font-bold mb-6 text-center animate-pulse">
                    {error}
                </div>
            )}

            {/* Lista de Faturas */}
            <div className="space-y-4 pb-20">
                {loading && payments.length === 0 ? (
                    <div className="flex flex-col items-center py-20 opacity-30">
                        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="font-black text-[10px] uppercase tracking-widest">Acessando API Bancária...</p>
                    </div>
                ) : filteredPayments.length === 0 ? (
                    <div className="text-center py-32 border-4 border-dashed border-gray-800 rounded-[40px] opacity-30">
                        <p className="text-white font-black uppercase text-sm tracking-widest italic">Nenhuma cobrança localizada</p>
                    </div>
                ) : (
                    filteredPayments.map(p => {
                        const status = STATUS_BADGES[p.status] || { label: p.status, color: 'bg-gray-800 text-gray-400' };
                        const clientName = customerNames[p.customer] || "...";
                        
                        const plateMatch = p.description?.match(/Placa\s+([A-Z0-9-]{7,8})/i);
                        const plate = plateMatch ? plateMatch[1].toUpperCase() : null;
                        const vehicle = plate ? vehicleCache[plate] : null;

                        return (
                            <div key={p.id} className="bg-gray-800 rounded-[32px] border border-gray-700 shadow-xl overflow-hidden group hover:border-blue-500/30 transition-all">
                                <div className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                                    <div className="flex items-start gap-4 flex-1">
                                        <div className="w-14 h-14 bg-gray-900 rounded-2xl flex items-center justify-center text-blue-500 flex-shrink-0 shadow-inner">
                                            {p.billingType === 'PIX' ? (
                                                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 12l10 10 10-10L12 2zm0 17.5L4.5 12 12 4.5 19.5 12 12 19.5z"/></svg>
                                            ) : (
                                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                                <a 
                                                    href={p.bankSlipUrl || p.invoiceUrl} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="text-white font-black hover:text-blue-400 transition-colors uppercase italic tracking-tighter text-lg underline decoration-blue-500/30 underline-offset-4"
                                                >
                                                    Fatura #{p.invoiceNumber || p.id.slice(-8).toUpperCase()}
                                                </a>
                                                <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${status.color}`}>
                                                    {status.label}
                                                </span>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                                                <div>
                                                    <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Nome do Cliente</p>
                                                    <p className="text-white font-bold text-sm truncate">{clientName}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Veículo Detalhes</p>
                                                    <div className="flex items-center gap-2">
                                                        {plate && <span className="bg-white text-black px-1.5 py-0.5 rounded font-mono text-[10px] font-black">{plate}</span>}
                                                        {vehicle ? (
                                                            <p className="text-gray-300 font-bold text-xs uppercase truncate">
                                                                {vehicle.modelo} <span className="text-gray-500">({vehicle.cor})</span>
                                                            </p>
                                                        ) : plate ? <span className="text-gray-600 text-xs font-bold uppercase tracking-widest">Buscando...</span> : <p className="text-gray-600 font-medium text-xs">N/A</p>}
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-[9px] text-gray-600 font-black mt-2 uppercase flex items-center gap-1">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                                Vencimento: {new Date(p.dueDate).toLocaleDateString('pt-BR')}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-8 justify-between lg:justify-end border-t lg:border-t-0 border-gray-700 pt-4 lg:pt-0">
                                        <div className="text-right">
                                            <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">Valor Total</p>
                                            <p className="text-3xl font-black text-white tabular-nums">
                                                {p.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </p>
                                        </div>

                                        <div className="flex gap-2 min-w-[100px] justify-end">
                                            {actionLoading === p.id ? (
                                                <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                <>
                                                    {p.status === 'PENDING' && (
                                                        <>
                                                            <button 
                                                                onClick={() => handleAction(p.id, 'confirm', p.value)}
                                                                className="p-3 bg-green-600/10 text-green-500 hover:bg-green-600 hover:text-white rounded-2xl transition-all border border-green-500/20 shadow-lg active:scale-90"
                                                                title="Confirmar Recebimento Manual (Dinheiro)"
                                                            >
                                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
                                                            </button>
                                                            <button 
                                                                onClick={() => handleAction(p.id, 'cancel')}
                                                                className="p-3 bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white rounded-2xl transition-all border border-red-500/20 shadow-lg active:scale-90"
                                                                title="Cancelar Fatura Permanentemente"
                                                            >
                                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                                                            </button>
                                                        </>
                                                    )}
                                                    {(p.status === 'RECEIVED' || p.status === 'CONFIRMED' || p.status === 'RECEIVED_IN_CASH') && (
                                                        <button 
                                                            onClick={() => handleAction(p.id, 'refund')}
                                                            className="p-3 bg-purple-600/10 text-purple-500 hover:bg-purple-600 hover:text-white rounded-2xl transition-all border border-purple-500/20 shadow-lg active:scale-90"
                                                            title="Estornar Pagamento ao Cliente"
                                                        >
                                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3"></path></svg>
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default InvoicesManagement;
