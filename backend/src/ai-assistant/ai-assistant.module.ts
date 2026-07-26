import { Module } from '@nestjs/common';
import { PropiedadesModule } from '../propiedades/propiedades.module';
import { AiAssistantController } from './ai-assistant.controller';
import { LlmService } from './llm.service';
import { ClaudeService } from './claude.service';
import { ToolExecutorService } from './tool-executor.service';
import { ModoBasicoService } from './modo-basico.service';

@Module({
  imports: [PropiedadesModule],
  controllers: [AiAssistantController],
  providers: [LlmService, ClaudeService, ToolExecutorService, ModoBasicoService],
})
export class AiAssistantModule {}
