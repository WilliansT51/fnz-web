import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { RecuperacionService } from './recuperacion.service';

function coinciden(g: AbstractControl): ValidationErrors | null {
  const a = g.get('password')?.value;
  const b = g.get('confirmacion')?.value;
  return a && b && a !== b ? { noCoincide: true } : null;
}

@Component({
  selector: 'app-restablecer-password',
  imports: [ReactiveFormsModule, RouterLink, PasswordModule, ButtonModule, MessageModule],
  template: `
    <div class="pantalla">
      <div class="tarjeta">
        <div class="marca">
          <i class="pi pi-lock-open"></i>
          <h1>Nueva contraseña</h1>
        </div>

        @if (estado() === 'invalido') {
          <p-message severity="error" styleClass="w-full">
            El enlace no es válido o ya expiró.
          </p-message>
          <a routerLink="/recuperar" class="link">Solicitar uno nuevo</a>
        } @else if (estado() === 'listo') {
          <p-message severity="success" styleClass="w-full">
            Tu contraseña fue restablecida. Ya puedes iniciar sesión.
          </p-message>
          <a routerLink="/ingresar" class="link">Ir a ingresar</a>
        } @else {
          <p class="sub">Cuenta: <strong>{{ correo() }}</strong></p>
          @if (errores().length) {
            <p-message severity="error" styleClass="w-full">{{ errores().join(' ') }}</p-message>
          }
          <form [formGroup]="form" (ngSubmit)="enviar()">
            <label>
              <span>Nueva contraseña</span>
              <p-password formControlName="password" [toggleMask]="true" fluid />
            </label>
            <label>
              <span>Confirmar contraseña</span>
              <p-password formControlName="confirmacion" [feedback]="false" [toggleMask]="true" fluid />
            </label>
            @if (form.errors?.['noCoincide'] && form.get('confirmacion')?.touched) {
              <small class="err">Las contraseñas no coinciden.</small>
            }
            <p-button
              type="submit"
              label="Restablecer"
              [loading]="cargando()"
              [disabled]="form.invalid || cargando()"
              styleClass="w-full"
            />
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
        max-width: 400px;
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
        margin: 0.5rem 0 0;
      }
      .sub {
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
      .err {
        color: #c0392b;
      }
      .link {
        text-align: center;
        color: #2f5c9e;
        text-decoration: none;
        font-size: 0.85rem;
      }
      :host ::ng-deep .w-full {
        width: 100%;
      }
    `,
  ],
})
export class RestablecerPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(RecuperacionService);
  private readonly ruta = inject(ActivatedRoute);

  private readonly qp = this.ruta.snapshot.queryParamMap;
  readonly correo = signal(this.qp.get('correo') ?? '');
  private readonly token = signal(this.qp.get('token') ?? '');

  readonly estado = signal<'verificando' | 'form' | 'invalido' | 'listo'>('verificando');
  readonly cargando = signal(false);
  readonly errores = signal<string[]>([]);

  readonly form = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(10)]],
      confirmacion: ['', Validators.required],
    },
    { validators: coinciden },
  );

  constructor() {
    // Valida el token una vez que los query params están disponibles.
    queueMicrotask(() => {
      if (!this.correo() || !this.token()) {
        this.estado.set('invalido');
        return;
      }
      this.api.validar(this.correo(), this.token()).subscribe({
        next: (r) => this.estado.set(r.valido ? 'form' : 'invalido'),
        error: () => this.estado.set('invalido'),
      });
    });
  }

  enviar(): void {
    if (this.form.invalid) return;
    this.cargando.set(true);
    this.errores.set([]);

    this.api
      .confirmar(this.correo(), this.token(), this.form.getRawValue().password)
      .subscribe({
        next: () => {
          this.cargando.set(false);
          this.estado.set('listo');
        },
        error: (e: HttpErrorResponse) => {
          this.cargando.set(false);
          if (e.error?.motivo === 'token_invalido') {
            this.estado.set('invalido');
          } else if (e.status === 422) {
            this.errores.set(Object.values(e.error?.errors ?? {}).flat() as string[]);
          } else {
            this.errores.set(['No se pudo restablecer la contraseña.']);
          }
        },
      });
  }
}
