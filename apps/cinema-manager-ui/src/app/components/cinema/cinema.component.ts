import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { Cinema } from '@cinema-manager/models';
import { NumberWithSuffixPipe } from '../../pipes/number-with-suffix.pipe';
import { CinemaManagerApiService } from '../../services/cinema-manager-api.service';

@Component({
  selector: 'app-cinema',
  templateUrl: './cinema.component.html',
  styleUrls: ['./cinema.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    NumberWithSuffixPipe,
    DecimalPipe,
  ],
})
export class CinemaComponent {
  @Input() cinema!: Cinema;
  @Output() delete = new EventEmitter<Cinema>();

  private readonly cinemaApiService = inject(CinemaManagerApiService);
  imageError = false;

  onImageError(): void {
    this.imageError = true;
  }

  startCinema(): void {
    if (this.cinema.path) {
      this.cinemaApiService.playVideo(this.cinema.path);
    }
  }

  onDelete(event: Event): void {
    event.stopPropagation();
    this.delete.emit(this.cinema);
  }
}