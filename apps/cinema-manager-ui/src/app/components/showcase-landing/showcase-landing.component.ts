import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-showcase-landing',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  templateUrl: './showcase-landing.component.html',
  styleUrls: ['./showcase-landing.component.scss'],
})
export class ShowcaseLandingComponent {
  @Output() exploreDemo = new EventEmitter<void>();

  samplePosters = [
    {
      title: 'Inception',
      year: 2010,
      genre: 'Action, Sci-Fi',
      rating: 8.8,
      poster: 'https://m.media-amazon.com/images/M/MV5BMjAxMzY3NjcxNF5BMl5BanBnXkFtZTcwNTI5OTM0Mw@@._V1_SX300.jpg',
    },
    {
      title: 'The Dark Knight',
      year: 2008,
      genre: 'Action, Crime, Drama',
      rating: 9.0,
      poster: 'https://m.media-amazon.com/images/M/MV5BMTMxNTMwODM0NF5BMl5BanBnXkFtZTcwODAyMTk2Mw@@._V1_SX300.jpg',
    },
    {
      title: 'Interstellar',
      year: 2014,
      genre: 'Adventure, Drama, Sci-Fi',
      rating: 8.7,
      poster: 'https://m.media-amazon.com/images/M/MV5BYzdjMDAxZGItMjI2My00ODA1LTlkNzItOWFjMDU5ZDJlYWY3XkEyXkFqcGc@._V1_SX300.jpg',
    },
  ];

  constructor(public authService: AuthService) {}

  onSignIn(): void {
    this.authService.login();
  }

  onSignUp(): void {
    this.authService.signup();
  }

  onDemoClick(): void {
    this.exploreDemo.emit();
  }
}
