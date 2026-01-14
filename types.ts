
export type UserRole = 'admin' | 'operador' | 'motorista';
export type VehicleStatus = 'aguardando_coleta' | 'em_transito' | 'no_patio' | 'finalizado';
export type TransactionType = 'entrada' | 'saida';

// Definição das páginas para controle de acesso
export type Page = 
  | 'dashboard' 
  | 'collections' 
  | 'financials' 
  | 'solicitacao_coleta' 
  | 'patio' 
  | 'fechamentos'
  | 'user_management'
  | 'payment_methods'; // Nova página

export interface Profile {
  id: string;
  full_name: string;
  avatar_url?: string;
  cargo: UserRole;
  permissions: Page[]; // Array de strings com as chaves das páginas permitidas
}

export interface FormaPagamento {
  id: string;
  nome: string;
  ativa: boolean;
  created_at?: string;
}

export interface Veiculo {
  id: string;
  placa: string;
  modelo?: string;
  cor?: string;
  status: VehicleStatus;
  lat?: number;
  lng?: number;
  codigo_infracao_ctb?: string;
  fotos_avaria_url?: string[];
  proprietario_nome?: string;
  proprietario_telefone?: string;
  motorista_id?: string;
  created_at: string;
  profiles?: Profile;
  
  ano?: number;
  chassi?: string;
  renavam?: string;
  observacoes?: string;

  proprietario_cpf?: string;
  proprietario_cep?: string;
  proprietario_rua?: string;
  proprietario_bairro?: string;
  proprietario_numero?: string;
}

export interface Movimentacao {
  id: string;
  veiculo_id: string;
  data_entrada?: string;
  data_saida?: string;
  valor_diaria: number;
  total_pago?: number;
  forma_pagamento?: string;
  created_at: string;
}

export interface Financeiro {
  id: string;
  tipo: TransactionType;
  valor: number;
  descricao?: string;
  data: string;
  movimentacao_id?: string;
}

export interface FechamentoReportItem {
    id: string;
    placa: string;
    data_entrada: string | null;
    data_saida: string | null;
    valor_pago: number;
}

export interface AppNotification {
  id:string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
}

export interface FechamentoDetalhe {
    movimentacao_id: string;
    veiculo_id: string;
    placa: string;
    modelo: string;
    cor: string;
    ano: number | null;
    chassi: string;
    renavam: string;
    observacoes: string;
    proprietario_nome: string;
    proprietario_telefone: string;
    proprietario_cpf: string;
    proprietario_cep: string;
    proprietario_rua: string;
    proprietario_bairro: string;
    proprietario_numero: string;
    data_entrada: string;
    data_saida: string;
    valor_diaria: number;
    total_pago: number;
}
