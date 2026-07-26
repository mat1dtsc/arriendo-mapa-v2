import { useCallback, useEffect, useState } from 'react';
import Mapa from './components/Mapa';
import ChatWindow from './components/chat/ChatWindow';
import Ficha from './components/Ficha';
import { useAiChat } from './hooks/useAiChat';
import { api, AccionMapa, CasaCompacta } from './api';

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
  const [activas, setActivas] = useState<Record<string, boolean>>({ flood: true, metro: true, stops: false });
  const onListo = useCallback(() => setMapaListo(true), []);

  useEffect(() => {
    api.casas().then((r) => setCasas(r.casas)).catch(() => {});
    api.capas().then(setCapas).catch(() => {});
  }, []);

  const onAcciones = useCallback((acciones: AccionMapa[]) => {
    let seq = Date.now();
    for (const a of acciones) {
      if (a.tipo === 'filtrar') setIdsVisibles(a.ids ?? null);
      if (a.tipo === 'volar' && a.id) { setSeleccion(a.id); api.informe(a.id).then(setInforme).catch(() => {}); }
      setOrden({ seq: seq++, accion: a });
    }
  }, []);

  const { mensajes, enviar, cargando, estado } = useAiChat(onAcciones);

  const onSeleccion = useCallback((id: number) => {
    setSeleccion(id);
    api.informe(id).then(setInforme).catch(() => {});
    setOrden({ seq: Date.now(), accion: { tipo: 'volar', lat: undefined, lon: undefined } as AccionMapa });
  }, []);

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
          <button className="lyr reset" onClick={() => { setIdsVisibles(null); setSeleccion(null); }}>
            ✕ Quitar filtro
          </button>
        )}
      </div>

      {informe && <Ficha data={informe} onCerrar={() => { setInforme(null); setSeleccion(null); }} />}

      {chatAbierto ? (
        <ChatWindow mensajes={mensajes} cargando={cargando} enviar={enviar}
          estado={estado} onCerrar={() => setChatAbierto(false)} />
      ) : (
        <button className="fab" onClick={() => setChatAbierto(true)}>
          💬 Buscar con IA
        </button>
      )}
    </>
  );
}
