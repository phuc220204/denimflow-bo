import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { setupApp } from './app.setup.js';

const app = await NestFactory.create(AppModule);
const config = setupApp(app);
await app.listen(config.PORT);
