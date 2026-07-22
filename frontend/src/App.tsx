import { useCallback, useEffect, useState } from 'react';
import Mapa from './components/Mapa';
import ChatWindow from './components/chat/ChatWindow';
import { useAiChat } from './hooks/useAiChat';
import { api, AccionMapa, CasaCompacta } from './api';

export default function App() {
  const [casas, setCasas] = useState<CasaCompacta[]>([]);
  const [capas, setCapas] = useState<any>(null);
  const [idsVisibles, setIdsVisibles] = useState<number[] | null>(null);
  const [orden, setOrden] = useState<{ seq: number; accion: AccionMapa } | null>(null);
  const [chatAbierto, setChatAbierto] = useState(true);

  useEffect(() => {
    api.casas().then((r) => setCasas(r.casas)).catch(() => {});
    api.capas().then(setCapas).catch(() => {});
  }, []);

  const onAcciones = useCallback((acciones: AccionMapa[]) => {
    let seq = Date.now();
    for (const a of acciones) {
      if (a.tipo === 'filtrar') setIdsVisibles(a.ids ?? null);
      setOrden({ seq: seq++, accion: a });
    }
  }, []);

  const { mensajes, enviar, cargando, modo } = useAiChat(onAcciones);
  const onSeleccion = useCallback((id: number) => {
    setChatAbierto(true);
    enviar(`Dame el informe crítico de la casa id ${id}`);
  }, [enviar]);

  const visibles = idsVisibles ? idsVisibles.length : casas.length;

  return (
    <>
      <Mapa casas={casas} idsVisibles={idsVisibles} capas={capas} orden={orden} onSeleccion={onSeleccion} />
      <header className="topbar">
        <div className="brand">ARRIENDO<b>MAPA</b><span className="v2">V2</span></div>
        <span className="contador">{visibles} de {casas.length} avisos · mapa + IA</span>
      </header>
      {chatAbierto
        ? <ChatWindow mensajes={mensajes} cargando={cargando} enviar={enviar} modo={modo} onCerrar={() => setChatAbierto(false)} />
        : <button className="chat-fab" onClick={() => setChatAbierto(true)} aria-label="Abrir chat">💬</button>}
    </>
  );
}
