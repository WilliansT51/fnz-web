import { Routes } from '@angular/router';
import {
  authGuard,
  cambioPasswordGuard,
  invitadoGuard,
  permisoGuard,
} from './core/auth/auth.guards';

export const routes: Routes = [
  {
    path: 'ingresar',
    canActivate: [invitadoGuard],
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
    title: 'Ingresar · FNZ',
  },
  {
    path: 'recuperar',
    canActivate: [invitadoGuard],
    loadComponent: () =>
      import('./features/auth/olvide-password.component').then((m) => m.OlvidePasswordComponent),
    title: 'Recuperar contraseña · FNZ',
  },
  {
    path: 'restablecer',
    loadComponent: () =>
      import('./features/auth/restablecer-password.component').then(
        (m) => m.RestablecerPasswordComponent,
      ),
    title: 'Nueva contraseña · FNZ',
  },
  {
    path: 'cambiar-password',
    canActivate: [cambioPasswordGuard],
    loadComponent: () =>
      import('./features/auth/cambiar-password.component').then(
        (m) => m.CambiarPasswordComponent,
      ),
    title: 'Cambiar contraseña · FNZ',
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/layout/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'seguridad/dashboard' },
      {
        path: 'seguridad/dashboard',
        canActivate: [permisoGuard],
        data: { permisos: ['dashboard.consultar'] },
        loadComponent: () =>
          import('./features/seguridad/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
        title: 'Dashboard de seguridad · FNZ',
      },
      {
        path: 'seguridad/usuarios',
        canActivate: [permisoGuard],
        data: { permisos: ['usuarios.consultar'] },
        loadComponent: () =>
          import('./features/seguridad/usuarios/usuarios.component').then(
            (m) => m.UsuariosComponent,
          ),
        title: 'Usuarios · FNZ',
      },
      {
        path: 'seguridad/roles',
        canActivate: [permisoGuard],
        data: { permisos: ['roles.consultar'] },
        loadComponent: () =>
          import('./features/seguridad/roles/roles.component').then(
            (m) => m.RolesComponent,
          ),
        title: 'Roles y permisos · FNZ',
      },
      {
        path: 'seguridad/sesiones',
        canActivate: [permisoGuard],
        data: { permisos: ['sesiones.consultar'] },
        loadComponent: () =>
          import('./features/seguridad/sesiones/sesiones.component').then(
            (m) => m.SesionesComponent,
          ),
        title: 'Sesiones activas · FNZ',
      },
      {
        path: 'seguridad/auditoria',
        canActivate: [permisoGuard],
        data: { permisos: ['auditoria.consultar'] },
        loadComponent: () =>
          import('./features/seguridad/auditoria/auditoria.component').then(
            (m) => m.AuditoriaComponent,
          ),
        title: 'Auditoría · FNZ',
      },
      {
        path: 'seguridad/mi-seguridad',
        loadComponent: () =>
          import('./features/seguridad/mi-seguridad/mi-seguridad.component').then(
            (m) => m.MiSeguridadComponent,
          ),
        title: 'Mi seguridad · FNZ',
      },
      {
        path: 'catalogos/ubicacion',
        canActivate: [permisoGuard],
        data: { permisos: ['ubicacion.consultar'] },
        loadComponent: () =>
          import('./features/ofrendas/ubicacion/ubicacion.component').then(
            (m) => m.UbicacionComponent,
          ),
        title: 'Ubicación · FNZ',
      },
      {
        path: 'catalogos/eclesiastico',
        canActivate: [permisoGuard],
        data: { permisos: ['eclesiastico.consultar'] },
        loadComponent: () =>
          import('./features/ofrendas/eclesiastico/eclesiastico.component').then(
            (m) => m.EclesiasticoComponent,
          ),
        title: 'Estructura eclesiástica · FNZ',
      },
      {
        path: 'catalogos/financiero',
        canActivate: [permisoGuard],
        data: { permisos: ['financiero.consultar'] },
        loadComponent: () =>
          import('./features/ofrendas/financiero/financiero.component').then(
            (m) => m.FinancieroComponent,
          ),
        title: 'Catálogos financieros · FNZ',
      },
      {
        path: 'ofrendas/informes',
        canActivate: [permisoGuard],
        data: { permisos: ['informes.consultar'] },
        loadComponent: () =>
          import('./features/ofrendas/informes/informes.component').then(
            (m) => m.InformesComponent,
          ),
        title: 'Informes financieros · FNZ',
      },
      {
        path: 'ofrendas/boletas-pastorales',
        canActivate: [permisoGuard],
        data: { permisos: ['boletas-pastorales.consultar'] },
        loadComponent: () =>
          import('./features/ofrendas/boletas-pastorales/boletas-pastorales.component').then(
            (m) => m.BoletasPastoralesComponent,
          ),
        title: 'Boletas mensuales del pastor · FNZ',
      },
      {
        path: 'prestamos',
        canActivate: [permisoGuard],
        data: { permisos: ['prestamos.consultar'] },
        loadComponent: () =>
          import('./features/prestamos/prestamos.component').then((m) => m.PrestamosComponent),
        title: 'Préstamos · FNZ',
      },
      {
        path: 'gastos',
        canActivate: [permisoGuard],
        data: { permisos: ['gastos.consultar'] },
        loadComponent: () => import('./features/gastos/gastos.component').then((m) => m.GastosComponent),
        title: 'Control de gastos · FNZ',
      },
      {
        path: 'prestamos/pagos',
        canActivate: [permisoGuard],
        data: { permisos: ['pagos.consultar'] },
        loadComponent: () =>
          import('./features/prestamos/pagos-prestamos.component').then((m) => m.PagosPrestamosComponent),
        title: 'Pagos de préstamos · FNZ',
      },
      {
        path: 'sin-permiso',
        loadComponent: () =>
          import('./features/layout/sin-permiso.component').then(
            (m) => m.SinPermisoComponent,
          ),
        title: 'Sin permiso · FNZ',
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
