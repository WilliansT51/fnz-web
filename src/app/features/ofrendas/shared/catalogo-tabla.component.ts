import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { DatePickerModule } from 'primeng/datepicker';
import { TextareaModule } from 'primeng/textarea';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { ConfirmationService, MessageService } from 'primeng/api';

import { TienePermisoDirective } from '../../../core/auth/tiene-permiso.directive';
import { CatalogoService } from '../../../core/ofrendas/catalogo.service';
import { fechaLocalAIso, isoAFechaLocal } from '../../../core/ofrendas/fecha.util';
import { CampoFormulario, ColumnaTabla, OpcionSelect } from '../../../core/models/ofrendas.models';

/**
 * Tabla CRUD genérica para un catálogo simple del sistema de Ofrendas.
 * Espeja en el frontend el patrón DRY de
 * {@see \App\Http\Controllers\Catalogos\CatalogoController} del backend:
 * cada catálogo solo declara su endpoint, columnas y campos de formulario
 * (ver `campos`/`columnas` en {@see CampoFormulario}/{@see ColumnaTabla}),
 * sin repetir la lógica de tabla/diálogo/paginación.
 */
@Component({
  selector: 'app-catalogo-tabla',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    CheckboxModule,
    DatePickerModule,
    TextareaModule,
    TagModule,
    DialogModule,
    TienePermisoDirective,
  ],
  template: `
    <header class="fnz-toolbar-tabla">
      <div>
        <h2 class="fnz-titulo-seccion">{{ titulo() }}</h2>
        @if (subtitulo()) {
          <p class="fnz-subtitulo">{{ subtitulo() }}</p>
        }
      </div>
      <p-button
        *appTienePermiso="permisoPrefijo() + '.crear'"
        label="Nuevo"
        icon="pi pi-plus"
        size="small"
        (onClick)="abrirFormulario()"
      />
    </header>

    <div class="filtros">
      <input
        pInputText
        placeholder="Buscar…"
        [value]="filtroTexto()"
        (input)="filtroTexto.set($any($event.target).value); recargar()"
      />
    </div>

    <p-table
      [value]="registros()"
      [lazy]="true"
      (onLazyLoad)="cargar($event)"
      [paginator]="true"
      [rows]="10"
      [totalRecords]="total()"
      [loading]="cargando()"
      [rowsPerPageOptions]="[10, 20, 50]"
      dataKey="id"
      styleClass="fnz-tarjeta p-datatable-sm"
      currentPageReportTemplate="{first}–{last} de {totalRecords}"
      [showCurrentPageReport]="true"
    >
      <ng-template #header>
        <tr>
          @for (c of columnas(); track c.campo) {
            <th>{{ c.etiqueta }}</th>
          }
          <th style="width: 6rem"></th>
        </tr>
      </ng-template>
      <ng-template #body let-r>
        <tr>
          @for (c of columnas(); track c.campo) {
            <td>{{ valorColumna(r, c) }}</td>
          }
          <td class="acciones">
            <p-button
              *appTienePermiso="permisoPrefijo() + '.editar'"
              icon="pi pi-pencil"
              [rounded]="true"
              [text]="true"
              size="small"
              (onClick)="abrirFormulario(r)"
            />
            <p-button
              *appTienePermiso="permisoPrefijo() + '.eliminar'"
              icon="pi pi-trash"
              severity="danger"
              [rounded]="true"
              [text]="true"
              size="small"
              (onClick)="eliminar(r)"
            />
          </td>
        </tr>
      </ng-template>
      <ng-template #emptymessage>
        <tr>
          <td [attr.colspan]="columnas().length + 1" class="vacio">Sin registros.</td>
        </tr>
      </ng-template>
    </p-table>

    <p-dialog
      [header]="edicion() ? 'Editar' : 'Nuevo'"
      [(visible)]="dialogo"
      [modal]="true"
      [style]="{ width: '30rem' }"
      (onHide)="cerrarFormulario()"
    >
      <form class="formulario" (ngSubmit)="guardar()">
        @for (campo of camposVisibles(); track campo.nombre) {
          <label>
            <span>{{ campo.etiqueta }}</span>
            @switch (campo.tipo) {
              @case ('texto') {
                <input pInputText [formControl]="control(campo.nombre)" fluid />
              }
              @case ('numero') {
                <p-inputNumber [formControl]="control(campo.nombre)" fluid />
              }
              @case ('textarea') {
                <textarea pTextarea [formControl]="control(campo.nombre)" rows="3" fluid></textarea>
              }
              @case ('fecha') {
                <p-datePicker [formControl]="control(campo.nombre)" dateFormat="yy-mm-dd" fluid />
              }
              @case ('checkbox') {
                <p-checkbox [formControl]="control(campo.nombre)" [binary]="true" />
              }
              @case ('select') {
                <p-select
                  [formControl]="control(campo.nombre)"
                  [options]="opcionesDe(campo)"
                  optionLabel="label"
                  optionValue="value"
                  [filter]="true"
                  fluid
                />
              }
            }
            @if (campo.ayuda) {
              <small>{{ campo.ayuda }}</small>
            }
          </label>
        }

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
          <p-button label="Guardar" type="submit" [loading]="guardando()" [disabled]="guardando()" />
        </div>
      </form>
    </p-dialog>
  `,
  styles: [
    `
      .filtros {
        display: flex;
        gap: 0.75rem;
        margin-bottom: 0.75rem;
      }
      .filtros input {
        min-width: 260px;
      }
      .acciones {
        white-space: nowrap;
        text-align: right;
      }
      .vacio {
        text-align: center;
        padding: 1.5rem;
        color: var(--fnz-tinta-suave);
      }
      .formulario {
        display: flex;
        flex-direction: column;
        gap: 0.9rem;
        padding-top: 0.5rem;
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
    `,
  ],
})
export class CatalogoTablaComponent<T extends { id: number } = { id: number }> implements OnInit {
  /** Ruta relativa del catálogo, p. ej. "catalogos/ubicacion/paises". */
  readonly endpoint = input.required<string>();
  readonly titulo = input.required<string>();
  readonly subtitulo = input<string>('');
  /** Prefijo de permiso (ubicacion|eclesiastico|financiero). */
  readonly permisoPrefijo = input.required<string>();
  readonly campos = input.required<CampoFormulario[]>();
  readonly columnas = input.required<ColumnaTabla[]>();
  /** Filtro fijo (FK del padre) aplicado a listar/crear, p. ej. { distrito_id: 3 }. */
  readonly filtroForaneo = input<Record<string, number>>({});

  private readonly api = inject(CatalogoService);
  private readonly fb = inject(FormBuilder);
  private readonly confirmar = inject(ConfirmationService);
  private readonly mensajes = inject(MessageService);

  readonly registros = signal<T[]>([]);
  readonly total = signal(0);
  readonly cargando = signal(false);
  readonly filtroTexto = signal('');

  readonly dialogo = signal(false);
  readonly edicion = signal<T | null>(null);
  readonly guardando = signal(false);
  readonly errorForm = signal<string[]>([]);
  readonly opcionesFk = signal<Record<string, OpcionSelect[]>>({});

  readonly camposVisibles = computed(() =>
    this.campos().filter((c) => !(c.ocultarEnAlta && !this.edicion())),
  );

  form = this.fb.group({});
  private ultimoEvento: TableLazyLoadEvent = { first: 0, rows: 10 };

  ngOnInit(): void {
    this.form = this.fb.group(
      Object.fromEntries(this.campos().map((c) => [c.nombre, this.fb.control<unknown>(null)])),
    );
    this.cargarOpcionesFk();
  }

  private cargarOpcionesFk(): void {
    for (const campo of this.campos()) {
      if (!campo.opcionesEndpoint) continue;
      const etiqueta = campo.opcionEtiqueta ?? 'nombre';
      const valor = campo.opcionValor ?? 'id';
      this.api.todos<Record<string, unknown>>(campo.opcionesEndpoint).subscribe((r) => {
        const opciones: OpcionSelect[] = r.data.map((o) => ({
          label: String(o[etiqueta]),
          value: o[valor] as string | number | boolean,
        }));
        this.opcionesFk.update((actual) => ({ ...actual, [campo.nombre]: opciones }));
      });
    }
  }

  opcionesDe(campo: CampoFormulario): OpcionSelect[] {
    return campo.opciones ?? this.opcionesFk()[campo.nombre] ?? [];
  }

  control(nombre: string) {
    return this.form.get(nombre) as import('@angular/forms').FormControl;
  }

  valorColumna(registro: Record<string, unknown>, columna: ColumnaTabla): string {
    if (columna.tipo === 'relacion' && columna.relacion) {
      const objeto = registro[columna.relacion.objeto] as Record<string, unknown> | null;
      return objeto ? String(objeto[columna.relacion.campo]) : '—';
    }
    const valor = registro[columna.campo];
    if (columna.tipo === 'booleano') return valor ? 'Activo' : 'Inactivo';
    if (valor === null || valor === undefined || valor === '') return '—';
    return String(valor);
  }

  cargar(evento: TableLazyLoadEvent): void {
    this.ultimoEvento = evento;
    this.cargando.set(true);

    this.api
      .listar<T>(this.endpoint(), {
        q: this.filtroTexto() || undefined,
        page: Math.floor((evento.first ?? 0) / (evento.rows ?? 10)) + 1,
        por_pagina: evento.rows ?? 10,
        ...this.filtroForaneo(),
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

  recargar(): void {
    this.cargar({ ...this.ultimoEvento, first: 0 });
  }

  abrirFormulario(registro?: T): void {
    this.errorForm.set([]);
    this.edicion.set(registro ?? null);
    // Se recargan por si un catálogo padre (p. ej. Departamento) se creó
    // después de que esta pestaña ya estaba montada.
    this.cargarOpcionesFk();

    const valores: Record<string, unknown> = {};
    for (const campo of this.campos()) {
      const control = this.control(campo.nombre);
      const validadores = campo.requerido ? [Validators.required] : [];
      control.setValidators(validadores);
      control.updateValueAndValidity();

      if (registro) {
        const bruto = (registro as Record<string, unknown>)[campo.nombre];
        valores[campo.nombre] = campo.tipo === 'fecha' && bruto ? isoAFechaLocal(bruto as string) : bruto;
      } else {
        valores[campo.nombre] = campo.tipo === 'checkbox' ? true : (this.filtroForaneo()[campo.nombre] ?? null);
      }
    }
    this.form.reset(valores);
    this.dialogo.set(true);
  }

  cerrarFormulario(): void {
    this.edicion.set(null);
    this.errorForm.set([]);
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    this.errorForm.set([]);

    const crudo = { ...this.form.getRawValue(), ...this.filtroForaneo() } as Record<string, unknown>;
    for (const campo of this.campos()) {
      if (campo.tipo === 'fecha' && crudo[campo.nombre] instanceof Date) {
        crudo[campo.nombre] = fechaLocalAIso(crudo[campo.nombre] as Date);
      }
    }
    // Se omiten los campos sin valor (null/undefined) para no chocar con
    // reglas "sometimes" del backend, que validan cualquier clave presente.
    const valores = Object.fromEntries(
      Object.entries(crudo).filter(([, v]) => v !== null && v !== undefined),
    );

    const objetivo = this.edicion();
    const peticion = objetivo
      ? this.api.actualizar<T>(this.endpoint(), objetivo.id, valores)
      : this.api.crear<T>(this.endpoint(), valores);

    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.dialogo.set(false);
        this.mensajes.add({ severity: 'success', summary: objetivo ? 'Registro actualizado' : 'Registro creado' });
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

  eliminar(registro: T & { nombre?: string }): void {
    this.confirmar.confirm({
      message: `¿Dar de baja "${registro.nombre ?? registro.id}"? Es una baja lógica y puede revertirse.`,
      header: 'Dar de baja',
      acceptLabel: 'Dar de baja',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.api.eliminar(this.endpoint(), registro.id).subscribe(() => {
          this.mensajes.add({ severity: 'success', summary: 'Registro dado de baja' });
          this.recargar();
        }),
    });
  }
}
