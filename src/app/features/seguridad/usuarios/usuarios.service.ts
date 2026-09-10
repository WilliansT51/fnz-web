import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CatalogosUsuarios,
  FiltroUsuarios,
  Paginado,
  Usuario,
} from '../../../core/models/seguridad.models';

export interface DatosUsuario {
  nombre: string;
  apellido: string;
  correo: string;
  usuario: string;
  password?: string;
  estado?: string;
  roles?: number[];
}

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/seguridad/usuarios`;

  listar(filtro: FiltroUsuarios): Observable<Paginado<Usuario>> {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(filtro)) {
      if (valor !== undefined && valor !== null && valor !== '') {
        params = params.set(clave, String(valor));
      }
    }
    return this.http.get<Paginado<Usuario>>(this.base, { params });
  }

  catalogos(): Observable<CatalogosUsuarios> {
    return this.http.get<CatalogosUsuarios>(`${this.base}/catalogos`);
  }

  obtener(id: number): Observable<{ data: Usuario }> {
    return this.http.get<{ data: Usuario }>(`${this.base}/${id}`);
  }

  crear(datos: DatosUsuario): Observable<{ data: Usuario }> {
    return this.http.post<{ data: Usuario }>(this.base, datos);
  }

  actualizar(id: number, datos: Partial<DatosUsuario>): Observable<{ data: Usuario }> {
    return this.http.put<{ data: Usuario }>(`${this.base}/${id}`, datos);
  }

  eliminar(id: number): Observable<unknown> {
    return this.http.delete(`${this.base}/${id}`);
  }

  cambiarEstado(
    id: number,
    accion: 'activar' | 'desactivar' | 'bloquear' | 'desbloquear',
  ): Observable<{ data: Usuario }> {
    return this.http.post<{ data: Usuario }>(`${this.base}/${id}/${accion}`, {});
  }

  restablecerPassword(
    id: number,
    password?: string,
  ): Observable<{ mensaje: string; password_temporal: string | null }> {
    return this.http.post<{ mensaje: string; password_temporal: string | null }>(
      `${this.base}/${id}/restablecer-password`,
      password ? { password } : {},
    );
  }
}
