import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';

import { AuthService } from '../../../core/auth/auth.service';
import { TienePermisoDirective } from '../../../core/auth/tiene-permiso.directive';
import { CatalogoService } from '../../../core/ofrendas/catalogo.service';
import { InformeFinancieroService } from '../../../core/ofrendas/informe-financiero.service';
import { fechaLocalAIso } from '../../../core/ofrendas/fecha.util';
import {
  ConceptoMovimiento,
  Iglesia,
  InformeFinanciero,
  InformeFinancieroLinea,
  LineaInformeNueva,
  Ministro,
  OpcionSelect,
} from '../../../core/models/ofrendas.models';

const MESES: OpcionSelect[] = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
].map((label, i) => ({ label, value: i + 1 }));

const SEVERIDAD_ESTADO: Record<InformeFinanciero['estado'], 'warn' | 'success' | 'danger'> = {
  PENDIENTE: 'warn',
  APROBADO: 'success',
  RECHAZADO: 'danger',
};

/** Porcentaje del diezmo mostrado en pantalla; el backend calcula el valor definitivo con el parámetro del sistema. */
const PORCENTAJE_DIEZMO = 10;

/** Un renglón numerado del formulario, enlazado a un concepto del catálogo por su código. */
interface Renglon {
  numero: number;
  codigo: string;
  etiqueta: string;
}

/** Datos de boleta física capturados a mano para un renglón de colecta. */
interface DatosBoleta {
  numero: string;
  fecha: Date | null;
  archivo: File | null;
}

/** Ingresos por ofrenda (columna izquierda del formulario original). */
const INGRESOS: Renglon[] = [
  { numero: 1, codigo: 'ING-DIEZMO', etiqueta: 'Ofrenda Diezmos' },
  { numero: 2, codigo: 'ING-PERSONAL', etiqueta: 'Ofrenda Personal' },
  { numero: 3, codigo: 'ING-ORDINARIA', etiqueta: 'Ofrenda Ordinaria' },
  { numero: 4, codigo: 'ING-PRIMICIAS', etiqueta: 'Ofrenda Primicias' },
];

/** Colectas y ofrendas especiales, en el orden del formulario original. */
const COLECTAS: Renglon[] = [
  { numero: 1, codigo: 'COL-MANTENIMIENTO', etiqueta: 'Ofrenda Mantenimiento y Conservación' },
  { numero: 2, codigo: 'COL-SERVICIOS', etiqueta: 'Ofrenda Pago de Servicios Públicos' },
  { numero: 3, codigo: 'COL-CONSTRUCCION', etiqueta: 'Ofrenda Construcción Local' },
  { numero: 4, codigo: 'COL-INMUEBLES', etiqueta: 'Ofrenda Adquisición de Inmuebles' },
  { numero: 5, codigo: 'COL-MUEBLES', etiqueta: 'Ofrenda Adquisición de Muebles y Artículos de Inventario' },
  { numero: 6, codigo: 'COL-EVANGELIZACION', etiqueta: 'Ofrenda Gastos Evangelización Local' },
  { numero: 7, codigo: 'COL-14FEB', etiqueta: 'Ofrenda Colecta 14 de Febrero' },
  { numero: 8, codigo: 'COL-CENTRORECREATIVO', etiqueta: 'Ofrenda Colecta Mantenimiento Centro Recreativo Dr. NJG' },
  { numero: 9, codigo: 'COL-SANTACENA', etiqueta: 'Ofrenda Colecta Santa Cena' },
  { numero: 10, codigo: 'COL-TERRENONAL', etiqueta: 'Ofrenda Colecta Terreno Nacional en Guatemala' },
  { numero: 11, codigo: 'COL-GUADALAJARA', etiqueta: 'Ofrenda Viajes a Guadalajara, México' },
  { numero: 12, codigo: 'ESP-MAYO', etiqueta: 'Ofrenda Especial 07 de Mayo' },
  { numero: 13, codigo: 'ESP-SEPTIEMBRE', etiqueta: 'Ofrenda Especial 15 de Septiembre' },
  { numero: 14, codigo: 'COL-OTRAS', etiqueta: 'Otras Ofrendas Colectas' },
];

/**
 * Informe Financiero Mensual. Replica el formulario original:
 *  - Ingresos por ofrenda (1-4) con su total.
 *  - Egresos de ofrenda: 1 Diezmo (10 % de los ingresos, automático),
 *    2 Familiar, 3 Remanente (automático = ingresos − 1 − 2 − 4 − 5),
 *    4 Obreros, 5 Otras; el total de egresos siempre iguala al de ingresos.
 *  - Ingresos y egresos por colectas (1-14), donde las que traen boleta
 *    física piden No. de boleta, fecha y archivo escaneado.
 *  - Total general = ingresos por ofrenda + colectas.
 * El diezmo y el remanente también los recalcula el backend.
 */
@Component({
  selector: 'app-informes',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    DecimalPipe,
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
        <h1 class="fnz-titulo-pagina">Informes financieros mensuales</h1>
        <p class="fnz-subtitulo">Ingresos de ofrenda, distribución y colectas por iglesia y mes.</p>
      </div>
      <p-button
        *appTienePermiso="'informes.crear'"
        label="Nuevo informe"
        icon="pi pi-plus"
        (onClick)="abrirCaptura()"
      />
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
      [value]="informes()"
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
          <th>Iglesia</th>
          <th>Periodo</th>
          <th>Ingresos ofrenda</th>
          <th>Colectas</th>
          <th>Total general</th>
          <th>Cuadre</th>
          <th>Estado</th>
          <th style="width: 9rem"></th>
        </tr>
      </ng-template>
      <ng-template #body let-i>
        <tr>
          <td>{{ i.iglesia?.nombre }}</td>
          <td>{{ periodo(i) }}</td>
          <td>Q {{ i.total_ingresos_ofrenda }}</td>
          <td>Q {{ i.total_colectas }}</td>
          <td>Q {{ i.total_general }}</td>
          <td>
            <p-tag [value]="i.cuadra ? 'Cuadra' : 'No cuadra'" [severity]="i.cuadra ? 'success' : 'danger'" />
          </td>
          <td><p-tag [value]="i.estado" [severity]="severidad(i.estado)" /></td>
          <td class="acciones">
            <p-button icon="pi pi-eye" [rounded]="true" [text]="true" size="small" (onClick)="verDetalle(i)" />
            @if (i.estado === 'PENDIENTE') {
              <p-button
                *appTienePermiso="'informes.aprobar'"
                icon="pi pi-check"
                severity="success"
                [rounded]="true"
                [text]="true"
                size="small"
                [disabled]="i.creado_por === auth.usuario()?.id"
                (onClick)="abrirResolucion(i, 'aprobar')"
              />
              <p-button
                *appTienePermiso="'informes.aprobar'"
                icon="pi pi-times"
                severity="danger"
                [rounded]="true"
                [text]="true"
                size="small"
                [disabled]="i.creado_por === auth.usuario()?.id"
                (onClick)="abrirResolucion(i, 'rechazar')"
              />
            }
          </td>
        </tr>
      </ng-template>
      <ng-template #emptymessage>
        <tr>
          <td colspan="8" class="vacio">Sin informes que coincidan con el filtro.</td>
        </tr>
      </ng-template>
    </p-table>

    <!-- Diálogo de captura -->
    <p-dialog
      header="Nuevo informe financiero mensual"
      [(visible)]="dialogoCaptura"
      [modal]="true"
      [style]="{ width: '62rem', maxWidth: '96vw' }"
    >
      <form class="formulario" [formGroup]="formCabecera" (ngSubmit)="guardarInforme()">
        <div class="grid3">
          <label>
            <span>Iglesia</span>
            <p-select
              formControlName="iglesia_id"
              [options]="opcionesIglesia()"
              optionLabel="label"
              optionValue="value"
              [filter]="true"
              fluid
            />
          </label>
          <label>
            <span>Ministro</span>
            <p-select
              formControlName="ministro_id"
              [options]="opcionesMinistro()"
              optionLabel="label"
              optionValue="value"
              [filter]="true"
              [showClear]="true"
              placeholder="Sin especificar"
              fluid
            />
          </label>
        </div>
        <div class="grid3">
          <label>
            <span>Fecha inicio</span>
            <p-datePicker formControlName="fecha_inicio" dateFormat="dd/mm/yy" fluid />
          </label>
          <label>
            <span>Fecha fin <small>(también es la fecha de los renglones sin boleta)</small></span>
            <p-datePicker formControlName="fecha_fin" dateFormat="dd/mm/yy" [minDate]="formCabecera.controls.fecha_inicio.value" fluid />
          </label>
        </div>

        <!-- Parte 1: ingresos y egresos de ofrenda -->
        <div class="bloque">
          <div class="dos-columnas">
            <section>
              <h3 class="titulo-bloque">Ingresos por ofrenda</h3>
              @for (r of ingresos; track r.codigo) {
                <div class="fila-concepto">
                  <span class="nombre-concepto">{{ r.numero }}. {{ r.etiqueta }}</span>
                  <p-inputNumber
                    [ngModel]="monto(r.codigo)"
                    (ngModelChange)="setMonto(r.codigo, $event)"
                    [ngModelOptions]="{ standalone: true }"
                    mode="currency"
                    currency="GTQ"
                    locale="es-GT"
                    [minFractionDigits]="2"
                    placeholder="Q 0.00"
                  />
                </div>
              }
              <div class="total-linea">
                <span>Total de ingresos por ofrendas</span>
                <span class="chip">{{ porcentajeDiezmo }}%</span>
                <strong>Q {{ totalIngresos() | number: '1.2-2' }}</strong>
              </div>
            </section>

            <section>
              <h3 class="titulo-bloque">Egresos de ofrenda</h3>
              <div class="fila-concepto">
                <span class="nombre-concepto">1. Ofrenda Diezmos <small>({{ porcentajeDiezmo }}% de los ingresos)</small></span>
                <span class="calculado">Q {{ diezmo() | number: '1.2-2' }}</span>
              </div>
              <div class="fila-concepto">
                <span class="nombre-concepto">2. Ofrenda Familiar</span>
                <p-inputNumber
                  [ngModel]="monto('EGR-FAMILIAR')"
                  (ngModelChange)="setMonto('EGR-FAMILIAR', $event)"
                  [ngModelOptions]="{ standalone: true }"
                  mode="currency"
                  currency="GTQ"
                  locale="es-GT"
                  [minFractionDigits]="2"
                  placeholder="Q 0.00"
                />
              </div>
              <div class="fila-concepto">
                <span class="nombre-concepto">3. Remanente <small>(remesar al Ministerio)</small></span>
                <span class="calculado" [class.negativo]="remanente() < 0">Q {{ remanente() | number: '1.2-2' }}</span>
              </div>
              <div class="fila-concepto">
                <span class="nombre-concepto">4. Ofrenda a Obreros <small>(tomado del remanente)</small></span>
                <p-inputNumber
                  [ngModel]="monto('EGR-OBREROS')"
                  (ngModelChange)="setMonto('EGR-OBREROS', $event)"
                  [ngModelOptions]="{ standalone: true }"
                  mode="currency"
                  currency="GTQ"
                  locale="es-GT"
                  [minFractionDigits]="2"
                  placeholder="Q 0.00"
                />
              </div>
              <div class="fila-concepto">
                <span class="nombre-concepto">5. Otras Ofrendas</span>
                <p-inputNumber
                  [ngModel]="monto('EGR-OTRAS')"
                  (ngModelChange)="setMonto('EGR-OTRAS', $event)"
                  [ngModelOptions]="{ standalone: true }"
                  mode="currency"
                  currency="GTQ"
                  locale="es-GT"
                  [minFractionDigits]="2"
                  placeholder="Q 0.00"
                />
              </div>
              <div class="total-linea">
                <span>Total de egresos por ofrendas</span>
                <strong>Q {{ totalEgresos() | number: '1.2-2' }}</strong>
              </div>
            </section>
          </div>
          @if (remanente() < 0) {
            <p class="aviso-error">Ofrenda familiar, a obreros y otras superan el remanente disponible (ingresos menos diezmo).</p>
          }
        </div>

        <!-- Parte 2: colectas -->
        <div class="bloque">
          <h3 class="titulo-bloque">Ingresos y egresos de ofrenda por colectas</h3>
          @for (r of colectas; track r.codigo) {
            <div class="renglon-colecta">
              <div class="fila-concepto">
                <span class="nombre-concepto">{{ r.numero }}. {{ r.etiqueta }}</span>
                <p-inputNumber
                  [ngModel]="monto(r.codigo)"
                  (ngModelChange)="setMonto(r.codigo, $event)"
                  [ngModelOptions]="{ standalone: true }"
                  mode="currency"
                  currency="GTQ"
                  locale="es-GT"
                  [minFractionDigits]="2"
                  placeholder="Q 0.00"
                />
              </div>
              @if (requiereBoleta(r.codigo)) {
                <div class="datos-boleta">
                  <input
                    pInputText
                    class="campo-boleta"
                    placeholder="No. de boleta"
                    [ngModel]="datosBoleta(r.codigo).numero"
                    (ngModelChange)="setBoleta(r.codigo, 'numero', $event)"
                    [ngModelOptions]="{ standalone: true }"
                  />
                  <p-datePicker
                    placeholder="Fecha"
                    dateFormat="dd/mm/yy"
                    [ngModel]="datosBoleta(r.codigo).fecha"
                    (ngModelChange)="setBoleta(r.codigo, 'fecha', $event)"
                    [ngModelOptions]="{ standalone: true }"
                    [style]="{ width: '9rem' }"
                  />
                  <label class="subir">
                    <i class="pi pi-upload"></i>
                    <span>{{ datosBoleta(r.codigo).archivo?.name ?? 'Cargar boleta (PDF/imagen)' }}</span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      (change)="elegirArchivo(r.codigo, $event)"
                      hidden
                    />
                  </label>
                </div>
              }
            </div>
          }
          <div class="total-linea">
            <span>Total de ingresos y egresos de ofrendas por colectas</span>
            <strong>Q {{ totalColectas() | number: '1.2-2' }}</strong>
          </div>
        </div>

        <div class="total-general">
          <span>TOTAL GENERAL <small>(Total de ingresos por ofrendas más total por colectas)</small></span>
          <strong>Q {{ totalGeneral() | number: '1.2-2' }}</strong>
        </div>

        @if (errorForm().length) {
          <ul class="errores">
            @for (e of errorForm(); track e) { <li>{{ e }}</li> }
          </ul>
        }

        <div class="pie">
          <p-button label="Cancelar" severity="secondary" [text]="true" type="button" (onClick)="dialogoCaptura.set(false)" />
          <p-button
            label="Guardar informe"
            type="submit"
            [loading]="guardando()"
            [disabled]="formCabecera.invalid || guardando() || totalGeneral() === 0 || remanente() < 0"
          />
        </div>
      </form>
    </p-dialog>

    <!-- Diálogo de detalle -->
    <p-dialog header="Detalle del informe" [(visible)]="dialogoDetalle" [modal]="true" [style]="{ width: '46rem', maxWidth: '96vw' }">
      @if (informeActivo(); as i) {
        <p class="fnz-subtitulo">{{ i.iglesia?.nombre }} — {{ periodo(i) }}@if (i.ministro) { — {{ i.ministro.nombre }} {{ i.ministro.apellido }} }</p>
        <table class="tabla-lineas">
          <thead>
            <tr>
              <th>Concepto</th>
              <th>Monto</th>
              <th>Boleta / fecha</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (l of i.lineas; track l.id) {
              <tr>
                <td>{{ l.concepto?.nombre }}</td>
                <td>Q {{ l.monto }}</td>
                <td>{{ referenciaBoleta(l) }}</td>
                <td>
                  @if (l.tiene_archivo_boleta) {
                    <p-button icon="pi pi-file" label="Ver boleta" size="small" [text]="true" (onClick)="verArchivo(i.id, l)" />
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
        <p class="fnz-subtitulo">
          Capturado por {{ i.creador?.nombre }}
          @if (i.aprobador) { · Resuelto por {{ i.aprobador.nombre }} }
        </p>
        @if (i.comentario_resolucion) {
          <p><strong>Comentario:</strong> {{ i.comentario_resolucion }}</p>
        }
      }
    </p-dialog>

    <!-- Diálogo de aprobar/rechazar -->
    <p-dialog
      [header]="accionResolucion() === 'aprobar' ? 'Aprobar informe' : 'Rechazar informe'"
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
      .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.9rem; }
      label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.82rem; font-weight: 500; }
      .bloque { border: 1px solid var(--fnz-borde); border-radius: 8px; padding: 0.9rem 1rem; }
      .dos-columnas { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
      .titulo-bloque { margin: 0 0 0.6rem; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
      .fila-concepto { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 0.25rem 0; }
      .nombre-concepto { font-size: 0.85rem; }
      .nombre-concepto small { color: var(--fnz-tinta-suave); }
      .calculado { font-weight: 600; font-size: 0.9rem; min-width: 8rem; text-align: right; padding-right: 0.75rem; }
      .calculado.negativo { color: #c0392b; }
      .total-linea {
        display: flex; justify-content: space-between; align-items: center; gap: 0.75rem;
        border-top: 1px solid var(--fnz-borde); margin-top: 0.5rem; padding-top: 0.5rem; font-size: 0.85rem;
      }
      .total-linea strong { min-width: 8rem; text-align: right; padding-right: 0.75rem; }
      .chip { background: var(--fnz-fondo); border-radius: 999px; padding: 0.1rem 0.5rem; font-size: 0.75rem; }
      .renglon-colecta { padding-bottom: 0.2rem; }
      .datos-boleta { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; padding: 0.1rem 0 0.5rem 1.2rem; }
      .campo-boleta { width: 10rem; }
      .subir {
        flex-direction: row; align-items: center; gap: 0.4rem; cursor: pointer; font-weight: 400;
        border: 1px dashed var(--fnz-borde); border-radius: 6px; padding: 0.4rem 0.7rem;
      }
      .total-general {
        display: flex; justify-content: space-between; align-items: center;
        background: var(--fnz-fondo); border-radius: 8px; padding: 0.8rem 1rem; font-size: 0.95rem;
      }
      .total-general small { font-weight: 400; color: var(--fnz-tinta-suave); }
      .total-general strong { font-size: 1.05rem; padding-right: 0.75rem; }
      .aviso-error { margin: 0; color: #c0392b; font-size: 0.82rem; }
      .errores { margin: 0; padding-left: 1.1rem; color: #c0392b; font-size: 0.82rem; }
      .pie { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem; }
      .campo { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.82rem; font-weight: 500; margin: 0.9rem 0; }
      .tabla-lineas { width: 100%; border-collapse: collapse; margin: 0.75rem 0; font-size: 0.85rem; }
      .tabla-lineas th, .tabla-lineas td { text-align: left; padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--fnz-borde); }
      @media (max-width: 900px) { .dos-columnas { grid-template-columns: 1fr; } }
    `,
  ],
})
export class InformesComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly catalogos = inject(CatalogoService);
  private readonly api = inject(InformeFinancieroService);
  private readonly fb = inject(FormBuilder);
  private readonly mensajes = inject(MessageService);

  readonly opcionesMes = MESES;
  readonly opcionesEstado = [
    { label: 'Pendiente', value: 'PENDIENTE' },
    { label: 'Aprobado', value: 'APROBADO' },
    { label: 'Rechazado', value: 'RECHAZADO' },
  ];
  readonly ingresos = INGRESOS;
  readonly colectas = COLECTAS;
  readonly porcentajeDiezmo = PORCENTAJE_DIEZMO;

  readonly informes = signal<InformeFinanciero[]>([]);
  readonly total = signal(0);
  readonly cargando = signal(false);
  readonly filtroEstado = signal<string | null>('PENDIENTE');
  readonly opcionesIglesia = signal<OpcionSelect[]>([]);
  readonly conceptosPorCodigo = signal<Record<string, ConceptoMovimiento>>({});

  /** Montos digitados, por código de concepto. */
  readonly montos = signal<Record<string, number | null>>({});
  /** Boleta física (No., fecha, archivo) por código de concepto de colecta. */
  readonly boletas = signal<Record<string, DatosBoleta>>({});

  readonly dialogoCaptura = signal(false);
  readonly guardando = signal(false);
  readonly errorForm = signal<string[]>([]);

  readonly dialogoDetalle = signal(false);
  readonly informeActivo = signal<InformeFinanciero | null>(null);

  readonly dialogoResolucion = signal(false);
  readonly accionResolucion = signal<'aprobar' | 'rechazar'>('aprobar');
  readonly resolviendo = signal(false);
  comentarioResolucion = '';

  private ultimoEvento: TableLazyLoadEvent = { first: 0, rows: 15 };

  readonly formCabecera = this.fb.nonNullable.group({
    iglesia_id: [null as number | null, Validators.required],
    ministro_id: [null as number | null],
    fecha_inicio: [new Date(), Validators.required],
    fecha_fin: [new Date(), Validators.required],
  });
  readonly opcionesMinistro = signal<OpcionSelect[]>([]);

  readonly totalIngresos = computed(() => this.suma(INGRESOS.map((r) => r.codigo)));
  readonly diezmo = computed(() => Math.round(this.totalIngresos() * PORCENTAJE_DIEZMO) / 100);
  readonly remanente = computed(() => {
    if (this.totalIngresos() <= 0) return 0;
    const descuentos = this.suma(['EGR-FAMILIAR', 'EGR-OBREROS', 'EGR-OTRAS']);
    return Math.round((this.totalIngresos() - this.diezmo() - descuentos) * 100) / 100;
  });
  readonly totalEgresos = computed(
    () => this.diezmo() + this.suma(['EGR-FAMILIAR', 'EGR-OBREROS', 'EGR-OTRAS']) + Math.max(this.remanente(), 0),
  );
  readonly totalColectas = computed(() => this.suma(COLECTAS.map((r) => r.codigo)));
  readonly totalGeneral = computed(() => this.totalIngresos() + this.totalColectas());

  ngOnInit(): void {
    this.catalogos.todos<Iglesia>('catalogos/eclesiastico/iglesias').subscribe((r) => {
      this.opcionesIglesia.set(r.data.map((i) => ({ label: `${i.nombre} (${i.clave})`, value: i.id })));
    });
    this.catalogos.todos<Ministro>('catalogos/eclesiastico/ministros').subscribe((r) => {
      this.opcionesMinistro.set(r.data.map((m) => ({ label: `${m.nombre} ${m.apellido}`, value: m.id })));
    });
    this.catalogos.todos<ConceptoMovimiento>('catalogos/financiero/conceptos-movimiento').subscribe((r) => {
      this.conceptosPorCodigo.set(Object.fromEntries(r.data.map((c) => [c.codigo, c])));
    });
  }

  private suma(codigos: string[]): number {
    return codigos.reduce((acc, c) => acc + (this.montos()[c] ?? 0), 0);
  }

  monto(codigo: string): number | null {
    return this.montos()[codigo] ?? null;
  }

  setMonto(codigo: string, valor: number | null): void {
    this.montos.update((m) => ({ ...m, [codigo]: valor }));
  }

  /** Indica si el concepto captura la boleta a mano (No., fecha y archivo). */
  requiereBoleta(codigo: string): boolean {
    return this.conceptosPorCodigo()[codigo]?.boleta_manual ?? false;
  }

  datosBoleta(codigo: string): DatosBoleta {
    return this.boletas()[codigo] ?? { numero: '', fecha: null, archivo: null };
  }

  setBoleta<K extends keyof DatosBoleta>(codigo: string, campo: K, valor: DatosBoleta[K]): void {
    this.boletas.update((b) => ({ ...b, [codigo]: { ...this.datosBoleta(codigo), [campo]: valor } }));
  }

  elegirArchivo(codigo: string, evento: Event): void {
    const archivo = (evento.target as HTMLInputElement).files?.[0] ?? null;
    this.setBoleta(codigo, 'archivo', archivo);
  }

  /**
   * Texto del periodo de un informe: "dd/mm/yyyy al dd/mm/yyyy".
   * @param i informe cuyo rango se muestra.
   */
  periodo(i: InformeFinanciero): string {
    const f = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');
    return `${f(i.fecha_inicio)} al ${f(i.fecha_fin)}`;
  }

  nombreMes(mes: number): string {
    return MESES[mes - 1]?.label ?? String(mes);
  }

  severidad(estado: InformeFinanciero['estado']) {
    return SEVERIDAD_ESTADO[estado];
  }

  /** Texto de la columna "Boleta / fecha" del detalle. */
  referenciaBoleta(l: InformeFinancieroLinea): string {
    const fecha = l.fecha ? l.fecha.slice(0, 10).split('-').reverse().join('/') : '';
    if (l.boleta) return `#${l.boleta.numero}`;
    if (l.boleta_numero) return `No. ${l.boleta_numero}${fecha ? ' · ' + fecha : ''}`;
    return fecha || '—';
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
          this.informes.set(r.data);
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
    this.formCabecera.reset({
      iglesia_id: null,
      ministro_id: null,
      fecha_inicio: new Date(),
      fecha_fin: new Date(),
    });
    this.montos.set({});
    this.boletas.set({});
    this.dialogoCaptura.set(true);
  }

  /** Arma las líneas a enviar; el diezmo y el remanente los genera el backend. */
  private armarLineas(fechaInforme: string): LineaInformeNueva[] {
    const lineas: LineaInformeNueva[] = [];
    const concepto = (codigo: string) => this.conceptosPorCodigo()[codigo];

    for (const codigo of INGRESOS.map((r) => r.codigo)) {
      const monto = this.monto(codigo);
      if (monto && monto > 0) {
        lineas.push({ concepto_movimiento_id: concepto(codigo).id, monto, boleta_agrupador: 'informe' });
      }
    }
    for (const codigo of ['EGR-FAMILIAR', 'EGR-OBREROS', 'EGR-OTRAS']) {
      const monto = this.monto(codigo);
      if (monto && monto > 0) {
        lineas.push({ concepto_movimiento_id: concepto(codigo).id, monto, fecha: fechaInforme });
      }
    }
    for (const { codigo } of COLECTAS) {
      const monto = this.monto(codigo);
      if (!monto || monto <= 0) continue;
      if (this.requiereBoleta(codigo)) {
        const b = this.datosBoleta(codigo);
        lineas.push({
          concepto_movimiento_id: concepto(codigo).id,
          monto,
          boleta_numero: b.numero.trim() || undefined,
          fecha: b.fecha ? fechaLocalAIso(b.fecha) : fechaInforme,
        });
      } else {
        lineas.push({ concepto_movimiento_id: concepto(codigo).id, monto, fecha: fechaInforme });
      }
    }
    return lineas;
  }

  guardarInforme(): void {
    if (this.formCabecera.invalid) return;
    this.guardando.set(true);
    this.errorForm.set([]);

    const v = this.formCabecera.getRawValue();
    const lineas = this.armarLineas(fechaLocalAIso(v.fecha_fin));

    this.api.crear(v.iglesia_id as number, v.ministro_id, fechaLocalAIso(v.fecha_inicio), fechaLocalAIso(v.fecha_fin), lineas).subscribe({
      next: (r) => this.subirArchivos(r.data),
      error: (e: HttpErrorResponse) => {
        this.guardando.set(false);
        if (e.status === 422) {
          this.errorForm.set(Object.values(e.error?.errores ?? e.error?.errors ?? {}).flat() as string[]);
        } else {
          this.errorForm.set([e.error?.mensaje ?? 'No se pudo guardar el informe.']);
        }
      },
    });
  }

  /** Sube las boletas escaneadas elegidas, una por línea de colecta, una vez creado el informe. */
  private subirArchivos(informe: InformeFinanciero): void {
    const cargas = COLECTAS.map((r) => ({ r, archivo: this.datosBoleta(r.codigo).archivo }))
      .filter((c) => c.archivo)
      .map((c) => {
        const idConcepto = this.conceptosPorCodigo()[c.r.codigo].id;
        const linea = informe.lineas?.find((l) => l.concepto_movimiento_id === idConcepto);
        return linea ? this.api.subirBoleta(informe.id, linea.id, c.archivo as File) : of(null);
      });

    forkJoin(cargas.length ? cargas : [of(null)]).subscribe({
      next: () => this.terminarGuardado(),
      error: () => {
        this.mensajes.add({
          severity: 'warn',
          summary: 'Informe guardado, pero no se pudo cargar alguna boleta',
          detail: 'Revisá el detalle del informe.',
        });
        this.terminarGuardado();
      },
    });
  }

  private terminarGuardado(): void {
    this.guardando.set(false);
    this.dialogoCaptura.set(false);
    this.mensajes.add({ severity: 'success', summary: 'Informe creado, queda pendiente de aprobación' });
    this.recargar();
  }

  verDetalle(informe: InformeFinanciero): void {
    this.api.obtener(informe.id).subscribe((r) => {
      this.informeActivo.set(r.data);
      this.dialogoDetalle.set(true);
    });
  }

  /** Descarga la boleta escaneada y la abre en una pestaña nueva. */
  verArchivo(informeId: number, linea: InformeFinancieroLinea): void {
    this.api.descargarBoleta(informeId, linea.id).subscribe((blob) => {
      window.open(URL.createObjectURL(blob), '_blank');
    });
  }

  abrirResolucion(informe: InformeFinanciero, accion: 'aprobar' | 'rechazar'): void {
    this.informeActivo.set(informe);
    this.accionResolucion.set(accion);
    this.comentarioResolucion = '';
    this.dialogoResolucion.set(true);
  }

  resolver(): void {
    const informe = this.informeActivo();
    if (!informe) return;
    this.resolviendo.set(true);

    const peticion =
      this.accionResolucion() === 'aprobar'
        ? this.api.aprobar(informe.id, this.comentarioResolucion || undefined)
        : this.api.rechazar(informe.id, this.comentarioResolucion || undefined);

    peticion.subscribe({
      next: () => {
        this.resolviendo.set(false);
        this.dialogoResolucion.set(false);
        this.mensajes.add({
          severity: 'success',
          summary: this.accionResolucion() === 'aprobar' ? 'Informe aprobado' : 'Informe rechazado',
        });
        this.recargar();
      },
      error: () => {
        this.resolviendo.set(false);
        this.mensajes.add({ severity: 'error', summary: 'No se pudo resolver el informe' });
      },
    });
  }
}
