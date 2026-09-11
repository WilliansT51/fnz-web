/**
 * Formatea un `Date` como "YYYY-MM-DD" usando sus componentes LOCALES
 * (no `toISOString()`, que convierte a UTC y puede correr la fecha un día
 * hacia atrás o adelante según el huso horario del navegador).
 */
export function fechaLocalAIso(fecha: Date): string {
  const año = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
}

/**
 * Parsea un "YYYY-MM-DD" del backend como fecha LOCAL a medianoche (no
 * `new Date(iso)`, que interpreta un string solo-fecha como UTC y puede
 * mostrar un día antes en husos horarios negativos).
 */
export function isoAFechaLocal(iso: string): Date {
  const [año, mes, dia] = iso.slice(0, 10).split('-').map(Number);
  return new Date(año, mes - 1, dia);
}
