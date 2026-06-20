/**
 * Rótulo de exibição do combustível: tira o "." final que vem do cadastro
 * (ex.: "GASOLINA COMUM." → "GASOLINA COMUM"). Usar só no LABEL — o valor
 * cru (com ponto) continua sendo a chave de filtro/comparação.
 */
export const fuelLabel = (nome: string): string => (nome ?? '').replace(/\.+$/, '').trim()
