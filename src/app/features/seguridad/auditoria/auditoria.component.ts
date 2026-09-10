import { Component, inject, signal } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';

import { TienePermisoDirective } from '../../../core/auth/tiene-permiso.directive';
import {
  AuditoriaService,
  CatalogosAuditoria,
  FiltroAuditoria,
  Integridad,
  RegistroAuditoria,
} from './auditoria.service';

const SEVERIDAD: Record<string, 'success' | 'danger' | 'warn' | 'info' | 'secondary'> = {
  login_exitoso: 'success',
  login_fallido: 'danger',
  logout: 'secondary',
  creacion: 'info',
  modificacion: 'warn',
  eliminacion: 'danger',
  cambio_roles: 'warn',
  cambio_permisos: 'warn',
  reset_password: 'warn',
  cambio_password: 'info',
  bloqueo_usuario: 'danger',
  desbloqueo_usuario: 'success',
  cierre_sesion_forzado: 'danger',
  exportacion: 'secondary',
};

@Component({
  selector: 'app-auditoria',
  imports: [
    FormsModule,
    DatePipe,
    JsonPipe,
    TableModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    DatePickerModule,
    TagModule,
    DialogModule,
    MessageModule,
    TienePermisoDirective,
  ],
  template: `
    <header class="fnz-toolbar-tabla">
      <div>
        <h1 class="fnz-titulo-pagina">Bitácora de auditoría</h1>
        <p class="fnz-subtitulo">Registro inalterable de eventos del sistema</p>
      </div>
      <div class="acciones-cab" *appTienePermiso="'auditoria.exportar'">
        <p-button label="Excel" icon="pi pi-file-excel" severity="secondary" [outlined]="true" (onClick)="exportar('xlsx')" [loading]="exportando()" />
        <p-button label="PDF" icon="pi pi-file-pdf" severity="secondary" [outlined]="true" (onClick)="exportar('pdf')" [loading]="exportando()" />
      </div>
    </header>

    @if (integridad(); as i) {
      <p-message [severity]="i.integra ? 'success' : 'error'" styleClass="w-full mb-3">
        @if (i.integra) {
          Cadena de {{ i.total_registros }} registros verificada e íntegra.
        } @else {
          Integridad comprometida a partir del registro #{{ i.primer_id_roto }}.
        }
      </p-message>
    }

    <div class="filtros fnz-tarjeta">
      <input pInputText placeholder="Usuario" [(ngModel)]="filtro.usuario" (keyup.enter)="aplicar()" />
      <input pInputText placeholder="Contiene…" [(ngModel)]="filtro.q" (keyup.enter)="aplicar()" />
      <p-select
        [options]="catalogos()?.eventos ?? []"
        placeholder="Evento"
        [showClear]="true"
        [(ngModel)]="filtro.evento"
        (ngModelChange)="aplicar()"
      />
      <p-select
        [options]="catalogos()?.modulos ?? []"
        placeholder="Módulo"
        [showClear]="true"
        [(ngModel)]="filtro.modulo"
        (ngModelChange)="aplicar()"
      />
      <p-datepicker
        placeholder="Desde"
        dateFormat="yy-mm-dd"
        [showButtonBar]="true"
        [(ngModel)]="desde"
        (ngModelChange)="aplicar()"
      />
      <p-datepicker
        placeholder="Hasta"
        dateFormat="yy-mm-dd"
        [showButtonBar]="true"
        [(ngModel)]="hasta"
        (ngModelChange)="aplicar()"
      />
      <p-button label="Limpiar" [text]="true" size="small" (onClick)="limpiar()" />
    </div>

    <p-table
      [value]="registros()"
      [lazy]="true"
      (onLazyLoad)="cargar($event)"
      [paginator]="true"
      [rows]="20"
      [totalRecords]="total()"
      [loading]="cargando()"
      [rowsPerPageOptions]="[20, 50, 100]"
      dataKey="id"
      styleClass="fnz-tarjeta p-datatable-sm"
      currentPageReportTemplate="{first}–{last} de {totalRecords}"
      [showCurrentPageReport]="true"
      [selectionMode]="'single'"
      (onRowSelect)="ver($any($event).data)"
    >
      <ng-template #header>
        <tr>
          <th style="width: 11rem">Fecha</th>
          <th>Usuario</th>
          <th>Evento</th>
          <th>Módulo</th>
          <th>Descripción</th>
          <th style="width: 9rem">IP</th>
        </tr>
      </ng-template>
      <ng-template #body let-r>
        <tr [pSelectableRow]="r">
          <td>{{ r.fecha | date: 'dd/MM/yy HH:mm:ss' }}</td>
          <td>{{ r.usuario || '—' }}</td>
          <td><p-tag [value]="r.evento" [severity]="sev(r.evento)" /></td>
          <td>{{ r.modulo || '—' }}</td>
          <td class="desc">{{ r.descripcion || '—' }}</td>
          <td>{{ r.ip }}</td>
        </tr>
      </ng-template>
    </p-table>

    <p-dialog
      header="Detalle del evento"
      [(visible)]="dialogo"
      [modal]="true"
      [style]="{ width: '40rem' }"
    >
      @if (detalle(); as d) {
        <div class="detalle">
          <dl>
            <dt>Fecha</dt><dd>{{ d.fecha | date: 'dd/MM/yyyy HH:mm:ss' }}</dd>
            <dt>Usuario</dt><dd>{{ d.usuario || '—' }} ({{ d.usuario_id ?? 's/id' }})</dd>
            <dt>Evento</dt><dd><p-tag [value]="d.evento" [severity]="sev(d.evento)" /></dd>
            <dt>Módulo / tabla</dt><dd>{{ d.modulo || '—' }} · {{ d.tabla_afectada || '—' }}{{ d.registro_id ? ' #' + d.registro_id : '' }}</dd>
            <dt>Origen</dt><dd>{{ d.ip }} · {{ d.metodo_http }} {{ d.url }}</dd>
            <dt>Descripción</dt><dd>{{ d.descripcion || '—' }}</dd>
          </dl>

          @if (d.valores_anteriores || d.valores_nuevos) {
            <div class="diff">
              <div>
                <h4>Antes</h4>
                <pre>{{ d.valores_anteriores | json }}</pre>
              </div>
              <div>
                <h4>Después</h4>
                <pre>{{ d.valores_nuevos | json }}</pre>
              </div>
            </div>
          }

          <div class="hashes">
            <span>hash anterior</span><code>{{ d.hash_anterior || '—' }}</code>
            <span>hash registro</span><code>{{ d.hash_registro }}</code>
          </div>
        </div>
      }
    </p-dialog>
  `,
  styles: [
    `
      .acciones-cab {
        display: flex;
        gap: 0.5rem;
      }
      .filtros {
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem;
        padding: 0.9rem;
        margin-bottom: 1rem;
        align-items: center;
      }
      .filtros input,
      .filtros ::ng-deep .p-select,
      .filtros ::ng-deep .p-datepicker {
        min-width: 150px;
      }
      .desc {
        max-width: 32rem;
      }
      :host ::ng-deep .w-full {
        width: 100%;
      }
      :host ::ng-deep .mb-3 {
        display: block;
        margin-bottom: 1rem;
      }
      .detalle dl {
        display: grid;
        grid-template-columns: 9rem 1fr;
        gap: 0.35rem 1rem;
        margin: 0 0 1rem;
        font-size: 0.88rem;
      }
      .detalle dt {
        color: var(--fnz-tinta-suave);
      }
      .detalle dd {
        margin: 0;
      }
      .diff {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
      }
      .diff h4 {
        margin: 0 0 0.25rem;
        font-size: 0.75rem;
        text-transform: uppercase;
        color: var(--fnz-tinta-suave);
      }
      .diff pre {
        background: var(--fnz-fondo);
        border: 1px solid var(--fnz-borde);
        border-radius: 8px;
        padding: 0.6rem;
        font-size: 0.75rem;
        max-height: 220px;
        overflow: auto;
        margin: 0;
      }
      .hashes {
        display: grid;
        grid-template-columns: 8rem 1fr;
        gap: 0.25rem 0.75rem;
        margin-top: 1rem;
        font-size: 0.72rem;
      }
      .hashes span {
        color: var(--fnz-tinta-suave);
      }
      .hashes code {
        word-break: break-all;
      }
    `,
  ],
})
export class AuditoriaComponent {
  private readonly api = inject(AuditoriaService);
  private readonly mensajes = inject(MessageService);

  readonly registros = signal<RegistroAuditoria[]>([]);
  readonly total = signal(0);
  readonly cargando = signal(false);
  readonly exportando = signal(false);
  readonly catalogos = signal<CatalogosAuditoria | null>(null);
  readonly integridad = signal<Integridad | null>(null);

  readonly dialogo = signal(false);
  readonly detalle = signal<RegistroAuditoria | null>(null);

  filtro: FiltroAuditoria = {};
  desde: Date | null = null;
  hasta: Date | null = null;

  private ultimo: TableLazyLoadEvent = { first: 0, rows: 20 };

  constructor() {
    this.api.catalogos().subscribe((c) => this.catalogos.set(c));
    this.api.verificar().subscribe((i) => this.integridad.set(i));
  }

  sev(evento: string) {
    return SEVERIDAD[evento] ?? 'secondary';
  }

  private iso(d: Date | null): string | undefined {
    return d ? d.toISOString().slice(0, 10) : undefined;
  }

  cargar(evento: TableLazyLoadEvent): void {
    this.ultimo = evento;
    this.cargando.set(true);
    this.api
      .listar({
        ...this.filtro,
        desde: this.iso(this.desde),
        hasta: this.iso(this.hasta),
        page: Math.floor((evento.first ?? 0) / (evento.rows ?? 20)) + 1,
        por_pagina: evento.rows ?? 20,
      })
      .subscribe({
        next: (r) => {
          this.registros.set(r.data);
          this.total.set(r.meta.total);
          this.cargando.set(false);
        },
        error: () => this.cargando.set(false),
      });
  }

  aplicar(): void {
    this.cargar({ ...this.ultimo, first: 0 });
  }

  limpiar(): void {
    this.filtro = {};
    this.desde = this.hasta = null;
    this.aplicar();
  }

  ver(r: RegistroAuditoria): void {
    this.detalle.set(r);
    this.dialogo.set(true);
    this.api.detalle(r.id).subscribe((d) => this.detalle.set(d.data));
  }

  exportar(formato: 'xlsx' | 'pdf'): void {
    this.exportando.set(true);
    this.api
      .exportar(formato, { ...this.filtro, desde: this.iso(this.desde), hasta: this.iso(this.hasta) })
      .subscribe({
        next: (blob) => {
          this.exportando.set(false);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.${formato}`;
          a.click();
          URL.revokeObjectURL(url);
        },
        error: () => {
          this.exportando.set(false);
          this.mensajes.add({ severity: 'error', summary: 'No se pudo generar la exportación' });
        },
      });
  }
}
