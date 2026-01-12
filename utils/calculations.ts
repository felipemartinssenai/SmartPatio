
/**
 * Calcula o valor total das diárias com base nas datas de entrada e saída.
 * REGRA DE NEGÓCIO: Se o tempo excedente à última diária for maior que 60 minutos,
 * cobra-se uma nova diária completa.
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
  if (diffMs <= 0) {
    return 0;
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

  // Se houver tempo restante, verifica a regra de tolerância
  if (minutosRestantes > 0) {
    if (minutosRestantes > 60) {
      // Se excedeu 60 minutos de tolerância, cobra uma diária a mais
      totalDiariasACobrar += 1;
    } else if (diasCompletos === 0) {
      // Se for a primeira diária e ficou menos de 60 minutos, cobra 1 diária mínima
      totalDiariasACobrar = 1;
    }
  } else if (diasCompletos === 0 && diffMs > 0) {
    // Se ficou um tempo mínimo (mas menos de 1 minuto), ainda cobra 1 diária
    totalDiariasACobrar = 1;
  }

  // Se não ficou nenhuma diária completa e nenhum tempo excedente, mas a entrada e saída são diferentes, cobra 1 diária
  if (totalDiariasACobrar === 0 && diffMs > 0) {
    totalDiariasACobrar = 1;
  }

  return totalDiariasACobrar * valorDiaria;
};

// Exemplo de uso:
// const dataEntrada = '2023-01-01T10:00:00.000Z';
// const dataSaida = '2023-01-02T11:01:00.000Z'; // 1 dia, 1 hora e 1 minuto
// const valorDiaria = 50.00;
// const total = calcularTotalDiarias(dataEntrada, dataSaida, valorDiaria);
// console.log(total); // Deve retornar 100 (2 diárias * R$50)
