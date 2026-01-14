
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { FormaPagamento } from '../types';

const PaymentMethodManagement: React.FC = () => {
    const [methods, setMethods] = useState<FormaPagamento[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [newName, setNewName] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchMethods();
    }, []);

    const fetchMethods = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('formas_pagamento')
            .select('*')
            .order('nome');
        
        if (!error && data) {
            setMethods(data as FormaPagamento[]);
        }
        setLoading(false);
    };

    const handleAddMethod = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;

        setIsSaving(true);
        setError(null);
        try {
            const { error } = await supabase
                .from('formas_pagamento')
                .insert({ nome: newName.trim() });
            
            if (error) throw error;
            setNewName('');
            await fetchMethods();
        } catch (err: any) {
            setError(err.message || 'Erro ao adicionar forma de pagamento');
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleStatus = async (method: FormaPagamento) => {
        const { error } = await supabase
            .from('formas_pagamento')
            .update({ ativa: !method.ativa })
            .eq('id', method.id);
        
        if (!error) {
            await fetchMethods();
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja remover esta forma de pagamento?')) return;
        
        const { error } = await supabase
            .from('formas_pagamento')
            .delete()
            .eq('id', id);
        
        if (!error) {
            await fetchMethods();
        } else {
            alert('Não foi possível excluir. Talvez existam registros vinculados a esta forma.');
        }
    };

    return (
        <div className="p-4 sm:p-8 bg-gray-900 h-full overflow-y-auto">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-1">Formas de Pagamento</h1>
                <p className="text-gray-400 text-sm">Cadastre e gerencie as opções de pagamento aceitas no checkout.</p>
            </header>

            <div className="max-w-2xl mx-auto space-y-8">
                {/* Form Adicionar */}
                <form onSubmit={handleAddMethod} className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-xl flex gap-3">
                    <input 
                        type="text" 
                        placeholder="Nome da Forma (ex: Cartão de Crédito)"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="flex-1 bg-gray-900 border border-gray-700 rounded-xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        required
                    />
                    <button 
                        type="submit" 
                        disabled={isSaving}
                        className="px-8 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-black uppercase tracking-widest text-xs transition-all disabled:opacity-50"
                    >
                        {isSaving ? '...' : 'Adicionar'}
                    </button>
                </form>

                {error && <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs font-bold">{error}</div>}

                {/* Lista */}
                <div className="bg-gray-800 rounded-2xl border border-gray-700 shadow-xl overflow-hidden">
                    <div className="p-4 border-b border-gray-700 bg-gray-700/30">
                        <h2 className="font-bold text-white">Métodos Cadastrados</h2>
                    </div>
                    <div className="divide-y divide-gray-700">
                        {loading ? (
                            <div className="p-8 text-center text-gray-500">Carregando...</div>
                        ) : methods.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">Nenhum método cadastrado.</div>
                        ) : methods.map(m => (
                            <div key={m.id} className="p-4 flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                    <div className={`w-3 h-3 rounded-full ${m.ativa ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-gray-600'}`}></div>
                                    <span className={`font-bold ${m.ativa ? 'text-white' : 'text-gray-500 line-through'}`}>{m.nome}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => handleToggleStatus(m)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${m.ativa ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white' : 'bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white'}`}
                                    >
                                        {m.ativa ? 'Desativar' : 'Ativar'}
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(m.id)}
                                        className="p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentMethodManagement;
