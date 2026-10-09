# Master Baloto

Sitio de consulta de flows, reportes, análisis y propuestas de pauta digital para Baloto.

## Contenido

- `index.html`: Master Baloto, página principal con enlace a todos los documentos.
- `tablero-baloto.html`: tablero de seguimiento full funnel (Meta y TikTok): metas del flow por campaña, curvas de alcance, plataforma, marca y evolución.
- `data/baloto_data.js`: datos diarios por campaña y curvas de alcance que lee el tablero.
- `data/baloto_flow.js`: metas del flow por mes y línea de campaña.
- `flow-octubre-2026.html`: flow de medios de octubre 2026 (Meta, TikTok y Google Ads).
- `reporte-cobro-premios-meta.html`: Cobro de premios · Meta Ads · ago 2026.
- `reporte-engagement-baloto-miloto.html`: Engagement Baloto y Miloto · jul 2026.
- `dashboard-acumulado.html`: Dashboard acumulado · jun 2026.
- `reporte-retencion-2026.html`: Campaña de retención · may 2026.
- `reporte-tiktok-mayo-2026.html`: TikTok Ads · may 2026.
- `reporte-marzo-vs-abril-2026.html`: Marzo vs abril 2026.
- `promo-italia-octubre-2026.html`: Promo Italia, Meta y TikTok, con anuncios y audiencias · oct 2026.
- `doce-top-feed-septiembre-2026.html`: Doce Top Feed · septiembre 2026.
- `nueve-top-feed-jul-ago-2026.html`: Nueve Top Feed · jul–ago 2026.
- `top-feed-branding-jul-ago-2026.html`: Cuatro Top Feed · branding jul–ago 2026.
- `top-feed-julio-2026.html`: Top Feed · 25 y 27 de julio 2026.
- `comparativo-videos.html`: Comparativo de nuevos videos · sep 2026.
- `benchmark-anuncios-2026.html`: Benchmark de anuncios propios 2026.
- `informe-telomereces-mayo-2026.html`: Videos Telomereces · may 2026.
- `informe-telomereces-abril-2026.html`: Videos Telomereces · abr 2026.
- `recomendacion-presupuesto.html`: Recomendación de presupuesto · may 2026.
- `assets/`: recursos visuales y estilos del sitio. `master.css` agrega el negro y amarillo del índice; `reportes.css` es el estilo de las páginas de flow.

## Uso local

Abre `index.html` en un navegador para acceder a los documentos.

## Convención de nombres

Los archivos de contenido usan `kebab-case`. Los documentos estándar de GitHub conservan sus nombres convencionales, por ejemplo `README.md`.

## Actualizar el tablero de seguimiento

Los datos se generan desde el repositorio Meta-Ads-CLI, con las APIs de Meta Ads y TikTok Ads:

```
.venv/bin/python scripts/clients/baloto/build_baloto_tablero.py --out ../GitHub/baloto/data/baloto_data.js
```

Cuando llegue el flow de un mes nuevo, se agrega su meta (el archivo acumula meses):

```
.venv/bin/python scripts/clients/baloto/build_baloto_flow.py --xlsx "~/Downloads/[Baloto] Flow de medios - Noviembre.xlsx" --mes 2026-11 --out ../GitHub/baloto/data/baloto_flow.js
```

Compras, registros e ingresos salen de GA4, en la pestaña RESUMEN GENERAL de la hoja [Baloto] Fuente de datos, que el tablero lee en vivo; de ahí sale también la inversión de Google Ads, X y programática. La hoja debe estar compartida como "Cualquier persona con el enlace: lector". Si no carga, el tablero usa los resultados de plataforma y lo avisa. Para probar sin la hoja: `tablero-baloto.html?hoja=archivo.csv` servido por http, con las mismas columnas.
