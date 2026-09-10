import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-sin-permiso',
  imports: [RouterLink, ButtonModule],
  template: `
    <div class="caja">
      <i class="pi pi-lock"></i>
      <h1>Sin permiso</h1>
      <p>No tienes autorización para ver esta sección.</p>
      <p-button label="Volver al inicio" routerLink="/" [outlined]="true" />
    </div>
  `,
  styles: [
    `
      .caja {
        max-width: 420px;
        margin: 4rem auto;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
      }
      i {
        font-size: 2.5rem;
        color: var(--fnz-tinta-suave);
      }
      h1 {
        margin: 0.5rem 0 0;
        font-size: 1.3rem;
      }
      p {
        color: var(--fnz-tinta-suave);
        margin: 0 0 1rem;
      }
    `,
  ],
})
export class SinPermisoComponent {}
