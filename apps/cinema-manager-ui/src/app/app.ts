import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CinemaGalleryComponent } from './components/cinema-gallery/cinema-gallery.component';

@Component({
  imports: [RouterModule, CinemaGalleryComponent],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected title = 'Cinema Manager';
}
