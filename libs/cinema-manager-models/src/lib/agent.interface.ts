export interface CinemaAgent {
  agentId: string;
  agentName: string;
  hostname?: string;
  version?: string;
  lastHeartbeat: string;
  status: 'online' | 'offline' | 'error';
  watchPaths?: string[];
}

export interface AgentHeartbeatDto {
  agentId: string;
  agentName: string;
  hostname?: string;
  version?: string;
  watchPaths?: string[];
  status?: 'online' | 'offline' | 'error';
}
