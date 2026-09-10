import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface Rol {
  id: number;
  nombre: string;
  descripcion: string | null;
  es_sistema: boolean;
  estado: boolean;
  total_usuarios?: number;
  total_permisos?: number;
  permisos?: string[];
}

export interface PermisoCatalogo {
  id: number;
  codigo: string;
  accion: string;
  nombre: string;
}

export interface GrupoPermisos {
  modulo: string;
  nombre: string;
  permisos: PermisoCatalogo[];
}

export interface DatosRol {
  nombre: string;
  descripcion?: string | null;
  estado?: boolean;
  permisos?: number[];
}

@Injectable({ providedIn: 'root' })
export class RolesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/seguridad`;

  listar(): Observable<{ data: Rol[] }> {
    return this.http.get<{ data: Rol[] }>(`${this.base}/roles`);
  }

  obtener(id: number): Observable<{ data: Rol }> {
    return this.http.get<{ data: Rol }>(`${this.base}/roles/${id}`);
  }

  crear(datos: DatosRol): Observable<{ data: Rol }> {
    return this.http.post<{ data: Rol }>(`${this.base}/roles`, datos);
  }

  actualizar(id: number, datos: Partial<DatosRol>): Observable<{ data: Rol }> {
    return this.http.put<{ data: Rol }>(`${this.base}/roles/${id}`, datos);
  }

  eliminar(id: number): Observable<unknown> {
    return this.http.delete(`${this.base}/roles/${id}`);
  }

  permisos(): Observable<{ data: GrupoPermisos[] }> {
    return this.http.get<{ data: GrupoPermisos[] }>(`${this.base}/permisos`);
  }
}
