import { Paginado } from './seguridad.models';

export type { Paginado };

export type CategoriaGasto = 'JURISDICCIONAL' | 'DISTRITAL' | 'IGLESIA' | 'MINISTRO';
export type EstadoGasto = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';

/** Tipo de gasto del catálogo administrable (Especial, Medicina, Otros…). */
export interface GastoTipo {
  id: number;
  nombre: string;
  estado: boolean;
}

/** Gasto (egreso) del módulo Control de Gastos. `nombre` lo calcula el backend según la categoría. */
export interface Gasto {
  id: number;
  codigo: string;
  categoria: CategoriaGasto;
  gasto_tipo_id: number;
  jurisdiccion_id: number | null;
  distrito_id: number | null;
  iglesia_id: number | null;
  ministro_id: number | null;
  nombre: string;
  monto: string;
  fecha_egreso: string;
  razon: string;
  estado: EstadoGasto;
  creado_por: number;
  aprobador_id: number | null;
  fecha_resolucion: string | null;
  comentario_resolucion: string | null;
  corregido_por: number | null;
  motivo_correccion: string | null;
  fecha_correccion: string | null;
  tipo?: { id: number; nombre: string };
  creador?: { id: number; nombre: string; apellido: string; correo: string };
  aprobador?: { id: number; nombre: string; apellido: string; correo: string } | null;
}

/** Datos que se envían al crear o editar un gasto. */
export interface GastoNuevo {
  categoria: CategoriaGasto;
  gasto_tipo_id: number;
  jurisdiccion_id: number | null;
  distrito_id: number | null;
  iglesia_id: number | null;
  ministro_id: number | null;
  monto: number;
  fecha_egreso: string;
  razon: string;
}
