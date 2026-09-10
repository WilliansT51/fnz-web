import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideClientHydration } from '@angular/platform-browser';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { providePrimeNG } from 'primeng/config';
import { ConfirmationService, MessageService } from 'primeng/api';
import Aura from '@primeuix/themes/aura';

import { routes } from './app.routes';
import { tokenInterceptor } from './core/auth/token.interceptor';
import { errorInterceptor } from './core/auth/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideClientHydration(),
    provideHttpClient(
      withFetch(),
      withInterceptors([tokenInterceptor, errorInterceptor]),
    ),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: { darkModeSelector: '.modo-oscuro' },
      },
      translation: {
        emptyMessage: 'Sin resultados',
        emptyFilterMessage: 'Sin coincidencias',
      },
    }),
    MessageService,
    ConfirmationService,
  ],
};
