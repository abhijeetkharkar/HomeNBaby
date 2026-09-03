import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'configuration-dialog',
  templateUrl: './configuration-dialog.component.html',
})
export class ConfigurationDialog {
  constructor(public dialogRef: MatDialogRef<ConfigurationDialog>) {}
}
