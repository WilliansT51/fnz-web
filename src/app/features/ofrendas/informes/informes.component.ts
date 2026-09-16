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

import { AuthService } from '../../../core/auth/auth.service';
import { TienePermisoDirective } from '../../../core/auth/tiene-permiso.directive';
import { CatalogoService } from '../../../core/ofrendas/catalogo.service';
import { InformeFinancieroService } from '../../../core/ofrendas/informe-financiero.service';
import { fechaLocalAIso } from '../../../core/ofrendas/fecha.util';
import { ConceptoMovimiento, Iglesia, InformeFinanciero, OpcionSelect } from '../../../core/models/ofrendas.models';

const MESES: OpcionSelect[] = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
].map((label, i) => ({ label, value: i + 1 }));

const SEVERIDAD_ESTADO: Record<InformeFinanciero['estado'], 'warn' | 'success' | 'danger'> = {
  PENDIENTE: 'warn',
  APROBADO: 'success',
  RECHAZADO: 'danger',
};

interface FilaConcepto {
  concepto: ConceptoMovimiento;
  monto: number | null;
}

/**
 * Informe Financiero Mensual: lista + captura (una fila por concepto de
 * movimiento vigente, agrupada por categoría) + aprobación. Todas las
 * líneas que exigen boleta comparten UNA boleta interna del informe
 * (numeración correlativa automática, ver
 * {@see \App\Services\Ofrendas\BoletaService} en el backend); las que no,
 * usan la fecha del informe.
 */
@Component({
  selector: 'app-informes',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    DatePipe,
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
          <td>{{ nombreMes(i.mes) }} {{ i.anio }}</td>
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
      [style]="{ width: '52rem' }"
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
            <span>Mes</span>
            <p-select formControlName="mes" [options]="opcionesMes" optionLabel="label" optionValue="value" fluid />
          </label>
          <label>
            <span>Año</span>
            <p-inputNumber formControlName="anio" [useGrouping]="false" fluid />
          </label>
        </div>
        <label>
          <span>Fecha del informe (para conceptos sin boleta)</span>
          <p-datePicker formControlName="fecha" dateFormat="yy-mm-dd" [style]="{ maxWidth: '14rem' }" />
        </label>

        @for (grupo of gruposConceptos(); track grupo.nombre) {
          <div class="grupo-conceptos">
            <p class="fnz-titulo-seccion">{{ grupo.nombre }}</p>
            @for (fila of grupo.filas; track fila.concepto.id) {
              <div class="fila-concepto">
                <span class="nombre-concepto">{{ fila.concepto.nombre }}</span>
                <p-inputNumber
                  [ngModel]="fila.monto"
                  (ngModelChange)="actualizarMonto(fila.concepto.id, $event)"
                  [ngModelOptions]="{ standalone: true }"
                  mode="currency"
                  currency="GTQ"
                  locale="es-GT"
                  [minFractionDigits]="2"
                  placeholder="Q 0.00"
                />
              </div>
            }
          </div>
        }

        <div class="resumen">
          <div><span>Total ingresos de ofrenda</span><strong>Q {{ totalIngresos() | number: '1.2-2' }}</strong></div>
          <div><span>Total egresos de distribución</span><strong>Q {{ totalEgresos() | number: '1.2-2' }}</strong></div>
          <div>
            <span>Cuadre</span>
            <p-tag [value]="cuadra() ? 'Cuadra' : 'No cuadra'" [severity]="cuadra() ? 'success' : 'danger'" />
          </div>
          <div><span>Total colectas</span><strong>Q {{ totalColectas() | number: '1.2-2' }}</strong></div>
          <div><span>Total necesidades del ministro</span><strong>Q {{ totalNecesidades() | number: '1.2-2' }}</strong></div>
          <div class="general"><span>Total general</span><strong>Q {{ totalGeneral() | number: '1.2-2' }}</strong></div>
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
            [disabled]="formCabecera.invalid || guardando() || totalGeneral() === 0"
          />
        </div>
      </form>
    </p-dialog>

    <!-- Diálogo de detalle -->
    <p-dialog header="Detalle del informe" [(visible)]="dialogoDetalle" [modal]="true" [style]="{ width: '40rem' }">
      @if (informeActivo(); as i) {
        <p class="fnz-subtitulo">{{ i.iglesia?.nombre }} — {{ nombreMes(i.mes) }} {{ i.anio }}</p>
        <table class="tabla-lineas">
          <thead>
            <tr>
              <th>Concepto</th>
              <th>Monto</th>
              <th>Boleta</th>
            </tr>
          </thead>
          <tbody>
            @for (l of i.lineas; track l.id) {
              <tr>
                <td>{{ l.concepto?.nombre }}</td>
                <td>Q {{ l.monto }}</td>
                <td>{{ l.boleta ? '#' + l.boleta.numero : (l.fecha | date: 'dd/MM/yyyy':'UTC') }}</td>
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
      .grupo-conceptos { border-top: 1px solid var(--fnz-borde); padding-top: 0.75rem; }
      .fila-concepto { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 0.3rem 0; }
      .nombre-concepto { font-size: 0.85rem; }
      .resumen {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.5rem 1.5rem;
        background: var(--fnz-fondo);
        border-radius: 8px;
        padding: 0.9rem;
        font-size: 0.85rem;
      }
      .resumen div { display: flex; justify-content: space-between; align-items: center; }
      .resumen .general { grid-column: 1 / -1; border-top: 1px solid var(--fnz-borde); padding-top: 0.5rem; font-size: 0.95rem; }
      .errores { margin: 0; padding-left: 1.1rem; color: #c0392b; font-size: 0.82rem; }
      .pie { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem; }
      .campo { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.82rem; font-weight: 500; margin: 0.9rem 0; }
      .tabla-lineas { width: 100%; border-collapse: collapse; margin: 0.75rem 0; font-size: 0.85rem; }
      .tabla-lineas th, .tabla-lineas td { text-align: left; padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--fnz-borde); }
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

  readonly informes = signal<InformeFinanciero[]>([]);
  readonly total = signal(0);
  readonly cargando = signal(false);
  readonly filtroEstado = signal<string | null>('PENDIENTE');
  readonly opcionesIglesia = signal<OpcionSelect[]>([]);
  readonly conceptos = signal<ConceptoMovimiento[]>([]);
  readonly filasPorConcepto = signal<FilaConcepto[]>([]);

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
    mes: [new Date().getMonth() + 1, Validators.required],
    anio: [new Date().getFullYear(), Validators.required],
    fecha: [new Date(), Validators.required],
  });

  /** Categorías en el orden en que deben mostrarse en el formulario de captura. */
  private readonly ordenCategorias = ['Ordinaria', 'Colecta', 'Especial', 'Necesidad del ministro'];

  readonly gruposConceptos = computed(() => {
    const filas = this.filasPorConcepto();
    const porCategoria = new Map<string, FilaConcepto[]>();
    for (const fila of filas) {
      const nombre = fila.concepto.categoria_concepto_id ? this.nombreCategoria(fila.concepto) : 'Otros';
      if (!porCategoria.has(nombre)) porCategoria.set(nombre, []);
      porCategoria.get(nombre)!.push(fila);
    }
    return this.ordenCategorias
      .filter((c) => porCategoria.has(c))
      .map((nombre) => ({ nombre: this.etiquetaCategoria(nombre), filas: porCategoria.get(nombre)! }));
  });

  readonly totalIngresos = computed(() => this.sumaPor((f) => this.nombreCategoria(f.concepto) === 'Ordinaria' && f.concepto.tipo === 'INGRESO'));
  readonly totalEgresos = computed(() => this.sumaPor((f) => this.nombreCategoria(f.concepto) === 'Ordinaria' && f.concepto.tipo === 'EGRESO'));
  readonly totalColectas = computed(() => this.sumaPor((f) => ['Colecta', 'Especial'].includes(this.nombreCategoria(f.concepto))));
  readonly totalNecesidades = computed(() => this.sumaPor((f) => this.nombreCategoria(f.concepto) === 'Necesidad del ministro'));
  readonly totalGeneral = computed(() => this.totalIngresos() + this.totalColectas());
  readonly cuadra = computed(() => Math.abs(this.totalIngresos() - this.totalEgresos()) < 0.01);

  private categoriasPorId = new Map<number, string>();

  ngOnInit(): void {
    this.catalogos.todos<Iglesia>('catalogos/eclesiastico/iglesias').subscribe((r) => {
      this.opcionesIglesia.set(r.data.map((i) => ({ label: `${i.nombre} (${i.clave})`, value: i.id })));
    });
    // El endpoint ?todos=1 de conceptos no trae la relación `categoria`
    // cargada, así que el nombre de cada categoría se resuelve aparte;
    // se encadena para que el mapa ya esté listo cuando se fijen las
    // filas (categoriasPorId es un Map plano, no una señal, así que debe
    // estar completo ANTES de la única escritura que dispara el recálculo).
    this.catalogos.todos<{ id: number; nombre: string }>('catalogos/financiero/categorias-concepto').subscribe((r) => {
      for (const cat of r.data) this.categoriasPorId.set(cat.id, cat.nombre);

      this.catalogos.todos<ConceptoMovimiento>('catalogos/financiero/conceptos-movimiento').subscribe((r2) => {
        this.conceptos.set(r2.data);
        this.filasPorConcepto.set(r2.data.map((concepto) => ({ concepto, monto: null })));
      });
    });
  }

  /** Reemplaza el array de filas (no muta los objetos existentes) para que los totales `computed` se recalculen. */
  actualizarMonto(conceptoId: number, monto: number | null): void {
    this.filasPorConcepto.update((filas) =>
      filas.map((f) => (f.concepto.id === conceptoId ? { ...f, monto } : f)),
    );
  }

  private nombreCategoria(concepto: ConceptoMovimiento): string {
    return this.categoriasPorId.get(concepto.categoria_concepto_id) ?? '';
  }

  private etiquetaCategoria(nombre: string): string {
    const etiquetas: Record<string, string> = {
      Ordinaria: 'Ingresos y distribución de ofrenda',
      Colecta: 'Colectas',
      Especial: 'Ofrendas especiales',
      'Necesidad del ministro': 'Necesidades del ministro',
    };
    return etiquetas[nombre] ?? nombre;
  }

  private sumaPor(filtro: (f: FilaConcepto) => boolean): number {
    return this.filasPorConcepto()
      .filter((f) => filtro(f) && f.monto)
      .reduce((acc, f) => acc + (f.monto ?? 0), 0);
  }

  nombreMes(mes: number): string {
    return MESES[mes - 1]?.label ?? String(mes);
  }

  severidad(estado: InformeFinanciero['estado']) {
    return SEVERIDAD_ESTADO[estado];
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
      mes: new Date().getMonth() + 1,
      anio: new Date().getFullYear(),
      fecha: new Date(),
    });
    this.filasPorConcepto.update((filas) => filas.map((f) => ({ ...f, monto: null })));
    this.dialogoCaptura.set(true);
  }

  guardarInforme(): void {
    if (this.formCabecera.invalid) return;
    this.guardando.set(true);
    this.errorForm.set([]);

    const v = this.formCabecera.getRawValue();
    const fecha = fechaLocalAIso(v.fecha);

    const lineas = this.filasPorConcepto()
      .filter((f) => f.monto && f.monto > 0)
      .map((f) => ({
        concepto_movimiento_id: f.concepto.id,
        monto: f.monto as number,
        ...(f.concepto.aplica_boleta ? { boleta_agrupador: 'informe' } : { fecha }),
      }));

    this.api.crear(v.iglesia_id as number, v.mes, v.anio, lineas).subscribe({
      next: () => {
        this.guardando.set(false);
        this.dialogoCaptura.set(false);
        this.mensajes.add({ severity: 'success', summary: 'Informe creado, queda pendiente de aprobación' });
        this.recargar();
      },
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

  verDetalle(informe: InformeFinanciero): void {
    this.api.obtener(informe.id).subscribe((r) => {
      this.informeActivo.set(r.data);
      this.dialogoDetalle.set(true);
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
