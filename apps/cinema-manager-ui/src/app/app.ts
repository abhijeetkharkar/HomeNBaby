import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from './services/auth.service';
import { CinemaManagerApiService } from './services/cinema-manager-api.service';
import { TelemetryService } from './services/telemetry.service';
import { OnboardingWizardComponent } from './components/onboarding-wizard/onboarding-wizard.component';

@Component({
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatButtonModule,
    OnboardingWizardComponent,
  ],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit, OnDestroy {
  protected title = 'Cinema Manager';
  currentYear = new Date().getFullYear();

  public readonly authService = inject(AuthService);
  public readonly apiService = inject(CinemaManagerApiService);
  private readonly telemetryService = inject(TelemetryService);
  private readonly router = inject(Router);

  readonly currentUrl = signal<string>(this.router.url);
  readonly isOnDashboard = computed(() => this.currentUrl().includes('/dashboard'));
  readonly isOnAdmin = computed(() => this.currentUrl().includes('/admin'));

  private heartbeatInterval?: any;

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.currentUrl.set(e.urlAfterRedirects);
      });
  }

  async ngOnInit(): Promise<void> {
    if (this.authService.isAuthenticated()) {
      // Send initial heartbeat and schedule 5-minute background pings
      this.telemetryService.sendHeartbeat();
      this.heartbeatInterval = setInterval(() => {
        if (this.authService.isAuthenticated()) {
          this.telemetryService.sendHeartbeat();
        }
      }, 5 * 60 * 1000);

      // Check local agent; if not found, open pairing wizard once
      const device = await this.apiService.checkLocalDevice();
      if (!device) {
        this.apiService.openPairingModal();
      }
    }
  }

  ngOnDestroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  onSignIn(): void {
    this.router.navigate(['/login']);
  }

  onSignOut(): void {
    this.authService.logout();
  }

  openOnboarding(): void {
    this.apiService.openPairingModal();
  }

  closeOnboarding(): void {
    this.apiService.closePairingModal();
  }
}
