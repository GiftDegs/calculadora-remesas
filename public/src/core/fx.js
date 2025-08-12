export function calcularCruce(origen, destino, modo, monto, tasa) {
  const esColAVen = origen === 'COP' && destino === 'VES';
  if (modo === 'enviar') return esColAVen ? monto / tasa : monto * tasa;
  return esColAVen ? monto * tasa : monto / tasa;
}
