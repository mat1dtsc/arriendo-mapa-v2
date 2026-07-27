const CLP = (n: number) => '$' + n.toLocaleString('es-CL');
const D = (m: number | null) => (m == null ? '—' : m < 1000 ? m + ' m' : (m / 1000).toFixed(1) + ' km');
const NIV: Record<string, [string, string]> = {
  alto: ['ALTO', '#FF6B5B'], medio: ['MEDIO', '#FFC857'], atento: ['ATENTO', '#3ED8F0'], bajo: ['BAJO', '#4FE39B'],
};

export default function Ficha({ data: d, onCerrar }: { data: any; onCerrar: () => void }) {
  const r = d.riesgo_invierno, l = d.locomocion;
  const nv = NIV[d.riesgo] ?? NIV.bajo;
  const s = l?.score;
  const ln = s == null ? 's/d' : s >= 75 ? 'Excelente' : s >= 55 ? 'Buena' : s >= 35 ? 'Media' : 'Baja';
  const am = d.amenidades ? Object.entries(d.amenidades).filter(([, v]) => v).map(([k]) =>
    ({ estac: 'Estacionamiento', mascotas: 'Mascotas', piscina: 'Piscina', condominio: 'Condominio' } as any)[k] || k) : [];

  return (
    <aside className="sheet open">
      <button className="x" onClick={onCerrar}>✕</button>
      <div className="sh-scroll">
        {d.fotos?.length > 0 ? (
          <div className="sh-img">
            {d.fotos.map((f: string) => <img key={f} src={f} alt={'Foto de ' + d.sector} loading="lazy" />)}
          </div>
        ) : (
          <div className="sh-nofoto">
            <div className="nf-ico">📷</div>
            <div className="nf-t">Sin foto propia verificada</div>
            <div className="nf-s">El aviso no trae una imagen que podamos acreditar como de esta propiedad. Prefiero no mostrarte la foto de otra casa.</div>
          </div>
        )}
        <div className="sh-body">
          <div className="sh-price mono">{CLP(d.precio)} <em>/mes</em></div>
          <div className="sh-loc">{d.sector} · {d.comuna}{d.estado === 'verificado' ? ' · ✓' : ''}</div>
          <div className="sh-specs">
            <span><b>{d.dorm}</b> dorm</span><span><b>{d.banos}</b> baños</span>
            <span><b>{d.m2}</b> m²</span>
            <span className="mono"><b>{d.precio_por_m2 ? CLP(d.precio_por_m2) : '—'}</b>/m²</span>
          </div>
          {am.length > 0 && <div className="bus" style={{ marginTop: 12 }}>{am.map((a: string) => <span key={a} style={{ color: 'var(--dim)' }}>{a}</span>)}</div>}

          <div className="row">
            <div className="rh"><span className="rt">💧 Riesgo de invierno</span>
              <span className="tag" style={{ background: nv[1] + '22', color: nv[1] }}>{nv[0]}</span></div>
            <div className="rd">
              Punto crítico a <b className="mono">{D(r?.punto_critico_mas_cercano?.distancia_m)}</b>:{' '}
              <b>{r?.punto_critico_mas_cercano?.sector}</b> — {r?.punto_critico_mas_cercano?.causa?.toLowerCase()}.
              {r?.canal_cercano && <> <b>{r.canal_cercano.nombre}</b> a <b className="mono">{D(r.canal_cercano.distancia_m)}</b>.</>}
            </div>
            <div className="src">{r?.fuente}</div>
          </div>

          <div className="row">
            <div className="rh"><span className="rt">🚌 Locomoción</span>
              <span className="tag" style={{ background: '#3ED8F022', color: 'var(--cyan)' }}>{ln}{s != null ? ' · ' + s : ''}</span></div>
            <div className="rd">
              <b>{l?.n_recorridos ?? '—'}</b> recorridos · <b className="mono">{l?.buses_hora_punta ?? '—'}</b> buses/h punta ·
              paradero a <b className="mono">{D(l?.paradero_mas_cercano_m)}</b> · Metro <b>{l?.metro_mas_cercano || '—'}</b> a <b className="mono">{D(l?.metro_distancia_m)}</b>
              {l?.recorridos?.length > 0 && <div className="bus">{l.recorridos.slice(0, 10).map((x: string) => <span key={x}>{x}</span>)}</div>}
            </div>
            <div className="src">{l?.fuente}</div>
          </div>

          <div className="row">
            <div className="rh"><span className="rt">💰 Precio vs comuna</span>
              {d.dev_precio_pct != null && (
                <span className="tag" style={{
                  background: d.dev_precio_pct <= -5 ? '#4FE39B22' : d.dev_precio_pct >= 8 ? '#FF6B5B22' : 'var(--surface2)',
                  color: d.dev_precio_pct <= -5 ? '#4FE39B' : d.dev_precio_pct >= 8 ? '#FF6B5B' : 'var(--dim)',
                }}>{d.dev_precio_pct > 0 ? '+' : ''}{d.dev_precio_pct}%</span>)}
            </div>
            <div className="rd">
              {d.dev_precio_pct == null ? 'Sin m² para comparar.' : (
                <><b>{d.dev_precio_pct > 0 ? d.dev_precio_pct + '% sobre' : Math.abs(d.dev_precio_pct) + '% bajo'}</b> la mediana
                  de {d.comuna} (<b className="mono">{CLP(d.mediana_comuna_m2 || 0)}/m²</b>).</>)}
            </div>
          </div>

          {d.nota && <div className="rd" style={{ marginTop: 12, fontSize: 12 }}>{d.nota}</div>}
          <a className="cta" href={d.link} target="_blank" rel="noopener noreferrer">
            {d.link_directo === false ? 'Buscar este aviso en Portal Inmobiliario ↗' : 'Ver aviso original ↗'}
          </a>
          {d.link_directo === false && (
            <p className="cta-nota">
              Este aviso no trae enlace directo, así que te llevo a la búsqueda ya filtrada
              por <b>{d.comuna}</b>, <b>{d.dorm} dormitorios</b> y precio cercano a <b>{'$' + d.precio.toLocaleString('es-CL')}</b>.
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
