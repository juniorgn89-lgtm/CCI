// ── Bombas · Produtividade · Qualidade de Dados · Pessoas ────────────────────
const { useState } = React;

function Avatar({ name, tone = 'navy' }) {
  const t = TONES[tone] || TONES.navy;
  const initials = name.split(' ').slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  return (
    <span style={{ width: 34, height: 34, borderRadius: 999, background: t.chip, color: t.c, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 700 }}>{initials}</span>
  );
}

// ── Bombas ────────────────────────────────────────────────────────────────────
const BICO_STATUS = {
  ok: { label: 'OK', tone: 'emerald' },
  afericao: { label: 'Aferir', tone: 'amber' },
  divergencia: { label: 'Divergência', tone: 'rose' },
};
function Bombas({ filters, dataState }) {
  const cmp = (filters && filters.comparativo) || 'mês ant.';
  if (dataState === 'loading') return <LoadingScreen />;
  if (dataState === 'empty') return <EmptyCard desc="Sem leitura de bombas para o posto e período." />;
  const b = BOMBAS;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <KpiCard label="Bicos ativos" tone="navy" icon="gauge" value={`${b.bicosAtivos}/${b.bicosTotal}`} sub="em operação" />
        <KpiCard label="Volume do dia" tone="blue" icon="droplet" value={fmtLitersShort(b.volumeDia)} delta={b.deltas.volumeDia} deltaLabel={cmp} />
        <KpiCard label="Aferições OK" tone="emerald" icon="check" value={`${b.afericoesOk}/${b.bicos.length}`} sub="conformes" />
        <KpiCard label="Divergências" tone={b.divergencias ? 'rose' : 'emerald'} icon="alert-triangle" value={String(b.divergencias)} sub="encerrante vs venda" />
      </div>

      <Section icon="gauge" title="Bicos" accent="navy" flush right={<span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>encerrante</span>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, padding: '7px 14px', fontSize: 9.5, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          <span>Bico</span><span style={{ textAlign: 'right' }}>Vol. dia</span><span style={{ textAlign: 'right' }}>Status</span>
        </div>
        {b.bicos.map((x, i) => {
          const st = BICO_STATUS[x.status];
          return (
            <div key={x.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'center', padding: '10px 14px', borderTop: '1px solid var(--border-soft)', background: i % 2 ? 'var(--zebra)' : 'transparent' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{x.bico} · {x.produto}</div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>encerrante {fmtNumber(Math.round(x.encerrante))}</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtLiters(x.volumeDia)}</span>
              <span style={{ textAlign: 'right' }}><Badge tone={st.tone}>{st.label}</Badge></span>
            </div>
          );
        })}
      </Section>
    </div>
  );
}

// ── Produtividade (frentistas) ────────────────────────────────────────────────
function FrentistaRow({ f, i }) {
  const [open, setOpen] = useState(false);
  const medal = i === 0 ? '#d97706' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : null;
  return (
    <div style={{ borderTop: i ? '1px solid var(--border-soft)' : 'none' }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', border: 'none', background: open ? 'var(--zebra)' : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ position: 'relative' }}>
          <Avatar name={f.nome} tone={i === 0 ? 'amber' : 'navy'} />
          <span style={{ position: 'absolute', top: -3, left: -3, fontSize: 11, fontWeight: 800, color: medal || 'var(--text-3)' }}>{medal ? '' : ''}</span>
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>
            <span style={{ color: medal || 'var(--text-3)', fontWeight: 800, marginRight: 5 }}>#{i + 1}</span>{f.nome}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>{fmtNumber(f.atend)} atendimentos</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{fmtLitersShort(f.litros)}</div>
          <div style={{ fontSize: 9.5, color: 'var(--text-3)' }}>litros</div>
        </div>
        <span style={{ display: 'flex', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}><Icon name="chevron-right" size={15} color="var(--text-3)" /></span>
      </button>
      {open && (
        <div style={{ padding: '0 14px 12px 60px', background: 'var(--zebra)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[['Receita', fmtCurrencyShort(f.receita)], ['Atendim.', fmtNumber(f.atend)], ['Ticket', fmtCurrency(f.ticket)]].map(([l, v]) => (
              <div key={l} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '7px 9px' }}>
                <div style={{ fontSize: 9, color: 'var(--text-3)' }}>{l}</div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
function Produtividade({ filters, dataState }) {
  const cmp = (filters && filters.comparativo) || 'mês ant.';
  if (dataState === 'loading') return <LoadingScreen />;
  if (dataState === 'empty') return <EmptyCard desc="Sem produtividade registrada para o período." />;
  const p = PRODUTIVIDADE;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <KpiCard label="Litros / frentista" tone="blue" icon="droplet" value={fmtLitersShort(p.litrosPorFrentista)} delta={p.deltas.litrosPorFrentista} deltaLabel={cmp} />
        <KpiCard label="Atendimentos" tone="indigo" icon="users" value={fmtNumber(p.atendimentos)} delta={p.deltas.atendimentos} deltaLabel={cmp} />
        <KpiCard label="Receita média" tone="emerald" icon="dollar-sign" value={fmtCurrencyShort(p.receitaMedia)} delta={p.deltas.receitaMedia} deltaLabel={cmp} />
        <KpiCard label="Tempo médio" tone="teal" icon="clock" value={p.tempoMedio} delta={p.deltas.tempoMedio} deltaLabel={cmp} />
      </div>

      <Section icon="trophy" title="Ranking de frentistas" accent="amber" flush right={<span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>por litros</span>}>
        {p.frentistas.map((f, i) => <FrentistaRow key={f.nome} f={f} i={i} />)}
      </Section>
    </div>
  );
}

// ── Qualidade de Dados ────────────────────────────────────────────────────────
const FONTE_STATUS = { ok: 'emerald', atencao: 'amber', critico: 'rose' };
function QualidadeDados({ filters, dataState }) {
  if (dataState === 'loading') return <LoadingScreen />;
  if (dataState === 'empty') return <EmptyCard desc="Sem informações de qualidade para o período." />;
  const q = QUALIDADE;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <KpiCard span={2} big label="Cobertura geral" tone={q.coberturaGeral >= 95 ? 'emerald' : 'amber'} icon="database"
          value={fmtPercent(q.coberturaGeral)} sub={`${q.fontesOk}/${q.fontesTotal} fontes conformes · sync ${q.ultimaSync}`} />
        <KpiCard label="Fontes OK" tone="emerald" icon="check" value={`${q.fontesOk}/${q.fontesTotal}`} sub="acima de 95%" />
        <KpiCard label="Lacunas" tone="amber" icon="alert-triangle" value={String(q.lacunas)} sub="requerem atenção" />
      </div>

      <Section icon="database" title="Cobertura por fonte" accent="navy" flush>
        {q.fontes.map((s, i) => (
          <div key={s.nome} style={{ padding: '11px 14px', borderTop: i ? '1px solid var(--border-soft)' : 'none', background: i % 2 ? 'var(--zebra)' : 'transparent' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.nome}</span>
              <Badge tone={FONTE_STATUS[s.status]}>{fmtPercent(s.cobertura)}</Badge>
            </div>
            <ProgressBar pct={s.cobertura} color={s.status === 'critico' ? 'var(--neg)' : s.status === 'atencao' ? 'var(--warn)' : 'var(--bar)'} />
          </div>
        ))}
      </Section>

      <Section icon="alert-triangle" title="Lacunas" accent="amber" flush>
        {q.lacunasList.map((l, i) => (
          <div key={l.fonte} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', borderTop: i ? '1px solid var(--border-soft)' : 'none' }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--amber-soft)', border: '1px solid var(--amber-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="alert-triangle" size={14} color="var(--warn)" />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{l.fonte}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{l.detalhe}</div>
            </div>
            <Badge tone="amber">{l.tag}</Badge>
          </div>
        ))}
      </Section>
    </div>
  );
}

// ── Pessoas ───────────────────────────────────────────────────────────────────
function Pessoas({ filters, dataState }) {
  if (dataState === 'loading') return <LoadingScreen />;
  if (dataState === 'empty') return <EmptyCard desc="Sem cadastro de equipe para o posto." />;
  const p = PESSOAS;
  const maxFunc = Math.max(...p.porFuncao.map((x) => x.n));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <KpiCard span={2} big label="Colaboradores" tone="navy" icon="users" value={String(p.total)} sub={`${p.ativos} ativos · ${p.afastados} afastados`} />
        <KpiCard label="Frentistas" tone="blue" icon="users" value={String(p.frentistas)} sub="na pista" />
        <KpiCard label="Gerentes" tone="indigo" icon="users" value={String(p.gerentes)} sub="gestão" />
      </div>

      <Section icon="building-2" title="Equipe por posto" accent="navy" flush>
        {p.porPosto.map((x, i) => (
          <div key={x.posto} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderTop: i ? '1px solid var(--border-soft)' : 'none', background: i % 2 ? 'var(--zebra)' : 'transparent' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.posto}</div>
              <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{x.ativos} ativos de {x.total}</div>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{x.total}</span>
          </div>
        ))}
      </Section>

      <Section icon="users" title="Por função" accent="blue">
        <HBar data={p.porFuncao} valueKey="n" labelKey="funcao" fmt={(v) => `${v}`} color="var(--c2)" max={maxFunc} />
      </Section>
    </div>
  );
}

Object.assign(window, { Bombas, Produtividade, QualidadeDados, Pessoas });
