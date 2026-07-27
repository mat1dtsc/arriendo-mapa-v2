import { Module } from '@nestjs/common';
import { PropiedadesController } from './propiedades.controller';
import { PropiedadesService } from './propiedades.service';
import { ReportesService } from './reportes.service';

@Module({
  controllers: [PropiedadesController],
  providers: [PropiedadesService, ReportesService],
  exports: [PropiedadesService, ReportesService],
})
export class PropiedadesModule {}
