# 🗺️ web/ — versión desplegable (mapa + copiloto, sin backend)

Sitio 100% estático. `index.html` usa **MapLibre GL** (mapa vectorial oscuro, píldoras de precio,
capa de inundación como mapa de calor). `index-clasico.html` es el respaldo con Leaflet raster
para navegadores sin WebGL. Los datos van en `datos.js` (136 avisos + 154 puntos críticos + GTFS).

## Desplegar en Vercel
1. vercel.com/new → importar el repo `arriendo-mapa-v2`
2. **Root Directory: `web`**
3. Framework Preset: **Other** · sin build command · Output directory: dejar vacío
4. Deploy

## Ver en local (servidor propio)
- **Windows**: doble clic en `INICIAR.bat`
- **Mac/Linux**: `./iniciar.sh` o `python3 servidor.py`
- **XAMPP**: copiar esta carpeta a `C:\xampp\htdocs\arriendomapa` y abrir `http://localhost/arriendomapa/`

El servidor busca un puerto libre (8000, 8080, 8888…), abre el navegador solo y no necesita instalar dependencias.
También sirve abrir `index.html` con doble clic, pero por servidor es más fiable.
