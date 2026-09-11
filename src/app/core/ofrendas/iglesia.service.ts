import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AsignacionMinistro } from '../models/ofrendas.models';

interface DatosAsignarMinistro {
  ministro_id: number;
  fecha_desde: string;
  motivo?: string | null;
}

/**
 * Acciones propias de Iglesia que no siguen el contrato CRUD genérico de
 * {@see CatalogoService}: historial de ministros y asignación de un nuevo
 * ministro (ver {@see \App\Services\Ofrendas\AsignacionMinistroService} en
 * el backend).
 */
@Injectable({ providedIn: 'root' })
export class IglesiaService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/catalogos/eclesiastico/iglesias`;

  /** Historial completo de asignaciones de ministro de una iglesia, más reciente primero. */
  historialMinistros(iglesiaId: number): Observable<{ data: AsignacionMinistro[] }> {
    return this.http.get<{ data: AsignacionMinistro[] }>(
      `${this.base}/${iglesiaId}/historial-ministros`,
    );
  }

  /** Asigna un ministro a una iglesia; cierra automáticamente la asignación activa anterior. */
  asignarMinistro(
    iglesiaId: number,
    datos: DatosAsignarMinistro,
  ): Observable<{ data: AsignacionMinistro }> {
    return this.http.post<{ data: AsignacionMinistro }>(
      `${this.base}/${iglesiaId}/asignar-ministro`,
      datos,
    );
  }
}
