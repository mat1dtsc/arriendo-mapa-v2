import { useEffect, useState } from 'react';
import { api, Filtros, Opciones } from '../api';

const CLP = (n: number) => '$' + n.toLocaleString('es-CL');

const RIESGOS = [
  { v: '', l: 'Cualquier riesgo' },
  { v: 'bajo', l: '💧 Solo sin riesgo' },
  { v: 'atento', l: '💧 Bajo o atento' },
  { v: 'medio', l: '💧 Hasta riesgo medio' },
];
const LOCO = [
  { v: '', l: 'Cualquier conexión' },
  { v: '35', l: '🚌 Media o mejor' },
  { v: '55', l: '🚌 Buena conexión' },
  { v: '75', l: '🚌 Excelente conexión' },
];
const PRECIOS = [350, 400, 450, 500, 600, 700, 800, 1000, 1500];

interface Props {
  filtros: Filtros;
  setFiltros: (f: Filtros) => void;
  onBuscar: (f: Filtros) => void;
  onAlerta: (f: Filtros) => void;
  resultados: number | null;
  onCerrar: () => void;
}

export default function Buscador({ filtros, setFiltros, onBuscar, onAlerta, resultados, onCerrar }: Props) {
  const [op, setOp] = useState<Opciones | null>(null);
  useEffect(() => { api.opciones().then(setOp).catch(() => {}); }, []);

  const set = (k: keyof Filtros, v: any) => setFiltros({ ...filtros, [k]: v === '' ? undefined : v });
  const toggleAmen = (id: string) => {
    const a = filtros.amenidades ?? [];
    set('amenidades', a.includes(id) ? a.filter((x) => x !== id) : [...a, id]);
  };
  const limpiar = () => setFiltros({});
  const activos = Object.values(filtros).filter((v) => v !== undefined && (!Array.isArray(v) || v.length)).length;

  return (
    <aside className="buscador">
      <div className="bs-head">
        <div>
          <div className="bs-t">Búsqueda personalizada</div>
          <div className="bs-s">{activos > 0 ? `${activos} filtro${activos > 1 ? 's' : ''} activo${activos > 1 ? 's' : ''}` : 'Define lo que buscas'}</div>
        </div>
        <button onClick={onCerrar} aria-label="Cerrar">✕</button>
      </div>

      <div className="bs-body">
        <label className="campo">
          <span>Tipo de propiedad</span>
          <select value={filtros.tipo ?? ''} onChange={(e) => set('tipo', e.target.value)}>
            <option value="">Todas</option>
            <option value="casa">🏠 Casa</option>
            <option value="departamento">🏢 Departamento</option>
          </select>
        </label>

        <label className="campo">
          <span>Comuna</span>
          <select value={filtros.comuna ?? ''} onChange={(e) => set('comuna', e.target.value)}>
            <option value="">Toda la Región Metropolitana</option>
            {op?.comunas.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <div className="fila">
          <label className="campo">
            <span>Precio hasta</span>
            <select value={filtros.precio_max ?? ''} onChange={(e) => set('precio_max', e.target.value ? Number(e.target.value) : '')}>
              <option value="">Sin tope</option>
              {PRECIOS.map((p) => <option key={p} value={p * 1000}>{CLP(p * 1000)}</option>)}
            </select>
          </label>
          <label className="campo">
            <span>Dormitorios</span>
            <select value={filtros.dormitorios_min ?? ''} onChange={(e) => set('dormitorios_min', e.target.value ? Number(e.target.value) : '')}>
              <option value="">Cualquiera</option>
              {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{d}+</option>)}
            </select>
          </label>
        </div>

        <div className="fila">
          <label className="campo">
            <span>Baños</span>
            <select value={filtros.banos_min ?? ''} onChange={(e) => set('banos_min', e.target.value ? Number(e.target.value) : '')}>
              <option value="">Cualquiera</option>
              {[1, 2, 3].map((b) => <option key={b} value={b}>{b}+</option>)}
            </select>
          </label>
          <label className="campo">
            <span>Superficie mínima</span>
            <select value={filtros.m2_min ?? ''} onChange={(e) => set('m2_min', e.target.value ? Number(e.target.value) : '')}>
              <option value="">Cualquiera</option>
              {[50, 70, 90, 120, 150].map((m) => <option key={m} value={m}>{m} m²</option>)}
            </select>
          </label>
        </div>

        <label className="campo destacado">
          <span>Riesgo de inundación</span>
          <select value={filtros.riesgo_maximo ?? ''} onChange={(e) => set('riesgo_maximo', e.target.value)}>
            {RIESGOS.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
          </select>
        </label>

        <label className="campo destacado">
          <span>Locomoción</span>
          <select value={filtros.locomocion_min ?? ''} onChange={(e) => set('locomocion_min', e.target.value ? Number(e.target.value) : '')}>
            {LOCO.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
          </select>
        </label>

        <div className="campo">
          <span>Debe tener</span>
          <div className="amens">
            {(op?.amenidades ?? []).map((a) => (
              <button key={a.id} type="button"
                className={'amen' + ((filtros.amenidades ?? []).includes(a.id) ? ' on' : '')}
                onClick={() => toggleAmen(a.id)}>{a.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="bs-pie">
        {resultados !== null && <div className="bs-res">{resultados} propiedades calzan</div>}
        <div className="bs-btns">
          <button className="sec" onClick={limpiar}>Limpiar</button>
          <button className="pri" onClick={() => onBuscar(filtros)}>Ver en el mapa</button>
        </div>
        <button className="alerta" onClick={() => onAlerta(filtros)}>
          🔔 Avísame cuando aparezca algo así
        </button>
      </div>
    </aside>
  );
}
