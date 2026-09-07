import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import serverlessExpress from '@codegenie/serverless-express';
import { Callback, Context, Handler } from 'aws-lambda';
import { AppModule } from './app/app.module';

let cachedServer: Handler;

async function bootstrapServer(): Promise<Handler> {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: [/abhijeetkharkar\.com$/, /localhost/],
  });
  app.setGlobalPrefix('cinema-manager');
  await app.init();
  const expressApp = app.getHttpAdapter().getInstance();
  return serverlessExpress({ app: expressApp });
}

export const handler: Handler = async (
  event: any,
  context: Context,
  callback: Callback
) => {
  if (!cachedServer) {
    cachedServer = await bootstrapServer();
  }
  return cachedServer(event, context, callback);
};

import * as fs from 'fs';
import * as path from 'path';

function loadLocalEnv() {
  const envPaths = [
    path.resolve(process.cwd(), 'apps/cinema-manager-api/.env'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '.env'),
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf-8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx !== -1) {
              const key = trimmed.substring(0, eqIdx).trim();
              const val = trimmed.substring(eqIdx + 1).trim().replace(/(^['"]|['"]$)/g, '');
              if (!process.env[key]) {
                process.env[key] = val;
              }
            }
          }
        }
        break;
      } catch (e) {
        // ignore
      }
    }
  }
}

if (!process.env.AWS_LAMBDA_FUNCTION_NAME && require.main === module) {
  loadLocalEnv();
  async function bootstrapLocal() {
    const app = await NestFactory.create(AppModule);
    app.enableCors();
    app.setGlobalPrefix('cinema-manager');
    const port = process.env.PORT || 3333;
    await app.listen(port);
    Logger.log(`🚀 Application is running on: http://localhost:${port}/cinema-manager`);
  }
  bootstrapLocal();
}

