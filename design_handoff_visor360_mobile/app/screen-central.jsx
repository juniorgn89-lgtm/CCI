// ── Central da Rede — consolidated network dashboard ─────────────────────────
const { useState } = React;
function CentralDaRede({ filters, dataState }) {
  const [serieMode, setSerieMode] = useState('fat');
  if (dataState === 'loading') return <LoadingScreen />;
  if (dataState === 'empty') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <EmptyCard desc="Nenhum posto retornou dados para Mai/2026. Verifique a apuração ou o período." />
    </div>
  );

  const cmp = filters.comparativo;
  const k = REDE;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <KpiCard span={2} big label="Faturamento da Rede" tone="emerald" icon="dollar-sign"
          value={fmtCurrencyShort(k.faturamento)} delta={k.deltas.faturamento} deltaLabel={cmp}
          sub={`${POSTOS.length} postos · ${fmtCurrency(k.faturamento)}`} />
        <KpiCard label="Litros" tone="blue" icon="droplet" value={fmtLitersShort(k.litros)} delta={k.deltas.litros} deltaLabel={cmp} />
        <KpiCard label="Margem" tone="rose" icon="percent" value={fmtPercent(k.margem)} delta={k.deltas.margem} deltaLabel={cmp} />
        <KpiCard label="Lucro Bruto" tone="teal" icon="trending-up" value={fmtCurrencyShort(k.lucroBruto)} delta={k.deltas.lucroBruto} deltaLabel={cmp} />
        <KpiCard label="Ticket Médio" tone="amber" icon="receipt" value={fmtCurrency(k.ticketMedio)} delta={k.deltas.ticketMedio} deltaLabel={cmp} />
        <KpiCard span={2} label="Abastecimentos" tone="indigo" icon="fuel" value={fmtNumber(k.abastecimentos)} delta={k.deltas.abastecimentos} deltaLabel={cmp} />
      </div>

      {/* Projeção de fechamento do mês */}
      <ProjecaoSection metrics={[
        { label: 'Faturamento', realizado: k.faturamento, fmt: fmtCurrencyShort },
        { label: 'Litros', realizado: k.litros, fmt: fmtLitersShort },
        { label: 'Lucro Bruto', realizado: k.lucroBruto, fmt: fmtCurrencyShort },
        { label: 'Abastecimentos', realizado: k.abastecimentos, fmt: (v) => fmtNumber(Math.round(v)) },
        { label: 'Margem', realizado: k.margem, proj: k.margemProj, ratio: true, fmt: fmtPercent },
        { label: 'Ticket médio', realizado: k.ticketMedio, proj: k.ticketProj, ratio: true, fmt: fmtCurrency },
      ]} />

      {/* Monthly evolution */}
      <Section icon="trending-up" title="Evolução mensal" accent="navy"
        right={<Segmented value={serieMode} onChange={setSerieMode}
          options={[{ value: 'fat', label: 'Faturam.' }, { value: 'mar', label: 'Margem' }]} />}>
        {serieMode === 'fat'
          ? <AreaChart data={k.serie} valueKey="fat" color="var(--c1)" lineColor="var(--c2)" lineKey="mar" />
          : <AreaChart data={k.serie} valueKey="mar" color="var(--c2)" />}
        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 10.5, color: 'var(--text-3)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 3, borderRadius: 2, background: 'var(--c1)' }} />Faturamento</span>
          {serieMode === 'fat' && <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 0, borderTop: '2px dashed var(--c2)' }} />Margem %</span>}
        </div>
      </Section>

      {/* Ranking de postos */}
      <Section icon="trophy" title="Ranking de postos" accent="amber" flush
        right={<span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>por faturamento</span>}>
        {POSTOS.map((p, i) => (
          <div key={p.codigo} style={{ padding: '11px 14px', borderTop: i ? '1px solid var(--border-soft)' : 'none', background: i % 2 ? 'var(--zebra)' : 'transparent' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 800, width: 26, textAlign: 'center', color: i === 0 ? '#d97706' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : 'var(--text-3)' }}>#{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nome}</div>
                <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{p.cidade} · {fmtLitersShort(p.litros)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{fmtCurrencyShort(p.faturamento)}</div>
                <div style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--warn)', fontVariantNumeric: 'tabular-nums' }}>proj {fmtCurrencyShort(projetar(p.faturamento))}</div>
                <Delta value={p.delta} label={cmp} small />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <div style={{ flex: 1 }}><ProgressBar pct={p.share} color="var(--bar)" /></div>
              <span style={{ fontSize: 10, color: 'var(--text-3)', width: 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.share.toFixed(1)}%</span>
              <MarginPill value={p.margem} />
            </div>
          </div>
        ))}
      </Section>

      {/* Pagamentos */}
      <Section icon="wallet" title="Formas de pagamento" accent="blue">
        <Donut data={REDE.pagamentos} colors={CHART_VARS}
          centerTop={fmtCurrencyShort(REDE.faturamento)} centerSub="total" />
      </Section>
    </div>
  );
}

window.CentralDaRede = CentralDaRede;
