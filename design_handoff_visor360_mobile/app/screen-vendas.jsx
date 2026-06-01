// ── Vendas (module with sub-tabs) — Combustível fully built ──────────────────
const { useState } = React;
function FuelRow({ c, cmp, threshold }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderTop: '1px solid var(--border-soft)' }}>
      <button onClick={() => setOpen((o) => !o)} style={{
        width: '100%', display: 'grid', gridTemplateColumns: '1fr auto auto 18px', alignItems: 'center', gap: 10,
        padding: '11px 14px', border: 'none', background: open ? 'var(--zebra)' : 'transparent', cursor: 'pointer', textAlign: 'left',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nome}</div>
          <div style={{ fontSize: 10, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>
            {fmtLiters(c.litros)} <span style={{ color: 'var(--warn)' }}>· proj {fmtLitersShort(projetar(c.litros))}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{fmtCurrencyShort(c.lb)}</div>
          <div style={{ fontSize: 9.5, color: 'var(--warn)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>proj {fmtCurrencyShort(projetar(c.lb))}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <MarginPill value={c.margem} threshold={threshold} />
          <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--warn)', fontVariantNumeric: 'tabular-nums' }}>proj {fmtPercent(c.margem * (FUEL.kpis.margemProj / FUEL.kpis.margem))}</span>
        </div>
        <span style={{ display: 'flex', justifyContent: 'flex-end', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>
          <Icon name="chevron-right" size={15} color="var(--text-3)" />
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 14px 12px 14px', background: 'var(--zebra)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              ['Faturamento', fmtCurrency(c.fat)],
              ['Custo (LMC)', fmtCurrency(c.custo)],
              ['L.B. / litro', `R$ ${c.lbL.toFixed(3).replace('.', ',')}`],
              ['Participação', fmtPercent((c.litros / FUEL.kpis.litros) * 100)],
              ['Proj. litros', fmtLitersShort(projetar(c.litros)), true],
              ['Proj. L. Bruto', fmtCurrencyShort(projetar(c.lb)), true],
            ].map(([lb, val, isProj]) => (
              <div key={lb} style={{ background: 'var(--surface)', border: `1px solid ${isProj ? 'var(--amber-border)' : 'var(--border)'}`, borderRadius: 9, padding: '8px 10px' }}>
                <div style={{ fontSize: 9.5, color: isProj ? 'var(--warn)' : 'var(--text-3)', fontWeight: isProj ? 600 : 400 }}>{lb}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VendasCombustivel({ filters, dataState }) {
  const cmp = filters.comparativo;
  const k = FUEL.kpis;
  if (dataState === 'loading') return <LoadingScreen />;
  if (dataState === 'empty') return <EmptyCard desc="Sem abastecimentos para o posto e período selecionados." />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <KpiCard label="Litros" tone="blue" icon="droplet" value={fmtLitersShort(k.litros)} delta={k.deltas.litros} deltaLabel={cmp} />
        <KpiCard label="Lucro Bruto" tone="teal" icon="trending-up" value={fmtCurrencyShort(k.lucroBruto)} delta={k.deltas.lucroBruto} deltaLabel={cmp} />
        <KpiCard label="Margem" tone="rose" icon="percent" value={fmtPercent(k.margem)} delta={k.deltas.margem} deltaLabel={cmp} />
        <KpiCard label="L.B. / litro" tone="indigo" icon="gauge" value={`R$ ${k.lbLitro.toFixed(3).replace('.', ',')}`} delta={k.deltas.lbLitro} deltaLabel={cmp} />
      </div>

      <NoCostNote />

      {/* Projeção de fechamento do mês */}
      <ProjecaoSection metrics={[
        { label: 'Litros', realizado: k.litros, fmt: fmtLitersShort },
        { label: 'Faturamento', realizado: k.faturamento, fmt: fmtCurrencyShort },
        { label: 'Lucro Bruto', realizado: k.lucroBruto, fmt: fmtCurrencyShort },
        { label: 'Margem', realizado: k.margem, proj: k.margemProj, ratio: true, fmt: fmtPercent },
        { label: 'L.B. / litro', realizado: k.lbLitro, proj: k.lbLitroProj, ratio: true, fmt: (x) => `R$ ${x.toFixed(3).replace('.', ',')}` },
      ]} />

      <Section icon="bar-chart-3" title="Volume mensal" accent="navy"
        right={<span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>litros</span>}>
        <BarChart data={FUEL.serie} valueKey="litros" color="var(--c1)" highlight="var(--c2)" />
      </Section>

      <Section icon="percent" title="Margem mensal" accent="blue"
        right={<Badge tone="emerald">{fmtPercent(k.margem)}</Badge>}>
        <AreaChart data={FUEL.serie} valueKey="mar" color="var(--c2)" />
      </Section>

      <Section icon="fuel" title="Por combustível" accent="navy" flush
        right={<span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>toque p/ detalhe</span>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto 18px', gap: 10, padding: '7px 14px', fontSize: 9.5, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          <span>Combustível</span><span style={{ textAlign: 'right' }}>L. Bruto</span><span>Margem</span><span></span>
        </div>
        {FUEL.combustiveis.map((c) => <FuelRow key={c.nome} c={c} cmp={cmp} threshold={12} />)}
      </Section>
    </div>
  );
}

const VENDAS_TABS = [
  { id: 'geral', label: 'Visão Geral' },
  { id: 'combustivel', label: 'Combustível' },
  { id: 'pista', label: 'Pista' },
  { id: 'conveniencia', label: 'Conveniência' },
];

function Vendas({ filters, dataState }) {
  const [tab, setTab] = useState('geral');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ScrollTabs tabs={VENDAS_TABS} value={tab} onChange={setTab} />
      <div key={tab} className="v360-screen">
        {tab === 'geral' && <VendasVisaoGeral filters={filters} dataState={dataState} />}
        {tab === 'combustivel' && <VendasCombustivel filters={filters} dataState={dataState} />}
        {tab === 'conveniencia' && <VendasConveniencia filters={filters} dataState={dataState} />}
        {tab === 'pista' && <VendasPista filters={filters} dataState={dataState} />}
      </div>
    </div>
  );
}

// ── Visão Geral — consolidado do posto (combustível + loja + serviços) ───────
function VendasVisaoGeral({ filters, dataState }) {
  const cmp = filters.comparativo;
  const v = VISAO;
  if (dataState === 'loading') return <LoadingScreen />;
  if (dataState === 'empty') return <EmptyCard desc="Sem vendas para o posto e período selecionados." />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <KpiCard span={2} big label="Faturamento total" tone="emerald" icon="dollar-sign"
          value={fmtCurrencyShort(v.faturamento)} delta={v.deltas.faturamento} deltaLabel={cmp}
          sub={fmtCurrency(v.faturamento)} />
        <KpiCard label="Litros" tone="blue" icon="droplet" value={fmtLitersShort(v.litros)} delta={v.deltas.litros} deltaLabel={cmp} />
        <KpiCard label="Margem" tone="rose" icon="percent" value={fmtPercent(v.margem)} delta={v.deltas.margem} deltaLabel={cmp} />
        <KpiCard span={2} label="Ticket médio" tone="amber" icon="receipt" value={fmtCurrency(v.ticket)} delta={v.deltas.ticket} deltaLabel={cmp} />
      </div>

      <Section icon="layers" title="Composição do faturamento" accent="navy">
        <Donut data={v.mix} colors={CHART_VARS} centerTop={fmtCurrencyShort(v.faturamento)} centerSub="total" />
      </Section>

      {/* Projeção de fechamento do mês */}
      <ProjecaoSection metrics={[
        { label: 'Faturamento', realizado: v.faturamento, fmt: fmtCurrencyShort },
        { label: 'Litros', realizado: v.litros, fmt: fmtLitersShort },
        { label: 'Margem', realizado: v.margem, proj: v.margemProj, ratio: true, fmt: fmtPercent },
        { label: 'Ticket médio', realizado: v.ticket, proj: v.ticketProj, ratio: true, fmt: fmtCurrency },
      ]} />

      <Section icon="trending-up" title="Evolução mensal" accent="blue"
        right={<Badge tone="emerald">{fmtCurrencyShort(v.faturamento)}</Badge>}>
        <AreaChart data={v.serie} valueKey="fat" color="var(--c1)" />
      </Section>
    </div>
  );
}

// ── Conveniência — loja ──────────────────────────────────────────────────────
function VendasConveniencia({ filters, dataState }) {
  const cmp = filters.comparativo;
  const c = CONV;
  if (dataState === 'loading') return <LoadingScreen />;
  if (dataState === 'empty') return <EmptyCard desc="Sem vendas de loja para o período selecionado." />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <KpiCard label="Faturamento" tone="emerald" icon="dollar-sign" value={fmtCurrencyShort(c.faturamento)} delta={c.deltas.faturamento} deltaLabel={cmp} />
        <KpiCard label="Margem" tone="teal" icon="percent" value={fmtPercent(c.margem)} delta={c.deltas.margem} deltaLabel={cmp} />
        <KpiCard label="Ticket médio" tone="amber" icon="receipt" value={fmtCurrency(c.ticket)} delta={c.deltas.ticket} deltaLabel={cmp} />
        <KpiCard label="Itens vendidos" tone="indigo" icon="package" value={fmtNumber(c.itens)} delta={c.deltas.itens} deltaLabel={cmp} />
      </div>

      <ProjecaoSection metrics={[
        { label: 'Faturamento', realizado: c.faturamento, fmt: fmtCurrencyShort },
        { label: 'Itens', realizado: c.itens, fmt: (x) => fmtNumber(Math.round(x)) },
        { label: 'Margem', realizado: c.margem, proj: c.margemProj, ratio: true, fmt: fmtPercent },
        { label: 'Ticket médio', realizado: c.ticket, proj: c.ticketProj, ratio: true, fmt: fmtCurrency },
      ]} />

      <Section icon="package" title="Top produtos" accent="navy" right={<span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>faturamento</span>}>
        <HBar data={c.topProdutos} fmt={fmtCurrencyShort} color="var(--c2)" />
      </Section>

      <Section icon="layers" title="Por categoria" accent="blue">
        <Donut data={c.categorias} colors={CHART_VARS} centerTop={fmtCurrencyShort(c.faturamento)} centerSub="total" />
      </Section>
    </div>
  );
}

// ── Pista — forecourt ────────────────────────────────────────────────────────
function VendasPista({ filters, dataState }) {
  const cmp = filters.comparativo;
  const p = PISTA;
  if (dataState === 'loading') return <LoadingScreen />;
  if (dataState === 'empty') return <EmptyCard desc="Sem movimento de pista para o período selecionado." />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <KpiCard label="Abastecimentos" tone="blue" icon="fuel" value={fmtNumber(p.abastecimentos)} delta={p.deltas.abastecimentos} deltaLabel={cmp} />
        <KpiCard label="Litros / abast." tone="indigo" icon="droplet" value={`${p.litrosMedio.toFixed(1).replace('.', ',')} L`} delta={p.deltas.litrosMedio} deltaLabel={cmp} />
        <KpiCard label="Ticket médio" tone="amber" icon="receipt" value={fmtCurrency(p.ticket)} delta={p.deltas.ticket} deltaLabel={cmp} />
        <KpiCard label="Tempo médio" tone="teal" icon="clock" value={p.tempoMedio} delta={p.deltas.tempoMedio} deltaLabel={cmp} />
      </div>

      <Section icon="fuel" title="Litros por produto" accent="navy" right={<span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>litros</span>}>
        <HBar data={p.porProduto} fmt={fmtLitersShort} color="var(--c1)" />
      </Section>

      {/* Projeção de fechamento do mês */}
      <ProjecaoSection metrics={[
        { label: 'Abastecimentos', realizado: p.abastecimentos, fmt: (x) => fmtNumber(Math.round(x)) },
        { label: 'Litros / abast.', realizado: p.litrosMedio, proj: p.litrosMedioProj, ratio: true, fmt: (x) => `${x.toFixed(1).replace('.', ',')} L` },
        { label: 'Ticket médio', realizado: p.ticket, proj: p.ticketProj, ratio: true, fmt: fmtCurrency },
      ]} />

      <Section icon="wallet" title="Formas de pagamento" accent="blue">
        <Donut data={p.pagamentos} colors={CHART_VARS} centerTop={fmtNumber(p.abastecimentos)} centerSub="abast." />
      </Section>
    </div>
  );
}

function SubPlaceholder({ label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 2 }}>
      <div style={{ borderRadius: 12, border: '1px dashed var(--border-strong)', background: 'var(--track)', padding: '34px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.02em' }}>aba "{label}"</span>
        <span style={{ fontSize: 12, color: 'var(--text-2)', maxWidth: 240 }}>Mesma estrutura de KPIs + gráficos + tabela. Não detalhada nesta primeira rodada do shell.</span>
      </div>
    </div>
  );
}

Object.assign(window, { Vendas, VendasVisaoGeral, VendasCombustivel, VendasConveniencia, VendasPista, SubPlaceholder });
