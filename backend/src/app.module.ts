import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PropiedadesModule } from './propiedades/propiedades.module';
import { AiAssistantModule } from './ai-assistant/ai-assistant.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PropiedadesModule, AiAssistantModule],
})
export class AppModule {}
