import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../core/auth/auth.service';

function coinciden(grupo: AbstractControl): ValidationErrors | null {
  const a = grupo.get('nueva')?.value;
  const b = grupo.get('confirmacion')?.value;
  return a && b && a !== b ? { noCoincide: true } : null;
}

@Component({
  selector: 'app-cambiar-password',
  imports: [ReactiveFormsModule, PasswordModule, ButtonModule, MessageModule],
  template: `
    <div class="pantalla">
      <form class="tarjeta" [formGroup]="form" (ngSubmit)="enviar()">
        <div class="cabecera">
          <i class="pi pi-key"></i>
          <h1>Cambia tu contraseña</h1>
          <p>
            Por seguridad debes definir una contraseña nueva antes de continuar.
          </p>
        </div>

        @if (errores().length) {
          <p-message severity="error" styleClass="w-full">
            {{ errores().join(' ') }}
          </p-message>
        }

        <label>
          <span>Contraseña actual</span>
          <p-password formControlName="actual" [feedback]="false" [toggleMask]="true" fluid />
        </label>
        <label>
          <span>Nueva contraseña</span>
          <p-password formControlName="nueva" [toggleMask]="true" fluid />
        </label>
        <label>
          <span>Confirmar nueva contraseña</span>
          <p-password
            formControlName="confirmacion"
            [feedback]="false"
            [toggleMask]="true"
            fluid
          />
        </label>
        @if (form.errors?.['noCoincide'] && form.get('confirmacion')?.touched) {
          <small class="err">Las contraseñas no coinciden.</small>
        }

        <p-button
          type="submit"
          label="Guardar y continuar"
          [loading]="cargando()"
          [disabled]="form.invalid || cargando()"
          styleClass="w-full"
        />
      </form>
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
        max-width: 420px;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        background: #fff;
        border: 1px solid var(--fnz-borde);
        border-radius: 14px;
        padding: 2rem;
        box-shadow: 0 10px 40px rgba(27, 33, 48, 0.08);
      }
      .cabecera i {
        font-size: 1.5rem;
        color: #2f5c9e;
      }
      .cabecera h1 {
        font-size: 1.15rem;
        margin: 0.5rem 0 0.25rem;
      }
      .cabecera p {
        margin: 0;
        color: var(--fnz-tinta-suave);
        font-size: 0.85rem;
      }
      label {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        font-size: 0.85rem;
        font-weight: 500;
      }
      .err {
        color: #c0392b;
      }
      :host ::ng-deep .w-full {
        width: 100%;
      }
    `,
  ],
})
export class CambiarPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly mensajes = inject(MessageService);

  readonly cargando = signal(false);
  readonly errores = signal<string[]>([]);

  readonly form = this.fb.nonNullable.group(
    {
      actual: ['', Validators.required],
      nueva: ['', [Validators.required, Validators.minLength(10)]],
      confirmacion: ['', Validators.required],
    },
    { validators: coinciden },
  );

  enviar(): void {
    if (this.form.invalid) return;
    this.errores.set([]);
    this.cargando.set(true);

    const { actual, nueva } = this.form.getRawValue();

    this.auth.cambiarPassword(actual, nueva).subscribe({
      next: () => {
        this.cargando.set(false);
        this.mensajes.add({
          severity: 'success',
          summary: 'Contraseña actualizada',
          detail: 'Se cerraron tus otras sesiones.',
        });
        this.auth.refrescarUsuario();
        this.router.navigateByUrl('/');
      },
      error: (e: HttpErrorResponse) => {
        this.cargando.set(false);
        if (e.status === 422) {
          const errs = e.error?.errors ?? {};
          const lista = Object.values(errs).flat() as string[];
          this.errores.set(lista.length ? lista : [e.error?.mensaje ?? 'Datos inválidos.']);
        } else {
          this.errores.set(['No se pudo cambiar la contraseña.']);
        }
      },
    });
  }
}
