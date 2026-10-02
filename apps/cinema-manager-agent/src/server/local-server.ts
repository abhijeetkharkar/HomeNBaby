import * as http from 'http';
import * as url from 'url';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec, spawn } from 'child_process';

/**
 * Local lightweight HTTP server running on 127.0.0.1:3334
 * Allows the Cinema Manager Web UI to trigger native local video playback
 * and verify local device identity and watched paths.
 */
export interface LocalServerOptions {
  getWatchPaths?: () => string[];
  getAgentId?: () => string;
  agentId?: string;
  agentName?: string;
  isPaired?: () => boolean;
  onPair?: (
    pairingCode: string,
    watchPaths?: string[]
  ) => Promise<{ deviceId: string; agentName: string; watchPaths?: string[] }>;
  onUpdatePaths?: (watchPaths: string[]) => Promise<void> | void;
}

export class LocalServer {
  private server?: http.Server;
  private readonly port: number = 3334;
  private readonly host: string = '127.0.0.1';

  private readonly getWatchPaths?: () => string[];
  private readonly getAgentId?: () => string;
  private readonly agentId?: string;
  private readonly agentName?: string;
  private readonly isPaired?: () => boolean;
  private readonly onPair?: (
    pairingCode: string,
    watchPaths?: string[]
  ) => Promise<{ deviceId: string; agentName: string; watchPaths?: string[] }>;
  private readonly onUpdatePaths?: (watchPaths: string[]) => Promise<void> | void;
  private activePaths: string[] = [];

  constructor(
    getWatchPathsOrOptions?: (() => string[]) | LocalServerOptions,
    agentId?: string,
    agentName?: string,
    isPaired?: () => boolean,
    onPair?: (
      pairingCode: string,
      watchPaths?: string[]
    ) => Promise<{ deviceId: string; agentName: string; watchPaths?: string[] }>,
    onUpdatePaths?: (watchPaths: string[]) => Promise<void> | void
  ) {
    if (typeof getWatchPathsOrOptions === 'function') {
      this.getWatchPaths = getWatchPathsOrOptions;
      this.agentId = agentId;
      this.agentName = agentName;
      this.isPaired = isPaired;
      this.onPair = onPair;
      this.onUpdatePaths = onUpdatePaths;
    } else if (getWatchPathsOrOptions) {
      this.getWatchPaths = getWatchPathsOrOptions.getWatchPaths;
      this.getAgentId = getWatchPathsOrOptions.getAgentId;
      this.agentId = getWatchPathsOrOptions.agentId;
      this.agentName = getWatchPathsOrOptions.agentName;
      this.isPaired = getWatchPathsOrOptions.isPaired;
      this.onPair = getWatchPathsOrOptions.onPair;
      this.onUpdatePaths = getWatchPathsOrOptions.onUpdatePaths;
    }
  }

  private parseJsonBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 1e6) {
          req.destroy();
          reject(new Error('Payload too large'));
        }
      });
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (e) {
          reject(new Error('Invalid JSON'));
        }
      });
      req.on('error', (err) => reject(err));
    });
  }

  start(): void {
    try {
      this.server = http.createServer(async (req, res) => {
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

        // /health or /device-info: Returns device identity, paired state, and authorized watch paths
        if (parsedUrl.pathname === '/health' || parsedUrl.pathname === '/device-info') {
          const livePaths = this.getWatchPaths ? this.getWatchPaths() : [];
          const currentPaths = livePaths.length > 0 ? livePaths : this.activePaths;
          const effectiveAgentId = this.getAgentId
            ? this.getAgentId()
            : this.agentId || os.hostname();
          const deviceInfo = {
            status: 'ok',
            agent: 'CinemaManagerAgent',
            isPaired: this.isPaired ? this.isPaired() : false,
            agentId: effectiveAgentId,
            agentName: this.agentName || `Cinema Agent - ${os.hostname()}`,
            hostname: os.hostname(),
            platform: process.platform,
            watchPaths: currentPaths,
          };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(deviceInfo));
          return;
        }

        // POST /pair: Direct browser-to-agent pairing endpoint
        if (parsedUrl.pathname === '/pair' && req.method === 'POST') {
          try {
            const body = await this.parseJsonBody(req);
            const { pairingCode, watchPaths } = body;
            if (!pairingCode) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'Missing pairingCode' }));
              return;
            }
            if (!this.onPair) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'Pairing handler not configured on agent' }));
              return;
            }

            console.log(`[LocalServer] Received pairing request from browser for code: ${pairingCode}`);
            if (watchPaths && Array.isArray(watchPaths)) {
              this.activePaths = watchPaths;
            }
            const result = await this.onPair(pairingCode, watchPaths);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, ...result }));
          } catch (err: any) {
            console.error('[LocalServer] Pairing error:', err.message);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
          return;
        }

        // POST /config/paths: Dynamically update watched media folders
        if (parsedUrl.pathname === '/config/paths' && req.method === 'POST') {
          try {
            const body = await this.parseJsonBody(req);
            const { watchPaths } = body;
            if (!Array.isArray(watchPaths)) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'watchPaths must be an array of directory paths' }));
              return;
            }
            this.activePaths = watchPaths;
            if (this.onUpdatePaths) {
              await this.onUpdatePaths(watchPaths);
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, watchPaths }));
          } catch (err: any) {
            console.error('[LocalServer] Path update error:', err.message);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
          return;
        }

        // GET /open: Native video player launch
        if (parsedUrl.pathname === '/open') {
          const rawPath = parsedUrl.query.path as string;
          if (!rawPath) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Missing "path" query parameter' }));
            return;
          }

          const decodedPath = decodeURIComponent(rawPath).trim().replace(/^["']|["']$/g, '');
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

          // Explicitly launch VLC Media Player if installed, with graceful system fallback
          if (process.platform === 'win32') {
            const vlcCandidates = [
              'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe',
              'C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe',
              path.join(os.homedir(), 'AppData\\Local\\Programs\\VideoLAN\\VLC\\vlc.exe'),
            ];
            const vlcPath = vlcCandidates.find((p) => fs.existsSync(p));

            if (vlcPath) {
              console.log(`Launching VLC player via Windows Shell: ${vlcPath}`);
              const escapedVlc = vlcPath.replace(/'/g, "''");
              const escapedVideo = decodedPath.replace(/'/g, "''");
              // Use [System.Diagnostics.Process]::Start to pass literal double quotes so paths with spaces are never split
              const psCmd = `powershell -NoProfile -Command "[System.Diagnostics.Process]::Start('${escapedVlc}', '\\"${escapedVideo}\\"')"`;
              exec(psCmd, (err) => {
                if (err) {
                  console.error('[LocalServer] Failed to launch VLC via Process.Start:', err);
                  exec(`explorer "${decodedPath}"`);
                }
              });
            } else {
              console.log(`VLC not found at standard paths, launching via Windows default association: ${decodedPath}`);
              exec(`explorer "${decodedPath}"`, (err) => {
                if (err) {
                  console.error('Failed to launch video player via explorer:', err);
                }
              });
            }
          } else if (process.platform === 'darwin') {
            const vlcApp = '/Applications/VLC.app';
            if (fs.existsSync(vlcApp)) {
              exec(`open -a "/Applications/VLC.app" "${decodedPath}"`);
            } else {
              exec(`open "${decodedPath}"`);
            }
          } else {
            exec(`vlc "${decodedPath}" || xdg-open "${decodedPath}"`);
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
