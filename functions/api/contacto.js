// Cloudflare Pages Function: POST /api/contacto
// Recibe el formulario del landing y lo envía por correo con Resend.
//
// Variables de entorno (Pages > Settings > Variables and Secrets; NUNCA en el repo):
//   RESEND_API_KEY    (secreto)  API key de Resend con permiso solo de envío
//   TURNSTILE_SECRET  (secreto)  opcional; si existe, se valida el token de Turnstile
//   MAIL_TO           (texto)    opcional; por defecto contacto@estratotech.cl
//   MAIL_FROM         (texto)    opcional; por defecto EstratoTech <no-responder@estratotech.cl>

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const limpiar = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

function origenPermitido(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true; // llamadas sin Origin (no navegador) igual pasan por las demás validaciones
  try {
    const host = new URL(origin).hostname;
    return host === 'estratotech.cl' || host.endsWith('.estratotech.cl') || host.endsWith('.pages.dev');
  } catch {
    return false;
  }
}

export async function onRequestPost({ request, env }) {
  if (!origenPermitido(request)) return json({ ok: false, error: 'origen' }, 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'json' }, 400);
  }

  // Campo trampa: si viene lleno es un bot; respondemos "ok" sin enviar nada.
  if (limpiar(body.website, 200)) return json({ ok: true });

  const d = {
    reto: limpiar(body.reto, 3000),
    nombre: limpiar(body.nombre, 80),
    email: limpiar(body.email, 160),
    empresa: limpiar(body.empresa, 120),
    interes: limpiar(body.interes, 120) || 'No indicado',
  };
  if (!d.reto || !d.nombre || !d.empresa || !emailValido(d.email)) {
    return json({ ok: false, error: 'datos' }, 400);
  }

  if (env.TURNSTILE_SECRET) {
    const form = new FormData();
    form.append('secret', env.TURNSTILE_SECRET);
    form.append('response', limpiar(body.token, 4096));
    const ip = request.headers.get('CF-Connecting-IP');
    if (ip) form.append('remoteip', ip);
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    const v = await r.json().catch(() => ({}));
    if (!v.success) return json({ ok: false, error: 'captcha' }, 403);
  }

  if (!env.RESEND_API_KEY) return json({ ok: false, error: 'config' }, 500);

  const texto = [
    'Nueva solicitud desde estratotech.cl',
    '',
    `Nombre: ${d.nombre}`,
    `Correo: ${d.email}`,
    `Empresa: ${d.empresa}`,
    `Interés: ${d.interes}`,
    '',
    'Mensaje:',
    d.reto,
  ].join('\n');

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM || 'EstratoTech <no-responder@estratotech.cl>',
      to: [env.MAIL_TO || 'contacto@estratotech.cl'],
      reply_to: d.email,
      subject: `Contacto web: ${d.interes} — ${d.empresa}`.slice(0, 200),
      text: texto,
    }),
  });

  if (!resp.ok) {
    console.error('Resend error', resp.status);
    return json({ ok: false, error: 'envio' }, 502);
  }
  return json({ ok: true });
}

export async function onRequest() {
  return json({ ok: false, error: 'metodo' }, 405);
}
