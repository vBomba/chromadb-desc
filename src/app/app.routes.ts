import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'connection',
    pathMatch: 'full',
  },
  {
    path: '',
    loadComponent: () =>
      import('./layout/dashboard-layout/dashboard-layout').then((m) => m.DashboardLayoutComponent),
    children: [
      {
        path: 'connection',
        loadComponent: () =>
          import('./features/connection/connection.component').then((m) => m.ConnectionComponent),
      },
      {
        path: 'collections',
        loadComponent: () =>
          import('./features/collections/collections-list/collections-list.component').then(
            (m) => m.CollectionsListComponent
          ),
      },
      {
        path: 'collections/:collectionId/documents',
        loadComponent: () =>
          import('./features/documents/documents-page/documents-page.component').then(
            (m) => m.DocumentsPageComponent
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'connection' },
];
