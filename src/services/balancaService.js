// src/services/balancaService.js

// Essa função será substituída pelo código real da balança CH34x
export const lerPesoDaBalanca = async () => {
  // Simulação: retorna um peso aleatório entre 0.5 e 3.0 kg
  const pesoSimulado = (Math.random() * 2.5 + 0.5).toFixed(2);
  return parseFloat(pesoSimulado);
};
