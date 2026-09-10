import { Component, OnDestroy, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Subscription, interval } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { TienePermisoDirective } from '../../../core/auth/tiene-permiso.directive';
import {
  EstadisticasSesiones,
  FiltroSesiones,
  Sesion,
  SesionesService,
} from './sesiones.service';

@Component({
  selector: 'app-sesiones',
  imports: [
    FormsModule,
    DatePipe,
    TableModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    TagModule,
    TooltipModule,
    TienePermisoDirective,
  ],
  template: `
    <header class="fnz-toolbar-tabla">
      <div>
        <h1 class="fnz-titulo-pagina">Sesiones activas</h1>
        <p class="fnz-subtitulo">Usuarios conectados y control de sesiones · actualiza cada 20 s</p>
      </div>
      <p-button label="Actualizar" icon="pi pi-refresh" [text]="true" size="small" (onClick)="refrescar()" />
    </header>

    @if (stats(); as s) {
      <div class="tiles">
        <div class="tile"><span class="n">{{ s.en_linea }}</span><span class="l">En línea ahora</span></div>
        <div class="tile"><span class="n">{{ s.activas }}</span><span class="l">Sesiones activas</span></div>
        <div class="tile"><span class="n">{{ s.usuarios_activos }}</span><span class="l">Usuarios distintos</span></div>
        <div class="tile disp">
          @for (d of dispositivos(s); track d.k) {
            <span><i [class]="iconoDisp(d.k)"></i> {{ d.k }}: <strong>{{ d.v }}</strong></span>
          }
        </div>
      </div>
    }

    <div class="filtros">
      <input pInputText placeholder="Buscar usuario…" [(ngModel)]="filtro.usuario" (keyup.enter)="refrescar()" />
      <p-select
        [options]="estados"
        optionLabel="label"
        optionValue="value"
        [(ngModel)]="filtro.estado"
        (ngModelChange)="refrescar()"
      />
    </div>

    <p-table
      [value]="sesiones()"
      [lazy]="true"
      (onLazyLoad)="cargar($event)"
      [paginator]="true"
      [rows]="20"
      [totalRecords]="total()"
      [loading]="cargando()"
      dataKey="id"
      styleClass="fnz-tarjeta p-datatable-sm"
      [showCurrentPageReport]="true"
      currentPageReportTemplate="{first}–{last} de {totalRecords}"
    >
      <ng-template #header>
        <tr>
          <th style="width: 6rem"></th>
          <th>Usuario</th>
          <th>Dispositivo</th>
          <th>IP</th>
          <th>Inicio</th>
          <th>Última actividad</th>
          <th style="width: 8rem"></th>
        </tr>
      </ng-template>
      <ng-template #body let-s>
        <tr [class.propia]="s.es_actual">
          <td>
            @if (s.en_linea) {
              <span class="punto en-linea" pTooltip="En línea"></span>
            } @else {
              <span class="punto" pTooltip="Inactiva"></span>
            }
          </td>
          <td>
            <strong>{{ s.usuario?.nombre }}</strong>
            <small>{{ s.usuario?.usuario }}</small>
            @if (s.es_actual) { <p-tag value="esta sesión" severity="info" styleClass="ml-1" /> }
          </td>
          <td>
            <i [class]="iconoDisp(s.dispositivo)"></i>
            {{ s.navegador }} {{ s.navegador_version }} · {{ s.sistema_operativo }}
          </td>
          <td>{{ s.ip }}</td>
          <td>{{ s.iniciada_en | date: 'dd/MM/yy HH:mm' }}</td>
          <td>{{ s.ultima_actividad_en | date: 'dd/MM/yy HH:mm:ss' }}</td>
          <td class="acciones">
            @if (auth.tienePermiso('sesiones.eliminar') && s.activa) {
              <p-button
                icon="pi pi-sign-out"
                severity="danger"
                [rounded]="true"
                [text]="true"
                size="small"
                pTooltip="Cerrar esta sesión"
                (onClick)="cerrar(s)"
              />
              @if (s.usuario) {
                <p-button
                  icon="pi pi-power-off"
                  severity="danger"
                  [rounded]="true"
                  [text]="true"
                  size="small"
                  pTooltip="Cerrar todas las de este usuario"
                  (onClick)="cerrarUsuario(s)"
                />
              }
            }
          </td>
        </tr>
      </ng-template>
    </p-table>
  `,
  styles: [
    `
      .tiles {
        display: grid;
        grid-template-columns: repeat(3, 140px) 1fr;
        gap: 0.75rem;
        margin-bottom: 1rem;
      }
      .tile {
        background: #fff;
        border: 1px solid var(--fnz-borde);
        border-radius: 10px;
        padding: 0.8rem 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
      }
      .tile .n {
        font-size: 1.5rem;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      .tile .l {
        font-size: 0.75rem;
        color: var(--fnz-tinta-suave);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .tile.disp {
        flex-direction: row;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.25rem 1.25rem;
        font-size: 0.85rem;
      }
      .filtros {
        display: flex;
        gap: 0.6rem;
        margin-bottom: 1rem;
      }
      .filtros input {
        min-width: 240px;
      }
      td small {
        display: block;
        color: var(--fnz-tinta-suave);
        font-size: 0.75rem;
      }
      .punto {
        display: inline-block;
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: #c3cbd6;
        margin-left: 0.6rem;
      }
      .punto.en-linea {
        background: #2e7d5b;
        box-shadow: 0 0 0 3px rgba(46, 125, 91, 0.18);
      }
      tr.propia {
        background: #f0f6ff;
      }
      .acciones {
        white-space: nowrap;
        text-align: right;
      }
      :host ::ng-deep .ml-1 {
        margin-left: 0.35rem;
      }
    `,
  ],
})
export class SesionesComponent implements OnDestroy {
  readonly auth = inject(AuthService);
  private readonly api = inject(SesionesService);
  private readonly confirmar = inject(ConfirmationService);
  private readonly mensajes = inject(MessageService);

  readonly sesiones = signal<Sesion[]>([]);
  readonly total = signal(0);
  readonly cargando = signal(false);
  readonly stats = signal<EstadisticasSesiones | null>(null);

  readonly estados = [
    { label: 'Activas', value: 'activas' },
    { label: 'Cerradas', value: 'cerradas' },
    { label: 'Todas', value: 'todas' },
  ];

  filtro: FiltroSesiones = { estado: 'activas' };
  private ultimo: TableLazyLoadEvent = { first: 0, rows: 20 };
  private readonly sub: Subscription;

  constructor() {
    this.cargarStats();
    this.sub = interval(20000).subscribe(() => this.refrescar(true));
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  iconoDisp(d: string | null): string {
    return d === 'movil' ? 'pi pi-mobile' : d === 'tablet' ? 'pi pi-tablet' : 'pi pi-desktop';
  }

  dispositivos(s: EstadisticasSesiones) {
    return Object.entries(s.por_dispositivo).map(([k, v]) => ({ k, v }));
  }

  cargar(evento: TableLazyLoadEvent): void {
    this.ultimo = evento;
    this.cargando.set(true);
    this.api
      .listar({
        ...this.filtro,
        page: Math.floor((evento.first ?? 0) / (evento.rows ?? 20)) + 1,
        por_pagina: evento.rows ?? 20,
      })
      .subscribe({
        next: (r) => {
          this.sesiones.set(r.data);
          this.total.set(r.meta.total);
          this.cargando.set(false);
        },
        error: () => this.cargando.set(false),
      });
  }

  refrescar(silencioso = false): void {
    if (!silencioso) this.cargando.set(true);
    this.cargarStats();
    this.cargar({ ...this.ultimo });
  }

  private cargarStats(): void {
    this.api.estadisticas().subscribe((s) => this.stats.set(s));
  }

  cerrar(s: Sesion): void {
    this.confirmar.confirm({
      message: s.es_actual
        ? 'Vas a cerrar tu propia sesión. Tendrás que ingresar de nuevo. ¿Continuar?'
        : `¿Cerrar la sesión de ${s.usuario?.nombre} (${s.ip})?`,
      header: 'Cerrar sesión',
      acceptLabel: 'Cerrar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.api.cerrar(s.id).subscribe(() => {
          this.mensajes.add({ severity: 'success', summary: 'Sesión cerrada' });
          if (s.es_actual) this.auth.finalizarSesionLocal();
          else this.refrescar();
        }),
    });
  }

  cerrarUsuario(s: Sesion): void {
    if (!s.usuario) return;
    this.confirmar.confirm({
      message: `¿Cerrar todas las sesiones de ${s.usuario.nombre}?`,
      header: 'Cerrar todas las sesiones',
      acceptLabel: 'Cerrar todas',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.api.cerrarUsuario(s.usuario!.id).subscribe((r) => {
          this.mensajes.add({ severity: 'success', summary: `${r.cerradas} sesión(es) cerrada(s)` });
          this.refrescar();
        }),
    });
  }
}
