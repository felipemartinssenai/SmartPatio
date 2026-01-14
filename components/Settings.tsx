
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { AsaasSettings } from '../types';

const Settings: React.FC = () => {
    const [asaas, setAsaas] = useState<AsaasSettings>({ api_key: '', environment: 'sandbox' });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('configuracoes')
            .select('valor')
            .eq('chave', 'asaas_config')
            .single();
        
        if (data?.valor) {
            setAsaas(data.valor);
        }
        setLoading(false);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        const { error } = await supabase
            .from('configuracoes')
            .upsert({ 
                chave: 'asaas_config', 
                valor: asaas 
            }, { onConflict: 'chave' });

        if (error) {
            setMessage({ text: 'Erro ao salvar configurações: ' + error.message, type: 'error' });
        } else {
            setMessage({ text: 'Configurações do Asaas salvas com sucesso!', type: 'success' });
        }
        setSaving(false);
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando configurações...</div>;

    return (
        <div className="p-4 sm:p-8 bg-gray-900 h-full overflow-y-auto">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-1">Configurações</h1>
                <p className="text-gray-400 text-sm">Gerencie integrações e parâmetros do sistema.</p>
            </header>

            <div className="max-w-2xl mx-auto">
                <form onSubmit={handleSave} className="bg-gray-800 rounded-3xl border border-gray-700 shadow-2xl overflow-hidden">
                    <div className="p-6 border-b border-gray-700 bg-gray-700/30 flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        </div>
                        <div>
                            <h2 className="font-bold text-white">Integração Asaas</h2>
                            <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest">Gateway de Pagamentos</p>
                        </div>
                    </div>

                    <div className="p-8 space-y-6">
                        {message && (
                            <div className={`p-4 rounded-xl text-xs font-bold border ${message.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                                {message.text}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Ambiente</label>
                            <div className="grid grid-cols-2 gap-4">
                                <button 
                                    type="button"
                                    onClick={() => setAsaas({...asaas, environment: 'sandbox'})}
                                    className={`py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border-2 ${asaas.environment === 'sandbox' ? 'bg-blue-600 border-blue-400 text-white' : 'bg-gray-900 border-gray-700 text-gray-500'}`}
                                >
                                    Sandbox (Teste)
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setAsaas({...asaas, environment: 'production'})}
                                    className={`py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border-2 ${asaas.environment === 'production' ? 'bg-green-600 border-green-400 text-white' : 'bg-gray-900 border-gray-700 text-gray-500'}`}
                                >
                                    Produção
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">API Access Token</label>
                            <input 
                                type="password"
                                value={asaas.api_key}
                                onChange={e => setAsaas({...asaas, api_key: e.target.value})}
                                placeholder="$asaas_access_token..."
                                className="w-full bg-gray-900 border border-gray-700 rounded-2xl p-4 text-white font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                            <p className="text-[10px] text-gray-600 font-bold uppercase mt-1">Obtenha sua chave no painel do Asaas em Configurações de Conta &gt; API</p>
                        </div>
                    </div>

                    <div className="p-6 bg-gray-900/50 flex justify-end">
                        <button 
                            type="submit" 
                            disabled={saving}
                            className="px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl text-white font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-blue-900/40 disabled:opacity-50 flex items-center gap-3"
                        >
                            {saving ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Settings;
