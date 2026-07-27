import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PropiedadesService, FiltrosBusqueda } from './propiedades.service';
import { ReportesService } from './reportes.service';

@Controller('propiedades')
export class PropiedadesController {
  constructor(
    private readonly propiedades: PropiedadesService,
    private readonly reportes: ReportesService,
  ) {}

  /** Calles que se anegan reportadas por la comunidad (no están en el catastro GORE) */
  @Get('reportes')
  listarReportes() {
    return this.reportes.listar();
  }

  @Post('reportes')
  crearReporte(@Body() body: { calle: string; comuna: string; causa?: string; detalle?: string }) {
    return this.reportes.crear(body);
  }

  @Post('reportes/:id/confirmar')
  confirmar(@Param('id') id: string) {
    return this.reportes.confirmar(id);
  }

  @Get()
  listar(@Query() q: Record<string, string>) {
    const filtros: FiltrosBusqueda = {
      precio_max: q.precio_max ? Number(q.precio_max) : undefined,
      precio_min: q.precio_min ? Number(q.precio_min) : undefined,
      dormitorios_min: q.dormitorios_min ? Number(q.dormitorios_min) : undefined,
      comuna: q.comuna,
      banos_min: q.banos_min ? Number(q.banos_min) : undefined,
      m2_min: q.m2_min ? Number(q.m2_min) : undefined,
      tipo: q.tipo as FiltrosBusqueda['tipo'],
      riesgo_maximo: q.riesgo_maximo as FiltrosBusqueda['riesgo_maximo'],
      locomocion_min: q.locomocion_min ? Number(q.locomocion_min) : undefined,
      amenidades: q.amenidades ? q.amenidades.split(',').filter(Boolean) : undefined,
      texto: q.texto,
    };
    return this.propiedades.buscar(filtros);
  }

  @Get('opciones')
  opciones() {
    return this.propiedades.opciones();
  }

  @Get('capas')
  capas() {
    return { ...this.propiedades.capas(), reportes: this.reportes.tramos() };
  }

  @Get(':id')
  detalle(@Param('id') id: string) {
    return this.propiedades.informeCritico(Number(id));
  }
}
