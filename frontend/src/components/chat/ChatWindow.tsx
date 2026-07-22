import { FormEvent, useEffect, useRef, useState } from 'react';
import { Mensaje } from '../../hooks/useAiChat';
import ChatMessage from './ChatMessage';

interface Props { mensajes: Mensaje[]; cargando: boolean; enviar: (t: string) => void; onCerrar: () => void; modo: 'ia' | 'basico' | null; }

export default function ChatWindow({ mensajes, cargando, enviar, onCerrar, modo }: Props) {
  const [texto, setTexto] = useState('');
  const fin = useRef<HTMLDivElement>(null);
  useEffect(() => { fin.current?.scrollIntoView({ behavior: 'smooth' }); }, [mensajes, cargando]);

  const onSubmit = (e: FormEvent) => { e.preventDefault(); enviar(texto); setTexto(''); };

  return (
    <div className="chat-win">
      <div className="chat-head">
        <div className="t">Copiloto de arriendos<small>{modo === 'basico' ? '🔧 modo básico — sin clave IA' : modo === 'ia' ? '✨ con IA · inundación GORE + micros GTFS' : 'inundación GORE + micros GTFS'}</small></div>
        <button onClick={onCerrar} aria-label="Cerrar">✕</button>
      </div>
      <div className="chat-cuerpo">
        {mensajes.map((m, i) => <ChatMessage key={i} m={m} />)}
        {cargando && <div className="escribiendo">consultando datos…</div>}
        <div ref={fin} />
      </div>
      <form className="chat-input" onSubmit={onSubmit}>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej: 3 dormitorios bajo 500 en Puente Alto sin riesgo…" />
        <button type="submit" disabled={cargando || !texto.trim()}>➤</button>
      </form>
    </div>
  );
}
