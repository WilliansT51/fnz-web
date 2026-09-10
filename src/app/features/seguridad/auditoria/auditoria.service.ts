import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Paginado } from '../../../core/models/seguridad.models';

export interface RegistroAuditoria {
  id: number;
  fecha: string;
  usuario_id: number | null;
  usuario: string | null;
  evento: string;
  modulo: string | null;
  tabla_afectada: string | null;
  registro_id: string | null;
  descripcion: string | null;
  ip: string;
  user_agent?: string | null;
  metodo_http?: string | null;
  url?: string | null;
  valores_anteriores?: Record<string, unknown> | null;
  valores_nuevos?: Record<string, unknown> | null;
  hash_anterior?: string | null;
  hash_registro: string;
}

export interface FiltroAuditoria {
  usuario?: string;
  desde?: string;
  hasta?: string;
  evento?: string;
  modulo?: string;
  tabla?: string;
  q?: string;
  page?: number;
  por_pagina?: number;
}

export interface CatalogosAuditoria {
  eventos: string[];
  modulos: string[];
  tablas: string[];
}

export interface Integridad {
  integra: boolean;
  primer_id_roto: number | null;
  total_registros: number;
  verificado_en: string;
}

@Injectable({ providedIn: 'root' })
export class AuditoriaService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/seguridad/auditoria`;

  listar(filtro: FiltroAuditoria): Observable<Paginado<RegistroAuditoria>> {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(filtro)) {
      if (v !== undefined && v !== null && v !== '') params = params.set(k, String(v));
    }
    return this.http.get<Paginado<RegistroAuditoria>>(this.base, { params });
  }

  detalle(id: number): Observable<{ data: RegistroAuditoria }> {
    return this.http.get<{ data: RegistroAuditoria }>(`${this.base}/${id}`);
  }

  catalogos(): Observable<CatalogosAuditoria> {
    return this.http.get<CatalogosAuditoria>(`${this.base}/catalogos`);
  }

  verificar(): Observable<Integridad> {
    return this.http.get<Integridad>(`${this.base}/verificar`);
  }

  exportar(formato: 'xlsx' | 'csv' | 'pdf', filtro: FiltroAuditoria): Observable<Blob> {
    let params = new HttpParams().set('formato', formato);
    for (const [k, v] of Object.entries(filtro)) {
      if (v !== undefined && v !== null && v !== '' && k !== 'page' && k !== 'por_pagina') {
        params = params.set(k, String(v));
      }
    }
    return this.http.get(`${this.base}/exportar`, { params, responseType: 'blob' });
  }
}
