// ── Visor360 mobile — shared UI primitives & charts ──────────────────────────
const { useState, useRef, useEffect, useMemo } = React;

const TONES = {
  emerald: { c: '#059669', soft: 'rgba(16,185,129,0.12)', chip: 'rgba(16,185,129,0.16)' },
  blue:    { c: '#2563eb', soft: 'rgba(37,99,235,0.12)',  chip: 'rgba(37,99,235,0.16)' },
  rose:    { c: '#e11d48', soft: 'rgba(244,63,94,0.12)',  chip: 'rgba(244,63,94,0.16)' },
  indigo:  { c: '#4f46e5', soft: 'rgba(99,102,241,0.12)', chip: 'rgba(99,102,241,0.16)' },
  amber:   { c: '#d97706', soft: 'rgba(245,158,11,0.14)', chip: 'rgba(245,158,11,0.18)' },
  violet:  { c: '#7c3aed', soft: 'rgba(139,92,246,0.12)', chip: 'rgba(139,92,246,0.16)' },
  teal:    { c: '#0d9488', soft: 'rgba(20,184,166,0.12)', chip: 'rgba(20,184,166,0.16)' },
  navy:    { c: 'var(--navy)', soft: 'rgba(30,58,95,0.10)', chip: 'rgba(30,58,95,0.12)' },
};

// Delta — trend arrow + % vs label (matches DeltaBadge.tsx)
function Delta({ value, label = 'mês ant.', invert = false, small = false }) {
  if (value === null || value === undefined) return null;
  const positive = value >= 0;
  const good = invert ? !positive : positive;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      color: good ? 'var(--pos)' : 'var(--neg)',
      fontSize: small ? 10 : 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
    }}>
      <Icon name={positive ? 'trending-up' : 'trending-down'} size={small ? 12 : 13} />
      {positive ? '+' : ''}{value.toFixed(1).replace('.', ',')}% <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>vs {label}</span>
    </span>
  );
}

// Compact KPI card — colored icon chip + big value + delta
function KpiCard({ label, value, sub, tone = 'navy', icon, delta, deltaLabel, span, big }) {
  const t = TONES[tone] || TONES.navy;
  return (
    <div style={{
      gridColumn: span ? `span ${span}` : undefined,
      background: `linear-gradient(150deg, ${t.soft}, var(--surface) 70%)`,
      border: '1px solid var(--border)', borderRadius: 12,
      padding: big ? '13px 14px' : '10px 12px', boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-2)' }}>{label}</span>
        {icon && (
          <span style={{
            width: 24, height: 24, borderRadius: 7, background: t.chip,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><Icon name={icon} size={14} color={t.c} /></span>
        )}
      </div>
      <div style={{
        marginTop: 5, fontSize: big ? 26 : 19, fontWeight: 700, color: 'var(--text)',
        fontVariantNumeric: 'tabular-nums', lineHeight: 1.05, letterSpacing: '-0.01em',
      }}>{value}</div>
      {delta !== undefined && delta !== null && (
        <div style={{ marginTop: 4 }}><Delta value={delta} label={deltaLabel} /></div>
      )}
      {sub && <div style={{ marginTop: 3, fontSize: 10.5, color: 'var(--text-3)' }}>{sub}</div>}
    </div>
  );
}

// Section card with icon-chip header
function Section({ icon, title, right, accent = 'navy', children, flush }) {
  const t = TONES[accent] || TONES.navy;
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border-soft)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          {icon && (
            <span style={{
              width: 26, height: 26, borderRadius: 8, background: t.chip,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}><Icon name={icon} size={15} color={t.c} /></span>
          )}
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
        </div>
        {right && <div style={{ flexShrink: 0 }}>{right}</div>}
      </div>
      <div style={{ padding: flush ? 0 : 12 }}>{children}</div>
    </div>
  );
}

function ProgressBar({ pct, color = 'var(--bar)', height = 4 }) {
  return (
    <div style={{ height, width: '100%', background: 'var(--track)', borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, background: color, borderRadius: 999 }} />
    </div>
  );
}

function Badge({ children, tone = 'navy', soft = true }) {
  const t = TONES[tone] || TONES.navy;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 7px', borderRadius: 999, fontSize: 10.5, fontWeight: 600,
      background: soft ? t.chip : t.c, color: soft ? t.c : '#fff', fontVariantNumeric: 'tabular-nums',
    }}>{children}</span>
  );
}

// Margin heatmap pill — green→amber→red by threshold (matches MarginBadge logic)
function marginTone(v, threshold = 11) {
  if (v >= threshold) return 'emerald';
  if (v >= threshold * 0.7) return 'amber';
  return 'rose';
}
function MarginPill({ value, threshold = 11 }) {
  return <Badge tone={marginTone(value, threshold)}>{fmtPercent(value)}</Badge>;
}

// Segmented control (chips). Scrolls horizontally if overflow.
function Segmented({ options, value, onChange, scroll }) {
  return (
    <div style={{
      display: 'flex', gap: 4, padding: 3, background: 'var(--track)', borderRadius: 10,
      overflowX: scroll ? 'auto' : 'visible', scrollbarWidth: 'none',
    }}>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const lbl = typeof o === 'string' ? o : o.label;
        const active = v === value;
        return (
          <button key={v} onClick={() => onChange(v)} style={{
            flex: scroll ? '0 0 auto' : 1, border: 'none', cursor: 'pointer',
            padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            whiteSpace: 'nowrap', transition: 'all .15s',
            background: active ? 'var(--navy)' : 'transparent',
            color: active ? '#fff' : 'var(--text-3)',
            boxShadow: active ? 'var(--shadow-sm)' : 'none',
          }}>{lbl}</button>
        );
      })}
    </div>
  );
}

// Horizontal scroll tabs (underline) — screen-level tabs
function ScrollTabs({ tabs, value, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: 4, overflowX: 'auto', scrollbarWidth: 'none',
      borderBottom: '1px solid var(--border)', margin: '0 -14px', padding: '0 14px',
    }}>
      {tabs.map((tb) => {
        const active = tb.id === value;
        return (
          <button key={tb.id} onClick={() => onChange(tb.id)} style={{
            flex: '0 0 auto', border: 'none', background: 'none', cursor: 'pointer',
            padding: '11px 6px 9px', fontSize: 13, fontWeight: active ? 600 : 500,
            color: active ? 'var(--accent)' : 'var(--text-3)',
            borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
            marginBottom: -1, whiteSpace: 'nowrap',
          }}>{tb.label}</button>
        );
      })}
    </div>
  );
}

// ── Charts (hand-built SVG) ───────────────────────────────────────────────────
// Combo area (primary) + optional line (secondary axis), compact
function AreaChart({ data, valueKey = 'v', lineKey, height = 150, color = 'var(--c1)', lineColor = 'var(--c2)', valueFmt }) {
  const W = 324, H = height, pl = 6, pr = 6, pt = 14, pb = 22;
  const id = useMemo(() => 'g' + Math.random().toString(36).slice(2, 8), []);
  const xs = data.map((_, i) => pl + (i * (W - pl - pr)) / (data.length - 1));
  const vals = data.map((d) => d[valueKey]);
  const vmin = Math.min(...vals), vmax = Math.max(...vals);
  const yOf = (v) => H - pb - ((v - vmin) / (vmax - vmin || 1)) * (H - pt - pb);
  const pts = data.map((d, i) => [xs[i], yOf(d[valueKey])]);
  const linePath = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${xs[xs.length - 1]},${H - pb} L${xs[0]},${H - pb} Z`;
  let line2 = null;
  if (lineKey) {
    const v2 = data.map((d) => d[lineKey]);
    const m2min = Math.min(...v2), m2max = Math.max(...v2);
    const y2 = (v) => H - pb - ((v - m2min) / (m2max - m2min || 1)) * (H - pt - pb) * 0.72 - 8;
    line2 = data.map((d, i) => `${i ? 'L' : 'M'}${xs[i].toFixed(1)},${y2(d[lineKey]).toFixed(1)}`).join(' ');
  }
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: color }} stopOpacity="0.28" />
          <stop offset="100%" style={{ stopColor: color }} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={pl} x2={W - pr} y1={pt + g * (H - pt - pb)} y2={pt + g * (H - pt - pb)}
          style={{ stroke: 'var(--border-soft)' }} strokeWidth="1" strokeDasharray="3 3" />
      ))}
      <path d={areaPath} fill={`url(#${id})`} />
      <path d={linePath} fill="none" style={{ stroke: color }} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      {line2 && <path d={line2} fill="none" style={{ stroke: lineColor }} strokeWidth="1.8" strokeDasharray="4 3" />}
      <circle cx={last[0]} cy={last[1]} r="3.4" style={{ fill: color, stroke: 'var(--surface)' }} strokeWidth="2" />
      {data.map((d, i) => (i % 2 === 0 || i === data.length - 1) && (
        <text key={i} x={xs[i]} y={H - 7} fontSize="9.5" style={{ fill: 'var(--text-3)' }} textAnchor="middle">{d.mes || d.label}</text>
      ))}
    </svg>
  );
}

// Vertical bars with one highlighted
function BarChart({ data, valueKey = 'v', height = 150, color = 'var(--c1)', highlight = 'var(--c2)', valueFmt }) {
  const W = 324, H = height, pl = 6, pr = 6, pt = 14, pb = 22;
  const vals = data.map((d) => d[valueKey]);
  const vmax = Math.max(...vals);
  const n = data.length, slot = (W - pl - pr) / n, bw = slot * 0.58;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={pl} x2={W - pr} y1={pt + g * (H - pt - pb)} y2={pt + g * (H - pt - pb)}
          style={{ stroke: 'var(--border-soft)' }} strokeWidth="1" strokeDasharray="3 3" />
      ))}
      {data.map((d, i) => {
        const h = ((d[valueKey]) / (vmax || 1)) * (H - pt - pb);
        const x = pl + i * slot + (slot - bw) / 2;
        const y = H - pb - h;
        const isLast = i === n - 1;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={Math.max(1, h)} rx="3" style={{ fill: isLast ? highlight : color }} opacity={isLast ? 1 : 0.82} />
            <text x={x + bw / 2} y={H - 7} fontSize="9.5" style={{ fill: 'var(--text-3)' }} textAnchor="middle">{d.mes || d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Donut with center total + legend
function Donut({ data, valueKey = 'valor', colors = CHART_VARS, centerTop, centerSub }) {
  const total = data.reduce((s, d) => s + d[valueKey], 0);
  const R = 52, sw = 18, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <svg viewBox="0 0 140 140" width="124" height="124" style={{ flexShrink: 0 }}>
        <g transform="rotate(-90 70 70)">
          {data.map((d, i) => {
            const frac = d[valueKey] / total;
            const seg = frac * C;
            const el = <circle key={i} cx="70" cy="70" r={R} fill="none" style={{ stroke: colors[i % colors.length] }}
              strokeWidth={sw} strokeDasharray={`${seg} ${C - seg}`} strokeDashoffset={-acc} />;
            acc += seg;
            return el;
          })}
        </g>
        <text x="70" y="66" fontSize="15" fontWeight="700" style={{ fill: 'var(--text)' }} textAnchor="middle">{centerTop}</text>
        <text x="70" y="82" fontSize="9.5" style={{ fill: 'var(--text-3)' }} textAnchor="middle">{centerSub}</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: colors[i % colors.length], flexShrink: 0 }} />
            <span style={{ color: 'var(--text-2)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.nome}</span>
            <span style={{ color: 'var(--text)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{Math.round((d[valueKey] / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Projeção do mês — reusable forecast block ────────────────────────────────
// metrics: [{ label, realizado (raw num), fmt, proj? (override), tone? }]
function ProjecaoSection({ title = 'Projeção do mês', metrics, periodo = PERIODO, accent = 'amber', subtitle = 'Período decorrido' }) {
  const pct = Math.round(periodo.frac * 100);
  const odd = metrics.length % 2 === 1;
  return (
    <Section icon="flame" title={title} accent={accent}
      right={<Badge tone="amber">Dia {periodo.dia}/{periodo.dias}</Badge>}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--text-3)', marginBottom: 5 }}>
          <span>{subtitle}</span>
          <span style={{ fontWeight: 600, color: 'var(--warn)', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
        </div>
        <ProgressBar pct={pct} color="var(--warn)" height={5} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {metrics.map((m, i) => {
          const proj = m.proj != null ? m.proj : projetar(m.realizado);
          const span2 = odd && i === metrics.length - 1;
          if (m.ratio) {
            // métrica de razão (ex.: L.B./litro): projeção por tendência, não cumulativa
            const tr = ((proj - m.realizado) / (m.realizado || 1)) * 100;
            const up = tr >= 0;
            return (
              <div key={m.label} style={{
                gridColumn: span2 ? 'span 2' : undefined,
                border: '1px solid var(--border)', borderRadius: 11, padding: '10px 12px', background: 'var(--surface)',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{m.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 2 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{m.fmt(proj)}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--warn)' }}>proj.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>realizado {m.fmt(m.realizado)}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10, fontWeight: 600, color: up ? 'var(--pos)' : 'var(--neg)' }}>
                    <Icon name={up ? 'trending-up' : 'trending-down'} size={11} />{up ? '+' : ''}{tr.toFixed(1).replace('.', ',')}%
                  </span>
                  <span style={{ fontSize: 9.5, color: 'var(--text-3)' }}>tendência</span>
                </div>
              </div>
            );
          }
          const rpct = Math.min(100, Math.round((m.realizado / (proj || 1)) * 100));
          return (
            <div key={m.label} style={{
              gridColumn: span2 ? 'span 2' : undefined,
              border: '1px solid var(--border)', borderRadius: 11, padding: '10px 12px', background: 'var(--surface)',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{m.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 2 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{m.fmt(proj)}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--warn)' }}>proj.</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>realizado {m.fmt(m.realizado)} · {rpct}%</div>
              <div style={{ marginTop: 7 }}><ProgressBar pct={rpct} color="var(--warn)" height={3} /></div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// Horizontal bar ranking — label + bar + value
function HBar({ data, valueKey = 'valor', labelKey = 'nome', fmt, color = 'var(--c2)', max }) {
  const mx = max || Math.max(...data.map((d) => d[valueKey]));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map((d, i) => (
        <div key={d[labelKey]}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60%' }}>
              <span style={{ color: 'var(--text-3)', fontWeight: 700, marginRight: 6 }}>{i + 1}</span>{d[labelKey]}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{fmt ? fmt(d[valueKey]) : d[valueKey]}</span>
          </div>
          <ProgressBar pct={(d[valueKey] / mx) * 100} color={color} height={6} />
        </div>
      ))}
    </div>
  );
}

// ── Feedback states ──────────────────────────────────────────────────────────
function EmptyCard({ title = 'Sem dados', desc = 'Não há dados para o período e posto selecionados.' }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      textAlign: 'center', padding: '26px 18px', borderRadius: 12,
      background: 'var(--amber-soft)', border: '1px solid var(--amber-border)',
    }}>
      <Icon name="inbox" size={28} color="var(--warn)" />
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
      <span style={{ fontSize: 11.5, color: 'var(--text-2)', maxWidth: 220 }}>{desc}</span>
    </div>
  );
}

function NoCostNote() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7, padding: '7px 11px', borderRadius: 9,
      background: 'var(--amber-soft)', border: '1px solid var(--amber-border)',
      fontSize: 11, color: 'var(--text-2)',
    }}>
      <Icon name="alert-triangle" size={13} color="var(--warn)" />
      <span><strong style={{ color: 'var(--text)', fontWeight: 600 }}>Sem custo apurado</strong> — margem estimada.</span>
    </div>
  );
}

function Skel({ w = '100%', h = 14, r = 6, mt = 0 }) {
  return <div className="v360-skel" style={{ width: w, height: h, borderRadius: r, marginTop: mt }} />;
}

function LoadingScreen() {
  const steps = [
    { icon: 'bar-chart-3', label: 'Resumo de vendas', sub: 'Faturamento por posto', done: true },
    { icon: 'fuel', label: 'Abastecimentos', sub: 'Litros, frentistas e combustíveis', done: true },
    { icon: 'database', label: 'Preços de custo', sub: 'Livro de movimentação (LMC)', done: false },
  ];
  const pct = 66;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, padding: '40px 8px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 54, height: 54, borderRadius: 16, background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="bar-chart-3" size={26} color="#fff" />
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Carregando dados do posto</span>
        <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Aguarde um momento…</span>
      </div>
      <div style={{ width: '100%', maxWidth: 280 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-2)' }}>Progresso</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>{pct}%</span>
        </div>
        <ProgressBar pct={pct} color="var(--bar)" height={8} />
      </div>
      <div style={{ width: '100%', maxWidth: 280, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', borderTop: i ? '1px solid var(--border-soft)' : 'none' }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: s.done ? 'rgba(16,185,129,0.14)' : 'var(--track)' }}>
              <Icon name={s.icon} size={15} color={s.done ? 'var(--pos)' : 'var(--text-3)'} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: s.done ? 'var(--text)' : 'var(--text-3)' }}>{s.label}</div>
              <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{s.sub}</div>
            </div>
            {s.done
              ? <span style={{ width: 20, height: 20, borderRadius: 999, background: 'rgba(16,185,129,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={12} color="var(--pos)" /></span>
              : <span className="v360-spin" style={{ display: 'flex' }}><Icon name="refresh-cw" size={15} color="var(--accent)" /></span>}
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, {
  TONES, Delta, KpiCard, Section, ProgressBar, Badge, marginTone, MarginPill,
  Segmented, ScrollTabs, AreaChart, BarChart, Donut, HBar, ProjecaoSection, EmptyCard, NoCostNote, Skel, LoadingScreen,
});
