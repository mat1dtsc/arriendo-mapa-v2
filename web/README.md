# 🗺️ web/ — versión desplegable (mapa + copiloto, sin backend)

Sitio 100% estático. `index.html` usa **MapLibre GL** (mapa vectorial oscuro, píldoras de precio,
capa de inundación como mapa de calor). `index-clasico.html` es el respaldo con Leaflet raster
para navegadores sin WebGL. Los datos van en `datos.js` (136 avisos + 154 puntos críticos + GTFS).

## Desplegar en Vercel
1. vercel.com/new → importar el repo `arriendo-mapa-v2`
2. **Root Directory: `web`**
3. Framework Preset: **Other** · sin build command · Output directory: dejar vacío
4. Deploy

Ver en local: abrir `index.html` con doble clic (requiere internet para los tiles del mapa).
