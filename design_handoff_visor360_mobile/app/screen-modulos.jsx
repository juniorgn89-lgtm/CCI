// ── Gestão › Financeiro e Estoques ───────────────────────────────────────────
const { useState } = React;

// ── Financeiro ────────────────────────────────────────────────────────────────
function Financeiro({ filters, dataState }) {
  const cmp = (filters && filters.comparativo) || 'mês ant.';
  if (dataState === 'loading') return <LoadingScreen />;
  if (dataState === 'empty') return <EmptyCard desc="Sem movimento financeiro para o período selecionado." />;
  const f = FINANCEIRO;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <KpiCard span={2} big label="Saldo em caixa" tone="navy" icon="wallet" value={fmtCurrency(f.saldoCaixa)} delta={f.deltas.saldoCaixa} deltaLabel={cmp} />
        <KpiCard label="A receber" tone="emerald" icon="arrow-down-left" value={fmtCurrencyShort(f.aReceber)} delta={f.deltas.aReceber} deltaLabel={cmp}
          sub={`${fmtCurrencyShort(f.aReceberVencido)} vencido`} />
        <KpiCard label="A pagar" tone="rose" icon="arrow-up-right" value={fmtCurrencyShort(f.aPagar)} delta={f.deltas.aPagar} deltaLabel={cmp} sub="em dia" />
        <KpiCard span={2} label="Resultado do mês" tone="teal" icon="trending-up" value={fmtCurrency(f.resultadoMes)} delta={f.deltas.resultadoMes} deltaLabel={cmp}
          sub={`margem líquida ${fmtPercent(f.margemLiquida)}`} />
      </div>

      {/* Projeção */}
      <ProjecaoSection metrics={[
        { label: 'Receita', realizado: f.receitaMes, fmt: fmtCurrencyShort },
        { label: 'Despesa', realizado: f.despesaMes, fmt: fmtCurrencyShort },
        { label: 'Resultado', realizado: f.resultadoMes, fmt: fmtCurrencyShort },
        { label: 'Margem líquida', realizado: f.margemLiquida, proj: f.margemLiquidaProj, ratio: true, fmt: fmtPercent },
      ]} />

      {/* Fluxo de caixa */}
      <Section icon="trending-up" title="Fluxo de caixa" accent="navy">
        <AreaChart data={f.fluxo} valueKey="entrada" lineKey="saida" color="var(--c1)" lineColor="var(--neg)" />
        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 10.5, color: 'var(--text-3)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 3, borderRadius: 2, background: 'var(--c1)' }} />Entradas</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 0, borderTop: '2px dashed var(--neg)' }} />Saídas</span>
        </div>
      </Section>

      {/* DRE simplificada */}
      <Section icon="file-text" title="DRE simplificada" accent="blue" flush right={<span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{FECHAMENTOS.mes}</span>}>
        {f.dre.map((r, i) => {
          const sub = r.tipo === 'subtotal' || r.tipo === 'resultado';
          return (
            <div key={r.label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px',
              borderTop: i ? '1px solid var(--border-soft)' : 'none',
              background: r.tipo === 'resultado' ? 'var(--accent-soft)' : sub ? 'var(--zebra)' : 'transparent',
            }}>
              <span style={{ fontSize: sub ? 12.5 : 12, fontWeight: sub ? 700 : 500, color: r.tipo === 'neg' ? 'var(--text-2)' : 'var(--text)' }}>{r.label}</span>
              <span style={{ fontSize: sub ? 13 : 12, fontWeight: sub ? 700 : 600, fontVariantNumeric: 'tabular-nums',
                color: r.tipo === 'resultado' ? 'var(--accent)' : r.valor < 0 ? 'var(--neg)' : 'var(--text)' }}>
                {r.valor < 0 ? '−' : ''}{fmtCurrency(Math.abs(r.valor))}
              </span>
            </div>
          );
        })}
      </Section>

      {/* Contas a pagar */}
      <Section icon="arrow-up-right" title="Contas a pagar" accent="amber" flush right={<Badge tone="rose">{fmtCurrencyShort(f.aPagar)}</Badge>}>
        {f.pagar.map((p, i) => (
          <div key={p.faixa} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', borderTop: i ? '1px solid var(--border-soft)' : 'none', background: i % 2 ? 'var(--zebra)' : 'transparent' }}>
            <span style={{ fontSize: 12.5, color: 'var(--text)' }}>{p.faixa}</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(p.valor)}</span>
          </div>
        ))}
      </Section>
    </div>
  );
}

// ── Estoques ──────────────────────────────────────────────────────────────────
function TankRow({ t }) {
  const pct = (t.atual / t.capacidade) * 100;
  const alerta = t.status === 'alerta';
  const barColor = alerta ? 'var(--neg)' : pct < 30 ? 'var(--warn)' : 'var(--bar)';
  const covTone = t.cobertura < 1.5 ? 'rose' : t.cobertura < 3 ? 'amber' : 'emerald';
  return (
    <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-soft)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.produto}</span>
        {alerta && <Badge tone="rose">● Reabastecer</Badge>}
        <Badge tone={covTone}>{t.cobertura.toFixed(1).replace('.', ',')} dias</Badge>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1 }}><ProgressBar pct={pct} color={barColor} height={7} /></div>
        <span style={{ fontSize: 10.5, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums', width: 96, textAlign: 'right' }}>
          {fmtNumber(t.atual)} / {fmtNumber(t.capacidade)} L
        </span>
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
        {Math.round(pct)}% cheio · venda {fmtLiters(t.vendaDia)}/dia
      </div>
    </div>
  );
}

function Estoques({ filters, dataState }) {
  const cmp = (filters && filters.comparativo) || 'mês ant.';
  if (dataState === 'loading') return <LoadingScreen />;
  if (dataState === 'empty') return <EmptyCard desc="Sem leitura de estoque para o posto selecionado." />;
  const e = ESTOQUES;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <KpiCard label="Volume em tanque" tone="blue" icon="droplet" value={fmtLitersShort(e.volumeTotal)} delta={e.deltas.volumeTotal} deltaLabel={cmp} />
        <KpiCard label="Cobertura média" tone="teal" icon="clock" value={`${e.coberturaMedia.toFixed(1).replace('.', ',')} dias`} delta={e.deltas.coberturaMedia} deltaLabel={cmp} />
        <KpiCard label="Tanques em alerta" tone={e.tanquesAlerta ? 'rose' : 'emerald'} icon="alert-triangle" value={String(e.tanquesAlerta)} sub={`de ${e.tanques.length}`} />
        <KpiCard label="Valor em estoque" tone="navy" icon="dollar-sign" value={fmtCurrencyShort(e.valorEstoque)} delta={e.deltas.valorEstoque} deltaLabel={cmp} />
      </div>

      {/* Alerta de cobertura */}
      {e.tanquesAlerta > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 13px', borderRadius: 11, background: 'var(--amber-soft)', border: '1px solid var(--amber-border)' }}>
          <Icon name="alert-triangle" size={16} color="var(--warn)" />
          <span style={{ flex: 1, fontSize: 11.5, color: 'var(--text-2)' }}><strong style={{ color: 'var(--text)', fontWeight: 600 }}>{e.tanquesAlerta} tanque</strong> com cobertura crítica (&lt; 1,5 dia). Reposição sugerida abaixo.</span>
        </div>
      )}

      {/* Níveis de tanque (heatmap por cobertura) */}
      <Section icon="package" title="Níveis de tanque" accent="navy" flush right={<span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>cobertura</span>}>
        {e.tanques.map((t) => <TankRow key={t.produto} t={t} />)}
      </Section>

      {/* Reposição sugerida (read-only) */}
      <Section icon="trending-up" title="Reposição sugerida" accent="amber" flush>
        {e.reposicao.map((r, i) => (
          <div key={r.produto} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderTop: i ? '1px solid var(--border-soft)' : 'none', background: i % 2 ? 'var(--zebra)' : 'transparent' }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--amber-soft)', border: '1px solid var(--amber-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="droplet" size={15} color="var(--warn)" />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{r.produto}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>sugestão: {fmtLiters(r.sugestao)}</div>
            </div>
            <Badge tone={r.prazo === 'hoje' ? 'rose' : 'amber'}>{r.prazo}</Badge>
          </div>
        ))}
      </Section>
    </div>
  );
}

Object.assign(window, { Financeiro, Estoques });
