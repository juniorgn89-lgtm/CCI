import { useMemo, useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import { MapPin, Fuel, Receipt, Target, TrendingUp } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import type { PostoData } from '../hooks/useNetworkData'

interface Props {
  postos: PostoData[]
}

const performanceColors = {
  above: '#22c55e',
  average: '#eab308',
  below: '#ef4444',
}

const performanceLabels = {
  above: 'Acima da média',
  average: 'Na média',
  below: 'Abaixo da média',
}

const fmt = (v: number) =>
  v >= 1_000_000
    ? `R$ ${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000
      ? `R$ ${(v / 1_000).toFixed(1)}K`
      : `R$ ${v.toFixed(2)}`

const fmtNum = (v: number) =>
  v >= 1_000 ? `${(v / 1_000).toFixed(1)}K` : v.toFixed(0)

// Auto-fit bounds component
const FitBounds = ({ postos }: { postos: PostoData[] }) => {
  const map = useMap()

  useEffect(() => {
    const validPostos = postos.filter(p => p.latitude !== 0 && p.longitude !== 0)
    if (validPostos.length === 0) return

    const bounds: [number, number][] = validPostos.map(p => [p.latitude, p.longitude])
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 })
  }, [postos, map])

  return null
}

const NetworkMap = ({ postos }: Props) => {
  const validPostos = useMemo(
    () => postos.filter(p => p.latitude !== 0 && p.longitude !== 0),
    [postos]
  )

  const center = useMemo<[number, number]>(() => {
    if (validPostos.length === 0) return [-15.79, -47.88] // Brazil center
    const lat = validPostos.reduce((s, p) => s + p.latitude, 0) / validPostos.length
    const lng = validPostos.reduce((s, p) => s + p.longitude, 0) / validPostos.length
    return [lat, lng]
  }, [validPostos])

  if (validPostos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-12 dark:border-gray-700 dark:bg-gray-900">
        <MapPin className="h-12 w-12 text-gray-300 dark:text-gray-600" />
        <p className="mt-4 text-gray-500 dark:text-gray-400">
          Nenhum posto com coordenadas geográficas disponíveis.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white px-5 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Legenda:</span>
        {(['above', 'average', 'below'] as const).map(perf => (
          <div key={perf} className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: performanceColors[perf] }}
            />
            <span className="text-xs text-gray-600 dark:text-gray-400">{performanceLabels[perf]}</span>
          </div>
        ))}
      </div>

      {/* Map */}
      <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm dark:border-gray-700" style={{ height: 500 }}>
        <MapContainer
          center={center}
          zoom={6}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds postos={validPostos} />

          {validPostos.map(posto => (
            <CircleMarker
              key={posto.empresaCodigo}
              center={[posto.latitude, posto.longitude]}
              radius={12}
              fillColor={performanceColors[posto.performance]}
              fillOpacity={0.8}
              color="#fff"
              weight={2}
            >
              <Popup>
                <div style={{ minWidth: 230, padding: 4, color: '#111' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111' }}>{posto.fantasia}</h3>
                    <span
                      style={{
                        backgroundColor: performanceColors[posto.performance],
                        color: '#fff',
                        borderRadius: 9999,
                        padding: '2px 10px',
                        fontSize: 11,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Score {posto.score}
                    </span>
                  </div>
                  <p style={{ margin: '2px 0 8px', fontSize: 12, color: '#666' }}>{posto.cidade}/{posto.estado}</p>
                  <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {([
                      { label: 'Litros', value: `${fmtNum(posto.litros)}L`, Icon: Fuel },
                      { label: 'Receita', value: fmt(posto.receita), Icon: Receipt },
                      { label: 'Abastecimentos', value: fmtNum(posto.abastecimentos), Icon: Target },
                      { label: 'Ticket Médio', value: fmt(posto.ticketMedio), Icon: TrendingUp },
                      { label: 'Conversão', value: `${posto.conversao.toFixed(0)}%`, Icon: null },
                    ] as const).map(row => (
                      <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#555' }}>
                          {row.Icon && <row.Icon style={{ width: 14, height: 14 }} />}
                          {row.label}
                        </span>
                        <span style={{ fontWeight: 600, color: '#111' }}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {/* Posto cards below map */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {validPostos.map(posto => (
          <div
            key={posto.empresaCodigo}
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <div
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: performanceColors[posto.performance] }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-gray-900 dark:text-gray-100">{posto.fantasia}</p>
              <p className="text-xs text-gray-400">{posto.cidade}/{posto.estado}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Score {posto.score}</p>
              <p className="text-xs text-gray-500">{fmt(posto.receita)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default NetworkMap
