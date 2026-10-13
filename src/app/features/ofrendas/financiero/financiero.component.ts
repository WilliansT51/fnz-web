import { Component } from '@angular/core';
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
 * Catálogos financieros. Por ahora solo se expone el catálogo núcleo del
 * sistema (tipo de ofrendas); bancos, categorías, tipos/conceptos de
 * gasto, plan de cuentas y cuentas bancarias siguen disponibles en el
 * backend y se pueden volver a mostrar cuando se necesiten.
 */
@Component({
  selector: 'app-financiero',
  imports: [CatalogoTablaComponent],
  template: `
    <h1 class="fnz-titulo-pagina">Catálogos financieros</h1>
    <p class="fnz-subtitulo">Tipo de Ofrendas.</p>

    <div class="fnz-contenido">
      <app-catalogo-tabla
        endpoint="catalogos/financiero/conceptos-movimiento"
        titulo="Tipo de Ofrendas"
        permisoPrefijo="financiero"
        [campos]="camposConceptoMovimiento"
        [columnas]="columnasConceptoMovimiento"
      />
    </div>
  `,
  styles: [
    `
      .fnz-contenido {
        margin-top: 1rem;
      }
    `,
  ],
})
export class FinancieroComponent {
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
