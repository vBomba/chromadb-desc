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

@Injectable({ providedIn: 'root' })
export class ChromaApiService {
  private http = inject(HttpClient);
  private configService = inject(ConfigService);

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

  /** Check connection by listing collections with limit 1 */
  checkConnection(): Observable<ChromaCollection[]> {
    return from(this.baseUrl()).pipe(
      switchMap(async (base) => {
        const headers = await this.headers();
        const params = new HttpParams().set('limit', '1').set('offset', '0');
        return this.http.get<ChromaCollection[]>(
          `${base}/collections`,
          { headers, params }
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
