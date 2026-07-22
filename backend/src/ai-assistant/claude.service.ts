import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TOOL_DECLARATIONS } from './tool-declarations';
import { ToolExecutorService, AccionMapa } from './tool-executor.service';
import { ModoBasicoService } from './modo-basico.service';

const SYSTEM_PROMPT = `Eres el asistente de ArriendoMapa Chile, experto en arriendos de Santiago.
Hablas español chileno cercano y directo, sin exagerar la jerga. Respuestas breves (2-5 frases), útiles y honestas.
Tu superpoder: datos que nadie más tiene — riesgo de inundación por calle (puntos críticos oficiales GORE RM jul-2026 y canales) y locomoción real (recorridos de micros y frecuencias del GTFS de Red Movilidad, además del Metro).
Usa SIEMPRE las herramientas para responder con datos reales; nunca inventes propiedades ni cifras. Cuando muestres casas menciona 2-3 destacadas con precio y por qué convienen. Si preguntan por riesgo de lluvia o micros, cita la fuente. Si no hay resultados, sugiere relajar un filtro concreto. El mapa se actualiza solo con tus herramientas: puedes decir "te las dejé en el mapa".`;

export interface RespuestaChat {
  respuesta: string;
  acciones: AccionMapa[];
  tools_usadas: string[];
  modo?: 'ia' | 'basico';
}

/** Loop agéntico con la API de Anthropic — versión compacta del claude-ai.service.ts de CotizadorIA. */
@Injectable()
export class ClaudeService {
  private readonly logger = new Logger(ClaudeService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly executor: ToolExecutorService,
    private readonly basico: ModoBasicoService,
  ) {}

  async chat(mensaje: string, historial: Array<{ rol: string; texto: string }> = []): Promise<RespuestaChat> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) return this.basico.responder(mensaje);
    const modelo = this.config.get<string>('CLAUDE_MODEL') || 'claude-sonnet-4-6';

    const messages: any[] = [
      ...historial.slice(-10).map((m) => ({ role: m.rol === 'usuario' ? 'user' : 'assistant', content: m.texto })),
      { role: 'user', content: mensaje },
    ];

    const acciones: AccionMapa[] = [];
    const toolsUsadas: string[] = [];
    let texto = '';

    for (let paso = 0; paso < 5; paso++) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: modelo,
          max_tokens: 1200,
          system: SYSTEM_PROMPT,
          tools: TOOL_DECLARATIONS,
          messages,
        }),
      });
      if (!r.ok) {
        const err = await r.text();
        this.logger.error(`Anthropic ${r.status}: ${err.slice(0, 300)} — usando modo básico`);
        return this.basico.responder(mensaje);
      }
      const data: any = await r.json();

      texto = (data.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim();
      const toolUses = (data.content || []).filter((b: any) => b.type === 'tool_use');

      if (data.stop_reason !== 'tool_use' || !toolUses.length) break;

      messages.push({ role: 'assistant', content: data.content });
      const resultados = toolUses.map((tu: any) => {
        toolsUsadas.push(tu.name);
        const res = this.executor.ejecutar(tu.name, tu.input);
        if (res.accion) acciones.push(res.accion);
        return { type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(res.datos) };
      });
      messages.push({ role: 'user', content: resultados });
    }

    return { respuesta: texto || 'No pude generar respuesta, intenta de nuevo.', acciones, tools_usadas: toolsUsadas, modo: 'ia' };
  }
}
