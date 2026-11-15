'use strict';
// ============================================================================
// Tests de la ronda 13 (14-nov): rendimiento en móvil — sobre la base
// "Ronda 12" (799ff98). Cubre la lista del equipo de lag en mobile:
//   P0-1 sin backdrop-filter en móvil (header y .container con fondo sólido)
//   P0-2 halo achicado a max(260vw, 900px) en ≤768px (mismo brillo, menos área)
//   P0-3 partículas pintadas UNA sola vez en pantalla chica (sin rAF a 30fps)
//   P1-4 content-visibility en las tarjetas de apuntes fuera de pantalla
//   P1-5 KaTeX/marked/DOMPurify fuera del <head> de Apuntes (bajo demanda)
//   (P1-6 fondo de 316KB: se revisa al final de este archivo, no es de código)
//   13b: el logo de la top bar desaparece en móvil (display: none)
//   Cierre: bump ?v de las 4 páginas (hoy ?v=13)
// Ejecutar con:  node --test tests/*.test.js
// ============================================================================

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cargarModulos } = require('./helpers/env');

const RAIZ = path.join(__dirname, '..');
const leer = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8');

// Bloques @media (max-width: Npx) con balanceo de llaves (comentarios fuera)
function bloquesMediaMax(css) {
    const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const salida = [];
    const re = /@media\s*\(max-width:\s*([\d.]+)px\)\s*\{/g;
    let m;
    while ((m = re.exec(limpio))) {
        let i = re.lastIndex;
        let nivel = 1;
        while (i < limpio.length && nivel > 0) {
            if (limpio[i] === '{') nivel += 1;
            else if (limpio[i] === '}') nivel -= 1;
            i += 1;
        }
        salida.push({ ancho: Number(m[1]), cuerpo: limpio.slice(re.lastIndex, i - 1) });
    }
    return salida;
}

// Cuerpo unido de todos los media query con ancho máximo dado
function cuerpoEn(css, anchoMax) {
    return bloquesMediaMax(css)
        .filter((b) => b.ancho <= anchoMax)
        .map((b) => b.cuerpo)
        .join('\n');
}

// --- P0-1 ------------------------------------------------------------------

test('P0-1: en móvil header y tarjeta se quedan sin backdrop-filter', () => {
    const css = leer('css', 'styles.css');

    // En escritorio los desenfoques siguen (el cambio es solo ≤768px)
    assert.match(css, /header \{[^}]*backdrop-filter: blur\(15px\);/,
        'se perdió el blur del header en escritorio');
    assert.match(css, /\.container \{[^}]*backdrop-filter: blur\(20px\);/,
        'se perdió el blur de la tarjeta en escritorio');

    const movil = cuerpoEn(css, 768);
    const reglasDe = (sel) => [...movil.matchAll(new RegExp(sel + ' \\{[^}]*\\}', 'g'))].map((x) => x[0]);

    // Header: fondo casi sólido y sin desenfoque (con prefijo para Safari)
    const headers = reglasDe('header');
    const header = headers.find((r) => /backdrop-filter: none;/.test(r));
    assert.ok(header,
        'falta quitarle el blur al header en móvil: cada cuadro del canvas le hacía recalcular 15px sobre la pantalla');
    assert.match(header, /-webkit-backdrop-filter: none;/, 'falta el prefijo -webkit- para iOS');
    assert.match(header, /background: rgba\(0, 0, 0, 0\.96\)/,
        'sin blur el header necesita fondo casi opaco');

    // Tarjeta principal: fondo sube de 0.9 a 0.97 y sin desenfoque de 20px
    const contenedores = reglasDe('\\.container');
    const contenedor = contenedores.find((r) => /backdrop-filter: none;/.test(r));
    assert.ok(contenedor,
        'falta quitarle el blur a .container en móvil (era el de 20px sobre casi toda la pantalla)');
    assert.match(contenedor, /-webkit-backdrop-filter: none;/);
    assert.match(contenedor, /background: rgba\(11, 15, 25, 0\.97\) !important;/,
        'el fondo 0.9 con !important debe subir a 0.97 al quitar el blur');

    // Ninguna otra regla móvil de esas capas debe conservar un blur
    for (const r of [...headers, ...contenedores]) {
        assert.ok(!/blur\(/.test(r), `sigue con blur en móvil: ${r.replace(/\s+/g, ' ')}`);
    }
});

// --- P0-2 ------------------------------------------------------------------

test('P0-2: el halo baja a max(260vw, 900px) en móvil y conserva el de escritorio', () => {
    const css = leer('css', 'styles.css');

    // Escritorio: sigue la regla de la ronda 11 (2000px cubre ≥2000px)
    const base = /\.main-container::before \{[\s\S]*?\}/.exec(css);
    assert.ok(base && /width: max\(100vw, 2000px\)/.test(base[0]),
        'se perdió el ancho de escritorio del halo (max(100vw, 2000px))');

    // Móvil: 260vw ≈1014px a 390px y ≈1997px a 768px: mismo brillo en los
    // bordes que2000px (el degradado llega a transparente al 80%), pero el
    // área de la capa fija que se recompone en cada cuadro baja ≈ a la mitad
    // en teléfonos.
    const haloMovil = cuerpoEn(css, 768);
    assert.match(haloMovil, /\.main-container::before \{[^}]*width: max\(260vw, 900px\);/,
        'falta el halo achicado en móvil: 2000px en una pantalla de 390px es una capa enorme por cuadro');
    // Ni 100vw (los laterales quedan en negro, v6) ni los 2000px de antes
    assert.ok(!/\.main-container::before \{[^}]*width: max\(100vw, 2000px\)/.test(haloMovil),
        'en móvil el halo sigue midiendo 2000px');
});

// --- P0-3 (funcional) ------------------------------------------------------

function cargarParticulas({ chica, reducido }) {
    const rAF = [];
    const contadores = { clearRect: 0, fill: 0, stroke: 0 };
    const ctx2d = new Proxy({}, {
        get(t, k) {
            if (k === 'clearRect') return () => { contadores.clearRect += 1; };
            if (k === 'fill') return () => { contadores.fill += 1; };
            if (k === 'stroke') return () => { contadores.stroke += 1; };
            if (k === 'getImageData') return (x, y, w, h) => {
                const data = new Uint8ClampedArray(w * h * 4);
                // bloque opaco 10x10 en el centro: getSymbolPoints saca puntos
                for (let yy = 55; yy < 65; yy += 1) {
                    for (let xx = 55; xx < 65; xx += 1) data[(yy * w + xx) * 4 + 3] = 255;
                }
                return { data, width: w, height: h };
            };
            if (k === 'measureText') return (s) => ({ width: String(s).length * 8 });
            return () => { };
        },
        set() { return true; },
    });
    const lienzo = () => ({
        width: 0, height: 0, style: {},
        getContext: () => ctx2d,
        addEventListener() { }, removeEventListener() { },
    });
    const elementos = new Map();
    const oyentes = {};
    const documento = {
        getElementById(id) {
            if (!elementos.has(id)) { const e = lienzo(); e.id = id; elementos.set(id, e); }
            return elementos.get(id);
        },
        createElement: () => lienzo(),
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener(t, fn) { oyentes[t] = fn; },
        removeEventListener() { },
        hidden: false,
    };
    const sandbox = {
        console: { log() { }, error() { }, warn() { }, info() { } },
        document: documento,
        innerWidth: chica ? 390 : 1440,
        innerHeight: chica ? 700 : 900,
        devicePixelRatio: 1,
        addEventListener() { },
        removeEventListener() { },
        matchMedia: (q) => ({
            matches: /prefers-reduced-motion/.test(q) ? !!reducido : (/max-width: 768px/.test(q) ? !!chica : false),
        }),
        requestAnimationFrame: (fn) => { rAF.push(fn); return rAF.length; },
        cancelAnimationFrame() { },
        requestIdleCallback: (fn) => { fn(); return 0; },
        setTimeout, clearTimeout,
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(RAIZ, 'js', 'canvas-animation.js'), 'utf8'), sandbox,
        { filename: 'canvas-animation.js' });
    // Arranque real: DOMContentLoaded → requestIdleCallback → init()
    oyentes.DOMContentLoaded();
    return { sandbox, rAF, contadores };
}

test('P0-3: en pantalla chica las partículas pintan un frame y no abren bucle', () => {
    // Móvil: sin requestAnimationFrame y con el fondo ya dibujado
    const movil = cargarParticulas({ chica: true, reducido: false });
    assert.equal(movil.rAF.length, 0,
        'en móvil sigue corriendo el bucle a ~30fps: es el que obliga a recomponer halo y tarjetas en cada cuadro');
    assert.ok(movil.contadores.clearRect >= 1, 'el frame estático no se pintó');
    assert.ok(movil.contadores.fill >= 1, 'las partículas no se dibujaron');

    // Y cada símbolo se asienta en su destino (no queda en el arranque
    // aleatorio, que era lo que pasaba antes del arreglo en modo estático)
    const particulas = vm.runInContext('particleAnimation.symbolParticles', movil.sandbox);
    assert.ok(particulas.length > 0, 'no se crearon partículas de símbolo');
    for (const p of particulas) {
        assert.equal(p.x, p.baseX + p.relX, 'símbolo sin asentar en X');
        assert.equal(p.y, p.baseY + p.relY, 'símbolo sin asentar en Y');
    }

    // Escritorio: el bucle sigue vivo (el cambio no toca la animación de PC)
    const escritorio = cargarParticulas({ chica: false, reducido: false });
    assert.ok(escritorio.rAF.length >= 1, 'en escritorio dejó de animar');

    // reduced-motion: seguía y sigue estático (regresión de a11y)
    const reducido = cargarParticulas({ chica: false, reducido: true });
    assert.equal(reducido.rAF.length, 0, 'con prefers-reduced-motion volvió a animar');
    assert.ok(reducido.contadores.clearRect >= 1, 'con reduced-motion no se pinta el frame');
});

test('P0-3: al redimensionar en modo estático se vuelve a pintar el frame', () => {
    const { sandbox, rAF, contadores } = cargarParticulas({ chica: true, reducido: false });
    const pintado = contadores.clearRect;
    sandbox.resize();
    assert.ok(contadores.clearRect > pintado,
        'asignar canvas.width borra el lienzo y nadie lo repintaba: redimensionar dejaba el fondo en blanco');
    assert.equal(rAF.length, 0, 'redimensionar encendió el bucle de animación');
});

// --- P1-4 ------------------------------------------------------------------

test('P1-4: las tarjetas de apuntes fuera de pantalla no se renderizan', () => {
    const css = leer('css', 'styles.css');
    const regla = /#apuntes-remotos \.apunte-card \{[^}]*content-visibility: auto;[\s\S]*?contain-intrinsic-size: auto 260px;/.exec(css);
    assert.ok(regla,
        'falta content-visibility: auto en las tarjetas de Apuntes (layout/pintado de lo que no se ve)');
    // "auto <n>" recuerda la altura real de la última vez: sin eso la barra
    // de scroll salta al entrar una tarjeta en pantalla
    assert.match(regla[0], /contain-intrinsic-size: auto 260px;/);
});

// --- P1-5 ------------------------------------------------------------------

test('P1-5: Apuntes no pide KaTeX/marked/DOMPurify en el <head> y los carga bajo demanda', () => {
    const html = leer('pages', 'apuntes.html');

    // 1) Nada de esas librerías en la página: ~360KB menos al abrir la lista
    assert.ok(!/katex@0\.16\.9\/dist\/katex\.min\.(js|css)/.test(html),
        'sigue pidiendo KaTeX en el <head> de Apuntes');
    assert.ok(!/marked@15/.test(html), 'sigue pidiendo marked en el <head>');
    assert.ok(!/dompurify@3/.test(html), 'sigue pidiendo DOMPurify en el <head>');

    // 2) Lo que la lista sí necesita se queda: Supabase (traer apuntes),
    //    Font Awesome (iconos) y el precargas de su CDN
    assert.ok(/supabase-js/.test(html), 'la lista necesita el cliente de Supabase');
    assert.ok(/font-awesome/.test(html), 'la lista necesita Font Awesome');
    assert.ok(/preconnect[^>]*cdn\.jsdelivr\.net/.test(html), 'falta el preconnect de cdn.jsdelivr');

    // 3) El cargador diferido entra antes que apuntes.js
    assert.ok(/<script src="\.\.\/js\/vendor-loader\.js" defer><\/script>/.test(html),
        'falta vendor-loader.js en Apuntes');
    assert.ok(html.indexOf('vendor-loader.js') < html.indexOf('js/apuntes.js'),
        'vendor-loader debe cargarse antes que apuntes.js');

    // 4) vendor-loader conoce las librerías del visor, con su SRI fijado
    const vendor = leer('js', 'vendor-loader.js');
    assert.ok(vendor.includes('const MARKED_URL'), 'falta la URL de marked');
    assert.ok(vendor.includes('const PURIFY_URL'), 'falta la URL de DOMPurify');
    assert.ok(vendor.includes('ensureMarkdown()'), 'falta Vendor.ensureMarkdown');
    assert.ok(vendor.includes('sri: { math: MATH_SRI, katex: KATEX_SRI, marked: MARKED_SRI, purify: PURIFY_SRI }'),
        'los hashes SRI de marked/DOMPurify no quedaron expuestos');
    assert.ok(vendor.includes('sha384-948ahk4ZmxYVYOc+rxN1H2gM1EJ2Duhp7uHtZ4WSLkV4Vtx5MUqnV+l7u9B+jFv+'),
        'SRI de marked distinto del que se quitó del HTML');
    assert.ok(vendor.includes('sha384-+VfUPEb0PdtChMwmBcBmykRMDd+v6D/oFmB3rZM/puCMDYcIvF968OimRh4KQY9a'),
        'SRI de DOMPurify distinto del que se quitó del HTML');
    // ensureKatex pide también la hoja de estilos (en Apuntes ya no está)
    assert.ok(vendor.includes('asegurarKatexCss()'), 'falta el CSS de KaTeX bajo demanda');
    assert.ok(vendor.includes('function loadVendorStylesheet'), 'falta el cargador de hojas de estilo');

    // 5) js/apuntes.js pide las librerías donde se usan
    const apuntes = leer('js', 'apuntes.js');
    assert.ok(apuntes.includes('await window.Vendor.ensureMarkdown()'),
        'al abrir un .md no se piden marked/DOMPurify');
    assert.ok(apuntes.includes('await window.Vendor.ensureKatex()'),
        'al abrir un .md no se pide KaTeX (para las fórmulas del Markdown)');
    assert.ok(/contenido\.includes\('\$'\)/.test(apuntes),
        'el KaTeX del listado debe pedirse solo si el contenido trae fórmulas');
    // Sin Vendor (páginas que no lo cargan) el visor no se rompe: sigue el aviso
    assert.ok(apuntes.includes('typeof window.Vendor.ensureMarkdown === \'function\''),
        'falta la guarda por si no hay vendor-loader');

    // 6) La calculadora conserva su KaTeX en el <head> (allí ya era bajo
    //    demanda el JS/mathjs, y su link dispara la carga del CSS)
    assert.ok(/katex\.min\.css/.test(leer('pages', 'calculadora.html')),
        'la calculadora debe seguir trayendo su KaTeX CSS');
});

test('P1-5: loadVendorStylesheet aplica integrity y no duplica la hoja ya presente', async () => {
    const env = cargarModulos(['js/vendor-loader.js']);
    assert.equal(typeof env.ctx.loadVendorStylesheet, 'function');

    // Hoja ya en el <head> (caso de la calculadora): resuelve sin duplicar
    env.ctx.document.querySelector = () => ({ href: 'ya' });
    await env.ctx.loadVendorStylesheet('https://cdn.example/katex.min.css', 'sha384-x');

    // Hoja ausente: se inserta con SRI y crossorigin
    let link = null;
    env.ctx.document.querySelector = () => null;
    env.ctx.document.createElement = (tag) => {
        link = { tagName: String(tag).toUpperCase(), onload: null, onerror: null };
        return link;
    };
    env.ctx.document.head.appendChild = (el) => { if (el.onload) el.onload(); };
    await env.ctx.loadVendorStylesheet('https://cdn.example/katex.min.css', 'sha384-y');
    assert.equal(link.rel, 'stylesheet');
    assert.equal(link.integrity, 'sha384-y');
    assert.equal(link.crossOrigin, 'anonymous');
});

test('P1-5: Vendor.ensureMarkdown pide marked y DOMPurify con sus hashes', async () => {
    const env = cargarModulos(['js/vendor-loader.js']);
    const pedidos = [];
    env.ctx.document.createElement = () => {
        const s = { dataset: {} };
        return s;
    };
    env.ctx.document.head.appendChild = (el) => {
        pedidos.push({ src: el.src, integrity: el.integrity });
        // onload al insertar (como el navegador) — se captura tras asignarlo
        setTimeout(() => { if (el.onload) el.onload(); }, 0);
    };
    const listo = env.ctx.Vendor.ensureMarkdown();
    await new Promise((r) => setTimeout(r, 5));
    await listo;
    assert.equal(pedidos.length, 2, `se esperaban 2 scripts (hay ${pedidos.length})`);
    assert.ok(pedidos.some((p) => /marked\.min\.js/.test(p.src) && p.integrity));
    assert.ok(pedidos.some((p) => /purify\.min\.js/.test(p.src) && p.integrity));
});

// --- 13b -------------------------------------------------------------------

test('13b: el logo de la top bar no aparece en móvil (display: none)', () => {
    const css = leer('css', 'styles.css');
    const reglas = [...css.matchAll(/\.logo-title \{[^}]*\}/g)]
        .map((m) => ({ regla: m[0], i: m.index }));

    // Escritorio: el logo sigue y con su degradado de identidad (P1-8 / ronda 10)
    assert.ok(reglas.some((x) =>
        /linear-gradient\(135deg, #00f0ff, #bd00ff, #ff007b\)/.test(x.regla)
        && /background-clip: text/.test(x.regla)),
        'se perdió el degradado del logo en escritorio');

    // Móvil: el logo completo queda fuera de la top bar — no solo su degradado
    const enMovil = [...cuerpoEn(css, 768).matchAll(/\.logo-title \{[^}]*\}/g)].map((x) => x[0]);
    assert.ok(enMovil.some((r) => /display: none;/.test(r)),
        'falta la regla que quita el logo de la top bar en ≤768px');

    // La regla que lo oculta va después de la del degradado (gana por orden)
    const oculto = reglas.find((x) => /display: none;/.test(x.regla));
    const conGrad = reglas.find((x) => /linear-gradient/.test(x.regla));
    assert.ok(oculto && conGrad && oculto.i > conGrad.i,
        'la regla móvil del logo debe ir después de la del degradado');
});

// --- Cierre ----------------------------------------------------------------

test('Cierre: las 4 páginas piden styles.css?v=13', () => {
    const paginas = ['index.html', 'pages/calculadora.html', 'pages/apuntes.html', 'pages/social.html'];
    for (const archivo of paginas) {
        const html = leer(archivo);
        assert.ok(/href="[^"]*styles\.css\?v=13"/.test(html), `${archivo} no tiene ?v=13`);
        assert.ok(!/styles\.css\?v=(?!13)\d/.test(html), `${archivo} sigue en una versión vieja`);
    }
});

// ============================================================================
// Nota (P1-6, fondo de 316KB): img/bgWoMiku.webp NO está sin uso: es el
// fondo con parallax de 404.html (línea 38, .bg-layer). Solo se descarga en
// esa página, así que no entra en el peso de Apuntes ni del móvil normal.
// Borrarlo sin tocar 404.html rompería su fondo; si el equipo quiere, es un
// cambio aparte: quitar la url() del 404 y sustituirlo por color/gradiente.
// ============================================================================
