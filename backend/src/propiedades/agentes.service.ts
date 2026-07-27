import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { FiltrosBusqueda, PropiedadesService } from './propiedades.service';

export interface Agente {
  id: string;
  nombre: string;
  contacto: { email?: string; telefono?: string };
  filtros: FiltrosBusqueda;
  aviso: 'inmediato' | 'diario' | 'semanal';
  creado: string;
  ultima_revision: string | null;
  vistos: (number | string)[];
  novedades: number;
  activo: boolean;
}

const RX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Agentes de búsqueda del usuario: guardan sus criterios y avisan cuando
 * aparece algo que calza. Persistencia en JSON (F2: pasa a Supabase con auth).
 */
@Injectable()
export class AgentesService {
  private readonly logger = new Logger(AgentesService.name);
  private readonly ruta = join(process.cwd(), 'data', 'agentes.json');
  private agentes: Agente[] = [];

  constructor(private readonly propiedades: PropiedadesService) {
    if (existsSync(this.ruta)) {
      try {
        const crudo = readFileSync(this.ruta, 'utf8').replace(/^\uFEFF/, '').trim();
        const d = crudo ? JSON.parse(crudo) : [];
        this.agentes = Array.isArray(d) ? d : [d];
      } catch (e) {
        this.logger.warn(`agentes.json ilegible: ${String(e).slice(0, 70)}`);
      }
    }
  }

  private guardar() {
    try {
      writeFileSync(this.ruta, JSON.stringify(this.agentes, null, 1));
    } catch (e) {
      this.logger.warn(`no pude guardar agentes: ${e}`);
    }
  }

  /** Normaliza el teléfono chileno a +569XXXXXXXX cuando se puede */
  private telefono(t?: string) {
    if (!t) return undefined;
    const d = t.replace(/\D/g, '');
    if (d.length === 8) return '+569' + d;
    if (d.length === 9 && d.startsWith('9')) return '+56' + d;
    if (d.length === 11 && d.startsWith('569')) return '+' + d;
    return t.trim();
  }

  listar() {
    return this.agentes.map((a) => ({ ...a, vistos: a.vistos.length }));
  }

  crear(input: {
    nombre?: string; email?: string; telefono?: string;
    filtros?: FiltrosBusqueda; aviso?: Agente['aviso'];
  }) {
    const email = (input.email || '').trim().toLowerCase();
    if (email && !RX_EMAIL.test(email)) {
      return { ok: false, error: 'Ese correo no parece válido' };
    }
    if (!email && !input.telefono) {
      return { ok: false, error: 'Déjame un correo o un teléfono para poder avisarte' };
    }

    const filtros = input.filtros ?? {};
    const calzan = this.propiedades.buscar(filtros);

    const agente: Agente = {
      id: 'ag_' + Date.now().toString(36),
      nombre: (input.nombre || this.describir(filtros)).slice(0, 60),
      contacto: { email: email || undefined, telefono: this.telefono(input.telefono) },
      filtros,
      aviso: input.aviso ?? 'diario',
      creado: new Date().toISOString(),
      ultima_revision: new Date().toISOString(),
      vistos: calzan.casas.map((c) => c.id),
      novedades: 0,
      activo: true,
    };
    this.agentes.push(agente);
    this.guardar();
    this.logger.log(`agente creado: ${agente.nombre} (${calzan.total} calzan hoy)`);
    return {
      ok: true,
      agente: { ...agente, vistos: agente.vistos.length },
      calzan_hoy: calzan.total,
      muestra: calzan.casas.slice(0, 3),
      mensaje: `Tu agente "${agente.nombre}" quedó activo. Hoy calzan ${calzan.total} propiedades; te aviso cuando aparezca algo nuevo.`,
    };
  }

  /** Corre el agente y reporta lo que apareció desde la última revisión */
  revisar(id: string) {
    const a = this.agentes.find((x) => x.id === id);
    if (!a) return { ok: false, error: 'No existe ese agente' };
    const r = this.propiedades.buscar(a.filtros);
    const vistos = new Set(a.vistos);
    const nuevas = r.casas.filter((c) => !vistos.has(c.id));
    a.vistos = r.casas.map((c) => c.id);
    a.ultima_revision = new Date().toISOString();
    a.novedades += nuevas.length;
    this.guardar();
    return {
      ok: true, agente: a.nombre, total_calzan: r.total,
      nuevas: nuevas.length, propiedades: nuevas.slice(0, 10),
      avisar_a: a.contacto,
    };
  }

  revisarTodos() {
    return this.agentes.filter((a) => a.activo).map((a) => this.revisar(a.id));
  }

  eliminar(id: string) {
    const n = this.agentes.length;
    this.agentes = this.agentes.filter((a) => a.id !== id);
    this.guardar();
    return { ok: this.agentes.length < n };
  }

  private describir(f: FiltrosBusqueda) {
    const p: string[] = [];
    if (f.tipo && f.tipo !== 'todos') p.push(f.tipo);
    if (f.dormitorios_min) p.push(`${f.dormitorios_min}+ dorm`);
    if (f.comuna) p.push(`en ${f.comuna}`);
    if (f.precio_max) p.push(`hasta $${Math.round(f.precio_max / 1000)}k`);
    if (f.riesgo_maximo === 'bajo') p.push('sin riesgo de inundación');
    if (f.locomocion_min) p.push('bien conectada');
    return p.join(' · ') || 'Toda la Región Metropolitana';
  }
}
