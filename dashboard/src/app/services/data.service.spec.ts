import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DataService } from './data.service';

describe('DataService', () => {
  let service: DataService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [DataService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(DataService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('getIndex GETs ./data/index.json', () => {
    service.getIndex().subscribe();
    const req = http.expectOne('data/index.json');
    expect(req.request.method).toBe('GET');
    req.flush({ slugs: [], generatedAt: 't' });
  });

  it('getSummary GETs the slug summary', () => {
    service.getSummary('a-com').subscribe();
    http.expectOne('data/summary/a-com.json').flush({});
  });
});
