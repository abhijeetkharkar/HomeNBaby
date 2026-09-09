import * as http from 'http';
import * as url from 'url';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';

/**
 * Local lightweight HTTP server running on 127.0.0.1:3334
 * Allows the Cinema Manager Web UI to trigger native local video playback
 * and verify local device identity and watched paths.
 */
export class LocalServer {
  private server?: http.Server;
  private readonly port: number = 3334;
  private readonly host: string = '127.0.0.1';

  constructor(
    private readonly getWatchPaths?: () => string[],
    private readonly agentId?: string,
    private readonly agentName?: string
  ) {}

  start(): void {
    try {
      this.server = http.createServer((req, res) => {
        const origin = req.headers.origin as string;
        const allowedOrigins = [
          'https://cinema.abhijeetkharkar.com',
          'http://localhost:4200',
          'http://127.0.0.1:4200',
        ];

        if (origin && (allowedOrigins.includes(origin) || origin.endsWith('.abhijeetkharkar.com'))) {
          res.setHeader('Access-Control-Allow-Origin', origin);
        } else {
          res.setHeader('Access-Control-Allow-Origin', 'https://cinema.abhijeetkharkar.com');
        }

        // Private Network Access (PNA) header required by Chromium browsers for public -> loopback requests
        res.setHeader('Access-Control-Allow-Private-Network', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Access-Control-Request-Private-Network');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        const parsedUrl = url.parse(req.url || '', true);

        // /health or /device-info: Returns device identity and authorized watch paths
        if (parsedUrl.pathname === '/health' || parsedUrl.pathname === '/device-info') {
          const currentPaths = this.getWatchPaths ? this.getWatchPaths() : [];
          const deviceInfo = {
            status: 'ok',
            agent: 'CinemaManagerAgent',
            agentId: this.agentId || os.hostname(),
            agentName: this.agentName || `Cinema Agent - ${os.hostname()}`,
            hostname: os.hostname(),
            platform: process.platform,
            watchPaths: currentPaths,
          };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(deviceInfo));
          return;
        }

        if (parsedUrl.pathname === '/open') {
          const rawPath = parsedUrl.query.path as string;
          if (!rawPath) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Missing "path" query parameter' }));
            return;
          }

          const decodedPath = decodeURIComponent(rawPath);
          const currentPaths = this.getWatchPaths ? this.getWatchPaths() : [];

          // Sandbox validation: Ensure the path is within one of the authorized watchPaths
          if (currentPaths.length > 0) {
            const normDecoded = path.normalize(decodedPath).toLowerCase();
            const isAllowed = currentPaths.some((wp) =>
              normDecoded.startsWith(path.normalize(wp).toLowerCase())
            );

            if (!isAllowed) {
              console.warn(`[Security Block] Access denied for path outside watched folders: ${decodedPath}`);
              res.writeHead(403, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'Access denied: path is outside authorized directories' }));
              return;
            }
          }

          if (!fs.existsSync(decodedPath)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'File does not exist on this machine' }));
            return;
          }

          console.log(`Received verified request to launch video: ${decodedPath}`);

          // Launch file with native Windows default player (e.g. VLC / MPC / Windows Media Player)
          if (process.platform === 'win32') {
            exec(`start "" "${decodedPath}"`, (err) => {
              if (err) {
                console.error('Failed to launch video player:', err);
              } else {
                console.log(`Launched video player for: ${decodedPath}`);
              }
            });
          } else {
            exec(`xdg-open "${decodedPath}"`);
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Launched native video player', path: decodedPath }));
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Endpoint not found' }));
      });

      this.server.listen(this.port, this.host, () => {
        console.log(`Local Video Launcher server listening on http://${this.host}:${this.port}`);
      });

      this.server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`Port ${this.port} is already in use by another instance.`);
        } else {
          console.error('Local Video Launcher server error:', err);
        }
      });
    } catch (error) {
      console.error('Failed to start Local Video Launcher server:', error);
    }
  }

  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = undefined;
      console.log('Local Video Launcher server stopped');
    }
  }
}
