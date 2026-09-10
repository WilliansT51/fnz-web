import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageModule } from 'primeng/message';
import { AuthService } from '../../core/auth/auth.service';
import { DesafioMfa } from '../../core/models/seguridad.models';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    CheckboxModule,
    MessageModule,
  ],
  template: `
    <div class="pantalla">
      <form class="tarjeta" [formGroup]="form" (ngSubmit)="enviar()">
        <div class="marca">
          <i class="pi pi-shield"></i>
          <div>
            <h1>Sistema FNZ</h1>
           <!-- <p>Sistema FNZ</p> -->
          </div>
        </div>

        @if (error()) {
          <p-message severity="error" styleClass="w-full">{{ error() }}</p-message>
        }

        @if (!desafioMfa()) {
          <label>
            <span>Usuario o correo</span>
            <input pInputText formControlName="usuario" autocomplete="username" fluid />
          </label>

          <label>
            <span>Contraseña</span>
            <p-password
              formControlName="password"
              [feedback]="false"
              [toggleMask]="true"
              autocomplete="current-password"
              fluid
            />
          </label>

          <div class="fila">
            <p-checkbox formControlName="recordar" [binary]="true" inputId="recordar" />
            <label for="recordar">Recordar esta sesión</label>
          </div>
        } @else {
          <p-message severity="info" styleClass="w-full">
            {{
              desafioMfa()!.mfa_tipo === 'totp'
                ? 'Ingresa el código de tu aplicación de autenticación.'
                : 'Enviamos un código a tu correo. Ingrésalo para continuar.'
            }}
          </p-message>
          <label>
            <span>Código de verificación</span>
            <input
              pInputText
              formControlName="codigo"
              inputmode="numeric"
              maxlength="6"
              autocomplete="one-time-code"
              fluid
            />
          </label>
        }

        <p-button
          type="submit"
          [label]="desafioMfa() ? 'Verificar' : 'Ingresar'"
          [loading]="cargando()"
          [disabled]="form.invalid || cargando()"
          styleClass="w-full"
        />

        @if (!desafioMfa()) {
          <a routerLink="/recuperar" class="olvide">¿Olvidaste tu contraseña?</a>
        }
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
        background:
          radial-gradient(1200px 600px at 20% -10%, #e8eef8, transparent),
          var(--fnz-fondo);
      }
      .tarjeta {
        width: 100%;
        max-width: 380px;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        background: #fff;
        border: 1px solid var(--fnz-borde);
        border-radius: 14px;
        padding: 2rem;
        box-shadow: 0 10px 40px rgba(27, 33, 48, 0.08);
      }
      .marca {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .marca i {
        font-size: 1.6rem;
        color: #2f5c9e;
      }
      .marca h1 {
        font-size: 1.15rem;
        margin: 0;
      }
      .marca p {
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
      .fila {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 400;
      }
      :host ::ng-deep .w-full {
        width: 100%;
      }
      .olvide {
        text-align: center;
        font-size: 0.82rem;
        color: #2f5c9e;
        text-decoration: none;
        margin-top: -0.25rem;
      }
    `,
  ],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly desafioMfa = signal<DesafioMfa | null>(null);

  readonly form = this.fb.nonNullable.group({
    usuario: ['', Validators.required],
    password: ['', Validators.required],
    recordar: [false],
    codigo: [''],
  });

  enviar(): void {
    this.error.set(null);
    this.cargando.set(true);

    const v = this.form.getRawValue();
    const reto = this.desafioMfa();

    const peticion = reto
      ? this.auth.verificarMfa(reto.mfa_token, v.codigo, reto.recordar)
      : this.auth.login({ usuario: v.usuario, password: v.password, recordar: v.recordar });

    peticion.subscribe({
      next: (r) => {
        this.cargando.set(false);
        if ('mfa_requerido' in r) {
          this.desafioMfa.set(r);
          this.form.controls.codigo.addValidators([Validators.required, Validators.minLength(6)]);
          this.form.controls.codigo.updateValueAndValidity();
          return;
        }
        this.router.navigateByUrl(r.forzar_cambio ? '/cambiar-password' : '/');
      },
      error: (e: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set(this.mensajeError(e));
      },
    });
  }

  private mensajeError(e: HttpErrorResponse): string {
    if (e.status === 0) return 'No hay conexión con el servidor. Verifica que la API esté encendida.';
    if (e.status === 429) return 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.';
    if (e.status >= 500) return 'El servidor tuvo un problema. Inténtalo más tarde.';

    const motivo = e.error?.motivo;
    const mapa: Record<string, string> = {
      credenciales_invalidas: 'Usuario o contraseña incorrectos.',
      usuario_bloqueado: 'Cuenta bloqueada temporalmente por intentos fallidos.',
      usuario_inactivo: 'La cuenta está inactiva. Contacta al administrador.',
      usuario_pendiente: 'La cuenta está pendiente de activación.',
      mfa_invalido: 'Código de verificación inválido o vencido.',
      captcha_invalido: 'Verificación de seguridad fallida.',
    };
    return mapa[motivo] ?? e.error?.mensaje ?? 'No se pudo iniciar sesión.';
  }
}
