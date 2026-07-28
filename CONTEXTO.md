# ArriendoMapa — contexto y estado del proyecto

> Léeme primero. Este archivo explica qué es el proyecto, cómo correrlo, qué está
> hecho, qué quedó a medias y cuál es el siguiente paso. Escrito el 28-jul-2026.

---

## Qué es

Plataforma de arriendos para Santiago con el **mapa como portada** y un **agente de IA**
conversacional que busca casas por ti. La diferencia frente a Portal Inmobiliario o Yapo es
que muestra dos cosas que ningún portal tiene:

- **Qué calles se anegan en invierno** (154 puntos oficiales del GORE RM convertidos en 423
  tramos de calle reales, más reportes de vecinos).
- **Locomoción real** por propiedad: recorridos de micro, buses en hora punta y paraderos,
  desde el GTFS de Red Movilidad. No solo el Metro.

Es gratis, sin comisión, y la idea de fondo es democratizar el arriendo sacando a los
intermediarios del medio.

---

## Cómo correrlo (Windows)

Requisitos: Node 22, y una clave de DeepSeek para el agente (sin ella funciona en "modo
básico" por reglas).

```bat
:: Primera vez — instalar y compilar
cd backend  && npm install --include=dev && npm run build
cd ..\frontend && npm install --include=dev && npm run build

:: Después, solo doble clic:
INICIAR.bat
```

Abre en **http://localhost:4173** (frontend) y la API queda en **http://localhost:3000/api**.

### ⚠️ Dos trampas de este PC en particular

Este equipo tiene dos variables de entorno del sistema dañadas que rompen `npm`. `INICIAR.bat`
las parcha por sesión, pero conviene arreglarlas de raíz en Variables de Entorno de Windows:

1. **`ComSpec` está vacío** → `npm install` falla con `ERR_INVALID_ARG_TYPE`.
   Debe valer `C:\Windows\System32\cmd.exe`.
2. **`NODE_ENV=production` fijo** → npm omite las devDependencies (no instala vite ni el CLI de
   Nest). Por eso hay que usar `--include=dev`.

### La clave de DeepSeek

Va en `backend/.env` (que está en `.gitignore`, nunca se sube):

```
DEEPSEEK_API_KEY=sk-...
LLM_PROVIDER=deepseek
LLM_MODEL=deepseek-v4-flash
PORT=3000
```

Cuando la clave está activa, el chat muestra "✨ DeepSeek V4 Flash". Sin clave, "🔧 modo básico".

> Nota: `deepseek-chat` y `deepseek-reasoner` fueron **retirados el 24-jul-2026**. Usar
> `deepseek-v4-flash` (barato) o `deepseek-v4-pro` (más razonamiento). El flash **es un modelo
> de razonamiento**: gasta tokens pensando, por eso los `max_tokens` van holgados.

---

## Arquitectura

Monorepo: **backend NestJS + frontend React/Vite**, calcado del patrón de CotizadorIA.

```
backend/
  src/
    ai-assistant/          ← el agente conversacional (motor multi-proveedor + tool-calling)
    propiedades/           ← búsqueda, informe, reportes de calles, agentes de usuario
    data/datos.json        ← 136 casas + 423 tramos inundables + GTFS + metadata
  scripts/ingesta.py       ← ingesta desde la API oficial de Mercado Libre (Python, sin pip)
frontend/
  src/
    components/            ← Mapa (MapLibre), Ficha, Buscador, Reportar, MiAgente, chat/
    hooks/useAiChat.ts     ← hook del chat
web/                       ← versión estática desplegable (Vercel) sin backend
docs/
  arquitectura-agentica.md ← EL PLAN del refactor del agente (léelo, ver más abajo)
```

### El motor de IA

`ai-assistant/llm.service.ts` es multi-proveedor (DeepSeek / Kimi / Claude + modo básico) con un
**loop de function-calling**. Tiene 5 herramientas: `buscar_casas`, `informe_critico`,
`estadisticas_zona`, `crear_alerta`, `reportar_calle_inundable`.

Mide su propio consumo: `GET /api/ai/costos` reporta tokens y costo. Medido en producción:
**0,55 CLP por mensaje**.

---

## Estado: qué está hecho

- ✅ Mapa vectorial MapLibre oscuro, píldoras de precio por riesgo, inundación como calles
  animadas (no puntos), capas conmutables.
- ✅ Agente conversacional real con DeepSeek (function calling verificado).
- ✅ Buscador con filtros (tipo, comuna, precio, dorms, baños, m², riesgo, locomoción, amenidades).
- ✅ Reportes vecinales de calles que se anegan (geocodificados contra OpenStreetMap).
- ✅ Agentes personales de búsqueda: el usuario deja correo/teléfono y criterios, y el sistema
  detecta novedades.
- ✅ Fichas con informe de riesgo, locomoción GTFS y precio vs. mediana comunal.
- ✅ Medición de costo por mensaje.
- ✅ Ingesta desde la API oficial de Mercado Libre (script listo, falta correrlo con credenciales).

### Defectos conocidos del dataset (importante)

El `datos.json` viene de un scraping viejo con tres problemas que **solo se arreglan con la
ingesta real**:

1. Las fotos venían repetidas (una genérica en 128 de 136). Ya se descartan las no acreditables;
   quedan 9 con foto propia. El resto muestra un vacío honesto.
2. Los enlaces eran búsquedas por comuna, no el aviso. Ahora se arma una búsqueda filtrada, pero
   no es el permalink directo.
3. Solo 136 avisos congelados.

**Los tres mueren cuando corras `scripts/ingesta.py`** con credenciales de Mercado Libre
(crear app en developers.mercadolibre.cl). El MCP de Mercado Libre también sirve, pero solo en
conversación con Claude, no dentro de la app.

---

## Lo que quedó a medias: el refactor agéntico

Está **el plan completo** en `docs/arquitectura-agentica.md`. Es un refactor del agente interno
para estructurarlo con cuatro patrones (router, pipeline, planner+ejecutores, evaluador↔optimizador)
con enrutamiento adaptativo para no encarecer las consultas simples.

**Avance:** solo el **paso 1 de 6** (los primitivos en `llm.service.ts`: `completar()`,
`completarJson()`, `loopHerramientas()`, contabilidad). Compila y el loop actual sigue intacto
como red de seguridad.

**Pendiente:** pasos 2 a 6 — crear `orquestador.service.ts` y la carpeta `patrones/` con los
cuatro servicios. El plan trae el contrato de cada uno, el orden de implementación y cómo
verificar cada paso.

> Nota de contexto: en la conversación surgió la duda de si estos patrones eran para el agente
> DENTRO de la app (atender arrendatarios) o para un sistema de agentes que CONSTRUYA la app.
> El plan actual (`arquitectura-agentica.md`) es lo primero. Si querías lo segundo, ese diseño
> queda pendiente de escribir.

---

## Repositorio

Todo está versionado en **github.com/mat1dtsc/arriendo-mapa-v2**. El historial de commits cuenta
la evolución bug por bug. La carpeta `web/` se despliega en Vercel con Root Directory: `web`.

> 🔑 Durante el desarrollo se usaron tokens de GitHub en texto plano. **Revócalos** en
> GitHub → Settings → Developer settings cuando cierres esto, y genera uno nuevo si necesitas
> seguir pusheando.

---

## Siguiente paso sugerido

Por orden de impacto real en el producto:

1. **Correr la ingesta de Mercado Libre** — arregla fotos, enlaces y volumen de una sola vez.
   Es lo que más cambia la percepción de "maqueta" a "producto".
2. **Conectar el envío real** (correo/WhatsApp) para que los agentes de usuario avisen de verdad.
3. **El refactor agéntico** (pasos 2-6 del plan) — más valor de plataforma/aprendizaje que de
   producto inmediato.
4. **Formulario para que propietarios publiquen** — resuelve el arranque en frío mejor que la
   ingesta, porque son avisos exclusivos.
