import { Injectable } from '@nestjs/common';
import { PropiedadesService, FiltrosBusqueda } from '../propiedades/propiedades.service';
import { ReportesService } from '../propiedades/reportes.service';

export interface AccionMapa {
  tipo: 'filtrar' | 'volar' | 'centrar' | 'alerta' | 'reporte';
  alerta?: any;
  reporte?: any;
  ids?: number[];
  lat?: number;
  lon?: number;
  zoom?: number;
  id?: number;
}

export interface ResultadoTool {
  datos: unknown;        // lo que ve el LLM
  accion?: AccionMapa;   // lo que ejecuta el mapa
}

/** Calcado del tool-executor.service.ts de CotizadorIA: un switch que ejecuta la tool y arma la acción. */
@Injectable()
export class ToolExecutorService {
  /** Alertas en memoria (F2: pasan a Supabase con el perfil del usuario) */
  private alertas: any[] = [];

  constructor(
    private readonly propiedades: PropiedadesService,
    private readonly reportes: ReportesService,
  ) {}

  listarAlertas() {
    return this.alertas;
  }

  /** Tools que necesitan red (geocodificación) */
  async ejecutarAsync(nombre: string, input: any): Promise<ResultadoTool> {
    if (nombre === 'reportar_calle_inundable') {
      const r = await this.reportes.crear({
        calle: input.calle, comuna: input.comuna, causa: input.causa, detalle: input.detalle,
      });
      return { datos: r, accion: r.ok ? ({ tipo: 'reporte', reporte: (r as any).reporte } as any) : undefined };
    }
    return this.ejecutar(nombre, input);
  }

  ejecutar(nombre: string, input: any): ResultadoTool {
    switch (nombre) {
      case 'buscar_casas': {
        const res = this.propiedades.buscar(input as FiltrosBusqueda);
        const top = res.casas.slice(0, 12);
        return {
          datos: { total: res.total, mostrando: top.length, casas: top },
          accion: { tipo: 'filtrar', ids: res.casas.map((c) => c.id) },
        };
      }
      case 'informe_critico': {
        const info = this.propiedades.informeCritico(input.id);
        if (!info) return { datos: { error: `No existe la casa id=${input.id}` } };
        return {
          datos: info,
          accion: { tipo: 'volar', lat: info.lat, lon: info.lon, zoom: 16, id: info.id },
        };
      }
      case 'estadisticas_zona': {
        const est: any = this.propiedades.estadisticasZona(input.comuna);
        const accion: AccionMapa | undefined = est.centro
          ? { tipo: 'centrar', lat: est.centro.lat, lon: est.centro.lon, zoom: 13 }
          : undefined;
        return { datos: est, accion };
      }
      case 'crear_alerta': {
        const alerta = {
          id: 'a_' + Date.now().toString(36),
          nombre: input.nombre,
          filtros: input.filtros ?? {},
          email: input.email ?? null,
          creada: new Date().toISOString(),
          coincidencias_hoy: this.propiedades.buscar(input.filtros ?? {}).total,
        };
        this.alertas.push(alerta);
        return { datos: { guardada: true, ...alerta }, accion: { tipo: 'alerta', alerta } as any };
      }
      default:
        return { datos: { error: `Tool desconocida: ${nombre}` } };
    }
  }
}
