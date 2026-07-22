export interface CasaCompacta {
  id: number; precio: number; dorm: number; banos: number; m2: number;
  sector: string; comuna: string; lat: number; lon: number;
  riesgo: 'bajo' | 'atento' | 'medio' | 'alto'; locomocion: number | null; dev_precio_pct: number | null;
}
export interface AccionMapa { tipo: 'filtrar' | 'volar' | 'centrar'; ids?: number[]; lat?: number; lon?: number; zoom?: number; id?: number; }
export interface RespuestaChat { respuesta: string; acciones: AccionMapa[]; tools_usadas: string[]; }

export const api = {
  casas: async (): Promise<{ total: number; casas: CasaCompacta[] }> => (await fetch('/api/propiedades')).json(),
  capas: async () => (await fetch('/api/propiedades/capas')).json(),
  informe: async (id: number) => (await fetch(`/api/propiedades/${id}`)).json(),
  chat: async (mensaje: string, historial: Array<{ rol: string; texto: string }>): Promise<RespuestaChat> =>
    (await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensaje, historial }),
    })).json(),
};
