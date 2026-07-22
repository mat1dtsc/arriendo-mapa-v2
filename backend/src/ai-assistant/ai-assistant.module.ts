import { Module } from '@nestjs/common';
import { PropiedadesModule } from '../propiedades/propiedades.module';
import { AiAssistantController } from './ai-assistant.controller';
import { ClaudeService } from './claude.service';
import { ToolExecutorService } from './tool-executor.service';

@Module({
  imports: [PropiedadesModule],
  controllers: [AiAssistantController],
  providers: [ClaudeService, ToolExecutorService],
})
export class AiAssistantModule {}
