import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * El módulo es una SPA autenticada: no tiene sentido renderizar en el
 * servidor rutas protegidas por sesión. Todo se renderiza en el cliente.
 */
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
