import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { InformeFinanciero, LineaInformeNueva, Paginado } from '../models/ofrendas.models';

/**
 * Cliente HTTP del Informe Financiero Mensual. Ver
 * {@see \App\Http\Controllers\Ofrendas\InformeFinancieroController} en el
 * backend.
 */
@Injectable({ providedIn: 'root' })
export class InformeFinancieroService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/ofrendas/informes`;

  /** Lista paginada, filtrable por iglesia_id, estado, mes, anio. */
  listar(filtro: Record<string, unknown>): Observable<Paginado<InformeFinanciero>> {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(filtro)) {
      if (valor !== undefined && valor !== null && valor !== '') {
        params = params.set(clave, String(valor));
      }
    }
    return this.http.get<Paginado<InformeFinanciero>>(this.base, { params });
  }

  /** Detalle con líneas, su concepto y su boleta. */
  obtener(id: number): Observable<{ data: InformeFinanciero }> {
    return this.http.get<{ data: InformeFinanciero }>(`${this.base}/${id}`);
  }

  /** Captura un informe nuevo (nace PENDIENTE). */
  crear(
    iglesiaId: number,
    mes: number,
    anio: number,
    lineas: LineaInformeNueva[],
  ): Observable<{ data: InformeFinanciero }> {
    return this.http.post<{ data: InformeFinanciero }>(this.base, { iglesia_id: iglesiaId, mes, anio, lineas });
  }

  /** Reemplaza las líneas de un informe PENDIENTE. */
  actualizar(id: number, lineas: LineaInformeNueva[]): Observable<{ data: InformeFinanciero }> {
    return this.http.put<{ data: InformeFinanciero }>(`${this.base}/${id}`, { lineas });
  }

  /** Aprueba un informe pendiente (aplica sus totales como definitivos). */
  aprobar(id: number, comentario?: string): Observable<{ data: InformeFinanciero }> {
    return this.http.post<{ data: InformeFinanciero }>(`${this.base}/${id}/aprobar`, { comentario });
  }

  /** Rechaza un informe pendiente (puede volver a editarse y reenviarse). */
  rechazar(id: number, comentario?: string): Observable<{ data: InformeFinanciero }> {
    return this.http.post<{ data: InformeFinanciero }>(`${this.base}/${id}/rechazar`, { comentario });
  }
}
