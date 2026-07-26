# 🏠 ArriendoMapa v2 — Mapa + IA conversacional

Plataforma de arriendos para Santiago con **el mapa como eje** y un **copiloto IA** que lo controla. Arquitectura calcada de [CotizadorIA (Treck)](https://github.com/mat1dtsc/CotizadorIA-v2): backend **NestJS** modular con function calling + frontend **React (Vite)**.

```
Usuario ─ chat ─▶ POST /api/ai/chat
                    │  Claude (loop agéntico, máx 5 pasos)
                    │  ├─ buscar_casas(filtros)      ─▶ filtra pins del mapa
                    │  ├─ informe_critico(id)        ─▶ vuela a la casa
                    │  └─ estadisticas_zona(comuna)  ─▶ centra la comuna
                    ▼
              { respuesta, acciones[] } ─▶ el mapa las ejecuta
```

## 🧠 Motor de IA (DeepSeek · Kimi · Claude)

El copiloto usa **function calling** real: el modelo elige la herramienta, el backend la ejecuta contra los datos y devuelve **datos + una acción para el mapa**.

| Proveedor | Modelo por defecto | Variable en `.env` | Costo aprox. |
|---|---|---|---|
| **DeepSeek** (recomendado) | `deepseek-v4-flash` | `DEEPSEEK_API_KEY` | ~USD 0,14 / 1M tokens |
| **Kimi** (Moonshot) | `kimi-k2.6` | `MOONSHOT_API_KEY` | mayor |
| **Claude** | `claude-sonnet-4-6` | `ANTHROPIC_API_KEY` | mayor |
| **Modo básico** | reglas, sin IA | — | gratis |

```bash
cd backend && cp .env.example .env
# pega DEEPSEEK_API_KEY=sk-...  (o MOONSHOT_API_KEY)
```

- Sin ninguna clave, el chat **igual funciona** en modo básico (parser de reglas con las mismas herramientas).
- Si el proveedor falla, cae solo a modo básico — nunca se rompe el chat.
- `LLM_BASE_URL` permite apuntar a **Ollama local** u otro gateway OpenAI-compatible.
- `GET /api/ai/estado` dice qué motor está activo (la UI lo muestra en el chat).

> ⚠️ `deepseek-chat` y `deepseek-reasoner` fueron **retirados el 24-jul-2026**. Este proyecto usa los nombres nuevos (`deepseek-v4-flash` / `deepseek-v4-pro`).

## 🗺️ La app

El **mapa es la portada**: MapLibre GL vectorial oscuro con inclinación 3D, píldoras de precio por propiedad (color = riesgo de inundación), inundación como mapa de calor, canales, Metro y paraderos conmutables. El copiloto es un panel flotante que **controla el mapa**: filtra, vuela y centra según lo que pidas.

## El calco CotizadorIA → ArriendoMapa

| CotizadorIA (Demian) | ArriendoMapa v2 |
|---|---|
| `tool-declarations.ts` (buscar_productos, ficha técnica…) | `tool-declarations.ts` (buscar_casas, informe_critico, estadisticas_zona) |
| `tool-executor.service.ts` → HANA/SQL | `tool-executor.service.ts` → datos.json (F2: Supabase/PostGIS) |
| `claude-ai.service.ts` (multi-proveedor) | `llm.service.ts` — DeepSeek/Kimi (OpenAI-compat) + Claude + fallback |
| `AiChatbot.jsx` + `useAiChat.js` | `ChatWindow.tsx` + `useAiChat.ts` (badge del motor activo) |
| Pinecone RAG | F3: pgvector en Supabase |

**El twist propio**: cada tool devuelve `datos` (para el LLM) **y** `accion` (para el mapa). El chat no solo responde: mueve, filtra y vuela el mapa.

## Datos únicos (ya precalculados en `backend/data/datos.json`)
- 💧 **Riesgo de invierno**: 154 puntos críticos oficiales geocodificados (GORE RM, 14-jul-2026) + canales San Carlos y Zanjón de la Aguada → nivel por propiedad.
- 🚌 **Locomoción real**: recorridos de micros, buses/hora punta, paradero y Metro más cercanos (GTFS Red Movilidad DTPM, 04-jul-2026) → score 0-100.
- 💰 Precio $/m² vs mediana comunal. 136 avisos reales.

## Correr en local
```bash
# Backend (puerto 3000)
cd backend && cp .env.example .env   # pega tu ANTHROPIC_API_KEY
npm install && npm run start:dev

# Frontend (puerto 5173, proxy a /api)
cd frontend && npm install && npm run dev
```
Pruébalo: *"casas de 3 dormitorios bajo 500 mil en Puente Alto que no se inunden"* · *"¿cómo es arrendar en La Florida?"* · *"dame el informe de la casa 2"*.

## Roadmap
- **F1 (este repo)**: esqueleto + chat con tools sobre datos estáticos ✅
- **F2**: Supabase/PostGIS + ingesta viva de avisos (API Mercado Libre)
- **F3**: RAG (pgvector), memoria de usuario, guardrails y router semántico — patrón CotizadorIA completo

Fuentes: GORE RM (puntos críticos), DTPM (GTFS), OpenStreetMap (ODbL), CARTO.
