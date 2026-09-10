import { Injectable, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const CLAVE_ACCESS = 'fnz.access_token';
const CLAVE_REFRESH = 'fnz.refresh_token';
const CLAVE_SESION = 'fnz.sesion_id';

/**
 * Custodia de tokens. En el servidor (SSR) no hay almacenamiento: todo
 * queda en memoria y la app renderiza como invitado hasta hidratar.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorage {
  private readonly esNavegador = isPlatformBrowser(inject(PLATFORM_ID));

  readonly accessToken = signal<string | null>(this.leer(CLAVE_ACCESS));
  readonly refreshToken = signal<string | null>(this.leer(CLAVE_REFRESH));
  readonly sesionId = signal<string | null>(this.leer(CLAVE_SESION));

  guardar(access: string, refresh: string, sesionId: string): void {
    this.accessToken.set(access);
    this.refreshToken.set(refresh);
    this.sesionId.set(sesionId);
    this.escribir(CLAVE_ACCESS, access);
    this.escribir(CLAVE_REFRESH, refresh);
    this.escribir(CLAVE_SESION, sesionId);
  }

  actualizarAcceso(access: string, refresh: string): void {
    this.accessToken.set(access);
    this.refreshToken.set(refresh);
    this.escribir(CLAVE_ACCESS, access);
    this.escribir(CLAVE_REFRESH, refresh);
  }

  limpiar(): void {
    this.accessToken.set(null);
    this.refreshToken.set(null);
    this.sesionId.set(null);
    if (this.esNavegador) {
      localStorage.removeItem(CLAVE_ACCESS);
      localStorage.removeItem(CLAVE_REFRESH);
      localStorage.removeItem(CLAVE_SESION);
    }
  }

  private leer(clave: string): string | null {
    if (!this.esNavegador) return null;
    try {
      return localStorage.getItem(clave);
    } catch {
      return null;
    }
  }

  private escribir(clave: string, valor: string): void {
    if (!this.esNavegador) return;
    try {
      localStorage.setItem(clave, valor);
    } catch {
      /* almacenamiento no disponible */
    }
  }
}
