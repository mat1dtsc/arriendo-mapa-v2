import { Mensaje } from '../../hooks/useAiChat';

export default function ChatMessage({ m }: { m: Mensaje }) {
  return (
    <div className={'m ' + (m.rol === 'usuario' ? 'u' : 'a')}>
      {m.texto}
      {m.tools && m.tools.length > 0 && <div className="tl">⚙ {m.tools.join(' · ')}</div>}
    </div>
  );
}
