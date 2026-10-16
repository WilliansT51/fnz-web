import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, Subscription, debounceTime } from 'rxjs';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { TextareaModule } from 'primeng/textarea';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';

import { AuthService } from '../../core/auth/auth.service';
import { TienePermisoDirective } from '../../core/auth/tiene-permiso.directive';
import { CatalogoService } from '../../core/ofrendas/catalogo.service';
import { fechaLocalAIso, isoAFechaLocal } from '../../core/ofrendas/fecha.util';
import { GastoService } from '../../core/gastos/gasto.service';
import { CategoriaGasto, EstadoGasto, Gasto, GastoTipo } from '../../core/models/gastos.models';
import { Distrito, Iglesia, Jurisdiccion, Ministro, OpcionSelect } from '../../core/models/ofrendas.models';

/** Máximo de caracteres de la razón del gasto (igual que en el backend). */
const MAX_RAZON = 3000;

const SEVERIDAD_ESTADO: Record<EstadoGasto, 'warn' | 'success' | 'danger'> = {
  PENDIENTE: 'warn',
  APROBADO: 'success',
  RECHAZADO: 'danger',
};

const ETIQUETA_ESTADO: Record<EstadoGasto, string> = {
  PENDIENTE: 'Pendiente de aprobación',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
};

/** Categoría => campo del gasto que guarda su destino. */
const CAMPO_DESTINO: Record<CategoriaGasto, 'jurisdiccion_id' | 'distrito_id' | 'iglesia_id' | 'ministro_id'> = {
  JURISDICCIONAL: 'jurisdiccion_id',
  DISTRITAL: 'distrito_id',
  IGLESIA: 'iglesia_id',
  MINISTRO: 'ministro_id',
};

/**
 * Control de Gastos: registro de egresos por categoría (jurisdiccional,
 * distrital, iglesia o ministro; el nombre se elige del catálogo
 * correspondiente), aprobación por otro usuario y comprobante en PDF una
 * vez aprobado.
 */
@Component({
  selector: 'app-gastos',
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    DatePickerModule,
    TextareaModule,
    TagModule,
    DialogModule,
    TienePermisoDirective,
  ],
  template: `
    <header class="fnz-toolbar-tabla">
      <div>
        <h1 class="fnz-titulo-pagina">Control de gastos</h1>
        <p class="fnz-subtitulo">Registro de egresos, su aprobación y el comprobante de pago.</p>
      </div>
      <p-button *appTienePermiso="'gastos.crear'" label="Nuevo gasto" icon="pi pi-plus" (onClick)="abrirFormulario()" />
    </header>

    <div class="filtros">
      <span class="busqueda">
        <i class="pi pi-search"></i>
        <input pInputText type="search" placeholder="Buscar por No. de gasto o nombre" [ngModel]="busqueda()" (ngModelChange)="buscar($event)" />
      </span>
      <p-select
        [options]="opcionesCategoria"
        optionLabel="label"
        optionValue="value"
        placeholder="Todas las categorías"
        [showClear]="true"
        [ngModel]="filtroCategoria()"
        (ngModelChange)="filtroCategoria.set($event); recargar()"
      />
      <p-select
        [options]="opcionesEstado"
        optionLabel="label"
        optionValue="value"
        placeholder="Todos los estados"
        [showClear]="true"
        [ngModel]="filtroEstado()"
        (ngModelChange)="filtroEstado.set($event); recargar()"
      />
    </div>

    <p-table
      [value]="gastos()"
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
          <th>No.</th>
          <th>Fecha</th>
          <th>Categoría</th>
          <th>Nombre</th>
          <th>Tipo</th>
          <th>Monto</th>
          <th>Estado</th>
          <th style="width: 15rem"></th>
        </tr>
      </ng-template>
      <ng-template #body let-g>
        <tr>
          <td>{{ g.codigo }}</td>
          <td>{{ g.fecha_egreso | date: 'dd/MM/yyyy' : 'UTC' }}</td>
          <td>{{ etiquetaCategoria(g.categoria) }}</td>
          <td>{{ g.nombre }}</td>
          <td>{{ g.tipo?.nombre }}</td>
          <td>Q {{ g.monto | number: '1.2-2' }}</td>
          <td><p-tag [value]="etiquetaEstado(g.estado)" [severity]="severidad(g.estado)" /></td>
          <td class="acciones">
            <p-button icon="pi pi-eye" [rounded]="true" [text]="true" size="small" (onClick)="verDetalle(g)" />
            @if (g.estado === 'APROBADO') {
              <p-button label="Comprobante" icon="pi pi-file-pdf" severity="secondary" [outlined]="true" size="small" (onClick)="descargarComprobante(g)" />
            }
            <p-button
              *appTienePermiso="'gastos.editar'"
              icon="pi pi-pencil"
              [rounded]="true"
              [text]="true"
              size="small"
              [title]="g.estado === 'PENDIENTE' ? 'Editar' : 'Corregir y reenviar a aprobación'"
              (onClick)="abrirFormulario(g)"
            />
            @if (g.estado === 'PENDIENTE') {
              <p-button
                *appTienePermiso="'gastos.aprobar'"
                icon="pi pi-check"
                severity="success"
                [rounded]="true"
                [text]="true"
                size="small"
                [disabled]="g.creado_por === auth.usuario()?.id"
                (onClick)="abrirResolucion(g, 'aprobar')"
              />
              <p-button
                *appTienePermiso="'gastos.aprobar'"
                icon="pi pi-times"
                severity="danger"
                [rounded]="true"
                [text]="true"
                size="small"
                [disabled]="g.creado_por === auth.usuario()?.id"
                (onClick)="abrirResolucion(g, 'rechazar')"
              />
            }
          </td>
        </tr>
      </ng-template>
      <ng-template #emptymessage>
        <tr>
          <td colspan="8" class="vacio">Sin gastos que coincidan con el filtro.</td>
        </tr>
      </ng-template>
    </p-table>

    <!-- Diálogo de registro / edición -->
    <p-dialog
      [header]="esCorreccion() ? 'Corregir gasto' : editandoId() ? 'Editar gasto' : 'Nuevo gasto'"
      [(visible)]="dialogoFormulario"
      [modal]="true"
      [style]="{ width: '44rem', maxWidth: '96vw' }"
    >
      <form class="formulario" [formGroup]="form" (ngSubmit)="guardar()">
        @if (esCorreccion()) {
          <p class="aviso-correccion">
            <i class="pi pi-info-circle"></i>
            Este gasto ya fue {{ estadoOriginal() === 'APROBADO' ? 'aprobado' : 'rechazado' }}. Al guardar la corrección volverá a
            <strong>Pendiente de aprobación</strong> y deberá aprobarlo otro usuario (distinto de quien lo capturó y de quien lo corrige).
          </p>
          <label>
            <span>Motivo de la corrección</span>
            <input pInputText formControlName="motivo" maxlength="255" />
          </label>
        }
        <div class="grid2">
          <label>
            <span>Categoría del gasto</span>
            <p-select formControlName="categoria" [options]="opcionesCategoria" optionLabel="label" optionValue="value" placeholder="Seleccione" appendTo="body" fluid />
          </label>
          <label>
            <span>Tipo de gasto</span>
            <p-select formControlName="gasto_tipo_id" [options]="opcionesTipo()" optionLabel="label" optionValue="value" placeholder="Seleccione" appendTo="body" fluid />
          </label>
        </div>

        <label>
          <span>Nombre{{ etiquetaDestino() ? ' (' + etiquetaDestino() + ')' : '' }}</span>
          <p-select
            formControlName="destino_id"
            [options]="opcionesDestino()"
            optionLabel="label"
            optionValue="value"
            [filter]="true"
            [placeholder]="vista().categoria ? 'Seleccione' : 'Primero elija la categoría'"
            [disabled]="!vista().categoria"
            appendTo="body"
            fluid
          />
        </label>

        <div class="grid2">
          <label>
            <span>Cantidad (Q)</span>
            <p-inputNumber formControlName="monto" mode="currency" currency="GTQ" locale="es-GT" [minFractionDigits]="2" [maxFractionDigits]="2" [min]="0" fluid />
          </label>
          <label>
            <span>Fecha del egreso</span>
            <p-datePicker formControlName="fecha_egreso" dateFormat="dd/mm/yy" appendTo="body" fluid />
          </label>
        </div>

        <label>
          <span>Razón</span>
          <textarea pTextarea formControlName="razon" rows="6" [maxLength]="maxRazon" fluid></textarea>
          <small class="contador" [class.limite]="caracteresDisponibles() === 0">
            Caracteres disponibles: {{ caracteresDisponibles() | number: '1.0-0' }} de {{ maxRazon | number: '1.0-0' }}
          </small>
        </label>

        @if (errorForm().length) {
          <ul class="errores">
            @for (e of errorForm(); track e) { <li>{{ e }}</li> }
          </ul>
        }

        <div class="pie">
          <p-button label="Cancelar" severity="secondary" [text]="true" type="button" (onClick)="dialogoFormulario.set(false)" />
          <p-button label="Guardar gasto" type="submit" [loading]="guardando()" [disabled]="form.invalid || guardando()" />
        </div>
      </form>
    </p-dialog>

    <!-- Diálogo de detalle -->
    <p-dialog header="Detalle del gasto" [(visible)]="dialogoDetalle" [modal]="true" [style]="{ width: '40rem', maxWidth: '96vw' }">
      @if (activo(); as g) {
        <div class="cabecera-detalle">
          <strong>{{ g.codigo }}</strong>
          <p-tag [value]="etiquetaEstado(g.estado)" [severity]="severidad(g.estado)" />
        </div>
        <dl class="datos">
          <dt>Categoría</dt><dd>{{ etiquetaCategoria(g.categoria) }}</dd>
          <dt>Nombre</dt><dd>{{ g.nombre }}</dd>
          <dt>Tipo de gasto</dt><dd>{{ g.tipo?.nombre }}</dd>
          <dt>Cantidad</dt><dd>Q {{ g.monto | number: '1.2-2' }}</dd>
          <dt>Fecha del egreso</dt><dd>{{ g.fecha_egreso | date: 'dd/MM/yyyy' : 'UTC' }}</dd>
          <dt>Capturado por</dt><dd>{{ g.creador?.nombre }} {{ g.creador?.apellido }}</dd>
          @if (g.aprobador) {
            <dt>{{ g.estado === 'APROBADO' ? 'Aprobado por' : 'Rechazado por' }}</dt>
            <dd>{{ g.aprobador.nombre }} {{ g.aprobador.apellido }} · {{ g.fecha_resolucion | date: 'dd/MM/yyyy HH:mm' }}</dd>
          }
          @if (g.comentario_resolucion) { <dt>Comentario</dt><dd>{{ g.comentario_resolucion }}</dd> }
          @if (g.motivo_correccion) {
            <dt>Última corrección</dt>
            <dd>{{ g.motivo_correccion }} · {{ g.fecha_correccion | date: 'dd/MM/yyyy HH:mm' }}</dd>
          }
        </dl>
        <p class="fnz-titulo-seccion">Razón</p>
        <p class="razon">{{ g.razon }}</p>
        @if (g.estado === 'APROBADO') {
          <div class="pie">
            <p-button label="Generar comprobante" icon="pi pi-file-pdf" severity="secondary" [outlined]="true" (onClick)="descargarComprobante(g)" />
          </div>
        }
      }
    </p-dialog>

    <!-- Diálogo de aprobar/rechazar -->
    <p-dialog
      [header]="accionResolucion() === 'aprobar' ? 'Aprobar gasto' : 'Rechazar gasto'"
      [(visible)]="dialogoResolucion"
      [modal]="true"
      [style]="{ width: '28rem', maxWidth: '96vw' }"
    >
      <label class="campo">
        <span>{{ accionResolucion() === 'aprobar' ? 'Comentario (opcional)' : 'Motivo del rechazo (opcional)' }}</span>
        <input pInputText [(ngModel)]="comentarioResolucion" maxlength="255" fluid />
      </label>
      <div class="pie">
        <p-button label="Cancelar" severity="secondary" [text]="true" (onClick)="dialogoResolucion.set(false)" />
        <p-button
          [label]="accionResolucion() === 'aprobar' ? 'Aprobar' : 'Rechazar'"
          [severity]="accionResolucion() === 'aprobar' ? 'success' : 'danger'"
          [loading]="resolviendo()"
          (onClick)="resolver()"
        />
      </div>
    </p-dialog>
  `,
  styles: [
    `
      .filtros { display: flex; gap: 0.75rem; margin-bottom: 0.75rem; flex-wrap: wrap; }
      .busqueda { position: relative; flex: 1; min-width: 16rem; max-width: 26rem; display: flex; align-items: center; }
      .busqueda i { position: absolute; left: 0.75rem; color: var(--fnz-tinta-suave); }
      .busqueda input { width: 100%; padding-left: 2.25rem; }
      .acciones { white-space: nowrap; text-align: right; }
      .acciones p-button + p-button { margin-left: 0.4rem; }
      .vacio { text-align: center; padding: 2rem; color: var(--fnz-tinta-suave); }
      .formulario { display: flex; flex-direction: column; gap: 0.9rem; padding-top: 0.5rem; }
      .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.9rem; }
      label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.82rem; font-weight: 500; }
      .aviso-correccion { margin: 0; padding: 0.6rem 0.8rem; border-radius: 8px; background: #fff7e6; color: #7a4b00; font-size: 0.82rem; }
      .contador { font-weight: 400; color: var(--fnz-tinta-suave); align-self: flex-end; }
      .contador.limite { color: #c0392b; font-weight: 600; }
      .errores { margin: 0; padding-left: 1.1rem; color: #c0392b; font-size: 0.82rem; }
      .pie { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.75rem; }
      .campo { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.82rem; font-weight: 500; margin: 0.9rem 0; }
      .cabecera-detalle { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
      .datos { display: grid; grid-template-columns: 10rem 1fr; gap: 0.35rem 1rem; font-size: 0.86rem; margin: 0.5rem 0; }
      .datos dt { color: var(--fnz-tinta-suave); }
      .datos dd { margin: 0; }
      .razon { white-space: pre-wrap; font-size: 0.86rem; margin: 0.25rem 0; }
    `,
  ],
})
export class GastosComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  private readonly catalogos = inject(CatalogoService);
  private readonly api = inject(GastoService);
  private readonly fb = inject(FormBuilder);
  private readonly mensajes = inject(MessageService);

  readonly maxRazon = MAX_RAZON;

  readonly opcionesCategoria = [
    { label: 'Jurisdiccional', value: 'JURISDICCIONAL' },
    { label: 'Distrital', value: 'DISTRITAL' },
    { label: 'Iglesia', value: 'IGLESIA' },
    { label: 'Ministro', value: 'MINISTRO' },
  ];
  readonly opcionesEstado = [
    { label: 'Pendiente de aprobación', value: 'PENDIENTE' },
    { label: 'Aprobado', value: 'APROBADO' },
    { label: 'Rechazado', value: 'RECHAZADO' },
  ];

  readonly gastos = signal<Gasto[]>([]);
  readonly total = signal(0);
  readonly cargando = signal(false);
  readonly busqueda = signal('');
  readonly filtroCategoria = signal<string | null>(null);
  readonly filtroEstado = signal<string | null>('PENDIENTE');

  /** Catálogos para los selects del formulario. */
  readonly opcionesTipo = signal<OpcionSelect[]>([]);
  private readonly opcionesPorCategoria = signal<Record<CategoriaGasto, OpcionSelect[]>>({
    JURISDICCIONAL: [],
    DISTRITAL: [],
    IGLESIA: [],
    MINISTRO: [],
  });

  readonly dialogoFormulario = signal(false);
  readonly editandoId = signal<number | null>(null);
  readonly guardando = signal(false);
  readonly errorForm = signal<string[]>([]);

  readonly dialogoDetalle = signal(false);
  readonly activo = signal<Gasto | null>(null);

  readonly dialogoResolucion = signal(false);
  readonly accionResolucion = signal<'aprobar' | 'rechazar'>('aprobar');
  readonly resolviendo = signal(false);
  comentarioResolucion = '';

  private ultimoEvento: TableLazyLoadEvent = { first: 0, rows: 15 };
  private readonly escritura$ = new Subject<void>();
  private suscripcion?: Subscription;

  readonly form = this.fb.group({
    categoria: [null as CategoriaGasto | null, Validators.required],
    gasto_tipo_id: [null as number | null, Validators.required],
    destino_id: [null as number | null, Validators.required],
    monto: [null as number | null, [Validators.required, Validators.min(0.01)]],
    fecha_egreso: [null as Date | null, Validators.required],
    razon: ['', [Validators.required, Validators.maxLength(MAX_RAZON)]],
    motivo: [''],
  });

  /** Estado que tenía el gasto que se corrige (null en un alta o al editar un pendiente). */
  readonly estadoOriginal = signal<EstadoGasto | null>(null);
  /** True cuando se edita un gasto ya resuelto: pide motivo y lo reenvía a aprobación. */
  readonly esCorreccion = computed(() => this.estadoOriginal() !== null && this.estadoOriginal() !== 'PENDIENTE');

  /**
   * Espejo en señal de los valores del formulario: los `computed` no reaccionan
   * a `FormGroup.value`, así que se sincroniza vía `valueChanges`.
   */
  readonly vista = signal(this.form.getRawValue());

  /** Opciones del select "Nombre": el catálogo que corresponde a la categoría elegida. */
  readonly opcionesDestino = computed(() => {
    const categoria = this.vista().categoria;
    return categoria ? this.opcionesPorCategoria()[categoria] : [];
  });

  /** Etiqueta del catálogo de origen del Nombre (según la categoría). */
  readonly etiquetaDestino = computed(() => {
    const categoria = this.vista().categoria;
    return categoria ? this.etiquetaCategoria(categoria) : '';
  });

  /** Caracteres que aún se pueden escribir en la razón. */
  readonly caracteresDisponibles = computed(() => Math.max(0, MAX_RAZON - (this.vista().razon ?? '').length));

  ngOnInit(): void {
    this.form.valueChanges.subscribe(() => this.vista.set(this.form.getRawValue()));
    // Al cambiar la categoría se limpia el nombre elegido (pertenece a otro catálogo).
    this.form.controls.categoria.valueChanges.subscribe(() => this.form.controls.destino_id.setValue(null));
    this.suscripcion = this.escritura$.pipe(debounceTime(300)).subscribe(() => this.recargar());

    this.catalogos.todos<GastoTipo>('catalogos/financiero/gasto-tipos', { estado: 1 }).subscribe((r) => {
      this.opcionesTipo.set(r.data.map((t) => ({ label: t.nombre, value: t.id })));
    });
    this.catalogos.todos<Jurisdiccion>('catalogos/ubicacion/jurisdicciones').subscribe((r) => this.fijarOpciones('JURISDICCIONAL', r.data.map((j) => ({ label: j.nombre, value: j.id }))));
    this.catalogos.todos<Distrito>('catalogos/ubicacion/distritos').subscribe((r) => this.fijarOpciones('DISTRITAL', r.data.map((d) => ({ label: d.nombre, value: d.id }))));
    this.catalogos.todos<Iglesia>('catalogos/eclesiastico/iglesias').subscribe((r) => this.fijarOpciones('IGLESIA', r.data.map((i) => ({ label: `${i.nombre} (${i.clave})`, value: i.id }))));
    this.catalogos.todos<Ministro>('catalogos/eclesiastico/ministros').subscribe((r) => this.fijarOpciones('MINISTRO', r.data.map((m) => ({ label: `${m.nombre} ${m.apellido}`, value: m.id }))));
  }

  ngOnDestroy(): void {
    this.suscripcion?.unsubscribe();
  }

  /** Guarda las opciones de una categoría sin mutar el objeto anterior. @param categoria categoría. @param opciones opciones del select. */
  private fijarOpciones(categoria: CategoriaGasto, opciones: OpcionSelect[]): void {
    this.opcionesPorCategoria.update((o) => ({ ...o, [categoria]: opciones }));
  }

  /** Actualiza el texto de búsqueda y consulta con retardo. @param texto lo escrito. */
  buscar(texto: string): void {
    this.busqueda.set(texto);
    this.escritura$.next();
  }

  etiquetaCategoria(categoria: CategoriaGasto): string {
    return this.opcionesCategoria.find((o) => o.value === categoria)?.label ?? categoria;
  }

  etiquetaEstado(estado: EstadoGasto): string {
    return ETIQUETA_ESTADO[estado];
  }

  severidad(estado: EstadoGasto) {
    return SEVERIDAD_ESTADO[estado];
  }

  cargar(evento: TableLazyLoadEvent): void {
    this.ultimoEvento = evento;
    this.cargando.set(true);
    this.api
      .listar({
        q: this.busqueda().trim() || undefined,
        categoria: this.filtroCategoria() ?? undefined,
        estado: this.filtroEstado() ?? undefined,
        page: Math.floor((evento.first ?? 0) / (evento.rows ?? 15)) + 1,
        por_pagina: evento.rows ?? 15,
      })
      .subscribe({
        next: (r) => {
          this.gastos.set(r.data);
          this.total.set(r.meta.total);
          this.cargando.set(false);
        },
        error: () => this.cargando.set(false),
      });
  }

  recargar(): void {
    this.cargar({ ...this.ultimoEvento, first: 0 });
  }

  /**
   * Abre el formulario vacío (alta) o con los datos de un gasto pendiente (edición).
   * @param gasto gasto a editar; omitir para un alta.
   */
  abrirFormulario(gasto?: Gasto): void {
    this.errorForm.set([]);
    this.editandoId.set(gasto?.id ?? null);
    this.estadoOriginal.set(gasto?.estado ?? null);
    // El motivo solo es obligatorio al corregir un gasto ya resuelto.
    const motivo = this.form.controls.motivo;
    motivo.setValidators(gasto && gasto.estado !== 'PENDIENTE' ? [Validators.required] : []);
    motivo.updateValueAndValidity();

    if (gasto) {
      this.form.reset({
        motivo: '',
        categoria: gasto.categoria,
        gasto_tipo_id: gasto.gasto_tipo_id,
        destino_id: gasto[CAMPO_DESTINO[gasto.categoria]],
        monto: Number(gasto.monto),
        fecha_egreso: isoAFechaLocal(gasto.fecha_egreso),
        razon: gasto.razon,
      });
      // Reaplicar el destino: cambiar la categoría lo limpia vía valueChanges.
      this.form.controls.destino_id.setValue(gasto[CAMPO_DESTINO[gasto.categoria]]);
    } else {
      this.form.reset({ categoria: null, gasto_tipo_id: null, destino_id: null, monto: null, fecha_egreso: new Date(), razon: '', motivo: '' });
    }
    this.dialogoFormulario.set(true);
  }

  /** Envía el gasto (alta o edición) con solo el destino que corresponde a la categoría. */
  guardar(): void {
    if (this.form.invalid) return;
    this.guardando.set(true);
    this.errorForm.set([]);

    const v = this.form.getRawValue();
    const categoria = v.categoria as CategoriaGasto;
    const datos = {
      categoria,
      gasto_tipo_id: v.gasto_tipo_id as number,
      jurisdiccion_id: null,
      distrito_id: null,
      iglesia_id: null,
      ministro_id: null,
      [CAMPO_DESTINO[categoria]]: v.destino_id,
      monto: v.monto as number,
      fecha_egreso: fechaLocalAIso(v.fecha_egreso as Date),
      razon: (v.razon ?? '').trim(),
    };

    const id = this.editandoId();
    const correccion = this.esCorreccion();
    const peticion = id ? this.api.actualizar(id, datos, correccion ? (v.motivo ?? '').trim() : undefined) : this.api.crear(datos);
    peticion.subscribe({
      next: (r) => {
        this.guardando.set(false);
        this.dialogoFormulario.set(false);
        this.mensajes.add({
          severity: 'success',
          summary: correccion ? 'Corrección guardada: el gasto quedó pendiente de aprobación' : id ? 'Gasto actualizado' : `Gasto ${r.data.codigo} registrado, pendiente de aprobación`,
        });
        this.recargar();
      },
      error: (e: HttpErrorResponse) => {
        this.guardando.set(false);
        this.errorForm.set(this.mensajesDeError(e, 'No se pudo guardar el gasto.'));
      },
    });
  }

  /** Abre el detalle de un gasto. @param g gasto de la lista. */
  verDetalle(g: Gasto): void {
    this.api.obtener(g.id).subscribe((r) => {
      this.activo.set(r.data);
      this.dialogoDetalle.set(true);
    });
  }

  /** Genera el comprobante (PDF) de un gasto aprobado y lo abre en otra pestaña. @param g gasto aprobado. */
  descargarComprobante(g: Gasto): void {
    this.api.comprobante(g.id).subscribe({
      next: (pdf) => {
        const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => this.mensajes.add({ severity: 'error', summary: 'No se pudo generar el comprobante' }),
    });
  }

  abrirResolucion(g: Gasto, accion: 'aprobar' | 'rechazar'): void {
    this.activo.set(g);
    this.accionResolucion.set(accion);
    this.comentarioResolucion = '';
    this.dialogoResolucion.set(true);
  }

  resolver(): void {
    const g = this.activo();
    if (!g) return;
    this.resolviendo.set(true);

    const peticion =
      this.accionResolucion() === 'aprobar'
        ? this.api.aprobar(g.id, this.comentarioResolucion || undefined)
        : this.api.rechazar(g.id, this.comentarioResolucion || undefined);

    peticion.subscribe({
      next: () => {
        this.resolviendo.set(false);
        this.dialogoResolucion.set(false);
        this.mensajes.add({ severity: 'success', summary: this.accionResolucion() === 'aprobar' ? 'Gasto aprobado' : 'Gasto rechazado' });
        this.recargar();
      },
      error: (e: HttpErrorResponse) => {
        this.resolviendo.set(false);
        this.mensajes.add({ severity: 'error', summary: this.mensajesDeError(e, 'No se pudo resolver el gasto.')[0] });
      },
    });
  }

  /**
   * Extrae los mensajes de error de una respuesta 422 (o uno genérico).
   * @param e error HTTP. @param porDefecto texto si no hay detalle.
   */
  private mensajesDeError(e: HttpErrorResponse, porDefecto: string): string[] {
    if (e.status === 422) {
      const lista = Object.values(e.error?.errores ?? e.error?.errors ?? {}).flat() as string[];
      if (lista.length) return lista;
    }
    return [e.error?.mensaje ?? porDefecto];
  }
}
