import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { Cinema } from '@cinema-manager/models';
import { NumberWithSuffixPipe } from '../../pipes/number-with-suffix.pipe';
import { CinemaManagerApiService } from '../../services/cinema-manager-api.service';
import { TelemetryService } from '../../services/telemetry.service';

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
  private readonly telemetryService = inject(TelemetryService);
  imageError = false;
  isPlotExpanded = false;

  onImageError(): void {
    this.imageError = true;
  }

  togglePlot(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.isPlotExpanded = !this.isPlotExpanded;
  }

  startCinema(): void {
    if (this.cinema.path) {
      this.cinemaApiService.playVideo(this.cinema.path);
      this.telemetryService.recordView({
        id: this.cinema.id,
        title: this.cinema.title,
        year: this.cinema.year,
        poster: this.cinema.poster,
      });
    }
  }

  onDelete(event: Event): void {
    event.stopPropagation();
    this.delete.emit(this.cinema);
  }
}