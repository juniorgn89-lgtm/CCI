/** Formata CNPJ (14 dígitos) em 00.000.000/0000-00; devolve como veio se não bater. */
export const formatCnpj = (raw: string | null | undefined) => {
  const d = (raw ?? '').replace(/\D/g, '')
  if (d.length !== 14) return raw ?? ''
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

/** Endereço em uma linha a partir dos campos da empresa Quality. */
export const enderecoLinha = (p: {
  tipoLogradouro?: string
  logradouro?: string
  numero?: string
  bairro?: string
}) =>
  [
    [p.tipoLogradouro, p.logradouro].filter(Boolean).join(' '),
    p.numero,
    p.bairro,
  ]
    .filter((s) => s && String(s).trim())
    .join(', ')
