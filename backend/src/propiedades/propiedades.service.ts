import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

export type NivelRiesgo = 'bajo' | 'atento' | 'medio' | 'alto';

export interface FiltrosBusqueda {
  precio_max?: number;
  precio_min?: number;
  dormitorios_min?: number;
  comuna?: string;
  riesgo_maximo?: NivelRiesgo;
  locomocion_min?: number;
  texto?: string;
}

const ORDEN_RIESGO: Record<NivelRiesgo, number> = { bajo: 0, atento: 1, medio: 2, alto: 3 };

@Injectable()
export class PropiedadesService {
  private datos: any;

  constructor() {
    const ruta = join(process.cwd(), 'data', 'datos.json');
    this.datos = JSON.parse(readFileSync(ruta, 'utf8'));
  }

  /** Score de locomoción 0-100: Metro + micros + frecuencia + paradero (misma fórmula del MVP) */
  scoreLocomocion(t: any): number | null {
    if (!t || t.metro_m == null) return null;
    let s = 0;
    const m = t.metro_m;
    s += m <= 600 ? 35 : m <= 1000 ? 30 : m <= 1600 ? 22 : m <= 2600 ? 12 : 4;
    s += Math.min(30, (t.n_recorridos || 0) * 2.5);
    s += Math.min(20, (t.buses_hora_punta || 0) / 6);
    const pm = t.paradero_min_m;
    s += pm == null ? 0 : pm <= 250 ? 15 : pm <= 400 ? 10 : pm <= 600 ? 5 : 0;
    return Math.round(Math.min(100, s));
  }

  private compacta(c: any) {
    return {
      id: c.id,
      precio: c.precio,
      dorm: c.dorm,
      banos: c.banos,
      m2: c.m2,
      sector: c.sector,
      comuna: c.comuna,
      lat: c.lat,
      lon: c.lon,
      riesgo: c.r.nivel,
      locomocion: this.scoreLocomocion(c.t),
      dev_precio_pct: c.dev,
    };
  }

  buscar(f: FiltrosBusqueda) {
    const q = (f.texto || '').toLowerCase();
    const res = this.datos.casas.filter((c: any) => {
      if (f.precio_max && c.precio > f.precio_max) return false;
      if (f.precio_min && c.precio < f.precio_min) return false;
      if (f.dormitorios_min && c.dorm < f.dormitorios_min) return false;
      if (f.comuna && c.comuna.toLowerCase() !== f.comuna.toLowerCase()) return false;
      if (f.riesgo_maximo && ORDEN_RIESGO[c.r.nivel as NivelRiesgo] > ORDEN_RIESGO[f.riesgo_maximo]) return false;
      if (f.locomocion_min && (this.scoreLocomocion(c.t) || 0) < f.locomocion_min) return false;
      if (q && !`${c.sector} ${c.comuna} ${c.nota}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return { total: res.length, casas: res.map((c: any) => this.compacta(c)) };
  }

  informeCritico(id: number) {
    const c = this.datos.casas.find((x: any) => x.id === id);
    if (!c) return null;
    return {
      ...this.compacta(c),
      corredora: c.corr,
      estado: c.estado,
      nota: c.nota,
      link: c.link,
      fotos: c.fotos,
      amenidades: c.amen,
      precio_por_m2: c.pxm,
      mediana_comuna_m2: this.datos.meta.medianas_pxm[c.comuna] ?? null,
      riesgo_invierno: {
        nivel: c.r.nivel,
        punto_critico_mas_cercano: {
          sector: c.r.pc_sector,
          causa: c.r.pc_causa,
          distancia_m: c.r.pc_m,
          ubicacion_aproximada: c.r.pc_aprox,
        },
        canal_cercano: c.r.canal ? { nombre: c.r.canal, distancia_m: c.r.canal_m } : null,
        fuente: this.datos.meta.fuente_pc,
      },
      locomocion: {
        score: this.scoreLocomocion(c.t),
        recorridos: c.t?.recorridos ?? [],
        n_recorridos: c.t?.n_recorridos ?? null,
        buses_hora_punta: c.t?.buses_hora_punta ?? null,
        paradero_mas_cercano_m: c.t?.paradero_min_m ?? null,
        metro_mas_cercano: c.t?.metro_est ?? null,
        metro_distancia_m: c.t?.metro_m ?? null,
        fuente: this.datos.meta.fuente_gtfs,
      },
    };
  }

  estadisticasZona(comuna: string) {
    const casas = this.datos.casas.filter(
      (c: any) => c.comuna.toLowerCase() === comuna.toLowerCase(),
    );
    if (!casas.length) return { comuna, total: 0, mensaje: 'Sin avisos en esa comuna' };
    const precios = casas.map((c: any) => c.precio).sort((a: number, b: number) => a - b);
    const riesgo: Record<string, number> = {};
    const recorridos: Record<string, number> = {};
    for (const c of casas) {
      riesgo[c.r.nivel] = (riesgo[c.r.nivel] || 0) + 1;
      for (const r of c.t?.recorridos ?? []) recorridos[r] = (recorridos[r] || 0) + 1;
    }
    const centro = {
      lat: casas.reduce((s: number, c: any) => s + c.lat, 0) / casas.length,
      lon: casas.reduce((s: number, c: any) => s + c.lon, 0) / casas.length,
    };
    return {
      comuna: casas[0].comuna,
      total: casas.length,
      precio_mediano: precios[Math.floor(precios.length / 2)],
      mediana_pesos_m2: this.datos.meta.medianas_pxm[casas[0].comuna] ?? null,
      distribucion_riesgo: riesgo,
      recorridos_frecuentes: Object.entries(recorridos)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([r]) => r),
      puntos_criticos_en_comuna: this.datos.pc.filter(
        (p: any) => p.comuna.toLowerCase() === comuna.toLowerCase(),
      ).length,
      centro,
    };
  }

  /** Capas para el mapa: puntos críticos, canales, metro, paraderos */
  capas() {
    const { pc, canales, metro, lineas, paraderos, meta } = this.datos;
    return { pc, canales, metro, lineas, paraderos, meta };
  }
}
