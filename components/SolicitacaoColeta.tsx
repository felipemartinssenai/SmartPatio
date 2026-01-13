
import React, { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Page } from '../App';

interface SolicitacaoColetaProps {
    setCurrentPage: (page: Page) => void;
}

const initialFormState = {
  placa: '',
  modelo: '',
  cor: '',
  ano: '',
  chassi: '',
  renavam: '',
  observacoes: '',
  proprietarioNome: '',
  proprietarioTelefone: '',
  proprietarioCpf: '',
  proprietarioCep: '',
  proprietarioRua: '',
  proprietarioBairro: '',
  proprietarioNumero: '',
};

const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({ label, ...props }) => (
    <div>
        <label htmlFor={props.id} className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
        <input
          {...props}
          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
    </div>
);

const SolicitacaoColeta: React.FC<SolicitacaoColetaProps> = ({ setCurrentPage }) => {
  const [formData, setFormData] = useState(initialFormState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.placa) {
        setError('A placa é obrigatória.');
        return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);

    // USANDO PADRÃO JSONB PARA EVITAR ERROS DE CACHE DE SCHEMA
    const payload = {
      p_data: {
        p_ano: formData.ano ? parseInt(formData.ano, 10) : null,
        p_chassi: formData.chassi || null,
        p_cor: formData.cor || null,
        p_modelo: formData.modelo || null,
        p_observacoes: formData.observacoes || null,
        p_placa: formData.placa.toUpperCase().trim(),
        p_proprietario_bairro: formData.proprietarioBairro || null,
        p_proprietario_cep: formData.proprietarioCep || null,
        p_proprietario_cpf: formData.proprietarioCpf || null,
        p_proprietario_nome: formData.proprietarioNome || null,
        p_proprietario_numero: formData.proprietarioNumero || null,
        p_proprietario_rua: formData.proprietarioRua || null,
        p_proprietario_telefone: formData.proprietarioTelefone || null,
        p_renavam: formData.renavam || null,
      }
    };

    const { error: rpcError } = await supabase.rpc('create_new_vehicle_collection', payload);

    if (rpcError) {
      console.error('Erro RPC detalhado:', rpcError);
      const msg = rpcError.message || (typeof rpcError === 'object' ? JSON.stringify(rpcError) : String(rpcError));
      setError(`Erro ao salvar: ${msg}`);
    } else {
      setSuccess(`Coleta para ${formData.placa.toUpperCase()} solicitada!`);
      setFormData(initialFormState);
      setTimeout(() => setCurrentPage('patio'), 1500);
    }

    setLoading(false);
  }, [formData, setCurrentPage]);

  return (
    <div className="p-4 sm:p-8 h-full">
      <h1 className="text-3xl font-bold text-white mb-6">Solicitar Nova Coleta</h1>
      <div className="max-w-3xl mx-auto bg-gray-800 p-6 sm:p-8 rounded-lg shadow-lg">
        <form onSubmit={handleSubmit} className="space-y-8">
          {error && <div className="bg-red-500/20 text-red-300 p-3 rounded-md text-center border border-red-500/50">{error}</div>}
          {success && <div className="bg-green-500/20 text-green-300 p-3 rounded-md text-center border border-green-500/50">{success}</div>}

          <fieldset className="border border-gray-700 p-4 rounded-lg">
            <legend className="px-2 text-lg font-semibold text-white">Dados do Veículo</legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
              <InputField label="Placa*" id="placa" name="placa" type="text" value={formData.placa} onChange={handleChange} required placeholder="ABC-1234" />
              <InputField label="Modelo" id="modelo" name="modelo" type="text" value={formData.modelo} onChange={handleChange} />
              <InputField label="Cor" id="cor" name="cor" type="text" value={formData.cor} onChange={handleChange} />
              <InputField label="Ano" id="ano" name="ano" type="number" value={formData.ano} onChange={handleChange} />
            </div>
          </fieldset>
          
          <fieldset className="border border-gray-700 p-4 rounded-lg">
            <legend className="px-2 text-lg font-semibold text-white">Proprietário</legend>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                 <InputField label="Nome" name="proprietarioNome" value={formData.proprietarioNome} onChange={handleChange} />
                 <InputField label="Telefone" name="proprietarioTelefone" value={formData.proprietarioTelefone} onChange={handleChange} />
             </div>
          </fieldset>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-bold transition-all shadow-lg active:scale-[0.98]"
          >
            {loading ? 'Salvando...' : 'Criar Solicitação de Coleta'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SolicitacaoColeta;
