import { FormEvent, useEffect, useRef, useState } from 'react';
import { Mensaje } from '../../hooks/useAiChat';
import ChatMessage from './ChatMessage';
import { EstadoIA } from '../../api';

const SUGERENCIAS = [
  'Busco casa 3D bajo 500 que no se inunde',
  '¿Qué comuna me conviene?',
  'Avísame si aparece algo así',
  'Compara La Florida con Puente Alto',
];

interface Props {
  mensajes: Mensaje[]; cargando: boolean; enviar: (t: string) => void;
  estado: EstadoIA | null; onCerrar: () => void;
}

export default function ChatWindow({ mensajes, cargando, enviar, estado, onCerrar }: Props) {
  const [texto, setTexto] = useState('');
  const fin = useRef<HTMLDivElement>(null);
  useEffect(() => { fin.current?.scrollIntoView({ behavior: 'smooth' }); }, [mensajes, cargando]);

  const onSubmit = (e: FormEvent) => { e.preventDefault(); enviar(texto); setTexto(''); };
  const basico = !estado || estado.activo === 'basico';

  return (
    <div className="chat open">
      <div className="ch-head">
        <div className="t">Tu agente de arriendos
          <small>{basico ? '🔧 modo básico · sin clave IA' : `✨ ${estado!.etiqueta}`} · busca, filtra y te avisa</small>
        </div>
        <button onClick={onCerrar} aria-label="Cerrar">✕</button>
      </div>
      <div className="ch-body">
        {mensajes.map((m, i) => <ChatMessage key={i} m={m} />)}
        {cargando && <div className="m a escribiendo"><span /><span /><span /></div>}
        <div ref={fin} />
      </div>
      <div className="sug">
        {SUGERENCIAS.map((s) => <button key={s} onClick={() => enviar(s)} disabled={cargando}>{s}</button>)}
      </div>
      <form className="ch-in" onSubmit={onSubmit}>
        <input value={texto} onChange={(e) => setTexto(e.target.value)}
          placeholder="3 dormitorios bajo 500 sin riesgo…" autoComplete="off" />
        <button type="submit" disabled={cargando || !texto.trim()}>➤</button>
      </form>
    </div>
  );
}
