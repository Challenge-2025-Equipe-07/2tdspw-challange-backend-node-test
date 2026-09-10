import { NestFactory } from '@nestjs/core';
import { StandardSchemaValidationPipe } from '@nestjs/common';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(
    new StandardSchemaValidationPipe({
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3003);
}
void bootstrap();
