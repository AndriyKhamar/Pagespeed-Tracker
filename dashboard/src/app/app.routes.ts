import { Routes } from '@angular/router';
import { UrlListComponent } from './components/url-list/url-list.component';
import { UrlDetailComponent } from './components/url-detail/url-detail.component';

export const routes: Routes = [
  { path: '', component: UrlListComponent },
  { path: 'url/:slug', component: UrlDetailComponent },
  { path: '**', redirectTo: '' }
];
