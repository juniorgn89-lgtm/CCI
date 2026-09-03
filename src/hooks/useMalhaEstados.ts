import { useQuery } from '@tanstack/react-query'

/** Sigla da UF → código IBGE (usado na API de malhas). */
export const UF_COD: Record<string, string> = {
  AC: '12', AL: '27', AP: '16', AM: '13', BA: '29', CE: '23', DF: '53',
  ES: '32', GO: '52', MA: '21', MT: '51', MS: '50', MG: '31', PA: '15',
  PB: '25', PR: '41', PE: '26', PI: '22', RJ: '33', RN: '24', RS: '43',
  RO: '11', RR: '14', SC: '42', SP: '35', SE: '28', TO: '17',
}

/**
 * Contorno (GeoJSON) dos estados que contêm a rede de postos, pela malha oficial
 * do IBGE (`servicodados.ibge.gov.br`, CORS liberado). Cacheado pra sempre — a
 * fronteira de um estado não muda. Se a chamada falhar, devolve null e o mapa
 * simplesmente não desenha o realce (degrada com elegância).
 */
export const useMalhaEstados = (ufs: string[]) => {
  const chave = [...new Set(ufs.map((u) => u.toUpperCase()))].filter((u) => UF_COD[u]).sort()
  return useQuery({
    queryKey: ['malha-estados', chave.join(',')],
    enabled: chave.length > 0,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
    queryFn: async () => {
      const features: unknown[] = []
      for (const uf of chave) {
        const cod = UF_COD[uf]
        const url = `https://servicodados.ibge.gov.br/api/v3/malhas/estados/${cod}?formato=application/vnd.geo+json&qualidade=intermediaria`
        try {
          const res = await fetch(url)
          if (!res.ok) continue
          const gj = await res.json()
          if (gj?.type === 'FeatureCollection' && Array.isArray(gj.features)) features.push(...gj.features)
          else if (gj?.type === 'Feature') features.push(gj)
        } catch {
          /* rede fora do ar → sem realce, sem quebrar */
        }
      }
      if (features.length === 0) return null
      return { type: 'FeatureCollection', features } as unknown as GeoJSON.GeoJsonObject
    },
  })
}

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ' ').trim()

interface MunicipioIBGE {
  id: number
  nome: string
}

/**
 * Contorno (GeoJSON) de UM município, pela malha do IBGE. Resolve o nome da
 * cidade → código IBGE consultando a lista de municípios da UF (cacheada).
 * Devolve null se não casar o nome ou a API falhar (degrada sem quebrar).
 */
export const useMalhaMunicipio = (uf: string | undefined, cidade: string | undefined) =>
  useQuery({
    queryKey: ['malha-municipio', uf?.toUpperCase(), cidade ? norm(cidade) : ''],
    enabled: !!uf && !!cidade && !!UF_COD[uf.toUpperCase()],
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
    queryFn: async () => {
      const codUf = UF_COD[uf!.toUpperCase()]
      try {
        const listRes = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${codUf}/municipios`)
        if (!listRes.ok) return null
        const munis = (await listRes.json()) as MunicipioIBGE[]
        const alvo = norm(cidade!)
        const m = munis.find((x) => norm(x.nome) === alvo)
        if (!m) return null
        const res = await fetch(`https://servicodados.ibge.gov.br/api/v3/malhas/municipios/${m.id}?formato=application/vnd.geo+json`)
        if (!res.ok) return null
        const gj = await res.json()
        return (gj ?? null) as GeoJSON.GeoJsonObject | null
      } catch {
        return null
      }
    },
  })
