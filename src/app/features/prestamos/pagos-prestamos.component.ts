import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, Subscription, debounceTime } from 'rxjs';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';

import { TienePermisoDirective } from '../../core/auth/tiene-permiso.directive';
import { fechaLocalAIso } from '../../core/ofrendas/fecha.util';
import { PrestamoService } from '../../core/prestamos/prestamo.service';
import { DocumentoAdjunto, EstadoPrestamo, Prestamo } from '../../core/models/prestamos.models';

/** Tamaño máximo por archivo (10 MB), igual que en el backend. */
const MAX_BYTES = 10 * 1024 * 1024;

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

/**
 * Pagos de préstamos: busca un préstamo por No. de préstamo, iglesia o
 * ministro, registra abonos/pagos (que se aplican a las cuotas más
 * antiguas) y permite anularlos con motivo. Los préstamos se capturan y
 * aprueban en la pantalla "Préstamos".
 */
@Component({
  selector: 'app-pagos-prestamos',
  imports: [
    DatePipe,
    DecimalPipe,
    NgTemplateOutlet,
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
        <h1 class="fnz-titulo-pagina">Pagos de préstamos</h1>
        <p class="fnz-subtitulo">Busque el préstamo y registre sus pagos o abonos.</p>
      </div>
    </header>

    <div class="filtros">
      <span class="busqueda">
        <i class="pi pi-search"></i>
        <input
          pInputText
          type="search"
          placeholder="Buscar por No. de préstamo, iglesia o ministro"
          [ngModel]="busqueda()"
          (ngModelChange)="buscar($event)"
        />
      </span>
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
          <th>No. préstamo</th>
          <th>Deudor</th>
          <th>Monto</th>
          <th>Pagado</th>
          <th>Saldo</th>
          <th>Estado</th>
          <th style="width: 7rem"></th>
        </tr>
      </ng-template>
      <ng-template #body let-p>
        <tr>
          <td>{{ p.codigo }}</td>
          <td>{{ deudor(p) }}</td>
          <td>Q {{ p.monto | number: '1.2-2' }}</td>
          <td>Q {{ p.total_pagado | number: '1.2-2' }}</td>
          <td>Q {{ p.saldo_pendiente | number: '1.2-2' }}</td>
          <td><p-tag [value]="p.estado" [severity]="severidad(p.estado)" /></td>
          <td class="acciones">
            @if (p.estado === 'ACTIVO') {
              <p-button
                *appTienePermiso="'pagos.pagar'"
                label="Pagar"
                icon="pi pi-dollar"
                size="small"
                (onClick)="abrirPago(p)"
              />
            }
            <p-button label="Historial" icon="pi pi-history" size="small" [outlined]="true" (onClick)="abrirHistorial(p)" />
          </td>
        </tr>
      </ng-template>
      <ng-template #emptymessage>
        <tr>
          <td colspan="7" class="vacio">Sin préstamos que coincidan con la búsqueda.</td>
        </tr>
      </ng-template>
    </p-table>

    <!-- Encabezado y resumen del préstamo, compartido por los diálogos de pago e historial -->
    <ng-template #resumenPrestamo let-p>
      <div class="cabecera-detalle">
        <div>
          <strong>{{ p.codigo }}</strong> — {{ deudor(p) }}
          <p-tag [value]="p.estado" [severity]="severidad(p.estado)" />
        </div>
        <p class="fnz-subtitulo">
          Desembolso {{ p.fecha_desembolso | date: 'dd/MM/yyyy' : 'UTC' }} · {{ p.plazo_meses }} cuotas mensuales
        </p>
      </div>

      <div class="resumen">
        <div><span>Monto del préstamo</span><strong>Q {{ p.monto | number: '1.2-2' }}</strong></div>
        <div><span>Total pagado</span><strong>Q {{ p.total_pagado | number: '1.2-2' }}</strong></div>
        <div class="general"><span>Saldo pendiente</span><strong>Q {{ p.saldo_pendiente | number: '1.2-2' }}</strong></div>
      </div>
    </ng-template>

    <!-- Diálogo "Registrar pago": solo el formulario del pago (con la boleta del depósito) -->
    <p-dialog header="Registrar pago" [(visible)]="dialogoPago" [modal]="true" [style]="{ width: '46rem', maxWidth: '96vw' }">
      @if (activo(); as p) {
        <ng-container *ngTemplateOutlet="resumenPrestamo; context: { $implicit: p }" />

        @if (p.estado === 'ACTIVO') {
          <ng-container *appTienePermiso="'pagos.pagar'">
            <form class="grid-pago" [formGroup]="formPago" (ngSubmit)="guardarPago()">
              <label>
                <span>Fecha</span>
                <p-datePicker formControlName="fecha_pago" dateFormat="dd/mm/yy" appendTo="body" fluid />
              </label>
              <label>
                <span>Monto (Q)</span>
                <p-inputNumber formControlName="monto" mode="currency" currency="GTQ" locale="es-GT" [minFractionDigits]="2" fluid />
              </label>
              <label>
                <span>No. boleta / referencia</span>
                <input pInputText formControlName="referencia" maxlength="60" />
              </label>
              <p-button label="Registrar" type="submit" [loading]="guardandoPago()" [disabled]="formPago.invalid || guardandoPago()" />
              <div class="archivo">
                <span class="etiqueta-archivo">Boleta del depósito (opcional · PDF, imagen, Word o Excel, máx. 10 MB)</span>
                <div class="selector-archivo">
                  <input #archivoInput type="file" hidden [accept]="extensionesPermitidas" (change)="elegirArchivo(archivoInput)" />
                  <p-button
                    type="button"
                    label="Seleccionar archivo"
                    icon="pi pi-upload"
                    severity="secondary"
                    [outlined]="true"
                    (onClick)="archivoInput.click()"
                  />
                  @if (nombreArchivo()) {
                    <span class="nombre-archivo"><i class="pi pi-paperclip"></i> {{ nombreArchivo() }}</span>
                    <p-button
                      type="button"
                      icon="pi pi-times"
                      severity="secondary"
                      [text]="true"
                      [rounded]="true"
                      size="small"
                      (onClick)="quitarArchivo(archivoInput)"
                    />
                  } @else {
                    <span class="nombre-archivo vacio-archivo">Ningún archivo seleccionado</span>
                  }
                </div>
              </div>
            </form>
            @if (errorPago().length) {
              <ul class="errores">
                @for (e of errorPago(); track e) { <li>{{ e }}</li> }
              </ul>
            }
          </ng-container>
        }
      }
    </p-dialog>

    <!-- Diálogo "Historial": tabla de pagos (cuotas) e historial de pagos del préstamo -->
    <p-dialog header="Historial del préstamo" [(visible)]="dialogoHistorial" [modal]="true" [style]="{ width: '56rem', maxWidth: '96vw' }">
      @if (activo(); as p) {
        <ng-container *ngTemplateOutlet="resumenPrestamo; context: { $implicit: p }" />

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
            <thead><tr><th>Fecha</th><th>Monto</th><th>Referencia</th><th>Se aplicó a</th><th>Estado</th><th>Boleta del depósito</th><th></th></tr></thead>
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
                  <td>
                    @for (d of g.documentos; track d.id) {
                      <a class="enlace-doc" (click)="verDocumento(d)"><i class="pi pi-paperclip"></i> {{ d.nombre_original }}</a>
                    } @empty {
                      @if (g.estado === 'APLICADO') {
                        <label *appTienePermiso="'pagos.pagar'" class="adjuntar">
                          <i class="pi pi-upload"></i> Adjuntar
                          <input #adjunto type="file" hidden [accept]="extensionesPermitidas" (change)="adjuntarAPago(g.id, adjunto)" />
                        </label>
                      } @else {
                        —
                      }
                    }
                  </td>
                  <td>
                    @if (g.estado === 'APLICADO') {
                      <p-button
                        *appTienePermiso="'pagos.anular'"
                        icon="pi pi-ban"
                        severity="danger"
                        [rounded]="true"
                        [text]="true"
                        size="small"
                        (onClick)="abrirAnulacion(g.id)"
                      />
                    }
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

    <!-- Diálogo de anulación de pago -->
    <p-dialog header="Anular pago" [(visible)]="dialogoAnulacion" [modal]="true" [style]="{ width: '28rem' }">
      <label class="campo">
        <span>Motivo (obligatorio)</span>
        <input pInputText [(ngModel)]="motivoAnulacion" maxlength="255" fluid />
      </label>
      @if (errorPago().length) {
        <ul class="errores">
          @for (e of errorPago(); track e) { <li>{{ e }}</li> }
        </ul>
      }
      <div class="pie">
        <p-button label="Cancelar" severity="secondary" [text]="true" (onClick)="dialogoAnulacion.set(false)" />
        <p-button label="Anular pago" severity="danger" [loading]="guardandoPago()" [disabled]="!motivoAnulacion.trim()" (onClick)="anularPago()" />
      </div>
    </p-dialog>
  `,
  styles: [
    `
      .filtros { display: flex; gap: 0.75rem; margin-bottom: 0.75rem; flex-wrap: wrap; }
      .busqueda { position: relative; flex: 1; min-width: 16rem; max-width: 30rem; display: flex; align-items: center; }
      .busqueda i { position: absolute; left: 0.75rem; color: var(--fnz-tinta-suave); }
      .busqueda input { width: 100%; padding-left: 2.25rem; }
      .acciones { white-space: nowrap; text-align: right; }
      .vacio { text-align: center; padding: 2rem; color: var(--fnz-tinta-suave); }
      .grid-pago { display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 0.75rem; align-items: end; }
      .grid-pago .archivo { grid-column: 1 / -1; display: flex; flex-direction: column; gap: 0.4rem; }
      .etiqueta-archivo { font-size: 0.82rem; font-weight: 500; }
      .selector-archivo { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
      .nombre-archivo { font-size: 0.82rem; overflow: hidden; text-overflow: ellipsis; max-width: 22rem; white-space: nowrap; }
      .vacio-archivo { color: var(--fnz-tinta-suave); }
      .enlace-doc, .adjuntar { cursor: pointer; color: var(--p-primary-color, #1d4ed8); font-size: 0.8rem; display: block; }
      .adjuntar { display: inline-flex; flex-direction: row; gap: 0.3rem; align-items: center; font-weight: 400; }
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
      .cabecera-detalle p { margin: 0.25rem 0; }
    `,
  ],
})
export class PagosPrestamosComponent implements OnInit, OnDestroy {
  private readonly api = inject(PrestamoService);
  private readonly fb = inject(FormBuilder);
  private readonly mensajes = inject(MessageService);

  readonly opcionesEstado = [
    { label: 'Activo', value: 'ACTIVO' },
    { label: 'Pagado', value: 'PAGADO' },
    { label: 'Pendiente de aprobación', value: 'PENDIENTE' },
    { label: 'Rechazado', value: 'RECHAZADO' },
  ];

  readonly prestamos = signal<Prestamo[]>([]);
  readonly total = signal(0);
  readonly cargando = signal(false);
  readonly busqueda = signal('');
  readonly filtroEstado = signal<string | null>('ACTIVO');

  readonly dialogoPago = signal(false);
  readonly dialogoHistorial = signal(false);
  readonly activo = signal<Prestamo | null>(null);
  readonly guardandoPago = signal(false);
  readonly errorPago = signal<string[]>([]);

  readonly dialogoAnulacion = signal(false);
  motivoAnulacion = '';
  private pagoAAnular: number | null = null;

  private ultimoEvento: TableLazyLoadEvent = { first: 0, rows: 15 };
  private readonly escritura$ = new Subject<void>();
  private suscripcion?: Subscription;

  /** Extensiones aceptadas por el selector de archivos (igual que el backend). */
  readonly extensionesPermitidas = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx';
  private archivoDeposito: File | null = null;
  /** Nombre del archivo elegido, para mostrarlo junto al botón. */
  readonly nombreArchivo = signal('');

  readonly formPago = this.fb.nonNullable.group({
    fecha_pago: [new Date(), Validators.required],
    monto: [0, [Validators.required, Validators.min(0.01)]],
    referencia: [''],
  });

  ngOnInit(): void {
    // Espera 300 ms tras la última tecla antes de consultar, para no saturar la API.
    this.suscripcion = this.escritura$.pipe(debounceTime(300)).subscribe(() => this.recargar());
  }

  ngOnDestroy(): void {
    this.suscripcion?.unsubscribe();
  }

  /** Actualiza el texto de búsqueda y dispara la consulta con retardo. @param texto lo escrito por el usuario. */
  buscar(texto: string): void {
    this.busqueda.set(texto);
    this.escritura$.next();
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

  /** Carga la página de préstamos aplicando la búsqueda y el estado. @param evento paginación de la tabla. */
  cargar(evento: TableLazyLoadEvent): void {
    this.ultimoEvento = evento;
    this.cargando.set(true);
    this.api
      .listar({
        q: this.busqueda().trim() || undefined,
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

  /** Abre el diálogo para registrar un pago de un préstamo activo. @param p préstamo de la lista. */
  abrirPago(p: Prestamo): void {
    this.errorPago.set([]);
    this.formPago.reset({ fecha_pago: new Date(), monto: 0, referencia: '' });
    this.archivoDeposito = null;
    this.nombreArchivo.set('');
    this.api.obtener(p.id).subscribe((r) => {
      this.activo.set(r.data);
      this.dialogoPago.set(true);
    });
  }

  /** Abre el historial del préstamo: tabla de pagos (cuotas) y pagos registrados. @param p préstamo de la lista. */
  abrirHistorial(p: Prestamo): void {
    this.errorPago.set([]);
    this.api.obtener(p.id).subscribe((r) => {
      this.activo.set(r.data);
      this.dialogoHistorial.set(true);
    });
  }

  /**
   * Toma el archivo elegido para el depósito, validando su tamaño.
   * @param input control de archivo del formulario de pago.
   */
  elegirArchivo(input: HTMLInputElement): void {
    const archivo = input.files?.[0] ?? null;
    if (archivo && archivo.size > MAX_BYTES) {
      this.errorPago.set(['El archivo supera el límite de 10 MB.']);
      input.value = '';
      this.archivoDeposito = null;
      this.nombreArchivo.set('');
      return;
    }
    this.errorPago.set([]);
    this.archivoDeposito = archivo;
    this.nombreArchivo.set(archivo?.name ?? '');
  }

  /**
   * Quita el archivo elegido para el depósito.
   * @param input control de archivo del formulario de pago.
   */
  quitarArchivo(input: HTMLInputElement): void {
    input.value = '';
    this.archivoDeposito = null;
    this.nombreArchivo.set('');
  }

  /**
   * Adjunta la boleta del depósito a un pago ya registrado.
   * @param pagoId pago al que se adjunta.
   * @param input  control de archivo elegido.
   */
  adjuntarAPago(pagoId: number, input: HTMLInputElement): void {
    const p = this.activo();
    const archivo = input.files?.[0];
    if (!p || !archivo) return;
    if (archivo.size > MAX_BYTES) {
      this.mensajes.add({ severity: 'error', summary: 'El archivo supera el límite de 10 MB' });
      input.value = '';
      return;
    }
    this.api.adjuntarDocumento(p.id, pagoId, archivo).subscribe({
      next: () => {
        this.mensajes.add({ severity: 'success', summary: 'Boleta adjuntada' });
        this.refrescarActivo();
      },
      error: (e: HttpErrorResponse) =>
        this.mensajes.add({ severity: 'error', summary: this.mensajesDeError(e, 'No se pudo adjuntar el archivo.')[0] }),
    });
  }

  /** Descarga y abre en una pestaña el documento adjunto. @param doc documento a ver. */
  verDocumento(doc: DocumentoAdjunto): void {
    this.api.descargarDocumento(doc.id).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    });
  }

  /** Registra el pago del formulario y refresca el préstamo y la lista. */
  guardarPago(): void {
    const p = this.activo();
    if (!p || this.formPago.invalid) return;
    this.guardandoPago.set(true);
    this.errorPago.set([]);

    const v = this.formPago.getRawValue();
    this.api
      .registrarPago(p.id, { fecha_pago: fechaLocalAIso(v.fecha_pago), monto: v.monto, referencia: v.referencia || undefined, archivo: this.archivoDeposito })
      .subscribe({
        next: () => {
          this.guardandoPago.set(false);
          this.formPago.reset({ fecha_pago: new Date(), monto: 0, referencia: '' });
          this.archivoDeposito = null;
          this.nombreArchivo.set('');
          this.dialogoPago.set(false);
          this.mensajes.add({ severity: 'success', summary: 'Pago registrado' });
          this.refrescarActivo();
        },
        error: (e: HttpErrorResponse) => {
          this.guardandoPago.set(false);
          this.errorPago.set(this.mensajesDeError(e, 'No se pudo registrar el pago.'));
        },
      });
  }

  /** Abre el diálogo para pedir el motivo de anulación. @param pagoId pago a anular. */
  abrirAnulacion(pagoId: number): void {
    this.pagoAAnular = pagoId;
    this.motivoAnulacion = '';
    this.errorPago.set([]);
    this.dialogoAnulacion.set(true);
  }

  /** Anula el pago elegido con el motivo digitado y refresca el préstamo. */
  anularPago(): void {
    const p = this.activo();
    if (!p || this.pagoAAnular === null || !this.motivoAnulacion.trim()) return;
    this.guardandoPago.set(true);

    this.api.anularPago(p.id, this.pagoAAnular, this.motivoAnulacion.trim()).subscribe({
      next: () => {
        this.guardandoPago.set(false);
        this.dialogoAnulacion.set(false);
        this.mensajes.add({ severity: 'success', summary: 'Pago anulado' });
        this.refrescarActivo();
      },
      error: (e: HttpErrorResponse) => {
        this.guardandoPago.set(false);
        this.errorPago.set(this.mensajesDeError(e, 'No se pudo anular el pago.'));
      },
    });
  }

  /** Vuelve a consultar el préstamo abierto y recarga la lista. */
  private refrescarActivo(): void {
    const p = this.activo();
    if (!p) return;
    this.api.obtener(p.id).subscribe((r) => this.activo.set(r.data));
    this.recargar();
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
