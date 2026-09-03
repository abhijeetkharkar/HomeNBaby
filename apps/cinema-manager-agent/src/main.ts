import { createService } from './service/windows-service';
import { CinemaManagerAgentService } from './cinema-manager-agent.service';

class CinemaManagerAgent {
  private agentService: CinemaManagerAgentService;

  constructor() {
    this.agentService = new CinemaManagerAgentService();
  }

  async start() {
    console.log('Cinema Manager Agent starting...');
    
    try {
      await this.agentService.start();
      console.log('Cinema Manager Agent started successfully');
    } catch (error) {
      console.error('Failed to start Cinema Manager Agent:', error);
      process.exit(1);
    }
  }

  async stop() {
    console.log('Cinema Manager Agent stopping...');
    
    try {
      await this.agentService.stop();
      console.log('Cinema Manager Agent stopped successfully');
    } catch (error) {
      console.error('Error stopping Cinema Manager Agent:', error);
    }
  }
}

// Create and start the agent
const agent = new CinemaManagerAgent();

// Handle service lifecycle
if (process.platform === 'win32') {
  // Run as Windows service
  createService(agent);
} else {
  // Run as regular process for development
  agent.start();
  
  process.on('SIGINT', async () => {
    await agent.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    await agent.stop();
    process.exit(0);
  });
}
