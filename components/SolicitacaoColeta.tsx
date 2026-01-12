
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
  const [cepLoading, setCepLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleCepBlur = useCallback(async () => {
    const cep = formData.proprietarioCep.replace(/\D/g, '');
    if (cep.length !== 8) return;
    setCepLoading(true);
    setError(null);
    try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        if (data.erro) {
            setError('CEP não encontrado.');
            setFormData(prev => ({...prev, proprietarioRua: '', proprietarioBairro: ''}));
        } else {
            setFormData(prev => ({
                ...prev,
                proprietarioRua: data.logradouro,
                proprietarioBairro: data.bairro
            }));
        }
    } catch (e) {
        setError('Falha ao buscar CEP.');
    } finally {
        setCepLoading(false);
    }
  }, [formData.proprietarioCep]);
  
  const resetForm = useCallback(() => {
      setFormData(initialFormState);
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

    // ORDEM ALFABÉTICA RÍGIDA PARA EVITAR ERROS DE CACHE DO SUPABASE
    const rpcPayload = {
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
    };

    const { error: rpcError } = await supabase.rpc('create_new_vehicle_collection', rpcPayload);

    if (rpcError) {
      console.error('Erro RPC:', rpcError);
      if (rpcError.code === '23505') {
        setError(`A placa ${formData.placa.toUpperCase()} já existe no sistema.`);
      } else {
        setError(`Erro: ${rpcError.message}. Tente atualizar o script SQL do banco.`);
      }
    } else {
      setSuccess(`Coleta solicitada com sucesso!`);
      resetForm();
      setTimeout(() => {
        setSuccess(null);
        setCurrentPage('patio');
      }, 1500);
    }

    setLoading(false);
  }, [formData, resetForm, setCurrentPage]);

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
              <InputField label="Modelo" id="modelo" name="modelo" type="text" value={formData.modelo} onChange={handleChange} placeholder="Ex: Honda Civic" />
              <InputField label="Cor" id="cor" name="cor" type="text" value={formData.cor} onChange={handleChange} placeholder="Ex: Preto" />
              <InputField label="Ano" id="ano" name="ano" type="number" value={formData.ano} onChange={handleChange} placeholder="Ex: 2023" />
              <InputField label="Chassi" id="chassi" name="chassi" type="text" value={formData.chassi} onChange={handleChange} />
              <InputField label="Renavam" id="renavam" name="renavam" type="text" value={formData.renavam} onChange={handleChange} />
            </div>
            <div className="mt-6">
                <label htmlFor="observacoes" className="block text-sm font-medium text-gray-300 mb-2">Observações</label>
                <textarea id="observacoes" name="observacoes" value={formData.observacoes} onChange={handleChange} rows={3} className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
            </div>
          </fieldset>
          
          <fieldset className="border border-gray-700 p-4 rounded-lg">
            <legend className="px-2 text-lg font-semibold text-white">Dados do Proprietário</legend>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                 <InputField label="Nome Completo" id="proprietarioNome" name="proprietarioNome" type="text" value={formData.proprietarioNome} onChange={handleChange} />
                 <InputField label="Telefone" id="proprietarioTelefone" name="proprietarioTelefone" type="tel" value={formData.proprietarioTelefone} onChange={handleChange} />
                 <InputField label="CPF" id="proprietarioCpf" name="proprietarioCpf" type="text" value={formData.proprietarioCpf} onChange={handleChange} />
                 <div className="relative">
                    <InputField label="CEP" id="proprietarioCep" name="proprietarioCep" type="text" value={formData.proprietarioCep} onChange={handleChange} onBlur={handleCepBlur} />
                    {cepLoading && <div className="absolute top-9 right-3 h-5 w-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div>}
                 </div>
                 <InputField label="Rua / Logradouro" id="proprietarioRua" name="proprietarioRua" type="text" value={formData.proprietarioRua} onChange={handleChange} />
                 <InputField label="Bairro" id="proprietarioBairro" name="proprietarioBairro" type="text" value={formData.proprietarioBairro} onChange={handleChange} />
                 <InputField label="Nº" id="proprietarioNumero" name="proprietarioNumero" type="text" value={formData.proprietarioNumero} onChange={handleChange} />
             </div>
          </fieldset>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition-colors disabled:bg-blue-800 disabled:cursor-not-allowed shadow-lg"
          >
            {loading ? 'Processando...' : 'Criar Solicitação de Coleta'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SolicitacaoColeta;
