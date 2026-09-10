import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Paginado } from '../../../core/models/seguridad.models';

export interface Sesion {
  id: string;
  usuario: { id: number; nombre: string; usuario: string; correo: string } | null;
  ip: string;
  navegador: string | null;
  navegador_version: string | null;
  sistema_operativo: string | null;
  dispositivo: string | null;
  ubicacion: string | null;
  recordar: boolean;
  iniciada_en: string | null;
  ultima_actividad_en: string | null;
  expira_en: string | null;
  activa: boolean;
  en_linea: boolean;
  es_actual: boolean;
}

export interface EstadisticasSesiones {
  activas: number;
  en_linea: number;
  usuarios_activos: number;
  por_dispositivo: Record<string, number>;
}

export interface FiltroSesiones {
  usuario?: string;
  estado?: 'activas' | 'cerradas' | 'todas';
  en_linea?: boolean;
  page?: number;
  por_pagina?: number;
}

@Injectable({ providedIn: 'root' })
export class SesionesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/seguridad/sesiones`;

  listar(filtro: FiltroSesiones): Observable<Paginado<Sesion>> {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(filtro)) {
      if (v !== undefined && v !== null && v !== '') params = params.set(k, String(v));
    }
    return this.http.get<Paginado<Sesion>>(this.base, { params });
  }

  estadisticas(): Observable<EstadisticasSesiones> {
    return this.http.get<EstadisticasSesiones>(`${this.base}/estadisticas`);
  }

  cerrar(id: string): Observable<unknown> {
    return this.http.delete(`${this.base}/${id}`);
  }

  cerrarUsuario(usuarioId: number): Observable<{ cerradas: number }> {
    return this.http.delete<{ cerradas: number }>(`${this.base}/usuario/${usuarioId}`);
  }
}
