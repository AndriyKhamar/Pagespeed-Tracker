import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<main style="max-width:900px;margin:2rem auto;font-family:system-ui"><router-outlet></router-outlet></main>`
})
export class AppComponent {}
