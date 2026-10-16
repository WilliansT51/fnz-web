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

  /**
   * Modifica un préstamo y regenera su tabla de cuotas. Si ya estaba aprobado o rechazado es
   * una corrección: lleva el motivo y el préstamo vuelve a pendiente. No procede si ya tiene pagos.
   * @param id     préstamo.
   * @param datos  formulario.
   * @param motivo motivo de la corrección (solo cuando ya estaba resuelto).
   */
  actualizar(id: number, datos: PrestamoNuevo, motivo?: string): Observable<{ data: Prestamo }> {
    return this.http.put<{ data: Prestamo }>(`${this.base}/${id}`, motivo ? { ...datos, motivo } : datos);
  }

  /** Descarga el comprobante de pago con cheque (PDF) de un préstamo aprobado. @param id préstamo. */
  comprobante(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/comprobante`, { responseType: 'blob' });
  }

  /** Aprueba (desembolsa) un préstamo pendiente. @param id préstamo. @param comentario opcional. */
  aprobar(id: number, comentario?: string): Observable<{ data: Prestamo }> {
    return this.http.post<{ data: Prestamo }>(`${this.base}/${id}/aprobar`, { comentario });
  }

  /** Rechaza un préstamo pendiente. @param id préstamo. @param comentario opcional. */
  rechazar(id: number, comentario?: string): Observable<{ data: Prestamo }> {
    return this.http.post<{ data: Prestamo }>(`${this.base}/${id}/rechazar`, { comentario });
  }

  /**
   * Registra un pago/abono; se aplica a las cuotas más antiguas. Se envía como
   * multipart para poder adjuntar la boleta del depósito.
   * @param id   préstamo.
   * @param pago datos del pago (y archivo opcional).
   */
  registrarPago(id: number, pago: PagoNuevo): Observable<{ data: PrestamoPago }> {
    const datos = new FormData();
    datos.append('fecha_pago', pago.fecha_pago);
    datos.append('monto', String(pago.monto));
    if (pago.referencia) datos.append('referencia', pago.referencia);
    if (pago.observaciones) datos.append('observaciones', pago.observaciones);
    if (pago.archivo) datos.append('archivo', pago.archivo);
    return this.http.post<{ data: PrestamoPago }>(`${this.base}/${id}/pagos`, datos);
  }

  /**
   * Adjunta la boleta del depósito a un pago ya registrado.
   * @param id      préstamo.
   * @param pagoId  pago.
   * @param archivo archivo (pdf, imagen, Word o Excel; máx. 10 MB).
   */
  adjuntarDocumento(id: number, pagoId: number, archivo: File): Observable<unknown> {
    const datos = new FormData();
    datos.append('archivo', archivo);
    return this.http.post(`${this.base}/${id}/pagos/${pagoId}/documentos`, datos);
  }

  /** Descarga un documento adjunto como Blob. @param documentoId id del documento. */
  descargarDocumento(documentoId: number): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/documentos/${documentoId}/descargar`, { responseType: 'blob' });
  }

  /** Anula un pago con motivo. @param id préstamo. @param pagoId pago. @param motivo razón de la anulación. */
  anularPago(id: number, pagoId: number, motivo: string): Observable<{ data: PrestamoPago }> {
    return this.http.post<{ data: PrestamoPago }>(`${this.base}/${id}/pagos/${pagoId}/anular`, { motivo });
  }
}
