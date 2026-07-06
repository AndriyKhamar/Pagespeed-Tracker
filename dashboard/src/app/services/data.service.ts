import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { IndexFile, SummaryFile } from '../models/psi.model';

@Injectable({ providedIn: 'root' })
export class DataService {
  private http = inject(HttpClient);
  getIndex(): Observable<IndexFile> { return this.http.get<IndexFile>('data/index.json'); }
  getSummary(slug: string): Observable<SummaryFile> { return this.http.get<SummaryFile>(`data/summary/${slug}.json`); }
}
