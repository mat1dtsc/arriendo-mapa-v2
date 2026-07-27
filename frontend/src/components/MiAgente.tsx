import { useState } from 'react';
import { api, Filtros } from '../api';

const CLP = (n: number) => '$' + n.toLocaleString('es-CL');

interface Props {
  filtros: Filtros;
  onCerrar: () => void;
  onListo: (mensaje: string) => void;
}

export default function MiAgente({ filtros, onCerrar, onListo }: Props) {
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [aviso, setAviso] = useState<'inmediato' | 'diario' | 'semanal'>('diario');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creado, setCreado] = useState<any>(null);

  const resumen = [
    filtros.tipo && filtros.tipo !== 'todos' ? filtros.tipo : null,
    filtros.dormitorios_min ? `${filtros.dormitorios_min}+ dormitorios` : null,
    filtros.comuna || 'toda la RM',
    filtros.precio_max ? `hasta ${CLP(filtros.precio_max)}` : null,
    filtros.riesgo_maximo === 'bajo' ? 'sin riesgo de inundación' : null,
    filtros.locomocion_min ? 'bien conectada' : null,
  ].filter(Boolean).join(' · ');

  const crear = async () => {
    if (!email.trim() && !telefono.trim()) {
      setError('Déjame un correo o un teléfono para poder avisarte');
      return;
    }
    setEnviando(true); setError(null);
    try {
      const r = await api.crearAgente({ email: email.trim(), telefono: telefono.trim(), filtros, aviso });
      if (r.ok) { setCreado(r); onListo(r.mensaje); }
      else setError(r.error);
    } catch {
      setError('No pude conectar con el servidor');
    } finally { setEnviando(false); }
  };

  if (creado) {
    return (
      <aside className="buscador">
        <div className="bs-head">
          <div><div className="bs-t">🤖 Tu agente está activo</div>
            <div className="bs-s">{creado.agente.nombre}</div></div>
          <button onClick={onCerrar}>✕</button>
        </div>
        <div className="bs-body">
          <div className="ag-ok">
            <div className="ag-num">{creado.calzan_hoy}</div>
            <div className="ag-lbl">propiedades calzan hoy</div>
          </div>
          {creado.muestra?.length > 0 && (
            <div className="campo">
              <span>Ya encontró</span>
              {creado.muestra.map((c: any) => (
                <div key={c.id} className="ag-item">
                  <b>{CLP(c.precio)}</b> · {c.sector}, {c.comuna} · {c.dorm}D · 💧{c.riesgo}
                </div>
              ))}
            </div>
          )}
          <p className="rp-nota">
            Te aviso a <b>{creado.agente.contacto.email || creado.agente.contacto.telefono}</b> cuando
            aparezca algo nuevo que calce. Puedes crear todos los agentes que quieras, con criterios distintos.
          </p>
        </div>
        <div className="bs-pie">
          <div className="bs-btns"><button className="pri" onClick={onCerrar}>Listo</button></div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="buscador">
      <div className="bs-head">
        <div>
          <div className="bs-t">🤖 Arma tu agente de búsqueda</div>
          <div className="bs-s">Busca por ti y te avisa. Gratis, sin comisión.</div>
        </div>
        <button onClick={onCerrar} aria-label="Cerrar">✕</button>
      </div>

      <div className="bs-body">
        <div className="campo">
          <span>Va a buscar</span>
          <div className="ag-criterios">{resumen}</div>
          <p className="rp-nota" style={{ marginTop: 4 }}>
            ¿Quieres cambiarlo? Cierra esto, ajusta los filtros y vuelve a abrirlo.
          </p>
        </div>

        <label className="campo">
          <span>Tu correo</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="tunombre@correo.cl" autoFocus />
        </label>

        <label className="campo">
          <span>Tu WhatsApp (opcional)</span>
          <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="9 1234 5678" />
        </label>

        <div className="campo">
          <span>Con qué frecuencia te aviso</span>
          <div className="amens">
            {([['inmediato', 'Apenas aparezca'], ['diario', 'Resumen diario'], ['semanal', 'Resumen semanal']] as const)
              .map(([v, l]) => (
                <button key={v} type="button" className={'amen' + (aviso === v ? ' on' : '')}
                  onClick={() => setAviso(v)}>{l}</button>
              ))}
          </div>
        </div>

        {error && <div className="rp-error">{error}</div>}

        <p className="rp-nota">
          Usamos tu contacto <b>solo para avisarte de propiedades</b> que calcen con lo que pediste.
          Puedes borrar tu agente cuando quieras.
        </p>
      </div>

      <div className="bs-pie">
        <div className="bs-btns">
          <button className="sec" onClick={onCerrar}>Cancelar</button>
          <button className="pri" onClick={crear} disabled={enviando}>
            {enviando ? 'Creando…' : 'Activar mi agente'}
          </button>
        </div>
      </div>
    </aside>
  );
}
