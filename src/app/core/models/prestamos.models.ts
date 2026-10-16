import { Paginado } from './seguridad.models';

export type { Paginado };

export type EstadoPrestamo = 'PENDIENTE' | 'ACTIVO' | 'PAGADO' | 'RECHAZADO';

/** Cuota mensual de un préstamo (parte de su tabla de pagos). */
export interface PrestamoCuota {
  id: number;
  prestamo_id: number;
  numero: number;
  fecha_vencimiento: string;
  monto: string;
  monto_pagado: string;
  estado: 'PENDIENTE' | 'PARCIAL' | 'PAGADA';
}

/** Porción de un pago aplicada a una cuota. */
export interface PrestamoPagoAplicacion {
  id: number;
  cuota_id: number;
  monto: string;
  cuota?: { id: number; numero: number };
}

/** Documento adjunto (p. ej. la boleta del depósito de un pago). */
export interface DocumentoAdjunto {
  id: number;
  nombre_original: string;
  mime: string | null;
  tamano: number;
}

/** Pago o abono a un préstamo (aplicado o anulado). */
export interface PrestamoPago {
  id: number;
  prestamo_id: number;
  fecha_pago: string;
  monto: string;
  referencia: string | null;
  observaciones: string | null;
  estado: 'APLICADO' | 'ANULADO';
  motivo_anulacion: string | null;
  aplicaciones?: PrestamoPagoAplicacion[];
  documentos?: DocumentoAdjunto[];
  creador?: { id: number; nombre: string; correo: string };
}

/** Préstamo a una iglesia o a un ministro (sin intereses, cuotas mensuales). */
export interface Prestamo {
  id: number;
  codigo: string;
  iglesia_id: number | null;
  ministro_id: number | null;
  monto: string;
  plazo_meses: number;
  fecha_desembolso: string;
  fecha_primera_cuota: string;
  observaciones: string | null;
  estado: EstadoPrestamo;
  total_pagado: string;
  saldo_pendiente: string;
  creado_por: number;
  aprobador_id: number | null;
  comentario_resolucion: string | null;
  corregido_por: number | null;
  motivo_correccion: string | null;
  fecha_correccion: string | null;
  iglesia?: { id: number; nombre: string; clave: string } | null;
  ministro?: { id: number; nombre: string; apellido: string } | null;
  creador?: { id: number; nombre: string; correo: string };
  aprobador?: { id: number; nombre: string; correo: string } | null;
  cuotas?: PrestamoCuota[];
  pagos?: PrestamoPago[];
}

/** Datos del formulario de un préstamo nuevo. */
export interface PrestamoNuevo {
  iglesia_id: number | null;
  ministro_id: number | null;
  monto: number;
  plazo_meses: number;
  fecha_desembolso: string;
  fecha_primera_cuota: string;
  observaciones?: string;
}

/** Datos del formulario de un pago. */
export interface PagoNuevo {
  fecha_pago: string;
  monto: number;
  referencia?: string;
  observaciones?: string;
  /** Boleta del depósito (opcional). */
  archivo?: File | null;
}
