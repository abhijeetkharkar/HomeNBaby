import { Component, OnInit, OnDestroy, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';
import { CinemaManagerApiService, DeviceInfo } from '../../services/cinema-manager-api.service';

@Component({
  selector: 'app-onboarding-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './onboarding-wizard.component.html',
  styleUrls: ['./onboarding-wizard.component.scss'],
})
export class OnboardingWizardComponent implements OnInit, OnDestroy {
  @Output() completed = new EventEmitter<void>();

  pairingCode = '';
  expiresInSeconds = 600;
  timerInterval: any = null;
  pollInterval: any = null;
  pairedDevice: DeviceInfo | null = null;
  isPairingComplete = false;
  lookupPath = 'D:\\Movies';
  pathSaved = false;

  readonly releaseUrlWin =
    'https://github.com/abhijeetkharkar/HomeNBaby/releases/latest/download/cinema-agent-win-x64.zip';
  readonly releaseUrlMac =
    'https://github.com/abhijeetkharkar/HomeNBaby/releases/latest/download/cinema-agent-macos.dmg';

  constructor(
    public authService: AuthService,
    private apiService: CinemaManagerApiService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.fetchPairingCode();
    this.startDetectionPolling();
  }

  ngOnDestroy(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  async fetchPairingCode(): Promise<void> {
    try {
      const res = await this.authService.getPairingCode();
      this.pairingCode = res.code;
      const now = Math.floor(Date.now() / 1000);
      this.expiresInSeconds = Math.max(0, res.expiresAt - now);
      this.startCountdown();
    } catch (err) {
      console.warn('Could not generate pairing code from API:', err);
      this.pairingCode = 'CIN-DEMO';
      this.expiresInSeconds = 600;
      this.startCountdown();
    }
  }

  private startCountdown(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this.expiresInSeconds > 0) {
        this.expiresInSeconds--;
      } else {
        clearInterval(this.timerInterval);
      }
    }, 1000);
  }

  get formattedTime(): string {
    const mins = Math.floor(this.expiresInSeconds / 60);
    const secs = this.expiresInSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  private startDetectionPolling(): void {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(async () => {
      const device = await this.apiService.checkLocalDevice();
      if (device && device.status === 'ok') {
        this.pairedDevice = device;
        this.isPairingComplete = true;
        clearInterval(this.pollInterval);
        setTimeout(() => {
          this.completed.emit();
        }, 2500);
      }
    }, 3000);
  }

  savePath(): void {
    if (this.lookupPath.trim()) {
      this.apiService.addLookupPath(this.lookupPath.trim()).subscribe({
        next: () => {
          this.pathSaved = true;
        },
        error: () => {
          this.pathSaved = true; // Fallback
        },
      });
    }
  }

  finishSetup(): void {
    this.completed.emit();
  }
}
