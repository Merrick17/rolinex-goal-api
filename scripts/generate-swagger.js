const path = require('path');

process.env.DATABASE_URL = 'postgresql://localhost:5432/prolinexgoal';
process.env.DIRECT_URL = 'postgresql://localhost:5432/prolinexgoal';
process.env.NODE_ENV = 'development';

// Patch Prisma's $connect so no real database connection is attempted for swagger generation.
const { PrismaClient } = require('../src/generated/prisma/client');
PrismaClient.prototype.$connect = async function () { return; };
PrismaClient.prototype.$on = function () { return; };
PrismaClient.prototype.enableShutdownHooks = function () { return; };

const { NestFactory } = require('@nestjs/core');
const { DocumentBuilder, SwaggerModule } = require('@nestjs/swagger');
const fs = require('fs');

async function main() {
  const { AppModule } = require('../dist/src/app.module');
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('ProlinexGoal API')
    .setDescription('Real-time crash/multiplier game backend API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const outputPath = path.join(process.cwd(), 'swagger.json');
  fs.writeFileSync(outputPath, JSON.stringify(document, null, 2));

  await app.close();
  console.log(`Swagger JSON generated at ${outputPath}`);
}

main().catch((err) => {
  console.error('Swagger generation failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
