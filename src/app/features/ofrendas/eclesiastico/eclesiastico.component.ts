import { Component } from '@angular/core';
import { TabsModule } from 'primeng/tabs';
import { CatalogoTablaComponent } from '../shared/catalogo-tabla.component';
import { IglesiasComponent } from './iglesias.component';
import { CampoFormulario, ColumnaTabla } from '../../../core/models/ofrendas.models';

/**
 * Estructura eclesiástica: grados ministeriales, ministros e iglesias
 * (esta última con su propio componente por la asignación de ministro).
 */
@Component({
  selector: 'app-eclesiastico',
  imports: [TabsModule, CatalogoTablaComponent, IglesiasComponent],
  template: `
    <h1 class="fnz-titulo-pagina">Estructura eclesiástica</h1>
    <p class="fnz-subtitulo">Grados ministeriales, ministros e iglesias.</p>

    <p-tabs value="0" class="fnz-tabs">
      <p-tablist>
        <p-tab value="0">Grados ministeriales</p-tab>
        <p-tab value="1">Ministros</p-tab>
        <p-tab value="2">Iglesias</p-tab>
      </p-tablist>
      <p-tabpanels>
        <p-tabpanel value="0">
          <app-catalogo-tabla
            endpoint="catalogos/eclesiastico/grados"
            titulo="Grados ministeriales"
            permisoPrefijo="eclesiastico"
            [campos]="camposGrado"
            [columnas]="columnasGrado"
          />
        </p-tabpanel>
        <p-tabpanel value="1">
          <app-catalogo-tabla
            endpoint="catalogos/eclesiastico/ministros"
            titulo="Ministros"
            permisoPrefijo="eclesiastico"
            [campos]="camposMinistro"
            [columnas]="columnasMinistro"
          />
        </p-tabpanel>
        <p-tabpanel value="2">
          <app-iglesias />
        </p-tabpanel>
      </p-tabpanels>
    </p-tabs>
  `,
  styles: [
    `
      .fnz-tabs {
        margin-top: 1rem;
      }
    `,
  ],
})
export class EclesiasticoComponent {
  readonly camposGrado: CampoFormulario[] = [
    { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
    { nombre: 'orden', etiqueta: 'Orden', tipo: 'numero', requerido: true },
    { nombre: 'estado', etiqueta: 'Activo', tipo: 'checkbox', ocultarEnAlta: true },
  ];
  readonly columnasGrado: ColumnaTabla[] = [
    { campo: 'nombre', etiqueta: 'Nombre' },
    { campo: 'orden', etiqueta: 'Orden' },
    { campo: 'estado', etiqueta: 'Estado', tipo: 'booleano' },
  ];

  readonly camposMinistro: CampoFormulario[] = [
    { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
    { nombre: 'apellido', etiqueta: 'Apellido', tipo: 'texto', requerido: true },
    {
      nombre: 'grado_ministerial_id',
      etiqueta: 'Grado ministerial',
      tipo: 'select',
      opcionesEndpoint: 'catalogos/eclesiastico/grados',
    },
    { nombre: 'telefono', etiqueta: 'Teléfono', tipo: 'texto' },
    { nombre: 'celular', etiqueta: 'Celular', tipo: 'texto' },
    {
      nombre: 'estado',
      etiqueta: 'Estado',
      tipo: 'select',
      ocultarEnAlta: true,
      opciones: [
        { label: 'Activo', value: 'activo' },
        { label: 'Inactivo', value: 'inactivo' },
      ],
    },
  ];
  readonly columnasMinistro: ColumnaTabla[] = [
    { campo: 'nombre', etiqueta: 'Nombre' },
    { campo: 'apellido', etiqueta: 'Apellido' },
    { campo: 'estado', etiqueta: 'Estado' },
  ];
}
