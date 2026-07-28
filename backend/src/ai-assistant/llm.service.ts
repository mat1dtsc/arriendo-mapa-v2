import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TOOL_DECLARATIONS } from './tool-declarations';
import { ToolExecutorService, AccionMapa } from './tool-executor.service';
import { ModoBasicoService } from './modo-basico.service';
import { ClaudeService } from './claude.service';

export type Proveedor = 'deepseek' | 'kimi' | 'claude' | 'basico';

/**
 * Config por proveedor. DeepSeek y Kimi son OpenAI-compatible, así que
 * comparten el mismo loop de tool-calling; solo cambia baseURL y modelo.
 *
 * ⚠️ deepseek-chat / deepseek-reasoner fueron retirados el 24-jul-2026.
 *    Usar deepseek-v4-flash (barato) o deepseek-v4-pro (razonamiento).
 * ⚠️ Kimi cobra el rate-limit contando max_tokens por adelantado → mantenerlo bajo.
 */
const PROVEEDORES = {
  deepseek: {
    base: 'https://api.deepseek.com/v1',
    modelo: 'deepseek-v4-flash',
    envKey: 'DEEPSEEK_API_KEY',
    etiqueta: 'DeepSeek V4 Flash',
  },
  kimi: {
    base: 'https://api.moonshot.ai/v1',
    modelo: 'kimi-k2.6',
    envKey: 'MOONSHOT_API_KEY',
    etiqueta: 'Kimi (Moonshot)',
  },
} as const;

const SYSTEM_PROMPT = `Eres el AGENTE de arriendos de ArriendoMapa Chile. No eres un buscador: trabajas para el usuario.
Actúas como un corredor de confianza que ya recorrió el barrio y le dice la verdad, incluso cuando no conviene al arriendo.

TU DIFERENCIA: tienes datos que ningún portal chileno tiene —
· Riesgo de inundación calle por calle (175 puntos críticos oficiales del Gobierno de Santiago, jul-2026, + canal San Carlos y Zanjón de la Aguada).
· Locomoción real: recorridos de micros, buses por hora en punta y paraderos, desde el GTFS de Red Movilidad; no solo el Metro.

REGLAS:
1. SIEMPRE usa las herramientas para responder con datos reales. Nunca inventes propiedades, precios ni cifras.
2. Respuestas breves: 2 a 4 frases. Español chileno cercano pero profesional, sin exagerar la jerga.
3. Al mostrar casas, destaca 2 o 3 con precio y una razón concreta (buena locomoción, bajo riesgo, precio bajo la mediana).
4. Si hablas de riesgo de lluvia o micros, menciona que el dato viene del GORE o del GTFS.
5. Si no hay resultados, sugiere relajar UN filtro concreto.
6. Nunca afirmes que una propiedad es segura en términos absolutos: el riesgo es referencial, no un certificado.
7. El mapa reacciona solo a tus herramientas; puedes decir "te las dejé en el mapa".
8. SÉ PROACTIVO: si el usuario duda entre comunas, compáralas con estadisticas_zona. Si no hay nada que calce hoy, ofrece dejar una alerta con crear_alerta y avisarle cuando aparezca.
9. Si el usuario cuenta que una calle se inunda y no la tenemos, agradécelo y regístrala con reportar_calle_inundable (el catastro oficial solo tiene 175 puntos; los vecinos saben más).
10. Advierte los riesgos aunque no te pregunten: si una propiedad está a menos de 200 m de una calle que se anega, dilo.
11. Cierra con UNA sola pregunta útil que te permita afinar la búsqueda, nunca varias.`;

export interface RespuestaChat {
  respuesta: string;
  acciones: AccionMapa[];
  tools_usadas: string[];
  modo: Proveedor;
  proveedor?: string;
}

/** USD por millón de tokens. Ajustable si cambian las tarifas. */
const PRECIOS: Record<string, { in: number; out: number }> = {
  'deepseek-v4-flash': { in: 0.14, out: 0.28 },
  'deepseek-v4-pro': { in: 0.55, out: 2.19 },
  'kimi-k2.6': { in: 0.6, out: 2.5 },
  'kimi-k3': { in: 3, out: 15 },
};
const USD_CLP = 950;

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  /** Contabilidad de consumo para saber cuánto cuesta cada conversación */
  private consumo = { mensajes: 0, llamadas: 0, tok_in: 0, tok_out: 0, tok_razonamiento: 0, usd: 0 };

  costos() {
    const c = this.consumo;
    const porMensaje = c.mensajes ? c.usd / c.mensajes : 0;
    return {
      ...c,
      usd: +c.usd.toFixed(5),
      usd_por_mensaje: +porMensaje.toFixed(5),
      clp_por_mensaje: +(porMensaje * USD_CLP).toFixed(2),
      proyeccion_usuario_40_msg_semana: {
        mensajes_mes: 160,
        usd_mes: +(porMensaje * 160).toFixed(3),
        clp_mes: Math.round(porMensaje * 160 * USD_CLP),
      },
    };
  }

  constructor(
    private readonly config: ConfigService,
    private readonly executor: ToolExecutorService,
    private readonly basico: ModoBasicoService,
    private readonly claude: ClaudeService,
  ) {}

  /** Qué proveedor está activo según las claves disponibles en .env */
  estado() {
    const pref = (this.config.get<string>('LLM_PROVIDER') || 'deepseek').toLowerCase() as Proveedor;
    const disponibles: Proveedor[] = [];
    if (this.config.get('DEEPSEEK_API_KEY')) disponibles.push('deepseek');
    if (this.config.get('MOONSHOT_API_KEY')) disponibles.push('kimi');
    if (this.config.get('ANTHROPIC_API_KEY')) disponibles.push('claude');
    const activo: Proveedor = disponibles.includes(pref) ? pref : (disponibles[0] ?? 'basico');
    return {
      activo,
      disponibles,
      etiqueta:
        activo === 'basico'
          ? 'Modo básico (sin IA)'
          : activo === 'claude'
            ? 'Claude'
            : PROVEEDORES[activo as 'deepseek' | 'kimi'].etiqueta,
    };
  }

  // ─────────── Primitivos que usan los patrones agénticos ───────────

  /** Resuelve el proveedor OpenAI-compatible activo (null si es básico/claude) */
  private resolverProveedor() {
    const { activo } = this.estado();
    if (activo === 'basico' || activo === 'claude') return null;
    const cfg = PROVEEDORES[activo as 'deepseek' | 'kimi'];
    return {
      prov: activo,
      apiKey: this.config.get<string>(cfg.envKey),
      modelo: this.config.get<string>('LLM_MODEL') || cfg.modelo,
      base: this.config.get<string>('LLM_BASE_URL') || cfg.base,
      etiqueta: cfg.etiqueta,
    };
  }

  /** Suma el consumo de una llamada al acumulador de costos */
  private contabilizar(u: any, modelo: string) {
    if (!u) return;
    const p = PRECIOS[modelo] ?? { in: 0.14, out: 0.28 };
    this.consumo.llamadas += 1;
    this.consumo.tok_in += u.prompt_tokens ?? 0;
    this.consumo.tok_out += u.completion_tokens ?? 0;
    this.consumo.tok_razonamiento += u.completion_tokens_details?.reasoning_tokens ?? 0;
    this.consumo.usd += ((u.prompt_tokens ?? 0) * p.in + (u.completion_tokens ?? 0) * p.out) / 1e6;
  }

  /** Una sola llamada al modelo, sin herramientas. Devuelve texto (o null si es modo básico). */
  async completar(
    system: string,
    user: string,
    opts: { maxTokens?: number; temperatura?: number } = {},
  ): Promise<string | null> {
    const p = this.resolverProveedor();
    if (!p) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 40_000);
    try {
      const r = await fetch(`${p.base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.apiKey}` },
        body: JSON.stringify({
          model: p.modelo,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: opts.temperatura ?? 0.2,
          max_tokens: opts.maxTokens ?? 500,
        }),
        signal: ctrl.signal,
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 150)}`);
      const data = await r.json();
      this.contabilizar(data?.usage, p.modelo);
      return (data?.choices?.[0]?.message?.content || '').trim();
    } finally {
      clearTimeout(timer);
    }
  }

  /** Igual que completar() pero parsea JSON (tolerante a ```fences```). */
  async completarJson<T = any>(
    system: string,
    user: string,
    opts: { maxTokens?: number; temperatura?: number } = {},
  ): Promise<T | null> {
    const txt = await this.completar(system, user, opts);
    if (!txt) return null;
    try {
      return JSON.parse(txt.replace(/```json|```/g, '').trim());
    } catch {
      // rescatar el primer objeto/array que aparezca
      const m = txt.match(/[[{][\s\S]*[\]}]/);
      if (m) {
        try {
          return JSON.parse(m[0]);
        } catch {
          /* nada */
        }
      }
      return null;
    }
  }

  /** El loop de tool-calling, parametrizable por prompt de sistema. Lo usan pipeline y planner. */
  async ejecutarConHerramientas(
    mensaje: string,
    historial: Array<{ rol: string; texto: string }> = [],
    system: string = SYSTEM_PROMPT,
  ): Promise<{ texto: string; acciones: AccionMapa[]; toolsUsadas: string[]; datosTools: any[] }> {
    const p = this.resolverProveedor();
    if (!p) {
      const b = this.basico.responder(mensaje);
      return { texto: b.respuesta, acciones: b.acciones, toolsUsadas: b.tools_usadas, datosTools: [] };
    }
    return this.loopHerramientas(p, mensaje, historial, system);
  }

  async chat(mensaje: string, historial: Array<{ rol: string; texto: string }> = []): Promise<RespuestaChat> {
    const { activo, etiqueta } = this.estado();
    if (activo === 'basico') return { ...this.basico.responder(mensaje), modo: 'basico' };
    if (activo === 'claude') {
      const r = await this.claude.chat(mensaje, historial);
      return { ...r, modo: 'claude', proveedor: 'Claude' };
    }
    try {
      this.consumo.mensajes += 1;
      const r = await this.loopHerramientas(
        { prov: activo, apiKey: this.config.get<string>(PROVEEDORES[activo as 'deepseek' | 'kimi'].envKey),
          modelo: this.config.get<string>('LLM_MODEL') || PROVEEDORES[activo as 'deepseek' | 'kimi'].modelo,
          base: this.config.get<string>('LLM_BASE_URL') || PROVEEDORES[activo as 'deepseek' | 'kimi'].base, etiqueta },
        mensaje, historial, SYSTEM_PROMPT,
      );
      return { respuesta: r.texto, acciones: r.acciones, tools_usadas: r.toolsUsadas, modo: activo, proveedor: etiqueta };
    } catch (e) {
      this.logger.error(`${activo} falló: ${String(e).slice(0, 200)} — cayendo a modo básico`);
      return { ...this.basico.responder(mensaje), modo: 'basico' };
    }
  }

  /** Loop agéntico en formato OpenAI (DeepSeek/Kimi). Captura texto, acciones y los datos crudos de las tools. */
  private async loopHerramientas(
    p: { prov: string; apiKey?: string; modelo: string; base: string; etiqueta: string },
    mensaje: string,
    historial: Array<{ rol: string; texto: string }>,
    system: string,
  ): Promise<{ texto: string; acciones: AccionMapa[]; toolsUsadas: string[]; datosTools: any[] }> {
    // filter(Boolean): una coma doble en el arreglo deja un hueco (undefined)
    // y el proveedor rechaza el request completo con HTTP 400.
    const tools = TOOL_DECLARATIONS.filter(Boolean).map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.input_schema },
    }));

    const messages: any[] = [
      { role: 'system', content: system },
      ...historial.slice(-8).map((m) => ({ role: m.rol === 'usuario' ? 'user' : 'assistant', content: m.texto })),
      { role: 'user', content: mensaje },
    ];

    const acciones: AccionMapa[] = [];
    const toolsUsadas: string[] = [];
    const datosTools: any[] = [];
    let texto = '';

    for (let paso = 0; paso < 4; paso++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 45_000);
      let data: any;
      try {
        const r = await fetch(`${p.base}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.apiKey}` },
          body: JSON.stringify({
            model: p.modelo, messages, tools, tool_choice: 'auto',
            temperature: 0.3, max_tokens: 900,
          }),
          signal: ctrl.signal,
        });
        if (!r.ok) throw new Error(`${p.prov} HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
        data = await r.json();
      } finally {
        clearTimeout(timer);
      }

      this.contabilizar(data?.usage, p.modelo);
      const msg = data?.choices?.[0]?.message;
      if (!msg) throw new Error('respuesta vacía del proveedor');
      texto = (msg.content || '').trim();

      const llamadas = msg.tool_calls || [];
      if (!llamadas.length) break;

      messages.push(msg);
      for (const tc of llamadas) {
        const nombre = tc.function?.name;
        let args: any = {};
        try {
          args = JSON.parse(tc.function?.arguments || '{}');
        } catch {
          /* argumentos malformados */
        }
        toolsUsadas.push(nombre);
        const res = await this.executor.ejecutarAsync(nombre, args);
        if (res.accion) acciones.push(res.accion);
        datosTools.push({ tool: nombre, args, datos: res.datos });
        messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(res.datos).slice(0, 6000) });
      }
    }

    return { texto: texto || 'No pude armar una respuesta, intenta de nuevo.', acciones, toolsUsadas, datosTools };
  }
}
