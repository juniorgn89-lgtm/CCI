// ── Fechamentos — acompanhamento de apuração ─────────────────────────────────
const { useState } = React;

const FECH_TONE_BG = {
  apurado: { bg: 'rgba(16,185,129,0.16)', fg: 'var(--pos)', bd: 'transparent' },
  andamento: { bg: 'var(--accent-soft2)', fg: 'var(--accent)', bd: 'var(--accent)' },
  pendente: { bg: 'var(--amber-soft)', fg: 'var(--warn)', bd: 'var(--amber-border)' },
  futuro: { bg: 'transparent', fg: 'var(--text-3)', bd: 'var(--border-soft)' },
};
const WEEK = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function ApuracaoCalendar({ dias, ano, mesIdx }) {
  const firstDow = new Date(ano, mesIdx, 1).getDay(); // 0=Dom
  const cells = [...Array(firstDow).fill(null), ...dias];
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5, marginBottom: 6 }}>
        {WEEK.map((w, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 9.5, fontWeight: 600, color: 'var(--text-3)' }}>{w}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
        {cells.map((c, i) => {
          if (!c) return <div key={i} />;
          const t = FECH_TONE_BG[c.status];
          const isToday = c.status === 'andamento';
          return (
            <div key={i} style={{
              aspectRatio: '1', borderRadius: 9, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 1,
              background: t.bg, border: `1px solid ${t.bd}`,
              boxShadow: isToday ? '0 0 0 1.5px var(--accent)' : 'none',
            }}>
              <span style={{ fontSize: 12, fontWeight: isToday ? 700 : 600, color: c.status === 'futuro' ? 'var(--text-3)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{c.dia}</span>
              {c.status !== 'futuro' && <span style={{ width: 4, height: 4, borderRadius: 999, background: t.fg }} />}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px 14px', marginTop: 12 }}>
        {[['apurado', 'Apurado'], ['andamento', 'Hoje'], ['pendente', 'Pendente'], ['futuro', 'Futuro']].map(([k, lbl]) => (
          <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: 'var(--text-3)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: FECH_TONE_BG[k].bg, border: `1px solid ${FECH_TONE_BG[k].bd === 'transparent' ? FECH_TONE_BG[k].fg : FECH_TONE_BG[k].bd}` }} />
            {lbl}
          </span>
        ))}
      </div>
    </div>
  );
}

function Fechamentos({ filters, dataState }) {
  if (dataState === 'loading') return <LoadingScreen />;
  if (dataState === 'empty') return <EmptyCard desc="Nenhum fechamento registrado para o período selecionado." />;
  const f = FECHAMENTOS;
  const pendentes = f.dias.filter((d) => d.status === 'pendente');
  const recentes = f.dias.filter((d) => d.status !== 'futuro').slice(-6).reverse();
  const dif = f.difAcumulada;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Status do mês */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
        <span style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--navy-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="file-text" size={20} color="var(--navy-ico)" />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Apuração de {f.mes}</div>
          <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{f.diasApurados} de {f.diasNoMes} dias apurados · último {f.ultimo}</div>
        </div>
        <Badge tone={pendentes.length ? 'amber' : 'emerald'}>{pendentes.length ? `${pendentes.length} pendente${pendentes.length > 1 ? 's' : ''}` : 'Em dia'}</Badge>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <KpiCard label="Dias apurados" tone="emerald" icon="check" value={`${f.diasApurados}/${f.diasNoMes}`} sub={`${Math.round(f.diasApurados / f.diasNoMes * 100)}% do mês`} />
        <KpiCard label="Dias pendentes" tone="amber" icon="alert-triangle" value={String(f.diasPendentes)} sub="aguardando dados" />
        <KpiCard label="Valor conferido" tone="navy" icon="dollar-sign" value={fmtCurrencyShort(f.valorConferido)} sub="período apurado" />
        <KpiCard label="Diferença acum." tone={dif >= 0 ? 'emerald' : 'rose'} icon={dif >= 0 ? 'arrow-up-right' : 'arrow-down-left'}
          value={`${dif >= 0 ? '+' : ''}${fmtCurrency(dif)}`} sub="conferido vs sistema" />
      </div>

      {/* Calendário de apuração */}
      <Section icon="calendar" title="Calendário de apuração" accent="navy"
        right={<span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{f.mes}</span>}>
        <ApuracaoCalendar dias={f.dias} ano={f.ano} mesIdx={f.mesIdx} />
      </Section>

      {/* Pendências */}
      {pendentes.length > 0 && (
        <Section icon="alert-triangle" title="Pendências" accent="amber" flush>
          {pendentes.map((d, i) => (
            <div key={d.dia} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', borderTop: i ? '1px solid var(--border-soft)' : 'none' }}>
              <span style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--amber-soft)', border: '1px solid var(--amber-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--warn)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{d.dia}</span>
                <span style={{ fontSize: 7.5, color: 'var(--warn)', textTransform: 'uppercase' }}>mai</span>
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>Fechamento pendente</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>Custo (LMC) não recebido</div>
              </div>
              <Badge tone="amber">Pendente</Badge>
            </div>
          ))}
        </Section>
      )}

      {/* Últimos fechamentos */}
      <Section icon="clock" title="Últimos fechamentos" accent="blue" flush>
        <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto auto', gap: 10, padding: '7px 14px', fontSize: 9.5, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          <span>Dia</span><span>Status</span><span style={{ textAlign: 'right' }}>Conferido</span><span style={{ textAlign: 'right' }}>Dif.</span>
        </div>
        {recentes.map((d, i) => {
          const st = FECH_STATUS[d.status];
          return (
            <div key={d.dia} style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto auto', gap: 10, alignItems: 'center', padding: '10px 14px', borderTop: '1px solid var(--border-soft)', background: i % 2 ? 'var(--zebra)' : 'transparent' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{String(d.dia).padStart(2, '0')}</span>
              <Badge tone={st.tone}>{st.label}</Badge>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtCurrencyShort(d.valor)}</span>
              <span style={{ fontSize: 11, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: d.dif === 0 ? 'var(--text-3)' : d.dif > 0 ? 'var(--pos)' : 'var(--neg)' }}>
                {d.dif === 0 ? '—' : `${d.dif > 0 ? '+' : ''}${fmtCurrency(d.dif)}`}
              </span>
            </div>
          );
        })}
      </Section>

      {/* Por posto (rede) */}
      <Section icon="building-2" title="Apuração por posto" accent="navy" flush>
        {FECHAMENTOS.postos.map((p, i) => {
          const st = FECH_STATUS[p.status];
          return (
            <div key={p.nome} style={{ padding: '11px 14px', borderTop: i ? '1px solid var(--border-soft)' : 'none', background: i % 2 ? 'var(--zebra)' : 'transparent' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nome}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)' }}>último {p.ultimo} · {p.apur}/{p.total} dias</div>
                </div>
                <Badge tone={st.tone}>{st.label}</Badge>
              </div>
              <div style={{ marginTop: 8 }}>
                <ProgressBar pct={(p.apur / p.total) * 100} color={p.status === 'pendente' ? 'var(--warn)' : 'var(--bar)'} />
              </div>
            </div>
          );
        })}
      </Section>
    </div>
  );
}

window.Fechamentos = Fechamentos;
