import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Paginado, SolicitudCambio } from '../models/ofrendas.models';

/**
 * Cliente HTTP de la bandeja de solicitudes de cambio (maker-checker). Ver
 * {@see \App\Http\Controllers\Ofrendas\SolicitudCambioController} en el
 * backend.
 */
@Injectable({ providedIn: 'root' })
export class SolicitudCambioService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/ofrendas/solicitudes`;

  /** Lista paginada, filtrable por `estado` (PENDIENTE|APROBADA|RECHAZADA). */
  listar(filtro: { estado?: string; page?: number; por_pagina?: number }): Observable<Paginado<SolicitudCambio>> {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(filtro)) {
      if (valor !== undefined && valor !== null && valor !== '') {
        params = params.set(clave, String(valor));
      }
    }
    return this.http.get<Paginado<SolicitudCambio>>(this.base, { params });
  }

  /** Aprueba una solicitud pendiente; aplica el cambio sobre el registro real. */
  aprobar(id: number, comentario?: string): Observable<{ data: SolicitudCambio }> {
    return this.http.post<{ data: SolicitudCambio }>(`${this.base}/${id}/aprobar`, { comentario });
  }

  /** Rechaza una solicitud pendiente; el registro original no se modifica. */
  rechazar(id: number, comentario?: string): Observable<{ data: SolicitudCambio }> {
    return this.http.post<{ data: SolicitudCambio }>(`${this.base}/${id}/rechazar`, { comentario });
  }
}
