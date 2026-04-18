# Chroma Desc

Angular 21 admin UI for ChromaDB using the REST API. Standalone components and Angular Material.

## Features

- **Connection** – Check ChromaDB connectivity (API URL, tenant, database).
- **Collections** – List (up to 500), create, delete, open collection.
- **Documents** – List with server-side pagination (25 per page), add, edit metadata only, delete, semantic search (text query).

## Configuration

Edit `public/config.json` (or the same file in your build output):

```json
{
  "apiBaseUrl": "https://your-chroma-api/api/v2",
  "tenant": "your-tenant-uuid",
  "database": "your_database",
  "apiKey": null
}
```

- **apiBaseUrl** – Base URL including `/api/v2` (no trailing slash).
- **tenant** – Tenant UUID.
- **database** – Database name.
- **apiKey** – Optional. When set, sent as `x-chroma-token` header. For production you can also set `window.env.CHROMA_API_KEY` (e.g. via env replacement in the build).

## Run ChromaDB locally with Docker

Docker-related files live in **`docker/chromadb/`** (compose + seed script). Local bind-mount data, `.env`, and `docker-compose.override.yml` in that folder are listed in `.gitignore` so they are not committed.

From the repository root:

```bash
cd docker/chromadb
docker compose up -d chromadb
docker compose run --rm chromadb-seed
```

What this creates:

- ChromaDB at `http://localhost:8000`
- API base URL `http://localhost:8000/api/v2`
- Tenant `default_tenant`
- Database `default_database`
- Test collection `test_table` with 3 seeded rows

Optional checks:

```bash
curl http://localhost:8000/api/v2/heartbeat
```

Stop services (run from `docker/chromadb`):

```bash
docker compose down
```

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
