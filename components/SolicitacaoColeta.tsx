
import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { Page } from '../App';

interface SolicitacaoColetaProps {
    setCurrentPage: (page: Page) => void;
}

const SolicitacaoColeta: React.FC<SolicitacaoColetaProps> = ({ setCurrentPage }) => {
  // Dados do Veículo
  const [placa, setPlaca] = useState('');
  const [modelo, setModelo] = useState('');
  const [cor, setCor] = useState('');
  const [ano, setAno] = useState('');
  const [chassi, setChassi] = useState('');
  const [renavam, setRenavam] = useState('');
  const [observacoes, setObservacoes] = useState('');
  
  // Dados do Proprietário
  const [proprietarioNome, setProprietarioNome] = useState('');
  const [proprietarioTelefone, setProprietarioTelefone] = useState('');
  const [proprietarioCpf, setProprietarioCpf] = useState('');
  const [proprietarioCep, setProprietarioCep] = useState('');
  const [proprietarioRua, setProprietarioRua] = useState('');
  const [proprietarioBairro, setProprietarioBairro] = useState('');
  const [proprietarioNumero, setProprietarioNumero] = useState('');

  // Estado da UI
  const [loading, setLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleCepBlur = async () => {
    const cep = proprietarioCep.replace(/\D/g, '');
    if (cep.length !== 8) {
        return;
    }
    setCepLoading(true);
    try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        if (data.erro) {
            setError('CEP não encontrado.');
            setProprietarioRua('');
            setProprietarioBairro('');
        } else {
            setError(null);
            setProprietarioRua(data.logradouro);
            setProprietarioBairro(data.bairro);
        }
    } catch (e) {
        setError('Falha ao buscar CEP. Verifique a conexão.');
    } finally {
        setCepLoading(false);
    }
  };
  
  const resetForm = () => {
      setPlaca(''); setModelo(''); setCor(''); setAno('');
      setChassi(''); setRenavam(''); setObservacoes('');
      setProprietarioNome(''); setProprietarioTelefone(''); setProprietarioCpf('');
      setProprietarioCep(''); setProprietarioRua(''); setProprietarioBairro('');
      setProprietarioNumero('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const { error } = await supabase.rpc('create_new_vehicle_collection', {
      p_placa: placa,
      p_modelo: modelo,
      p_cor: cor,
      p_ano: ano ? parseInt(ano) : null,
      p_chassi: chassi,
      p_renavam: renavam,
      p_observacoes: observacoes,
      p_proprietario_nome: proprietarioNome,
      p_proprietario_telefone: proprietarioTelefone,
      p_proprietario_cpf: proprietarioCpf,
      p_proprietario_cep: proprietarioCep,
      p_proprietario_rua: proprietarioRua,
      p_proprietario_bairro: proprietarioBairro,
      p_proprietario_numero: proprietarioNumero,
    });

    if (error) {
      if (error.code === '23505') {
        setError(`A placa ${placa.toUpperCase()} já está registrada no sistema.`);
      } else {
        setError(`Erro ao criar solicitação: ${error.message}`);
      }
    } else {
      setSuccess(`Coleta para o veículo ${placa.toUpperCase()} solicitada com sucesso!`);
      resetForm();
      setTimeout(() => {
        setSuccess(null);
        setCurrentPage('patio');
      }, 2000);
    }

    setLoading(false);
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

  return (
    <div className="p-4 sm:p-8 h-full">
      <h1 className="text-3xl font-bold text-white mb-6">Solicitar Nova Coleta</h1>
      <div className="max-w-3xl mx-auto bg-gray-800 p-6 sm:p-8 rounded-lg shadow-lg">
        <form onSubmit={handleSubmit} className="space-y-8">
          {error && <div className="bg-red-500/20 text-red-300 p-3 rounded-md text-center">{error}</div>}
          {success && <div className="bg-green-500/20 text-green-300 p-3 rounded-md text-center">{success}</div>}

          {/* Dados do Veículo */}
          <fieldset className="border border-gray-700 p-4 rounded-lg">
            <legend className="px-2 text-lg font-semibold text-white">Dados do Veículo</legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
              <InputField label="Placa*" id="placa" type="text" value={placa} onChange={(e) => setPlaca(e.target.value)} required placeholder="ABC-1234" />
              <InputField label="Modelo" id="modelo" type="text" value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Ex: Honda Civic" />
              <InputField label="Cor" id="cor" type="text" value={cor} onChange={(e) => setCor(e.target.value)} placeholder="Ex: Preto" />
              <InputField label="Ano" id="ano" type="number" value={ano} onChange={(e) => setAno(e.target.value)} placeholder="Ex: 2023" />
              <InputField label="Chassi" id="chassi" type="text" value={chassi} onChange={(e) => setChassi(e.target.value)} />
              <InputField label="Renavam" id="renavam" type="text" value={renavam} onChange={(e) => setRenavam(e.target.value)} />
            </div>
            <div className="mt-6">
                <label htmlFor="observacoes" className="block text-sm font-medium text-gray-300 mb-2">Observações (Infrações, Multas, etc.)</label>
                <textarea id="observacoes" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
            </div>
          </fieldset>
          
          {/* Dados do Proprietário */}
          <fieldset className="border border-gray-700 p-4 rounded-lg">
            <legend className="px-2 text-lg font-semibold text-white">Dados do Proprietário</legend>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                 <InputField label="Nome Completo" id="proprietarioNome" type="text" value={proprietarioNome} onChange={(e) => setProprietarioNome(e.target.value)} />
                 <InputField label="Telefone" id="proprietarioTelefone" type="tel" value={proprietarioTelefone} onChange={(e) => setProprietarioTelefone(e.target.value)} />
                 <InputField label="CPF" id="proprietarioCpf" type="text" value={proprietarioCpf} onChange={(e) => setProprietarioCpf(e.target.value)} />
                 <div className="relative">
                    <InputField label="CEP" id="proprietarioCep" type="text" value={proprietarioCep} onChange={(e) => setProprietarioCep(e.target.value)} onBlur={handleCepBlur} />
                    {cepLoading && <div className="absolute top-9 right-3 h-5 w-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div>}
                 </div>
                 <InputField label="Rua / Logradouro" id="proprietarioRua" type="text" value={proprietarioRua} onChange={(e) => setProprietarioRua(e.target.value)} />
                 <InputField label="Bairro" id="proprietarioBairro" type="text" value={proprietarioBairro} onChange={(e) => setProprietarioBairro(e.target.value)} />
                 <InputField label="Nº" id="proprietarioNumero" type="text" value={proprietarioNumero} onChange={(e) => setProprietarioNumero(e.target.value)} />
             </div>
          </fieldset>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition-colors disabled:bg-blue-800 disabled:cursor-not-allowed"
          >
            {loading ? 'Enviando...' : 'Criar Solicitação de Coleta'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SolicitacaoColeta;
