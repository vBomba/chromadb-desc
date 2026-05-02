import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { VbThemeService } from 'vbomba-ui';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private theme = inject(VbThemeService);

  constructor() {
    this.theme.init();
  }
}
