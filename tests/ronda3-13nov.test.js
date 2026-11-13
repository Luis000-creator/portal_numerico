'use strict';
// ============================================================================
// Tests de la ronda 3 (13 de noviembre):
//   1. Punto Fijo / Newton: paro ANTICIPADO informa la iteración real (no el
//      "límite de 100 iteraciones") y la tarjeta no muestra números gigantes.
//   2. Aviso de divergencia |g'(x0)| > 1: el caso límite |g'| = 1 exacto NO
//      avisa (ln(x)+2 con x0=1 converge).
//   3. Constantes (pi, e, π, coma decimal) en todos los campos numéricos:
//      helper directo + Bisección, Simpson, Taylor y los inputs del HTML.
//   4. Preview de la derivada de Newton sin el "+ -" que produce mathjs 11.8.
// Ejecutar con:  node --test tests/*.test.js
// ============================================================================

const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cargarModulos, correrBiseccion, salidaDe, raizDelResumen } = require('./helpers/env');

// --- helpers de lectura (mismos patrones que revision-12nov) ---

function tarjeta(resumen, label) {
    const re = new RegExp(
        `resumen-label">${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</span>\\s*<span class="resumen-value(?:[^"]*)">([^<]*)`
    );
    return re.exec(resumen)?.[1] ?? null;
}

function estadoDe(resumen) {
    return tarjeta(resumen, 'Estado');
}

function correrPuntoFijo({ g, x0, criterio, valor }) {
    const env = cargarModulos(['js/biseccion.js', 'js/punto-fijo.js']);
    env.el('metodo-selector').value = 'puntofijo';
    env.ctx.alternarMetodoUI();
    env.el('funcion-gx').value = g;
    env.el('x0').value = String(x0);
    env.el('criterio').value = criterio;
    env.el('valorCriterio').value = String(valor);
    env.ctx.calcularPuntoFijo();
    return salidaDe(env);
}

function correrNewton({ f, x0, criterio, valor }) {
    const env = cargarModulos(['js/biseccion.js', 'js/newton-raphson.js']);
    env.el('funcion-newton').value = f;
    env.el('x0-newton').value = String(x0);
    env.el('criterio').value = criterio;
    env.el('valorCriterio').value = String(valor);
    env.ctx.calcularNewton();
    return salidaDe(env);
}

function correrSimpson({ expr, a, b, n }) {
    const env = cargarModulos(['js/biseccion.js', 'js/punto-fijo.js', 'js/simpson.js']);
    env.el('metodo-selector').value = 'simpson';
    env.ctx.alternarMetodoUI();
    env.el('funcion-simpson').value = expr;
    env.el('a-simpson').value = String(a);
    env.el('b-simpson').value = String(b);
    env.el('n-simpson').value = String(n);
    env.ctx.calcularSimpson();
    return salidaDe(env);
}

function correrTaylor({ expr, a, x, n }) {
    const env = cargarModulos(['js/biseccion.js', 'js/punto-fijo.js', 'js/taylor.js']);
    env.el('metodo-selector').value = 'taylor';
    env.ctx.alternarMetodoUI();
    env.el('funcion-taylor').value = expr;
    env.el('a-taylor').value = String(a);
    env.el('x-taylor').value = String(x);
    env.el('n-taylor').value = String(n);
    env.ctx.calcularTaylor();
    return salidaDe(env);
}

// ============================================================================
// 1) Punto Fijo: paro anticipado informa la iteración real
// ============================================================================

test('Punto Fijo divergente (3x-2) para en la iteración 14 y no dice "límite de 100"', () => {
    const r = correrPuntoFijo({ g: '3*x - 2', x0: 0.5, criterio: 'tolerancia', valor: 0.001 });

    assert.equal(r.filas.length, 14, `filas = ${r.filas.length}`);
    assert.match(r.info, /detuvo en la iteración 14/, `info: ${r.info}`);
    assert.ok(!/límite de \d+ iteraciones/.test(r.info), `decía el límite: ${r.info}`);
    assert.match(r.error, /Divergencia/, `error: ${r.error}`);

    // La tarjeta NO presenta el último iterado (−2391444.5) ni el residuo
    // (1594297) como si fueran un resultado: muestra '—'.
    assert.match(r.resumen, /x = —/, `resumen: ${r.resumen}`);
    const plano = r.resumen.replace(/<[^>]*>/g, ' ');
    assert.ok(!/\d{7,}/.test(plano), `números gigantes en el resumen: ${plano}`);
    assert.match(estadoDe(r.resumen), /Detenido en la iteración 14/);
    assert.equal(tarjeta(r.resumen, 'Iteraciones'), '14');
});

test('Newton atan(x) con x0=10 también para anticipado y muestra "—"', () => {
    const r = correrNewton({ f: 'atan(x)', x0: 10, criterio: 'tolerancia', valor: 0.001 });

    assert.ok(r.filas.length < 100, `filas = ${r.filas.length}`);
    assert.match(r.info, /detuvo en la iteración \d+/, `info: ${r.info}`);
    assert.ok(!/límite de \d+ iteraciones/.test(r.info), `decía el límite: ${r.info}`);
    assert.match(r.error, /Divergencia/, `error: ${r.error}`);
    assert.match(r.resumen, /x = —/, `resumen: ${r.resumen}`);
    assert.match(estadoDe(r.resumen), /Detenido en la iteración/);
});

// ============================================================================
// 2) Aviso |g'(x0)| > 1: el límite exacto |g'| = 1 no avisa
// ============================================================================

test('Punto Fijo: |g\'(x0)| = 1 exacto (ln(x)+2, x0=1) NO avisa divergencia', () => {
    const r = correrPuntoFijo({ g: 'ln(x) + 2', x0: 1, criterio: 'tolerancia', valor: 0.001 });

    assert.ok(!/puede diverger/.test(r.error), `aviso espurio: ${r.error}`);
    assert.ok(!/puede diverger/.test(r.info), `aviso espurio: ${r.info}`);
    assert.equal(r.hayError, false, `no debe fallar: ${r.error}`);
    // converge de verdad al punto fijo (~3.1462): es raíz
    assert.match(r.resumen, /Raíz Aproximada/, `resumen: ${r.resumen}`);
});

test('Punto Fijo: |g\'(x0)| > 1 (2*x, x0=1) sí avisa posible divergencia', () => {
    const r = correrPuntoFijo({ g: '2*x', x0: 1, criterio: 'iteraciones', valor: 5 });

    assert.match(r.error, /puede diverger/, `falta el aviso: ${r.error}`);
});

// ============================================================================
// 3) Constantes en campos numéricos (helper + métodos + HTML)
// ============================================================================

test('parseNumeroConConstantes acepta pi/e/π y coma decimal; NaN si no es número', () => {
    const env = cargarModulos(['js/biseccion.js']);
    const p = env.ctx.parseNumeroConConstantes;
    assert.equal(typeof p, 'function', 'helper no exportado en window');

    const cerca = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} != ${b}`);
    cerca(p('pi/2'), Math.PI / 2);
    cerca(p('e'), Math.E);
    cerca(p('π'), Math.PI);
    cerca(p('2*pi'), 2 * Math.PI);
    cerca(p('pi - 0.5'), Math.PI - 0.5);
    assert.equal(p('1,5'), 1.5, 'coma decimal');

    assert.ok(Number.isNaN(p('abc')), 'letras sueltas → NaN');
    assert.ok(Number.isNaN(p('')), 'vacío → NaN');
    assert.ok(Number.isNaN(p('   ')), 'solo espacios → NaN');
    assert.ok(Number.isNaN(p('x')), 'variable suelta → NaN');
});

test('Bisección con a = "pi - 0.5" y b = "pi + 0.5" encuentra π', () => {
    const r = correrBiseccion({ expr: 'sin(x)', a: 'pi - 0.5', b: 'pi + 0.5', criterio: 'tolerancia', valor: 0.001 });

    assert.equal(r.hayError, false, `no debe fallar: ${r.error}`);
    const raiz = Number(raizDelResumen(r.resumen));
    assert.ok(Number.isFinite(raiz), `sin raíz en el resumen: ${r.resumen}`);
    assert.ok(Math.abs(raiz - Math.PI) < 0.002, `raíz = ${raiz}, π = ${Math.PI}`);
});

test('Simpson con b = "pi": ∫₀^π sin(x) dx con n=4 → 2.004508...', () => {
    const r = correrSimpson({ expr: 'sin(x)', a: '0', b: 'pi', n: 4 });

    assert.equal(r.hayError, false, `no debe fallar: ${r.error}`);
    assert.match(r.resumen, /2\.004\d+/, `resumen: ${r.resumen}`);
});

test('Taylor con x = "pi/6": P5(π/6) ≈ sin(π/6) = 0.5', () => {
    const r = correrTaylor({ expr: 'sin(x)', a: '0', x: 'pi/6', n: 5 });

    assert.equal(r.hayError, false, `no debe fallar: ${r.error}`);
    assert.equal(r.filas.length, 6, 'debe haber n+1 filas');
    const ultima = r.filas[r.filas.length - 1];
    const m = /data-label="Aproximación">([^<]*)</.exec(ultima);
    assert.ok(m, `sin columna Aproximación: ${ultima}`);
    const aprox = Number(m[1]);
    assert.ok(Math.abs(aprox - 0.5) < 1e-4, `P5(pi/6) = ${aprox}, esperado ≈ 0.5`);
});

test('calculadora.html: los 14 campos que aceptan constantes son type="text"', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'pages', 'calculadora.html'), 'utf8');

    const texto = [
        'a', 'b', 'x0', 'x0-newton', 'a-taylor', 'x-taylor',
        'x0-lineal', 'y0-lineal', 'x1-lineal', 'y1-lineal', 'x-lineal',
        'x-poly', 'a-simpson', 'b-simpson',
    ];
    for (const id of texto) {
        const m = new RegExp(`<input[^>]*\\bid="${id}"[^>]*>`).exec(html);
        assert.ok(m, `no se encontró el input #${id}`);
        assert.match(m[0], /type="text"/, `#${id} debe ser type="text": ${m[0]}`);
        assert.ok(!/type="number"/.test(m[0]), `#${id} sigue siendo number: ${m[0]}`);
    }

    // Los enteros (grado n, subintervalos n) siguen siendo numéricos
    for (const id of ['n-taylor', 'n-simpson']) {
        const m = new RegExp(`<input[^>]*\\bid="${id}"[^>]*>`).exec(html);
        assert.ok(m, `no se encontró el input #${id}`);
        assert.match(m[0], /type="number"/, `#${id} debe seguir number: ${m[0]}`);
    }
});

// ============================================================================
// 4) Preview de la derivada de Newton sin "+ -"
// ============================================================================

test("Preview de derivada: limpia el '+ -' de mathjs (sin(x) - x/2 → cos(x) - 1/2)", () => {
    const env = cargarModulos(['js/biseccion.js', 'js/newton-raphson.js']);

    // Nodo con la forma exacta que produce mathjs 11.8:
    //   derivative(sin(x) - x/2).toString() === 'cos(x) + -1 / 2'
    const falso = {
        toString() { return 'cos(x) + -1 / 2'; },
        toTex() { return '\\cos\\left(x\\right)+\\frac{-1}{2}'; },
    };

    env.ctx.actualizarPreviewDerivada('sin(x) - x/2', falso);

    const render = env.latex[env.latex.length - 1];
    assert.ok(render, 'katex no renderizó el preview');
    assert.ok(!/\+\s*-/.test(render), `aún tiene "+ -": ${render}`);
    // y no debe haber caído al toTex sucio del nodo original
    assert.ok(!/frac\{-1\}/.test(render), `usó el toTex sucio: ${render}`);
});
