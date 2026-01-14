
import { supabase } from './supabase';

export class AsaasService {
    private static async getSettings() {
        const { data } = await supabase
            .from('configuracoes')
            .select('valor')
            .eq('chave', 'asaas_config')
            .single();
        
        return data?.valor as { api_key: string, environment: string } | null;
    }

    private static async request(endpoint: string, method: string = 'GET', body?: any) {
        const settings = await this.getSettings();
        if (!settings?.api_key) throw new Error('API Access Token não configurado.');

        const baseUrl = settings.environment === 'production' 
            ? 'https://www.asaas.com/api/v3' 
            : 'https://sandbox.asaas.com/api/v3';

        const separator = endpoint.includes('?') ? '&' : '?';
        const fullTargetUrl = `${baseUrl}${endpoint}${separator}t=${Date.now()}`;
        
        // CORREÇÃO: O proxy precisa que a URL COMPLETA de destino seja codificada
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(fullTargetUrl)}`;

        try {
            const response = await fetch(proxyUrl, {
                method,
                headers: {
                    'access_token': settings.api_key,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: body ? JSON.stringify(body) : undefined
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.errors?.[0]?.description || `Erro na API (${response.status})`);
            }

            // DELETE no Asaas as vezes retorna 200 vazio ou com {deleted: true}
            if (method === 'DELETE') return { deleted: true };

            return await response.json();
        } catch (error: any) {
            console.error(`Erro Asaas [${method} ${endpoint}]:`, error);
            throw error;
        }
    }

    static async listPayments(filters: { status?: string, offset?: number, limit?: number } = {}) {
        let endpoint = '/payments?';
        if (filters.status) endpoint += `status=${filters.status}&`;
        endpoint += `offset=${filters.offset || 0}&limit=${filters.limit || 20}`;
        return this.request(endpoint);
    }

    static async getCustomer(customerId: string) {
        return this.request(`/customers/${customerId}`);
    }

    static async createCustomer(name: string, cpfCnpj: string, mobilePhone: string) {
        return this.request('/customers', 'POST', {
            name,
            cpfCnpj: cpfCnpj.replace(/\D/g, '') || '00000000000',
            mobilePhone: mobilePhone.replace(/\D/g, '') || '00000000000'
        });
    }

    static async createPayment(customerId: string, value: number, billingType: 'PIX' | 'BOLETO', description: string) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 1);

        return this.request('/payments', 'POST', {
            customer: customerId,
            billingType,
            value,
            dueDate: dueDate.toISOString().split('T')[0],
            description
        });
    }

    static async getPixQrCode(paymentId: string) {
        return this.request(`/payments/${paymentId}/pixQrCode`);
    }

    static async checkPaymentStatus(paymentId: string) {
        const payment = await this.request(`/payments/${paymentId}`);
        return payment.status; 
    }

    static async confirmManualReceipt(paymentId: string, value: number) {
        return this.request(`/payments/${paymentId}/receiveInCash`, 'POST', {
            paymentDate: new Date().toISOString().split('T')[0],
            value
        });
    }

    static async refundPayment(paymentId: string) {
        return this.request(`/payments/${paymentId}/refund`, 'POST');
    }

    static async cancelPayment(paymentId: string) {
        return this.request(`/payments/${paymentId}`, 'DELETE');
    }
}
