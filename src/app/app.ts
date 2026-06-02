import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { VbThemeService, VbToastStackComponent } from 'vbomba-ui';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, VbToastStackComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private theme = inject(VbThemeService);

  constructor() {
    this.theme.init();
  }
}
