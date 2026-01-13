
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Financeiro, TransactionType } from '../types';

const REFRESH_INTERVAL = 10000;

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const TransactionModal: React.FC<TransactionModalProps> = ({ isOpen, onClose, onSave }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    tipo: 'saida' as TransactionType,
    valor: '',
    descricao: '',
    data: new Date().toISOString().slice(0, 16)
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('financeiro').insert({
      tipo: formData.tipo,
      valor: parseFloat(formData.valor),
      descricao: formData.descricao,
      data: new Date(formData.data).toISOString()
    });

    if (!error) {
      onSave();
      onClose();
      setFormData({ tipo: 'saida', valor: '', descricao: '', data: new Date().toISOString().slice(0, 16) });
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[2000] p-4">
      <div className="bg-gray-800 w-full max-w-md rounded-xl p-6 shadow-2xl border border-gray-700">
        <h2 className="text-xl font-bold text-white mb-6">Novo Lançamento</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Tipo de Lançamento</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, tipo: 'entrada' })}
                className={`py-2 rounded-lg font-bold transition-all ${formData.tipo === 'entrada' ? 'bg-green-600 text-white shadow-lg shadow-green-900/20' : 'bg-gray-700 text-gray-400'}`}
              >
                Entrada
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, tipo: 'saida' })}
                className={`py-2 rounded-lg font-bold transition-all ${formData.tipo === 'saida' ? 'bg-red-600 text-white shadow-lg shadow-red-900/20' : 'bg-gray-700 text-gray-400'}`}
              >
                Saída
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Valor (R$)</label>
            <input
              required
              type="number"
              step="0.01"
              value={formData.valor}
              onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="0,00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Descrição</label>
            <input
              required
              type="text"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ex: Combustível, Manutenção..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Data e Hora</label>
            <input
              required
              type="datetime-local"
              value={formData.data}
              onChange={(e) => setFormData({ ...formData, data: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-gray-700 text-white rounded-lg font-bold hover:bg-gray-600 transition-colors">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50">
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Financials: React.FC = () => {
  const [transactions, setTransactions] = useState<Financeiro[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'todos' | 'entrada' | 'saida'>('todos');
  const [isConnected, setIsConnected] = useState(false);

  const fetchFinancialData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const { data, error } = await supabase
      .from('financeiro')
      .select('*')
      .order('data', { ascending: false });

    if (!error && data) {
      setTransactions(data as Financeiro[]);
    }
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    fetchFinancialData();

    const channel = supabase
      .channel('financeiro_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financeiro' }, () => {
        fetchFinancialData(true);
      })
      .subscribe((status) => setIsConnected(status === 'SUBSCRIBED'));

    const interval = setInterval(() => fetchFinancialData(true), REFRESH_INTERVAL);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchFinancialData]);

  const stats = useMemo(() => {
    return transactions.reduce((acc, curr) => {
      if (curr.tipo === 'entrada') acc.entradas += curr.valor;
      else acc.saidas += curr.valor;
      acc.saldo = acc.entradas - acc.saidas;
      return acc;
    }, { entradas: 0, saidas: 0, saldo: 0 });
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchSearch = t.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = filterType === 'todos' || t.tipo === filterType;
      return matchSearch && matchType;
    });
  }, [transactions, searchTerm, filterType]);

  return (
    <div className="p-4 sm:p-8 flex flex-col h-full bg-gray-900 overflow-y-auto">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Financeiro</h1>
          <p className="text-gray-400 text-sm">Controle de caixa e fluxo de pagamentos em tempo real</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-full">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-[10px] font-bold text-gray-500 uppercase">{isConnected ? 'Live' : 'Offline'}</span>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg shadow-blue-900/20 transition-all flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            Novo Lançamento
          </button>
        </div>
      </header>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-xl">
          <p className="text-gray-400 text-sm font-medium mb-1">Entradas (Mês)</p>
          <p className="text-3xl font-black text-green-400">
            {stats.entradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
        <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-xl">
          <p className="text-gray-400 text-sm font-medium mb-1">Saídas (Mês)</p>
          <p className="text-3xl font-black text-red-400">
            {stats.saidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
        <div className={`bg-gray-800 p-6 rounded-2xl border shadow-xl ${stats.saldo >= 0 ? 'border-blue-500/50' : 'border-red-500/50'}`}>
          <p className="text-gray-400 text-sm font-medium mb-1">Saldo Atual</p>
          <p className={`text-3xl font-black ${stats.saldo >= 0 ? 'text-blue-400' : 'text-red-500'}`}>
            {stats.saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
      </section>

      {/* Filters & Search */}
      <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 mb-6 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          <input
            type="text"
            placeholder="Buscar por descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-2">
          {(['todos', 'entrada', 'saida'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${filterType === t ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
            >
              {t === 'todos' ? 'Todos' : t === 'entrada' ? 'Entradas' : 'Saídas'}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-700/50 text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-700">
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4">Descrição</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {loading && transactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                    Carregando dados financeiros...
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-750 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {new Date(t.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-white">{t.descricao || 'Sem descrição'}</div>
                      {t.movimentacao_id && <div className="text-[10px] text-blue-500 font-bold uppercase mt-1">Check-out de Pátio</div>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${t.tipo === 'entrada' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                        {t.tipo}
                      </span>
                    </td>
                    <td className={`px-6 py-4 text-right font-bold tabular-nums ${t.tipo === 'entrada' ? 'text-green-400' : 'text-red-400'}`}>
                      {t.tipo === 'entrada' ? '+' : '-'} {t.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={() => fetchFinancialData(true)}
      />
    </div>
  );
};

export default Financials;
