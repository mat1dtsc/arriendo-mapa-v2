import { Injectable } from '@nestjs/common';
import { PropiedadesService } from '../propiedades/propiedades.service';
import { ToolExecutorService, AccionMapa } from './tool-executor.service';

/**
 * Modo básico (sin ANTHROPIC_API_KEY): entiende la pregunta con reglas simples
 * y ejecuta las MISMAS herramientas que usa Claude. Cuando agregas la clave,
 * el sistema se cambia solo al copiloto inteligente.
 */
@Injectable()
export class ModoBasicoService {
  constructor(
    private readonly propiedades: PropiedadesService,
    private readonly executor: ToolExecutorService,
  ) {}

  private norm(s: string): string {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private comunas(): string[] {
    return Object.keys((this.propiedades as any)['datos'].meta.medianas_pxm ?? {});
  }

  private fmt(n: number): string {
    return '$' + n.toLocaleString('es-CL');
  }

  responder(mensaje: string): { respuesta: string; acciones: AccionMapa[]; tools_usadas: string[]; modo: 'basico' } {
    const t = this.norm(mensaje);
    const acciones: AccionMapa[] = [];
    const pie = '\n\n🔧 Modo básico (sin IA). Agrega tu ANTHROPIC_API_KEY en backend/.env para el copiloto inteligente.';

    // ── ¿Informe de una casa por id? ──
    const mId = t.match(/(?:casa|id|informe|detalle|ficha)\D{0,12}(\d{1,3})/);
    if (mId) {
      const res = this.executor.ejecutar('informe_critico', { id: Number(mId[1]) });
      if (res.accion) acciones.push(res.accion);
      const d: any = res.datos;
      if (d.error) return { respuesta: d.error + pie, acciones, tools_usadas: ['informe_critico'], modo: 'basico' };
      const r = d.riesgo_invierno, l = d.locomocion;
      const respuesta =
        `📋 ${d.sector}, ${d.comuna} — ${this.fmt(d.precio)}/mes · ${d.dorm}D/${d.banos}B · ${d.m2} m²\n` +
        `💧 Riesgo invierno: ${r.nivel.toUpperCase()} (punto crítico a ${r.punto_critico_mas_cercano.distancia_m} m: ${r.punto_critico_mas_cercano.sector} — ${r.punto_critico_mas_cercano.causa.toLowerCase()})` +
        (r.canal_cercano ? ` · ${r.canal_cercano.nombre} a ${r.canal_cercano.distancia_m} m` : '') + `\n` +
        `🚌 Locomoción ${l.score ?? 's/d'}/100: ${l.n_recorridos ?? '—'} recorridos, ${l.buses_hora_punta ?? '—'} buses/h punta, Metro ${l.metro_mas_cercano ?? '—'} a ${l.metro_distancia_m ?? '—'} m\n` +
        `💰 ${d.precio_por_m2 ? this.fmt(d.precio_por_m2) + '/m²' : 's/d'} (mediana ${d.comuna}: ${d.mediana_comuna_m2 ? this.fmt(d.mediana_comuna_m2) + '/m²' : 's/d'})\n` +
        `🔗 ${d.link}\nTe llevé a la casa en el mapa.`;
      return { respuesta: respuesta + pie, acciones, tools_usadas: ['informe_critico'], modo: 'basico' };
    }

    // ── Comuna mencionada ──
    const comuna = this.comunas().find((c) => t.includes(this.norm(c)));

    // ── ¿Estadísticas de zona? ──
    const esEstadistica = /(como es|cómo es|estadistic|conviene|informacion de|datos de|resumen de)/.test(t);
    const esBusqueda = /(casa|depto|arriendo|dormitorio|busca|muestra|filtra|bajo|hasta|menos de|sobre|barat|3d|2d|4d|\d)/.test(t);
    if (comuna && esEstadistica && !esBusqueda) {
      const res = this.executor.ejecutar('estadisticas_zona', { comuna });
      if (res.accion) acciones.push(res.accion);
      const d: any = res.datos;
      const riesgo = Object.entries(d.distribucion_riesgo ?? {}).map(([k, v]) => `${v} ${k}`).join(', ');
      const respuesta =
        `📊 ${d.comuna}: ${d.total} avisos · precio mediano ${this.fmt(d.precio_mediano)} · ${d.mediana_pesos_m2 ? this.fmt(d.mediana_pesos_m2) + '/m²' : ''}\n` +
        `💧 Riesgo de los avisos: ${riesgo} · ${d.puntos_criticos_en_comuna} puntos críticos de lluvia en la comuna\n` +
        `🚌 Recorridos frecuentes: ${(d.recorridos_frecuentes ?? []).join(', ') || 's/d'}\nCentré el mapa en la comuna.`;
      return { respuesta: respuesta + pie, acciones, tools_usadas: ['estadisticas_zona'], modo: 'basico' };
    }

    // ── Búsqueda de casas ──
    const filtros: any = {};
    if (comuna) filtros.comuna = comuna;

    const mDorm = t.match(/(\d)\s*(?:d\b|dorm|habitacion|pieza)/);
    if (mDorm) filtros.dormitorios_min = Number(mDorm[1]);

    const nums = [...t.matchAll(/(\d[\d.,]*)\s*(millon|millones|mil|m\b|lucas)?/g)]
      .map((m) => {
        let n = Number(m[1].replace(/[.,]/g, ''));
        if (/millon/.test(m[2] ?? '')) n *= 1_000_000;
        else if (/(mil|lucas|^m$)/.test(m[2] ?? '')) n *= 1000;
        else if (n < 1000) n *= 1000; // "bajo 500" = 500 mil
        return n;
      })
      .filter((n) => n >= 100_000 && n <= 5_000_000 && (!filtros.dormitorios_min || n !== filtros.dormitorios_min * 1000));
    if (nums.length && /(bajo|hasta|menos|max|tope|presupuesto)/.test(t)) filtros.precio_max = Math.max(...nums);
    else if (nums.length && /(sobre|desde|mas de|minimo)/.test(t)) filtros.precio_min = Math.min(...nums);
    else if (nums.length) filtros.precio_max = Math.max(...nums);

    if (/(sin riesgo|no se inund|que no se inund|seguras?|secas?|sin inundacion)/.test(t)) filtros.riesgo_maximo = 'bajo';
    if (/(bien conectad|buena locomocion|con micros|cerca del metro|conectividad)/.test(t)) filtros.locomocion_min = 55;
    if (/(barat)/.test(t) && !filtros.precio_max) filtros.precio_max = 450_000;

    if (Object.keys(filtros).length === 0) {
      return {
        respuesta:
          'Puedo ayudarte así (modo básico):\n' +
          '• "3 dormitorios bajo 500 en Puente Alto sin riesgo"\n' +
          '• "casas baratas bien conectadas en La Florida"\n' +
          '• "¿cómo es La Cisterna?"\n' +
          '• "informe de la casa 2"' + pie,
        acciones,
        tools_usadas: [],
        modo: 'basico',
      };
    }

    const res = this.executor.ejecutar('buscar_casas', filtros);
    if (res.accion) acciones.push(res.accion);
    const d: any = res.datos;
    if (!d.total) {
      return {
        respuesta: `No encontré casas con esos filtros 😕 Prueba subiendo el presupuesto o quitando alguna condición.` + pie,
        acciones: [],
        tools_usadas: ['buscar_casas'],
        modo: 'basico',
      };
    }
    const top = d.casas.slice(0, 3)
      .map((c: any) => `• #${c.id} ${this.fmt(c.precio)} — ${c.sector}, ${c.comuna} (${c.dorm}D, 💧${c.riesgo}, 🚌${c.locomocion ?? 's/d'})`)
      .join('\n');
    const filtrosTxt = [
      filtros.comuna, filtros.dormitorios_min && `${filtros.dormitorios_min}+ dorm`,
      filtros.precio_max && `hasta ${this.fmt(filtros.precio_max)}`,
      filtros.riesgo_maximo && 'sin riesgo de inundación', filtros.locomocion_min && 'bien conectadas',
    ].filter(Boolean).join(' · ');
    return {
      respuesta: `🔎 ${d.total} casas (${filtrosTxt}). Destacadas:\n${top}\nTe las dejé filtradas en el mapa — pide "informe de la casa N" para el detalle.` + pie,
      acciones,
      tools_usadas: ['buscar_casas'],
      modo: 'basico',
    };
  }
}
