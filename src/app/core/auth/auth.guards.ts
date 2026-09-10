import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
} from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';

/** Requiere sesion. Si hay token pero no usuario cargado, lo carga. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.autenticado()) return verificarCambioPassword(auth, router);
  if (!auth.hayToken()) return router.parseUrl('/ingresar');

  return auth.cargarSesion().pipe(
    map(() => verificarCambioPassword(auth, router)),
    catchError(() => {
      auth.finalizarSesionLocal(false);
      return of(router.parseUrl('/ingresar'));
    }),
  );
};

/** Solo para invitados (pantalla de ingreso). */
export const invitadoGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.autenticado() ? router.parseUrl('/') : true;
};

/** Exige uno de los permisos indicados en route.data['permisos']. */
export const permisoGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const requeridos = (route.data['permisos'] as string[] | undefined) ?? [];

  if (requeridos.length === 0 || auth.tienePermiso(...requeridos)) return true;
  return router.parseUrl('/sin-permiso');
};

/**
 * Pantalla de cambio de contrasena. Accesible por cualquier usuario
 * autenticado (cambio voluntario); el authGuard obliga a pasar por aqui
 * a quien tiene el cambio pendiente.
 */
export const cambioPasswordGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.autenticado()) return true;
  if (!auth.hayToken()) return router.parseUrl('/ingresar');

  return auth.cargarSesion().pipe(
    map(() => true),
    catchError(() => {
      auth.finalizarSesionLocal(false);
      return of(router.parseUrl('/ingresar'));
    }),
  );
};

function verificarCambioPassword(auth: AuthService, router: Router) {
  return auth.debeCambiarPassword() ? router.parseUrl('/cambiar-password') : true;
}
