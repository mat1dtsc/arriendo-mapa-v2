export interface CasaCompacta {
  id: number; precio: number; dorm: number; banos: number; m2: number;
  sector: string; comuna: string; lat: number; lon: number;
  riesgo: 'bajo' | 'atento' | 'medio' | 'alto'; locomocion: number | null; dev_precio_pct: number | null;
}
export interface AccionMapa { tipo: 'filtrar' | 'volar' | 'centrar'; ids?: number[]; lat?: number; lon?: number; zoom?: number; id?: number; }
export interface RespuestaChat { respuesta: string; acciones: AccionMapa[]; tools_usadas: string[]; modo: string; proveedor?: string; }
export interface EstadoIA { activo: string; disponibles: string[]; etiqueta: string; }

const j = async (r: Response) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); };

export const api = {
  casas: (): Promise<{ total: number; casas: CasaCompacta[] }> => fetch('/api/propiedades').then(j),
  capas: (): Promise<any> => fetch('/api/propiedades/capas').then(j),
  informe: (id: number): Promise<any> => fetch(`/api/propiedades/${id}`).then(j),
  estado: (): Promise<EstadoIA> => fetch('/api/ai/estado').then(j),
  chat: (mensaje: string, historial: Array<{ rol: string; texto: string }>): Promise<RespuestaChat> =>
    fetch('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensaje, historial }) }).then(j),
};
