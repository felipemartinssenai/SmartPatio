
/**
 * Calcula o valor total das diárias com base nas datas de entrada e saída.
 * REGRA DE NEGÓCIO: 
 * 1. Se a diferença for zero (Check-in e Checkout iguais), cobra-se 1 diária.
 * 2. Se o tempo excedente à última diária for maior que 60 minutos, cobra-se uma nova diária completa.
 * 3. Qualquer tempo de permanência inferior a 24h + 60min resulta em pelo menos 1 diária.
 *
 * @param dataEntradaISO - A data e hora de entrada do veículo no formato ISO string.
 * @param dataSaidaISO - A data e hora de saída do veículo no formato ISO string.
 * @param valorDiaria - O custo de uma diária.
 * @returns O valor total a ser pago.
 */
export const calcularTotalDiarias = (
  dataEntradaISO: string,
  dataSaidaISO: string,
  valorDiaria: number
): number => {
  if (!dataEntradaISO || !dataSaidaISO || valorDiaria <= 0) {
    return 0;
  }

  const dataEntrada = new Date(dataEntradaISO);
  const dataSaida = new Date(dataSaidaISO);

  // Calcula a diferença total em milissegundos
  const diffMs = dataSaida.getTime() - dataEntrada.getTime();
  
  // Se a saída for antes da entrada (erro de input), retornamos 0 ou tratamos como 1 se for muito próximo
  if (diffMs < 0) {
    return 0;
  }

  // REGRA SOLICITADA: Se forem iguais (diffMs === 0), cobra 1 diária.
  if (diffMs === 0) {
    return valorDiaria;
  }

  // Constantes para conversão
  const msPorMinuto = 1000 * 60;
  const msPorDia = msPorMinuto * 60 * 24;

  // Calcula o número de dias completos (períodos de 24h)
  const diasCompletos = Math.floor(diffMs / msPorDia);

  // Calcula o tempo restante em milissegundos após subtrair os dias completos
  const msRestantes = diffMs % msPorDia;
  
  // Converte o tempo restante para minutos
  const minutosRestantes = msRestantes / msPorMinuto;
  
  let totalDiariasACobrar = diasCompletos;

  // Se houver tempo restante, verifica a regra de tolerância de 60 minutos
  if (minutosRestantes > 0) {
    if (minutosRestantes > 60) {
      // Se excedeu 60 minutos de tolerância além de um dia completo, cobra uma diária a mais
      totalDiariasACobrar += 1;
    } else if (diasCompletos === 0) {
      // Se estiver no primeiro dia e ficou qualquer tempo (mesmo < 60min), cobra 1 diária mínima
      totalDiariasACobrar = 1;
    }
  }

  // Fallback de segurança: se houve permanência mas o cálculo resultou em 0, garante 1 diária
  if (totalDiariasACobrar === 0 && diffMs >= 0) {
    totalDiariasACobrar = 1;
  }

  return totalDiariasACobrar * valorDiaria;
};
