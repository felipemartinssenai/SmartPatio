
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          cargo: "admin" | "operador" | "motorista"
          permissions: string[] | null
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_url?: string | null
          cargo: "admin" | "operador" | "motorista"
          permissions?: string[] | null
        }
        Update: {
          id?: string
          full_name?: string | null
          avatar_url?: string | null
          cargo?: "admin" | "operador" | "motorista"
          permissions?: string[] | null
        }
      }
      veiculos: {
        Row: {
          id: string
          placa: string
          modelo: string | null
          cor: string | null
          status: "aguardando_coleta" | "em_transito" | "no_patio" | "finalizado"
          lat: number | null
          lng: number | null
          codigo_infracao_ctb: string | null
          fotos_avaria_url: string[] | null
          proprietario_nome: string | null
          proprietario_telefone: string | null
          motorista_id: string | null
          created_at: string
          ano: number | null
          chassi: string | null
          renavam: string | null
          observacoes: string | null
          proprietario_cpf: string | null
          proprietario_cep: string | null
          proprietario_rua: string | null
          proprietario_bairro: string | null
          proprietario_numero: string | null
        }
        Insert: {
          id?: string
          placa: string
          modelo?: string | null
          cor?: string | null
          status?: "aguardando_coleta" | "em_transito" | "no_patio" | "finalizado"
          lat?: number | null
          lng?: number | null
          codigo_infracao_ctb?: string | null
          fotos_avaria_url?: string[] | null
          proprietario_nome?: string | null
          proprietario_telefone?: string | null
          motorista_id?: string | null
          created_at?: string
          ano?: number | null
          chassi?: string | null
          renavam?: string | null
          observacoes?: string | null
          proprietario_cpf?: string | null
          proprietario_cep?: string | null
          proprietario_rua?: string | null
          proprietario_bairro?: string | null
          proprietario_numero?: string | null
        }
        Update: {
          id?: string
          placa?: string
          modelo?: string | null
          cor?: string | null
          status?: "aguardando_coleta" | "em_transito" | "no_patio" | "finalizado"
          lat?: number | null
          lng?: number | null
          codigo_infracao_ctb?: string | null
          fotos_avaria_url?: string[] | null
          proprietario_nome?: string | null
          proprietario_telefone?: string | null
          motorista_id?: string | null
          created_at?: string
          ano?: number | null
          chassi?: string | null
          renavam?: string | null
          observacoes?: string | null
          proprietario_cpf?: string | null
          proprietario_cep?: string | null
          proprietario_rua?: string | null
          proprietario_bairro?: string | null
          proprietario_numero?: string | null
        }
      }
      movimentacoes: {
        Row: {
          id: string
          veiculo_id: string
          data_entrada: string | null
          data_saida: string | null
          valor_diaria: number
          total_pago: number | null
          forma_pagamento: string | null
          created_at: string
        }
        Insert: {
          id?: string
          veiculo_id: string
          data_entrada?: string | null
          data_saida?: string | null
          valor_diaria: number
          total_pago?: number | null
          forma_pagamento?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          veiculo_id?: string
          data_entrada?: string | null
          data_saida?: string | null
          valor_diaria?: number
          total_pago?: number | null
          forma_pagamento?: string | null
          created_at?: string
        }
      }
      financeiro: {
        Row: {
          id: string
          tipo: "entrada" | "saida"
          valor: number
          descricao: string | null
          data: string
          movimentacao_id: string | null
        }
        Insert: {
          id?: string
          tipo: "entrada" | "saida"
          valor: number
          descricao?: string | null
          data?: string
          movimentacao_id?: string | null
        }
        Update: {
          id?: string
          tipo?: "entrada" | "saida"
          valor?: number
          descricao?: string | null
          data?: string
          movimentacao_id?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_new_vehicle_collection: {
        Args: {
          p_ano: number | null
          p_chassi: string | null
          p_cor: string | null
          p_modelo: string | null
          p_observacoes: string | null
          p_placa: string | null
          p_proprietario_bairro: string | null
          p_proprietario_cep: string | null
          p_proprietario_cpf: string | null
          p_proprietario_nome: string | null
          p_proprietario_numero: string | null
          p_proprietario_rua: string | null
          p_proprietario_telefone: string | null
          p_renavam: string | null
          p_fotos_avaria_url: string[] | null
        }
        Returns: undefined
      }
    }
    Enums: {
      user_role: "admin" | "operador" | "motorista"
      vehicle_status: "aguardando_coleta" | "em_transito" | "no_patio" | "finalizado"
      transaction_type: "entrada" | "saida"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
