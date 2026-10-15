import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

import { TienePermisoDirective } from '../../../core/auth/tiene-permiso.directive';
import { CatalogoService } from '../../../core/ofrendas/catalogo.service';
import { IglesiaService } from '../../../core/ofrendas/iglesia.service';
import { fechaLocalAIso, isoAFechaLocal } from '../../../core/ofrendas/fecha.util';
import {
  AsignacionMinistro,
  Departamento,
  Distrito,
  Iglesia,
  Ministro,
  Municipio,
  OpcionSelect,
} from '../../../core/models/ofrendas.models';

/**
 * Iglesias locales: alta/edición con selección en cascada de la ubicación
 * (distrito → departamento → municipio, este último es lo que en realidad
 * se guarda junto con distrito_id) y, por fila, un panel con el historial
 * de ministros y la acción de asignar uno nuevo
 * ({@see IglesiaService}).
 */
@Component({
  selector: 'app-iglesias',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    DatePipe,
    TableModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    DatePickerModule,
    TagModule,
    DialogModule,
    TooltipModule,
    TienePermisoDirective,
  ],
  template: `
    <header class="fnz-toolbar-tabla">
      <div>
        <h2 class="fnz-titulo-seccion">Iglesias</h2>
        <p class="fnz-subtitulo">Iglesias locales y su ministro asignado.</p>
      </div>
      <p-button
        *appTienePermiso="'eclesiastico.crear'"
        label="Nueva iglesia"
        icon="pi pi-plus"
        size="small"
        (onClick)="abrirFormulario()"
      />
    </header>

    <div class="filtros">
      <input
        pInputText
        placeholder="Buscar por clave o nombre…"
        [value]="filtroTexto()"
        (input)="filtroTexto.set($any($event.target).value); recargar()"
      />
    </div>

    <p-table
      [value]="iglesias()"
      [lazy]="true"
      (onLazyLoad)="cargar($event)"
      [paginator]="true"
      [rows]="10"
      [totalRecords]="total()"
      [loading]="cargando()"
      dataKey="id"
      styleClass="fnz-tarjeta p-datatable-sm"
      currentPageReportTemplate="{first}–{last} de {totalRecords}"
      [showCurrentPageReport]="true"
    >
      <ng-template #header>
        <tr>
          <th>Clave</th>
          <th>Nombre</th>
          <th>Ministro actual</th>
          <th>Estado</th>
          <th style="width: 9rem"></th>
        </tr>
      </ng-template>
      <ng-template #body let-i>
        <tr>
          <td>{{ i.clave }}</td>
          <td>{{ i.nombre }}</td>
          <td>{{ ministroActual(i.id) }}</td>
          <td><p-tag [value]="i.estado" [severity]="i.estado === 'activa' ? 'success' : 'info'" /></td>
          <td class="acciones">
            <p-button
              icon="pi pi-user"
              [rounded]="true"
              [text]="true"
              size="small"
              pTooltip="Ministro"
              (onClick)="abrirMinistro(i)"
            />
            <p-button
              *appTienePermiso="'eclesiastico.editar'"
              icon="pi pi-pencil"
              [rounded]="true"
              [text]="true"
              size="small"
              (onClick)="abrirFormulario(i)"
            />
            <p-button
              *appTienePermiso="'eclesiastico.eliminar'"
              icon="pi pi-trash"
              severity="danger"
              [rounded]="true"
              [text]="true"
              size="small"
              (onClick)="eliminar(i)"
            />
          </td>
        </tr>
      </ng-template>
      <ng-template #emptymessage>
        <tr>
          <td colspan="5" class="vacio">Sin iglesias registradas.</td>
        </tr>
      </ng-template>
    </p-table>

    <p-dialog
      [header]="edicion() ? 'Editar iglesia' : 'Nueva iglesia'"
      [(visible)]="dialogo"
      [modal]="true"
      [style]="{ width: '32rem' }"
    >
      <form class="formulario" [formGroup]="form" (ngSubmit)="guardar()">
        <div class="grid2">
          <label>
            <span>Clave</span>
            <input pInputText formControlName="clave" fluid />
          </label>
          <label>
            <span>Nombre</span>
            <input pInputText formControlName="nombre" fluid />
          </label>
        </div>
        <div class="grid3">
          <label>
            <span>Distrito</span>
            <p-select
              [options]="opcionesDistrito()"
              optionLabel="label"
              optionValue="value"
              [ngModel]="distritoSeleccionado()"
              (ngModelChange)="distritoSeleccionado.set($event)"
              [ngModelOptions]="{ standalone: true }"
              fluid
            />
          </label>
          <label>
            <span>Departamento</span>
            <p-select
              [options]="opcionesDepartamento()"
              optionLabel="label"
              optionValue="value"
              [filter]="true"
              [ngModel]="departamentoSeleccionado()"
              (ngModelChange)="cambiarDepartamento($event)"
              [ngModelOptions]="{ standalone: true }"
              fluid
            />
          </label>
          <label>
            <span>Municipio</span>
            <p-select
              formControlName="municipio_id"
              [options]="opcionesMunicipio()"
              optionLabel="label"
              optionValue="value"
              [filter]="true"
              [disabled]="!departamentoSeleccionado()"
              fluid
            />
          </label>
        </div>
        <label>
          <span>Dirección</span>
          <input pInputText formControlName="direccion" fluid />
        </label>
        <div class="grid2">
          <label>
            <span>Teléfono</span>
            <input pInputText formControlName="telefono" fluid />
          </label>
          <label>
            <span>Fecha de fundación</span>
            <p-datePicker formControlName="fecha_fundacion" dateFormat="dd/mm/yy" fluid />
          </label>
        </div>

        @if (errorForm().length) {
          <ul class="errores">
            @for (e of errorForm(); track e) { <li>{{ e }}</li> }
          </ul>
        }

        <div class="pie">
          <p-button label="Cancelar" severity="secondary" [text]="true" type="button" (onClick)="dialogo.set(false)" />
          <p-button label="Guardar" type="submit" [loading]="guardando()" [disabled]="form.invalid || guardando()" />
        </div>
      </form>
    </p-dialog>

    <p-dialog
      header="Ministro de la iglesia"
      [(visible)]="dialogoMinistro"
      [modal]="true"
      [style]="{ width: '34rem' }"
    >
      @if (iglesiaActiva(); as iglesia) {
        <p class="fnz-subtitulo">{{ iglesia.nombre }} ({{ iglesia.clave }})</p>

        <table class="historial">
          <thead>
            <tr>
              <th>Ministro</th>
              <th>Desde</th>
              <th>Hasta</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            @for (a of historial(); track a.id) {
              <tr [class.activo]="a.activo">
                <td>{{ a.ministro?.nombre }} {{ a.ministro?.apellido }}</td>
                <td>{{ a.fecha_desde | date: 'dd/MM/yyyy':'UTC' }}</td>
                <td>{{ a.fecha_hasta ? (a.fecha_hasta | date: 'dd/MM/yyyy':'UTC') : (a.activo ? 'Activo' : '—') }}</td>
                <td>{{ a.motivo || '—' }}</td>
              </tr>
            } @empty {
              <tr><td colspan="4" class="vacio">Sin ministro asignado todavía.</td></tr>
            }
          </tbody>
        </table>

        <form class="formulario asignar" [formGroup]="formAsignacion" (ngSubmit)="asignar()">
          <p class="fnz-titulo-seccion">Asignar ministro</p>
          <div class="grid2">
            <label>
              <span>Ministro</span>
              <p-select
                formControlName="ministro_id"
                [options]="opcionesMinistro()"
                optionLabel="label"
                optionValue="value"
                [filter]="true"
                fluid
              />
            </label>
            <label>
              <span>Desde</span>
              <p-datePicker formControlName="fecha_desde" dateFormat="dd/mm/yy" fluid />
            </label>
          </div>
          <label>
            <span>Motivo</span>
            <input pInputText formControlName="motivo" fluid />
          </label>
          <div class="pie">
            <p-button
              *appTienePermiso="'eclesiastico.editar'"
              label="Asignar"
              type="submit"
              size="small"
              [loading]="asignando()"
              [disabled]="formAsignacion.invalid || asignando()"
            />
          </div>
        </form>
      }
    </p-dialog>
  `,
  styles: [
    `
      .filtros { display: flex; gap: 0.75rem; margin-bottom: 0.75rem; }
      .filtros input { min-width: 260px; }
      .acciones { white-space: nowrap; text-align: right; }
      .vacio { text-align: center; padding: 1.5rem; color: var(--fnz-tinta-suave); }
      .formulario { display: flex; flex-direction: column; gap: 0.9rem; padding-top: 0.5rem; }
      .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.9rem; }
      .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.9rem; }
      label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.82rem; font-weight: 500; }
      .errores { margin: 0; padding-left: 1.1rem; color: #c0392b; font-size: 0.82rem; }
      .pie { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem; }
      .historial { width: 100%; border-collapse: collapse; margin: 0.75rem 0; font-size: 0.85rem; }
      .historial th, .historial td { text-align: left; padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--fnz-borde); }
      .historial tr.activo td { font-weight: 600; }
      .asignar { border-top: 1px solid var(--fnz-borde); padding-top: 0.9rem; }
    `,
  ],
})
export class IglesiasComponent implements OnInit {
  private readonly api = inject(CatalogoService);
  private readonly iglesiaApi = inject(IglesiaService);
  private readonly fb = inject(FormBuilder);
  private readonly mensajes = inject(MessageService);

  readonly iglesias = signal<Iglesia[]>([]);
  readonly total = signal(0);
  readonly cargando = signal(false);
  readonly filtroTexto = signal('');
  readonly ministrosActuales = signal<Record<number, string>>({});

  readonly dialogo = signal(false);
  readonly edicion = signal<Iglesia | null>(null);
  readonly guardando = signal(false);
  readonly errorForm = signal<string[]>([]);

  readonly opcionesDistrito = signal<OpcionSelect[]>([]);
  readonly opcionesDepartamento = signal<OpcionSelect[]>([]);
  readonly opcionesMunicipio = signal<OpcionSelect[]>([]);
  readonly opcionesMinistro = signal<OpcionSelect[]>([]);
  readonly distritoSeleccionado = signal<number | null>(null);
  readonly departamentoSeleccionado = signal<number | null>(null);
  /** Todos los municipios (catálogo nacional), cargados una vez; se filtran client-side por departamento. */
  private todosMunicipios: Municipio[] = [];

  readonly dialogoMinistro = signal(false);
  readonly iglesiaActiva = signal<Iglesia | null>(null);
  readonly historial = signal<AsignacionMinistro[]>([]);
  readonly asignando = signal(false);

  private ultimoEvento: TableLazyLoadEvent = { first: 0, rows: 10 };

  readonly form = this.fb.nonNullable.group({
    clave: ['', Validators.required],
    nombre: ['', Validators.required],
    municipio_id: [null as number | null, Validators.required],
    direccion: [''],
    telefono: [''],
    fecha_fundacion: [null as Date | null],
  });

  readonly formAsignacion = this.fb.nonNullable.group({
    ministro_id: [null as number | null, Validators.required],
    fecha_desde: [new Date(), Validators.required],
    motivo: [''],
  });

  ngOnInit(): void {
    this.api.todos<Distrito>('catalogos/ubicacion/distritos').subscribe((r) => {
      this.opcionesDistrito.set(r.data.map((d) => ({ label: d.nombre, value: d.id })));
    });
    // Departamento y Municipio son catálogos nacionales planos: se cargan
    // una sola vez, sin depender del distrito seleccionado. Los municipios
    // se filtran client-side por departamento (ver `cambiarDepartamento`).
    this.api.todos<Departamento>('catalogos/ubicacion/departamentos').subscribe((r) => {
      this.opcionesDepartamento.set(r.data.map((d) => ({ label: d.nombre, value: d.id })));
    });
    this.api.todos<Municipio>('catalogos/ubicacion/municipios').subscribe((r) => {
      this.todosMunicipios = r.data;
    });
    this.cargarOpcionesMinistro();
  }

  /** Se recarga cada vez que se abre el panel de asignación, por si se creó un ministro nuevo mientras tanto. */
  private cargarOpcionesMinistro(): void {
    this.api.todos<Ministro>('catalogos/eclesiastico/ministros').subscribe((r) => {
      this.opcionesMinistro.set(r.data.map((m) => ({ label: `${m.nombre} ${m.apellido}`, value: m.id })));
    });
  }

  cambiarDepartamento(departamentoId: number | null, mantenerMunicipio = false): void {
    this.departamentoSeleccionado.set(departamentoId);
    if (!mantenerMunicipio) {
      this.form.patchValue({ municipio_id: null });
    }
    this.opcionesMunicipio.set(
      departamentoId
        ? this.todosMunicipios
            .filter((m) => m.departamento_id === departamentoId)
            .map((m) => ({ label: m.nombre, value: m.id }))
        : [],
    );
  }

  ministroActual(iglesiaId: number): string {
    return this.ministrosActuales()[iglesiaId] ?? '—';
  }

  private cargarMinistrosActuales(iglesias: Iglesia[]): void {
    for (const i of iglesias) {
      this.iglesiaApi.historialMinistros(i.id).subscribe((r) => {
        const activa = r.data.find((a) => a.activo);
        if (activa?.ministro) {
          this.ministrosActuales.update((actual) => ({
            ...actual,
            [i.id]: `${activa.ministro!.nombre} ${activa.ministro!.apellido}`,
          }));
        }
      });
    }
  }

  cargar(evento: TableLazyLoadEvent): void {
    this.ultimoEvento = evento;
    this.cargando.set(true);
    this.api
      .listar<Iglesia>('catalogos/eclesiastico/iglesias', {
        q: this.filtroTexto() || undefined,
        page: Math.floor((evento.first ?? 0) / (evento.rows ?? 10)) + 1,
        por_pagina: evento.rows ?? 10,
      })
      .subscribe({
        next: (r) => {
          this.iglesias.set(r.data);
          this.total.set(r.meta.total);
          this.cargando.set(false);
          this.cargarMinistrosActuales(r.data);
        },
        error: () => this.cargando.set(false),
      });
  }

  recargar(): void {
    this.cargar({ ...this.ultimoEvento, first: 0 });
  }

  abrirFormulario(iglesia?: Iglesia): void {
    this.errorForm.set([]);
    this.edicion.set(iglesia ?? null);
    this.distritoSeleccionado.set(iglesia?.distrito_id ?? null);

    if (iglesia) {
      this.form.reset({
        clave: iglesia.clave,
        nombre: iglesia.nombre,
        municipio_id: iglesia.municipio_id,
        direccion: iglesia.direccion ?? '',
        telefono: iglesia.telefono ?? '',
        fecha_fundacion: iglesia.fecha_fundacion ? isoAFechaLocal(iglesia.fecha_fundacion) : null,
      });
      // El departamento no se guarda en la iglesia; se deduce del municipio actual.
      const municipioActual = this.todosMunicipios.find((m) => m.id === iglesia.municipio_id);
      this.cambiarDepartamento(municipioActual?.departamento_id ?? null, true);
    } else {
      this.form.reset({ municipio_id: null, direccion: '', telefono: '', fecha_fundacion: null });
      this.cambiarDepartamento(null);
    }
    this.dialogo.set(true);
  }

  guardar(): void {
    if (this.form.invalid || !this.distritoSeleccionado()) {
      this.form.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    this.errorForm.set([]);

    const v = this.form.getRawValue();
    const payload: Record<string, unknown> = {
      distrito_id: this.distritoSeleccionado(),
      municipio_id: v.municipio_id,
      clave: v.clave,
      nombre: v.nombre,
      direccion: v.direccion || undefined,
      telefono: v.telefono || undefined,
      fecha_fundacion: v.fecha_fundacion ? fechaLocalAIso(v.fecha_fundacion) : undefined,
    };

    const objetivo = this.edicion();
    const peticion = objetivo
      ? this.api.actualizar<Iglesia>('catalogos/eclesiastico/iglesias', objetivo.id, payload)
      : this.api.crear<Iglesia>('catalogos/eclesiastico/iglesias', payload);

    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.dialogo.set(false);
        this.mensajes.add({ severity: 'success', summary: objetivo ? 'Iglesia actualizada' : 'Iglesia creada' });
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

  eliminar(iglesia: Iglesia): void {
    this.api.eliminar('catalogos/eclesiastico/iglesias', iglesia.id).subscribe(() => {
      this.mensajes.add({ severity: 'success', summary: 'Iglesia dada de baja' });
      this.recargar();
    });
  }

  abrirMinistro(iglesia: Iglesia): void {
    this.iglesiaActiva.set(iglesia);
    this.formAsignacion.reset({ ministro_id: null, fecha_desde: new Date(), motivo: '' });
    this.cargarHistorial(iglesia.id);
    this.cargarOpcionesMinistro();
    this.dialogoMinistro.set(true);
  }

  private cargarHistorial(iglesiaId: number): void {
    this.iglesiaApi.historialMinistros(iglesiaId).subscribe((r) => this.historial.set(r.data));
  }

  asignar(): void {
    const iglesia = this.iglesiaActiva();
    if (!iglesia || this.formAsignacion.invalid) return;
    this.asignando.set(true);

    const v = this.formAsignacion.getRawValue();
    this.iglesiaApi
      .asignarMinistro(iglesia.id, {
        ministro_id: v.ministro_id!,
        fecha_desde: fechaLocalAIso(v.fecha_desde),
        motivo: v.motivo || null,
      })
      .subscribe({
        next: () => {
          this.asignando.set(false);
          this.mensajes.add({ severity: 'success', summary: 'Ministro asignado' });
          this.cargarHistorial(iglesia.id);
          this.cargarMinistrosActuales([iglesia]);
          this.formAsignacion.reset({ ministro_id: null, fecha_desde: new Date(), motivo: '' });
        },
        error: () => {
          this.asignando.set(false);
          this.mensajes.add({ severity: 'error', summary: 'No se pudo asignar el ministro' });
        },
      });
  }
}
