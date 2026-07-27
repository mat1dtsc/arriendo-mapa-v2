import { Body, Controller, Get, Post } from '@nestjs/common';
import { LlmService } from './llm.service';
import { ChatRequestDto } from './dto/chat-request.dto';

@Controller('ai')
export class AiAssistantController {
  constructor(private readonly llm: LlmService) {}

  /** Qué motor está activo (para mostrarlo en la UI) */
  @Get('estado')
  estado() {
    return this.llm.estado();
  }

  /** Cuánto va costando el uso del modelo */
  @Get('costos')
  costos() {
    return this.llm.costos();
  }

  @Post('chat')
  async chat(@Body() body: ChatRequestDto) {
    return this.llm.chat(body.mensaje, body.historial ?? []);
  }
}
