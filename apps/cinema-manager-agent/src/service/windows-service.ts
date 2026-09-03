import { Service } from 'node-windows';

export function createService(agent: any) {
  // Create a new service object
  const svc = new Service({
    name: 'Cinema Manager Agent',
    description: 'Monitors video files and syncs with Cinema Manager system',
    script: __filename,
    env: [{
      name: 'NODE_ENV',
      value: 'production'
    }]
  });

  // Listen for the "install" event, which indicates the process is available as a service
  svc.on('install', () => {
    console.log('Cinema Manager Agent service installed successfully');
    svc.start();
  });

  svc.on('start', () => {
    console.log('Cinema Manager Agent service started');
    agent.start();
  });

  svc.on('stop', () => {
    console.log('Cinema Manager Agent service stopped');
    agent.stop();
  });

  svc.on('uninstall', () => {
    console.log('Cinema Manager Agent service uninstalled');
  });

  svc.on('error', (err: Error) => {
    console.error('Cinema Manager Agent service error:', err);
  });

  // Handle command line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--install')) {
    svc.install();
  } else if (args.includes('--uninstall')) {
    svc.uninstall();
  } else if (args.includes('--start')) {
    svc.start();
  } else if (args.includes('--stop')) {
    svc.stop();
  } else {
    // Run in console mode for development
    agent.start();
  }

  return svc;
}
