import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { PasswordModule } from 'primeng/password';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MessageService } from 'primeng/api';

import { AuthService } from '../../../core/auth/auth.service';
import { TienePermisoDirective } from '../../../core/auth/tiene-permiso.directive';
import {
  CatalogosUsuarios,
  EstadoUsuario,
  Usuario,
} from '../../../core/models/seguridad.models';
import { DatosUsuario, UsuariosService } from './usuarios.service';

const SEVERIDAD_ESTADO: Record<EstadoUsuario, 'success' | 'warn' | 'danger' | 'info'> = {
  activo: 'success',
  pendiente: 'warn',
  bloqueado: 'danger',
  inactivo: 'info',
};

@Component({
  selector: 'app-usuarios',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    DatePipe,
    TableModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    MultiSelectModule,
    TagModule,
    DialogModule,
    PasswordModule,
    TooltipModule,
    TienePermisoDirective,
  ],
  template: `
    <header class="fnz-toolbar-tabla">
      <div>
        <h1 class="fnz-titulo-pagina">Usuarios</h1>
        <p class="fnz-subtitulo">Gestión de cuentas, estados y roles</p>
      </div>
      <p-button
        *appTienePermiso="'usuarios.crear'"
        label="Nuevo usuario"
        icon="pi pi-plus"
        (onClick)="abrirFormulario()"
      />
    </header>

    <div class="filtros">
      <input
        pInputText
        placeholder="Buscar por nombre, correo o usuario…"
        [value]="filtroTexto()"
        (input)="filtroTexto.set($any($event.target).value); recargar()"
      />
      <p-select
        [options]="catalogos()?.estados ?? []"
        optionLabel="etiqueta"
        optionValue="valor"
        placeholder="Todos los estados"
        [showClear]="true"
        [ngModel]="filtroEstado()"
        (ngModelChange)="filtroEstado.set($event); recargar()"
        [ngModelOptions]="{ standalone: true }"
      />
    </div>

    <p-table
      [value]="usuarios()"
      [lazy]="true"
      (onLazyLoad)="cargar($event)"
      [paginator]="true"
      [rows]="15"
      [totalRecords]="total()"
      [loading]="cargando()"
      [rowsPerPageOptions]="[15, 30, 50]"
      dataKey="id"
      styleClass="fnz-tarjeta p-datatable-sm"
      currentPageReportTemplate="{first}–{last} de {totalRecords}"
      [showCurrentPageReport]="true"
    >
      <ng-template #header>
        <tr>
          <th pSortableColumn="nombre">Nombre <p-sorticon field="nombre" /></th>
          <th pSortableColumn="usuario">Usuario <p-sorticon field="usuario" /></th>
          <th>Correo</th>
          <th>Roles</th>
          <th pSortableColumn="estado">Estado <p-sorticon field="estado" /></th>
          <th pSortableColumn="ultimo_acceso">Último acceso <p-sorticon field="ultimo_acceso" /></th>
          <th style="width: 8rem"></th>
        </tr>
      </ng-template>
      <ng-template #body let-u>
        <tr>
          <td>{{ u.nombre_completo }}</td>
          <td>{{ u.usuario }}</td>
          <td>{{ u.correo }}</td>
          <td>
            @for (r of u.roles ?? []; track r.id) {
              <p-tag [value]="r.nombre" severity="secondary" styleClass="mr-1" />
            }
          </td>
          <td>
            <p-tag [value]="u.estado" [severity]="severidad(u.estado)" />
          </td>
          <td>{{ u.ultimo_acceso ? (u.ultimo_acceso | date: 'dd/MM/yy HH:mm') : '—' }}</td>
          <td class="acciones">
            <p-button
              *appTienePermiso="'usuarios.editar'"
              icon="pi pi-pencil"
              [rounded]="true"
              [text]="true"
              size="small"
              pTooltip="Editar"
              (onClick)="abrirFormulario(u)"
            />
            @if (auth.tienePermiso('usuarios.editar')) {
              @if (u.estado === 'bloqueado') {
                <p-button
                  icon="pi pi-lock-open"
                  severity="warn"
                  [rounded]="true"
                  [text]="true"
                  size="small"
                  (onClick)="accionEstado(u, 'desbloquear')"
                />
              } @else if (u.estado !== 'inactivo') {
                <p-button
                  icon="pi pi-ban"
                  severity="danger"
                  [rounded]="true"
                  [text]="true"
                  size="small"
                  (onClick)="accionEstado(u, 'bloquear')"
                />
              }
              <p-button
                icon="pi pi-refresh"
                [rounded]="true"
                [text]="true"
                size="small"
                pTooltip="Restablecer contraseña"
                (onClick)="restablecer(u)"
              />
            }
            <p-button
              *appTienePermiso="'usuarios.eliminar'"
              icon="pi pi-trash"
              severity="danger"
              [rounded]="true"
              [text]="true"
              size="small"
              (onClick)="eliminar(u)"
            />
          </td>
        </tr>
      </ng-template>
      <ng-template #emptymessage>
        <tr>
          <td colspan="7" class="vacio">Sin usuarios que coincidan con el filtro.</td>
        </tr>
      </ng-template>
    </p-table>

    <p-dialog
      [header]="edicion() ? 'Editar usuario' : 'Nuevo usuario'"
      [(visible)]="dialogo"
      [modal]="true"
      [style]="{ width: '32rem' }"
      (onHide)="cerrarFormulario()"
    >
      <form class="formulario" [formGroup]="form" (ngSubmit)="guardar()">
        <div class="grid2">
          <label>
            <span>Nombre</span>
            <input pInputText formControlName="nombre" fluid />
          </label>
          <label>
            <span>Apellido</span>
            <input pInputText formControlName="apellido" fluid />
          </label>
        </div>
        <label>
          <span>Correo</span>
          <input pInputText type="email" formControlName="correo" fluid />
        </label>
        <label>
          <span>Usuario</span>
          <input pInputText formControlName="usuario" fluid />
        </label>
        @if (!edicion()) {
          <label>
            <span>Contraseña temporal</span>
            <p-password formControlName="password" [toggleMask]="true" fluid />
            <small>El usuario deberá cambiarla en su primer ingreso.</small>
          </label>
        }
        <div class="grid2">
          <label>
            <span>Estado</span>
            <p-select
              formControlName="estado"
              [options]="catalogos()?.estados ?? []"
              optionLabel="etiqueta"
              optionValue="valor"
              fluid
            />
          </label>
          <label>
            <span>Roles</span>
            <p-multiselect
              formControlName="roles"
              [options]="catalogos()?.roles ?? []"
              optionLabel="nombre"
              optionValue="id"
              placeholder="Sin roles"
              fluid
            />
          </label>
        </div>

        @if (errorForm().length) {
          <ul class="errores">
            @for (e of errorForm(); track e) { <li>{{ e }}</li> }
          </ul>
        }

        <div class="pie">
          <p-button
            label="Cancelar"
            severity="secondary"
            [text]="true"
            type="button"
            (onClick)="dialogo.set(false)"
          />
          <p-button
            label="Guardar"
            type="submit"
            [loading]="guardando()"
            [disabled]="form.invalid || guardando()"
          />
        </div>
      </form>
    </p-dialog>
  `,
  styles: [
    `
      .filtros {
        display: flex;
        gap: 0.75rem;
        margin-bottom: 1rem;
        flex-wrap: wrap;
      }
      .filtros input {
        min-width: 280px;
        flex: 1;
      }
      .acciones {
        white-space: nowrap;
        text-align: right;
      }
      .vacio {
        text-align: center;
        padding: 2rem;
        color: var(--fnz-tinta-suave);
      }
      .formulario {
        display: flex;
        flex-direction: column;
        gap: 0.9rem;
        padding-top: 0.5rem;
      }
      .grid2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.9rem;
      }
      label {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        font-size: 0.82rem;
        font-weight: 500;
      }
      label small {
        font-weight: 400;
        color: var(--fnz-tinta-suave);
      }
      .errores {
        margin: 0;
        padding-left: 1.1rem;
        color: #c0392b;
        font-size: 0.82rem;
      }
      .pie {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        margin-top: 0.5rem;
      }
      :host ::ng-deep .mr-1 {
        margin-right: 0.25rem;
      }
    `,
  ],
})
export class UsuariosComponent {
  readonly auth = inject(AuthService);
  private readonly api = inject(UsuariosService);
  private readonly fb = inject(FormBuilder);
  private readonly confirmar = inject(ConfirmationService);
  private readonly mensajes = inject(MessageService);

  readonly usuarios = signal<Usuario[]>([]);
  readonly total = signal(0);
  readonly cargando = signal(false);
  readonly catalogos = signal<CatalogosUsuarios | null>(null);

  readonly filtroTexto = signal('');
  readonly filtroEstado = signal<EstadoUsuario | null>(null);

  readonly dialogo = signal(false);
  readonly edicion = signal<Usuario | null>(null);
  readonly guardando = signal(false);
  readonly errorForm = signal<string[]>([]);

  private ultimoEvento: TableLazyLoadEvent = { first: 0, rows: 15 };

  readonly form = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    apellido: ['', Validators.required],
    correo: ['', [Validators.required, Validators.email]],
    usuario: ['', [Validators.required, Validators.minLength(3)]],
    password: [''],
    estado: ['pendiente' as EstadoUsuario],
    roles: [[] as number[]],
  });

  readonly puedeGestionar = computed(() => this.auth.tienePermiso('usuarios.editar'));

  constructor() {
    this.api.catalogos().subscribe((c) => this.catalogos.set(c));
  }

  severidad(estado: EstadoUsuario) {
    return SEVERIDAD_ESTADO[estado];
  }

  cargar(evento: TableLazyLoadEvent): void {
    this.ultimoEvento = evento;
    this.cargando.set(true);

    const orden = Array.isArray(evento.sortField) ? evento.sortField[0] : evento.sortField;

    this.api
      .listar({
        q: this.filtroTexto() || undefined,
        estado: this.filtroEstado() || undefined,
        page: Math.floor((evento.first ?? 0) / (evento.rows ?? 15)) + 1,
        por_pagina: evento.rows ?? 15,
        orden: orden || undefined,
        direccion: evento.sortOrder === 1 ? 'asc' : 'desc',
      })
      .subscribe({
        next: (r) => {
          this.usuarios.set(r.data);
          this.total.set(r.meta.total);
          this.cargando.set(false);
        },
        error: () => this.cargando.set(false),
      });
  }

  recargar(): void {
    this.cargar({ ...this.ultimoEvento, first: 0 });
  }

  abrirFormulario(u?: Usuario): void {
    this.errorForm.set([]);
    this.edicion.set(u ?? null);

    if (u) {
      this.form.reset({
        nombre: u.nombre,
        apellido: u.apellido,
        correo: u.correo,
        usuario: u.usuario,
        password: '',
        estado: u.estado,
        roles: (u.roles ?? []).map((r) => r.id),
      });
      this.form.controls.password.clearValidators();
    } else {
      this.form.reset({ estado: 'pendiente', roles: [] });
      this.form.controls.password.addValidators([Validators.required, Validators.minLength(10)]);
    }
    this.form.controls.password.updateValueAndValidity();
    this.dialogo.set(true);
  }

  cerrarFormulario(): void {
    this.edicion.set(null);
    this.errorForm.set([]);
  }

  guardar(): void {
    if (this.form.invalid) return;
    this.guardando.set(true);
    this.errorForm.set([]);

    const v = this.form.getRawValue();
    const objetivo = this.edicion();

    const payload: Partial<DatosUsuario> = {
      nombre: v.nombre,
      apellido: v.apellido,
      correo: v.correo,
      usuario: v.usuario,
      estado: v.estado,
      roles: v.roles,
    };
    if (!objetivo) payload.password = v.password;

    const peticion = objetivo
      ? this.api.actualizar(objetivo.id, payload)
      : this.api.crear(payload as DatosUsuario);

    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.dialogo.set(false);
        this.mensajes.add({
          severity: 'success',
          summary: objetivo ? 'Usuario actualizado' : 'Usuario creado',
        });
        this.recargar();
      },
      error: (e: HttpErrorResponse) => {
        this.guardando.set(false);
        if (e.status === 422) {
          this.errorForm.set(Object.values(e.error?.errors ?? {}).flat() as string[]);
        } else {
          this.errorForm.set([e.error?.mensaje ?? 'No se pudo guardar.']);
        }
      },
    });
  }

  accionEstado(u: Usuario, accion: 'bloquear' | 'desbloquear' | 'activar' | 'desactivar'): void {
    const textos: Record<string, string> = {
      bloquear: `¿Bloquear a ${u.nombre_completo}? Se cerrarán sus sesiones.`,
      desbloquear: `¿Desbloquear a ${u.nombre_completo}?`,
      activar: `¿Activar a ${u.nombre_completo}?`,
      desactivar: `¿Desactivar a ${u.nombre_completo}?`,
    };
    this.confirmar.confirm({
      message: textos[accion],
      header: 'Confirmar',
      acceptLabel: 'Sí',
      rejectLabel: 'Cancelar',
      accept: () =>
        this.api.cambiarEstado(u.id, accion).subscribe(() => {
          this.mensajes.add({ severity: 'success', summary: 'Estado actualizado' });
          this.recargar();
        }),
    });
  }

  restablecer(u: Usuario): void {
    this.confirmar.confirm({
      message: `¿Restablecer la contraseña de ${u.nombre_completo}? Se generará una temporal y deberá cambiarla al ingresar.`,
      header: 'Restablecer contraseña',
      acceptLabel: 'Restablecer',
      rejectLabel: 'Cancelar',
      accept: () =>
        this.api.restablecerPassword(u.id).subscribe((r) => {
          this.mensajes.add({
            severity: 'info',
            summary: 'Contraseña temporal',
            detail: r.password_temporal ?? 'Contraseña restablecida.',
            life: 12000,
            sticky: !!r.password_temporal,
          });
        }),
    });
  }

  eliminar(u: Usuario): void {
    this.confirmar.confirm({
      message: `¿Dar de baja a ${u.nombre_completo}? Es una baja lógica y puede revertirse.`,
      header: 'Dar de baja',
      acceptLabel: 'Dar de baja',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.api.eliminar(u.id).subscribe(() => {
          this.mensajes.add({ severity: 'success', summary: 'Usuario dado de baja' });
          this.recargar();
        }),
    });
  }
}
