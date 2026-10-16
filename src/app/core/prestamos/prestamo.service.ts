import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PagoNuevo, Paginado, Prestamo, PrestamoNuevo, PrestamoPago } from '../models/prestamos.models';

/**
 * Cliente HTTP del módulo de préstamos. Ver
 * {@see \App\Http\Controllers\Prestamos\PrestamoController} en el backend.
 */
@Injectable({ providedIn: 'root' })
export class PrestamoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/prestamos`;

  /**
   * Lista paginada de préstamos.
   * @param filtro estado, iglesia_id, ministro_id, page, por_pagina.
   */
  listar(filtro: Record<string, unknown>): Observable<Paginado<Prestamo>> {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(filtro)) {
      if (valor !== undefined && valor !== null && valor !== '') {
        params = params.set(clave, String(valor));
      }
    }
    return this.http.get<Paginado<Prestamo>>(this.base, { params });
  }

  /** Detalle con tabla de cuotas e historial de pagos. @param id id del préstamo. */
  obtener(id: number): Observable<{ data: Prestamo }> {
    return this.http.get<{ data: Prestamo }>(`${this.base}/${id}`);
  }

  /** Captura un préstamo nuevo (nace PENDIENTE) con su tabla de cuotas. @param datos formulario. */
  crear(datos: PrestamoNuevo): Observable<{ data: Prestamo }> {
    return this.http.post<{ data: Prestamo }>(this.base, datos);
  }

  /** Aprueba (desembolsa) un préstamo pendiente. @param id préstamo. @param comentario opcional. */
  aprobar(id: number, comentario?: string): Observable<{ data: Prestamo }> {
    return this.http.post<{ data: Prestamo }>(`${this.base}/${id}/aprobar`, { comentario });
  }

  /** Rechaza un préstamo pendiente. @param id préstamo. @param comentario opcional. */
  rechazar(id: number, comentario?: string): Observable<{ data: Prestamo }> {
    return this.http.post<{ data: Prestamo }>(`${this.base}/${id}/rechazar`, { comentario });
  }

  /** Registra un pago/abono; se aplica a las cuotas más antiguas. @param id préstamo. @param pago datos del pago. */
  registrarPago(id: number, pago: PagoNuevo): Observable<{ data: PrestamoPago }> {
    return this.http.post<{ data: PrestamoPago }>(`${this.base}/${id}/pagos`, pago);
  }

  /** Anula un pago con motivo. @param id préstamo. @param pagoId pago. @param motivo razón de la anulación. */
  anularPago(id: number, pagoId: number, motivo: string): Observable<{ data: PrestamoPago }> {
    return this.http.post<{ data: PrestamoPago }>(`${this.base}/${id}/pagos/${pagoId}/anular`, { motivo });
  }
}
