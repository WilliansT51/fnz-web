import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BoletaPastoral, Paginado } from '../models/ofrendas.models';

/** Línea a enviar al crear/actualizar una boleta pastoral. */
export interface LineaBoletaPastoralNueva {
  concepto_movimiento_id: number;
  monto: number;
}

/**
 * Cliente HTTP de la Boleta Mensual del pastor. Ver
 * {@see \App\Http\Controllers\Ofrendas\BoletaPastoralController} en el
 * backend.
 */
@Injectable({ providedIn: 'root' })
export class BoletaPastoralService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/ofrendas/boletas-pastorales`;

  /**
   * Ofrenda asignada al mes: la "Ofrenda Familiar" de los informes mensuales de la iglesia.
   * @param iglesiaId  iglesia de la boleta.
   * @param mes        mes 1-12.
   * @param anio       año.
   * @param ministroId ministro de la boleta (opcional).
   */
  ofrendaAsignada(iglesiaId: number, mes: number, anio: number, ministroId: number | null): Observable<{ data: { ofrenda_asignada: number } }> {
    let params = new HttpParams().set('iglesia_id', iglesiaId).set('mes', mes).set('anio', anio);
    if (ministroId) params = params.set('ministro_id', ministroId);
    return this.http.get<{ data: { ofrenda_asignada: number } }>(`${this.base}/ofrenda-asignada`, { params });
  }

  /** Lista paginada, filtrable por iglesia_id, ministro_id, estado, mes, anio. */
  listar(filtro: Record<string, unknown>): Observable<Paginado<BoletaPastoral>> {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(filtro)) {
      if (valor !== undefined && valor !== null && valor !== '') {
        params = params.set(clave, String(valor));
      }
    }
    return this.http.get<Paginado<BoletaPastoral>>(this.base, { params });
  }

  /** Detalle con líneas y su concepto. */
  obtener(id: number): Observable<{ data: BoletaPastoral }> {
    return this.http.get<{ data: BoletaPastoral }>(`${this.base}/${id}`);
  }

  /** Captura una boleta nueva (nace PENDIENTE). */
  crear(
    iglesiaId: number,
    ministroId: number,
    mes: number,
    anio: number,
    ofrendaAsignada: number,
    lineas: LineaBoletaPastoralNueva[],
  ): Observable<{ data: BoletaPastoral }> {
    return this.http.post<{ data: BoletaPastoral }>(this.base, {
      iglesia_id: iglesiaId,
      ministro_id: ministroId,
      mes,
      anio,
      ofrenda_asignada: ofrendaAsignada,
      lineas,
    });
  }

  /**
   * Reemplaza la ofrenda asignada y las líneas de una boleta. Si ya estaba aprobada o
   * rechazada es una corrección: lleva el motivo y la boleta vuelve a pendiente.
   * @param id              boleta.
   * @param ofrendaAsignada ofrenda asignada del mes.
   * @param lineas          renglones de necesidades.
   * @param motivo          motivo de la corrección (solo cuando ya estaba resuelta).
   */
  actualizar(id: number, ofrendaAsignada: number, lineas: LineaBoletaPastoralNueva[], motivo?: string): Observable<{ data: BoletaPastoral }> {
    return this.http.put<{ data: BoletaPastoral }>(`${this.base}/${id}`, { ofrenda_asignada: ofrendaAsignada, lineas, ...(motivo ? { motivo } : {}) });
  }

  /** Aprueba una boleta pendiente. */
  aprobar(id: number, comentario?: string): Observable<{ data: BoletaPastoral }> {
    return this.http.post<{ data: BoletaPastoral }>(`${this.base}/${id}/aprobar`, { comentario });
  }

  /** Rechaza una boleta pendiente. */
  rechazar(id: number, comentario?: string): Observable<{ data: BoletaPastoral }> {
    return this.http.post<{ data: BoletaPastoral }>(`${this.base}/${id}/rechazar`, { comentario });
  }
}
