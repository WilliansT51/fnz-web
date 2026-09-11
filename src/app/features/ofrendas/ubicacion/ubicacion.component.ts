import { Component } from '@angular/core';
import { TabsModule } from 'primeng/tabs';
import { CatalogoTablaComponent } from '../shared/catalogo-tabla.component';
import { CampoFormulario, ColumnaTabla } from '../../../core/models/ofrendas.models';

const CAMPOS_ESTADO: CampoFormulario = {
  nombre: 'estado',
  etiqueta: 'Activo',
  tipo: 'checkbox',
  ocultarEnAlta: true,
};

const COLUMNA_ESTADO: ColumnaTabla = { campo: 'estado', etiqueta: 'Estado', tipo: 'booleano' };

/**
 * Catálogos de ubicación: País → Jurisdicción → Distrito → Departamento →
 * Municipio. Cada pestaña reutiliza {@see CatalogoTablaComponent}; la
 * cadena de FKs se resuelve con selects que cargan del catálogo padre
 * (`opcionesEndpoint`).
 */
@Component({
  selector: 'app-ubicacion',
  imports: [TabsModule, CatalogoTablaComponent],
  template: `
    <h1 class="fnz-titulo-pagina">Ubicación</h1>
    <p class="fnz-subtitulo">País, jurisdicción, distrito, departamento y municipio.</p>

    <p-tabs value="0" class="fnz-tabs">
      <p-tablist>
        <p-tab value="0">Países</p-tab>
        <p-tab value="1">Jurisdicciones</p-tab>
        <p-tab value="2">Distritos</p-tab>
        <p-tab value="3">Departamentos</p-tab>
        <p-tab value="4">Municipios</p-tab>
      </p-tablist>
      <p-tabpanels>
        <p-tabpanel value="0">
          <app-catalogo-tabla
            endpoint="catalogos/ubicacion/paises"
            titulo="Países"
            permisoPrefijo="ubicacion"
            [campos]="camposPais"
            [columnas]="columnasPais"
          />
        </p-tabpanel>
        <p-tabpanel value="1">
          <app-catalogo-tabla
            endpoint="catalogos/ubicacion/jurisdicciones"
            titulo="Jurisdicciones"
            permisoPrefijo="ubicacion"
            [campos]="camposJurisdiccion"
            [columnas]="columnasJurisdiccion"
          />
        </p-tabpanel>
        <p-tabpanel value="2">
          <app-catalogo-tabla
            endpoint="catalogos/ubicacion/distritos"
            titulo="Distritos"
            permisoPrefijo="ubicacion"
            [campos]="camposDistrito"
            [columnas]="columnasDistrito"
          />
        </p-tabpanel>
        <p-tabpanel value="3">
          <app-catalogo-tabla
            endpoint="catalogos/ubicacion/departamentos"
            titulo="Departamentos"
            permisoPrefijo="ubicacion"
            [campos]="camposDepartamento"
            [columnas]="columnasDepartamento"
          />
        </p-tabpanel>
        <p-tabpanel value="4">
          <app-catalogo-tabla
            endpoint="catalogos/ubicacion/municipios"
            titulo="Municipios"
            permisoPrefijo="ubicacion"
            [campos]="camposMunicipio"
            [columnas]="columnasMunicipio"
          />
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
export class UbicacionComponent {
  readonly camposPais: CampoFormulario[] = [
    { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
    { nombre: 'codigo_iso', etiqueta: 'Código ISO', tipo: 'texto' },
    CAMPOS_ESTADO,
  ];
  readonly columnasPais: ColumnaTabla[] = [
    { campo: 'nombre', etiqueta: 'Nombre' },
    { campo: 'codigo_iso', etiqueta: 'Código ISO' },
    COLUMNA_ESTADO,
  ];

  readonly camposJurisdiccion: CampoFormulario[] = [
    {
      nombre: 'pais_id',
      etiqueta: 'País',
      tipo: 'select',
      requerido: true,
      opcionesEndpoint: 'catalogos/ubicacion/paises',
    },
    { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
    { nombre: 'codigo', etiqueta: 'Código', tipo: 'texto' },
    CAMPOS_ESTADO,
  ];
  readonly columnasJurisdiccion: ColumnaTabla[] = [
    { campo: 'nombre', etiqueta: 'Nombre' },
    { campo: 'codigo', etiqueta: 'Código' },
    COLUMNA_ESTADO,
  ];

  readonly camposDistrito: CampoFormulario[] = [
    {
      nombre: 'jurisdiccion_id',
      etiqueta: 'Jurisdicción',
      tipo: 'select',
      requerido: true,
      opcionesEndpoint: 'catalogos/ubicacion/jurisdicciones',
    },
    { nombre: 'numero', etiqueta: 'Número', tipo: 'numero', requerido: true },
    { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
    CAMPOS_ESTADO,
  ];
  readonly columnasDistrito: ColumnaTabla[] = [
    { campo: 'numero', etiqueta: 'Número' },
    { campo: 'nombre', etiqueta: 'Nombre' },
    COLUMNA_ESTADO,
  ];

  readonly camposDepartamento: CampoFormulario[] = [
    { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
    CAMPOS_ESTADO,
  ];
  readonly columnasDepartamento: ColumnaTabla[] = [
    { campo: 'nombre', etiqueta: 'Nombre' },
    COLUMNA_ESTADO,
  ];

  readonly camposMunicipio: CampoFormulario[] = [
    {
      nombre: 'departamento_id',
      etiqueta: 'Departamento',
      tipo: 'select',
      requerido: true,
      opcionesEndpoint: 'catalogos/ubicacion/departamentos',
    },
    { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
    CAMPOS_ESTADO,
  ];
  readonly columnasMunicipio: ColumnaTabla[] = [
    { campo: 'nombre', etiqueta: 'Nombre' },
    COLUMNA_ESTADO,
  ];
}
