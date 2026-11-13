'use strict';
// ============================================================================
// Tests de la ronda 5 (13-nov): documento "Cambios de CSS — Portal Numérico".
// Cubre: paleta reducida (sin colores retirados) + tokens nuevos, ancho de
// escritorio (1180px, sin scroll interno), tarjeta ESTADO a todo lo ancho
// (CSS + clase en el HTML del resumen), botones unificados en cian, Apuntes
// en grid de 2 columnas, texto sin justificar/guionar, header unificado con
// footer en las 4 páginas, buscador movido al cuerpo, placeholder cortado,
// gráfica más alta con etiquetas legibles y fondo con menos ruido.
// Ejecutar con:  node --test tests/*.test.js
// ============================================================================

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { correrBiseccion } = require('./helpers/env');

const RAIZ = path.join(__dirname, '..');
const leer = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8');

// --- Sección 1: paleta -----------------------------------------------------

test('CSS: tokens nuevos de la paleta y colores retirados fuera del archivo', () => {
    const css = leer('css', 'styles.css').toLowerCase();

    for (const token of ['--text-faint:', '--accent-bright:', '--accent-2:',
        '--success:', '--error:', '--warn:']) {
        assert.ok(css.includes(token), `falta el token ${token}`);
    }
    // El índigo se retira pero el nombre queda por compatibilidad, apuntando al cian
    assert.match(css, /--accent-indigo:\s*#22d3ee/);
    assert.match(css, /--text-muted:\s*#b8c0ce/, 'texto secundario debe subir de contraste');

    for (const retirado of ['#ff007b', '#bd00ff', '#00ff78', '#818cf8', '#fbbf24', '#ff4d4d']) {
        assert.ok(!css.includes(retirado), `queda el color retirado ${retirado}`);
    }
});

// --- P0-1 ------------------------------------------------------------------

test('P0-1: bloque de escritorio ≥1024px con columna de 1180px y altura natural', () => {
    const css = leer('css', 'styles.css');
    const m = /@media \(min-width: 1024px\) \{[\s\S]*?\n\}/.exec(css);
    assert.ok(m, 'falta el media query de escritorio (min-width: 1024px)');
    const escritorio = m[0];

    assert.match(escritorio, /\.container,[\s\S]*?max-width: 1180px/);
    assert.match(escritorio, /max-height: none/);
    assert.match(escritorio, /overflow-y: visible/);
    assert.match(escritorio, /\.main-container \{\s*padding: 40px 32px/);
    // P1-2: etiquetas en una sola línea solo en escritorio
    assert.match(escritorio, /label \{\s*white-space: nowrap/);
    // P2-3: gráfica más alta solo en escritorio
    assert.match(escritorio, /\.grafica-canvas \{\s*height: 320px/);

    // Los media queries de móvil siguen intactos (no se tocan)
    for (const q of ['768px', '640px', '600px', '480px']) {
        assert.ok(css.includes(`(max-width: ${q})`), `se perdió el media query de ${q}`);
    }
});

// --- P0-2 ------------------------------------------------------------------

test('P0-2: la tarjeta ESTADO se crea con la clase resumen-card--estado', () => {
    const r = correrBiseccion({ expr: 'x^2 - 4', a: 1, b: 3, criterio: 'tolerancia', valor: 0.001 });
    assert.match(r.resumen,
        /class="resumen-card resumen-card--estado resumen-card--(ok|warn|error)"/,
        'falta la clase resumen-card--estado en el HTML de la tarjeta');

    const css = leer('css', 'styles.css');
    assert.match(css, /\.resumen-card--estado \{[^}]*grid-column: 1 \/ -1/,
        'ESTADO debe ocupar toda la fila (antes quedaba huérfana en la columna 1)');
});

// --- P0-3 ------------------------------------------------------------------

test('P0-3: primario en degradado cian y secundarios en outline cian', () => {
    const css = leer('css', 'styles.css');

    assert.match(css, /button\[type="submit"\] \{[\s\S]*?linear-gradient\(135deg, #00f0ff, #22d3ee\)/,
        'el botón primario debe ser degradado cian (antes blanco sólido)');
    assert.ok(!/button\[type="submit"\] \{[\s\S]*?background: #ffffff/.test(css),
        'sigue el blanco fuera de paleta');
    assert.match(css, /button\.btn-graficar \{[\s\S]*?border: 1px solid #22d3ee/);
    assert.match(css, /\.btn-outline \{[\s\S]*?color: #22d3ee/);
});

// --- P1-1 ------------------------------------------------------------------

test('P1-1: Apuntes en grid de 2 columnas desde 768px', () => {
    const css = leer('css', 'styles.css');
    assert.match(css, /@media \(min-width: 768px\) \{\s*#apuntes-remotos \{[\s\S]*?repeat\(2, 1fr\)/);
    assert.match(css, /#apuntes-remotos \.apunte-card \{[^}]*margin-bottom: 0/);
});

// --- P1-2 ------------------------------------------------------------------

test('P1-2: textos sin justificar ni guionar', () => {
    const css = leer('css', 'styles.css');

    assert.match(css, /\.card-desc \{[\s\S]*?text-align: left;[\s\S]*?hyphens: none;/);
    assert.match(css, /\.intro-conocenos p \{[\s\S]*?text-align: left;/);
    assert.ok(!css.includes('text-align: justify'), 'quedó texto justificado');
    assert.ok(!css.includes('hyphens: auto'), 'quedó guionado automático');
});

// --- P1-3 ------------------------------------------------------------------

test('P1-3: footer en las 4 páginas', () => {
    const paginas = ['index.html', 'pages/calculadora.html', 'pages/apuntes.html', 'pages/social.html'];
    for (const archivo of paginas) {
        const html = leer(archivo);
        assert.match(html, /<footer class="site-footer">Itera · Portal Numérico — Métodos Numéricos<\/footer>/,
            `falta el footer en ${archivo}`);
        assert.ok(html.indexOf('<footer') < html.indexOf('</body>'), `footer mal colocado en ${archivo}`);
    }
});

test('P1-3: el buscador de Apuntes salió del header y encabeza la lista', () => {
    const html = leer('pages', 'apuntes.html');
    const header = /<header>[\s\S]*?<\/header>/.exec(html)[0];

    assert.ok(!header.includes('search-box'), 'el buscador sigue en el header');
    assert.ok(header.includes('nav-links'), 'el header debe quedar con logo + navegación');

    const buscador = html.indexOf('id="buscador"');
    const lista = html.indexOf('id="lista-apuntes"');
    assert.ok(buscador > -1, 'desapareció el input de búsqueda');
    assert.ok(buscador < lista, 'el buscador debe ir arriba de #lista-apuntes');
});

// --- P1-4 ------------------------------------------------------------------

test('P1-4: CSS de equipo listo (grid, tarjeta e iniciales)', () => {
    const css = leer('css', 'styles.css');
    for (const regla of ['.equipo-grid {', '.equipo-card {', '.equipo-iniciales {']) {
        assert.ok(css.includes(regla), `falta la regla ${regla}`);
    }
    assert.match(css, /\.equipo-iniciales \{[\s\S]*?linear-gradient\(135deg, #00f0ff, #22d3ee\)/);
});

// --- P2-1 ------------------------------------------------------------------

test('P2-1: el fondo baja el ruido (opacidad, densidad y colores en paleta)', () => {
    const css = leer('css', 'styles.css');
    assert.match(css, /#particle-canvas \{[^}]*opacity: 0\.45/);

    const js = leer('js', 'canvas-animation.js').replace(/\/\/[^\n]*/g, '');
    // Los símbolos matemáticos (π, lim, Σ…) viven dentro del canvas: la
    // densidad se baja ahí (7 → 5 en escritorio).
    assert.match(js, /IS_SMALL_SCREEN \? 4 : 5/);
    for (const retirado of ['#bd00ff', '#ff007b', '#7000ff']) {
        assert.ok(!js.includes(retirado), `color fuera de paleta en partículas: ${retirado}`);
    }
});

// --- P2-2 ------------------------------------------------------------------

test('P2-2: hover generalizado a las tarjetas y foco visible por teclado', () => {
    const css = leer('css', 'styles.css');

    assert.match(css, /\.card:hover,[\s\S]*?\.apunte-card:hover,[\s\S]*?\.resumen-card:hover \{[\s\S]*?border-color: rgba\(34, 211, 238, 0\.4\)/);
    assert.match(css, /button:focus-visible[\s\S]*?outline: 2px solid #22d3ee/);
    // El outline debe ganarle a los outline: none de los focos de formulario
    assert.match(css, /input\[type="text"\]:focus-visible/);
    assert.match(css, /select:focus-visible/);
});

// --- P2-3 ------------------------------------------------------------------

test('P2-3: la gráfica toma el alto del CSS y las etiquetas tienen margen', () => {
    const js = leer('js', 'graficadora.js');

    // El alto en dibujo sale del CSS (280px / 320px en escritorio), porque el
    // style.height en línea pisaba la regla .grafica-canvas { height: 320px }.
    assert.match(js, /grafAltoDelCSS\(canvas\)/);
    assert.match(js, /const alto = grafAltoDelCSS\(canvas\)/);

    assert.match(js, /ctx\.font = '11px monospace'/, 'la fuente de los ejes debe ser 11px');
    assert.ok(!/toPrecision\(4\)\), w - 4/.test(js), 'la etiqueta del eje Y sigue pegada al borde');
    assert.ok(js.includes('w - 10'), 'las etiquetas deben reservar ~10px de margen derecho');
});

// --- P2-4 ------------------------------------------------------------------

test('P2-4: placeholder del título de apunte acortado', () => {
    const html = leer('pages', 'apuntes.html');
    assert.ok(html.includes('placeholder="Título del tema"'), 'falta el placeholder cortado');
    assert.ok(!html.includes('Teorema de Bolzano'), 'sigue el placeholder largo que se cortaba');
});
