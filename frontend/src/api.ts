export interface Filtros {
  tipo?: string; comuna?: string; precio_max?: number; precio_min?: number;
  dormitorios_min?: number; banos_min?: number; m2_min?: number;
  riesgo_maximo?: string; locomocion_min?: number; amenidades?: string[]; texto?: string;
}
export interface Opciones {
  comunas: string[]; tipos: string[]; precio_min: number; precio_max: number;
  dormitorios: number[]; amenidades: { id: string; label: string }[]; total: number;
}
export interface CasaCompacta {
  id: number; precio: number; dorm: number; banos: number; m2: number;
  sector: string; comuna: string; lat: number; lon: number;
  riesgo: 'bajo' | 'atento' | 'medio' | 'alto'; locomocion: number | null; dev_precio_pct: number | null;
}
export interface AccionMapa { tipo: 'filtrar' | 'volar' | 'centrar' | 'alerta'; alerta?: any; ids?: number[]; lat?: number; lon?: number; zoom?: number; id?: number; }
export interface RespuestaChat { respuesta: string; acciones: AccionMapa[]; tools_usadas: string[]; modo: string; proveedor?: string; }
export interface EstadoIA { activo: string; disponibles: string[]; etiqueta: string; }

const j = async (r: Response) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); };

export const api = {
  casas: (f?: Filtros): Promise<{ total: number; casas: CasaCompacta[] }> => {
    const q = new URLSearchParams();
    Object.entries(f ?? {}).forEach(([k, v]) => {
      if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) return;
      q.set(k, Array.isArray(v) ? v.join(',') : String(v));
    });
    return fetch('/api/propiedades' + (q.toString() ? '?' + q : '')).then(j);
  },
  opciones: (): Promise<Opciones> => fetch('/api/propiedades/opciones').then(j),
  capas: (): Promise<any> => fetch('/api/propiedades/capas').then(j),
  informe: (id: number): Promise<any> => fetch(`/api/propiedades/${id}`).then(j),
  estado: (): Promise<EstadoIA> => fetch('/api/ai/estado').then(j),
  chat: (mensaje: string, historial: Array<{ rol: string; texto: string }>): Promise<RespuestaChat> =>
    fetch('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensaje, historial }) }).then(j),
};
