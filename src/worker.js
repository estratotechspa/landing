// Cloudflare Worker (con assets estáticos):
//   POST /api/contacto  recibe el formulario: lo guarda (D1, si está configurado), avisa por correo (Resend)
//                       y, si Turnstile está activo, envía una confirmación a quien escribió.
//   GET  /api/uf        valor de la UF del día, para mostrar equivalentes en pesos.
//
// Variables y bindings (Worker > Settings; NUNCA en el repo):
//   RESEND_API_KEY    (secreto)  API key de Resend con permiso solo de envío
//   TURNSTILE_SECRET  (secreto)  opcional; si existe, se valida Turnstile y se envía la confirmación al visitante
//   MAIL_TO           (texto)    opcional; por defecto contacto@estratotech.cl
//   MAIL_FROM         (texto)    opcional; por defecto EstratoTech <no-responder@estratotech.cl>
//   DB                (D1)       opcional; base de datos con la tabla `leads` (ver migrations/0001_leads.sql)

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const limpiar = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

// Solo el sitio propio (y las URL del propio Worker, para previews). Los navegadores siempre envían Origin en un POST.
const HOSTS_PERMITIDOS = /^(www\.)?estratotech\.cl$|^([a-z0-9-]+-)?estratotech-landing\.[a-z0-9-]+\.workers\.dev$/;
function origenPermitido(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  try {
    return HOSTS_PERMITIDOS.test(new URL(origin).hostname);
  } catch {
    return false;
  }
}

const PLANES = ['Esencial', 'Operación', 'Pro'];

// GET /api/uf: valor de la UF del día (mindicador.cl), cacheado 1 hora. Solo informativo.
async function handleUf() {
  try {
    const r = await fetch('https://mindicador.cl/api/uf', { cf: { cacheTtl: 3600, cacheEverything: true } });
    const d = await r.json();
    const uf = Number(d?.serie?.[0]?.valor);
    if (!r.ok || !Number.isFinite(uf) || uf < 1000) throw new Error('uf');
    return new Response(JSON.stringify({ uf: Math.round(uf), fecha: d.serie[0].fecha }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
    });
  } catch {
    return json({ ok: false, error: 'uf' }, 502);
  }
}

async function guardarLead(env, d, pagina) {
  if (!env.DB) return false;
  try {
    await env.DB.prepare(
      'INSERT INTO leads (nombre, email, empresa, interes, plan, reto, pagina) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(d.nombre, d.email, d.empresa, d.interes, d.plan, d.reto, pagina)
      .run();
    return true;
  } catch (e) {
    console.error('D1 error', String(e));
    return false;
  }
}

const enviarCorreo = (env, payload) =>
  fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

async function handleContacto(request, env, ctx) {
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
    plan: PLANES.includes(limpiar(body.plan, 40)) ? limpiar(body.plan, 40) : 'No indicado',
  };
  if (!d.reto || !d.nombre || !d.empresa || !emailValido(d.email)) {
    return json({ ok: false, error: 'datos' }, 400);
  }
  const pagina = limpiar(body.pagina, 80).startsWith('/') ? limpiar(body.pagina, 80) : '/';

  const verificado = Boolean(env.TURNSTILE_SECRET);
  if (verificado) {
    const form = new FormData();
    form.append('secret', env.TURNSTILE_SECRET);
    form.append('response', limpiar(body.token, 4096));
    const ip = request.headers.get('CF-Connecting-IP');
    if (ip) form.append('remoteip', ip);
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    const v = await r.json().catch(() => ({}));
    if (!v.success) return json({ ok: false, error: 'captcha' }, 403);
  }

  // 1) Guardar primero: si el correo falla, el contacto no se pierde.
  const guardado = await guardarLead(env, d, pagina);

  // 2) Aviso por correo.
  if (!env.RESEND_API_KEY) {
    return guardado ? json({ ok: true }) : json({ ok: false, error: 'config' }, 500);
  }
  const para = env.MAIL_TO || 'contacto@estratotech.cl';
  const de = env.MAIL_FROM || 'EstratoTech <no-responder@estratotech.cl>';
  const texto = [
    'Nueva solicitud desde estratotech.cl',
    '',
    `Nombre: ${d.nombre}`,
    `Correo: ${d.email}`,
    `Empresa: ${d.empresa}`,
    `Interés: ${d.interes}`,
    `Plan: ${d.plan}`,
    `Página: ${pagina}`,
    '',
    'Mensaje:',
    d.reto,
  ].join('\n');

  const resp = await enviarCorreo(env, {
    from: de,
    to: [para],
    reply_to: d.email,
    subject: `Contacto web: ${d.interes}${d.plan !== 'No indicado' ? ` (${d.plan})` : ''} — ${d.empresa}`.slice(0, 200),
    text: texto,
  });
  if (!resp.ok) {
    console.error('Resend error', resp.status);
    if (!guardado) return json({ ok: false, error: 'envio' }, 502);
    return json({ ok: true }); // quedó guardado; se puede revisar en la base
  }

  // 3) Confirmación a quien escribió. Solo con Turnstile activo (persona verificada), para que el
  //    formulario no pueda usarse para enviar correos a terceros.
  if (verificado) {
    ctx.waitUntil(
      enviarCorreo(env, {
        from: de,
        to: [d.email],
        reply_to: para,
        subject: 'Recibimos tu mensaje — EstratoTech',
        text: [
          `Hola ${d.nombre},`,
          '',
          `Recibimos tu mensaje sobre «${d.interes}» y te contactaremos pronto.`,
          '',
          `Si quieres agregar algo, escríbenos a ${para} o por WhatsApp: https://wa.me/56978099416`,
          '',
          'EstratoTech SpA',
          'https://estratotech.cl',
        ].join('\n'),
      }).catch((e) => console.error('Autorespuesta', String(e)))
    );
  }
  return json({ ok: true });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/uf' && request.method === 'GET') return handleUf();
    if (url.pathname === '/api/contacto') {
      if (request.method === 'POST') return handleContacto(request, env, ctx);
      return json({ ok: false, error: 'metodo' }, 405);
    }
    // Todo lo demás son archivos estáticos de /public
    return env.ASSETS.fetch(request);
  },
};
