export interface OpcionMenu {
  nombre: string;
  icono: string | null;
  permiso: string;
}

export interface NodoMenu {
  id: number;
  nombre: string;
  ruta: string | null;
  icono: string | null;
  hijos: NodoMenu[];
  opciones: OpcionMenu[];
}

export interface RespuestaMenu {
  menu: NodoMenu[];
  permisos: string[];
}
