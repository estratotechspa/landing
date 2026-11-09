// Generador estático sin dependencias: site/ -> public/ (lo que publica Cloudflare).
// Uso: npm run build   (o: node build.mjs). Commitea también public/.
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SITE = 'site';
const OUT = 'public';
const ORIGIN = 'https://estratotech.cl';

const read = (...p) => readFileSync(join(SITE, ...p), 'utf8');
const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const escText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function parsePage(file) {
  const raw = read('pages', file);
  const m = raw.match(/^<!--meta\n([\s\S]*?)-->\n/);
  if (!m) throw new Error(`${file}: falta el bloque <!--meta ... -->`);
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: raw.slice(m[0].length) };
}

function expand(html) {
  for (let i = 0; i < 6; i++) {
    const next = html.replace(/<!--include:([\w-]+)-->/g, (_, n) => read('partials', `${n}.html`).trimEnd());
    if (next === html) return html;
    html = next;
  }
  throw new Error('Includes anidados en exceso');
}

function fill(html, vars) {
  return html.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (!(k in vars)) throw new Error(`Variable sin definir: {{${k}}}`);
    return vars[k];
  });
}

const urls = [];
function emit(meta, body, extra = {}) {
  const path = fill(meta.path, extra);
  const title = fill(meta.title, extra);
  const description = fill(meta.description, extra);
  const vars = {
    ...extra,
    title: escAttr(title),
    description: escAttr(description),
    canonical: ORIGIN + path,
    robots: meta.noindex ? '<meta name="robots" content="noindex">' : '',
  };
  let html = fill(expand(body), vars);
  html = expand(html);
  // Páginas sin formulario: el botón "Contáctanos" apunta al de la portada
  if (!html.includes('id="contacto"')) html = html.replaceAll('href="#contacto"', 'href="/#contacto"');
  const file = path === '/' ? 'index.html' : `${path.slice(1)}.html`;
  writeFileSync(join(OUT, file), html);
  if (!meta.noindex) urls.push(path);
  console.log('  ' + file);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(join(SITE, 'static'), OUT, { recursive: true });

const rubros = JSON.parse(read('data', 'rubros.json'));

for (const file of readdirSync(join(SITE, 'pages')).sort()) {
  const { meta, body } = parsePage(file);
  if (meta.generate === 'rubros') {
    for (const r of rubros) {
      const extra = {
        slug: r.slug, eyebrow: escText(r.eyebrow), h1: r.h1, lead: escText(r.lead), h2: escText(r.h2),
        features: r.features
          .map(([t, d]) => `      <div class="tile"><h3>${escText(t)}</h3><p>${escText(d)}</p></div>`)
          .join('\n'),
        image: r.image
          ? `<figure class="shot"><img src="${r.image}" width="1481" height="800" alt="${escAttr(r.imageAlt)}"></figure>`
          : '',
        caso: r.caso
          ? `<section class="s s--white" id="caso"><div class="wrap stack" style="--gap: 32px"><h2>Un caso real</h2><div class="grid" style="--min: 340px"><!--include:${r.caso}--></div></div></section>`
          : '',
        others: rubros
          .filter((o) => o.slug !== r.slug)
          .map((o) => `<a class="chip" href="/${o.slug}">${escText(o.short)}</a>`)
          .concat('<a class="chip" href="/asesorias">Asesorías en cloud e IA</a>')
          .join(''),
        // el título/descr. del rubro se resuelven vía fill() de meta
        title: r.title, description: r.description,
      };
      emit(meta, body, extra);
    }
  } else if (meta.path) {
    emit(meta, body);
  }
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
  .sort()
  .map((u) => `  <url><loc>${ORIGIN}${u}</loc></url>`)
  .join('\n')}\n</urlset>\n`;
writeFileSync(join(OUT, 'sitemap.xml'), sitemap);
console.log(`Listo: ${urls.length} páginas indexables en ${OUT}/`);
