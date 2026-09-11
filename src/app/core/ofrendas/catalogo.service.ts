import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Paginado } from '../models/ofrendas.models';

/**
 * Cliente HTTP genérico para los catálogos del sistema de Ofrendas, todos
 * expuestos bajo el mismo contrato CRUD por
 * {@see \App\Http\Controllers\Catalogos\CatalogoController} en el backend.
 * `endpoint` es la ruta relativa a `environment.apiUrl` (p. ej.
 * "catalogos/ubicacion/paises").
 */
@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private readonly http = inject(HttpClient);

  /**
   * Lista paginada de un catálogo, con búsqueda (`q`) y filtros adicionales
   * (FK, estado, etc.) según lo que acepte el endpoint.
   *
   * @param  endpoint  Ruta relativa del catálogo.
   * @param  filtro    Parámetros de query (se omiten los `undefined`/vacíos).
   */
  listar<T>(endpoint: string, filtro: Record<string, unknown> = {}): Observable<Paginado<T>> {
    return this.http.get<Paginado<T>>(this.url(endpoint), { params: this.armarParams(filtro) });
  }

  /**
   * Trae TODOS los registros de un catálogo sin paginar (`?todos=1`), útil
   * para poblar selects en cascada.
   *
   * @param  endpoint  Ruta relativa del catálogo.
   * @param  filtro    Parámetros de query adicionales (p. ej. una FK padre).
   */
  todos<T>(endpoint: string, filtro: Record<string, unknown> = {}): Observable<{ data: T[] }> {
    return this.http.get<{ data: T[] }>(this.url(endpoint), {
      params: this.armarParams({ ...filtro, todos: 1 }),
    });
  }

  /** Crea un registro nuevo en el catálogo. */
  crear<T>(endpoint: string, datos: Record<string, unknown>): Observable<{ data: T }> {
    return this.http.post<{ data: T }>(this.url(endpoint), datos);
  }

  /** Actualiza un registro existente del catálogo. */
  actualizar<T>(
    endpoint: string,
    id: number,
    datos: Record<string, unknown>,
  ): Observable<{ data: T }> {
    return this.http.put<{ data: T }>(`${this.url(endpoint)}/${id}`, datos);
  }

  /** Da de baja (lógica) un registro del catálogo. */
  eliminar(endpoint: string, id: number): Observable<unknown> {
    return this.http.delete(`${this.url(endpoint)}/${id}`);
  }

  private url(endpoint: string): string {
    return `${environment.apiUrl}/${endpoint}`;
  }

  private armarParams(filtro: Record<string, unknown>): HttpParams {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(filtro)) {
      if (valor !== undefined && valor !== null && valor !== '') {
        params = params.set(clave, String(valor));
      }
    }
    return params;
  }
}
