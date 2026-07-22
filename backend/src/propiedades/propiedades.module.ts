import { Module } from '@nestjs/common';
import { PropiedadesController } from './propiedades.controller';
import { PropiedadesService } from './propiedades.service';

@Module({
  controllers: [PropiedadesController],
  providers: [PropiedadesService],
  exports: [PropiedadesService],
})
export class PropiedadesModule {}
