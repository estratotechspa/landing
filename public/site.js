// EstratoTech — comportamiento compartido (menú móvil, formulario, UF en pesos).
// Turnstile (anti-spam de Cloudflare): pegar aquí la "site key" pública cuando se cree el widget. Vacío = sin Turnstile.
const TURNSTILE_SITE_KEY = '';
const MAIL_RESPALDO = 'contacto@estratotech.cl';

// ---------- Menú móvil ----------
(function () {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('nav');
  if (!toggle || !nav) return;
  const set = function (open) {
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', function () { set(!nav.classList.contains('open')); });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
})();

// ---------- Botones que preseleccionan plan/interés ----------
(function () {
  const plan = document.getElementById('plan');
  const interes = document.getElementById('interes');
  if (!plan || !interes) return;
  document.querySelectorAll('[data-plan], [data-interes]').forEach(function (a) {
    a.addEventListener('click', function () {
      if (a.dataset.plan) plan.value = a.dataset.plan;
      interes.value = a.dataset.interes || 'Prueba gratis de 7 días';
    });
  });
})();

// ---------- Equivalente aproximado en pesos (UF del día); si falla, no se muestra ----------
(function () {
  const items = document.querySelectorAll('[data-uf-monto]');
  if (!items.length) return;
  fetch('/api/uf').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
    if (!d || !d.uf) return;
    const fmt = new Intl.NumberFormat('es-CL');
    items.forEach(function (el) {
      el.textContent = '≈ $' + fmt.format(Math.round(d.uf * parseFloat(el.dataset.ufMonto))) + ' + IVA al mes (UF de hoy: $' + fmt.format(d.uf) + ')';
      el.hidden = false;
    });
  }).catch(function () {});
})();

// ---------- Formulario de contacto ----------
(function () {
  const form = document.getElementById('contactForm');
  if (!form) return;
  const ok = document.getElementById('formSuccess');
  const err = document.getElementById('formError');
  const btn = document.getElementById('formBtn');
  let turnstileToken = '';

  if (TURNSTILE_SITE_KEY) {
    window.onTurnstileLoad = function () {
      window.turnstile.render('#turnstileBox', {
        sitekey: TURNSTILE_SITE_KEY,
        callback: function (t) { turnstileToken = t; },
        'expired-callback': function () { turnstileToken = ''; }
      });
    };
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit';
    s.async = true; s.defer = true;
    document.head.appendChild(s);
  }

  function mostrarError(html) { err.innerHTML = html; err.hidden = false; }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    err.hidden = true;
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      mostrarError('Confirma la verificación de seguridad antes de enviar.');
      return;
    }
    const textoBoton = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Enviando…';
    const v = function (id) { return document.getElementById(id).value.trim(); };
    const datos = {
      reto: v('reto'), nombre: v('nombre'), email: v('email'),
      empresa: v('empresa'), interes: v('interes'), plan: v('plan'),
      website: v('website'), token: turnstileToken
    };
    try {
      const r = await fetch('/api/contacto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
      });
      if (!r.ok) throw new Error('http ' + r.status);
      form.hidden = true;
      ok.hidden = false;
    } catch (x) {
      mostrarError('No pudimos enviar tu mensaje. Escríbenos a <a href="mailto:' + MAIL_RESPALDO + '">' + MAIL_RESPALDO + '</a> y te respondemos.');
      btn.disabled = false;
      btn.textContent = textoBoton;
      if (window.turnstile) { window.turnstile.reset(); turnstileToken = ''; }
    }
  });
})();
