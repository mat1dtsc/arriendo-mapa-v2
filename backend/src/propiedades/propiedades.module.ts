import { Module } from '@nestjs/common';
import { PropiedadesController } from './propiedades.controller';
import { PropiedadesService } from './propiedades.service';
import { ReportesService } from './reportes.service';
import { AgentesService } from './agentes.service';

@Module({
  controllers: [PropiedadesController],
  providers: [PropiedadesService, ReportesService, AgentesService],
  exports: [PropiedadesService, ReportesService, AgentesService],
})
export class PropiedadesModule {}
