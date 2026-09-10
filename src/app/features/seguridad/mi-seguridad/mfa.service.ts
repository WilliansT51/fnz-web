import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface EstadoMfa {
  habilitado: boolean;
  tipo: 'totp' | 'correo' | null;
}

@Injectable({ providedIn: 'root' })
export class MfaService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/seguridad/mi/mfa`;

  estado(): Observable<EstadoMfa> {
    return this.http.get<EstadoMfa>(this.base);
  }

  iniciarTotp(): Observable<{ secreto: string; uri: string }> {
    return this.http.post<{ secreto: string; uri: string }>(`${this.base}/totp`, {});
  }

  confirmarTotp(secreto: string, codigo: string): Observable<{ mensaje: string }> {
    return this.http.put<{ mensaje: string }>(`${this.base}/totp`, { secreto, codigo });
  }

  activarCorreo(): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${this.base}/correo`, {});
  }

  desactivar(password: string): Observable<{ mensaje: string }> {
    return this.http.request<{ mensaje: string }>('delete', this.base, { body: { password } });
  }
}
