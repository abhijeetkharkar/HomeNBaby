import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from './services/auth.service';
import { CinemaManagerApiService } from './services/cinema-manager-api.service';
import { ShowcaseLandingComponent } from './components/showcase-landing/showcase-landing.component';
import { OnboardingWizardComponent } from './components/onboarding-wizard/onboarding-wizard.component';

@Component({
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatButtonModule,
    ShowcaseLandingComponent,
    OnboardingWizardComponent,
  ],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected title = 'Cinema Manager';
  currentYear = new Date().getFullYear();
  isExploringDemo = false;
  showOnboarding = false;

  public readonly authService = inject(AuthService);
  private readonly apiService = inject(CinemaManagerApiService);

  async ngOnInit(): Promise<void> {
    // If authenticated, check if device is paired; if not, open wizard
    if (this.authService.isAuthenticated()) {
      const device = await this.apiService.checkLocalDevice();
      if (!device) {
        // Auto-prompt onboarding wizard for unpaired users
        this.showOnboarding = true;
      }
    }
  }

  onSignIn(): void {
    this.authService.login();
  }

  onSignOut(): void {
    this.authService.logout();
    this.isExploringDemo = false;
  }

  openOnboarding(): void {
    this.showOnboarding = true;
  }

  closeOnboarding(): void {
    this.showOnboarding = false;
  }
}

