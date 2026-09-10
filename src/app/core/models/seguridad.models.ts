export type EstadoUsuario = 'activo' | 'inactivo' | 'bloqueado' | 'pendiente';

export interface RolResumen {
  id: number;
  nombre: string;
  descripcion?: string | null;
}

export interface Usuario {
  id: number;
  nombre: string;
  apellido: string;
  nombre_completo: string;
  correo: string;
  usuario: string;
  estado: EstadoUsuario;
  debe_cambiar_password: boolean;
  mfa_habilitado: boolean;
  mfa_tipo: 'totp' | 'correo' | null;
  intentos_fallidos?: number;
  bloqueado_hasta?: string | null;
  ultimo_acceso?: string | null;
  fecha_creacion?: string | null;
  fecha_modificacion?: string | null;
  roles?: RolResumen[];
  permisos?: string[];
}

export interface SesionActual {
  id: string;
  iniciada_en: string | null;
  expira_en: string | null;
  ip: string;
  navegador: string | null;
}

export interface RespuestaLogin {
  token_type: 'Bearer';
  access_token: string;
  refresh_token: string;
  expires_in: number;
  sesion_id: string;
  forzar_cambio: boolean;
  usuario: Usuario;
}

export interface DesafioMfa {
  mfa_requerido: true;
  mfa_tipo: 'totp' | 'correo';
  mfa_token: string;
  recordar: boolean;
}

export interface RespuestaMe {
  usuario: Usuario;
  forzar_cambio: boolean;
  sesion: SesionActual | null;
}

export interface Paginado<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface FiltroUsuarios {
  q?: string;
  estado?: EstadoUsuario;
  rol?: number;
  con_eliminados?: boolean;
  orden?: string;
  direccion?: 'asc' | 'desc';
  por_pagina?: number;
  page?: number;
}

export interface CatalogosUsuarios {
  roles: RolResumen[];
  estados: { valor: EstadoUsuario; etiqueta: string }[];
}
