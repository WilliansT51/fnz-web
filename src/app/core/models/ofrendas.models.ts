import { Paginado } from './seguridad.models';

export type { Paginado };

/** Tipos de campo soportados por el formulario dinámico de un catálogo genérico. */
export type TipoCampo = 'texto' | 'numero' | 'select' | 'checkbox' | 'fecha' | 'textarea';

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
  telefono: string | null;
  celular: string | null;
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
