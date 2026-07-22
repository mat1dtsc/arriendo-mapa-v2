import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors();
  await app.listen(process.env.PORT ?? 3000);
  console.log(`🏠 ArriendoMapa API corriendo en http://localhost:${process.env.PORT ?? 3000}/api`);
}
bootstrap();
