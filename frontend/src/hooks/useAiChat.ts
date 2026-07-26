import { useEffect, useState } from 'react';
import { api, AccionMapa, EstadoIA } from '../api';

export interface Mensaje { rol: 'usuario' | 'asistente'; texto: string; tools?: string[]; }

/** Hook del copiloto — patrón useAiChat de CotizadorIA. */
export function useAiChat(onAcciones: (a: AccionMapa[]) => void) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([{
    rol: 'asistente',
    texto: 'Hola 👋 Busco por ti con datos que ningún portal tiene: riesgo de inundación calle por calle y micros reales del GTFS. Pídeme algo o toca una píldora de precio en el mapa.',
  }]);
  const [cargando, setCargando] = useState(false);
  const [estado, setEstado] = useState<EstadoIA | null>(null);

  useEffect(() => { api.estado().then(setEstado).catch(() => {}); }, []);

  const enviar = async (texto: string) => {
    if (!texto.trim() || cargando) return;
    const historial = mensajes.map((m) => ({ rol: m.rol, texto: m.texto }));
    setMensajes((p) => [...p, { rol: 'usuario', texto }]);
    setCargando(true);
    try {
      const r = await api.chat(texto, historial);
      setMensajes((p) => [...p, { rol: 'asistente', texto: r.respuesta, tools: r.tools_usadas }]);
      if (r.acciones?.length) onAcciones(r.acciones);
      if (r.modo && estado && r.modo !== estado.activo) setEstado({ ...estado, activo: r.modo });
    } catch {
      setMensajes((p) => [...p, { rol: 'asistente', texto: 'No pude hablar con el backend 😅 ¿está corriendo en :3000?' }]);
    } finally { setCargando(false); }
  };

  return { mensajes, enviar, cargando, estado };
}
