import { useState } from 'react';
import { api, AccionMapa } from '../api';

export interface Mensaje { rol: 'usuario' | 'asistente'; texto: string; tools?: string[]; }

/** Hook calcado del useAiChat.js de CotizadorIA: estado del chat + envío + callback de acciones. */
export function useAiChat(onAcciones: (a: AccionMapa[]) => void) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    { rol: 'asistente', texto: 'Hola 👋 Soy tu copiloto de arriendos. Pídeme cosas como "casas de 3 dormitorios bajo 500 mil en Puente Alto que no se inunden" o "¿cómo es arrendar en La Florida?" y muevo el mapa por ti.' },
  ]);
  const [cargando, setCargando] = useState(false);

  const enviar = async (texto: string) => {
    if (!texto.trim() || cargando) return;
    const historial = mensajes.map((m) => ({ rol: m.rol, texto: m.texto }));
    setMensajes((p) => [...p, { rol: 'usuario', texto }]);
    setCargando(true);
    try {
      const r = await api.chat(texto, historial);
      setMensajes((p) => [...p, { rol: 'asistente', texto: r.respuesta, tools: r.tools_usadas }]);
      if (r.acciones?.length) onAcciones(r.acciones);
    } catch {
      setMensajes((p) => [...p, { rol: 'asistente', texto: 'Se cayó la conexión con el backend 😅 ¿está corriendo en :3000?' }]);
    } finally {
      setCargando(false);
    }
  };
  return { mensajes, enviar, cargando };
}
