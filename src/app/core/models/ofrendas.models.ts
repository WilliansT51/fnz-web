import { Paginado } from './seguridad.models';

export type { Paginado };

/**
 * Tipos de campo soportados por el formulario dinámico de un catálogo
 * genérico. 'digitos' es un texto restringido a solo números mientras se
 * escribe (preserva ceros a la izquierda, a diferencia de 'numero'); útil
 * para teléfono, celular o CUI.
 */
export type TipoCampo = 'texto' | 'numero' | 'digitos' | 'select' | 'checkbox' | 'fecha' | 'textarea';

/** Una opción estática de un `<p-select>` (p. ej. un enum fijo). */
export interface OpcionSelect {
  label: string;
  value: string | number | boolean;
}

/**
 * Describe un campo del formulario de alta/edición de un catálogo genérico
 * ({@see CatalogoTablaComponent}). `opcionesEndpoint` carga un select de
 * forma dinámica desde otro catálogo (p. ej. el select de `distrito_id` en
 * el catálogo de Departamentos).
 */
export interface CampoFormulario {
  nombre: string;
  etiqueta: string;
  tipo: TipoCampo;
  requerido?: boolean;
  opciones?: OpcionSelect[];
  opcionesEndpoint?: string;
  opcionEtiqueta?: string;
  opcionValor?: string;
  ocultarEnAlta?: boolean;
  ancho?: 'completo' | 'medio';
  ayuda?: string;
  /** Solo para tipo 'digitos': longitud EXACTA exigida (p. ej. 13 para un CUI). Sin esto, solo se restringe a dígitos. */
  longitud?: number;
  /** Solo para tipo 'digitos': tope de caracteres mientras se escribe (por defecto, `longitud` o 30). */
  longitudMaxima?: number;
}

/** Describe una columna de la tabla de un catálogo genérico. */
export interface ColumnaTabla {
  campo: string;
  etiqueta: string;
  tipo?: 'texto' | 'booleano' | 'fecha' | 'relacion';
  /** Cuando `tipo` es 'relacion': nombre de la relación cargada (p. ej. "categoria") y su campo a mostrar. */
  relacion?: { objeto: string; campo: string };
}

/** Catálogo de ubicación. */
export interface Pais {
  id: number;
  nombre: string;
  codigo_iso: string | null;
  estado: boolean;
}

export interface Jurisdiccion {
  id: number;
  pais_id: number;
  nombre: string;
  codigo: string | null;
  estado: boolean;
}

export interface Distrito {
  id: number;
  jurisdiccion_id: number;
  numero: number;
  nombre: string;
  estado: boolean;
}

export interface Departamento {
  id: number;
  distrito_id: number;
  nombre: string;
  estado: boolean;
}

export interface Municipio {
  id: number;
  departamento_id: number;
  nombre: string;
  estado: boolean;
}

/** Estructura eclesiástica. */
export interface GradoMinisterial {
  id: number;
  nombre: string;
  orden: number;
  estado: boolean;
}

export interface Ministro {
  id: number;
  grado_ministerial_id: number | null;
  nombre: string;
  apellido: string;
  cui: string | null;
  telefono: string | null;
  celular: string | null;
  numero_dependientes: number | null;
  estado: 'activo' | 'inactivo';
}

export interface Iglesia {
  id: number;
  distrito_id: number;
  municipio_id: number;
  clave: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  fecha_fundacion: string | null;
  estado: 'activa' | 'inactiva';
}

export interface AsignacionMinistro {
  id: number;
  iglesia_id: number;
  ministro_id: number;
  fecha_desde: string;
  fecha_hasta: string | null;
  motivo: string | null;
  activo: boolean;
  ministro?: { id: number; nombre: string; apellido: string };
}

export interface Comisionado {
  id: number;
  iglesia_id: number;
  nombre: string;
  telefono: string | null;
  cargo: string | null;
  estado: 'activo' | 'inactivo';
}

export interface JuntaLocal {
  id: number;
  iglesia_id: number;
  nombre: string;
  presidente: string | null;
  estado: boolean;
}

/** Catálogos financieros. */
export interface Banco {
  id: number;
  nombre: string;
  estado: boolean;
}

export interface CategoriaConcepto {
  id: number;
  nombre: string;
  estado: boolean;
}

export interface TipoGasto {
  id: number;
  nombre: string;
  estado: boolean;
}

export interface CuentaContable {
  id: number;
  codigo: string;
  nombre: string;
  tipo: 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'GASTO';
  naturaleza: 'DEUDORA' | 'ACREEDORA';
  cuenta_padre_id: number | null;
  nivel: number;
  acepta_movimiento: boolean;
  estado: boolean;
}

export interface ConceptoMovimiento {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  tipo: 'INGRESO' | 'EGRESO';
  categoria_concepto_id: number;
  ambito: 'IGLESIA' | 'DISTRITO' | 'JURISDICCION';
  es_nacional: boolean;
  es_especial: boolean;
  aplica_boleta: boolean;
  estado: boolean;
}

export interface ConceptoGasto {
  id: number;
  tipo_gasto_id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  estado: boolean;
}

export interface CuentaBancaria {
  id: number;
  banco_id: number;
  ambito: 'JURISDICCION' | 'DISTRITO' | 'IGLESIA';
  iglesia_id: number | null;
  distrito_id: number | null;
  numero_cuenta: string;
  tipo_cuenta: string | null;
  alias: string | null;
  estado: boolean;
}

/** Boleta interna (§3.5): documento generado por el sistema, numeración correlativa por jurisdicción. */
export interface Boleta {
  id: number;
  jurisdiccion_id: number;
  iglesia_id: number | null;
  numero: number;
  fecha: string;
  estado: 'activa' | 'anulada';
}

/** Línea de detalle de un Informe Financiero Mensual. */
export interface InformeFinancieroLinea {
  id: number;
  informe_id: number;
  concepto_movimiento_id: number;
  boleta_id: number | null;
  monto: string;
  fecha: string | null;
  descripcion: string | null;
  concepto?: ConceptoMovimiento & { categoria?: { id: number; nombre: string } };
  boleta?: Boleta;
}

/** Datos de una línea al enviar el formulario de captura (antes de guardarse). */
export interface LineaInformeNueva {
  concepto_movimiento_id: number;
  monto: number;
  fecha?: string;
  descripcion?: string;
  boleta_agrupador?: string;
}

/** Informe Financiero Mensual de una iglesia. */
export interface InformeFinanciero {
  id: number;
  iglesia_id: number;
  mes: number;
  anio: number;
  estado: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
  total_ingresos_ofrenda: string;
  total_egresos_ofrenda: string;
  total_colectas: string;
  total_necesidades_pastor: string;
  total_general: string;
  cuadra: boolean;
  creado_por: number;
  aprobador_id: number | null;
  fecha_resolucion: string | null;
  comentario_resolucion: string | null;
  created_at: string;
  iglesia?: { id: number; nombre: string; clave: string };
  creador?: { id: number; nombre: string; correo: string };
  aprobador?: { id: number; nombre: string; correo: string } | null;
  lineas?: InformeFinancieroLinea[];
}

/** Bandeja de solicitudes de cambio (maker-checker). */
export interface SolicitudCambio {
  id: number;
  modelo: string;
  modelo_id: number;
  accion: 'EDITAR' | 'ELIMINAR';
  snapshot_antes: Record<string, unknown>;
  snapshot_despues: Record<string, unknown> | null;
  motivo: string;
  solicitante_id: number;
  aprobador_id: number | null;
  estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
  comentario_resolucion: string | null;
  fecha_resolucion: string | null;
  created_at: string;
  solicitante?: { id: number; nombre: string; correo: string };
  aprobador?: { id: number; nombre: string; correo: string } | null;
}
