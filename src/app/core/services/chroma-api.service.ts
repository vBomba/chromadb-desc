import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, from, switchMap } from 'rxjs';
import { ConfigService } from './config.service';

export interface ChromaCollection {
  id: string;
  name: string;
  tenant: string;
  database: string;
  dimension?: number | null;
  metadata?: Record<string, unknown> | null;
  configuration_json?: unknown;
  log_position?: number;
  version?: number;
  schema?: unknown;
}

export interface GetRecordsPayload {
  ids?: string[] | null;
  where?: unknown;
  where_document?: unknown;
  include?: ('documents' | 'embeddings' | 'metadatas' | 'uris' | 'distances')[];
  limit?: number | null;
  offset?: number | null;
}

export interface GetRecordsResponse {
  ids: string[];
  documents: (string | null)[] | null;
  embeddings: (number[][] | null)[] | null;
  metadatas: (Record<string, unknown> | null)[] | null;
  uris: (string | null)[] | null;
  include: string[];
}

export interface AddRecordsPayload {
  ids: string[];
  embeddings: number[][];
  documents?: (string | null)[] | null;
  metadatas?: (Record<string, unknown> | null)[] | null;
  uris?: (string | null)[] | null;
}

export interface UpsertRecordsPayload extends AddRecordsPayload {}

export interface DeleteRecordsPayload {
  ids?: string[] | null;
  where?: unknown;
  where_document?: unknown;
}

export interface QueryPayload {
  query_embeddings?: number[][];
  query_texts?: string[] | null;
  n_results?: number | null;
  where?: unknown;
  where_document?: unknown;
  include?: ('documents' | 'embeddings' | 'metadatas' | 'uris' | 'distances')[];
}

export interface QueryResponse {
  ids: string[][];
  documents: (string | null)[][] | null;
  embeddings: (number[][] | null)[][] | null;
  metadatas: (Record<string, unknown> | null)[][] | null;
  distances: (number | null)[][] | null;
  uris: (string | null)[][] | null;
  include: string[];
}

export interface CreateCollectionPayload {
  name: string;
  metadata?: Record<string, unknown> | null;
  get_or_create?: boolean;
  configuration?: unknown;
  schema?: unknown;
}

export interface ApiError {
  error: string;
  message: string;
}

export interface HeartbeatResponse {
  'nanosecond heartbeat'?: number;
}

export interface ChromaDatabase {
  id: string;
  name: string;
  tenant: string;
}

export interface CollectionCount {
  count: number;
}

/** GET /api/v2/pre-flight-checks */
export interface ChecklistResponse {
  max_batch_size?: number;
  supports_base64_encoding?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ChromaApiService {
  private http = inject(HttpClient);
  private configService = inject(ConfigService);

  private async apiRoot(): Promise<string> {
    const c = await this.configService.loadConfig();
    return c.apiBaseUrl;
  }

  private async baseUrl(): Promise<string> {
    const c = await this.configService.loadConfig();
    return `${c.apiBaseUrl}/tenants/${encodeURIComponent(c.tenant)}/databases/${encodeURIComponent(c.database)}`;
  }

  private async headers(): Promise<HttpHeaders> {
    const c = await this.configService.loadConfig();
    let h = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (c.apiKey) {
      h = h.set('x-chroma-token', c.apiKey);
    }
    return h;
  }

  /** Heartbeat for connection check: GET /api/v2/heartbeat (we only care that it succeeds). */
  heartbeat(): Observable<void> {
    return from(this.apiRoot()).pipe(
      switchMap(async (root) => {
        const headers = await this.headers();
        return this.http.get(`${root}/heartbeat`, {
          headers,
          responseType: 'text',
        });
      }),
      switchMap((obs) => obs as Observable<unknown>)
    ) as Observable<void>;
  }

  /** One-time info about the current database from API. */
  getCurrentDatabase(): Observable<ChromaDatabase> {
    return from(this.configService.loadConfig()).pipe(
      switchMap(async (c) => {
        const headers = await this.headers();
        const url = `${c.apiBaseUrl}/tenants/${encodeURIComponent(c.tenant)}/databases/${encodeURIComponent(c.database)}`;
        return this.http.get<ChromaDatabase>(url, { headers });
      }),
      switchMap((obs) => obs)
    );
  }

  /** GET /api/v2/version */
  getVersion(): Observable<string> {
    return from(this.apiRoot()).pipe(
      switchMap(async (root) => {
        const headers = await this.headers();
        return this.http.get(`${root}/version`, { headers, responseType: 'text' });
      }),
      switchMap((obs) => obs)
    );
  }

  /** GET /api/v2/healthcheck */
  getHealthcheck(): Observable<string> {
    return from(this.apiRoot()).pipe(
      switchMap(async (root) => {
        const headers = await this.headers();
        return this.http.get(`${root}/healthcheck`, { headers, responseType: 'text' });
      }),
      switchMap((obs) => obs)
    );
  }

  /** GET /api/v2/pre-flight-checks */
  getPreFlightChecks(): Observable<ChecklistResponse> {
    return from(this.apiRoot()).pipe(
      switchMap(async (root) => {
        const headers = await this.headers();
        return this.http.get<ChecklistResponse>(`${root}/pre-flight-checks`, { headers });
      }),
      switchMap((obs) => obs)
    );
  }

  /** GET .../collections_count — total collections in current tenant/database */
  getCollectionsCount(): Observable<number> {
    return from(this.baseUrl()).pipe(
      switchMap(async (base) => {
        const headers = await this.headers();
        return this.http.get<number>(`${base}/collections_count`, { headers });
      }),
      switchMap((obs) => obs)
    );
  }

  /** Number of records in a collection. */
  countRecords(collectionId: string): Observable<CollectionCount> {
    return from(this.baseUrl()).pipe(
      switchMap(async (base) => {
        const headers = await this.headers();
        return this.http.get<CollectionCount>(
          `${base}/collections/${encodeURIComponent(collectionId)}/count`,
          { headers }
        );
      }),
      switchMap((obs) => obs)
    );
  }

  listCollections(limit = 500, offset = 0): Observable<ChromaCollection[]> {
    return from(this.baseUrl()).pipe(
      switchMap(async (base) => {
        const headers = await this.headers();
        const params = new HttpParams()
          .set('limit', String(limit))
          .set('offset', String(offset));
        return this.http.get<ChromaCollection[]>(
          `${base}/collections`,
          { headers, params }
        );
      }),
      switchMap((obs) => obs)
    );
  }

  createCollection(payload: CreateCollectionPayload): Observable<ChromaCollection> {
    return from(this.baseUrl()).pipe(
      switchMap(async (base) => {
        const headers = await this.headers();
        return this.http.post<ChromaCollection>(
          `${base}/collections`,
          payload,
          { headers }
        );
      }),
      switchMap((obs) => obs)
    );
  }

  deleteCollection(collectionId: string): Observable<void> {
    return from(this.baseUrl()).pipe(
      switchMap(async (base) => {
        const headers = await this.headers();
        return this.http.delete<void>(
          `${base}/collections/${encodeURIComponent(collectionId)}`,
          { headers }
        );
      }),
      switchMap((obs) => obs)
    );
  }

  /** Get a collection by CRN: tenant_resource_name:database_name:collection_name (all non-empty). */
  getCollectionByCrn(crn: string): Observable<ChromaCollection> {
    return from(this.apiRoot()).pipe(
      switchMap(async (root) => {
        const headers = await this.headers();
        return this.http.get<ChromaCollection>(
          `${root}/collections/${encodeURIComponent(crn)}`,
          { headers }
        );
      }),
      switchMap((obs) => obs)
    );
  }

  getRecords(
    collectionId: string,
    payload: GetRecordsPayload
  ): Observable<GetRecordsResponse> {
    return from(this.baseUrl()).pipe(
      switchMap(async (base) => {
        const headers = await this.headers();
        return this.http.post<GetRecordsResponse>(
          `${base}/collections/${encodeURIComponent(collectionId)}/get`,
          payload,
          { headers }
        );
      }),
      switchMap((obs) => obs)
    );
  }

  addRecords(
    collectionId: string,
    payload: AddRecordsPayload
  ): Observable<unknown> {
    return from(this.baseUrl()).pipe(
      switchMap(async (base) => {
        const headers = await this.headers();
        return this.http.post<unknown>(
          `${base}/collections/${encodeURIComponent(collectionId)}/add`,
          payload,
          { headers }
        );
      }),
      switchMap((obs) => obs)
    );
  }

  upsertRecords(
    collectionId: string,
    payload: UpsertRecordsPayload
  ): Observable<unknown> {
    return from(this.baseUrl()).pipe(
      switchMap(async (base) => {
        const headers = await this.headers();
        return this.http.post<unknown>(
          `${base}/collections/${encodeURIComponent(collectionId)}/upsert`,
          payload,
          { headers }
        );
      }),
      switchMap((obs) => obs)
    );
  }

  deleteRecords(
    collectionId: string,
    payload: DeleteRecordsPayload
  ): Observable<unknown> {
    return from(this.baseUrl()).pipe(
      switchMap(async (base) => {
        const headers = await this.headers();
        return this.http.post<unknown>(
          `${base}/collections/${encodeURIComponent(collectionId)}/delete`,
          payload,
          { headers }
        );
      }),
      switchMap((obs) => obs)
    );
  }

  queryCollection(
    collectionId: string,
    payload: QueryPayload,
    limit?: number,
    offset?: number
  ): Observable<QueryResponse> {
    return from(this.baseUrl()).pipe(
      switchMap(async (base) => {
        const headers = await this.headers();
        let params = new HttpParams();
        if (limit != null) params = params.set('limit', String(limit));
        if (offset != null) params = params.set('offset', String(offset));
        return this.http.post<QueryResponse>(
          `${base}/collections/${encodeURIComponent(collectionId)}/query`,
          payload,
          { headers, params }
        );
      }),
      switchMap((obs) => obs)
    );
  }
}
