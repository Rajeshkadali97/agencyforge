// Simple HTTP health endpoint exposing HealthManager status
import http from 'http';
import { HealthManager } from './HealthManager';
import { ILogger } from '../interfaces';

export class HealthServer {
  private server: http.Server;
  private port: number;

  constructor(private healthManager: HealthManager, private logger: ILogger, port = 3002) {
    this.port = port;
    this.server = http.createServer(this.requestListener.bind(this));
  }

  private requestListener(req: http.IncomingMessage, res: http.ServerResponse) {
    this._handle(req, res).catch((err) => {
      this.logger.error('HealthServer: Unhandled request error', { error: err instanceof Error ? err.message : String(err) });
      if (!res.headersSent) {
        res.writeHead(500);
        res.end('Internal error');
      }
    });
  }

  private async _handle(req: http.IncomingMessage, res: http.ServerResponse) {
    if (req.method === 'GET' && req.url === '/health') {
      try {
        const result = await this.healthManager.checkAll();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        this.logger.error('HealthServer: health check error', { error: err instanceof Error ? err.message : String(err) });
        if (!res.headersSent) {
          res.writeHead(500);
          res.end('Health check failed');
        }
      }
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  }

  start() {
    this.server.listen(this.port, '127.0.0.1', () => {
      this.logger.info('HealthServer listening', { port: this.port, host: '127.0.0.1' });
    });
  }

  async stop() {
    return new Promise<void>((resolve) => {
      this.server.close(() => resolve());
    });
  }
}
