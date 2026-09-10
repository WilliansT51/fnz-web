import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Observable, catchError, throwError } from 'rxjs';

/**
 * Traduce los errores de la API a mensajes visibles. Deja pasar 401/422
 * para que los componentes los manejen (login, validaciones de formulario).
 */
export function errorInterceptor(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> {
  const mensajes = inject(MessageService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && ![401, 422].includes(error.status)) {
        mensajes.add({
          severity: error.status === 403 ? 'warn' : 'error',
          summary: resumen(error.status),
          detail: detalle(error),
          life: 6000,
        });
      }
      return throwError(() => error);
    }),
  );
}

function resumen(status: number): string {
  if (status === 0) return 'Sin conexión';
  if (status === 403) return 'Acceso denegado';
  if (status === 429) return 'Demasiadas solicitudes';
  if (status >= 500) return 'Error del servidor';
  return 'Error';
}

function detalle(error: HttpErrorResponse): string {
  // Fallo de red / servidor inalcanzable: 'Failed to fetch' es el texto crudo
  // de la API Fetch; lo traducimos antes de mirar el cuerpo del error.
  if (error.status === 0) {
    return 'No se pudo conectar con el servidor. Verifica que la API esté disponible.';
  }
  if (error.status === 429) {
    return 'Has hecho demasiadas solicitudes. Espera un momento e inténtalo de nuevo.';
  }
  if (error.status >= 500) {
    return 'El servidor tuvo un problema al procesar la solicitud.';
  }

  const cuerpo = error.error;
  return (
    cuerpo?.mensaje ??
    (typeof cuerpo?.message === 'string' && cuerpo.message !== 'Failed to fetch'
      ? cuerpo.message
      : null) ??
    'Ocurrió un error inesperado.'
  );
}
