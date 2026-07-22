export class ChatRequestDto {
  mensaje: string;
  historial?: Array<{ rol: 'usuario' | 'asistente'; texto: string }>;
}
