'use strict';
// ============================================================================
// Tests de la ronda 6 (13-nov): documento "Portal Numérico — Cambios CSS v2".
// Cubre: §3.1 restauración de #FF007B/#BD00FF en sus reglas, §3.2 distinción
// por sección (Misión/Visión y pills en magenta), §3.3 un color por método
// (JS + CSS + gráfica), §3.4 tarjetas con tinte/franja/halo, §3.5 :root final
// y el bump ?v=8 en las 4 páginas (ronda 9).
// Ejecutar con:  node --test tests/*.test.js
// ============================================================================

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const leer = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8');

// --- §3.1 ------------------------------------------------------------------

test('§3.1: #FF007B/#BD00FF restaurados y acotados a sus reglas', () => {
    const css = leer('css', 'styles.css').toLowerCase();

    // 1) El degradado del título ITERA
    assert.match(css, /\.landing-title \{[^}]*linear-gradient\(135deg, #00f0ff, #bd00ff, #ff007b\)/,
        'el degradado de .landing-title debe ser #00F0FF → #BD00FF → #FF007B');

    // 2) Títulos de las tarjetas de la landing
    assert.match(css, /\.card-title--violet \{\s*color: #bd00ff;/);
    assert.match(css, /\.card-title--magenta \{\s*color: #ff007b;/);

    // 3) Instagram / TikTok: icono y borde de la tarjeta con su color de marca
    assert.match(css, /\.red-icon--instagram \{[^}]*color: #ff007b;/);
    assert.match(css, /\.red-icon--instagram \{[^}]*background: rgba\(255, 0, 123, 0\.12\)/);
    assert.match(css, /\.red-icon--tiktok \{[^}]*color: #bd00ff;/);
    assert.match(css, /\.red-icon--tiktok \{[^}]*background: rgba\(189, 0, 255, 0\.12\)/);
    assert.match(css, /\.red-card--instagram \{\s*border-left: 3px solid #ff007b;/);
    assert.match(css, /\.red-card--tiktok \{\s*border-left: 3px solid #bd00ff;/);

    // 4) Esos dos hex no se esparcen: solo viven en las reglas de §3.1, en el
    //    borde de la tarjeta de la landing (§3.4) y en el logo del header
    //    (v5 P1-8: mismo degradado que .landing-title).
    const permitidas = [
        '.landing-title', '.logo-title',
        '.card-title--violet', '.card-title--magenta',
        '.red-card--instagram', '.red-card--tiktok',
        '.red-icon--instagram', '.red-icon--tiktok',
        '.card-landing', '.card-landing:hover',
    ];
    const bloques = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
    let vistas = 0;
    for (const b of bloques) {
        if (!/#ff007b|#bd00ff/.test(b[2])) continue;
        vistas += 1;
        const selector = b[1].trim().split('\n').pop().trim();
        assert.ok(permitidas.includes(selector),
            `el color de marca vive fuera de sus reglas (selector "${selector}")`);
    }
    assert.ok(vistas >= 8, `faltan reglas con el color de marca (hay ${vistas})`);
});

// --- §3.2 ------------------------------------------------------------------

test('§3.2: Conócenos en magenta (Misión/Visión y pills del equipo)', () => {
    const css = leer('css', 'styles.css');

    // Títulos Misión/Visión con el magenta de la sección
    assert.match(css, /\.mision-card--mision h2\.mision-title,[\s\S]*?color: var\(--accent-pink\)/);
    assert.match(css, /\.mision-card--vision h2\.mision-title,[\s\S]*?color: var\(--accent-pink\)/);
    assert.ok(!/\.mision-card--mision h2\.mision-title,[\s\S]{0,80}color: #a855f7/.test(css),
        'Misión/Visión siguen en violeta');

    // Pills del equipo: tinte magenta + hover
    assert.match(css, /\.badge-equipo \{[^}]*background: rgba\(236, 72, 153, 0\.1\)/);
    assert.match(css, /\.badge-equipo \{[^}]*border: 1px solid rgba\(236, 72, 153, 0\.35\)/);
    assert.match(css, /\.badge-equipo:hover \{[^}]*border-color: var\(--accent-pink\)/);
    assert.match(css, /\.badge-equipo:hover \{[^}]*box-shadow: 0 0 16px rgba\(236, 72, 153, 0\.3\)/);
});

// --- §3.3 ------------------------------------------------------------------

test('§3.3: el selector escribe data-metodo y el inline del borde desaparece', () => {
    const js = leer('js', 'punto-fijo.js');
    assert.match(js, /dataset\.metodo\s*=\s*metodo/,
        'alternarMetodoUI() debe marcar el método activo en .container');

    const html = leer('pages', 'calculadora.html');
    assert.match(html, /<select id="metodo-selector" onchange="alternarMetodoUI\(\)">/,
        'el select no debe llevar border-color en línea (nunca se vería el borde por método)');
    assert.ok(!html.includes('style="border-color: #00f0ff;"'),
        'sigue el style="border-color: #00f0ff;" inline');
});

test('§3.3: bloque CSS de --method con un color por método', () => {
    const css = leer('css', 'styles.css');

    assert.match(css, /\.container \{ --method: #22d3ee; \}/, 'falta el fallback cian');

    const mapa = {
        biseccion: '--m-biseccion',
        puntofijo: '--m-puntofijo',
        newton: '--m-newton',
        taylor: '--m-taylor',
        lagrangelineal: '--m-lagrange-lineal',
        lagrangepoly: '--m-lagrange-poli',
        simpson: '--m-simpson',
    };
    for (const [metodo, token] of Object.entries(mapa)) {
        assert.match(css, new RegExp(
            `\\.container\\[data-metodo="${metodo}"\\]\\s*\\{\\s*--method: var\\(${token}\\)`),
        `falta el mapeo ${metodo} → ${token}`);
    }

    // Elementos que cambian con el método (el borde y el glow del botón van
    // con !important: los estilos base de select/button los llevan)
    assert.match(css, /#metodo-selector \{[^}]*border-color: var\(--method\) !important/);
    assert.match(css, /#metodo-selector \{[^}]*color-mix\(in srgb, var\(--method\) 35%/);
    assert.match(css, /\.container:has\(#metodo-selector\) h1 \{ color: var\(--method\); \}/);
    assert.match(css, /\.resumen-card \.resumen-icon \{ color: var\(--method\); \}/);
    assert.match(css, /\.container:has\(#metodo-selector\) button\[type="submit"\] \{[^}]*color-mix\(in srgb, var\(--method\) 45%, transparent\) !important/);
    assert.match(css, /\.container:has\(#metodo-selector\) button\[type="submit"\]:hover \{[^}]*color-mix\(in srgb, var\(--method\) 65%, transparent\) !important/);
    assert.match(css, /\.resumen-card::before \{[^}]*background: linear-gradient\(90deg, transparent, var\(--method\), transparent\)/);
    assert.match(css, /\.grafica-canvas \{[^}]*border-color: color-mix\(in srgb, var\(--method\) 40%, var\(--border-color\)\)/);

    // Tokens de método en :root
    const raiz = /:root \{[\s\S]*?\n\}/.exec(css)[0];
    const hexes = {
        '--m-biseccion': '#22d3ee',
        '--m-puntofijo': '#a855f7',
        '--m-newton': '#f59e0b',
        '--m-taylor': '#34d399',
        '--m-lagrange-lineal': '#ec4899',
        '--m-lagrange-poli': '#60a5fa',
        '--m-simpson': '#a3e635',
    };
    for (const [token, hex] of Object.entries(hexes)) {
        assert.match(raiz, new RegExp(`${token}:\\s*${hex}`), `falta ${token}: ${hex}`);
    }
});

test('§3.3: la curva de la gráfica toma el color de --method', () => {
    const js = leer('js', 'graficadora.js');
    assert.match(js, /getPropertyValue\('--method'\)/,
        'la curva principal debe leer --method del contenedor');
    assert.match(js, /color: colorMetodo/);
    assert.ok(!/const curvas = \[\{ expr, color: '#00f0ff'/.test(js),
        'la curva sigue fija en cian');
    // Sin CSS utilizable (tests) se mantiene el respaldo cian
    assert.match(js, /\|\| '#00f0ff'/);
});

// --- §3.4 ------------------------------------------------------------------

test('§3.4: tarjetas de la landing con tinte y borde en degradado continuo', () => {
    const css = leer('css', 'styles.css');

    const reglas = [...css.matchAll(/\.card-landing \{[^}]*\}/g)].map((m) => m[0]);
    const borde = reglas.find((r) => r.includes('border: 3px solid transparent'));
    assert.ok(borde, 'falta el borde de 3px transparente (doble fondo)');
    // El tinte va por DENTRO (padding-box) y el degradado por DEBAJO del
    // borde (border-box): así el borde sigue el border-radius en las 4 esquinas
    assert.match(borde, /linear-gradient\(160deg, rgba\(255, 255, 255, 0\.045\), rgba\(255, 255, 255, 0\.015\)\) padding-box/);
    assert.match(borde, /linear-gradient\(90deg, #00f0ff, #bd00ff, #ff007b\) border-box/);
    // Y ENTRE MEDIAS una capa opaca: el tinte es translúcido y sin base
    // opaca el degradado se ve por toda la tarjeta (texto ilegible)
    assert.match(borde, /linear-gradient\(var\(--card-bg\), var\(--card-bg\)\) padding-box/,
        'falta la capa opaca que tapa el degradado por dentro');
    assert.match(borde, /position: relative/);
    assert.match(borde, /overflow: hidden/);

    // v5 P1-9: fuera las dos piezas sueltas que cortaban la esquina
    assert.ok(!css.includes('.card-landing::before'), 'sigue la franja superior suelta');
    assert.ok(!/\.card-landing--(?:cyan|violet|magenta)[^{]*\{\s*border-left/.test(css),
        'sigue el border-left por variante');
});

test('§3.4: notas y resumen en superficie elevada, sin pisar tintes de estado', () => {
    const css = leer('css', 'styles.css');

    // Superficie elevada (las landing y los estados quedan excluidos)
    assert.match(css, /\.apunte-card:not\(\.card-landing\),\s*\.resumen-card:not\(\.resumen-card--ok\):not\(\.resumen-card--warn\):not\(\.resumen-card--error\) \{\s*background: var\(--card-bg-2\)/);
    assert.match(css, /\.apunte-card:not\(\.card-landing\) \{\s*border-left: 3px solid var\(--accent-violet\)/);

    // Los estados conservan su tinte (el ESTADO no puede quedar plano)
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const [estado, rgba] of [
        ['ok', 'rgba(52, 211, 153, 0.06)'],
        ['warn', 'rgba(255, 136, 77, 0.06)'],
        ['error', 'rgba(244, 63, 94, 0.08)'],
    ]) {
        assert.match(css, new RegExp(`\\.resumen-card--${estado} \\{[^}]*background: ${esc(rgba)}`),
            `el estado ${estado} perdió su tinte`);
    }

    // Y las tarjetas de la landing conservan su tinte en degradado
    assert.ok(!/\.apunte-card,\s*\.resumen-card \{[^}]*background: var\(--card-bg-2\)/.test(css),
        'sin las excepciones, el tinte de las landing y los estados se pierde');
});

test('§3.4: halo de color detrás del contenedor, uno por sección', () => {
    const css = leer('css', 'styles.css');

    // Ronda 9: 3 paradas de gradiente —color 0.26, color 0.16 y
    // transparente al 80%— en el color de cada sección
    assert.match(css, /\.main-container::before \{[\s\S]*?radial-gradient\(ellipse at center, rgba\(34, 211, 238, 0\.26\) 0%, rgba\(34, 211, 238, 0\.16\) 45%, transparent 80%\)[\s\S]*?pointer-events: none/);
    // Detrás del contenido (el halo no debe teñir el texto de la tarjeta)
    const halo = /\.main-container::before \{[\s\S]*?\}/.exec(css)[0];
    assert.match(halo, /z-index: -1/);
    // Ronda 9: sigue a la ventana (fixed); v5 P0-4: 100vw (no 2000px fijos,
    // que en fullscreen dejaban el lateral del degradado al descubierto)
    assert.match(halo, /position: fixed;/);
    assert.match(halo, /top: 0;/);
    assert.match(halo, /width: 100vw/);
    assert.ok(!/width: 2000px/.test(halo), 'quedó el ancho fijo de 2000px');
    assert.match(halo, /height: 100vh/);

    assert.match(css, /body:has\(#lista-apuntes\) \.main-container::before \{[^}]*rgba\(168, 85, 247, 0\.26\)[^}]*rgba\(168, 85, 247, 0\.16\)/,
        'Apuntes debe tener halo violeta');
    assert.match(css, /body:has\(\.redes-section\) \.main-container::before \{[^}]*rgba\(236, 72, 153, 0\.26\)[^}]*rgba\(236, 72, 153, 0\.16\)/,
        'Conócenos debe tener halo magenta');
});

// --- §3.5 ------------------------------------------------------------------

test('§3.5: :root final con la paleta v2', () => {
    const css = leer('css', 'styles.css').toLowerCase();
    const raiz = /:root \{[\s\S]*?\n\}/.exec(css)[0];

    const tokens = {
        '--card-bg-2': '#131c2e',
        '--text-muted': '#c6cdda',
        '--text-faint': '#8b94a5',
        '--accent-violet': '#a855f7',
        '--accent-pink': '#ec4899',
        '--success': '#34d399',
        '--error': '#f43f5e',
        '--warn': '#ff884d',
    };
    for (const [token, hex] of Object.entries(tokens)) {
        assert.match(raiz, new RegExp(`${token}:\\s*${hex}`), `falta ${token}: ${hex}`);
    }

    // Fuera: índigo, el alias --accent-2 y la paleta retirada
    assert.ok(!css.includes('--accent-indigo'), 'el índigo sigue en la paleta');
    assert.ok(!css.includes('--accent-2'), 'sigue el alias --accent-2');
    for (const retirado of ['#00ff78', '#818cf8', '#fbbf24', '#ff4d4d']) {
        assert.ok(!css.includes(retirado), `queda el color retirado ${retirado}`);
    }
});

// --- Bump de versión -------------------------------------------------------

test('Las 4 páginas piden styles.css?v=9 (ninguna sirve CSS viejo)', () => {
    const paginas = ['index.html', 'pages/calculadora.html', 'pages/apuntes.html', 'pages/social.html'];
    for (const archivo of paginas) {
        const html = leer(archivo);
        assert.ok(/href="[^"]*styles\.css\?v=9"/.test(html),
            `${archivo} no tiene styles.css?v=9`);
        assert.ok(!/href="[^"]*styles\.css(?!\?v=9)/.test(html),
            `${archivo} sigue apuntando a styles.css sin ?v=9`);
    }
});
