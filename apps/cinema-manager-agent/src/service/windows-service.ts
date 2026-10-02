import { execSync, exec, spawn } from 'child_process';
import * as path from 'path';
import * as http from 'http';
import * as os from 'os';

function showWindowsPopup(message: string, timeoutSec = 2, iconType = 64): void {
  try {
    const escapedMsg = message.replace(/'/g, "''");
    const cmd = `powershell -NoProfile -WindowStyle Hidden -Command "(New-Object -ComObject WScript.Shell).Popup('${escapedMsg}', ${timeoutSec}, 'Cinema Manager Agent', ${iconType})"`;
    exec(cmd, { windowsHide: true }, () => {});
  } catch {
    // ignore popup errors
  }
}

function checkAlreadyRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:3334/health', { timeout: 600 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

export function createService(agent: any) {
  const args = process.argv.slice(2);
  const targetExe = process.execPath;
  const taskName = 'CinemaManagerAgent';

  if (args.includes('--install')) {
    console.log('======================================================');
    console.log('  Installing Cinema Manager Agent Auto-Start Service  ');
    console.log('======================================================');

    try {
      // 1. Register Scheduled Task to launch silently in user session on logon (if elevated)
      let taskRegistered = false;
      try {
        execSync(
          `schtasks /create /tn "${taskName}" /tr "\\"${targetExe}\\" --silent" /sc onlogon /rl highest /f`,
          { stdio: 'pipe' }
        );
        taskRegistered = true;
        console.log('[OK] Windows Task Scheduler auto-start registered (on logon).');
      } catch {
        try {
          execSync(
            `schtasks /create /tn "${taskName}" /tr "\\"${targetExe}\\" --silent" /sc onlogon /f`,
            { stdio: 'pipe' }
          );
          taskRegistered = true;
          console.log('[OK] Windows Task Scheduler auto-start registered.');
        } catch {
          // schtasks requires elevation on some Windows versions; fall through to HKCU Run key
        }
      }

      // 2. Register HKCU Run key (always available without administrator elevation)
      let regConfigured = false;
      try {
        execSync(
          `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "${taskName}" /t REG_SZ /d "\\"${targetExe}\\" --silent" /f`,
          { stdio: 'pipe' }
        );
        regConfigured = true;
        console.log('[OK] Windows User Startup registry key configured.');
      } catch (regErr: any) {
        console.warn('Notice: Could not write HKCU Run key:', regErr.message);
      }

      if (!taskRegistered && !regConfigured) {
        throw new Error('Failed to configure Windows auto-start via Task Scheduler or Registry.');
      }

      console.log('\nCinema Manager Agent auto-start configured successfully!');
      console.log('The agent is registered to run automatically on Windows logon.\n');
      process.exit(0);
    } catch (err: any) {
      console.error('Failed to configure Cinema Manager Agent auto-start:', err.message);
      process.exit(1);
    }
  } else if (args.includes('--uninstall')) {
    console.log('======================================================');
    console.log('  Uninstalling Cinema Manager Agent Auto-Start        ');
    console.log('======================================================');

    try {
      // Delete Scheduled Task
      try {
        execSync(`schtasks /delete /tn "${taskName}" /f`, { stdio: 'pipe' });
        console.log('[OK] Removed Windows Scheduled Task.');
      } catch {
        // Ignored if task doesn't exist
      }

      // Delete HKCU Run Key
      try {
        execSync(
          `reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "${taskName}" /f`,
          { stdio: 'pipe' }
        );
        console.log('[OK] Removed Windows User Startup registry entry.');
      } catch {
        // Ignored if key doesn't exist
      }

      // Terminate any running cinema-agent processes (excluding self)
      try {
        const exeName = path.basename(targetExe);
        execSync(`taskkill /F /IM "${exeName}" /FI "PID ne ${process.pid}"`, { stdio: 'pipe' });
        console.log('[OK] Stopped running background agent processes.');
      } catch {
        // Ignored if none running
      }

      console.log('\nCinema Manager Agent auto-start uninstalled successfully.\n');
      process.exit(0);
    } catch (err: any) {
      console.error('Error during uninstallation:', err.message);
      process.exit(1);
    }
  } else if (args.includes('--stop')) {
    try {
      const exeName = path.basename(targetExe);
      execSync(`taskkill /F /IM "${exeName}" /FI "PID ne ${process.pid}"`, { stdio: 'pipe' });
      console.log('Cinema Manager Agent stopped.');
      process.exit(0);
    } catch (err: any) {
      console.warn('Could not stop agent process:', err.message);
      process.exit(0);
    }
  } else {
    // Standard run mode with single-instance guard and user visual notification
    checkAlreadyRunning().then((isRunning) => {
      if (isRunning) {
        if (!args.includes('--silent')) {
          showWindowsPopup('Cinema Manager Agent is already running in the background.', 3, 48);
        }
        process.exit(0);
      } else {
        if (!args.includes('--silent')) {
          showWindowsPopup(`Cinema Manager Agent is active and running in the background on ${os.hostname()}.`, 2, 64);
        }
        agent.start();
      }
    });
  }
}

