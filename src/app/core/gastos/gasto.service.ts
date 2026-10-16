import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Gasto, GastoNuevo, Paginado } from '../models/gastos.models';

/**
 * Cliente HTTP del módulo Control de Gastos. Ver
 * {@see \App\Http\Controllers\Gastos\GastoController} en el backend.
 */
@Injectable({ providedIn: 'root' })
export class GastoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/gastos`;

  /**
   * Lista paginada de gastos.
   * @param filtro estado, categoria, gasto_tipo_id, q, page, por_pagina.
   */
  listar(filtro: Record<string, unknown>): Observable<Paginado<Gasto>> {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(filtro)) {
      if (valor !== undefined && valor !== null && valor !== '') {
        params = params.set(clave, String(valor));
      }
    }
    return this.http.get<Paginado<Gasto>>(this.base, { params });
  }

  /** Detalle de un gasto. @param id gasto. */
  obtener(id: number): Observable<{ data: Gasto }> {
    return this.http.get<{ data: Gasto }>(`${this.base}/${id}`);
  }

  /** Registra un gasto (nace PENDIENTE). @param datos formulario. */
  crear(datos: GastoNuevo): Observable<{ data: Gasto }> {
    return this.http.post<{ data: Gasto }>(this.base, datos);
  }

  /**
   * Modifica un gasto. Si ya estaba aprobado o rechazado es una corrección: lleva
   * el motivo y el gasto vuelve a pendiente de aprobación.
   * @param id     gasto.
   * @param datos  formulario.
   * @param motivo motivo de la corrección (solo cuando el gasto ya estaba resuelto).
   */
  actualizar(id: number, datos: GastoNuevo, motivo?: string): Observable<{ data: Gasto }> {
    return this.http.put<{ data: Gasto }>(`${this.base}/${id}`, motivo ? { ...datos, motivo } : datos);
  }

  /** Aprueba un gasto pendiente. @param id gasto. @param comentario opcional. */
  aprobar(id: number, comentario?: string): Observable<{ data: Gasto }> {
    return this.http.post<{ data: Gasto }>(`${this.base}/${id}/aprobar`, { comentario });
  }

  /** Rechaza un gasto pendiente. @param id gasto. @param comentario motivo del rechazo (opcional). */
  rechazar(id: number, comentario?: string): Observable<{ data: Gasto }> {
    return this.http.post<{ data: Gasto }>(`${this.base}/${id}/rechazar`, { comentario });
  }

  /** Descarga el comprobante de pago (PDF) de un gasto aprobado. @param id gasto. */
  comprobante(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/comprobante`, { responseType: 'blob' });
  }
}
