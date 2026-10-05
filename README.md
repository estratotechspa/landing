# Landing de EstratoTech (estratotech.cl)

Sitio estático (HTML con estilos en línea, sin paso de compilación) más una Cloudflare Pages Function para el formulario.
Base: `EstratoTech___Landing.html`.

## Archivos
- `index.html`: la página. `terminos.html` y `privacidad.html`: páginas provisorias.
- `functions/api/contacto.js`: recibe el formulario y envía el correo con Resend.
- `_headers`, `robots.txt`, `sitemap.xml`, `favicon.svg`, `og-image.png`: seguridad, SEO e imagen para redes.

## Publicar en Cloudflare Pages (cuenta de EstratoTech)
La función del formulario solo se despliega si Pages está conectado a GitHub (arrastrar y soltar no la incluye).
1. Crear el repositorio privado `estratotechspa/landing` y subir esta carpeta.
2. Cloudflare > Workers & Pages > Create > Pages > Connect to Git, y elegir ese repositorio.
3. Build command: vacío. Build output directory: `/` (la raíz).
4. En el proyecto, Custom domains: agregar `estratotech.cl` y `www.estratotech.cl` (con redirección a la raíz).

## Variables del formulario (Pages > Settings > Variables and Secrets)
- `RESEND_API_KEY` (secreto): API key de Resend con permiso solo de envío. Requiere el dominio verificado.
- `TURNSTILE_SECRET` (secreto, opcional): clave secreta del widget de Turnstile.
- `MAIL_TO` y `MAIL_FROM` (opcionales): por defecto `contacto@estratotech.cl` y `EstratoTech <no-responder@estratotech.cl>`.

Antes de probar el formulario: crear la dirección `contacto@` en Email Routing (hacia el Gmail de EstratoTech).
Para activar Turnstile: crear el widget en Cloudflare > Turnstile y pegar la site key (pública) en `TURNSTILE_SITE_KEY`, dentro del script de `index.html`.

## Pendientes antes de publicar
- [ ] Caso Transportes VYC: completar el bloque comentado `TODO Transportes VYC` en `index.html` con datos reales.
- [ ] Botón "Ingresar": hoy apunta a `app.transportesitineris.cl`; cambiar a `https://app.estratotech.cl` cuando el Bitácora nuevo esté arriba.
- [ ] Textos legales definitivos en `/terminos` y `/privacidad` (revisión del abogado; plazo Ley 21.719: 1 de diciembre de 2026).
- [ ] Hidroservi: confirmar con ellos el texto del caso (≥ 20 horas-hombre al mes en informes; unos 4 técnicos y ~30 OS al mes).
- [ ] Publicar solo afirmaciones verificables: no prometer uptime/SLA, respaldos diarios ni plazos de implementación hasta que sean ciertos.
