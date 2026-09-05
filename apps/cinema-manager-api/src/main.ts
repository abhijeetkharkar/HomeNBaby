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

if (!process.env.AWS_LAMBDA_FUNCTION_NAME && require.main === module) {
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
