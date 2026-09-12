import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from './services/auth.service';
import { CinemaManagerApiService } from './services/cinema-manager-api.service';
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
export class App implements OnInit {
  protected title = 'Cinema Manager';
  currentYear = new Date().getFullYear();
  showOnboarding = false;

  public readonly authService = inject(AuthService);
  private readonly apiService = inject(CinemaManagerApiService);
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    // If authenticated, check if device is paired; if not, open wizard
    if (this.authService.isAuthenticated()) {
      const device = await this.apiService.checkLocalDevice();
      if (!device) {
        this.showOnboarding = true;
      }
    }
  }

  onSignIn(): void {
    this.router.navigate(['/login']);
  }

  onSignOut(): void {
    this.authService.logout();
  }

  openOnboarding(): void {
    this.showOnboarding = true;
  }

  closeOnboarding(): void {
    this.showOnboarding = false;
  }
}
