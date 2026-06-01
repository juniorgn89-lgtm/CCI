// ── Caixas & Turnos, Inteligência (Radar + Cadu IA), and module placeholders ──
const { useState } = React;
function TurnoRow({ t }) {
  const [open, setOpen] = useState(false);
  const aberto = t.status === 'aberto';
  return (
    <div style={{ borderTop: '1px solid var(--border-soft)' }}>
      <button onClick={() => setOpen((o) => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
        border: 'none', background: open ? 'var(--zebra)' : 'transparent', cursor: 'pointer', textAlign: 'left',
      }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--navy-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="clock" size={15} color="var(--navy-ico)" />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{t.label}</span>
            <Badge tone={aberto ? 'emerald' : 'navy'}>{aberto ? 'aberto' : 'fechado'}</Badge>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{t.op} · {t.periodo}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(t.valor)}</div>
          {aberto && t.projFim
            ? <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--warn)', fontVariantNumeric: 'tabular-nums' }}>proj fim {fmtCurrency(t.projFim)}</span>
            : <span style={{ fontSize: 10.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: t.dif >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                {t.dif >= 0 ? '+' : ''}{fmtCurrency(t.dif)}
              </span>}
        </div>
        <span style={{ display: 'flex', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}><Icon name="chevron-right" size={15} color="var(--text-3)" /></span>
      </button>
      {open && (
        <div style={{ padding: '0 14px 12px 54px', background: 'var(--zebra)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[['Informado', fmtCurrency(t.valor)], ['Sistema', fmtCurrency(t.sistema)], ['Diferença', `${t.dif >= 0 ? '+' : ''}${fmtCurrency(t.dif)}`]].map(([l, v], i) => (
              <div key={l} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '7px 9px' }}>
                <div style={{ fontSize: 9, color: 'var(--text-3)' }}>{l}</div>
                <div style={{ fontSize: 11.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums', marginTop: 1, color: i === 2 ? (t.dif >= 0 ? 'var(--pos)' : 'var(--neg)') : 'var(--text)' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CaixasTurnos({ filters, dataState }) {
  if (dataState === 'loading') return <LoadingScreen />;
  if (dataState === 'empty') return <EmptyCard desc="Nenhum turno registrado para o posto na data selecionada." />;
  const c = CAIXAS;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <KpiCard span={2} big label="Total em caixa" tone="navy" icon="wallet" value={fmtCurrency(c.totalCaixa)} sub="3 turnos · hoje" />
        <KpiCard span={2} label="Projeção do dia" tone="amber" icon="flame"
          value={fmtCurrency(c.projDia)} sub={`fim do dia · ~${Math.round(DIA.frac * 100)}% decorrido`} />
        <KpiCard label="Diferença" tone={c.diferenca >= 0 ? 'emerald' : 'rose'} icon={c.diferenca >= 0 ? 'arrow-up-right' : 'arrow-down-left'}
          value={`${c.diferenca >= 0 ? '+' : ''}${fmtCurrency(c.diferenca)}`} sub="conferido vs sistema" />
        <KpiCard label="Turnos abertos" tone="blue" icon="clock" value={String(c.turnosAbertos)} sub={`de ${c.turnos.length}`} />
      </div>

      <Section icon="clock" title="Turnos de hoje" accent="navy" flush right={<span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>toque p/ detalhe</span>}>
        {c.turnos.map((t) => <TurnoRow key={t.id} t={t} />)}
      </Section>

      <Section icon="alert-triangle" title="Conferência de caixa" accent="amber">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {c.turnos.map((t) => {
            const pct = Math.min(100, Math.abs(t.dif) / 250 * 100);
            return (
              <div key={t.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-2)' }}>{t.label}</span>
                  <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: t.dif >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{t.dif >= 0 ? '+' : ''}{fmtCurrency(t.dif)}</span>
                </div>
                <ProgressBar pct={pct} color={t.dif >= 0 ? 'var(--pos)' : 'var(--neg)'} />
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

// ── Inteligência ──────────────────────────────────────────────────────────────
function RangeBar({ min, max, meu, mercado }) {
  const span = max - min || 1;
  const posMeu = ((meu - min) / span) * 100;
  const posMkt = ((mercado - min) / span) * 100;
  return (
    <div style={{ position: 'relative', height: 22, marginTop: 4 }}>
      <div style={{ position: 'absolute', top: 9, left: 0, right: 0, height: 4, borderRadius: 999, background: 'linear-gradient(90deg, var(--pos), var(--warn), var(--neg))', opacity: 0.55 }} />
      <div style={{ position: 'absolute', top: 4, left: `${posMkt}%`, transform: 'translateX(-50%)', width: 2, height: 14, background: 'var(--text-3)' }} />
      <div style={{ position: 'absolute', top: 2, left: `${posMeu}%`, transform: 'translateX(-50%)', width: 13, height: 13, borderRadius: 999, background: 'var(--navy)', border: '2px solid var(--surface)', boxShadow: 'var(--shadow-sm)' }} />
    </div>
  );
}

function RadarPrecos({ dataState }) {
  if (dataState === 'loading') return <LoadingScreen />;
  if (dataState === 'empty') return <EmptyCard desc="Sem coleta de preços de concorrentes na região." />;
  const r = RADAR;
  const avgPos = (r.produtos.reduce((s, p) => s + p.pos, 0) / r.produtos.length).toFixed(1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <KpiCard label="Posição média" tone="navy" icon="trophy" value={`${avgPos}º`} sub="de 7 postos" />
        <KpiCard label="Atualizado" tone="blue" icon="refresh-cw" value={r.atualizado} sub="coleta automática" />
      </div>

      {/* Map placeholder */}
      <div style={{ position: 'relative', height: 124, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: 'repeating-linear-gradient(45deg, var(--track) 0 10px, var(--surface) 10px 20px)' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <Icon name="map-pin" size={24} color="var(--navy-ico)" />
          <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 10.5, color: 'var(--text-3)' }}>mapa de concorrentes</span>
        </div>
      </div>

      <Section icon="gauge" title="Meus preços vs mercado" accent="navy" flush>
        {r.produtos.map((p, i) => {
          const cheaper = p.meu <= p.mercado;
          return (
            <div key={p.nome} style={{ padding: '11px 14px', borderTop: i ? '1px solid var(--border-soft)' : 'none', background: i % 2 ? 'var(--zebra)' : 'transparent' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{p.nome}</span>
                <Badge tone={p.pos <= 2 ? 'emerald' : p.pos <= 4 ? 'amber' : 'rose'}>{p.pos}º de {p.total}</Badge>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
                <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>R$ {p.meu.toFixed(2).replace('.', ',')}</span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>mercado R$ {p.mercado.toFixed(2).replace('.', ',')}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: cheaper ? 'var(--pos)' : 'var(--neg)' }}>
                  {cheaper ? '↓' : '↑'} {Math.abs(((p.meu - p.mercado) / p.mercado) * 100).toFixed(1)}%
                </span>
              </div>
              <RangeBar min={p.min} max={p.max} meu={p.meu} mercado={p.mercado} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>
                <span>mín R$ {p.min.toFixed(2).replace('.', ',')}</span>
                <span>máx R$ {p.max.toFixed(2).replace('.', ',')}</span>
              </div>
            </div>
          );
        })}
      </Section>

      <Section icon="map-pin" title="Concorrentes próximos" accent="blue" flush>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 8, padding: '7px 14px', fontSize: 9.5, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase' }}>
          <span>Posto</span><span style={{ textAlign: 'right' }}>Gas.</span><span style={{ textAlign: 'right' }}>Et.</span><span style={{ textAlign: 'right' }}>Die.</span>
        </div>
        {RADAR.concorrentes.map((c, i) => (
          <div key={c.nome} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 8, padding: '9px 14px', borderTop: '1px solid var(--border-soft)', background: i % 2 ? 'var(--zebra)' : 'transparent', alignItems: 'center' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nome}</div>
              <div style={{ fontSize: 9.5, color: 'var(--text-3)' }}>{c.dist}</div>
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--text-2)' }}>{c.gas.toFixed(2).replace('.', ',')}</span>
            <span style={{ fontSize: 11.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--text-2)' }}>{c.eta.toFixed(2).replace('.', ',')}</span>
            <span style={{ fontSize: 11.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--text-2)' }}>{c.die.toFixed(2).replace('.', ',')}</span>
          </div>
        ))}
      </Section>
    </div>
  );
}

function CaduIA() {
  const prompts = ['Por que a margem do Etanol caiu?', 'Compare Darwin e Newton em Mai', 'Quais combustíveis estão acima do mercado?'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, padding: 13, borderRadius: 12, background: 'var(--accent-soft)', border: '1px solid var(--accent-border)' }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="sparkles" size={18} color="#fff" />
        </span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Cadu IA</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 2 }}>Pergunte sobre vendas, margens e comparativos da rede. Respostas baseadas nos dados do período filtrado.</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sugestões</span>
        {prompts.map((p) => (
          <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 13px', borderRadius: 11, border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <Icon name="search" size={14} color="var(--text-3)" />
            <span style={{ fontSize: 12.5, color: 'var(--text)', flex: 1 }}>{p}</span>
            <Icon name="arrow-right" size={14} color="var(--text-3)" />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 8px 8px 14px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface)', marginTop: 2 }}>
        <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-3)' }}>Pergunte ao Cadu…</span>
        <span style={{ width: 34, height: 34, borderRadius: 999, background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="send" size={15} color="#fff" />
        </span>
      </div>
    </div>
  );
}

// ── Inteligência › Análise & Comparação ──────────────────────────────────────
function AnaliseComparacao({ filters, dataState }) {
  const [metric, setMetric] = useState('fat');
  if (dataState === 'loading') return <LoadingScreen />;
  if (dataState === 'empty') return <EmptyCard desc="Sem dados para comparação no período selecionado." />;
  const c = COMPARA;
  const cfg = {
    fat: { key: 'fat', label: 'Faturamento', fmt: fmtCurrencyShort },
    litros: { key: 'litros', label: 'Litros', fmt: fmtLitersShort },
    margem: { key: 'margem', label: 'Margem', fmt: fmtPercent },
  }[metric];
  const ranked = [...c.postos].sort((a, b) => b[cfg.key] - a[cfg.key]);
  const totalAtual = c.serie[c.serie.length - 1].atual;
  const totalAnt = c.serie[c.serie.length - 1].ant;
  const varTotal = ((totalAtual - totalAnt) / totalAnt) * 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Atual vs período anterior */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <KpiCard label="Rede · atual" tone="navy" icon="bar-chart-3" value={fmtCurrencyShort(totalAtual)} delta={varTotal} deltaLabel="período ant." />
        <KpiCard label="Período anterior" tone="indigo" icon="clock" value={fmtCurrencyShort(totalAnt)} sub="base de comparação" />
      </div>

      {/* Projeção de fechamento da rede */}
      <ProjecaoSection title="Projeção da rede" metrics={[
        { label: 'Faturamento', realizado: REDE.faturamento, fmt: fmtCurrencyShort },
        { label: 'Litros', realizado: REDE.litros, fmt: fmtLitersShort },
        { label: 'Margem', realizado: REDE.margem, proj: REDE.margemProj, ratio: true, fmt: fmtPercent },
        { label: 'Ticket médio', realizado: REDE.ticketMedio, proj: REDE.ticketProj, ratio: true, fmt: fmtCurrency },
      ]} />

      {/* Comparação por posto */}
      <Section icon="building-2" title="Comparar postos" accent="navy"
        right={<Segmented value={metric} onChange={setMetric}
          options={[{ value: 'fat', label: 'Faturam.' }, { value: 'litros', label: 'Litros' }, { value: 'margem', label: 'Margem' }]} scroll />}>
        <HBar data={ranked} valueKey={cfg.key} fmt={cfg.fmt} color="var(--c2)" />
      </Section>

      {/* Série atual vs anterior */}
      <Section icon="trending-up" title="Atual vs período anterior" accent="blue">
        <AreaChart data={c.serie} valueKey="atual" lineKey="ant" color="var(--c1)" lineColor="var(--c3)" />
        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 10.5, color: 'var(--text-3)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 3, borderRadius: 2, background: 'var(--c1)' }} />Atual</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 0, borderTop: '2px dashed var(--c3)' }} />Período ant.</span>
        </div>
      </Section>

      {/* Tabela comparativa */}
      <Section icon="layers" title="Variação por posto" accent="navy" flush>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, padding: '7px 14px', fontSize: 9.5, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          <span>Posto</span><span style={{ textAlign: 'right' }}>Faturam.</span><span style={{ textAlign: 'right' }}>Variação</span>
        </div>
        {c.postos.map((p, i) => (
          <div key={p.nome} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'center', padding: '10px 14px', borderTop: '1px solid var(--border-soft)', background: i % 2 ? 'var(--zebra)' : 'transparent' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nome}</span>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{fmtCurrencyShort(p.fat)}</div>
              <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--warn)', fontVariantNumeric: 'tabular-nums' }}>proj {fmtCurrencyShort(projetar(p.fat))}</div>
            </div>
            <span style={{ textAlign: 'right' }}><Delta value={p.varFat} label="ant." small /></span>
          </div>
        ))}
      </Section>
    </div>
  );
}

const INTEL_TABS = [
  { id: 'analise', label: 'Análise & Comparação' },
  { id: 'radar', label: 'Radar de Preços' },
  { id: 'cadu', label: 'Cadu IA' },
];

function Inteligencia({ filters, dataState }) {
  const [tab, setTab] = useState('analise');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ScrollTabs tabs={INTEL_TABS} value={tab} onChange={setTab} />
      <div key={tab} className="v360-screen">
        {tab === 'analise' && <AnaliseComparacao filters={filters} dataState={dataState} />}
        {tab === 'radar' && <RadarPrecos dataState={dataState} />}
        {tab === 'cadu' && <CaduIA />}
      </div>
    </div>
  );
}

// ── Module placeholder (for "Mais" destinations not built in round 1) ─────────
const MODULE_META = {
  fechamentos: { label: 'Fechamentos', icon: 'file-text', desc: 'Fechamentos diários e mensais por posto, com status de apuração.' },
  bombas: { label: 'Bombas', icon: 'gauge', desc: 'Encerrantes, aferições e volume por bico.' },
  produtividade: { label: 'Produtividade', icon: 'users', desc: 'Ranking de frentistas: litros, atendimentos e receita.' },
  estoques: { label: 'Estoques', icon: 'package', desc: 'Níveis de tanque, cobertura e reposição sugerida.' },
  financeiro: { label: 'Financeiro', icon: 'dollar-sign', desc: 'Contas a receber/pagar, fluxo de caixa e DRE simplificada.' },
  qualidade: { label: 'Qualidade de Dados', icon: 'database', desc: 'Cobertura, lacunas e consistência das fontes de dados.' },
  pessoas: { label: 'Pessoas', icon: 'users', desc: 'Cadastro e desempenho da equipe por posto.' },
};

function ModulePlaceholder({ id }) {
  const m = MODULE_META[id] || { label: id, icon: 'layers', desc: '' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <span style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--navy-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name={m.icon} size={20} color="var(--navy-ico)" />
        </span>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{m.label}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 1 }}>{m.desc}</div>
        </div>
      </div>
      {[0, 1].map((i) => (
        <div key={i} style={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', padding: 14 }}>
          <Skel w="40%" h={12} />
          <Skel w="100%" h={64} r={10} mt={12} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Skel w="50%" h={32} r={9} /><Skel w="50%" h={32} r={9} />
          </div>
        </div>
      ))}
      <div style={{ textAlign: 'center', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 10.5, color: 'var(--text-3)', padding: '4px 0' }}>
        módulo "{m.label}" — não detalhado nesta rodada do shell
      </div>
    </div>
  );
}

Object.assign(window, { CaixasTurnos, Inteligencia, AnaliseComparacao, RadarPrecos, CaduIA, ModulePlaceholder });
