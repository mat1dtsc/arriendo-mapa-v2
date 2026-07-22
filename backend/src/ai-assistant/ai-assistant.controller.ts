import { Body, Controller, Post } from '@nestjs/common';
import { ClaudeService } from './claude.service';
import { ChatRequestDto } from './dto/chat-request.dto';

@Controller('ai')
export class AiAssistantController {
  constructor(private readonly claude: ClaudeService) {}

  @Post('chat')
  async chat(@Body() body: ChatRequestDto) {
    return this.claude.chat(body.mensaje, body.historial ?? []);
  }
}
