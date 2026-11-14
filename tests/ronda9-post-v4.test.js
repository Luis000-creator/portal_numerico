'use strict';
// ============================================================================
// Tests de la ronda 9 (13-nov): feedback post-v4 ("lo que sigue mal o a medias
// en PC") sobre la base "Ronda 8: v4" (6f3d166). Cubre:
//   1) chevron del select que se repetía al enfocar (background-color, no
//      shorthand)                  2) 'a'/'b' recortadas arriba (y=32)
//   3) el "0" del origen, aunque x=0 esté fuera del lienzo
//   4) pastilla de la gráfica realmente clara con texto oscuro
//   5) halo ancho (2000×100vh) con gradiente de 3 paradas
//   6) landing: centrado + sticky footer (opción híbrida)
//   7) espacio antes de la "ó" del criterio en escritorio
//   8) bump ?v=8 en las 4 páginas (v5: la lista de pendientes lo sube a ?v=9;
//      los tests 5, 7 y 8 se actualizaron aquí porque la v5 los cambia)
// Ejecutar con:  node --test tests/*.test.js
// ============================================================================

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const leer = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8');

// --- 1) Chevron -------------------------------------------------------------
// Regresión de la v4: al enfocar, el shorthand `background:` de la regla de
// foco reseteaba background-repeat/position/size y el SVG del chevron se
// repetía por todo el campo (tachando el texto); en Bisección la imagen
// desaparecía porque ahí no hay regla de background-image por método.

test('1: el foco del select cambia solo el color, sin resetear el chevron', () => {
    const css = leer('css', 'styles.css');

    const foco = /input\[type="text"\]:focus,[\s\S]*?select:focus \{[^}]*\}/.exec(css);
    assert.ok(foco, 'falta la regla de foco de inputs/select');
    assert.match(foco[0], /background-color: rgba\(30, 41, 59, 0\.9\) !important;/,
        'el foco debe usar background-color (no el shorthand background)');
    assert.ok(!/background:\s*rgba\(30, 41, 59, 0\.9\)/.test(foco[0]),
        'quedó el shorthand background: que borra la repetición/posición/size');

    // El select base conserva la imagen con repeat/position fijos (§04)
    assert.match(css, /select \{[^}]*no-repeat right 12px center/);
});

test('1: el chevron por método sigue pintando su color', () => {
    const css = leer('css', 'styles.css');
    const chevrons = { puntofijo: 'a855f7', newton: 'f59e0b', taylor: '34d399', lagrangelineal: 'ec4899', lagrangepoly: '60a5fa', simpson: 'a3e635' };
    for (const [metodo, hex] of Object.entries(chevrons)) {
        const selector = `.container[data-metodo="${metodo}"] select {`;
        const i = css.indexOf(selector);
        assert.ok(i >= 0, `falta la regla de ${metodo}`);
        const bloque = css.slice(i, css.indexOf('}', i));
        assert.ok(bloque.includes(`fill='%23${hex}'`),
            `falta el chevron ${hex} de ${metodo}`);
    }
});

// --- 2) a / b ---------------------------------------------------------------

test('2: las etiquetas a/b bajan a y=32 para no quedar recortadas arriba', () => {
    const js = leer('js', 'graficadora.js');
    assert.ok(js.includes("grafChipEtiqueta(ctx, X(a) - 6, 20, 12)"), 'el chip de a debe ir a y=20');
    assert.ok(js.includes("grafChipEtiqueta(ctx, X(b) - 6, 20, 12)"), 'el chip de b debe ir a y=20');
    assert.ok(js.includes("ctx.fillText('a', X(a), 32)"));
    assert.ok(js.includes("ctx.fillText('b', X(b), 32)"));
    assert.ok(!js.includes("ctx.fillText('a', X(a), 18)"), 'sigue la a en y=18 (recortada)');
});

// --- 3) "0" del origen ------------------------------------------------------

test('3: el "0" se dibuja aunque x=0 quede fuera del lienzo', () => {
    const js = leer('js', 'graficadora.js');
    // Antes: solo con xmin<0 && xmax>0 (falla cuando las X arrancan en 0.5)
    assert.ok(!js.includes('xmin < 0 && xmax > 0 && ymin < 0'), 'el origen sigue condicionado al cruce en X');
    assert.ok(js.includes('if (ymin < 0 && ymax > 0) {'), 'el origen depende del eje horizontal (y=0)');
    assert.ok(js.includes("ctx.fillText('0', cx + 3, cy + 10)"), 'falta el dibujo del 0');
    // Si x=0 no está en el lienzo, el 0 se coloca al inicio del eje horizontal
    assert.ok(js.includes('(xmin > 0 ? 0 : w)'), 'falta el anclaje al inicio del eje cuando x=0 no cabe');
    // Nunca fuera del borde derecho
    assert.ok(js.includes('Math.min(Math.max(ox + 2, 1), w - 16)'), 'falta el sujet del 0 al lienzo');
});

// --- 4) Pastilla visible ----------------------------------------------------

test('4: los chips de la gráfica son pastillas claras con texto oscuro', () => {
    const js = leer('js', 'graficadora.js');

    assert.match(js, /function grafChipEtiqueta\(ctx, x, y, ancho, altoChip = 13\) \{[\s\S]*?rgba\(255, 255, 255, 0\.85\)[\s\S]*?rgba\(6, 34, 43, 0\.55\)/,
        'el chip debe ser fondo claro translúcido con borde visible');
    assert.ok(!js.includes('rgba(255, 255, 255, 0.14)'), 'quedó el fondo gris 0.14 que se veía oscuro');
    assert.ok(!js.includes('rgba(7, 9, 14, 0.9)'), 'quedó el chip negro de la v3');

    // El texto que cae encima de un chip va en #06222b (contraste alto)
    const textosOscuros = (js.match(/ctx\.fillStyle = '#06222b';/g) || []).length;
    assert.ok(textosOscuros >= 4, `el texto de los chips debe ser #06222b (hay ${textosOscuros})`);
    // Ninguna etiqueta con chip se dibuja en gris claro encima del fondo claro
    assert.ok(!/grafChipEtiqueta\([^)]*\);\s*(?:\/\/[^\n]*\n\s*)*ctx\.fillStyle = 'rgba\(229, 231, 235, 0\.95\)'/u.test(js),
        'queda texto gris claro sobre la pastilla clara');
});

// --- 5) Halo ----------------------------------------------------------------

test('5: el halo mide max(100vw, 2000px)×100vh con gradiente de 3 paradas, por sección', () => {
    const css = leer('css', 'styles.css');
    const halo = /\.main-container::before \{[\s\S]*?\}/.exec(css)[0];

    assert.match(halo, /position: fixed;/, 'el halo debe seguir a la ventana');
    // v6 P0-1: nunca baja de 2000px (elipse ancha en móvil, donde el 100vw
    // puro de la v5 quedaba tapado tras las tarjetas) y en pantallas de
    // ≥2000px sigue cubriendo todo el ancho del fullscreen.
    assert.match(halo, /width: max\(100vw, 2000px\)/,
        'el halo debe medir max(100vw, 2000px)');
    assert.match(halo, /left: 50%/);
    assert.match(halo, /transform: translateX\(-50%\)/);
    assert.match(halo, /height: 100vh/);

    // 3 paradas: 0.26 → 0.16 → transparent 80%
    for (const [color, nombre] of [['34, 211, 238', 'cian'], ['168, 85, 247', 'violeta'], ['236, 72, 153', 'magenta']]) {
        const pat = new RegExp(`rgba\\(${color}, 0\\.26\\) 0%, rgba\\(${color}, 0\\.16\\) 45%, transparent 80%`);
        assert.match(css, pat, `falta el gradiente de 3 paradas en ${nombre}`);
    }
});

// --- 6) Landing: híbrido ----------------------------------------------------

test('6: el landing centra el contenedor y ancla el footer al pliegue', () => {
    const css = leer('css', 'styles.css');

    // body en flex-column para que .main-container pueda crecer
    assert.match(css, /body:has\(\.container--landing\) \{\s*display: flex;\s*flex-direction: column;/);
    // crece hasta el footer sin comprimirse por debajo de su contenido
    assert.match(css, /body:has\(\.container--landing\) \.main-container \{\s*flex: 1 0 auto;\s*min-height: 0;\s*align-items: center;/);
    // sin min-height:0 el calc(100vh - 90px) empujaría el footer bajo el pliegue
    assert.ok(!/body:has\(\.container--landing\) \.main-container \{[^}]*flex-start/.test(css),
        'quedó el flex-start de la v4: el contenedor pegado arriba y el hueco abajo');
    // y el centrado horizontal intacto
    assert.match(css, /\.container--landing \{[^}]*margin-inline: auto/);
});

// --- 7) Criterio de paro ----------------------------------------------------

test('7: la fórmula del criterio deja el espacio delante de la "ó"', () => {
    const js = leer('js', 'biseccion.js');
    // v5 P1-5: el espacio va DESPUÉS del <br>: si va delante, al ocultarse
    // el <br> en escritorio el texto copiado sale "0.001ó"
    assert.ok(js.includes('}<br class="criterio-salto"> ó |Δx| ≤'),
        'falta el espacio después del <br> (en PC se copiaba "0.001ó")');
    assert.ok(!js.includes('} <br class="criterio-salto">ó'),
        'el espacio sigue antes del <br>: se pierde con él en escritorio');
});

// --- 8) Bump ----------------------------------------------------------------

test('8: las 4 páginas piden styles.css?v=10', () => {
    const paginas = ['index.html', 'pages/calculadora.html', 'pages/apuntes.html', 'pages/social.html'];
    for (const archivo of paginas) {
        assert.ok(/href="[^"]*styles\.css\?v=10"/.test(leer(archivo)), `${archivo} no tiene ?v=10`);
    }
});
