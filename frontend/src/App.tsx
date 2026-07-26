import { useCallback, useEffect, useState } from 'react';
import Mapa from './components/Mapa';
import ChatWindow from './components/chat/ChatWindow';
import Ficha from './components/Ficha';
import Buscador from './components/Buscador';
import { useAiChat } from './hooks/useAiChat';
import { api, AccionMapa, CasaCompacta, Filtros } from './api';

const CAPAS = [
  { id: 'flood', label: '💧 Inundación', color: 'var(--cyan)', on: true },
  { id: 'metro', label: 'Ⓜ️ Metro', color: 'var(--violet)', on: true },
  { id: 'stops', label: '🚌 Paraderos', color: 'var(--amber)', on: false },
];

export default function App() {
  const [casas, setCasas] = useState<CasaCompacta[]>([]);
  const [capas, setCapas] = useState<any>(null);
  const [idsVisibles, setIdsVisibles] = useState<number[] | null>(null);
  const [orden, setOrden] = useState<{ seq: number; accion: AccionMapa } | null>(null);
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [informe, setInforme] = useState<any>(null);
  const [chatAbierto, setChatAbierto] = useState(false);
  const [mapaListo, setMapaListo] = useState(false);
  const [mapaLento, setMapaLento] = useState(false);
  const [activas, setActivas] = useState<Record<string, boolean>>({ flood: true, metro: true, stops: false });
  const [buscadorAbierto, setBuscadorAbierto] = useState(false);
  const [filtros, setFiltros] = useState<Filtros>({});
  const [previa, setPrevia] = useState<number | null>(null);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const onListo = useCallback(() => setMapaListo(true), []);

  // Red de seguridad: si el estilo del mapa no carga (CDN caído o sin internet),
  // igual liberamos la interfaz en vez de dejar el overlay bloqueando todo.
  useEffect(() => {
    const t = setTimeout(() => {
      setMapaListo((listo) => { if (!listo) setMapaLento(true); return true; });
    }, 8000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    api.casas().then((r) => setCasas(r.casas)).catch(() => {});
    api.capas().then(setCapas).catch(() => {});
  }, []);

  useEffect(() => {
    if (!buscadorAbierto) return;
    const t = setTimeout(() => { api.casas(filtros).then((r) => setPrevia(r.total)).catch(() => {}); }, 250);
    return () => clearTimeout(t);
  }, [filtros, buscadorAbierto]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  const onAcciones = useCallback((acciones: AccionMapa[]) => {
    let seq = Date.now();
    for (const a of acciones) {
      if (a.tipo === 'filtrar') setIdsVisibles(a.ids ?? null);
      if (a.tipo === 'volar' && a.id) { setSeleccion(a.id); api.informe(a.id).then(setInforme).catch(() => {}); }
      if (a.tipo === 'alerta' && a.alerta) { setAlertas((p) => [...p, a.alerta]); setToast(`🔔 Alerta "${a.alerta.nombre}" guardada`); }
      setOrden({ seq: seq++, accion: a });
    }
  }, []);

  const { mensajes, enviar, cargando, estado } = useAiChat(onAcciones);

  const onSeleccion = useCallback((id: number) => {
    setSeleccion(id);
    api.informe(id).then(setInforme).catch(() => {});
    setOrden({ seq: Date.now(), accion: { tipo: 'volar', lat: undefined, lon: undefined } as AccionMapa });
  }, []);

  const buscar = async (f: Filtros) => {
    const r = await api.casas(f);
    setIdsVisibles(r.casas.map((c) => c.id));
    setOrden({ seq: Date.now(), accion: { tipo: 'filtrar', ids: r.casas.map((c) => c.id) } });
    setBuscadorAbierto(false);
    setToast(r.total ? `${r.total} propiedades encontradas` : 'Sin resultados: prueba soltando un filtro');
  };

  const crearAlerta = (f: Filtros) => {
    const partes = [f.tipo, f.comuna, f.dormitorios_min && `${f.dormitorios_min}+D`,
      f.precio_max && `hasta $${Math.round(f.precio_max / 1000)}k`,
      f.riesgo_maximo === 'bajo' && 'sin riesgo'].filter(Boolean).join(' · ');
    const nombre = partes || 'Toda la RM';
    setAlertas((p) => [...p, { id: 'a' + Date.now(), nombre, filtros: f }]);
    setToast(`🔔 Te avisaré cuando aparezca: ${nombre}`);
    setBuscadorAbierto(false);
  };

  const toggleCapa = (id: string) => {
    const on = !activas[id];
    setActivas({ ...activas, [id]: on });
    (window as any).__toggleCapa?.(id, on);
  };

  const n = idsVisibles ? idsVisibles.length : casas.length;

  return (
    <>
      <Mapa casas={casas} capas={capas} idsVisibles={idsVisibles} seleccion={seleccion}
        orden={orden} onSeleccion={onSeleccion} onListo={onListo} />

      {!mapaListo && (
        <div id="boot"><div className="sp" /><div>Cargando mapa vectorial…</div></div>
      )}
      {mapaLento && (
        <div className="aviso-mapa">
          El mapa tarda en cargar — revisa tu conexión. Los filtros y el agente funcionan igual.
          <button onClick={() => setMapaLento(false)}>✕</button>
        </div>
      )}

      <header className="head">
        <div className="logo">ARRIENDO<b>MAPA</b><span>Santiago · riesgo &amp; conectividad</span></div>
        <div className="stat">
          <div className="n">{n}</div>
          <div className="l">{idsVisibles ? `de ${casas.length} propiedades` : 'propiedades'}</div>
        </div>
      </header>

      <div className="layers">
        {CAPAS.map((c) => (
          <button key={c.id} className={'lyr' + (activas[c.id] ? ' on' : '')} onClick={() => toggleCapa(c.id)}>
            <i style={{ color: c.color }} />{c.label}
          </button>
        ))}
        {idsVisibles && (
          <button className="lyr reset" onClick={() => { setIdsVisibles(null); setSeleccion(null); setFiltros({}); }}>
            ✕ Quitar filtro
          </button>
        )}
        {alertas.length > 0 && (
          <div className="lyr alertas-chip">🔔 {alertas.length} alerta{alertas.length > 1 ? 's' : ''} activa{alertas.length > 1 ? 's' : ''}</div>
        )}
      </div>

      {buscadorAbierto && (
        <Buscador filtros={filtros} setFiltros={setFiltros} onBuscar={buscar} onAlerta={crearAlerta}
          resultados={previa} onCerrar={() => setBuscadorAbierto(false)} />
      )}

      {informe && <Ficha data={informe} onCerrar={() => { setInforme(null); setSeleccion(null); }} />}

      {toast && <div className="toast">{toast}</div>}

      {chatAbierto ? (
        <ChatWindow mensajes={mensajes} cargando={cargando} enviar={enviar}
          estado={estado} onCerrar={() => setChatAbierto(false)} />
      ) : (
        <div className="fabs">
          <button className="fab sec" onClick={() => setBuscadorAbierto(true)}>⚙️ Filtros</button>
          <button className="fab" onClick={() => setChatAbierto(true)}>
            <span className="dot-live" /> Hablar con mi agente
          </button>
        </div>
      )}
    </>
  );
}
