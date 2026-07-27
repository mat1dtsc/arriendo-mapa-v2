#!/usr/bin/env python3
"""
Ingesta de avisos reales desde la API oficial de Mercado Libre / Portal Inmobiliario.

Resuelve de raíz los tres problemas del dataset scrapeado:
  · fotos: cada aviso trae las suyas (pictures del item)
  · enlace: permalink directo a la publicación
  · volumen: paginado en vez de 136 avisos congelados

Uso:
    python scripts/ingesta.py --descubrir      # muestra los filtros disponibles
    python scripts/ingesta.py --limite 300     # ingesta y regenera data/datos.json
    python scripts/ingesta.py --limite 300 --seco   # no escribe, solo reporta

Requiere en backend/.env:
    MELI_CLIENT_ID=...
    MELI_CLIENT_SECRET=...
Se obtienen creando una app en https://developers.mercadolibre.cl

Solo librería estándar: no necesita pip install.
"""
import argparse, csv, io, json, math, os, re, sys, time, unicodedata, urllib.error, urllib.parse, urllib.request, zipfile
from collections import defaultdict

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(RAIZ, 'data')
API = 'https://api.mercadolibre.com'
SITIO = 'MLC'              # Chile
CAT_INMUEBLES = 'MLC1459'  # Inmuebles
GTFS_URL = 'https://www.dtpm.cl/descargas/gtfs/GTFS_20260704.zip'
UA = {'User-Agent': 'ArriendoMapaChile/2.0 (github.com/mat1dtsc/arriendo-mapa-v2)'}


# ─────────────────────────── utilidades ───────────────────────────
def env(clave):
    for ruta in (os.path.join(RAIZ, '.env'), os.path.join(RAIZ, '..', '.env')):
        if os.path.exists(ruta):
            for linea in open(ruta, encoding='utf-8-sig'):
                if linea.strip().startswith(clave + '='):
                    return linea.split('=', 1)[1].strip()
    return os.environ.get(clave)


def pedir(url, token=None, metodo='GET', datos=None, reintentos=3):
    for i in range(reintentos):
        try:
            cab = dict(UA)
            if token:
                cab['Authorization'] = 'Bearer ' + token
            cuerpo = None
            if datos is not None:
                cuerpo = urllib.parse.urlencode(datos).encode()
                cab['Content-Type'] = 'application/x-www-form-urlencoded'
            req = urllib.request.Request(url, data=cuerpo, headers=cab, method=metodo)
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            detalle = e.read().decode()[:200]
            if e.code in (429, 500, 502, 503) and i < reintentos - 1:
                time.sleep(2 + i * 3)
                continue
            raise SystemExit(f'✗ HTTP {e.code} en {url[:70]}\n  {detalle}')
        except Exception as e:
            if i < reintentos - 1:
                time.sleep(2)
                continue
            raise SystemExit(f'✗ {type(e).__name__}: {e}')


def hav(a, b):
    la1, lo1, la2, lo2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 6371000 * 2 * math.asin(math.sqrt(h))


def dist_a_segmento(plat, plon, alat, alon, blat, blon):
    """Distancia aproximada punto→segmento en metros (plano local)."""
    k = math.cos(math.radians(plat))
    px, py = plon * k, plat
    ax, ay = alon * k, alat
    bx, by = blon * k, blat
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay) * 111320
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy)) * 111320


# ─────────────────────────── Mercado Libre ───────────────────────────
def token_app():
    cid, sec = env('MELI_CLIENT_ID'), env('MELI_CLIENT_SECRET')
    if not cid or not sec:
        raise SystemExit(
            '✗ Faltan credenciales.\n'
            '  1. Entra a https://developers.mercadolibre.cl y crea una aplicación\n'
            '  2. Copia Client ID y Client Secret\n'
            '  3. Agrégalos en backend/.env como:\n'
            '       MELI_CLIENT_ID=...\n'
            '       MELI_CLIENT_SECRET=...')
    d = pedir(f'{API}/oauth/token', metodo='POST',
              datos={'grant_type': 'client_credentials', 'client_id': cid, 'client_secret': sec})
    print(f'✓ token obtenido (expira en {d.get("expires_in", "?")} s)')
    return d['access_token']


def descubrir(token):
    """Muestra los filtros que ofrece la categoría, para afinar la búsqueda."""
    d = pedir(f'{API}/sites/{SITIO}/search?category={CAT_INMUEBLES}&limit=1', token)
    print(f'\ntotal de inmuebles en {SITIO}: {d.get("paging", {}).get("total")}\n')
    for f in d.get('available_filters', []):
        if f['id'] in ('OPERATION', 'PROPERTY_TYPE', 'state', 'city'):
            print(f'» {f["id"]} ({f["name"]})')
            for v in f.get('values', [])[:12]:
                print(f'    {v["id"]:<22} {v["name"]}  ({v.get("results", "?")})')
            print()


def buscar(token, limite, filtros):
    """Pagina la búsqueda y devuelve los ítems crudos."""
    items, offset = [], 0
    while len(items) < limite:
        q = {'category': CAT_INMUEBLES, 'limit': 50, 'offset': offset}
        q.update(filtros)
        url = f'{API}/sites/{SITIO}/search?' + urllib.parse.urlencode(q)
        d = pedir(url, token)
        lote = d.get('results', [])
        if not lote:
            break
        items.extend(lote)
        total = d.get('paging', {}).get('total', 0)
        print(f'  descargados {len(items)} de {total}')
        offset += 50
        if offset >= min(total, 1000):  # ML corta el paginado en 1000
            break
        time.sleep(0.4)
    return items[:limite]


def detalles(token, ids):
    """Multiget: trae fotos y atributos completos (hasta 20 por llamada)."""
    salida = {}
    for i in range(0, len(ids), 20):
        lote = ids[i:i + 20]
        url = f'{API}/items?ids=' + ','.join(lote) + '&attributes=id,pictures,attributes,permalink,location,seller_address'
        for fila in pedir(url, token):
            if fila.get('code') == 200:
                salida[fila['body']['id']] = fila['body']
        time.sleep(0.3)
    return salida


def attr(item, *nombres):
    for a in item.get('attributes', []):
        if a.get('id') in nombres:
            v = a.get('value_name') or a.get('value_struct', {}).get('number')
            if v not in (None, ''):
                return v
    return None


def num(v):
    if v is None:
        return None
    m = re.search(r'\d+', str(v).replace('.', ''))
    return int(m.group()) if m else None


# ─────────────────────────── enriquecimiento ───────────────────────────
def cargar_gtfs():
    """Índice paradero→recorridos y recorrido→frecuencia en punta."""
    zip_local = os.path.join(DATA, 'gtfs.zip')
    if not os.path.exists(zip_local):
        print('  bajando GTFS de Red Movilidad (~11 MB)…')
        req = urllib.request.Request(GTFS_URL, headers=UA)
        with urllib.request.urlopen(req, timeout=180) as r, open(zip_local, 'wb') as f:
            f.write(r.read())
    z = zipfile.ZipFile(zip_local)

    def leer(nombre):
        with z.open(nombre) as f:
            return list(csv.DictReader(io.TextIOWrapper(f, 'utf-8-sig')))

    stops = [s for s in leer('stops.txt') if s.get('stop_lat') and s.get('location_type') != '1']
    rutas = {r['route_id']: r['route_short_name'] for r in leer('routes.txt')}
    trips = {t['trip_id']: t['route_id'] for t in leer('trips.txt')}
    st_rutas = defaultdict(set)
    for st in leer('stop_times.txt'):
        rid = trips.get(st['trip_id'])
        if rid:
            st_rutas[st['stop_id']].add(rutas.get(rid, rid))
    headway = {}
    for f in leer('frequencies.txt'):
        h = int(f['start_time'][:2])
        if 7 <= h < 9:
            rid = trips.get(f['trip_id'])
            if rid:
                v = int(f['headway_secs'])
                headway[rutas.get(rid, rid)] = min(headway.get(rutas.get(rid, rid), v), v)
    paraderos = [{'lat': float(s['stop_lat']), 'lon': float(s['stop_lon']),
                  'r': sorted(st_rutas.get(s['stop_id'], []))} for s in stops]
    print(f'  GTFS: {len(paraderos)} paraderos, {len(headway)} recorridos con frecuencia')
    return paraderos, headway


def enriquecer(casa, paraderos, headway, metro, tramos):
    lat, lon = casa['lat'], casa['lon']
    # locomoción
    cerca = [p for p in paraderos if abs(p['lat'] - lat) < 0.006 and abs(p['lon'] - lon) < 0.007]
    dentro, rutas = [], set()
    for p in cerca:
        d = hav((lat, lon), (p['lat'], p['lon']))
        if d <= 500:
            dentro.append(d)
            rutas.update(p['r'])
    bph = sum(3600 / headway[r] for r in rutas if r in headway)
    dm, est = min(((hav((lat, lon), (m['lat'], m['lon'])), m['name']) for m in metro), default=(None, None))
    casa['t'] = {'paraderos_500': len(dentro), 'paradero_min_m': int(min(dentro)) if dentro else None,
                 'recorridos': sorted(rutas)[:14], 'n_recorridos': len(rutas),
                 'buses_hora_punta': round(bph), 'metro_est': est,
                 'metro_m': int(dm) if dm is not None else None}
    # riesgo por cercanía a tramo inundable
    mejor = 1e12; ref = None
    for t in tramos:
        c = t['c']
        for (x1, y1), (x2, y2) in zip(c, c[1:]):
            d = dist_a_segmento(lat, lon, y1, x1, y2, x2)
            if d < mejor:
                mejor, ref = d, t
    nivel = 'bajo'
    if mejor <= 150: nivel = 'alto'
    elif mejor <= 350: nivel = 'medio'
    elif mejor <= 700: nivel = 'atento'
    casa['r'] = {'nivel': nivel, 'calle_m': int(mejor) if ref else None,
                 'calle_nombre': (ref or {}).get('n'), 'calle_sector': (ref or {}).get('s'),
                 'pc_m': int(mejor) if ref else None,
                 'pc_sector': (ref or {}).get('s', 'sin dato'),
                 'pc_causa': 'Anegamiento de calles', 'pc_aprox': True,
                 'canal': None, 'canal_m': None}
    return casa


# ─────────────────────────── principal ───────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--descubrir', action='store_true', help='listar filtros disponibles y salir')
    ap.add_argument('--limite', type=int, default=200)
    ap.add_argument('--operacion', default='242073', help='id del filtro OPERATION (arriendo)')
    ap.add_argument('--estado', default='', help='id del filtro state (RM)')
    ap.add_argument('--seco', action='store_true', help='no escribir datos.json')
    a = ap.parse_args()

    tk = token_app()
    if a.descubrir:
        descubrir(tk)
        return

    filtros = {}
    if a.operacion: filtros['OPERATION'] = a.operacion
    if a.estado: filtros['state'] = a.estado
    print(f'» buscando arriendos en {SITIO} (hasta {a.limite})')
    crudos = buscar(tk, a.limite, filtros)
    if not crudos:
        raise SystemExit('✗ sin resultados: revisa los filtros con --descubrir')

    print(f'» trayendo fotos y atributos de {len(crudos)} avisos')
    det = detalles(tk, [i['id'] for i in crudos])

    base = json.load(open(os.path.join(DATA, 'datos.json'), encoding='utf-8'))
    tramos = base.get('calles_inundadas', [])
    metro = base.get('metro', [])
    print('» preparando índices de locomoción')
    paraderos, headway = cargar_gtfs()

    casas, sin_geo, fuera_rm = [], 0, 0
    for it in crudos:
        d = det.get(it['id'], {})
        loc = d.get('location') or it.get('location') or {}
        lat = loc.get('latitude'); lon = loc.get('longitude')
        if lat is None or lon is None:
            sin_geo += 1
            continue
        comuna = (loc.get('city') or {}).get('name') or ''
        region = (loc.get('state') or {}).get('name') or ''
        if 'etropolitana' not in region:
            fuera_rm += 1
            continue
        fotos = [p['secure_url'] for p in (d.get('pictures') or [])[:3]]
        casa = {
            'id': it['id'],
            'precio': int(it.get('price') or 0),
            'moneda': it.get('currency_id'),
            'dorm': num(attr(d, 'BEDROOMS', 'ROOMS')) or 0,
            'banos': num(attr(d, 'FULL_BATHROOMS', 'BATHROOMS')) or 0,
            'm2': num(attr(d, 'COVERED_AREA', 'TOTAL_AREA')) or 0,
            'tipo': (attr(d, 'PROPERTY_TYPE') or 'Casa').lower(),
            'sector': (loc.get('address_line') or it.get('title', ''))[:70],
            'comuna': comuna,
            'corr': 'Portal Inmobiliario',
            'nota': it.get('title', '')[:140],
            'estado': 'publicado',
            'lat': float(lat), 'lon': float(lon),
            'link': d.get('permalink') or it.get('permalink'),
            'link_directo': True,
            'fotos': fotos,
            'foto_verificada': bool(fotos),
            'amen': {'estac': bool(num(attr(d, 'PARKING_LOTS'))), 'mascotas': False,
                     'piscina': False, 'condominio': False},
        }
        casas.append(enriquecer(casa, paraderos, headway, metro, tramos))

    # precio por m² y desviación contra la mediana comunal
    por_comuna = defaultdict(list)
    for c in casas:
        if c['m2']:
            c['pxm'] = round(c['precio'] / c['m2'])
            por_comuna[c['comuna']].append(c['pxm'])
    med = {k: sorted(v)[len(v) // 2] for k, v in por_comuna.items() if v}
    for c in casas:
        m = med.get(c['comuna'])
        c['dev'] = round(100 * (c['pxm'] - m) / m) if (c.get('pxm') and m) else None

    from collections import Counter
    print(f'\n✓ {len(casas)} avisos válidos  (sin geo: {sin_geo} · fuera de la RM: {fuera_rm})')
    print(f'  con foto propia : {sum(1 for c in casas if c["fotos"])}')
    print(f'  con link directo: {sum(1 for c in casas if c["link_directo"])}')
    print(f'  comunas         : {len(med)}')
    print(f'  riesgo          : {dict(Counter(c["r"]["nivel"] for c in casas))}')

    if a.seco:
        print('\n(modo seco: no se escribió datos.json)')
        print(json.dumps(casas[0], ensure_ascii=False, indent=1)[:700])
        return

    base['casas'] = casas
    base['meta']['medianas_pxm'] = med
    base['meta']['fuente_avisos'] = f'API oficial Mercado Libre / Portal Inmobiliario · {time.strftime("%d-%b-%Y")}'
    salida = os.path.join(DATA, 'datos.json')
    json.dump(base, open(salida, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f'\n✓ escrito {salida} ({os.path.getsize(salida) // 1024} KB)')
    print('  reinicia el backend para que lo tome.')


if __name__ == '__main__':
    main()
