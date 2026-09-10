# FNZ · Cliente del Módulo de Seguridad

Interfaz web del módulo de seguridad del sistema FNZ. Consume la API **fnz-api**
(repo aparte).

- **Angular 21** (standalone, signals, control flow)
- **PrimeNG 21** (última versión con licencia MIT) + tema Aura
- Chart.js para las gráficas del dashboard
- SSR configurado en modo *client render* (SPA autenticada)

## Requisitos

- Node.js **20+** y npm 10+
- La API **fnz-api** corriendo (por defecto en `http://127.0.0.1:8000`)

## Instalación

```bash
git clone https://github.com/TU-USUARIO/fnz-web.git
cd fnz-web
npm install
```

## Configuración

La URL de la API se define en `src/environments/`:

| Archivo | Uso |
|---|---|
| `environment.development.ts` | `ng serve` → `http://127.0.0.1:8000/api` |
| `environment.ts` | build de producción → `/api` (mismo origen tras un proxy) |

Para producción, ajusta `apiUrl` en `environment.ts` o sirve el frontend detrás
del mismo dominio que la API.

## Ejecución (desarrollo)

```bash
npm start          # equivale a: ng serve
```

Abre `http://localhost:4200/`. Recarga en caliente al guardar.

> Asegúrate de tener la API encendida; si no, el login muestra
> *"No hay conexión con el servidor"*.

## Build de producción

```bash
npm run build      # genera dist/ProyectoFNZ/
```

## Pruebas

```bash
npm test           # Vitest
```

## Estructura

```
src/app/
  core/
    auth/          auth.service (signals), token-storage (SSR-safe),
                   token.interceptor (refresh transparente), error.interceptor,
                   auth.guards, menu.service, tiene-permiso.directive
    models/        Interfaces de la API
  features/
    auth/          login, cambiar-password, olvide-password, restablecer-password
    layout/        shell (menú lateral dinámico), sin-permiso
    seguridad/
      usuarios/    Listado + alta/edición
      roles/       Roles + matriz de permisos
      sesiones/    Sesiones activas (polling)
      auditoria/   Bitácora + filtros + export
      dashboard/   Métricas + gráficas + tiempo real
      mi-seguridad/ Enrolamiento 2FA (TOTP con QR)
  app.routes.ts    Rutas con guards (authGuard, permisoGuard, …)
  app.config.ts    HttpClient + interceptores + PrimeNG
```

## Notas

- La autorización es de doble capa: el `permisoGuard` y la directiva
  `*appTienePermiso` ocultan/deshabilitan en el cliente, pero **la decisión real
  la toma la API** (`middleware permiso:*`).
- Los tokens se guardan en `localStorage`; el interceptor renueva el *access
  token* automáticamente ante un `401`.
