import * as http from 'http';
import * as url from 'url';
import * as fs from 'fs';
import { exec } from 'child_process';

/**
 * Local lightweight HTTP server running on 127.0.0.1:3334
 * Allows the Cinema Manager Web UI to trigger native local video playback
 */
export class LocalServer {
  private server?: http.Server;
  private readonly port: number = 3334;
  private readonly host: string = '127.0.0.1';

  start(): void {
    try {
      this.server = http.createServer((req, res) => {
        // Set CORS headers so https://cinema.abhijeetkharkar.com can communicate with local agent
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        const parsedUrl = url.parse(req.url || '', true);

        if (parsedUrl.pathname === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', agent: 'CinemaManagerAgent' }));
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
          console.log(`Received request to launch video: ${decodedPath}`);

          if (!fs.existsSync(decodedPath)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'File does not exist on this machine' }));
            return;
          }

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
