import { useEffect, useState } from 'react';
import { api, Opciones } from '../api';

const CAUSAS = [
  'Anegamiento por lluvia',
  'Desborde de canal o acequia',
  'Colector o alcantarillado colapsado',
  'Barro o arrastre desde quebrada',
  'Paso bajo nivel se inunda',
];

interface Props {
  onCerrar: () => void;
  onListo: (mensaje: string) => void;
  comunaSugerida?: string;
}

export default function Reportar({ onCerrar, onListo, comunaSugerida }: Props) {
  const [op, setOp] = useState<Opciones | null>(null);
  const [calle, setCalle] = useState('');
  const [comuna, setComuna] = useState(comunaSugerida ?? '');
  const [causa, setCausa] = useState(CAUSAS[0]);
  const [detalle, setDetalle] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api.opciones().then(setOp).catch(() => {}); }, []);

  const enviar = async () => {
    if (!calle.trim() || !comuna) { setError('Necesito la calle y la comuna'); return; }
    setEnviando(true); setError(null);
    try {
      const r = await api.reportar({ calle: calle.trim(), comuna, causa, detalle: detalle.trim() || undefined });
      if (r.ok) { onListo(r.mensaje ?? 'Calle marcada en el mapa'); onCerrar(); }
      else setError(r.error ?? 'No pude registrarla');
    } catch {
      setError('No pude conectar con el servidor');
    } finally { setEnviando(false); }
  };

  return (
    <aside className="reportar">
      <div className="bs-head">
        <div>
          <div className="bs-t">💧 Reportar calle que se anega</div>
          <div className="bs-s">El catastro oficial tiene 175 puntos. Tú conoces tu barrio.</div>
        </div>
        <button onClick={onCerrar} aria-label="Cerrar">✕</button>
      </div>

      <div className="bs-body">
        <label className="campo">
          <span>Calle</span>
          <input value={calle} onChange={(e) => setCalle(e.target.value)}
            placeholder="Ej: Avenida Santa Rosa" autoFocus />
        </label>

        <label className="campo">
          <span>Comuna</span>
          <select value={comuna} onChange={(e) => setComuna(e.target.value)}>
            <option value="">Elige la comuna</option>
            {op?.comunas.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <label className="campo">
          <span>¿Qué pasa cuando llueve?</span>
          <select value={causa} onChange={(e) => setCausa(e.target.value)}>
            {CAUSAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <label className="campo">
          <span>Detalle (opcional)</span>
          <input value={detalle} onChange={(e) => setDetalle(e.target.value)}
            placeholder="Ej: entre Eyzaguirre y el puente, se corta el paso" />
        </label>

        {error && <div className="rp-error">{error}</div>}

        <p className="rp-nota">
          Buscamos la calle en OpenStreetMap y la dibujamos en el mapa marcada como
          <b> reporte vecinal</b>, distinta del catastro oficial del Gobierno de Santiago.
        </p>
      </div>

      <div className="bs-pie">
        <div className="bs-btns">
          <button className="sec" onClick={onCerrar}>Cancelar</button>
          <button className="pri" onClick={enviar} disabled={enviando}>
            {enviando ? 'Buscando la calle…' : 'Marcar en el mapa'}
          </button>
        </div>
      </div>
    </aside>
  );
}
