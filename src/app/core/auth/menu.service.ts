import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { NodoMenu, RespuestaMenu } from '../models/menu.models';
import { AuthService } from './auth.service';

/**
 * Árbol de navegación del usuario, servido por `GET /api/mi/menu` y filtrado
 * en el backend según sus permisos.
 */
@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private readonly _menu = signal<NodoMenu[]>([]);
  private readonly _cargado = signal(false);

  readonly menu = this._menu.asReadonly();
  readonly cargado = this._cargado.asReadonly();

  cargar(): void {
    if (!this.auth.hayToken()) return;
    this.http.get<RespuestaMenu>(`${environment.apiUrl}/mi/menu`).subscribe({
      next: (r) => {
        this._menu.set(r.menu);
        this._cargado.set(true);
      },
      error: () => this._cargado.set(true),
    });
  }

  limpiar(): void {
    this._menu.set([]);
    this._cargado.set(false);
  }
}
