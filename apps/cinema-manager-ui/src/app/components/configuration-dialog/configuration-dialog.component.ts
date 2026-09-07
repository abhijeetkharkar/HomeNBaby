import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { CinemaManagerApiService } from '../../services/cinema-manager-api.service';
import { LookupPath, CinemaAgent } from '@cinema-manager/models';

@Component({
  selector: 'app-configuration-dialog',
  templateUrl: './configuration-dialog.component.html',
  styleUrls: ['./configuration-dialog.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
  ],
})
export class ConfigurationDialog implements OnInit {
  private readonly apiService = inject(CinemaManagerApiService);
  public readonly dialogRef = inject(MatDialogRef<ConfigurationDialog>);

  lookupPaths: LookupPath[] = [];
  agents: CinemaAgent[] = [];
  newPath = '';
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.apiService.getLookupPaths().subscribe({
      next: (paths) => {
        this.lookupPaths = paths;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });

    this.apiService.getAgents().subscribe({
      next: (agents) => {
        this.agents = agents;
      },
      error: () => {},
    });
  }

  addPath(): void {
    if (!this.newPath.trim()) return;
    this.isLoading = true;
    this.apiService.addLookupPath(this.newPath.trim()).subscribe({
      next: (created) => {
        this.lookupPaths.push(created);
        this.newPath = '';
        this.isLoading = false;
        this.successMessage = 'Folder path added successfully';
        setTimeout(() => (this.successMessage = ''), 3000);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = 'Failed to add path. ' + err.message;
      },
    });
  }

  deletePath(id: number | string): void {
    this.apiService.deleteLookupPath(id).subscribe({
      next: () => {
        this.lookupPaths = this.lookupPaths.filter((p) => p.id !== id);
      },
      error: (err) => {
        this.errorMessage = 'Failed to delete path. ' + err.message;
      },
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}
