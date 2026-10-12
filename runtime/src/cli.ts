import { createRuntime, RuntimeBootstrap } from './bootstrap/RuntimeBootstrap';
import { ConsoleLogger } from './utils/ConsoleLogger';
import { Configuration } from './config';

async function main(): Promise<void> {
  const config = new Configuration({
    logging: { level: 'INFO', format: 'pretty' }
  });
  const logger = new ConsoleLogger(config);
  
  logger.info('AgencyForge Runtime CLI v1.0.0');
  logger.info('Starting runtime...');

  let bootstrap: RuntimeBootstrap | undefined;
  
  try {
    bootstrap = createRuntime({ logger, enableConsoleLogging: true });
    const result = await bootstrap.start();
    
    if (result.success) {
      logger.info('Runtime started successfully');
      logger.info(`Health checks: ${result.subsystems.length} subsystems registered`);
      logger.info(`Startup duration: ${result.durationMs}ms`);
      logger.info('RuntimeBridge: HTTP server listening on port 3001');
      logger.info('Dashboard SSE: http://localhost:3001/api/runtime/stream');
      logger.info('Snapshot API: http://localhost:3001/api/runtime/snapshot');
      logger.info('Press Ctrl+C to shut down');
    } else {
      logger.error('Runtime startup failed', { errors: result.errors });
      process.exit(1);
    }
  } catch (error) {
    logger.error('Runtime startup threw error', { error: String(error) });
    process.exit(1);
  }

  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down...');
    if (bootstrap) {
      await bootstrap.stop();
    }
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down...');
    if (bootstrap) {
      await bootstrap.stop();
    }
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});