import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { RecuperacionService } from './recuperacion.service';

@Component({
  selector: 'app-olvide-password',
  imports: [ReactiveFormsModule, RouterLink, InputTextModule, ButtonModule, MessageModule],
  template: `
    <div class="pantalla">
      <div class="tarjeta">
        <div class="marca">
          <i class="pi pi-envelope"></i>
          <h1>Recuperar contraseña</h1>
          <p>Escribe tu correo y te enviaremos un enlace para elegir una nueva contraseña.</p>
        </div>

        @if (enviado()) {
          <p-message severity="success" styleClass="w-full">
            Si el correo corresponde a una cuenta activa, recibirás las instrucciones en unos minutos.
            Revisa también la carpeta de spam.
          </p-message>
          <a routerLink="/ingresar" class="volver">Volver a ingresar</a>
        } @else {
          <form [formGroup]="form" (ngSubmit)="enviar()">
            <label>
              <span>Correo</span>
              <input pInputText type="email" formControlName="correo" autocomplete="email" fluid />
            </label>
            <p-button
              type="submit"
              label="Enviar enlace"
              [loading]="cargando()"
              [disabled]="form.invalid || cargando()"
              styleClass="w-full"
            />
            <a routerLink="/ingresar" class="volver">Volver a ingresar</a>
          </form>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .pantalla {
        min-height: 100dvh;
        display: grid;
        place-items: center;
        padding: 1.5rem;
      }
      .tarjeta {
        width: 100%;
        max-width: 380px;
        background: #fff;
        border: 1px solid var(--fnz-borde);
        border-radius: 14px;
        padding: 2rem;
        box-shadow: 0 10px 40px rgba(27, 33, 48, 0.08);
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .marca i {
        font-size: 1.5rem;
        color: #2f5c9e;
      }
      .marca h1 {
        font-size: 1.15rem;
        margin: 0.5rem 0 0.25rem;
      }
      .marca p {
        margin: 0;
        color: var(--fnz-tinta-suave);
        font-size: 0.85rem;
      }
      form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      label {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        font-size: 0.85rem;
        font-weight: 500;
      }
      .volver {
        text-align: center;
        font-size: 0.85rem;
        color: #2f5c9e;
        text-decoration: none;
      }
      :host ::ng-deep .w-full {
        width: 100%;
      }
    `,
  ],
})
export class OlvidePasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(RecuperacionService);

  readonly cargando = signal(false);
  readonly enviado = signal(false);

  readonly form = this.fb.nonNullable.group({
    correo: ['', [Validators.required, Validators.email]],
  });

  enviar(): void {
    if (this.form.invalid) return;
    this.cargando.set(true);
    this.api.solicitar(this.form.getRawValue().correo).subscribe({
      next: () => {
        this.cargando.set(false);
        this.enviado.set(true);
      },
      error: () => {
        // Aun ante error mostramos el mismo mensaje neutro (anti-enumeración).
        this.cargando.set(false);
        this.enviado.set(true);
      },
    });
  }
}
