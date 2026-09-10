import {
  Directive,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
  input,
} from '@angular/core';
import { AuthService } from './auth.service';

/**
 * Estructural: muestra el contenido solo si el usuario tiene alguno de los
 * permisos indicados.
 *
 *   <button *appTienePermiso="'usuarios.crear'">Nuevo</button>
 *   <div *appTienePermiso="['usuarios.editar','usuarios.eliminar']"> ... </div>
 */
@Directive({ selector: '[appTienePermiso]' })
export class TienePermisoDirective {
  private readonly tpl = inject(TemplateRef<unknown>);
  private readonly vcr = inject(ViewContainerRef);
  private readonly auth = inject(AuthService);

  readonly appTienePermiso = input.required<string | string[]>();

  private visible = false;

  constructor() {
    effect(() => {
      const codigos = ([] as string[]).concat(this.appTienePermiso());
      const permitido = this.auth.tienePermiso(...codigos);
      if (permitido && !this.visible) {
        this.vcr.createEmbeddedView(this.tpl);
        this.visible = true;
      } else if (!permitido && this.visible) {
        this.vcr.clear();
        this.visible = false;
      }
    });
  }
}
