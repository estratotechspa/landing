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

## Formulario de contacto: variables y bindings (Worker > Settings)
- `RESEND_API_KEY` (secreto): API key de Resend con permiso solo de envío. Requiere el dominio verificado.
- `TURNSTILE_SECRET` (secreto): clave secreta de Turnstile. **Con ella activa** se valida a la persona y además se envía un correo de confirmación a quien escribió (sin Turnstile no se envía, para que el formulario no sirva para mandar correos a terceros).
- `MAIL_TO` y `MAIL_FROM` (opcionales): por defecto `contacto@estratotech.cl` y `EstratoTech <no-responder@estratotech.cl>`.
- `DB` (binding D1, opcional): guarda cada contacto en la tabla `leads` antes de enviar el correo, así no se pierde ninguno si Resend falla.

El Worker solo acepta envíos desde `estratotech.cl`, `www.estratotech.cl` y las URL del propio Worker (`estratotech-landing.*.workers.dev`).

Antes de probar el formulario: crear la dirección `contacto@` en Email Routing (hacia el Gmail de EstratoTech).

## Activar Turnstile, base de contactos y analítica (pasos en Cloudflare)
1. **Turnstile:** Cloudflare > Turnstile > Add widget (dominios `estratotech.cl` y `www.estratotech.cl`). La *site key* ya está en `TURNSTILE_SITE_KEY` (inicio de `site/static/site.js`). La *secret key* se guarda solo como secreto `TURNSTILE_SECRET` en Workers & Pages > estratotech-landing > Settings > Variables and Secrets (tipo Secret), **después** de desplegar la site key; si se agrega antes, el formulario rechaza los envíos.
2. **Base de contactos (D1):** ya conectada (`estratotech-leads`, binding `DB` en `wrangler.jsonc`). Si hubiera que recrearla: `npx wrangler d1 create estratotech-leads`, copiar el `database_id` a `wrangler.jsonc` y crear la tabla pegando `migrations/0001_leads.sql` en D1 > estratotech-leads > Console (o `npx wrangler d1 migrations apply estratotech-leads --remote` una vez que el bloque `d1_databases` esté en la configuración). No agregar el binding desde el panel: el próximo despliegue lo borraría, porque `wrangler.jsonc` manda. Ver los contactos: Console > `SELECT * FROM leads ORDER BY id DESC LIMIT 20;`. Eliminar los datos de una persona: `DELETE FROM leads WHERE email = '...';`.
3. **Analítica sin cookies:** Cloudflare > Analytics & Logs > Web Analytics > Add site. Pegar el token en `CF_ANALYTICS_TOKEN` (inicio de `site/static/site.js`). La CSP de `_headers` ya permite el script.

## Pendientes
- [x] Botón "Ingresar": apunta a `https://app.estratotech.cl`.
- [x] Hidroservi: cifra (≥ 20 horas-hombre al mes en informes; ~4 técnicos y ~30 OS al mes) confirmada por escrito.
- [x] Caso Transportes VYC: se decidió no incluirlo por ahora.
- [x] Barra de datos con cifras reales (4 empresas activas; actualizar el número en `site/pages/index.html` cuando cambie).
- [ ] Logos y citas de clientes (todos autorizaron): falta recibir los archivos de logo y los textos de las citas (hay `TODO` en `site/partials/case-*.html`).
- [ ] Foto de Carlos Quiroz para la sección Quiénes somos (`TODO` en `site/pages/index.html`).
- [x] Textos legales definitivos en `/terminos` y `/privacidad` (nov 2026; revisados por abogado según Carlos). Si cambia lo que el sitio hace con los datos (analítica, nuevos proveedores), actualizarlos y la fecha.
- [ ] Activar Turnstile (falta agregar el secreto `TURNSTILE_SECRET` tras el despliegue) y Web Analytics (pasos arriba). D1 ya está activa. `/privacidad` ya menciona el registro de contactos y el correo de confirmación; al activar la analítica, actualizarla para mencionar las estadísticas de visitas sin cookies.
- [ ] Probar `/api/uf` (mindicador.cl) en el preview desplegado.
- [ ] Publicar solo afirmaciones verificables: no prometer uptime/SLA, respaldos diarios ni plazos de implementación hasta que sean ciertos.
