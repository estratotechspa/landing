# Landing de EstratoTech (estratotech.cl)

Sitio estático generado con un script sin dependencias, más un Cloudflare Worker (`src/worker.js`) que sirve los archivos y expone `POST /api/contacto` y `GET /api/uf`.

## Estructura
- `site/` — **fuente** (editar aquí):
  - `pages/` páginas (`index`, `asesorias`, `terminos`, `privacidad`) y la plantilla `rubro.html`.
  - `data/rubros.json` contenido de `/transporte`, `/mantencion` y `/agenda` (título, descripción, textos y funciones).
  - `partials/` cabecera, formulario de contacto, pie, casos de éxito, tarjetas de asesorías, etc.
  - `static/` `styles.css` (tokens de color en `:root`), `site.js` (menú móvil, formulario, UF), imágenes, `_headers`, `robots.txt`.
- `public/` — **salida generada** (lo que publica Cloudflare). No editar a mano; se commitea para que el despliegue no necesite paso de compilación.
- `build.mjs` — genera `public/` desde `site/` y crea `sitemap.xml`.
- `src/worker.js` — Worker (formulario con Resend, UF del día).

## Flujo de trabajo
1. Editar archivos en `site/`.
2. `npm run build` (o `node build.mjs`; requiere Node 18+).
3. Revisar `public/` y commitear **ambos** (`site/` y `public/`).

Para agregar una página de industria: añadir un objeto en `site/data/rubros.json` y volver a compilar. Para una página nueva: crear `site/pages/<nombre>.html` con su bloque `<!--meta ... -->` (título, descripción, `path`).

## Publicar en Cloudflare
`wrangler.jsonc` sirve `./public` y ejecuta el Worker primero solo para `/api/*`. Dominios: `estratotech.cl` y `www.estratotech.cl` (con redirección a la raíz).

## Variables del formulario (Worker > Settings > Variables and Secrets)
- `RESEND_API_KEY` (secreto): API key de Resend con permiso solo de envío. Requiere el dominio verificado.
- `TURNSTILE_SECRET` (secreto, opcional): clave secreta del widget de Turnstile.
- `MAIL_TO` y `MAIL_FROM` (opcionales): por defecto `contacto@estratotech.cl` y `EstratoTech <no-responder@estratotech.cl>`.

Antes de probar el formulario: crear la dirección `contacto@` en Email Routing (hacia el Gmail de EstratoTech).
Para activar Turnstile: crear el widget en Cloudflare > Turnstile y pegar la site key (pública) en `TURNSTILE_SITE_KEY`, al inicio de `site/static/site.js`.

## Pendientes
- [x] Botón "Ingresar": apunta a `https://app.estratotech.cl`.
- [x] Hidroservi: cifra (≥ 20 horas-hombre al mes en informes; ~4 técnicos y ~30 OS al mes) confirmada por escrito.
- [x] Caso Transportes VYC: se decidió no incluirlo por ahora.
- [x] Barra de datos con cifras reales (4 empresas activas; actualizar el número en `site/pages/index.html` cuando cambie).
- [ ] Logos y citas de clientes (todos autorizaron): falta recibir los archivos de logo y los textos de las citas (hay `TODO` en `site/partials/case-*.html`).
- [ ] Foto de Carlos Quiroz para la sección Quiénes somos (`TODO` en `site/pages/index.html`).
- [ ] Textos legales definitivos en `/terminos` y `/privacidad` (revisión del abogado; plazo Ley 21.719: 1 de diciembre de 2026).
- [ ] Probar `/api/uf` (mindicador.cl) en el preview desplegado.
- [ ] Publicar solo afirmaciones verificables: no prometer uptime/SLA, respaldos diarios ni plazos de implementación hasta que sean ciertos.
