import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

export interface WorkflowStep {
  id: string;
  stepNumber: string;
  title: string;
  subtitle: string;
  description: string;
  highlightText: string;
}

@Component({
  selector: 'app-showcase-landing',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatButtonModule],
  templateUrl: './showcase-landing.component.html',
  styleUrls: ['./showcase-landing.component.scss'],
})
export class ShowcaseLandingComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);

  activeStepIndex = 0;
  private autoCycleTimer?: any;
  readonly stepDuration = 5000; // 5 seconds per step

  steps: WorkflowStep[] = [
    {
      id: 'signup',
      stepNumber: '01',
      title: 'Sign In / Sign Up',
      subtitle: 'Fast, secure in-app account creation',
      description: 'Create your private account in seconds. No cloud storage fees, no telemetry on your personal media files.',
      highlightText: 'Private & Secure',
    },
    {
      id: 'folder',
      stepNumber: '02',
      title: 'Set Movie Directory',
      subtitle: 'Tell the app where your videos live',
      description: 'Specify your local folder path (e.g. D:\\Movies or an external USB SSD). Media never leaves your machine.',
      highlightText: '100% Local Storage',
    },
    {
      id: 'agent',
      stepNumber: '03',
      title: 'Launch Companion Agent',
      subtitle: '1-click hardware-bound connection',
      description: 'Download the lightweight agent for Windows (.exe) or macOS (.dmg). Enter your 6-digit code once to pair.',
      highlightText: 'AES-256 Vault',
    },
    {
      id: 'watch',
      stepNumber: '04',
      title: 'Instant 4K Playback',
      subtitle: 'Watch button appears on your dashboard',
      description: 'Return to your browser. Your movie library automatically lights up with IMDb ratings, posters, and an instant Watch button.',
      highlightText: 'Full 4K Bitrate',
    },
  ];

  ngOnInit(): void {
    this.startAutoCycle();
  }

  ngOnDestroy(): void {
    this.stopAutoCycle();
  }

  startAutoCycle(): void {
    this.stopAutoCycle();
    this.autoCycleTimer = setInterval(() => {
      this.activeStepIndex = (this.activeStepIndex + 1) % this.steps.length;
    }, this.stepDuration);
  }

  stopAutoCycle(): void {
    if (this.autoCycleTimer) {
      clearInterval(this.autoCycleTimer);
      this.autoCycleTimer = undefined;
    }
  }

  selectStep(index: number): void {
    this.activeStepIndex = index;
    // Reset timer on manual click
    this.startAutoCycle();
  }

  goToLogin(step = 'signIn'): void {
    this.router.navigate(['/login'], { queryParams: { step } });
  }
}
