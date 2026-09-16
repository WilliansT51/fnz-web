import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';

import { AuthService } from '../../../core/auth/auth.service';
import { TienePermisoDirective } from '../../../core/auth/tiene-permiso.directive';
import { CatalogoService } from '../../../core/ofrendas/catalogo.service';
import { BoletaPastoralService, LineaBoletaPastoralNueva } from '../../../core/ofrendas/boleta-pastoral.service';
import { BoletaPastoral, ConceptoMovimiento, Iglesia, Ministro, OpcionSelect } from '../../../core/models/ofrendas.models';

const MESES: OpcionSelect[] = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
].map((label, i) => ({ label, value: i + 1 }));

const SEVERIDAD_ESTADO: Record<BoletaPastoral['estado'], 'warn' | 'success' | 'danger'> = {
  PENDIENTE: 'warn',
  APROBADO: 'success',
  RECHAZADO: 'danger',
};

interface FilaNecesidad {
  concepto: ConceptoMovimiento;
  monto: number | null;
  descripcion: string;
}

/**
 * Boleta Mensual del pastor: ofrenda asignada (fija) + ofrendas para las
 * necesidades básicas del ministro (conceptos de la categoría "Necesidad
 * del ministro"). Cada línea admite un valor simbólico sin monto (solo
 * nota), igual que el formulario original.
 */
@Component({
  selector: 'app-boletas-pastorales',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    DecimalPipe,
    TableModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    TagModule,
    DialogModule,
    TienePermisoDirective,
  ],
  template: `
    <header class="fnz-toolbar-tabla">
      <div>
        <h1 class="fnz-titulo-pagina">Boletas mensuales del pastor</h1>
        <p class="fnz-subtitulo">Ofrenda asignada y necesidades básicas del ministro, por iglesia y mes.</p>
      </div>
      <p-button
        *appTienePermiso="'boletas-pastorales.crear'"
        label="Nueva boleta"
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
      [value]="boletas()"
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
          <th>Pastor</th>
          <th>Periodo</th>
          <th>Ofrenda asignada</th>
          <th>Necesidades</th>
          <th>Total general</th>
          <th>Estado</th>
          <th style="width: 9rem"></th>
        </tr>
      </ng-template>
      <ng-template #body let-b>
        <tr>
          <td>{{ b.iglesia?.nombre }}</td>
          <td>{{ b.ministro?.nombre }} {{ b.ministro?.apellido }}</td>
          <td>{{ nombreMes(b.mes) }} {{ b.anio }}</td>
          <td>Q {{ b.ofrenda_asignada }}</td>
          <td>Q {{ b.total_necesidades }}</td>
          <td>Q {{ b.total_general }}</td>
          <td><p-tag [value]="b.estado" [severity]="severidad(b.estado)" /></td>
          <td class="acciones">
            <p-button icon="pi pi-eye" [rounded]="true" [text]="true" size="small" (onClick)="verDetalle(b)" />
            @if (b.estado === 'PENDIENTE') {
              <p-button
                *appTienePermiso="'boletas-pastorales.aprobar'"
                icon="pi pi-check"
                severity="success"
                [rounded]="true"
                [text]="true"
                size="small"
                [disabled]="b.creado_por === auth.usuario()?.id"
                (onClick)="abrirResolucion(b, 'aprobar')"
              />
              <p-button
                *appTienePermiso="'boletas-pastorales.aprobar'"
                icon="pi pi-times"
                severity="danger"
                [rounded]="true"
                [text]="true"
                size="small"
                [disabled]="b.creado_por === auth.usuario()?.id"
                (onClick)="abrirResolucion(b, 'rechazar')"
              />
            }
          </td>
        </tr>
      </ng-template>
      <ng-template #emptymessage>
        <tr>
          <td colspan="8" class="vacio">Sin boletas que coincidan con el filtro.</td>
        </tr>
      </ng-template>
    </p-table>

    <!-- Diálogo de captura -->
    <p-dialog header="Nueva boleta mensual del pastor" [(visible)]="dialogoCaptura" [modal]="true" [style]="{ width: '46rem' }">
      <form class="formulario" [formGroup]="formCabecera" (ngSubmit)="guardarBoleta()">
        <div class="grid2">
          <label>
            <span>Iglesia</span>
            <p-select formControlName="iglesia_id" [options]="opcionesIglesia()" optionLabel="label" optionValue="value" [filter]="true" fluid />
          </label>
          <label>
            <span>Pastor</span>
            <p-select formControlName="ministro_id" [options]="opcionesMinistro()" optionLabel="label" optionValue="value" [filter]="true" fluid />
          </label>
        </div>
        <div class="grid3">
          <label>
            <span>Mes</span>
            <p-select formControlName="mes" [options]="opcionesMes" optionLabel="label" optionValue="value" fluid />
          </label>
          <label>
            <span>Año</span>
            <p-inputNumber formControlName="anio" [useGrouping]="false" fluid />
          </label>
          <label>
            <span>Ofrenda asignada al mes</span>
            <p-inputNumber formControlName="ofrenda_asignada" mode="currency" currency="GTQ" locale="es-GT" [minFractionDigits]="2" fluid />
          </label>
        </div>

        <p class="fnz-titulo-seccion">Ofrendas para las necesidades básicas del ministro</p>
        @for (fila of filasNecesidad(); track fila.concepto.id) {
          <div class="fila-necesidad">
            <span class="nombre-concepto">{{ fila.concepto.nombre }}</span>
            <p-inputNumber
              [ngModel]="fila.monto"
              (ngModelChange)="actualizarLinea(fila.concepto.id, 'monto', $event)"
              [ngModelOptions]="{ standalone: true }"
              mode="currency"
              currency="GTQ"
              locale="es-GT"
              [minFractionDigits]="2"
              placeholder="Q 0.00"
            />
            <input
              pInputText
              [ngModel]="fila.descripcion"
              (ngModelChange)="actualizarLinea(fila.concepto.id, 'descripcion', $event)"
              [ngModelOptions]="{ standalone: true }"
              placeholder="Nota (ej. simbólico)"
              class="nota"
            />
          </div>
        }

        <div class="resumen">
          <div><span>Ofrenda asignada</span><strong>Q {{ ofrendaAsignada() | number: '1.2-2' }}</strong></div>
          <div><span>Total necesidades</span><strong>Q {{ totalNecesidades() | number: '1.2-2' }}</strong></div>
          <div class="general"><span>Total general</span><strong>Q {{ totalGeneral() | number: '1.2-2' }}</strong></div>
        </div>

        @if (errorForm().length) {
          <ul class="errores">
            @for (e of errorForm(); track e) { <li>{{ e }}</li> }
          </ul>
        }

        <div class="pie">
          <p-button label="Cancelar" severity="secondary" [text]="true" type="button" (onClick)="dialogoCaptura.set(false)" />
          <p-button label="Guardar boleta" type="submit" [loading]="guardando()" [disabled]="formCabecera.invalid || guardando()" />
        </div>
      </form>
    </p-dialog>

    <!-- Diálogo de detalle -->
    <p-dialog header="Detalle de la boleta" [(visible)]="dialogoDetalle" [modal]="true" [style]="{ width: '38rem' }">
      @if (boletaActiva(); as b) {
        <p class="fnz-subtitulo">{{ b.iglesia?.nombre }} — {{ b.ministro?.nombre }} {{ b.ministro?.apellido }} — {{ nombreMes(b.mes) }} {{ b.anio }}</p>
        <p><strong>Ofrenda asignada:</strong> Q {{ b.ofrenda_asignada }}</p>
        <table class="tabla-lineas">
          <thead>
            <tr>
              <th>Necesidad</th>
              <th>Monto</th>
              <th>Nota</th>
            </tr>
          </thead>
          <tbody>
            @for (l of b.lineas; track l.id) {
              <tr>
                <td>{{ l.concepto?.nombre }}</td>
                <td>{{ l.monto ? 'Q ' + l.monto : '—' }}</td>
                <td>{{ l.descripcion || '—' }}</td>
              </tr>
            }
          </tbody>
        </table>
        <p><strong>Total general:</strong> Q {{ b.total_general }}</p>
        <p class="fnz-subtitulo">
          Capturado por {{ b.creador?.nombre }}
          @if (b.aprobador) { · Resuelto por {{ b.aprobador.nombre }} }
        </p>
        @if (b.comentario_resolucion) {
          <p><strong>Comentario:</strong> {{ b.comentario_resolucion }}</p>
        }
      }
    </p-dialog>

    <!-- Diálogo de aprobar/rechazar -->
    <p-dialog
      [header]="accionResolucion() === 'aprobar' ? 'Aprobar boleta' : 'Rechazar boleta'"
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
      .fila-necesidad { display: grid; grid-template-columns: 1fr 10rem 10rem; align-items: center; gap: 0.75rem; padding: 0.3rem 0; }
      .nombre-concepto { font-size: 0.85rem; }
      .nota { font-size: 0.82rem; }
      .resumen {
        display: grid;
        gap: 0.4rem;
        background: var(--fnz-fondo);
        border-radius: 8px;
        padding: 0.9rem;
        font-size: 0.85rem;
      }
      .resumen div { display: flex; justify-content: space-between; }
      .resumen .general { border-top: 1px solid var(--fnz-borde); padding-top: 0.5rem; font-size: 0.95rem; }
      .errores { margin: 0; padding-left: 1.1rem; color: #c0392b; font-size: 0.82rem; }
      .pie { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem; }
      .campo { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.82rem; font-weight: 500; margin: 0.9rem 0; }
      .tabla-lineas { width: 100%; border-collapse: collapse; margin: 0.75rem 0; font-size: 0.85rem; }
      .tabla-lineas th, .tabla-lineas td { text-align: left; padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--fnz-borde); }
    `,
  ],
})
export class BoletasPastoralesComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly catalogos = inject(CatalogoService);
  private readonly api = inject(BoletaPastoralService);
  private readonly fb = inject(FormBuilder);
  private readonly mensajes = inject(MessageService);

  readonly opcionesMes = MESES;
  readonly opcionesEstado = [
    { label: 'Pendiente', value: 'PENDIENTE' },
    { label: 'Aprobado', value: 'APROBADO' },
    { label: 'Rechazado', value: 'RECHAZADO' },
  ];

  readonly boletas = signal<BoletaPastoral[]>([]);
  readonly total = signal(0);
  readonly cargando = signal(false);
  readonly filtroEstado = signal<string | null>('PENDIENTE');
  readonly opcionesIglesia = signal<OpcionSelect[]>([]);
  readonly opcionesMinistro = signal<OpcionSelect[]>([]);
  readonly filasNecesidad = signal<FilaNecesidad[]>([]);

  readonly dialogoCaptura = signal(false);
  readonly guardando = signal(false);
  readonly errorForm = signal<string[]>([]);

  readonly dialogoDetalle = signal(false);
  readonly boletaActiva = signal<BoletaPastoral | null>(null);

  readonly dialogoResolucion = signal(false);
  readonly accionResolucion = signal<'aprobar' | 'rechazar'>('aprobar');
  readonly resolviendo = signal(false);
  comentarioResolucion = '';

  private ultimoEvento: TableLazyLoadEvent = { first: 0, rows: 15 };

  readonly formCabecera = this.fb.nonNullable.group({
    iglesia_id: [null as number | null, Validators.required],
    ministro_id: [null as number | null, Validators.required],
    mes: [new Date().getMonth() + 1, Validators.required],
    anio: [new Date().getFullYear(), Validators.required],
    ofrenda_asignada: [0, [Validators.required, Validators.min(0)]],
  });

  /**
   * Espejo en señal del control reactivo `ofrenda_asignada`: los
   * `computed` no se recalculan al leer `FormGroup.value` directamente
   * (no es una señal), así que se sincroniza vía `valueChanges`.
   */
  readonly ofrendaAsignada = signal(0);

  readonly totalNecesidades = computed(() =>
    this.filasNecesidad().reduce((acc, f) => acc + (f.monto ?? 0), 0),
  );
  readonly totalGeneral = computed(() => this.ofrendaAsignada() + this.totalNecesidades());

  ngOnInit(): void {
    this.formCabecera.controls.ofrenda_asignada.valueChanges.subscribe((v) => this.ofrendaAsignada.set(v ?? 0));
    this.catalogos.todos<Iglesia>('catalogos/eclesiastico/iglesias').subscribe((r) => {
      this.opcionesIglesia.set(r.data.map((i) => ({ label: `${i.nombre} (${i.clave})`, value: i.id })));
    });
    this.catalogos.todos<Ministro>('catalogos/eclesiastico/ministros').subscribe((r) => {
      this.opcionesMinistro.set(r.data.map((m) => ({ label: `${m.nombre} ${m.apellido}`, value: m.id })));
    });
    // Igual que en Informes: se encadena para que el mapa de categorías
    // esté listo antes de fijar las filas (mismo bug evitado ahí).
    this.catalogos.todos<{ id: number; nombre: string }>('catalogos/financiero/categorias-concepto').subscribe((r) => {
      const idNecesidad = r.data.find((c) => c.nombre === 'Necesidad del ministro')?.id;
      this.catalogos.todos<ConceptoMovimiento>('catalogos/financiero/conceptos-movimiento').subscribe((r2) => {
        const necesidades = r2.data.filter((c) => c.categoria_concepto_id === idNecesidad);
        this.filasNecesidad.set(necesidades.map((concepto) => ({ concepto, monto: null, descripcion: '' })));
      });
    });
  }

  actualizarLinea(conceptoId: number, campo: 'monto' | 'descripcion', valor: number | string | null): void {
    this.filasNecesidad.update((filas) =>
      filas.map((f) => (f.concepto.id === conceptoId ? { ...f, [campo]: valor } : f)),
    );
  }

  nombreMes(mes: number): string {
    return MESES[mes - 1]?.label ?? String(mes);
  }

  severidad(estado: BoletaPastoral['estado']) {
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
          this.boletas.set(r.data);
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
      mes: new Date().getMonth() + 1,
      anio: new Date().getFullYear(),
      ofrenda_asignada: 0,
    });
    this.filasNecesidad.update((filas) => filas.map((f) => ({ ...f, monto: null, descripcion: '' })));
    this.dialogoCaptura.set(true);
  }

  guardarBoleta(): void {
    if (this.formCabecera.invalid) return;
    this.guardando.set(true);
    this.errorForm.set([]);

    const v = this.formCabecera.getRawValue();
    const lineas: LineaBoletaPastoralNueva[] = this.filasNecesidad()
      .filter((f) => (f.monto && f.monto > 0) || f.descripcion.trim())
      .map((f) => ({
        concepto_movimiento_id: f.concepto.id,
        ...(f.monto ? { monto: f.monto } : {}),
        ...(f.descripcion.trim() ? { descripcion: f.descripcion.trim() } : {}),
      }));

    this.api.crear(v.iglesia_id as number, v.ministro_id as number, v.mes, v.anio, v.ofrenda_asignada, lineas).subscribe({
      next: () => {
        this.guardando.set(false);
        this.dialogoCaptura.set(false);
        this.mensajes.add({ severity: 'success', summary: 'Boleta creada, queda pendiente de aprobación' });
        this.recargar();
      },
      error: (e: HttpErrorResponse) => {
        this.guardando.set(false);
        if (e.status === 422) {
          this.errorForm.set(Object.values(e.error?.errores ?? e.error?.errors ?? {}).flat() as string[]);
        } else {
          this.errorForm.set([e.error?.mensaje ?? 'No se pudo guardar la boleta.']);
        }
      },
    });
  }

  verDetalle(boleta: BoletaPastoral): void {
    this.api.obtener(boleta.id).subscribe((r) => {
      this.boletaActiva.set(r.data);
      this.dialogoDetalle.set(true);
    });
  }

  abrirResolucion(boleta: BoletaPastoral, accion: 'aprobar' | 'rechazar'): void {
    this.boletaActiva.set(boleta);
    this.accionResolucion.set(accion);
    this.comentarioResolucion = '';
    this.dialogoResolucion.set(true);
  }

  resolver(): void {
    const boleta = this.boletaActiva();
    if (!boleta) return;
    this.resolviendo.set(true);

    const peticion =
      this.accionResolucion() === 'aprobar'
        ? this.api.aprobar(boleta.id, this.comentarioResolucion || undefined)
        : this.api.rechazar(boleta.id, this.comentarioResolucion || undefined);

    peticion.subscribe({
      next: () => {
        this.resolviendo.set(false);
        this.dialogoResolucion.set(false);
        this.mensajes.add({
          severity: 'success',
          summary: this.accionResolucion() === 'aprobar' ? 'Boleta aprobada' : 'Boleta rechazada',
        });
        this.recargar();
      },
      error: () => {
        this.resolviendo.set(false);
        this.mensajes.add({ severity: 'error', summary: 'No se pudo resolver la boleta' });
      },
    });
  }
}
