import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  catchError,
  filter,
  switchMap,
  take,
  throwError,
} from 'rxjs';
import { AuthService } from './auth.service';
import { TokenStorage } from './token-storage';

// Estado compartido para coordinar un unico refresh concurrente.
let refrescando = false;
const tokenNuevo$ = new BehaviorSubject<string | null>(null);

const RUTAS_SIN_TOKEN = ['/auth/login', '/auth/refresh', '/auth/mfa'];

export function tokenInterceptor(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> {
  const tokens = inject(TokenStorage);
  const auth = inject(AuthService);

  const esRutaAuth = RUTAS_SIN_TOKEN.some((r) => req.url.includes(r));
  const conAuth = (r: HttpRequest<unknown>, token: string | null) =>
    token && !r.headers.has('Authorization')
      ? r.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : r;

  const peticion = esRutaAuth ? req : conAuth(req, tokens.accessToken());

  return next(peticion).pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        esRutaAuth ||
        !tokens.refreshToken()
      ) {
        return throwError(() => error);
      }

      if (refrescando) {
        return tokenNuevo$.pipe(
          filter((t): t is string => t !== null),
          take(1),
          switchMap((t) => next(conAuth(req, t))),
        );
      }

      refrescando = true;
      tokenNuevo$.next(null);

      return auth.refrescar().pipe(
        switchMap((r) => {
          refrescando = false;
          tokenNuevo$.next(r.access_token);
          return next(conAuth(req, r.access_token));
        }),
        catchError((err) => {
          refrescando = false;
          auth.finalizarSesionLocal();
          return throwError(() => err);
        }),
      );
    }),
  );
}
