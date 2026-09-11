import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ConfirmationService, MessageService } from 'primeng/api';

import { AuthService } from '../../../core/auth/auth.service';
import { TienePermisoDirective } from '../../../core/auth/tiene-permiso.directive';
import { SolicitudCambioService } from '../../../core/ofrendas/solicitud-cambio.service';
import { SolicitudCambio } from '../../../core/models/ofrendas.models';

const SEVERIDAD_ESTADO: Record<SolicitudCambio['estado'], 'success' | 'warn' | 'danger'> = {
  PENDIENTE: 'warn',
  APROBADA: 'success',
  RECHAZADA: 'danger',
};

/**
 * Bandeja del flujo maker-checker: lista las solicitudes de cambio y
 * permite aprobarlas o rechazarlas (solo cambio de estado, sin comparación
 * visual de campos — ver {@see \App\Services\Ofrendas\SolicitudCambioService}
 * en el backend). Quien solicitó el cambio no puede resolverlo.
 */
@Component({
  selector: 'app-solicitudes',
  imports: [
    FormsModule,
    DatePipe,
    TableModule,
    ButtonModule,
    SelectModule,
    TagModule,
    DialogModule,
    InputTextModule,
    TienePermisoDirective,
  ],
  template: `
    <header class="fnz-toolbar-tabla">
      <div>
        <h1 class="fnz-titulo-pagina">Solicitudes de cambio</h1>
        <p class="fnz-subtitulo">Bandeja de aprobación de ediciones y bajas sobre registros ya aprobados.</p>
      </div>
      <p-select
        [options]="opcionesEstado"
        optionLabel="label"
        optionValue="value"
        placeholder="Todos los estados"
        [showClear]="true"
        [ngModel]="filtroEstado()"
        (ngModelChange)="filtroEstado.set($event); recargar()"
      />
    </header>

    <p-table
      [value]="solicitudes()"
      [lazy]="true"
      (onLazyLoad)="cargar($event)"
      [paginator]="true"
      [rows]="15"
      [totalRecords]="total()"
      [loading]="cargando()"
      dataKey="id"
      styleClass="fnz-tarjeta p-datatable-sm"
      currentPageReportTemplate="{first}–{last} de {totalRecords}"
      [showCurrentPageReport]="true"
    >
      <ng-template #header>
        <tr>
          <th>Registro</th>
          <th>Acción</th>
          <th>Motivo</th>
          <th>Solicitante</th>
          <th>Fecha</th>
          <th>Estado</th>
          <th style="width: 10rem"></th>
        </tr>
      </ng-template>
      <ng-template #body let-s>
        <tr>
          <td>{{ nombreModelo(s.modelo) }} #{{ s.modelo_id }}</td>
          <td>{{ s.accion === 'EDITAR' ? 'Editar' : 'Eliminar' }}</td>
          <td>{{ s.motivo }}</td>
          <td>{{ s.solicitante?.nombre }}</td>
          <td>{{ s.created_at | date: 'dd/MM/yy HH:mm' }}</td>
          <td><p-tag [value]="s.estado" [severity]="severidad(s.estado)" /></td>
          <td class="acciones">
            @if (s.estado === 'PENDIENTE') {
              <p-button
                *appTienePermiso="'solicitudes.aprobar'"
                icon="pi pi-check"
                severity="success"
                [rounded]="true"
                [text]="true"
                size="small"
                [disabled]="s.solicitante_id === auth.usuario()?.id"
                (onClick)="abrirResolucion(s, 'aprobar')"
              />
              <p-button
                *appTienePermiso="'solicitudes.aprobar'"
                icon="pi pi-times"
                severity="danger"
                [rounded]="true"
                [text]="true"
                size="small"
                [disabled]="s.solicitante_id === auth.usuario()?.id"
                (onClick)="abrirResolucion(s, 'rechazar')"
              />
            }
          </td>
        </tr>
      </ng-template>
      <ng-template #emptymessage>
        <tr>
          <td colspan="7" class="vacio">Sin solicitudes que coincidan con el filtro.</td>
        </tr>
      </ng-template>
    </p-table>

    <p-dialog
      [header]="accion() === 'aprobar' ? 'Aprobar solicitud' : 'Rechazar solicitud'"
      [(visible)]="dialogo"
      [modal]="true"
      [style]="{ width: '28rem' }"
    >
      @if (seleccionada(); as s) {
        <p><strong>{{ nombreModelo(s.modelo) }} #{{ s.modelo_id }}</strong> — {{ s.motivo }}</p>
        <label class="campo">
          <span>Comentario (opcional)</span>
          <input pInputText [(ngModel)]="comentario" fluid />
        </label>
        <div class="pie">
          <p-button label="Cancelar" severity="secondary" [text]="true" (onClick)="dialogo.set(false)" />
          <p-button
            [label]="accion() === 'aprobar' ? 'Aprobar' : 'Rechazar'"
            [severity]="accion() === 'aprobar' ? 'success' : 'danger'"
            [loading]="resolviendo()"
            (onClick)="resolver()"
          />
        </div>
      }
    </p-dialog>
  `,
  styles: [
    `
      .acciones {
        white-space: nowrap;
        text-align: right;
      }
      .vacio {
        text-align: center;
        padding: 2rem;
        color: var(--fnz-tinta-suave);
      }
      .campo {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        font-size: 0.82rem;
        font-weight: 500;
        margin: 0.9rem 0;
      }
      .pie {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        margin-top: 0.5rem;
      }
    `,
  ],
})
export class SolicitudesComponent {
  readonly auth = inject(AuthService);
  private readonly api = inject(SolicitudCambioService);
  private readonly mensajes = inject(MessageService);

  readonly opcionesEstado = [
    { label: 'Pendiente', value: 'PENDIENTE' },
    { label: 'Aprobada', value: 'APROBADA' },
    { label: 'Rechazada', value: 'RECHAZADA' },
  ];

  readonly solicitudes = signal<SolicitudCambio[]>([]);
  readonly total = signal(0);
  readonly cargando = signal(false);
  readonly filtroEstado = signal<string | null>('PENDIENTE');

  readonly dialogo = signal(false);
  readonly seleccionada = signal<SolicitudCambio | null>(null);
  readonly accion = signal<'aprobar' | 'rechazar'>('aprobar');
  readonly resolviendo = signal(false);
  comentario = '';

  private ultimoEvento: TableLazyLoadEvent = { first: 0, rows: 15 };

  severidad(estado: SolicitudCambio['estado']) {
    return SEVERIDAD_ESTADO[estado];
  }

  nombreModelo(modelo: string): string {
    return modelo.split('\\').pop() ?? modelo;
  }

  cargar(evento: TableLazyLoadEvent): void {
    this.ultimoEvento = evento;
    this.cargando.set(true);
    this.api
      .listar({
        estado: this.filtroEstado() ?? undefined,
        page: Math.floor((evento.first ?? 0) / (evento.rows ?? 15)) + 1,
        por_pagina: evento.rows ?? 15,
      })
      .subscribe({
        next: (r) => {
          this.solicitudes.set(r.data);
          this.total.set(r.meta.total);
          this.cargando.set(false);
        },
        error: () => this.cargando.set(false),
      });
  }

  recargar(): void {
    this.cargar({ ...this.ultimoEvento, first: 0 });
  }

  abrirResolucion(s: SolicitudCambio, accion: 'aprobar' | 'rechazar'): void {
    this.seleccionada.set(s);
    this.accion.set(accion);
    this.comentario = '';
    this.dialogo.set(true);
  }

  resolver(): void {
    const s = this.seleccionada();
    if (!s) return;
    this.resolviendo.set(true);

    const peticion =
      this.accion() === 'aprobar'
        ? this.api.aprobar(s.id, this.comentario || undefined)
        : this.api.rechazar(s.id, this.comentario || undefined);

    peticion.subscribe({
      next: () => {
        this.resolviendo.set(false);
        this.dialogo.set(false);
        this.mensajes.add({
          severity: 'success',
          summary: this.accion() === 'aprobar' ? 'Solicitud aprobada' : 'Solicitud rechazada',
        });
        this.recargar();
      },
      error: (e) => {
        this.resolviendo.set(false);
        this.mensajes.add({
          severity: 'error',
          summary: 'No se pudo resolver la solicitud',
          detail: e.error?.errores ? Object.values(e.error.errores).flat().join(' ') : undefined,
        });
      },
    });
  }
}
