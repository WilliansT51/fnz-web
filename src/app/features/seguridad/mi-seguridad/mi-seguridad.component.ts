import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { TagModule } from 'primeng/tag';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import QRCode from 'qrcode';

import { AuthService } from '../../../core/auth/auth.service';
import { EstadoMfa, MfaService } from './mfa.service';

@Component({
  selector: 'app-mi-seguridad',
  imports: [FormsModule, ButtonModule, InputTextModule, PasswordModule, TagModule, MessageModule],
  template: `
    <header class="fnz-toolbar-tabla">
      <div>
        <h1 class="fnz-titulo-pagina">Mi seguridad</h1>
        <p class="fnz-subtitulo">Segundo factor de autenticación (2FA)</p>
      </div>
    </header>

    <div class="tarjeta fnz-tarjeta">
      <div class="fila-estado">
        <div>
          <h3>Verificación en dos pasos</h3>
          <p>
            Añade un código de un solo uso al iniciar sesión. Reduce el riesgo si alguien
            obtiene tu contraseña.
          </p>
        </div>
        @if (estado()?.habilitado) {
          <p-tag
            [value]="estado()!.tipo === 'totp' ? 'Activo · app' : 'Activo · correo'"
            severity="success"
          />
        } @else {
          <p-tag value="Inactivo" severity="secondary" />
        }
      </div>

      @if (estado()?.habilitado) {
        <div class="bloque">
          <p>Para desactivar el segundo factor confirma tu contraseña.</p>
          <div class="linea">
            <p-password [(ngModel)]="passwordDesactivar" [feedback]="false" [toggleMask]="true" placeholder="Contraseña" />
            <p-button label="Desactivar 2FA" severity="danger" [outlined]="true" (onClick)="desactivar()" [loading]="ocupado()" />
          </div>
        </div>
      } @else if (paso() === 'inicio') {
        <div class="opciones">
          <button class="opcion" type="button" (click)="empezarTotp()">
            <i class="pi pi-qrcode"></i>
            <strong>Aplicación de autenticación</strong>
            <span>Google Authenticator, Authy, 1Password…</span>
          </button>
          <button class="opcion" type="button" (click)="activarCorreo()">
            <i class="pi pi-envelope"></i>
            <strong>Código por correo</strong>
            <span>Recibes un código de 6 dígitos al ingresar</span>
          </button>
        </div>
      } @else {
        <div class="bloque totp">
          <ol>
            <li>Escanea el código QR con tu app de autenticación.</li>
            <li>Escribe el código de 6 dígitos que muestra la app.</li>
          </ol>
          <div class="qr-zona">
            @if (qr()) { <img [src]="qr()!" alt="Código QR" width="180" height="180" /> }
            <div class="secreto">
              <span>o ingresa la clave manualmente:</span>
              <code>{{ secreto() }}</code>
            </div>
          </div>
          @if (errorTotp()) { <p-message severity="error" styleClass="w-full">{{ errorTotp() }}</p-message> }
          <div class="linea">
            <input pInputText [(ngModel)]="codigo" inputmode="numeric" maxlength="6" placeholder="000000" />
            <p-button label="Activar" (onClick)="confirmarTotp()" [loading]="ocupado()" [disabled]="codigo.length < 6" />
            <p-button label="Cancelar" [text]="true" (onClick)="paso.set('inicio')" />
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .tarjeta {
        padding: 1.5rem;
        max-width: 620px;
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }
      .fila-estado {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: start;
      }
      h3 {
        margin: 0 0 0.25rem;
        font-size: 1rem;
      }
      p {
        margin: 0;
        color: var(--fnz-tinta-suave);
        font-size: 0.88rem;
        max-width: 46ch;
      }
      .bloque {
        border-top: 1px solid var(--fnz-borde);
        padding-top: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .opciones {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
        border-top: 1px solid var(--fnz-borde);
        padding-top: 1.25rem;
      }
      .opcion {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        text-align: left;
        padding: 1rem;
        border: 1px solid var(--fnz-borde);
        border-radius: 10px;
        background: #fff;
        cursor: pointer;
      }
      .opcion:hover {
        border-color: #2f5c9e;
        background: #f5f8fd;
      }
      .opcion i {
        font-size: 1.3rem;
        color: #2f5c9e;
      }
      .opcion span {
        font-size: 0.8rem;
        color: var(--fnz-tinta-suave);
      }
      .totp ol {
        margin: 0;
        padding-left: 1.1rem;
        font-size: 0.88rem;
        color: var(--fnz-tinta-suave);
      }
      .qr-zona {
        display: flex;
        gap: 1.25rem;
        align-items: center;
      }
      .qr-zona img {
        border: 1px solid var(--fnz-borde);
        border-radius: 8px;
      }
      .secreto {
        font-size: 0.8rem;
      }
      .secreto code {
        display: block;
        margin-top: 0.35rem;
        background: var(--fnz-fondo);
        border: 1px solid var(--fnz-borde);
        border-radius: 6px;
        padding: 0.4rem 0.6rem;
        word-break: break-all;
      }
      .linea {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        flex-wrap: wrap;
      }
      .linea input {
        max-width: 8rem;
        letter-spacing: 0.2em;
        text-align: center;
      }
      :host ::ng-deep .w-full {
        width: 100%;
      }
    `,
  ],
})
export class MiSeguridadComponent {
  private readonly api = inject(MfaService);
  private readonly auth = inject(AuthService);
  private readonly mensajes = inject(MessageService);

  readonly estado = signal<EstadoMfa | null>(null);
  readonly paso = signal<'inicio' | 'totp'>('inicio');
  readonly ocupado = signal(false);
  readonly secreto = signal('');
  readonly qr = signal<string | null>(null);
  readonly errorTotp = signal<string | null>(null);

  codigo = '';
  passwordDesactivar = '';

  constructor() {
    this.recargar();
  }

  private recargar(): void {
    this.api.estado().subscribe((e) => this.estado.set(e));
  }

  empezarTotp(): void {
    this.errorTotp.set(null);
    this.api.iniciarTotp().subscribe(async (r) => {
      this.secreto.set(r.secreto);
      this.qr.set(await QRCode.toDataURL(r.uri, { margin: 1, width: 180 }));
      this.paso.set('totp');
    });
  }

  confirmarTotp(): void {
    this.ocupado.set(true);
    this.errorTotp.set(null);
    this.api.confirmarTotp(this.secreto(), this.codigo).subscribe({
      next: (r) => {
        this.ocupado.set(false);
        this.codigo = '';
        this.paso.set('inicio');
        this.mensajes.add({ severity: 'success', summary: r.mensaje });
        this.recargar();
        this.auth.refrescarUsuario();
      },
      error: (e: HttpErrorResponse) => {
        this.ocupado.set(false);
        this.errorTotp.set(
          (Object.values(e.error?.errors ?? {}).flat()[0] as string) ??
            'No se pudo activar. Verifica el código.',
        );
      },
    });
  }

  activarCorreo(): void {
    this.api.activarCorreo().subscribe((r) => {
      this.mensajes.add({ severity: 'success', summary: r.mensaje });
      this.recargar();
      this.auth.refrescarUsuario();
    });
  }

  desactivar(): void {
    this.ocupado.set(true);
    this.api.desactivar(this.passwordDesactivar).subscribe({
      next: (r) => {
        this.ocupado.set(false);
        this.passwordDesactivar = '';
        this.mensajes.add({ severity: 'success', summary: r.mensaje });
        this.recargar();
        this.auth.refrescarUsuario();
      },
      error: (e: HttpErrorResponse) => {
        this.ocupado.set(false);
        this.mensajes.add({
          severity: 'error',
          summary: (Object.values(e.error?.errors ?? {}).flat()[0] as string) ?? 'No se pudo desactivar',
        });
      },
    });
  }
}
