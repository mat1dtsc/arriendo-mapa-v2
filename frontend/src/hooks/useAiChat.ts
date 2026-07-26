import { useEffect, useState } from 'react';
import { api, AccionMapa, EstadoIA } from '../api';

export interface Mensaje { rol: 'usuario' | 'asistente'; texto: string; tools?: string[]; }

/** Hook del copiloto — patrón useAiChat de CotizadorIA. */
export function useAiChat(onAcciones: (a: AccionMapa[]) => void) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([{
    rol: 'asistente',
    texto: 'Hola 👋 Soy tu agente de arriendos. No eres tú quien busca: dime qué necesitas y yo recorro el catálogo por ti.\n\nVeo lo que los portales no te muestran: qué calles se anegan en invierno y qué micros pasan de verdad por la puerta. Si aún no aparece lo tuyo, te dejo una alerta y te aviso cuando aparezca.',
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
