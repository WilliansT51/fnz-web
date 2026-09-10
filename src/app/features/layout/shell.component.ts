import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { AuthService } from '../../core/auth/auth.service';
import { MenuService } from '../../core/auth/menu.service';
import { NodoMenu } from '../../core/models/menu.models';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ButtonModule, MenuModule],
  template: `
    <div class="marco">
      <aside class="lateral" [class.colapsada]="colapsada()">
        <div class="logo">
          <i class="pi pi-shield"></i>
          @if (!colapsada()) { <span>Seguridad FNZ</span> }
        </div>

        <nav>
          @for (grupo of menu.menu(); track grupo.id) {
            @if (!colapsada() && grupo.ruta === null && grupo.hijos.length) {
              <p class="grupo">{{ grupo.nombre }}</p>
            }
            @for (item of itemsDe(grupo); track item.id) {
              <a
                [routerLink]="item.ruta"
                routerLinkActive="activo"
                [attr.title]="item.nombre"
              >
                <i [class]="item.icono || 'pi pi-circle'"></i>
                @if (!colapsada()) { <span>{{ item.nombre }}</span> }
              </a>
            }
          }
          @if (menu.cargado() && !menu.menu().length) {
            <p class="vacio">Sin módulos disponibles</p>
          }
        </nav>
      </aside>

      <div class="columna">
        <header class="topbar">
          <button type="button" class="colapsar" (click)="colapsada.set(!colapsada())" aria-label="Alternar menú">
            <i class="pi pi-bars"></i>
          </button>
          <div class="crece"></div>
          <button type="button" class="usuario" (click)="menuUsuario.toggle($event)">
            <span class="avatar">{{ iniciales() }}</span>
            <span class="nombre">{{ auth.usuario()?.nombre_completo }}</span>
            <i class="pi pi-angle-down"></i>
          </button>
          <p-menu #menuUsuario [model]="opcionesUsuario" [popup]="true" />
        </header>

        <main class="contenido">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [
    `
      .marco {
        display: flex;
        min-height: 100dvh;
      }
      .lateral {
        width: 240px;
        background: #10192b;
        color: #cdd6e4;
        display: flex;
        flex-direction: column;
        transition: width 0.15s ease;
      }
      .lateral.colapsada {
        width: 64px;
      }
      .logo {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 1.1rem 1rem;
        font-weight: 600;
        color: #fff;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }
      .logo i {
        font-size: 1.2rem;
        color: #6f9de2;
      }
      nav {
        display: flex;
        flex-direction: column;
        padding: 0.5rem;
        gap: 2px;
      }
      .grupo {
        margin: 0.75rem 0.75rem 0.25rem;
        font-size: 0.68rem;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: #6b7688;
      }
      .vacio {
        padding: 0.75rem;
        font-size: 0.8rem;
        color: #6b7688;
      }
      nav a {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.65rem 0.75rem;
        border-radius: 8px;
        text-decoration: none;
        color: inherit;
        font-size: 0.9rem;
        white-space: nowrap;
      }
      nav a:hover {
        background: rgba(255, 255, 255, 0.06);
      }
      nav a.activo {
        background: #2f5c9e;
        color: #fff;
      }
      .columna {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .topbar {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.6rem 1rem;
        background: #fff;
        border-bottom: 1px solid var(--fnz-borde);
      }
      .crece {
        flex: 1;
      }
      .colapsar {
        border: 0;
        background: transparent;
        cursor: pointer;
        font-size: 1.1rem;
        padding: 0.4rem;
        border-radius: 8px;
      }
      .colapsar:hover {
        background: var(--fnz-fondo);
      }
      .usuario {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        border: 1px solid var(--fnz-borde);
        background: #fff;
        border-radius: 999px;
        padding: 0.25rem 0.6rem 0.25rem 0.25rem;
        cursor: pointer;
        font-size: 0.85rem;
      }
      .avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: #2f5c9e;
        color: #fff;
        display: grid;
        place-items: center;
        font-size: 0.75rem;
        font-weight: 600;
      }
      .contenido {
        padding: 1.5rem;
        flex: 1;
      }
      @media (max-width: 720px) {
        .nombre {
          display: none;
        }
      }
    `,
  ],
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  readonly menu = inject(MenuService);
  private readonly router = inject(Router);

  readonly colapsada = signal(false);

  readonly iniciales = computed(() => {
    const u = this.auth.usuario();
    return u ? (u.nombre[0] ?? '') + (u.apellido[0] ?? '') : '';
  });

  readonly opcionesUsuario: MenuItem[] = [
    {
      label: 'Mi seguridad (2FA)',
      icon: 'pi pi-verified',
      command: () => this.router.navigate(['/seguridad/mi-seguridad']),
    },
    {
      label: 'Cambiar contraseña',
      icon: 'pi pi-key',
      command: () => this.router.navigate(['/cambiar-password']),
    },
    { separator: true },
    { label: 'Cerrar sesión', icon: 'pi pi-sign-out', command: () => this.auth.logout() },
  ];

  constructor() {
    this.menu.cargar();
  }

  /** Un grupo sin ruta aporta sus hijos; un nodo con ruta es un item por sí mismo. */
  itemsDe(grupo: NodoMenu): NodoMenu[] {
    return grupo.ruta === null ? grupo.hijos.filter((h) => h.ruta) : [grupo];
  }
}
