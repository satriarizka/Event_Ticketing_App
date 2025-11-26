import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import * as express from 'express';
import { writeFileSync } from 'fs';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
    // Create the NestJS application with Express
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    // Serve static files
    app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

    // Enable CORS
    app.enableCors();

    // Global validation pipe
    app.useGlobalPipes(new ValidationPipe({ transform: true }));

    // Prefix for API
    app.setGlobalPrefix('api');

    // Swagger setup
    const config = new DocumentBuilder()
        .setTitle('Event Ticketing API')
        .setDescription('API for event ticketing system')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);

    // Get the underlying Express instance
    const expressApp = app.getHttpAdapter().getInstance();

    // Add the custom route to serve the Swagger JSON
    expressApp.get('/api-json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(document);
    });

    writeFileSync('./swagger.json', JSON.stringify(document, null, 2));
    console.log('Swagger JSON saved to swagger.json');

    await app.listen(3000);
    console.log('Application is running on: http://localhost:3000/api');
    console.log('Swagger JSON available at: http://localhost:3000/api-json');
}
bootstrap();
