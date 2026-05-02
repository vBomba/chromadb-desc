import { Routes } from '@angular/router';
import type { VbShellNavLink } from 'vbomba-ui';

export const CHROMA_SHELL_DATA: { appTitle: string; navLinks: VbShellNavLink[] } = {
  appTitle: 'Chroma Desc',
  navLinks: [
    { path: '/connection', label: 'Connection', icon: 'bx bx-link-alt' },
    { path: '/configuration', label: 'Configuration', icon: 'bx bx-cog' },
    { path: '/server-status', label: 'Server status', icon: 'bx bx-pulse' },
    { path: '/logs', label: 'Logs', icon: 'bx bx-list-ul' },
    { path: '/collections', label: 'Collections', icon: 'bx bx-folder' },
  ],
};

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'connection',
    pathMatch: 'full',
  },
  {
    path: '',
    loadComponent: () =>
      import('./layout/app-chrome/app-chrome.component').then((m) => m.AppChromeComponent),
    data: CHROMA_SHELL_DATA,
    children: [
      {
        path: 'connection',
        loadComponent: () =>
          import('./features/connection/connection.component').then((m) => m.ConnectionComponent),
      },
      {
        path: 'configuration',
        loadComponent: () =>
          import('./features/configuration/configuration.component').then((m) => m.ConfigurationComponent),
      },
      {
        path: 'server-status',
        loadComponent: () =>
          import('./features/server-status/server-status.component').then((m) => m.ServerStatusComponent),
      },
      {
        path: 'logs',
        loadComponent: () =>
          import('./features/logs/logs.component').then((m) => m.LogsComponent),
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
