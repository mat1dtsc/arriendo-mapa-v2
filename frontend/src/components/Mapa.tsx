import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { AccionMapa, CasaCompacta } from '../api';

const RC: Record<string, string> = { bajo: '#4FE39B', atento: '#3ED8F0', medio: '#FFC857', alto: '#FF6B5B' };
const K = (n: number) => '$' + Math.round(n / 1000) + 'k';
const fc = (features: any[]) => ({ type: 'FeatureCollection', features } as any);

interface Props {
  casas: CasaCompacta[];
  capas: any;
  idsVisibles: number[] | null;
  seleccion: number | null;
  orden: { seq: number; accion: AccionMapa } | null;
  onSeleccion: (id: number) => void;
  onListo: () => void;
}

export default function Mapa({ casas, capas, idsVisibles, seleccion, orden, onSeleccion, onListo }: Props) {
  const cont = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const pins = useRef<Map<number, maplibregl.Marker>>(new Map());
  const els = useRef<Map<number, HTMLDivElement>>(new Map());
  const listo = useRef(false);
  const anim = useRef<number | null>(null);
  const cbSel = useRef(onSeleccion);
  cbSel.current = onSeleccion;
  const cbListo = useRef(onListo);
  cbListo.current = onListo;

  useEffect(() => {
    if (!cont.current || map.current) return;
    const m = new maplibregl.Map({
      container: cont.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [-70.62, -33.54], zoom: 10.6, pitch: 35, bearing: -12,
      maxZoom: 17.5, minZoom: 9, attributionControl: { compact: true },
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');
    m.on('load', () => {
      listo.current = true;
      cbListo.current();
      m.easeTo({ pitch: 42, bearing: -18, duration: 2600 });
    });
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      // StrictMode monta/desmonta dos veces: sin esto los marcadores quedan
      // registrados contra un mapa ya destruido y nunca se vuelven a crear.
      pins.current.clear();
      els.current.clear();
      listo.current = false;
      if (anim.current) { clearInterval(anim.current); anim.current = null; }
    };
    // deps vacías a propósito: el mapa se crea una sola vez.
    // Los callbacks van por ref para no recrearlo en cada render de App.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || !capas || !listo.current || m.getSource('flood')) return;
    // ── Calles que se anegan: tramos reales de OSM, animados como agua ──
    const COLOR_CAUSA: Record<string, string> = {
      cauce: '#2F86D6', colector: '#9B8CFF', quebrada: '#C9834F', anegamiento: '#3ED8F0',
    };
    m.addSource('calles', { type: 'geojson', data: fc((capas.calles || []).map((t: any) => ({
      type: 'Feature',
      properties: { g: t.g, color: COLOR_CAUSA[t.g] || '#3ED8F0', sector: t.s, comuna: t.k, calle: t.n },
      geometry: { type: 'LineString', coordinates: t.c },
    }))) });
    // halo ancho difuso = "la calle se llena de agua"
    m.addLayer({ id: 'calles-glow', type: 'line', source: 'calles', minzoom: 10.5,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ['get', 'color'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 8, 16, 30],
        'line-blur': ['interpolate', ['linear'], ['zoom'], 11, 6, 16, 18],
        'line-opacity': 0.45 } } as any);
    // cuerpo del agua
    m.addLayer({ id: 'calles-body', type: 'line', source: 'calles', minzoom: 10.5,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ['get', 'color'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2.5, 16, 11],
        'line-opacity': 0.9 } } as any);
    // corriente animada
    m.addLayer({ id: 'calles-flow', type: 'line', source: 'calles', minzoom: 11.5,
      layout: { 'line-cap': 'butt' },
      paint: { 'line-color': '#EAFBFF',
        'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1, 16, 4],
        'line-opacity': 0.65, 'line-dasharray': [0, 4, 3] } } as any);

    m.on('click', 'calles-body', (e: any) => {
      const p = e.features[0].properties;
      new maplibregl.Popup({ closeButton: false, offset: 8 }).setLngLat(e.lngLat)
        .setHTML('<div style="font:600 11.5px Archivo,sans-serif;color:#0b1620">💧 <b>' +
          (p.calle || 'Calle sin nombre') + '</b><br>Se anega: ' + p.sector +
          '<br><span style="opacity:.6">' + p.comuna + ' · fuente GORE RM</span></div>').addTo(m);
    });
    m.on('mouseenter', 'calles-body', () => { m.getCanvas().style.cursor = 'pointer'; });
    m.on('mouseleave', 'calles-body', () => { m.getCanvas().style.cursor = ''; });

    // ── Reportes vecinales: mismo fenómeno, otra evidencia → otro estilo ──
    m.addSource('reportes', { type: 'geojson', data: fc((capas.reportes || []).map((t: any) => ({
      type: 'Feature',
      properties: { sector: t.s, comuna: t.k, calle: t.n, conf: t.conf ?? 1 },
      geometry: { type: 'LineString', coordinates: t.c },
    }))) });
    m.addLayer({ id: 'rep-glow', type: 'line', source: 'reportes', minzoom: 10.5,
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': '#FFC857',
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 7, 16, 26],
        'line-blur': ['interpolate', ['linear'], ['zoom'], 11, 6, 16, 16],
        'line-opacity': 0.35 } } as any);
    m.addLayer({ id: 'rep-body', type: 'line', source: 'reportes', minzoom: 10.5,
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': '#FFD98A',
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2.2, 16, 9],
        'line-opacity': 0.9, 'line-dasharray': [2.5, 1.5] } } as any);
    m.on('click', 'rep-body', (e: any) => {
      const p = e.features[0].properties;
      new maplibregl.Popup({ closeButton: false, offset: 8 }).setLngLat(e.lngLat)
        .setHTML('<div style="font:600 11.5px Archivo,sans-serif;color:#0b1620">💧 <b>' + (p.calle || '') +
          '</b><br>' + p.sector + '<br><span style="opacity:.6">' + p.comuna +
          ' · reporte vecinal · ' + p.conf + ' confirmación(es)</span></div>').addTo(m);
    });
    m.on('mouseenter', 'rep-body', () => { m.getCanvas().style.cursor = 'pointer'; });
    m.on('mouseleave', 'rep-body', () => { m.getCanvas().style.cursor = ''; });

    m.addSource('flood', { type: 'geojson', data: fc((capas.pc || []).map((p: any) => ({
      type: 'Feature', properties: { causa: p.causa, sector: p.sector, comuna: p.comuna },
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] } }))) });
    m.addLayer({ id: 'flood-heat', type: 'heatmap', source: 'flood', maxzoom: 15, paint: {
      'heatmap-weight': 0.9,
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 9, 0.7, 15, 2.4],
      'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
        0, 'rgba(0,40,60,0)', 0.2, 'rgba(20,120,180,.35)', 0.45, 'rgba(62,180,240,.5)',
        0.7, 'rgba(120,200,255,.6)', 1, 'rgba(200,240,255,.75)'],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 9, 18, 15, 55],
      'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.8, 13, 0.25, 14.5, 0] } } as any);
    m.addLayer({ id: 'flood-pt', type: 'circle', source: 'flood', minzoom: 12.5, paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 12.5, 2, 16, 4],
      'circle-color': '#8FE4FF', 'circle-blur': 0.25,
      'circle-opacity': ['interpolate', ['linear'], ['zoom'], 11.5, 0.35, 14, 0.95],
      'circle-stroke-width': 1, 'circle-stroke-color': 'rgba(160,230,255,.4)' } } as any);

    const cf: any[] = [];
    Object.entries(capas.canales || {}).forEach(([n, segs]: [string, any]) =>
      segs.forEach((s: any) => { if (s.length > 1) cf.push({ type: 'Feature', properties: { name: n },
        geometry: { type: 'LineString', coordinates: s.map((v: number[]) => [v[1], v[0]]) } }); }));
    m.addSource('canal', { type: 'geojson', data: fc(cf) });
    m.addLayer({ id: 'canal-glow', type: 'line', source: 'canal',
      paint: { 'line-color': '#3ED8F0', 'line-width': 7, 'line-blur': 6, 'line-opacity': 0.3 } });
    m.addLayer({ id: 'canal', type: 'line', source: 'canal',
      paint: { 'line-color': '#7FE9FA', 'line-width': 1.6, 'line-opacity': 0.75, 'line-dasharray': [3, 2] } });

    const mf: any[] = [];
    (capas.lineas || []).forEach((l: any) => l.tramos.forEach((t: any) => {
      if (t.length > 1) mf.push({ type: 'Feature', properties: { c: l.color },
        geometry: { type: 'LineString', coordinates: t.map((v: number[]) => [v[1], v[0]]) } }); }));
    m.addSource('metro', { type: 'geojson', data: fc(mf) });
    m.addLayer({ id: 'metro', type: 'line', source: 'metro',
      paint: { 'line-color': ['get', 'c'], 'line-width': 2.2, 'line-opacity': 0.55 } as any });
    m.addSource('mest', { type: 'geojson', data: fc((capas.metro || []).map((e: any) => ({
      type: 'Feature', properties: { n: e.name }, geometry: { type: 'Point', coordinates: [e.lon, e.lat] } }))) });
    m.addLayer({ id: 'mest', type: 'circle', source: 'mest', minzoom: 11, paint: {
      'circle-radius': 3, 'circle-color': '#0E1620', 'circle-stroke-width': 1.4, 'circle-stroke-color': '#B9AEFF' } });
    m.addSource('stops', { type: 'geojson', data: fc((capas.paraderos || []).map((p: any) => ({
      type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [p.lon, p.lat] } }))) });
    m.addLayer({ id: 'stops', type: 'circle', source: 'stops', minzoom: 12.5, layout: { visibility: 'none' },
      paint: { 'circle-radius': 1.8, 'circle-color': '#FFC857', 'circle-opacity': 0.6 } });

    m.on('click', 'flood-pt', (e: any) => {
      const p = e.features[0].properties;
      new maplibregl.Popup({ closeButton: false, offset: 10 }).setLngLat(e.lngLat)
        .setHTML('<div style="font:600 11.5px Archivo,sans-serif;color:#0b1620"><b>' + p.sector + '</b><br>' + p.causa + '<br><span style="opacity:.6">' + p.comuna + '</span></div>')
        .addTo(m);
    });
    m.on('mouseenter', 'flood-pt', () => { m.getCanvas().style.cursor = 'pointer'; });
    m.on('mouseleave', 'flood-pt', () => { m.getCanvas().style.cursor = ''; });

    // corriente: dasharray animado = sensación de agua bajando por la calle
    const SEQ: number[][] = [
      [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1],
      [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5],
      [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5],
    ];
    let paso = 0;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!reduce) {
      anim.current = window.setInterval(() => {
        paso = (paso + 1) % SEQ.length;
        if (m.getLayer('calles-flow')) m.setPaintProperty('calles-flow', 'line-dasharray', SEQ[paso]);
      }, 90);
    }
  }, [capas]);

  useEffect(() => {
    const m = map.current;
    if (!m || !casas.length) return;
    casas.forEach((c) => {
      if (pins.current.has(c.id)) return;
      const el = document.createElement('div');
      el.className = 'pin';
      el.innerHTML = '<div class="pill"><span class="dot" style="background:' + RC[c.riesgo] + ';color:' + RC[c.riesgo] + '"></span>' + K(c.precio) + '</div>';
      el.onclick = (ev) => { ev.stopPropagation(); cbSel.current(c.id); };
      pins.current.set(c.id, new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([c.lon, c.lat]).addTo(m));
      els.current.set(c.id, el);
    });
  }, [casas]);

  useEffect(() => {
    const set = idsVisibles ? new Set(idsVisibles) : null;
    els.current.forEach((el, id) => {
      el.classList.toggle('dim', !!set && !set.has(id));
      el.classList.toggle('sel', id === seleccion);
    });
  }, [idsVisibles, seleccion, casas]);

  // refresco de reportes tras crear uno nuevo
  useEffect(() => {
    const m = map.current;
    if (!m || !capas) return;
    const src: any = m.getSource('reportes');
    if (src?.setData) {
      src.setData(fc((capas.reportes || []).map((t: any) => ({
        type: 'Feature',
        properties: { sector: t.s, comuna: t.k, calle: t.n, conf: t.conf ?? 1 },
        geometry: { type: 'LineString', coordinates: t.c },
      }))) as any);
    }
  }, [capas]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    (window as any).__toggleCapa = (capa: string, on: boolean) => {
      const ids: Record<string, string[]> = {
        flood: ['calles-glow', 'calles-body', 'calles-flow', 'flood-heat', 'flood-pt', 'canal', 'canal-glow'],
        reportes: ['rep-glow', 'rep-body'],
        metro: ['metro', 'mest'], stops: ['stops'],
      };
      (ids[capa] || []).forEach((i) => { if (m.getLayer(i)) m.setLayoutProperty(i, 'visibility', on ? 'visible' : 'none'); });
    };
  }, [capas]);

  useEffect(() => {
    const m = map.current;
    if (!m || !orden) return;
    const a = orden.accion;
    if ((a.tipo === 'volar' || a.tipo === 'centrar') && a.lat != null) {
      m.flyTo({ center: [a.lon as number, a.lat], zoom: a.zoom ?? 14, pitch: 48, duration: 1200, essential: true });
    }
    if (a.tipo === 'filtrar' && a.ids?.length) {
      const sel = casas.filter((c) => (a.ids as number[]).includes(c.id));
      if (sel.length) {
        const b = new maplibregl.LngLatBounds();
        sel.forEach((c) => b.extend([c.lon, c.lat]));
        m.fitBounds(b, { padding: { top: 130, bottom: 190, left: 90, right: 90 }, maxZoom: 14.5, duration: 1400 });
      }
    }
  }, [orden, casas]);

  return <div id="mapa" ref={cont} />;
}
