import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class RecuperacionService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/auth/recuperar`;

  solicitar(correo: string, captcha?: string | null): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(this.base, { correo, captcha });
  }

  validar(correo: string, token: string): Observable<{ valido: boolean }> {
    const params = new HttpParams().set('correo', correo).set('token', token);
    return this.http.get<{ valido: boolean }>(`${this.base}/validar`, { params });
  }

  confirmar(
    correo: string,
    token: string,
    password: string,
  ): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${this.base}/confirmar`, {
      correo,
      token,
      password,
      password_confirmation: password,
    });
  }
}
