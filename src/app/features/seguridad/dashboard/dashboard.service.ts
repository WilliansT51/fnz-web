import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface PuntoSerie {
  dia: string;
  total: number;
}

export interface ResumenDashboard {
  usuarios: {
    total: number;
    activos: number;
    inactivos: number;
    bloqueados: number;
    pendientes: number;
    con_mfa: number;
  };
  sesiones: { activas: number; en_linea: number };
  intentos_hoy: { exitosos: number; fallidos: number };
  accesos_por_dia: PuntoSerie[];
  fallos_por_dia: PuntoSerie[];
  top_ips_fallidas: { ip: string; total: number }[];
  alertas: { nivel: 'ok' | 'info' | 'warn' | 'crit'; texto: string }[];
  generado_en: string;
}

export interface TiempoReal {
  en_linea: number;
  conectados: { usuario: string; ip: string; dispositivo: string | null; desde: string }[];
  ultimos_eventos: { evento: string; usuario: string | null; ip: string; fecha: string }[];
  generado_en: string;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/seguridad/dashboard`;

  resumen(): Observable<ResumenDashboard> {
    return this.http.get<ResumenDashboard>(this.base);
  }

  tiempoReal(): Observable<TiempoReal> {
    return this.http.get<TiempoReal>(`${this.base}/tiempo-real`);
  }
}
