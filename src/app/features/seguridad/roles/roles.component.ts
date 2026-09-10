import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { CheckboxModule } from 'primeng/checkbox';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MessageService } from 'primeng/api';

import { AuthService } from '../../../core/auth/auth.service';
import { MenuService } from '../../../core/auth/menu.service';
import { TienePermisoDirective } from '../../../core/auth/tiene-permiso.directive';
import { DatosRol, GrupoPermisos, Rol, RolesService } from './roles.service';

@Component({
  selector: 'app-roles',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    TagModule,
    DialogModule,
    CheckboxModule,
    TooltipModule,
    TienePermisoDirective,
  ],
  template: `
    <header class="fnz-toolbar-tabla">
      <div>
        <h1 class="fnz-titulo-pagina">Roles y permisos</h1>
        <p class="fnz-subtitulo">Agrupaciones de permisos asignables a los usuarios</p>
      </div>
      <p-button
        *appTienePermiso="'roles.crear'"
        label="Nuevo rol"
        icon="pi pi-plus"
        (onClick)="abrir()"
      />
    </header>

    <p-table
      [value]="roles()"
      [loading]="cargando()"
      dataKey="id"
      styleClass="fnz-tarjeta p-datatable-sm"
      [paginator]="roles().length > 15"
      [rows]="15"
    >
      <ng-template #header>
        <tr>
          <th>Rol</th>
          <th>Descripción</th>
          <th style="width: 7rem">Usuarios</th>
          <th style="width: 7rem">Permisos</th>
          <th style="width: 6rem"></th>
        </tr>
      </ng-template>
      <ng-template #body let-r>
        <tr>
          <td>
            <strong>{{ r.nombre }}</strong>
            @if (r.es_sistema) {
              <p-tag value="sistema" severity="secondary" styleClass="ml-2" />
            }
            @if (!r.estado) {
              <p-tag value="inactivo" severity="warn" styleClass="ml-2" />
            }
          </td>
          <td>{{ r.descripcion || '—' }}</td>
          <td>{{ r.total_usuarios ?? 0 }}</td>
          <td>{{ r.total_permisos ?? 0 }}</td>
          <td class="acciones">
            <p-button
              *appTienePermiso="'roles.editar'"
              icon="pi pi-pencil"
              [rounded]="true"
              [text]="true"
              size="small"
              (onClick)="abrir(r)"
            />
            @if (auth.tienePermiso('roles.eliminar') && !r.es_sistema) {
              <p-button
                icon="pi pi-trash"
                severity="danger"
                [rounded]="true"
                [text]="true"
                size="small"
                (onClick)="eliminar(r)"
              />
            }
          </td>
        </tr>
      </ng-template>
    </p-table>

    <p-dialog
      [header]="edicion() ? 'Editar rol' : 'Nuevo rol'"
      [(visible)]="dialogo"
      [modal]="true"
      [style]="{ width: '44rem' }"
      (onHide)="edicion.set(null)"
    >
      <form class="formulario" [formGroup]="form" (ngSubmit)="guardar()">
        <div class="grid2">
          <label>
            <span>Nombre</span>
            <input
              pInputText
              formControlName="nombre"
              [readonly]="edicion()?.es_sistema"
              fluid
            />
          </label>
          <label class="fila-check">
            <p-checkbox formControlName="estado" [binary]="true" inputId="estado" />
            <span for="estado">Activo</span>
          </label>
        </div>
        <label>
          <span>Descripción</span>
          <textarea pTextarea formControlName="descripcion" rows="2" fluid></textarea>
        </label>

        <div class="permisos">
          <div class="permisos-cab">
            <span>Permisos</span>
            <span class="conteo">{{ seleccionados().size }} seleccionados</span>
          </div>
          @for (grupo of catalogo(); track grupo.modulo) {
            <div class="grupo">
              <label class="grupo-cab">
                <p-checkbox
                  [binary]="true"
                  [ngModel]="grupoCompleto(grupo)"
                  [ngModelOptions]="{ standalone: true }"
                  (onChange)="alternarGrupo(grupo, $event.checked)"
                />
                <strong>{{ grupo.nombre }}</strong>
              </label>
              <div class="acciones-permiso">
                @for (p of grupo.permisos; track p.id) {
                  <label class="chip">
                    <p-checkbox
                      [binary]="true"
                      [ngModel]="seleccionados().has(p.id)"
                      [ngModelOptions]="{ standalone: true }"
                      (onChange)="alternar(p.id, $event.checked)"
                    />
                    <span>{{ etiquetaAccion(p.accion) }}</span>
                  </label>
                }
              </div>
            </div>
          }
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
  `,
  styles: [
    `
      .acciones {
        text-align: right;
        white-space: nowrap;
      }
      .formulario {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding-top: 0.5rem;
      }
      .grid2 {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 1rem;
        align-items: end;
      }
      label {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        font-size: 0.82rem;
        font-weight: 500;
      }
      .fila-check {
        flex-direction: row;
        align-items: center;
        gap: 0.5rem;
        padding-bottom: 0.5rem;
      }
      .permisos {
        border: 1px solid var(--fnz-borde);
        border-radius: 10px;
        overflow: hidden;
      }
      .permisos-cab {
        display: flex;
        justify-content: space-between;
        padding: 0.6rem 0.9rem;
        background: var(--fnz-fondo);
        font-weight: 600;
        font-size: 0.85rem;
      }
      .conteo {
        color: var(--fnz-tinta-suave);
        font-weight: 400;
      }
      .grupo {
        padding: 0.6rem 0.9rem;
        border-top: 1px solid var(--fnz-borde);
      }
      .grupo-cab {
        flex-direction: row;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.4rem;
      }
      .acciones-permiso {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem 1rem;
        padding-left: 1.6rem;
      }
      .chip {
        flex-direction: row;
        align-items: center;
        gap: 0.4rem;
        font-weight: 400;
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
      }
      :host ::ng-deep .ml-2 {
        margin-left: 0.5rem;
      }
    `,
  ],
})
export class RolesComponent {
  readonly auth = inject(AuthService);
  private readonly api = inject(RolesService);
  private readonly menu = inject(MenuService);
  private readonly fb = inject(FormBuilder);
  private readonly confirmar = inject(ConfirmationService);
  private readonly mensajes = inject(MessageService);

  readonly roles = signal<Rol[]>([]);
  readonly catalogo = signal<GrupoPermisos[]>([]);
  readonly cargando = signal(false);

  readonly dialogo = signal(false);
  readonly edicion = signal<Rol | null>(null);
  readonly guardando = signal(false);
  readonly errorForm = signal<string[]>([]);
  readonly seleccionados = signal<Set<number>>(new Set());

  private readonly etiquetas: Record<string, string> = {
    consultar: 'Consultar',
    crear: 'Crear',
    editar: 'Editar',
    eliminar: 'Eliminar',
    exportar: 'Exportar',
    aprobar: 'Aprobar',
  };

  readonly form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(50)]],
    descripcion: [''],
    estado: [true],
  });

  constructor() {
    this.recargar();
    this.api.permisos().subscribe((r) => this.catalogo.set(r.data));
  }

  recargar(): void {
    this.cargando.set(true);
    this.api.listar().subscribe({
      next: (r) => {
        this.roles.set(r.data);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  etiquetaAccion(a: string): string {
    return this.etiquetas[a] ?? a;
  }

  private idsPorCodigo(codigos: string[]): Set<number> {
    const mapa = new Map<string, number>();
    for (const g of this.catalogo()) for (const p of g.permisos) mapa.set(p.codigo, p.id);
    return new Set(codigos.map((c) => mapa.get(c)).filter((x): x is number => x != null));
  }

  abrir(rol?: Rol): void {
    this.errorForm.set([]);
    this.edicion.set(rol ?? null);

    if (rol) {
      this.form.reset({
        nombre: rol.nombre,
        descripcion: rol.descripcion ?? '',
        estado: rol.estado,
      });
      // El detalle trae los códigos; si no, se piden.
      if (rol.permisos) {
        this.seleccionados.set(this.idsPorCodigo(rol.permisos));
      } else {
        this.api.obtener(rol.id).subscribe((r) =>
          this.seleccionados.set(this.idsPorCodigo(r.data.permisos ?? [])),
        );
      }
    } else {
      this.form.reset({ nombre: '', descripcion: '', estado: true });
      this.seleccionados.set(new Set());
    }
    this.dialogo.set(true);
  }

  alternar(id: number, marcado: boolean): void {
    const s = new Set(this.seleccionados());
    marcado ? s.add(id) : s.delete(id);
    this.seleccionados.set(s);
  }

  grupoCompleto(grupo: GrupoPermisos): boolean {
    return grupo.permisos.every((p) => this.seleccionados().has(p.id));
  }

  alternarGrupo(grupo: GrupoPermisos, marcado: boolean): void {
    const s = new Set(this.seleccionados());
    for (const p of grupo.permisos) marcado ? s.add(p.id) : s.delete(p.id);
    this.seleccionados.set(s);
  }

  guardar(): void {
    if (this.form.invalid) return;
    this.guardando.set(true);
    this.errorForm.set([]);

    const v = this.form.getRawValue();
    const payload: DatosRol = {
      nombre: v.nombre,
      descripcion: v.descripcion || null,
      estado: v.estado,
      permisos: [...this.seleccionados()],
    };
    const objetivo = this.edicion();

    const peticion = objetivo
      ? this.api.actualizar(objetivo.id, payload)
      : this.api.crear(payload);

    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.dialogo.set(false);
        this.mensajes.add({
          severity: 'success',
          summary: objetivo ? 'Rol actualizado' : 'Rol creado',
        });
        this.recargar();
        this.menu.cargar(); // los permisos propios pueden haber cambiado
      },
      error: (e: HttpErrorResponse) => {
        this.guardando.set(false);
        this.errorForm.set(
          e.status === 422
            ? (Object.values(e.error?.errors ?? {}).flat() as string[])
            : [e.error?.mensaje ?? 'No se pudo guardar.'],
        );
      },
    });
  }

  eliminar(rol: Rol): void {
    this.confirmar.confirm({
      message: `¿Eliminar el rol "${rol.nombre}"? Se quitará a ${rol.total_usuarios ?? 0} usuario(s).`,
      header: 'Eliminar rol',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.api.eliminar(rol.id).subscribe(() => {
          this.mensajes.add({ severity: 'success', summary: 'Rol eliminado' });
          this.recargar();
        }),
    });
  }
}
