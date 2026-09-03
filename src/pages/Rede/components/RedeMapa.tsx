import { useEffect, useMemo, useState } from 'react'
import { GeoJSON, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useMalhaEstados, useMalhaMunicipio } from '@/hooks/useMalhaEstados'
import type { RedePosto } from '@/pages/Rede/hooks/useRedePostos'
import {
  PROSPECCAO_STATUS_ORDER,
  prospeccaoStatusCor,
  prospeccaoStatusLabel,
  SEM_VINCULO_COR,
  enderecoLinha,
  formatCnpj,
} from '@/pages/Rede/lib'

/** Centro aproximado do Brasil, usado só enquanto não há pino. */
const CENTRO_BR: [number, number] = [-15.8, -47.9]

type PostoNoMapa = RedePosto & { latitude: number; longitude: number }

const temCoord = (p: RedePosto): p is PostoNoMapa =>
  Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && (p.latitude !== 0 || p.longitude !== 0)

/** Cor do pino: etapa da prospecção quando há vínculo; cinza quando não. */
const corDoPosto = (p: RedePosto) => (p.prospeccao ? prospeccaoStatusCor(p.prospeccao.status) : SEM_VINCULO_COR)

/** Pino em HTML (divIcon) — cor por vínculo, sem depender de imagem do Leaflet. */
const pino = (cor: string, comVinculo: boolean) =>
  L.divIcon({
    className: '',
    html: `<span style="
      display:block;width:14px;height:14px;border-radius:9999px;
      background:${cor};
      border:3px solid ${cor};
      box-shadow:0 0 0 2px rgba(255,255,255,.9);
      opacity:${comVinculo ? 1 : 0.8};
    "></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -8],
  })

/** Pino já posicionado (coords possivelmente deslocadas p/ não empilhar). */
type Marcador = { p: PostoNoMapa; lat: number; lng: number }

/**
 * Espalha postos com coordenada IDÊNTICA (filiais que herdam a coord da matriz
 * na Quality) numa espiral de ~poucas dezenas de metros, pra nenhum ficar
 * escondido embaixo do outro — "N no mapa" passa a mostrar N pinos.
 */
const espalharColisoes = (pts: PostoNoMapa[]): Marcador[] => {
  const vistos = new Map<string, number>()
  return pts.map((p) => {
    const chave = `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`
    const n = vistos.get(chave) ?? 0
    vistos.set(chave, n + 1)
    if (n === 0) return { p, lat: p.latitude, lng: p.longitude }
    const ang = n * 2.399963 // ângulo áureo → distribui bem
    const r = 0.0003 * Math.ceil(n / 6) // ~30 m por anel
    return { p, lat: p.latitude + r * Math.cos(ang), lng: p.longitude + r * Math.sin(ang) }
  })
}

const Enquadrar = ({ pontos, malha }: { pontos: PostoNoMapa[]; malha: GeoJSON.GeoJsonObject | null | undefined }) => {
  const map = useMap()
  useEffect(() => {
    let bounds: L.LatLngBounds | null = null
    // Enquadra o ESTADO inteiro (como o mapa da prospecção): com poucos postos,
    // fitar só nos pontos deixava o zoom apertado e o realce sumia.
    if (malha) {
      try {
        const b = L.geoJSON(malha).getBounds()
        if (b.isValid()) bounds = b
      } catch { /* malha inválida → ignora */ }
    }
    if (pontos.length > 0) {
      const pb = L.latLngBounds(pontos.map((p) => [p.latitude, p.longitude] as [number, number]))
      bounds = bounds ? bounds.extend(pb) : pb
    }
    if (bounds && bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 })
  }, [pontos, malha, map])
  return null
}

type Filtro = 'todos' | 'prospeccao' | 'sem'

const RedeMapa = ({ postos, onSelect }: { postos: RedePosto[]; onSelect: (p: RedePosto) => void }) => {
  const [filtro, setFiltro] = useState<Filtro>('todos')

  // Estado(s) que contêm a rede — realce da fronteira no mapa.
  const ufs = useMemo(() => [...new Set(postos.map((p) => p.estado).filter(Boolean))], [postos])
  const { data: malha } = useMalhaEstados(ufs)

  // Cidade com MAIS postos — ganha um contorno destacado (só se houver ≥2 lá,
  // senão "cidade com mais postos" não diz nada).
  const cidadeTop = useMemo(() => {
    const cont = new Map<string, number>()
    for (const p of postos) if (p.cidade) cont.set(p.cidade, (cont.get(p.cidade) ?? 0) + 1)
    let cidade = ''
    let qtd = 0
    for (const [c, n] of cont) if (n > qtd) { qtd = n; cidade = c }
    if (qtd < 2) return null
    return { cidade, qtd, uf: postos.find((p) => p.cidade === cidade)?.estado }
  }, [postos])
  const { data: malhaMun } = useMalhaMunicipio(cidadeTop?.uf, cidadeTop?.cidade)

  const { visiveis, semCoordenada, temAlgumVinculo } = useMemo(() => {
    const filtrados = postos.filter((p) => {
      if (filtro === 'prospeccao') return !!p.prospeccao
      if (filtro === 'sem') return !p.prospeccao
      return true
    })
    const visiveis = filtrados.filter(temCoord)
    return {
      visiveis,
      semCoordenada: filtrados.length - visiveis.length,
      temAlgumVinculo: postos.some((p) => p.prospeccao),
    }
  }, [postos, filtro])

  // Espalha coords idênticas pra nenhum pino ficar escondido embaixo de outro.
  const marcadores = useMemo(() => espalharColisoes(visiveis), [visiveis])

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {visiveis.length} no mapa
        {semCoordenada > 0 && ` · ${semCoordenada} sem coordenada`}
        {cidadeTop && ` · maior concentração: ${cidadeTop.cidade} (${cidadeTop.qtd})`}
      </p>

      {/* Filtros */}
      <div className="flex flex-wrap gap-1.5">
        <Chip ativo={filtro === 'todos'} onClick={() => setFiltro('todos')}>Todos</Chip>
        <Chip ativo={filtro === 'prospeccao'} onClick={() => setFiltro('prospeccao')} cor="#10b981">Da prospecção</Chip>
        <Chip ativo={filtro === 'sem'} onClick={() => setFiltro('sem')} cor={SEM_VINCULO_COR}>Sem vínculo</Chip>
      </div>

      {/* isolate + z-0: contém os z-index altos do Leaflet (panes/controles ~400-1000)
          neste stacking context, senão eles sobem por cima de dropdowns do header. */}
      <div className="relative z-0 h-[calc(100dvh-20rem)] min-h-[24rem] overflow-hidden rounded-xl border border-gray-200 [isolation:isolate] dark:border-white/10">
        <MapContainer center={CENTRO_BR} zoom={5} scrollWheelZoom className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          {malha && (
            <GeoJSON
              key={ufs.join(',')}
              data={malha}
              interactive={false}
              style={() => ({ color: '#2563eb', weight: 2.5, opacity: 0.9, fillColor: '#2563eb', fillOpacity: 0.06 })}
            />
          )}
          {malhaMun && cidadeTop && (
            <GeoJSON
              key={`mun-${cidadeTop.cidade}`}
              data={malhaMun}
              interactive={false}
              style={() => ({ color: '#1d4ed8', weight: 2, opacity: 0.95, fillColor: '#2563eb', fillOpacity: 0.18, dashArray: '5 3' })}
            >
              <Tooltip permanent direction="center" className="rede-mun-tip">
                {cidadeTop.cidade} · {cidadeTop.qtd} postos
              </Tooltip>
            </GeoJSON>
          )}
          <Enquadrar pontos={visiveis} malha={malha} />
          {marcadores.map(({ p, lat, lng }) => (
            <Marker key={p.codigo} position={[lat, lng]} icon={pino(corDoPosto(p), !!p.prospeccao)}>
              <Popup>
                <div className="min-w-[12rem] space-y-1">
                  <p className="text-sm font-semibold leading-tight">{p.fantasia || p.razao}</p>
                  <p className="text-xs text-gray-500">{formatCnpj(p.cnpj)}</p>
                  <p className="text-xs text-gray-500">
                    {[enderecoLinha(p), p.cidade].filter(Boolean).join(', ')}
                  </p>
                  {p.prospeccao ? (
                    <p className="text-xs">
                      <span className="font-medium text-emerald-600">{p.prospeccao.vendedor || '—'}</span>
                      {' · '}
                      {prospeccaoStatusLabel(p.prospeccao.status)}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400">Sem vínculo de prospecção</p>
                  )}
                  <button
                    onClick={() => onSelect(p)}
                    className="pt-1 text-xs font-medium text-[#2563eb] underline"
                  >
                    Abrir ficha
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        {temAlgumVinculo &&
          PROSPECCAO_STATUS_ORDER.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: prospeccaoStatusCor(s) }} />
              {prospeccaoStatusLabel(s)}
            </span>
          ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: SEM_VINCULO_COR }} />
          Sem vínculo
        </span>
      </div>
    </div>
  )
}

const Chip = ({
  ativo,
  onClick,
  cor,
  children,
}: {
  ativo: boolean
  onClick: () => void
  cor?: string
  children: React.ReactNode
}) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
      ativo
        ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white'
        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300'
    }`}
  >
    {cor && <span className="h-2 w-2 rounded-full" style={{ background: ativo ? 'currentColor' : cor }} />}
    {children}
  </button>
)

export default RedeMapa
