import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';

import { AuthService } from '../../core/auth/auth.service';
import { TienePermisoDirective } from '../../core/auth/tiene-permiso.directive';
import { CatalogoService } from '../../core/ofrendas/catalogo.service';
import { fechaLocalAIso, isoAFechaLocal } from '../../core/ofrendas/fecha.util';
import { PrestamoService } from '../../core/prestamos/prestamo.service';
import { Iglesia, Ministro, OpcionSelect } from '../../core/models/ofrendas.models';
import { EstadoPrestamo, Prestamo } from '../../core/models/prestamos.models';

const SEVERIDAD_ESTADO: Record<EstadoPrestamo, 'warn' | 'info' | 'success' | 'danger'> = {
  PENDIENTE: 'warn',
  ACTIVO: 'info',
  PAGADO: 'success',
  RECHAZADO: 'danger',
};

const SEVERIDAD_CUOTA: Record<string, 'warn' | 'info' | 'success'> = {
  PENDIENTE: 'warn',
  PARCIAL: 'info',
  PAGADA: 'success',
};

/** Cuota calculada en el cliente para la vista previa de la tabla de pagos. */
interface CuotaPrevia {
  numero: number;
  fecha: Date;
  monto: number;
}

/**
 * Préstamos a iglesias o ministros: captura (sin intereses, cuotas
 * mensuales iguales con vista previa de la tabla de pagos), aprobación por
 * otro usuario, y consulta de su tabla de pagos e historial (los pagos se registran en {@see PagosPrestamosComponent}).
 */
@Component({
  selector: 'app-prestamos',
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
    TagModule,
    DialogModule,
    TienePermisoDirective,
  ],
  template: `
    <header class="fnz-toolbar-tabla">
      <div>
        <h1 class="fnz-titulo-pagina">Préstamos</h1>
        <p class="fnz-subtitulo">Registro de préstamos a iglesias y ministros (sin intereses, cuotas mensuales). Los pagos se registran en "Pagos de préstamos".</p>
      </div>
      <p-button *appTienePermiso="'prestamos.crear'" label="Nuevo préstamo" icon="pi pi-plus" (onClick)="abrirCaptura()" />
    </header>

    <div class="filtros">
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
      [value]="prestamos()"
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
          <th>Código</th>
          <th>Deudor</th>
          <th>Monto</th>
          <th>Plazo</th>
          <th>Pagado</th>
          <th>Saldo</th>
          <th>Estado</th>
          <th style="width: 15rem"></th>
        </tr>
      </ng-template>
      <ng-template #body let-p>
        <tr>
          <td>{{ p.codigo }}</td>
          <td>{{ deudor(p) }}</td>
          <td>Q {{ p.monto | number: '1.2-2' }}</td>
          <td>{{ p.plazo_meses }} meses</td>
          <td>Q {{ p.total_pagado | number: '1.2-2' }}</td>
          <td>Q {{ p.saldo_pendiente | number: '1.2-2' }}</td>
          <td><p-tag [value]="p.estado" [severity]="severidad(p.estado)" /></td>
          <td class="acciones">
            <p-button icon="pi pi-eye" [rounded]="true" [text]="true" size="small" (onClick)="verDetalle(p)" />
            @if (p.estado !== 'PAGADO') {
              <p-button
                *appTienePermiso="'prestamos.editar'"
                icon="pi pi-pencil"
                [rounded]="true"
                [text]="true"
                size="small"
                [title]="p.estado === 'PENDIENTE' ? 'Editar' : 'Corregir y reenviar a aprobación'"
                (onClick)="abrirEdicion(p)"
              />
            }
            @if (p.estado === 'ACTIVO' || p.estado === 'PAGADO') {
              <p-button
                label="Comprobante"
                icon="pi pi-file-pdf"
                severity="secondary"
                [outlined]="true"
                size="small"
                (onClick)="descargarComprobante(p)"
              />
            }
            @if (p.estado === 'PENDIENTE') {
              <p-button
                *appTienePermiso="'prestamos.aprobar'"
                icon="pi pi-check"
                severity="success"
                [rounded]="true"
                [text]="true"
                size="small"
                [disabled]="p.creado_por === auth.usuario()?.id"
                (onClick)="abrirResolucion(p, 'aprobar')"
              />
              <p-button
                *appTienePermiso="'prestamos.aprobar'"
                icon="pi pi-times"
                severity="danger"
                [rounded]="true"
                [text]="true"
                size="small"
                [disabled]="p.creado_por === auth.usuario()?.id"
                (onClick)="abrirResolucion(p, 'rechazar')"
              />
            }
          </td>
        </tr>
      </ng-template>
      <ng-template #emptymessage>
        <tr>
          <td colspan="8" class="vacio">Sin préstamos que coincidan con el filtro.</td>
        </tr>
      </ng-template>
    </p-table>

    <!-- Diálogo de captura -->
    <p-dialog
      [header]="esCorreccion() ? 'Corregir préstamo' : editandoId() ? 'Editar préstamo' : 'Nuevo préstamo'"
      [(visible)]="dialogoCaptura"
      [modal]="true"
      [style]="{ width: '46rem', maxWidth: '96vw' }"
    >
      <form class="formulario" [formGroup]="formPrestamo" (ngSubmit)="guardarPrestamo()">
        @if (esCorreccion()) {
          <p class="aviso-correccion">
            <i class="pi pi-info-circle"></i>
            Este préstamo ya fue {{ estadoOriginal() === 'RECHAZADO' ? 'rechazado' : 'aprobado' }}. Al guardar la corrección se regenera su tabla de pagos y volverá a
            <strong>Pendiente</strong>: deberá aprobarlo otro usuario (distinto de quien lo capturó y de quien lo corrige). No se puede corregir si ya tiene pagos.
          </p>
          <label>
            <span>Motivo de la corrección</span>
            <input pInputText formControlName="motivo" maxlength="255" />
          </label>
        }
        <div class="grid2">
          <label>
            <span>Tipo de deudor</span>
            <p-select formControlName="tipo" [options]="opcionesTipo" optionLabel="label" optionValue="value" appendTo="body" fluid />
          </label>
          <label>
            <span>{{ vista().tipo === 'IGLESIA' ? 'Iglesia' : 'Ministro' }}</span>
            <p-select
              formControlName="deudor_id"
              [options]="vista().tipo === 'IGLESIA' ? opcionesIglesia() : opcionesMinistro()"
              optionLabel="label"
              optionValue="value"
              [filter]="true"
              appendTo="body"
              fluid
            />
          </label>
        </div>
        <div class="grid3">
          <label>
            <span>Monto (Q)</span>
            <p-inputNumber formControlName="monto" mode="currency" currency="GTQ" locale="es-GT" [minFractionDigits]="2" fluid />
          </label>
          <label>
            <span>Plazo (meses)</span>
            <p-inputNumber formControlName="plazo_meses" [useGrouping]="false" [min]="1" [max]="120" fluid />
          </label>
          <label>
            <span>Fecha de desembolso</span>
            <p-datePicker formControlName="fecha_desembolso" dateFormat="dd/mm/yy" appendTo="body" fluid />
          </label>
        </div>
        <div class="grid2">
          <label>
            <span>Fecha de la primera cuota</span>
            <p-datePicker formControlName="fecha_primera_cuota" dateFormat="dd/mm/yy" [minDate]="vista().fecha_desembolso" appendTo="body" fluid />
          </label>
          <label>
            <span>Observaciones (opcional)</span>
            <input pInputText formControlName="observaciones" maxlength="255" />
          </label>
        </div>

        @if (cuotasPrevia().length) {
          <p class="fnz-titulo-seccion">Tabla de pagos ({{ cuotasPrevia().length }} cuotas)</p>
          <div class="scroll-tabla">
            <table class="tabla-lineas">
              <thead><tr><th>No.</th><th>Vencimiento</th><th>Cuota</th></tr></thead>
              <tbody>
                @for (c of cuotasPrevia(); track c.numero) {
                  <tr><td>{{ c.numero }}</td><td>{{ c.fecha | date: 'dd/MM/yyyy' }}</td><td>Q {{ c.monto | number: '1.2-2' }}</td></tr>
                }
              </tbody>
            </table>
          </div>
        }

        @if (errorForm().length) {
          <ul class="errores">
            @for (e of errorForm(); track e) { <li>{{ e }}</li> }
          </ul>
        }

        <div class="pie">
          <p-button label="Cancelar" severity="secondary" [text]="true" type="button" (onClick)="dialogoCaptura.set(false)" />
          <p-button label="Guardar préstamo" type="submit" [loading]="guardando()" [disabled]="formPrestamo.invalid || guardando()" />
        </div>
      </form>
    </p-dialog>

    <!-- Diálogo de detalle: resumen, tabla de pagos e historial de pagos -->
    <p-dialog header="Detalle del préstamo" [(visible)]="dialogoDetalle" [modal]="true" [style]="{ width: '56rem', maxWidth: '96vw' }">
      @if (activo(); as p) {
        <div class="cabecera-detalle">
          <div class="titulo-detalle">
            <span>
              <strong>{{ p.codigo }}</strong> — {{ deudor(p) }}
              <p-tag [value]="p.estado" [severity]="severidad(p.estado)" />
            </span>
            @if (p.estado === 'ACTIVO' || p.estado === 'PAGADO') {
              <p-button
                label="Generar comprobante"
                icon="pi pi-file-pdf"
                severity="secondary"
                [outlined]="true"
                size="small"
                (onClick)="descargarComprobante(p)"
              />
            }
          </div>
          <p class="fnz-subtitulo">
            Desembolso {{ p.fecha_desembolso | date: 'dd/MM/yyyy' : 'UTC' }} · {{ p.plazo_meses }} cuotas mensuales · Capturado por {{ p.creador?.nombre }}
            @if (p.aprobador) { · Resuelto por {{ p.aprobador.nombre }} }
          </p>
          @if (p.comentario_resolucion) { <p><strong>Comentario:</strong> {{ p.comentario_resolucion }}</p> }
        </div>

        <div class="resumen">
          <div><span>Monto del préstamo</span><strong>Q {{ p.monto | number: '1.2-2' }}</strong></div>
          <div><span>Total pagado</span><strong>Q {{ p.total_pagado | number: '1.2-2' }}</strong></div>
          <div class="general"><span>Saldo pendiente</span><strong>Q {{ p.saldo_pendiente | number: '1.2-2' }}</strong></div>
        </div>

        <p class="fnz-titulo-seccion">Tabla de pagos</p>
        <table class="tabla-lineas">
          <thead><tr><th>No.</th><th>Vencimiento</th><th>Cuota</th><th>Pagado</th><th>Estado</th></tr></thead>
          <tbody>
            @for (c of p.cuotas; track c.id) {
              <tr>
                <td>{{ c.numero }}</td>
                <td>{{ c.fecha_vencimiento | date: 'dd/MM/yyyy' : 'UTC' }}</td>
                <td>Q {{ c.monto | number: '1.2-2' }}</td>
                <td>Q {{ c.monto_pagado | number: '1.2-2' }}</td>
                <td><p-tag [value]="c.estado" [severity]="severidadCuota(c.estado)" /></td>
              </tr>
            }
          </tbody>
        </table>

        <p class="fnz-titulo-seccion">Historial de pagos</p>
        @if (p.pagos?.length) {
          <table class="tabla-lineas">
            <thead><tr><th>Fecha</th><th>Monto</th><th>Referencia</th><th>Se aplicó a</th><th>Estado</th></tr></thead>
            <tbody>
              @for (g of p.pagos; track g.id) {
                <tr [class.anulado]="g.estado === 'ANULADO'">
                  <td>{{ g.fecha_pago | date: 'dd/MM/yyyy' : 'UTC' }}</td>
                  <td>Q {{ g.monto | number: '1.2-2' }}</td>
                  <td>{{ g.referencia || '—' }}</td>
                  <td>
                    @for (a of g.aplicaciones; track a.id) {
                      <div>Cuota {{ a.cuota?.numero }}: Q {{ a.monto | number: '1.2-2' }}</div>
                    }
                  </td>
                  <td>
                    {{ g.estado }}
                    @if (g.motivo_anulacion) { <small>({{ g.motivo_anulacion }})</small> }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <p class="fnz-subtitulo">Aún no hay pagos registrados.</p>
        }
      }
    </p-dialog>

    <!-- Diálogo de aprobar/rechazar -->
    <p-dialog
      [header]="accionResolucion() === 'aprobar' ? 'Aprobar préstamo' : 'Rechazar préstamo'"
      [(visible)]="dialogoResolucion"
      [modal]="true"
      [style]="{ width: '28rem' }"
    >
      <label class="campo">
        <span>Comentario (opcional)</span>
        <input pInputText [(ngModel)]="comentarioResolucion" fluid />
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
      .filtros { display: flex; gap: 0.75rem; margin-bottom: 0.75rem; }
      .acciones { white-space: nowrap; text-align: right; }
      .vacio { text-align: center; padding: 2rem; color: var(--fnz-tinta-suave); }
      .formulario { display: flex; flex-direction: column; gap: 0.9rem; padding-top: 0.5rem; }
      .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.9rem; }
      .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.9rem; }
      label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.82rem; font-weight: 500; }
      .resumen { display: grid; gap: 0.4rem; background: var(--fnz-fondo); border-radius: 8px; padding: 0.9rem; font-size: 0.85rem; margin: 0.75rem 0; }
      .resumen div { display: flex; justify-content: space-between; }
      .resumen .general { border-top: 1px solid var(--fnz-borde); padding-top: 0.5rem; font-size: 0.95rem; }
      .errores { margin: 0.5rem 0 0; padding-left: 1.1rem; color: #c0392b; font-size: 0.82rem; }
      .pie { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem; }
      .campo { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.82rem; font-weight: 500; margin: 0.9rem 0; }
      .tabla-lineas { width: 100%; border-collapse: collapse; margin: 0.5rem 0; font-size: 0.85rem; }
      .tabla-lineas th, .tabla-lineas td { text-align: left; padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--fnz-borde); vertical-align: top; }
      .tabla-lineas .anulado { color: var(--fnz-tinta-suave); text-decoration: line-through; }
      .scroll-tabla { max-height: 14rem; overflow: auto; }
      .cabecera-detalle p { margin: 0.25rem 0; }
      .aviso-correccion { margin: 0; padding: 0.6rem 0.8rem; border-radius: 8px; background: #fff7e6; color: #7a4b00; font-size: 0.82rem; }
      .titulo-detalle { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
      .acciones p-button + p-button { margin-left: 0.4rem; }
    `,
  ],
})
export class PrestamosComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly catalogos = inject(CatalogoService);
  private readonly api = inject(PrestamoService);
  private readonly fb = inject(FormBuilder);
  private readonly mensajes = inject(MessageService);

  readonly opcionesEstado = [
    { label: 'Pendiente', value: 'PENDIENTE' },
    { label: 'Activo', value: 'ACTIVO' },
    { label: 'Pagado', value: 'PAGADO' },
    { label: 'Rechazado', value: 'RECHAZADO' },
  ];
  readonly opcionesTipo = [
    { label: 'Iglesia', value: 'IGLESIA' },
    { label: 'Ministro', value: 'MINISTRO' },
  ];

  readonly prestamos = signal<Prestamo[]>([]);
  readonly total = signal(0);
  readonly cargando = signal(false);
  readonly filtroEstado = signal<string | null>('PENDIENTE');
  readonly opcionesIglesia = signal<OpcionSelect[]>([]);
  readonly opcionesMinistro = signal<OpcionSelect[]>([]);

  readonly dialogoCaptura = signal(false);
  readonly guardando = signal(false);
  readonly errorForm = signal<string[]>([]);

  readonly dialogoDetalle = signal(false);
  readonly activo = signal<Prestamo | null>(null);

  readonly dialogoResolucion = signal(false);
  readonly accionResolucion = signal<'aprobar' | 'rechazar'>('aprobar');
  readonly resolviendo = signal(false);
  comentarioResolucion = '';

  private ultimoEvento: TableLazyLoadEvent = { first: 0, rows: 15 };

  readonly formPrestamo = this.fb.nonNullable.group({
    tipo: ['IGLESIA' as 'IGLESIA' | 'MINISTRO', Validators.required],
    deudor_id: [null as number | null, Validators.required],
    monto: [0, [Validators.required, Validators.min(0.01)]],
    plazo_meses: [12, [Validators.required, Validators.min(1), Validators.max(120)]],
    fecha_desembolso: [new Date(), Validators.required],
    fecha_primera_cuota: [new Date(), Validators.required],
    observaciones: [''],
    motivo: [''],
  });

  /** Préstamo que se edita (null en un alta) y el estado que tenía, para saber si es una corrección. */
  readonly editandoId = signal<number | null>(null);
  readonly estadoOriginal = signal<EstadoPrestamo | null>(null);
  /** True al editar un préstamo ya resuelto: pide motivo y lo reenvía a aprobación. */
  readonly esCorreccion = computed(() => this.estadoOriginal() !== null && this.estadoOriginal() !== 'PENDIENTE');

  /**
   * Espejo en señal de los valores del formulario: los `computed` no
   * reaccionan a `FormGroup.value`, así que se sincroniza vía `valueChanges`.
   */
  readonly vista = signal(this.formPrestamo.getRawValue());

  /** Vista previa de la tabla de pagos: cuotas iguales, con los centavos sobrantes en la última. */
  readonly cuotasPrevia = computed<CuotaPrevia[]>(() => {
    const v = this.vista();
    const n = Math.floor(v.plazo_meses ?? 0);
    const totalCentavos = Math.round((v.monto ?? 0) * 100);
    if (n < 1 || totalCentavos <= 0 || !v.fecha_primera_cuota) return [];

    const base = Math.floor(totalCentavos / n);
    const inicio = v.fecha_primera_cuota;
    return Array.from({ length: n }, (_, i) => ({
      numero: i + 1,
      fecha: this.sumarMeses(inicio, i),
      monto: (i === n - 1 ? totalCentavos - base * (n - 1) : base) / 100,
    }));
  });

  ngOnInit(): void {
    this.formPrestamo.valueChanges.subscribe(() => this.vista.set(this.formPrestamo.getRawValue()));
    // Al cambiar el tipo de deudor se limpia el deudor elegido.
    this.formPrestamo.controls.tipo.valueChanges.subscribe(() => this.formPrestamo.controls.deudor_id.setValue(null));

    this.catalogos.todos<Iglesia>('catalogos/eclesiastico/iglesias').subscribe((r) => {
      this.opcionesIglesia.set(r.data.map((i) => ({ label: `${i.nombre} (${i.clave})`, value: i.id })));
    });
    this.catalogos.todos<Ministro>('catalogos/eclesiastico/ministros').subscribe((r) => {
      this.opcionesMinistro.set(r.data.map((m) => ({ label: `${m.nombre} ${m.apellido}`, value: m.id })));
    });
  }

  /**
   * Suma meses a una fecha sin desbordar el día (31 ene + 1 mes = 28 feb),
   * partiendo siempre de la fecha original para no deslizar el día.
   * @param fecha fecha inicial. @param meses meses a sumar.
   */
  private sumarMeses(fecha: Date, meses: number): Date {
    const destino = new Date(fecha.getFullYear(), fecha.getMonth() + meses, 1);
    const ultimoDia = new Date(destino.getFullYear(), destino.getMonth() + 1, 0).getDate();
    destino.setDate(Math.min(fecha.getDate(), ultimoDia));
    return destino;
  }

  /** Nombre del deudor (iglesia o ministro) de un préstamo. @param p préstamo. */
  deudor(p: Prestamo): string {
    if (p.iglesia) return `${p.iglesia.nombre} (iglesia)`;
    if (p.ministro) return `${p.ministro.nombre} ${p.ministro.apellido} (ministro)`;
    return '—';
  }

  severidad(estado: EstadoPrestamo) {
    return SEVERIDAD_ESTADO[estado];
  }

  severidadCuota(estado: string) {
    return SEVERIDAD_CUOTA[estado];
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
          this.prestamos.set(r.data);
          this.total.set(r.meta.total);
          this.cargando.set(false);
        },
        error: () => this.cargando.set(false),
      });
  }

  recargar(): void {
    this.cargar({ ...this.ultimoEvento, first: 0 });
  }

  abrirCaptura(): void {
    this.errorForm.set([]);
    this.editandoId.set(null);
    this.estadoOriginal.set(null);
    this.ajustarMotivo(false);
    this.formPrestamo.reset({
      tipo: 'IGLESIA',
      deudor_id: null,
      monto: 0,
      plazo_meses: 12,
      fecha_desembolso: new Date(),
      fecha_primera_cuota: new Date(),
      observaciones: '',
      motivo: '',
    });
    this.dialogoCaptura.set(true);
  }

  /**
   * Abre el formulario con los datos de un préstamo para editarlo (si está pendiente)
   * o corregirlo (si ya estaba aprobado o rechazado).
   * @param p préstamo de la lista.
   */
  abrirEdicion(p: Prestamo): void {
    this.errorForm.set([]);
    this.editandoId.set(p.id);
    this.estadoOriginal.set(p.estado);
    this.ajustarMotivo(p.estado !== 'PENDIENTE');

    const tipo = p.iglesia_id ? 'IGLESIA' : 'MINISTRO';
    const deudor = p.iglesia_id ?? p.ministro_id;
    this.formPrestamo.reset({
      tipo,
      deudor_id: deudor,
      monto: Number(p.monto),
      plazo_meses: p.plazo_meses,
      fecha_desembolso: isoAFechaLocal(p.fecha_desembolso),
      fecha_primera_cuota: isoAFechaLocal(p.fecha_primera_cuota),
      observaciones: p.observaciones ?? '',
      motivo: '',
    });
    // Cambiar el tipo limpia el deudor (valueChanges): se vuelve a fijar.
    this.formPrestamo.controls.deudor_id.setValue(deudor);
    this.dialogoCaptura.set(true);
  }

  /** El motivo solo es obligatorio al corregir un préstamo ya resuelto. @param obligatorio si es una corrección. */
  private ajustarMotivo(obligatorio: boolean): void {
    const motivo = this.formPrestamo.controls.motivo;
    motivo.setValidators(obligatorio ? [Validators.required] : []);
    motivo.updateValueAndValidity();
  }

  guardarPrestamo(): void {
    if (this.formPrestamo.invalid) return;
    this.guardando.set(true);
    this.errorForm.set([]);

    const v = this.formPrestamo.getRawValue();
    const datos = {
      iglesia_id: v.tipo === 'IGLESIA' ? v.deudor_id : null,
      ministro_id: v.tipo === 'MINISTRO' ? v.deudor_id : null,
      monto: v.monto,
      plazo_meses: v.plazo_meses,
      fecha_desembolso: fechaLocalAIso(v.fecha_desembolso),
      fecha_primera_cuota: fechaLocalAIso(v.fecha_primera_cuota),
      observaciones: v.observaciones || undefined,
    };
    const id = this.editandoId();
    const correccion = this.esCorreccion();

    (id ? this.api.actualizar(id, datos, correccion ? v.motivo.trim() : undefined) : this.api.crear(datos))
      .subscribe({
        next: (r) => {
          this.guardando.set(false);
          this.dialogoCaptura.set(false);
          this.mensajes.add({
            severity: 'success',
            summary: correccion
              ? 'Corrección guardada: el préstamo quedó pendiente de aprobación'
              : id ? 'Préstamo actualizado' : `Préstamo ${r.data.codigo} creado, pendiente de aprobación`,
          });
          this.recargar();
        },
        error: (e: HttpErrorResponse) => {
          this.guardando.set(false);
          this.errorForm.set(this.mensajesDeError(e, 'No se pudo guardar el préstamo.'));
        },
      });
  }

  /**
   * Genera el "Comprobante de pago con cheque" (PDF) de un préstamo aprobado y
   * lo abre en una pestaña nueva.
   * @param p préstamo ACTIVO o PAGADO.
   */
  descargarComprobante(p: Prestamo): void {
    this.api.comprobante(p.id).subscribe({
      next: (pdf) => {
        const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => this.mensajes.add({ severity: 'error', summary: 'No se pudo generar el comprobante' }),
    });
  }

  /** Abre el detalle (cuotas, pagos) consultando el préstamo completo. @param p préstamo de la lista. */
  verDetalle(p: Prestamo): void {
    this.api.obtener(p.id).subscribe((r) => {
      this.activo.set(r.data);
      this.dialogoDetalle.set(true);
    });
  }

  abrirResolucion(p: Prestamo, accion: 'aprobar' | 'rechazar'): void {
    this.activo.set(p);
    this.accionResolucion.set(accion);
    this.comentarioResolucion = '';
    this.dialogoResolucion.set(true);
  }

  resolver(): void {
    const p = this.activo();
    if (!p) return;
    this.resolviendo.set(true);

    const peticion =
      this.accionResolucion() === 'aprobar'
        ? this.api.aprobar(p.id, this.comentarioResolucion || undefined)
        : this.api.rechazar(p.id, this.comentarioResolucion || undefined);

    peticion.subscribe({
      next: () => {
        this.resolviendo.set(false);
        this.dialogoResolucion.set(false);
        this.mensajes.add({
          severity: 'success',
          summary: this.accionResolucion() === 'aprobar' ? 'Préstamo aprobado' : 'Préstamo rechazado',
        });
        this.recargar();
      },
      error: (e: HttpErrorResponse) => {
        this.resolviendo.set(false);
        this.mensajes.add({ severity: 'error', summary: this.mensajesDeError(e, 'No se pudo resolver el préstamo.')[0] });
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
