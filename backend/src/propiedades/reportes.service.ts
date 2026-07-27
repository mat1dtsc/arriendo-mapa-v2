import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export interface Reporte {
  id: string;
  calle: string;
  comuna: string;
  causa: string;
  detalle?: string;
  tramos: number[][][]; // [[ [lon,lat], ... ], ...]
  fuente: 'comunidad';
  creado: string;
  confirmaciones: number;
}

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/**
 * Reportes de la comunidad: calles que se anegan y NO están en el catastro
 * oficial del GORE. Se guardan aparte y se muestran con estilo distinto,
 * porque su nivel de evidencia es otro.
 */
@Injectable()
export class ReportesService {
  private readonly logger = new Logger(ReportesService.name);
  private readonly ruta = join(process.cwd(), 'data', 'reportes.json');
  private reportes: Reporte[] = [];

  constructor() {
    if (existsSync(this.ruta)) {
      try {
        this.reportes = JSON.parse(readFileSync(this.ruta, 'utf8'));
      } catch {
        this.reportes = [];
      }
    }
  }

  private guardar() {
    try {
      writeFileSync(this.ruta, JSON.stringify(this.reportes, null, 1));
    } catch (e) {
      this.logger.warn(`no pude guardar reportes: ${e}`);
    }
  }

  listar() {
    return this.reportes;
  }

  /** Tramos listos para el mapa */
  tramos() {
    return this.reportes.flatMap((r) =>
      r.tramos.map((c) => ({
        c,
        g: 'reporte',
        s: r.detalle || 'Reportado por la comunidad',
        k: r.comuna,
        n: r.calle,
        id: r.id,
        conf: r.confirmaciones,
      })),
    );
  }

  private escapar(s: string) {
    return s.replace(/["\\]/g, '\\$&');
  }

  /** Busca la geometría de la calle en OpenStreetMap dentro de la comuna */
  private async geometria(calle: string, comuna: string): Promise<number[][][]> {
    // Sin filtro de admin_level: es más lento de resolver en Overpass y provoca 504.
    const q = `[out:json][timeout:40];
area["name"="${this.escapar(comuna)}"]["boundary"="administrative"]->.a;
way(area.a)["highway"]["name"~"${this.escapar(calle)}",i];
out geom;`;
    // Cada endpoint se prueba dos veces: Overpass devuelve 504 de forma intermitente.
    const intentos = [...ENDPOINTS, ...ENDPOINTS];
    for (const ep of intentos) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 35_000);
        const r = await fetch(ep, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            // Overpass responde 406/429 si no se identifica al cliente.
            'User-Agent': 'ArriendoMapaChile/2.0 (github.com/mat1dtsc/arriendo-mapa-v2)',
          },
          body: new URLSearchParams({ data: q }),
          signal: ctrl.signal,
        });
        clearTimeout(t);
        if (!r.ok) continue;
        const data: any = await r.json();
        const tramos: number[][][] = [];
        for (const w of data.elements ?? []) {
          const g = (w.geometry ?? []).map((p: any) => [
            Math.round(p.lon * 1e5) / 1e5,
            Math.round(p.lat * 1e5) / 1e5,
          ]);
          if (g.length > 1) tramos.push(g);
        }
        if (tramos.length) return tramos.slice(0, 40);
      } catch (e) {
        this.logger.warn(`overpass ${ep.split('/')[2]}: ${String(e).slice(0, 60)}`);
      }
    }
    return [];
  }

  async crear(input: { calle: string; comuna: string; causa?: string; detalle?: string }) {
    const calle = (input.calle || '').trim();
    const comuna = (input.comuna || '').trim();
    if (!calle || !comuna) {
      return { ok: false, error: 'Falta la calle o la comuna' };
    }

    // ¿ya está reportada?
    const existe = this.reportes.find(
      (r) => r.calle.toLowerCase() === calle.toLowerCase() && r.comuna.toLowerCase() === comuna.toLowerCase(),
    );
    if (existe) {
      existe.confirmaciones += 1;
      this.guardar();
      return { ok: true, yaExistia: true, reporte: existe, mensaje: `Ya estaba reportada; sumé tu confirmación (${existe.confirmaciones}).` };
    }

    const tramos = await this.geometria(calle, comuna);
    if (!tramos.length) {
      return {
        ok: false,
        error: `No encontré "${calle}" en ${comuna} dentro de OpenStreetMap. Revisa el nombre exacto o prueba con la calle principal más cercana.`,
      };
    }

    const reporte: Reporte = {
      id: 'r_' + Date.now().toString(36),
      calle,
      comuna,
      causa: input.causa || 'Anegamiento reportado por vecinos',
      detalle: input.detalle,
      tramos,
      fuente: 'comunidad',
      creado: new Date().toISOString(),
      confirmaciones: 1,
    };
    this.reportes.push(reporte);
    this.guardar();
    this.logger.log(`nuevo reporte: ${calle}, ${comuna} (${tramos.length} tramos)`);
    return { ok: true, reporte, mensaje: `Listo: ${calle} quedó marcada en ${comuna} (${tramos.length} tramos).` };
  }

  confirmar(id: string) {
    const r = this.reportes.find((x) => x.id === id);
    if (!r) return { ok: false, error: 'No existe ese reporte' };
    r.confirmaciones += 1;
    this.guardar();
    return { ok: true, confirmaciones: r.confirmaciones };
  }
}
