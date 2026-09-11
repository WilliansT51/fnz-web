import { Component } from '@angular/core';
import { TabsModule } from 'primeng/tabs';
import { CatalogoTablaComponent } from '../shared/catalogo-tabla.component';
import { CampoFormulario, ColumnaTabla } from '../../../core/models/ofrendas.models';

const CAMPO_ESTADO: CampoFormulario = {
  nombre: 'estado',
  etiqueta: 'Activo',
  tipo: 'checkbox',
  ocultarEnAlta: true,
};
const COLUMNA_ESTADO: ColumnaTabla = { campo: 'estado', etiqueta: 'Estado', tipo: 'booleano' };

/**
 * Catálogos financieros: bancos, categorías y tipos de gasto, conceptos de
 * gasto, plan de cuentas, cuentas bancarias, y el catálogo núcleo del
 * sistema (conceptos de movimiento).
 */
@Component({
  selector: 'app-financiero',
  imports: [TabsModule, CatalogoTablaComponent],
  template: `
    <h1 class="fnz-titulo-pagina">Catálogos financieros</h1>
    <p class="fnz-subtitulo">Bancos, plan de cuentas, conceptos de movimiento y de gasto.</p>

    <p-tabs value="0" class="fnz-tabs">
      <p-tablist>
        <p-tab value="0">Bancos</p-tab>
        <p-tab value="1">Categorías de concepto</p-tab>
        <p-tab value="2">Tipos de gasto</p-tab>
        <p-tab value="3">Conceptos de gasto</p-tab>
        <p-tab value="4">Cuentas contables</p-tab>
        <p-tab value="5">Cuentas bancarias</p-tab>
        <p-tab value="6">Conceptos de movimiento</p-tab>
      </p-tablist>
      <p-tabpanels>
        <p-tabpanel value="0">
          <app-catalogo-tabla
            endpoint="catalogos/financiero/bancos"
            titulo="Bancos"
            permisoPrefijo="financiero"
            [campos]="camposSimple"
            [columnas]="columnasSimple"
          />
        </p-tabpanel>
        <p-tabpanel value="1">
          <app-catalogo-tabla
            endpoint="catalogos/financiero/categorias-concepto"
            titulo="Categorías de concepto"
            permisoPrefijo="financiero"
            [campos]="camposSimple"
            [columnas]="columnasSimple"
          />
        </p-tabpanel>
        <p-tabpanel value="2">
          <app-catalogo-tabla
            endpoint="catalogos/financiero/tipos-gasto"
            titulo="Tipos de gasto"
            permisoPrefijo="financiero"
            [campos]="camposSimple"
            [columnas]="columnasSimple"
          />
        </p-tabpanel>
        <p-tabpanel value="3">
          <app-catalogo-tabla
            endpoint="catalogos/financiero/conceptos-gasto"
            titulo="Conceptos de gasto"
            permisoPrefijo="financiero"
            [campos]="camposConceptoGasto"
            [columnas]="columnasConceptoGasto"
          />
        </p-tabpanel>
        <p-tabpanel value="4">
          <app-catalogo-tabla
            endpoint="catalogos/financiero/cuentas-contables"
            titulo="Cuentas contables"
            permisoPrefijo="financiero"
            [campos]="camposCuentaContable"
            [columnas]="columnasCuentaContable"
          />
        </p-tabpanel>
        <p-tabpanel value="5">
          <app-catalogo-tabla
            endpoint="catalogos/financiero/cuentas-bancarias"
            titulo="Cuentas bancarias"
            permisoPrefijo="financiero"
            [campos]="camposCuentaBancaria"
            [columnas]="columnasCuentaBancaria"
          />
        </p-tabpanel>
        <p-tabpanel value="6">
          <app-catalogo-tabla
            endpoint="catalogos/financiero/conceptos-movimiento"
            titulo="Conceptos de movimiento"
            permisoPrefijo="financiero"
            [campos]="camposConceptoMovimiento"
            [columnas]="columnasConceptoMovimiento"
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
export class FinancieroComponent {
  readonly camposSimple: CampoFormulario[] = [
    { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
    CAMPO_ESTADO,
  ];
  readonly columnasSimple: ColumnaTabla[] = [
    { campo: 'nombre', etiqueta: 'Nombre' },
    COLUMNA_ESTADO,
  ];

  readonly camposConceptoGasto: CampoFormulario[] = [
    {
      nombre: 'tipo_gasto_id',
      etiqueta: 'Tipo de gasto',
      tipo: 'select',
      requerido: true,
      opcionesEndpoint: 'catalogos/financiero/tipos-gasto',
    },
    { nombre: 'codigo', etiqueta: 'Código', tipo: 'texto', requerido: true },
    { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
    { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea' },
    CAMPO_ESTADO,
  ];
  readonly columnasConceptoGasto: ColumnaTabla[] = [
    { campo: 'codigo', etiqueta: 'Código' },
    { campo: 'nombre', etiqueta: 'Nombre' },
    COLUMNA_ESTADO,
  ];

  readonly camposCuentaContable: CampoFormulario[] = [
    { nombre: 'codigo', etiqueta: 'Código', tipo: 'texto', requerido: true },
    { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
    {
      nombre: 'tipo',
      etiqueta: 'Tipo',
      tipo: 'select',
      requerido: true,
      opciones: [
        { label: 'Activo', value: 'ACTIVO' },
        { label: 'Pasivo', value: 'PASIVO' },
        { label: 'Patrimonio', value: 'PATRIMONIO' },
        { label: 'Ingreso', value: 'INGRESO' },
        { label: 'Gasto', value: 'GASTO' },
      ],
    },
    {
      nombre: 'naturaleza',
      etiqueta: 'Naturaleza',
      tipo: 'select',
      requerido: true,
      opciones: [
        { label: 'Deudora', value: 'DEUDORA' },
        { label: 'Acreedora', value: 'ACREEDORA' },
      ],
    },
    {
      nombre: 'cuenta_padre_id',
      etiqueta: 'Cuenta padre',
      tipo: 'select',
      opcionesEndpoint: 'catalogos/financiero/cuentas-contables',
    },
    {
      nombre: 'acepta_movimiento',
      etiqueta: 'Acepta movimiento directo',
      tipo: 'checkbox',
    },
    CAMPO_ESTADO,
  ];
  readonly columnasCuentaContable: ColumnaTabla[] = [
    { campo: 'codigo', etiqueta: 'Código' },
    { campo: 'nombre', etiqueta: 'Nombre' },
    { campo: 'tipo', etiqueta: 'Tipo' },
    COLUMNA_ESTADO,
  ];

  readonly camposCuentaBancaria: CampoFormulario[] = [
    {
      nombre: 'banco_id',
      etiqueta: 'Banco',
      tipo: 'select',
      requerido: true,
      opcionesEndpoint: 'catalogos/financiero/bancos',
    },
    {
      nombre: 'ambito',
      etiqueta: 'Ámbito',
      tipo: 'select',
      requerido: true,
      opciones: [
        { label: 'Jurisdicción', value: 'JURISDICCION' },
        { label: 'Distrito', value: 'DISTRITO' },
        { label: 'Iglesia', value: 'IGLESIA' },
      ],
    },
    { nombre: 'numero_cuenta', etiqueta: 'Número de cuenta', tipo: 'texto', requerido: true },
    { nombre: 'tipo_cuenta', etiqueta: 'Tipo de cuenta', tipo: 'texto' },
    { nombre: 'alias', etiqueta: 'Alias', tipo: 'texto' },
    CAMPO_ESTADO,
  ];
  readonly columnasCuentaBancaria: ColumnaTabla[] = [
    { campo: 'numero_cuenta', etiqueta: 'Número de cuenta' },
    { campo: 'alias', etiqueta: 'Alias' },
    { campo: 'ambito', etiqueta: 'Ámbito' },
    COLUMNA_ESTADO,
  ];

  readonly camposConceptoMovimiento: CampoFormulario[] = [
    { nombre: 'codigo', etiqueta: 'Código', tipo: 'texto', requerido: true },
    { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
    { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea' },
    {
      nombre: 'tipo',
      etiqueta: 'Tipo',
      tipo: 'select',
      requerido: true,
      opciones: [
        { label: 'Ingreso', value: 'INGRESO' },
        { label: 'Egreso', value: 'EGRESO' },
      ],
    },
    {
      nombre: 'categoria_concepto_id',
      etiqueta: 'Categoría',
      tipo: 'select',
      requerido: true,
      opcionesEndpoint: 'catalogos/financiero/categorias-concepto',
    },
    {
      nombre: 'ambito',
      etiqueta: 'Ámbito',
      tipo: 'select',
      opciones: [
        { label: 'Iglesia', value: 'IGLESIA' },
        { label: 'Distrito', value: 'DISTRITO' },
        { label: 'Jurisdicción', value: 'JURISDICCION' },
      ],
    },
    { nombre: 'es_nacional', etiqueta: 'Es nacional', tipo: 'checkbox' },
    { nombre: 'es_especial', etiqueta: 'Es especial (con vigencia)', tipo: 'checkbox' },
    { nombre: 'aplica_boleta', etiqueta: 'Aplica boleta', tipo: 'checkbox' },
    CAMPO_ESTADO,
  ];
  readonly columnasConceptoMovimiento: ColumnaTabla[] = [
    { campo: 'codigo', etiqueta: 'Código' },
    { campo: 'nombre', etiqueta: 'Nombre' },
    { campo: 'tipo', etiqueta: 'Tipo' },
    COLUMNA_ESTADO,
  ];
}
