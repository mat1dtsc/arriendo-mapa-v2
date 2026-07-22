import { Mensaje } from '../../hooks/useAiChat';

export default function ChatMessage({ m }: { m: Mensaje }) {
  return (
    <div className={`msg ${m.rol}`}>
      {m.texto}
      {m.tools && m.tools.length > 0 && <div className="tools">⚙ {m.tools.join(' · ')}</div>}
    </div>
  );
}
