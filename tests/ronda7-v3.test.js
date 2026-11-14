'use strict';
// ============================================================================
// Tests de la ronda 7 (13-nov): documento "Portal Numérico — Correcciones
// visuales v3" + las 2 peticiones directas del equipo (bordes/centrado del
// landing y aire entre las cards de Apuntes).
// Cubre: P0-1 tarjetas de Taylor en móvil, P0-2 icono de ESTADO, P0-3
// etiquetas de la gráfica, P1-2 color por método completo, P1-3 auto-zoom de
// Taylor, P1-4 CRITERIO apilado, P2-1 a P2-8 y las peticiones nuevas.
// Ejecutar con:  node --test tests/*.test.js
// ============================================================================

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const leer = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8');

// --- P0-1 ------------------------------------------------------------------

test('P0-1: Taylor en móvil pasa a 2 columnas y los números parten', () => {
    const css = leer('css', 'styles.css');

    // El bloque móvil tiene que venir DESPUÉS de .resumen-grid--6 (línea 1609)
    // para poder pisarlo.
    const idxBase = css.indexOf('.resumen-grid--6 {');
    const idxMovil = css.indexOf('@media (max-width: 768px)', idxBase);
    assert.ok(idxMovil > -1, 'falta el media query móvil para .resumen-grid--6');
    const bloque = css.slice(idxMovil, idxMovil + 2200);
    assert.match(bloque, /\.resumen-grid--6 \{\s*grid-template-columns: repeat\(2, 1fr\);/);
    // La última tarjeta (Centro a) y la principal (Aproximación P_n) a todo ancho
    assert.match(bloque, /\.resumen-grid--6 \.resumen-card--raiz,\s*\.resumen-grid--6 \.resumen-card:last-child \{\s*grid-column: 1 \/ -1;/);
    // white-space: nowrap era lo que cortaba "2.718281828" en "666666666";
    // v4: break-word (no "anywhere") para no partir números por la mitad
    assert.match(bloque, /\.resumen-grid--6 \.resumen-value \{\s*white-space: normal;(?:[^{}]|\n)*?overflow-wrap: break-word;(?:[^{}]|\n)*?font-size: 0\.8rem;/);
    assert.match(bloque, /\.resumen-grid--6 \.resumen-label \{\s*letter-spacing: 0\.5px;/);
});

// --- P0-2 ------------------------------------------------------------------

test('P0-2: el icono de ESTADO no tapa la etiqueta', () => {
    const css = leer('css', 'styles.css');

    assert.match(css, /\.resumen-card--estado \{\s*gap: 10px;/);
    assert.match(css, /\.resumen-card--estado \.resumen-icon \{\s*flex: 0 0 auto;\s*margin-bottom: 0;/);
    assert.match(css, /\.resumen-card--estado \.resumen-label \{\s*flex: 0 0 auto;\s*margin-bottom: 0;/);
    // El valor largo se parte (white-space: normal) y no aprieta a "ESTADO"
    assert.match(css, /\.resumen-card--estado \.resumen-value \{[\s\S]*?white-space: normal;/);
});

// --- P0-3 ------------------------------------------------------------------

test('P0-3: etiquetas de la gráfica con contraste, sin recorte y con chip', () => {
    const js = leer('js', 'graficadora.js');

    // 1) Ejes: 12px y gris claro (antes 11px y rgba(156,163,175,0.9))
    assert.ok(js.includes("ctx.font = '12px monospace'"), 'falta la fuente 12px de los ejes');
    assert.ok(js.includes('rgba(229, 231, 235, 0.95)'), 'falta el gris claro de los ejes');
    assert.ok(!js.includes('rgba(156, 163, 175, 0.9)'), 'quedó el gris lavado viejo');

    // 2) La etiqueta Y nunca se dibuja pegada al borde superior
    assert.ok(js.includes('const ly = Math.max(py, 12);'), 'falta el clamp de la etiqueta Y');

    // 3) Chip detrás de X, a/b, puntos y marcas (v4: chip VISIBLE, fondo
    //    claro con borde — el negro de la v3 era invisible sobre el lienzo)
    const chips = (js.match(/grafChipEtiqueta\(/g) || []).length;
    assert.ok(chips >= 5, `se esperaban chips detrás de las etiquetas (hay ${chips})`);
    assert.ok(js.includes("ctx.fillStyle = 'rgba(255, 255, 255, 0.14)'"), 'falta el fondo claro del chip');
    assert.ok(js.includes("ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'"), 'falta el borde del chip');
    assert.ok(!js.includes('rgba(7, 9, 14, 0.9)'), 'quedó el chip negro invisible');

    // 4) Las etiquetas del eje X se dibujan DESPUÉS del intervalo punteado
    const idxIntervalo = js.indexOf('// --- Intervalo [a, b] ---');
    const idxEjeX = js.indexOf('// --- Etiquetas del eje X: al final');
    assert.ok(idxEjeX > idxIntervalo, 'las etiquetas X deben dibujarse después del intervalo');
    assert.ok(js.includes('const etiquetasEjeX = [];'), 'falta la colecta de etiquetas X');

    // 5) 'a'/'b' a y=18 con chip detrás
    assert.ok(js.includes("ctx.fillText('a', X(a), 18);"), "'a' debe ir a y=18");
    assert.ok(js.includes("ctx.fillText('b', X(b), 18);"), "'b' debe ir a y=18");

    // 6) Dos marcas en el mismo punto no se superponen (2ª etiqueta +14px)
    assert.ok(js.includes('solapa ? 14 : 0'), 'falta el desplazamiento de la 2ª marca');
    assert.ok(js.includes('desplazY = 0'), 'grafMarcarPunto debe aceptar el desplazamiento');
});

// --- P1-2 ------------------------------------------------------------------

test('P1-1: dataset.metodo se escribe al cambiar y al cargar la página', () => {
    // El fix de P1-1 ya vive en el código (el diagnóstico del documento decía
    // que solo lo hacía Punto Fijo): se cubre como regresión.
    const js = leer('js', 'punto-fijo.js');
    assert.ok(js.includes('contenedorMetodo.dataset.metodo = metodo'),
        'alternarMetodoUI debe escribir dataset.metodo (de ahí sale --method)');
    assert.ok(/addEventListener\('DOMContentLoaded'[\s\S]{0,400}?alternarMetodoUI\(\)/.test(js),
        'alternarMetodoUI debe correr una vez al cargar, para fijar --method inicial');
    const html = leer('pages', 'calculadora.html');
    assert.ok(html.includes('onchange="alternarMetodoUI()"'),
        'el selector debe seguir llamando a alternarMetodoUI');
});

test('P1-2: botón, GRAFICAR, teclado, etiquetas, iconos y foco siguen a --method', () => {
    const css = leer('css', 'styles.css');

    // Iconos de las 4 primeras tarjetas (antes fijos: morado/rosa/cian/verde)
    assert.match(css, /\.resumen-card:nth-child\(1\) i,\s*\.resumen-card:nth-child\(2\) i,\s*\.resumen-card:nth-child\(3\) i,\s*\.resumen-card:nth-child\(4\) i \{\s*color: var\(--method\);/);

    // Relleno del botón CALCULAR con el color del método (!important: el base
    // button[type="submit"] también lo lleva). Se mezcla hacia blanco para
    // que el texto #06222B conserve contraste ≥ 4.5:1.
    // (Ojo: la primera regla con ese selector es la del box-shadow de la
    //  ronda 6, así que se busca la que lleva `background`.)
    const reglas = [...css.matchAll(/\.container:has\(#metodo-selector\) button\[type="submit"\] \{[^}]*\}/g)];
    const submit = reglas.map((m) => m[0]).find((r) => r.includes('background:'));
    assert.ok(submit, 'falta la regla de fondo del botón CALCULAR por método');
    assert.match(submit, /background: linear-gradient\([\s\S]*?var\(--method\)[\s\S]*?\) !important;/);
    assert.ok(submit.includes('color-mix(in srgb, var(--method) 85%, #FFFFFF)'),
        'la 1ª parada debe ser el método aclarado (no #06222B: contraste 2:1)');
    assert.ok(!/color-mix\(in srgb, var\(--method\) \d+%, #06222B\)/.test(css),
        'mezclar hacia #06222B deja el texto ilegible');

    // GRAFICAR, teclado y etiquetas
    assert.match(css, /\.container:has\(#metodo-selector\) button\.btn-graficar \{\s*border-color: var\(--method\);\s*color: var\(--method\);/);
    assert.match(css, /\.container:has\(#metodo-selector\) button\.btn-chip \{[^}]*color: var\(--method\) !important;/);
    assert.match(css, /\.container:has\(#metodo-selector\) label \{\s*color: var\(--method\);/);

    // El anillo de foco sigue al método
    assert.match(css, /\.container:has\(#metodo-selector\)\s+:is\(button, input, select, textarea\):focus-visible \{\s*outline: 2px solid var\(--method/, 'el foco debe seguir al método');
    // ...sin perder el foco de teclado en el selector (box-shadow sin !important)
    assert.match(css, /#metodo-selector \{[^}]*box-shadow: 0 0 0 1px var\(--method\)/);
});

// --- P1-3 ------------------------------------------------------------------

test('P1-3: la gráfica de Taylor hace auto-zoom alrededor de a y x', () => {
    const js = leer('js', 'taylor.js');
    assert.ok(js.includes('const x0 = Math.min(a, x) - 1;'), 'falta el inicio del rango acotado');
    assert.ok(js.includes('const x1 = Math.max(a, x) + 1;'), 'falta el fin del rango acotado');
    assert.ok(js.includes('rango: [x0, x1]'), 'el gráfico debe usar el rango acotado');
    assert.ok(!js.includes('Math.max(5, Math.abs(x - a) * 1.25)'), 'quedó el span amplio viejo');
});

// --- P1-4 ------------------------------------------------------------------

test('P1-4: CRITERIO DE PARO se apila en móvil', () => {
    const css = leer('css', 'styles.css');
    assert.match(css, /@media \(max-width: 768px\) \{\s*\.resumen-card--criterio \{\s*flex-direction: column;\s*align-items: flex-start;\s*gap: 4px;/);
});

// --- P2 --------------------------------------------------------------------

test('P2-1: PUBLICAR APUNTE tiene un degradado visible (3 paradas)', () => {
    const css = leer('css', 'styles.css');
    const regla = /button\[type="submit"\] \{[^}]*\}/.exec(css)[0];
    assert.match(regla, /#00F0FF 0%, #0891B2 55%, #155E75 100%/);
});

test('P2-2: "Buscar apuntes" es un encabezado visible', () => {
    const html = leer('pages', 'apuntes.html');
    assert.ok(!html.includes('class="visually-hidden" for="buscador"'),
        'la etiqueta del buscador sigue oculta');
    assert.ok(html.includes('<label class="apuntes-buscador-label" for="buscador">Buscar apuntes</label>'),
        'falta el encabezado visible del buscador');
    const css = leer('css', 'styles.css');
    assert.match(css, /\.apuntes-buscador-label \{[^}]*display: block;/);
});

test('P2-3: acciones de cada nota en CSS (clase, no cssText) y apiladas en móvil', () => {
    const js = leer('js', 'apuntes.js');
    assert.ok(js.includes("btnContainer.className = 'apunte-acciones'"), 'falta la clase .apunte-acciones');
    assert.ok(!/btnContainer\.style\.cssText/.test(js), 'sigue el cssText en línea del contenedor');

    const css = leer('css', 'styles.css');
    assert.match(css, /\.apunte-acciones \{[^}]*display: flex;\s*gap: 10px;\s*align-items: center;/);
    assert.match(css, /@media \(max-width: 768px\) \{\s*\.apunte-acciones \{\s*flex-direction: column;\s*align-items: stretch;/);
    assert.match(css, /\.apunte-acciones > \* \{\s*width: 100%;\s*text-align: center;/);
});

test('P2-4: el footer de Inicio ya no deja medio bloque vacío', () => {
    const css = leer('css', 'styles.css');
    const footer = /\.footer-landing \{[^}]*\}/.exec(css)[0];
    assert.match(footer, /margin-top: 1\.5rem/);
    assert.match(footer, /padding-top: 1rem/);
});

test('P2-5: el header fijo no tapa encabezados al hacer scroll', () => {
    const css = leer('css', 'styles.css');
    assert.match(css, /h1,\s*h2,\s*h3,\s*\.apuntes-buscador,\s*\.redes-section \{\s*scroll-margin-top: 90px;/);
});

test('P2-7: Apuntes sin hueco ni parpadeo de esqueletos', () => {
    const css = leer('css', 'styles.css');
    assert.match(css, /#apuntes-remotos \.apunte-card \{[\s\S]*?height: auto;/, 'las tarjetas deben medir su contenido');
    assert.ok(!/#apuntes-remotos \.apunte-card \{[\s\S]*?height: 100%/.test(css),
        'sigue height:100% estirando las tarjetas a la fila');

    const js = leer('js', 'apuntes.js');
    assert.ok(js.includes('setTimeout(() => mostrarEsqueletosApuntes(cont, 3), 300)'),
        'los esqueletos deben esperar 300 ms');
    assert.ok(js.includes('clearTimeout(tEsqueleto)'), 'hay que cancelar el timer al llegar la lista');
});

test('P2-8: el hueco de DERIVADA solo existe con contenido', () => {
    const css = leer('css', 'styles.css');
    assert.match(css, /\.preview-fx:empty \{\s*display: none;/);
});

// --- Peticiones nuevas del equipo ------------------------------------------

test('Landing: las 3 tarjetas tienen los mismos bordes que Calculadoras', () => {
    const css = leer('css', 'styles.css');
    assert.match(css, /\.card-landing--cyan,\s*\.card-landing--violet,\s*\.card-landing--magenta \{\s*border-left: 3px solid #00f0ff;/);
    // Ninguna variante conserva su borde propio (violeta) en otra regla posterior
    const idx = css.indexOf('.card-landing--cyan,\n.card-landing--violet,\n.card-landing--magenta');
    assert.ok(idx > -1, 'falta la regla unificada de bordes del landing');
    const despues = css.slice(idx);
    assert.ok(!/\.card-landing--violet \{\s*border-left: 3px solid #a855f7/.test(despues),
        'la tarjeta de Apuntes sigue con borde violeta');
});

test('Landing: el contenedor queda completamente centrado en ambos ejes', () => {
    const css = leer('css', 'styles.css');
    const reglas = [...css.matchAll(/\.container--landing \{[^}]*\}/g)].map((m) => m[0]);
    assert.ok(reglas.length >= 2, 'deben quedar la regla base y la del centrado v3');
    const centrado = reglas.find((r) => r.includes('margin-block: auto'));
    assert.ok(centrado, 'falta margin-block: auto (centrado vertical seguro)');
    assert.match(centrado, /margin-inline: auto/);
});

test('Apuntes: más espacio entre las cards (gap 32px en PC, 28px en móvil)', () => {
    const css = leer('css', 'styles.css');
    assert.match(css, /#apuntes-remotos \{[\s\S]*?gap: 32px;/);
    assert.match(css, /@media \(max-width: 767px\) \{\s*#apuntes-remotos \.apunte-card \{\s*margin-bottom: 28px;/);
});
