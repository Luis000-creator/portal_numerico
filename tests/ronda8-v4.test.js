'use strict';
// ============================================================================
// Tests de la ronda 8 (13-nov): documento "Portal Numérico — Correcciones
// visuales v4 (pulido final)" sobre la base "Ronda 7: v3" (ec8159d).
// Cubre: P0-1 blindaje de taps, P0-2 Taylor (6 decimales + polinomio que
// cabe), P0-3 criterio en 2 líneas, P1-1 chips visibles y punteadas
// recortadas, P1-2 restos de cian por método (label, examples-label, borde
// hover/foco, chevron), P1-3 inputs numéricos sin rueda, P2-1 landing sin
// hueco, P2-2 halo con la ventana, P2-3 acciones al fondo, P2-4 degradado y
// P2-5 botón en una línea.
// Ejecutar con:  node --test tests/*.test.js
// ============================================================================

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const leer = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8');

// --- P0-1 ------------------------------------------------------------------

test('P0-1: el formulario y sus botones quedan por encima de cualquier capa', () => {
    const css = leer('css', 'styles.css');

    assert.match(css, /\.container form,\s*\.container \.form-row \{\s*position: relative;\s*z-index: 1;/);
    assert.match(css, /button\[type="submit"\],\s*\.btn-graficar \{\s*position: relative;\s*z-index: 2;\s*touch-action: manipulation;/,
        'falta el blindaje táctil de CALCULAR y GRAFICAR');
});

// --- P0-2 ------------------------------------------------------------------

test('P0-2: el error absoluto de Taylor se formatea con 6 decimales', () => {
    const js = leer('js', 'taylor.js');
    assert.ok(js.includes('formatoDecimal(errorAbs, 6)'), 'el error debe ir con formatoDecimal(..., 6)');
    assert.ok(!js.includes('numTexto(errorAbs)'), 'quedó numTexto(errorAbs) con 12 cifras');
    // formatoDecimal vive en js/biseccion.js y comparte ámbito con los módulos
    const biseccion = leer('js', 'biseccion.js');
    assert.match(biseccion, /function formatoDecimal\(v, dec = 6\)/);
});

test('P0-2: el polinomio cabe en móvil y ningún valor se parte a mitad de número', () => {
    const css = leer('css', 'styles.css');

    // .procedimiento-katex a 0.8rem en pantallas estrechas
    const katex = /@media \(max-width: 640px\) \{[\s\S]{0,400}?\.procedimiento-katex \{[\s\S]{0,300}?font-size: 0\.8rem;/.exec(css);
    assert.ok(katex, 'falta el katex a 0.8rem en ≤640px');
    assert.match(css, /\.procedimiento-katex \{[\s\S]*?overflow-x: auto;/, 'el katex conserva scroll como respaldo');

    // break-word, no anywhere (anywhere rompía "0.05161516179|24")
    assert.match(css, /\.resumen-grid--6 \.resumen-value \{[\s\S]*?overflow-wrap: break-word;/);
    assert.ok(!css.includes('overflow-wrap: anywhere'), 'quedó "anywhere" partiendo números');
});

// --- P0-3 ------------------------------------------------------------------

test('P0-3: el criterio de paro se parte en la "ó", no a mitad de un número', () => {
    const js = leer('js', 'biseccion.js');
    // v5 P1-5: el espacio del br va DESPUÉS del <br> (antes se perdía al
    // ocultarlo en escritorio y el texto salía "0.001ó")
    assert.ok(js.includes('<br class="criterio-salto"> ó |Δx| ≤'),
        'falta el salto + espacio antes de la "ó" en la fórmula del criterio');
    assert.ok(!js.includes('<br class="criterio-salto">ó |Δx| ≤'),
        'la "ó" sigue pegada al <br> sin espacio');
    assert.ok(!/ \|f\(x\)\| ≤ \$\{numTexto\(valorCriterio\)\}  ó  \|/.test(js),
        'quedó la fórmula en una sola línea');

    const css = leer('css', 'styles.css');
    // En escritorio el <br> no se ve (la fórmula cabe en una línea)
    assert.match(css, /\.criterio-salto \{\s*display: none;/);
    assert.match(css, /@media \(max-width: 768px\) \{\s*\.criterio-salto \{\s*display: inline;/);
});

// --- P1-1 ------------------------------------------------------------------

test('P1-1: la gráfica con chip visible, punteadas recortadas y "0" en el origen', () => {
    const js = leer('js', 'graficadora.js');

    // 1) Las líneas punteadas no llegan a la banda de etiquetas
    const recortes = (js.match(/ctx\.lineTo\(X\([ab]\), alto - 20\)/g) || []).length;
    assert.equal(recortes, 2, 'las dos punteadas deben cortarse en alto - 20');

    // 2) Chip visible (pastilla clara translúcida + borde oscuro), no gris
    //    sobre negro — el texto encima va en #06222b (ronda 9)
    assert.match(js, /function grafChipEtiqueta\(ctx, x, y, ancho, altoChip = 13\) \{[\s\S]*?rgba\(255, 255, 255, 0\.85\)[\s\S]*?rgba\(6, 34, 43, 0\.55\)/);
    assert.ok(!js.includes('rgba(7, 9, 14, 0.9)'), 'quedó el chip negro invisible');
    assert.ok(!js.includes('rgba(255, 255, 255, 0.14)'), 'quedó el chip gris de la v4');
    const usos = (js.match(/grafChipEtiqueta\(/g) || []).length;
    assert.ok(usos >= 6, `el chip debe usarse en X, a/b, origen, puntos y marcas (usos: ${usos})`);

    // 3) 'a'/'b' a y=32 (chip en y=20): en y=18 se recortaban contra el borde
    assert.ok(js.includes("ctx.fillText('a', X(a), 32)"));
    assert.ok(js.includes("ctx.fillText('b', X(b), 32)"));

    // 4) La etiqueta pegada al borde izquierdo no sale cortada
    assert.ok(js.includes('Math.max(et.px + 3, 4)'), 'falta el sujete mínimo de la etiqueta izquierda');

    // 5) El "0" del origen, aunque x=0 quede fuera del lienzo (las X pueden
    //    arrancar en 0.5): solo depende del eje horizontal
    assert.ok(js.includes("ctx.fillText('0', cx + 3, cy + 10)"), 'falta el 0 del origen');
    assert.ok(!js.includes('xmin < 0 && xmax > 0 && ymin < 0'), 'el 0 sigue condicionado a que cruce en X');
    assert.ok(js.includes('if (ymin < 0 && ymax > 0) {'), 'el 0 depende del eje horizontal');
});

// --- P1-2 ------------------------------------------------------------------

test('P1-2: sin color en línea y las etiquetas siguen al método', () => {
    const html = leer('pages', 'calculadora.html');
    assert.ok(!html.includes('style="color: #00f0ff;"'), 'sigue el style en línea del label');
    assert.ok(html.includes('<label for="metodo-selector">Selecciona el Método Numérico</label>'));

    const css = leer('css', 'styles.css');
    // "INSERTAR EXPRESIÓN:" es un <span>, no un <label>
    assert.match(css, /\.container:has\(#metodo-selector\) \.examples-label \{\s*color: var\(--method\);/);
    // Borde del selector también en hover/foco (§04 fija --accent-cian)
    assert.match(css, /\.container:has\(#metodo-selector\) select:hover,\s*\.container:has\(#metodo-selector\) select:focus \{\s*border-color: var\(--method\) !important;/);
    // El texto nunca queda bajo el chevron (SVG: right 12px + 24px)
    assert.match(css, /#metodo-selector,\s*#criterio \{\s*padding-right: 44px !important;/);
});

test('P1-2: el chevron del select toma el color de cada método', () => {
    const css = leer('css', 'styles.css');
    const chevrons = {
        puntofijo: 'a855f7',
        newton: 'f59e0b',
        taylor: '34d399',
        lagrangelineal: 'ec4899',
        lagrangepoly: '60a5fa',
        simpson: 'a3e635',
    };
    for (const [metodo, hex] of Object.entries(chevrons)) {
        const regla = new RegExp(`\\.container\\[data-metodo="${metodo}"\\] select \\{[^}]*background-image: url\\("data:image/svg\\+xml[^"]*fill='%23${hex}'[^"]*"\\) !important;`);
        assert.match(css, regla, `falta el chevron ${hex} de ${metodo}`);
    }
    // Bisección conserva el SVG base del §04 (#22d3ee)
    assert.match(css, /select \{[\s\S]*?fill='%2322d3ee'/);
});

// --- P1-3 ------------------------------------------------------------------

test('P1-3: los inputs numéricos no cambian con la rueda y se suelta el foco', () => {
    const biseccion = leer('js', 'biseccion.js');
    assert.ok(biseccion.includes("document.querySelectorAll('input[type=\"number\"]')"),
        'falta el barrido de inputs numéricos');
    assert.ok(biseccion.includes("addEventListener('wheel'"), 'falta el handler de rueda');
    assert.ok(biseccion.includes('e.preventDefault();'), 'la rueda debe cancelarse (passive: false)');
    assert.ok(biseccion.includes('el.blur();'), 'hay que soltar el foco en el primer scroll');
    assert.match(biseccion, /blindarInputsNumericos\(\);/, 'hay que llamarlo al cargar');

    const puntoFijo = leer('js', 'punto-fijo.js');
    assert.ok(puntoFijo.includes('const activo = document.activeElement;'),
        'ejecutarCalculo debe soltar el foco tras calcular');
    assert.ok(puntoFijo.includes('activo.blur()'), 'falta el blur tras el cálculo');
});

// --- P2 --------------------------------------------------------------------

test('P2-1: el landing centra el contenedor y deja el footer al pliegue', () => {
    const css = leer('css', 'styles.css');
    // Opción híbrida (ronda 9): body flex-column + .main-container creciendo
    // hasta el footer y centrando su contenido
    assert.match(css, /body:has\(\.container--landing\) \{\s*display: flex;\s*flex-direction: column;/);
    assert.match(css, /body:has\(\.container--landing\) \.main-container \{\s*flex: 1 0 auto;\s*min-height: 0;\s*align-items: center;/);
    // El centrado horizontal del contenedor sigue intacto
    assert.match(css, /\.container--landing \{[^}]*margin-inline: auto/);
});

test('P2-2: el halo acompaña a la ventana, no a la parte superior de la página', () => {
    const css = leer('css', 'styles.css');
    assert.match(css, /\.main-container::before \{[^}]*position: fixed;\s*top: 0;/);
    // Las variantes por sección solo cambian el color (siguen heredando fixed)
    assert.match(css, /body:has\(#lista-apuntes\) \.main-container::before \{[^}]*rgba\(168, 85, 247, 0\.26\)/);
    assert.match(css, /body:has\(\.redes-section\) \.main-container::before \{[^}]*rgba\(236, 72, 153, 0\.26\)/);
});

test('P2-3: las acciones de Apuntes se pegan al fondo de la tarjeta', () => {
    const css = leer('css', 'styles.css');
    assert.match(css, /#apuntes-remotos \.apunte-card \{[^}]*display: flex;\s*flex-direction: column;/);
    assert.match(css, /#apuntes-remotos \.apunte-acciones \{\s*margin-top: auto;/);
});

test('P2-4: PUBLICAR APUNTE con degradado bien separado', () => {
    const css = leer('css', 'styles.css');
    const regla = /button\[type="submit"\] \{[^}]*\}/.exec(css)[0];
    assert.match(regla, /#00F0FF 0%, #0891B2 55%, #155E75 100%/);
});

test('P2-5: CALCULAR PROCEDIMIENTO en una sola línea', () => {
    const css = leer('css', 'styles.css');
    assert.match(css, /button\[type="submit"\] \{[^}]*white-space: nowrap;/);
    assert.match(css, /@media \(max-width: 768px\) \{\s*button\[type="submit"\] \{\s*font-size: 0\.8rem;\s*letter-spacing: 1px;/);
});
