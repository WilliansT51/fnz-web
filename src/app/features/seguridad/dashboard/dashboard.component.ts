import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { Subscription, interval } from 'rxjs';

import { DashboardService, ResumenDashboard, TiempoReal } from './dashboard.service';

const AZUL = '#2f5c9e';
const ROJO = '#c0392b';
const VERDE = '#2e7d5b';
const AMBAR = '#a76e18';
const GRIS = '#8b95a3';

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe, ChartModule, TagModule, ButtonModule],
  template: `
    <header class="fnz-toolbar-tabla">
      <div>
        <h1 class="fnz-titulo-pagina">Dashboard de seguridad</h1>
        <p class="fnz-subtitulo">
          Actualizado {{ resumen()?.generado_en | date: 'HH:mm:ss' }} · tiempo real cada 15 s
        </p>
      </div>
      <p-button label="Actualizar" icon="pi pi-refresh" [text]="true" size="small" (onClick)="cargarTodo()" />
    </header>

    @if (resumen(); as r) {
      <div class="tiles">
        <div class="tile"><span class="n">{{ tiempo()?.en_linea ?? r.sesiones.en_linea }}</span><span class="l">En línea ahora</span></div>
        <div class="tile"><span class="n">{{ r.sesiones.activas }}</span><span class="l">Sesiones activas</span></div>
        <div class="tile"><span class="n">{{ r.usuarios.activos }}</span><span class="l">Usuarios activos</span></div>
        <div class="tile alerta" [class.rojo]="r.usuarios.bloqueados > 0">
          <span class="n">{{ r.usuarios.bloqueados }}</span><span class="l">Usuarios bloqueados</span>
        </div>
        <div class="tile" [class.rojo]="r.intentos_hoy.fallidos >= 10">
          <span class="n">{{ r.intentos_hoy.fallidos }}</span><span class="l">Fallos de login hoy</span>
        </div>
        <div class="tile"><span class="n">{{ r.usuarios.con_mfa }}</span><span class="l">Con 2FA</span></div>
      </div>

      <div class="alertas">
        @for (a of r.alertas; track a.texto) {
          <div class="fila-alerta" [class]="'nivel-' + a.nivel">
            <i [class]="iconoAlerta(a.nivel)"></i>
            <span>{{ a.texto }}</span>
          </div>
        }
      </div>

      <div class="grid-charts">
        <div class="panel fnz-tarjeta">
          <h3>Accesos y fallos (14 días)</h3>
          <p-chart type="line" [data]="serieAccesos()" [options]="$any(opcionesLinea)" height="220px" />
        </div>
        <div class="panel fnz-tarjeta">
          <h3>Usuarios por estado</h3>
          <p-chart type="doughnut" [data]="donutUsuarios()" [options]="$any(opcionesDonut)" height="220px" />
        </div>
      </div>

      <div class="grid-2">
        <div class="panel fnz-tarjeta">
          <h3>IPs con más intentos fallidos (7 días)</h3>
          @if (r.top_ips_fallidas.length) {
            <ul class="lista-ip">
              @for (ip of r.top_ips_fallidas; track ip.ip) {
                <li><code>{{ ip.ip }}</code><span class="barra" [style.width.%]="pct(ip.total, r.top_ips_fallidas[0].total)"></span><strong>{{ ip.total }}</strong></li>
              }
            </ul>
          } @else {
            <p class="vacio">Sin intentos fallidos recientes.</p>
          }
        </div>

        <div class="panel fnz-tarjeta">
          <h3>Conectados ahora ({{ tiempo()?.conectados?.length ?? 0 }})</h3>
          @if (tiempo()?.conectados?.length) {
            <ul class="lista-conectados">
              @for (c of tiempo()!.conectados; track c.ip + c.desde) {
                <li>
                  <span class="punto"></span>
                  <span class="cu">{{ c.usuario }}</span>
                  <span class="cd">{{ c.dispositivo }} · {{ c.ip }}</span>
                </li>
              }
            </ul>
          } @else {
            <p class="vacio">Nadie conectado en este momento.</p>
          }
        </div>
      </div>

      <div class="panel fnz-tarjeta">
        <h3>Últimos eventos de acceso</h3>
        <ul class="lista-eventos">
          @for (e of tiempo()?.ultimos_eventos ?? []; track e.fecha) {
            <li>
              <p-tag [value]="e.evento" [severity]="sevEvento(e.evento)" />
              <span>{{ e.usuario || '—' }}</span>
              <span class="ip">{{ e.ip }}</span>
              <span class="fe">{{ e.fecha | date: 'dd/MM HH:mm:ss' }}</span>
            </li>
          }
        </ul>
      </div>
    } @else {
      <p class="vacio">Cargando métricas…</p>
    }
  `,
  styles: [
    `
      .tiles {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 0.75rem;
        margin-bottom: 1rem;
      }
      .tile {
        background: #fff;
        border: 1px solid var(--fnz-borde);
        border-radius: 10px;
        padding: 0.8rem 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
      }
      .tile.rojo {
        border-color: #e3b7b1;
        background: #fdf3f1;
      }
      .tile .n {
        font-size: 1.6rem;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      .tile .l {
        font-size: 0.72rem;
        color: var(--fnz-tinta-suave);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .alertas {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        margin-bottom: 1rem;
      }
      .fila-alerta {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.6rem 0.9rem;
        border-radius: 8px;
        font-size: 0.88rem;
        border: 1px solid var(--fnz-borde);
      }
      .nivel-ok { color: #2e7d5b; background: #eef7f1; border-color: #cfe6d8; }
      .nivel-info { color: #2f5c9e; background: #eef3fb; border-color: #d3e0f2; }
      .nivel-warn { color: #a76e18; background: #fbf3e6; border-color: #ecdcbf; }
      .nivel-crit { color: #c0392b; background: #fdf0ee; border-color: #eccfca; }
      .grid-charts {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 1rem;
        margin-bottom: 1rem;
      }
      .grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        margin-bottom: 1rem;
      }
      .panel {
        padding: 1rem 1.25rem;
      }
      .panel h3 {
        margin: 0 0 0.75rem;
        font-size: 0.95rem;
      }
      .lista-ip {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .lista-ip li {
        display: grid;
        grid-template-columns: 8rem 1fr auto;
        align-items: center;
        gap: 0.75rem;
        font-size: 0.85rem;
      }
      .lista-ip .barra {
        height: 8px;
        background: #c0392b;
        border-radius: 4px;
        min-width: 4px;
      }
      .lista-conectados {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        font-size: 0.85rem;
      }
      .lista-conectados li {
        display: grid;
        grid-template-columns: 12px 1fr;
        grid-template-rows: auto auto;
        column-gap: 0.6rem;
        align-items: center;
      }
      .lista-conectados .punto {
        grid-row: 1 / 3;
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: #2e7d5b;
      }
      .lista-conectados .cd {
        color: var(--fnz-tinta-suave);
        font-size: 0.78rem;
      }
      .lista-eventos {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        font-size: 0.85rem;
      }
      .lista-eventos li {
        display: grid;
        grid-template-columns: 9rem 1fr 8rem 8rem;
        align-items: center;
        gap: 0.5rem;
      }
      .lista-eventos .ip,
      .lista-eventos .fe {
        color: var(--fnz-tinta-suave);
        font-size: 0.78rem;
      }
      .vacio {
        color: var(--fnz-tinta-suave);
        font-size: 0.88rem;
      }
      @media (max-width: 1100px) {
        .tiles { grid-template-columns: repeat(3, 1fr); }
        .grid-charts, .grid-2 { grid-template-columns: 1fr; }
      }
    `,
  ],
})
export class DashboardComponent implements OnDestroy {
  private readonly api = inject(DashboardService);

  readonly resumen = signal<ResumenDashboard | null>(null);
  readonly tiempo = signal<TiempoReal | null>(null);
  private readonly sub: Subscription;

  readonly opcionesLinea = {
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } },
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    maintainAspectRatio: false,
  } as Record<string, unknown>;
  readonly opcionesDonut = {
    plugins: { legend: { position: 'right', labels: { boxWidth: 12 } } },
    maintainAspectRatio: false,
  } as Record<string, unknown>;

  readonly serieAccesos = computed(() => {
    const r = this.resumen();
    if (!r) return { labels: [], datasets: [] };
    const labels = r.accesos_por_dia.map((p) => p.dia.slice(5));
    return {
      labels,
      datasets: [
        {
          label: 'Accesos',
          data: r.accesos_por_dia.map((p) => p.total),
          borderColor: AZUL,
          backgroundColor: 'rgba(47,92,158,0.12)',
          tension: 0.3,
          fill: true,
        },
        {
          label: 'Fallos',
          data: r.fallos_por_dia.map((p) => p.total),
          borderColor: ROJO,
          backgroundColor: 'rgba(192,57,43,0.10)',
          tension: 0.3,
          fill: true,
        },
      ],
    };
  });

  readonly donutUsuarios = computed(() => {
    const u = this.resumen()?.usuarios;
    if (!u) return { labels: [], datasets: [] };
    return {
      labels: ['Activos', 'Pendientes', 'Bloqueados', 'Inactivos'],
      datasets: [
        {
          data: [u.activos, u.pendientes, u.bloqueados, u.inactivos],
          backgroundColor: [VERDE, AMBAR, ROJO, GRIS],
        },
      ],
    };
  });

  constructor() {
    this.cargarTodo();
    this.sub = interval(15000).subscribe(() => this.cargarTiempoReal());
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  cargarTodo(): void {
    this.api.resumen().subscribe((r) => this.resumen.set(r));
    this.cargarTiempoReal();
  }

  private cargarTiempoReal(): void {
    this.api.tiempoReal().subscribe((t) => this.tiempo.set(t));
  }

  pct(v: number, max: number): number {
    return max ? Math.max(4, Math.round((v / max) * 100)) : 0;
  }

  iconoAlerta(nivel: string): string {
    return nivel === 'crit'
      ? 'pi pi-exclamation-triangle'
      : nivel === 'warn'
        ? 'pi pi-exclamation-circle'
        : nivel === 'ok'
          ? 'pi pi-check-circle'
          : 'pi pi-info-circle';
  }

  sevEvento(e: string): 'success' | 'danger' | 'warn' | 'secondary' {
    return e === 'login_exitoso'
      ? 'success'
      : e === 'login_fallido' || e === 'bloqueo_usuario' || e === 'cierre_sesion_forzado'
        ? 'danger'
        : 'secondary';
  }
}
