import { RuntimeBootstrap } from './src/bootstrap/RuntimeBootstrap';

const mockLogger = {
  info: (msg: string, meta?: Record<string, unknown>) => console.log(`[INFO] ${msg}`, meta ? JSON.stringify(meta) : ''),
  error: (msg: string, meta?: Record<string, unknown>) => console.error(`[ERROR] ${msg}`, meta ? JSON.stringify(meta) : ''),
  warn: (msg: string, meta?: Record<string, unknown>) => console.warn(`[WARN] ${msg}`, meta ? JSON.stringify(meta) : ''),
  debug: (msg: string, meta?: Record<string, unknown>) => console.log(`[DEBUG] ${msg}`, meta ? JSON.stringify(meta) : ''),
  child: (_bindings: Record<string, unknown>) => mockLogger,
};

async function main() {
  console.log('=== Stage 1 Demo: Find Dentists in Dallas ===\n');

  const bootstrap = new RuntimeBootstrap({ logger: mockLogger });

  console.log('Starting AgencyForge Runtime...\n');
  await bootstrap.start();

  console.log('\nExecuting goal: "Find dentists in Dallas"\n');
  const result = await bootstrap.executeGoal('Find dentists in Dallas');

  console.log('\n=== Result ===');
  console.log(JSON.stringify(result, null, 2));

  console.log('\nShutting down...');
  await bootstrap.stop();

  console.log('\n=== Demo Complete ===');
}

main().catch(console.error);