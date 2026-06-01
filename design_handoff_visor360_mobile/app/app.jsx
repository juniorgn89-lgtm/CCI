// ── Visor360 mobile — App (state, theming, shell + screens + tweaks) ─────────
const { useState, useEffect, useRef } = React;
const ALL_ITEMS = MENU_GROUPS.flatMap((g) => g.itens);
const labelOf = (id) => (ALL_ITEMS.find((i) => i.id === id) || {}).label || id;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "dark": false,
  "dataState": "Normal",
  "density": "Confortável"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [view, setView] = useState('central');
  const [drawer, setDrawer] = useState(false);
  const [drawerEdit, setDrawerEdit] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [filters, setFilters] = useState({
    posto: 1, mes: 'Mai/26', di: '2026-05-01', df: '2026-05-31',
    escopo: 'Completo', comparativo: 'mês ant.',
  });
  const [bar, setBar] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('visor360.bar') || 'null');
      if (Array.isArray(saved) && saved.length && saved.every((id) => ITEM_BY_ID[id])) return saved.slice(0, 4);
    } catch (e) {}
    return [...DEFAULT_BAR];
  });
  const setBarPersist = (next) => {
    setBar(next);
    try { localStorage.setItem('visor360.bar', JSON.stringify(next)); } catch (e) {}
  };
  const barItems = bar.map((id) => {
    const it = ITEM_BY_ID[id];
    return { id, label: it.short || it.label, icon: it.icon };
  });

  const dark = t.dark;
  const dataState = t.dataState === 'Loading' ? 'loading' : t.dataState === 'Vazio' ? 'empty' : 'normal';
  const compact = t.density === 'Compacto';

  const postoName = (POSTO_OPTIONS.find((p) => p.codigo === filters.posto) || {}).nome || 'Toda a Rede';
  const summary = `${postoName.toUpperCase()} · ${fmtPeriodo(filters.di, filters.df)} · ${filters.escopo}`;
  const bottomActive = bar.includes(view) ? view : null;

  const scrollRef = useRef(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [view]);

  const navTo = (id) => { setView(id); setDrawer(false); };

  const renderScreen = () => {
    const props = { filters, dataState };
    switch (view) {
      case 'central': return <CentralDaRede {...props} />;
      case 'fechamentos': return <Fechamentos {...props} />;
      case 'vendas': return <Vendas {...props} />;
      case 'caixas': return <CaixasTurnos {...props} />;
      case 'inteligencia': return <Inteligencia {...props} />;
      case 'financeiro': return <Financeiro {...props} />;
      case 'estoques': return <Estoques {...props} />;
      case 'bombas': return <Bombas {...props} />;
      case 'produtividade': return <Produtividade {...props} />;
      case 'qualidade': return <QualidadeDados {...props} />;
      case 'pessoas': return <Pessoas {...props} />;
      default: return <ModulePlaceholder id={view} />;
    }
  };

  return (
    <React.Fragment>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 16px 36px' }}>
        <IOSDevice dark={dark} statusDark={true}>
          <div className={`v360 ${dark ? 'v360-dark' : ''}`} style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', background: 'var(--bg)', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <Header subtitle={view === 'central' ? `Rede · ${POSTOS.length} postos` : postoName} theme={dark ? 'dark' : 'light'} onToggleTheme={() => setTweak('dark', !dark)} onBell={() => {}} />
            {view !== 'central' && (
              <FilterBar summary={summary} comparativo={`vs ${filters.comparativo}`} onOpen={() => setSheet(true)} />
            )}

            <main ref={scrollRef} style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: compact ? '12px 12px 24px' : '14px 14px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h1 style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', margin: 0 }}>{labelOf(view)}</h1>
              </div>
              <div key={view} className="v360-screen">{renderScreen()}</div>
            </main>

            <BottomNav tabs={barItems} active={bottomActive} onChange={setView}
              onMais={() => { setDrawerEdit(false); setDrawer(true); }}
              onMaisLong={() => { setDrawerEdit(true); setDrawer(true); }} />

            <MaisDrawer open={drawer} active={view} bar={bar} editOnOpen={drawerEdit} onClose={() => setDrawer(false)} onNavigate={navTo} onSetBar={setBarPersist} />
            <FilterSheet open={sheet} filters={filters} onClose={() => setSheet(false)} onApply={(f) => { setFilters(f); setSheet(false); }} />
          </div>
        </IOSDevice>
      </div>

      <TweaksPanel>
        <TweakSection label="Tema" />
        <TweakToggle label="Modo escuro" value={t.dark} onChange={(v) => setTweak('dark', v)} />
        <TweakSection label="Densidade" />
        <TweakRadio label="Densidade" value={t.density} options={['Compacto', 'Confortável']} onChange={(v) => setTweak('density', v)} />
        <TweakSection label="Estado dos dados" />
        <TweakRadio label="Estado" value={t.dataState} options={['Normal', 'Loading', 'Vazio']} onChange={(v) => setTweak('dataState', v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
