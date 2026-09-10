import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  DesafioMfa,
  RespuestaLogin,
  RespuestaMe,
  Usuario,
} from '../models/seguridad.models';
import { TokenStorage } from './token-storage';

interface CredencialesLogin {
  usuario: string;
  password: string;
  recordar?: boolean;
  captcha?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokens = inject(TokenStorage);
  private readonly router = inject(Router);
  private readonly base = `${environment.apiUrl}/auth`;

  private readonly _usuario = signal<Usuario | null>(null);
  private readonly _cargado = signal(false);

  readonly usuario = this._usuario.asReadonly();
  readonly cargado = this._cargado.asReadonly();
  readonly autenticado = computed(() => this._usuario() !== null);
  readonly permisos = computed(() => new Set(this._usuario()?.permisos ?? []));
  readonly debeCambiarPassword = computed(
    () => this._usuario()?.debe_cambiar_password ?? false,
  );

  tienePermiso(...codigos: string[]): boolean {
    const p = this.permisos();
    return codigos.some((c) => p.has(c));
  }

  hayToken(): boolean {
    return this.tokens.accessToken() !== null;
  }

  login(cred: CredencialesLogin): Observable<RespuestaLogin | DesafioMfa> {
    return this.http
      .post<RespuestaLogin | DesafioMfa>(`${this.base}/login`, cred)
      .pipe(
        tap((r) => {
          if (!('mfa_requerido' in r)) this.establecer(r);
        }),
      );
  }

  verificarMfa(
    mfaToken: string,
    codigo: string,
    recordar: boolean,
  ): Observable<RespuestaLogin> {
    return this.http
      .post<RespuestaLogin>(
        `${this.base}/mfa`,
        { codigo, recordar },
        { headers: { Authorization: `Bearer ${mfaToken}` } },
      )
      .pipe(tap((r) => this.establecer(r)));
  }

  /** Carga el usuario actual a partir del token guardado (arranque de la app). */
  cargarSesion(): Observable<RespuestaMe> {
    return this.http.get<RespuestaMe>(`${this.base}/me`).pipe(
      tap((r) => {
        this._usuario.set(r.usuario);
        this._cargado.set(true);
      }),
    );
  }

  refrescar(): Observable<RespuestaLogin> {
    return this.http
      .post<RespuestaLogin>(`${this.base}/refresh`, {
        refresh_token: this.tokens.refreshToken(),
      })
      .pipe(
        tap((r) => this.tokens.actualizarAcceso(r.access_token, r.refresh_token)),
      );
  }

  cambiarPassword(passwordActual: string, passwordNueva: string): Observable<unknown> {
    return this.http
      .post(`${this.base}/cambiar-password`, {
        password_actual: passwordActual,
        password: passwordNueva,
        password_confirmation: passwordNueva,
      })
      .pipe(
        tap(() => {
          const u = this._usuario();
          if (u) this._usuario.set({ ...u, debe_cambiar_password: false });
        }),
      );
  }

  logout(redirigir = true): void {
    this.http.post(`${this.base}/logout`, {}).subscribe({
      complete: () => this.finalizarSesionLocal(redirigir),
      error: () => this.finalizarSesionLocal(redirigir),
    });
  }

  finalizarSesionLocal(redirigir = true): void {
    this.tokens.limpiar();
    this._usuario.set(null);
    this._cargado.set(true);
    if (redirigir) this.router.navigate(['/ingresar']);
  }

  refrescarUsuario(): void {
    this.cargarSesion().subscribe({ error: () => {} });
  }

  private establecer(r: RespuestaLogin): void {
    this.tokens.guardar(r.access_token, r.refresh_token, r.sesion_id);
    this._usuario.set(r.usuario);
    this._cargado.set(true);
  }
}
