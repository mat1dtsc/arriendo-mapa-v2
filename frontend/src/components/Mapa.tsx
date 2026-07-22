import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { AccionMapa, CasaCompacta } from '../api';

const COLOR_RIESGO: Record<string, string> = { alto: '#FF5D4D', medio: '#FFC53D', atento: '#6EA8C9', bajo: '#3FD68F' };
const colorCausa = (c: string) => {
  const t = c.toLowerCase();
  if (t.includes('cauce')) return '#2F86D6';
  if (t.includes('colector')) return '#8F7BF0';
  if (t.includes('quebrada') || t.includes('aluvi')) return '#C9834F';
  return '#41C6E0';
};

interface Props {
  casas: CasaCompacta[];
  idsVisibles: number[] | null;   // null = todas
  capas: any;                     // pc, canales, metro, lineas
  orden: { seq: number; accion: AccionMapa } | null;  // acciones que manda el chat
  onSeleccion: (id: number) => void;
}

export default function Mapa({ casas, idsVisibles, capas, orden, onSeleccion }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const marcadoresRef = useRef<L.LayerGroup | null>(null);
  const capaInundRef = useRef<L.LayerGroup | null>(null);

  // init una sola vez
  useEffect(() => {
    const map = L.map('mapa', { zoomControl: false }).setView([-33.55, -70.6], 12);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap · CARTO · GORE RM · DTPM', maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    marcadoresRef.current = L.layerGroup().addTo(map);
    capaInundRef.current = L.layerGroup().addTo(map);
    return () => { map.remove(); };
  }, []);

  // capa inundación + metro cuando llegan los datos
  useEffect(() => {
    const g = capaInundRef.current;
    if (!g || !capas) return;
    g.clearLayers();
    Object.entries(capas.canales || {}).forEach(([nom, segs]: [string, any]) => {
      segs.forEach((seg: any) => {
        if (seg.length > 1) L.polyline(seg, { color: '#41C6E0', weight: 3, opacity: 0.85, className: 'canal-anim' }).bindTooltip(nom, { sticky: true }).addTo(g);
      });
    });
    (capas.pc || []).forEach((p: any) => {
      const color = colorCausa(p.causa);
      const ic = L.divIcon({ className: '', iconSize: [16, 16], html: `<div class="pulso" style="--co:${color}66"><i style="background:${color}"></i></div>` });
      L.marker([p.lat, p.lon], { icon: ic }).bindPopup(`<b>${p.sector}</b><br>${p.causa}<br><small>${p.comuna} · Fuente: ${capas.meta?.fuente_pc ?? ''}</small>`).addTo(g);
    });
    (capas.lineas || []).forEach((l: any) => l.tramos.forEach((tr: any) => {
      if (tr.length > 1) L.polyline(tr, { color: l.color, weight: 2.5, opacity: 0.7 }).addTo(g);
    }));
    (capas.metro || []).forEach((m: any) => {
      L.circleMarker([m.lat, m.lon], { radius: 3.5, color: '#fff', weight: 1.5, fillColor: '#111', fillOpacity: 1 }).bindTooltip(m.name).addTo(g);
    });
  }, [capas]);

  // marcadores de casas según filtro del chat
  useEffect(() => {
    const g = marcadoresRef.current;
    if (!g) return;
    g.clearLayers();
    const setIds = idsVisibles ? new Set(idsVisibles) : null;
    casas.filter((c) => !setIds || setIds.has(c.id)).forEach((c) => {
      L.circleMarker([c.lat, c.lon], { radius: 7, color: '#0B1620', weight: 2, fillColor: COLOR_RIESGO[c.riesgo], fillOpacity: 0.95 })
        .bindTooltip(`$${c.precio.toLocaleString('es-CL')} · ${c.dorm}D · 💧${c.riesgo}`)
        .on('click', () => onSeleccion(c.id))
        .addTo(g);
    });
  }, [casas, idsVisibles, onSeleccion]);

  // acciones que manda el asistente
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !orden) return;
    const a = orden.accion;
    if (a.tipo === 'volar' && a.lat != null) map.flyTo([a.lat, a.lon!], a.zoom ?? 16, { duration: 0.9 });
    if (a.tipo === 'centrar' && a.lat != null) map.flyTo([a.lat, a.lon!], a.zoom ?? 13, { duration: 0.9 });
    if (a.tipo === 'filtrar' && a.ids?.length) {
      const seleccion = casas.filter((c) => a.ids!.includes(c.id));
      if (seleccion.length) {
        const b = L.latLngBounds(seleccion.map((c) => [c.lat, c.lon] as [number, number]));
        map.flyToBounds(b.pad(0.2), { duration: 0.9 });
      }
    }
  }, [orden]);

  return <div id="mapa" />;
}
