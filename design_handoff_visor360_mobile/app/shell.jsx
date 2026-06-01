// ── Visor360 mobile — app shell (header, summary bar, nav, drawer, sheet) ─────
const { useState, useEffect, useRef } = React;

// Navy top header (≤56px content + status-bar safe area)
function Header({ subtitle, theme, onToggleTheme, onBell }) {
  return (
    <header style={{
      background: 'var(--header)', paddingTop: 'var(--safe-top)', flexShrink: 0,
      borderBottom: '1px solid var(--header-border)', position: 'relative', zIndex: 5,
    }}>
      <div style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="bar-chart-3" size={18} color="#fff" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>Visor360</span>
            </div>
            <div style={{ fontSize: 10.5, color: 'rgba(191,210,235,0.75)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>{subtitle}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.10)' }}>
            <span className="v360-pulse" style={{ width: 7, height: 7, borderRadius: 999, background: '#4ade80', display: 'block' }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: '#86efac' }}>Tempo real</span>
          </div>
          <button onClick={onBell} aria-label="Notificações" style={hdrBtn}>
            <Icon name="bell" size={18} color="#fff" />
            <span style={{ position: 'absolute', top: 7, right: 7, width: 7, height: 7, borderRadius: 999, background: 'var(--warn)', border: '1.5px solid var(--header)' }} />
          </button>
          <button onClick={onToggleTheme} aria-label="Tema" style={hdrBtn}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} color="#fff" />
          </button>
        </div>
      </div>
    </header>
  );
}
const hdrBtn = {
  position: 'relative', width: 36, height: 36, borderRadius: 10, border: 'none',
  background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
};

// Sticky filter-summary bar — tap to open the filters sheet
function FilterBar({ summary, comparativo, onOpen }) {
  return (
    <button onClick={onOpen} style={{
      display: 'flex', alignItems: 'center', gap: 10, width: '100%', cursor: 'pointer',
      padding: '8px 14px', background: 'var(--surface)', border: 'none',
      borderBottom: '1px solid var(--border)', flexShrink: 0, textAlign: 'left',
    }}>
      <span style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--navy-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name="sliders-horizontal" size={15} color="var(--navy-ico)" />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Filtros</div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{summary}</div>
      </div>
      <Icon name="chevron-down" size={16} color="var(--text-3)" />
    </button>
  );
}

// Bottom tab nav — user-pinned destinations + Mais (long-press = editar barra)
function BottomNav({ tabs, active, onChange, onMais, onMaisLong }) {
  const items = [...tabs, { id: '__mais', label: 'Mais', icon: 'menu' }];
  const timer = useRef(null);
  const longed = useRef(false);
  const startHold = () => {
    longed.current = false;
    timer.current = setTimeout(() => { longed.current = true; onMaisLong && onMaisLong(); }, 450);
  };
  const endHold = () => { if (timer.current) clearTimeout(timer.current); };
  return (
    <nav style={{
      flexShrink: 0, background: 'var(--surface)', borderTop: '1px solid var(--border)',
      paddingBottom: 'var(--safe-bot)', display: 'flex', position: 'relative', zIndex: 5,
    }}>
      {items.map((it) => {
        const isMais = it.id === '__mais';
        const isActive = !isMais && active === it.id;
        const maisHandlers = isMais ? {
          onMouseDown: startHold, onMouseUp: endHold, onMouseLeave: endHold,
          onTouchStart: startHold, onTouchEnd: endHold,
          onClick: () => { if (!longed.current) onMais(); },
        } : { onClick: () => onChange(it.id) };
        return (
          <button key={it.id} {...maisHandlers} style={{
            flex: 1, minHeight: 52, border: 'none', background: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
            color: isActive ? 'var(--accent)' : 'var(--text-3)', padding: '8px 0 6px', position: 'relative',
          }}>
            <span className="v360-navdot" style={{
              position: 'absolute', top: 0, width: 20, height: 3, borderRadius: 999, background: 'var(--accent)',
              opacity: isActive ? 1 : 0, transform: isActive ? 'scaleX(1)' : 'scaleX(.3)',
            }} />
            <span className="v360-navico" style={{ display: 'flex', transform: isActive ? 'translateY(-1px) scale(1.06)' : 'none' }}>
              <Icon name={it.icon} size={21} strokeWidth={isActive ? 2.4 : 2} />
            </span>
            <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 500 }}>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// Generic sheet shell — slides from bottom (default) or top
function Sheet({ open, title, onClose, children, maxH = '82%', headerRight, placement = 'bottom' }) {
  const top = placement === 'top';
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 80, pointerEvents: open ? 'auto' : 'none',
    }}>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.42)',
        opacity: open ? 1 : 0, transition: 'opacity .25s',
      }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, maxHeight: maxH,
        ...(top ? { top: 0 } : { bottom: 0 }),
        background: 'var(--surface)',
        borderRadius: top ? '0 0 20px 20px' : '20px 20px 0 0',
        boxShadow: top ? '0 8px 40px rgba(0,0,0,0.3)' : '0 -8px 40px rgba(0,0,0,0.3)',
        display: 'flex', flexDirection: 'column',
        transform: open ? 'translateY(0)' : `translateY(${top ? '-101%' : '101%'})`,
        transition: 'transform .28s cubic-bezier(.32,.72,0,1)',
        paddingBottom: top ? 0 : 'var(--safe-bot)',
        paddingTop: top ? 'var(--safe-top)' : 0,
      }}>
        {!top && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
            <span style={{ width: 38, height: 4, borderRadius: 999, background: 'var(--track-strong)' }} />
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 10px', borderBottom: '1px solid var(--border-soft)' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{title}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {headerRight}
            <button onClick={onClose} aria-label="Fechar" style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'var(--track)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="x" size={16} color="var(--text-2)" />
            </button>
          </div>
        </div>
        <div style={{ overflowY: 'auto', padding: 16 }}>{children}</div>
        {top && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2px 0 8px' }}>
            <span style={{ width: 38, height: 4, borderRadius: 999, background: 'var(--track-strong)' }} />
          </div>
        )}
      </div>
    </div>
  );
}

// "Mais" — all modules drawer, with bottom-bar customization
function MaisDrawer({ open, active, bar, editOnOpen, onClose, onNavigate, onSetBar }) {
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (open) setEditing(!!editOnOpen); else setEditing(false); }, [open, editOnOpen]);
  const barSet = new Set(bar);
  const full = barSet.size >= 4;

  const togglePin = (id) => {
    if (barSet.has(id)) {
      if (bar.length <= 1) return; // keep at least one
      onSetBar(bar.filter((b) => b !== id));
    } else if (!full) {
      onSetBar([...bar, id]);
    }
  };

  const headerAction = (
    <button onClick={() => setEditing((e) => !e)} style={{
      padding: '6px 11px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer',
      background: editing ? 'var(--navy)' : 'var(--surface)', color: editing ? '#fff' : 'var(--accent)',
      fontSize: 12, fontWeight: 600,
    }}>{editing ? 'Concluir' : 'Editar barra'}</button>
  );

  return (
    <Sheet open={open} title="Todos os módulos" onClose={onClose} maxH="88%" headerRight={headerAction}>
      {editing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14, padding: '10px 12px', borderRadius: 11, background: 'var(--accent-soft)', border: '1px solid var(--accent-border)' }}>
          <Icon name="sliders-horizontal" size={15} color="var(--accent)" />
          <span style={{ flex: 1, fontSize: 11.5, color: 'var(--text-2)' }}>Fixe até <strong style={{ color: 'var(--text)' }}>4 módulos</strong> na barra inferior. <strong style={{ color: 'var(--text)' }}>{bar.length}/4</strong> escolhidos.</span>
          <button onClick={() => onSetBar([...DEFAULT_BAR])} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color: 'var(--accent)', whiteSpace: 'nowrap' }}>Padrão</button>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {MENU_GROUPS.map((g) => (
          <div key={g.grupo}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 7, paddingLeft: 2 }}>{g.grupo}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {g.itens.map((it) => {
                const pinned = barSet.has(it.id);
                const isActive = active === it.id;
                const disabled = editing && !pinned && full;
                return (
                  <button key={it.id} onClick={() => (editing ? togglePin(it.id) : onNavigate(it.id))} style={{
                    display: 'flex', alignItems: 'center', gap: 9, padding: '11px 11px',
                    cursor: disabled ? 'default' : 'pointer', borderRadius: 11, textAlign: 'left',
                    opacity: disabled ? 0.45 : 1,
                    border: `1px solid ${(editing ? pinned : isActive) ? 'var(--accent)' : 'var(--border)'}`,
                    background: (editing ? pinned : isActive) ? 'var(--accent-soft)' : 'var(--surface)',
                  }}>
                    <span style={{ width: 30, height: 30, borderRadius: 8, background: (editing ? pinned : isActive) ? 'var(--accent-soft2)' : 'var(--track)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon name={it.icon} size={16} color={(editing ? pinned : isActive) ? 'var(--accent)' : 'var(--text-2)'} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.label}</div>
                      {!editing && pinned && <div style={{ fontSize: 9, color: 'var(--text-3)' }}>● na barra</div>}
                    </div>
                    {editing && (
                      <span style={{
                        width: 22, height: 22, borderRadius: 999, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: pinned ? 'var(--accent)' : 'transparent',
                        border: pinned ? 'none' : '1.5px solid var(--border-strong)',
                      }}>
                        {pinned && <Icon name="check" size={13} color="#fff" />}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

// Filters sheet — Posto · Período · Escopo · Comparativo
const MES_OPTS = ['Jan/26', 'Fev/26', 'Mar/26', 'Abr/26', 'Mai/26'];
const MES_NUM = { Jan: 1, Fev: 2, Mar: 3, Abr: 4, Mai: 5, Jun: 6, Jul: 7, Ago: 8, Set: 9, Out: 10, Nov: 11, Dez: 12 };
function FilterSheet({ open, filters, onClose, onApply }) {
  const [draft, setDraft] = useState(filters);
  useEffect(() => { if (open) setDraft(filters); }, [open]);
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  // selecionar mês preenche o intervalo de datas (1º → último dia)
  const setMonth = (val) => {
    const [nm, yy] = val.split('/');
    const m = MES_NUM[nm], y = 2000 + Number(yy);
    const last = new Date(y, m, 0).getDate();
    const p = (n) => String(n).padStart(2, '0');
    setDraft((d) => ({ ...d, mes: val, di: `${y}-${p(m)}-01`, df: `${y}-${p(m)}-${p(last)}` }));
  };
  // edição manual de data → mês vira "personalizado"
  const setData = (k, v) => setDraft((d) => ({ ...d, [k]: v, mes: 'custom' }));
  const field = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 500, fontFamily: 'inherit' };
  const lbl = { fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 7, display: 'block' };
  return (
    <Sheet open={open} title="Filtros" onClose={onClose} placement="top" maxH="86%">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <label style={lbl}>Posto</label>
          <div style={{ position: 'relative' }}>
            <select value={draft.posto} onChange={(e) => set('posto', Number(e.target.value))} style={{ ...field, appearance: 'none', paddingRight: 34 }}>
              {POSTO_OPTIONS.map((p) => <option key={p.codigo} value={p.codigo}>{p.nome}</option>)}
            </select>
            <span style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><Icon name="chevron-down" size={16} color="var(--text-3)" /></span>
          </div>
        </div>
        <div>
          <label style={lbl}>Período</label>
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <select value={draft.mes} onChange={(e) => setMonth(e.target.value)} style={{ ...field, appearance: 'none', paddingRight: 34 }}>
              {draft.mes === 'custom' && <option value="custom">Personalizado · {fmtPeriodo(draft.di, draft.df)}</option>}
              {MES_OPTS.map((m) => <option key={m} value={m}>{m.replace('/', '/20')}</option>)}
            </select>
            <span style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><Icon name="calendar" size={15} color="var(--text-3)" /></span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="date" value={draft.di} onChange={(e) => setData('di', e.target.value)} style={{ ...field, flex: 1 }} />
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>–</span>
            <input type="date" value={draft.df} onChange={(e) => setData('df', e.target.value)} style={{ ...field, flex: 1 }} />
          </div>
        </div>
        <div>
          <label style={lbl}>Escopo</label>
          <Segmented value={draft.escopo} onChange={(v) => set('escopo', v)}
            options={[{ value: 'Completo', label: 'Completo' }, { value: 'Em andamento', label: 'Em andam.' }, { value: 'Apurado', label: 'Apurado' }]} />
        </div>
        <div>
          <label style={lbl}>Comparativo</label>
          <Segmented value={draft.comparativo} onChange={(v) => set('comparativo', v)}
            options={[{ value: 'mês ant.', label: 'vs mês ant.' }, { value: 'ano ant.', label: 'vs ano ant.' }]} />
        </div>
        <button onClick={() => onApply(draft)} style={{
          width: '100%', padding: '13px', borderRadius: 12, border: 'none', cursor: 'pointer',
          background: 'var(--navy)', color: '#fff', fontSize: 14, fontWeight: 600, marginTop: 2,
        }}>Visualizar</button>
      </div>
    </Sheet>
  );
}

Object.assign(window, { Header, FilterBar, BottomNav, Sheet, MaisDrawer, FilterSheet });
