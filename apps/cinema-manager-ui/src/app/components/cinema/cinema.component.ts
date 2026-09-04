import { Component, Input, OnInit, inject } from "@angular/core";
import { CommonModule, DecimalPipe } from "@angular/common";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatChipsModule } from "@angular/material/chips";
import { Cinema } from "@cinema-manager/models";
import { NumberWithSuffixPipe } from "../../pipes/number-with-suffix.pipe";
import { CinemaManagerApiService } from "../../services/cinema-manager-api.service";

@Component({
    selector: 'app-cinema',
    templateUrl: './cinema.component.html',
    styleUrls: ['./cinema.component.scss'],
    standalone: true,
    imports: [CommonModule, MatCardModule, MatIconModule, MatChipsModule, NumberWithSuffixPipe, DecimalPipe]
  })
  export class CinemaComponent implements OnInit {
    @Input() cinema!: Cinema;
    
    private readonly cinemaApiService = inject(CinemaManagerApiService);
  
    constructor() {
        // Web version - no Electron dependencies
    }
  
    ngOnInit(): void {
      console.log('Cinema initialized:', this.cinema);
    }

    startCinema() {
        console.log('Playing video for cinema:', this.cinema.title);
        // Use the API service to play video
        try {
            this.cinemaApiService.playVideo(this.cinema.path || '');
            console.log('Video playback started');
        } catch (error) {
            console.error('Error starting video:', error);
            alert('Failed to start video playback');
        }
    }
}