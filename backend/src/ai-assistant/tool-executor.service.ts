import { Injectable } from '@nestjs/common';
import { PropiedadesService, FiltrosBusqueda } from '../propiedades/propiedades.service';

export interface AccionMapa {
  tipo: 'filtrar' | 'volar' | 'centrar';
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
  constructor(private readonly propiedades: PropiedadesService) {}

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
      default:
        return { datos: { error: `Tool desconocida: ${nombre}` } };
    }
  }
}
