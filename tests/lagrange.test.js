'use strict';
// ============================================================================
// Tests de interpolación de Lagrange (js/lagrange.js)
// Lineal (1.er grado) + polinomial general con tabla dinámica de puntos.
// Ejecutar con:  node --test tests/*.test.js
// ============================================================================

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cargarModulos, salidaDe } = require('./helpers/env');

function crearEntorno(metodo) {
    const env = cargarModulos(['js/biseccion.js', 'js/punto-fijo.js', 'js/lagrange.js']);
    env.el('metodo-selector').value = metodo;
    env.ctx.alternarMetodoUI();
    return env;
}

function valorTarjeta(resumen, etiqueta) {
    const re = new RegExp(
        `resumen-label">${etiqueta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</span>\\s*<span class="resumen-value">([^<]*)<`
    );
    const m = re.exec(resumen);
    return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// 2. INTERPOLACIÓN LINEAL
// ---------------------------------------------------------------------------

test('lineal: recta por (0,0) y (10,100) evaluada en x=4 → 40', () => {
    const env = crearEntorno('lagrangelineal');
    env.el('x0-lineal').value = '0';
    env.el('y0-lineal').value = '0';
    env.el('x1-lineal').value = '10';
    env.el('y1-lineal').value = '100';
    env.el('x-lineal').value = '4';
    env.ctx.calcularLagrangeLineal();

    const r = salidaDe(env);
    assert.equal(r.hayError, false, `no debe fallar: ${r.error}`);
    assert.equal(valorTarjeta(r.resumen, 'Valor interpolado'), 'y = 40');
    assert.equal(valorTarjeta(r.resumen, 'Pendiente m'), '10');
    assert.equal(r.filas.length, 3, 'L₀, L₁ y la suma');
});

test('lineal: devuelve exactamente los extremos conocidos', () => {
    for (const [x, esperado] of [[1, 2], [3, 6], [2, 4]]) {
        const env = crearEntorno('lagrangelineal');
        env.el('x0-lineal').value = '1';
        env.el('y0-lineal').value = '2';
        env.el('x1-lineal').value = '3';
        env.el('y1-lineal').value = '6';
        env.el('x-lineal').value = String(x);
        env.ctx.calcularLagrangeLineal();
        const r = salidaDe(env);
        assert.equal(r.hayError, false, r.error);
        assert.equal(
            valorTarjeta(r.resumen, 'Valor interpolado'),
            `y = ${esperado}`,
            `x=${x}`
        );
    }
});

test('lineal: muestra la sustitución en KaTeX', () => {
    const env = crearEntorno('lagrangelineal');
    env.el('x0-lineal').value = '0';
    env.el('y0-lineal').value = '0';
    env.el('x1-lineal').value = '10';
    env.el('y1-lineal').value = '100';
    env.el('x-lineal').value = '4';
    env.ctx.calcularLagrangeLineal();

    const r = salidaDe(env);
    assert.match(r.procedimiento, /\\frac\{4 - 10\}\{0 - 10\}/, r.procedimiento);
    assert.match(r.procedimiento, /= 40/, r.procedimiento);
    assert.equal(r.latex.length, 1, 'debe renderizar un solo bloque');
});

test('lineal: grafica los 2 puntos, la recta y el punto interpolado', () => {
    const env = crearEntorno('lagrangelineal');
    env.el('x0-lineal').value = '0';
    env.el('y0-lineal').value = '0';
    env.el('x1-lineal').value = '10';
    env.el('y1-lineal').value = '100';
    env.el('x-lineal').value = '4';
    env.ctx.calcularLagrangeLineal();

    const r = salidaDe(env);
    assert.equal(r.graficos.length, 1);
    const o = r.graficos[0].opts;
    assert.equal(o.puntos.length, 2, 'los 2 puntos conocidos');
    assert.equal(o.marcas.length, 1, 'el punto interpolado');
    assert.equal(o.marcas[0].y, 40);
});

test('lineal: valida campos vacíos, no numéricos y x₀ = x₁', () => {
    const base = { x0: '1', y0: '2', x1: '3', y1: '6', x: '2' };
    const correr = (campos) => {
        const env = crearEntorno('lagrangelineal');
        env.el('x0-lineal').value = campos.x0;
        env.el('y0-lineal').value = campos.y0;
        env.el('x1-lineal').value = campos.x1;
        env.el('y1-lineal').value = campos.y1;
        env.el('x-lineal').value = campos.x;
        env.ctx.calcularLagrangeLineal();
        return salidaDe(env);
    };

    assert.match(correr({ ...base, x0: '' }).error, /completa los puntos/);
    assert.match(correr({ ...base, x: '' }).error, /completa los puntos/);
    assert.match(correr({ ...base, y1: 'abc' }).error, /números válidos/);
    assert.match(correr({ ...base, x1: '1' }).error, /distintos/);
});

// ---------------------------------------------------------------------------
// 3. INTERPOLACIÓN POLINOMIAL
// ---------------------------------------------------------------------------

/** Crea la tabla con los puntos indicados y la deja lista. */
function cargarPuntos(env, datos) {
    const cont = env.el('tabla-puntos');
    datos.forEach(() => env.ctx.crearFilaPunto());
    cont.children.forEach((fila, i) => {
        fila.querySelector('[data-campo="x"]').value = String(datos[i][0]);
        fila.querySelector('[data-campo="y"]').value = String(datos[i][1]);
    });
    return cont;
}

test('polinomial: por (1,1),(2,4),(3,9) → P₂(x) = x² y P(2.5) = 6.25', () => {
    const env = crearEntorno('lagrangepoly');
    cargarPuntos(env, [[1, 1], [2, 4], [3, 9]]);
    env.el('x-poly').value = '2.5';
    env.ctx.calcularLagrangePolinomial();

    const r = salidaDe(env);
    assert.equal(r.hayError, false, `no debe fallar: ${r.error}`);
    assert.equal(valorTarjeta(r.resumen, 'Valor interpolado'), 'y = 6.25');
    assert.equal(valorTarjeta(r.resumen, 'Grado del polinomio'), '2');
    assert.equal(valorTarjeta(r.resumen, 'Puntos usados'), '3');
    assert.match(r.procedimiento, /P_\{2\}\(x\)/, r.procedimiento);
    assert.match(r.procedimiento, /P_\{2\}\(2\.5\)/, r.procedimiento);
});

test('polinomial: reproduce los puntos conocidos (interpolación exacta)', () => {
    const datos = [[0, 1], [1, 3], [2, 9], [3, 27]];
    for (const [xp, yp] of datos) {
        const env = crearEntorno('lagrangepoly');
        cargarPuntos(env, datos);
        env.el('x-poly').value = String(xp);
        env.ctx.calcularLagrangePolinomial();
        const r = salidaDe(env);
        assert.equal(r.hayError, false, r.error);
        assert.equal(valorTarjeta(r.resumen, 'Valor interpolado'), `y = ${yp}`,
            `P(${xp}) debe ser ${yp}`);
    }
});

test('polinomial: 4 puntos → grado 3 y tabla con 4 filas', () => {
    const env = crearEntorno('lagrangepoly');
    cargarPuntos(env, [[0, 0], [1, 1], [2, 8], [3, 27]]);
    env.el('x-poly').value = '2.5';
    env.ctx.calcularLagrangePolinomial();

    const r = salidaDe(env);
    assert.equal(r.hayError, false, r.error);
    assert.equal(valorTarjeta(r.resumen, 'Grado del polinomio'), '3');
    assert.equal(r.filas.length, 4, 'una fila por punto');
    // P(2.5) = 15.625 si los puntos son y = x³
    assert.equal(valorTarjeta(r.resumen, 'Valor interpolado'), 'y = 15.625');
});

test('polinomial: la tabla de puntos arranca con 3 filas numeradas P1..P3', () => {
    const env = crearEntorno('lagrangepoly');
    env.ctx.crearFilaPunto();
    env.ctx.crearFilaPunto();
    env.ctx.crearFilaPunto();

    const cont = env.el('tabla-puntos');
    assert.equal(cont.children.length, 3);
    assert.deepEqual(
        cont.children.map((f) => f.querySelector('.punto-indice').textContent),
        ['P1', 'P2', 'P3']
    );

    // Agregar y quitar conserva la numeración
    env.ctx.crearFilaPunto();
    assert.equal(cont.children.length, 4);
    env.ctx.quitarFilaPunto(cont.children[1]);
    assert.equal(cont.children.length, 3);
    assert.deepEqual(
        cont.children.map((f) => f.querySelector('.punto-indice').textContent),
        ['P1', 'P2', 'P3']
    );
});

test('polinomial: no permite bajar de 3 puntos ni pasar de 12', () => {
    const env = crearEntorno('lagrangepoly');
    for (let i = 0; i < 3; i++) env.ctx.crearFilaPunto();
    const cont = env.el('tabla-puntos');

    env.ctx.quitarFilaPunto(cont.children[0]);
    assert.equal(cont.children.length, 3, 'mínimo 3 puntos');
    assert.match(env.el('error-text').innerText, /al menos 3 puntos/);

    for (let i = 0; i < 12; i++) env.ctx.crearFilaPunto();
    assert.equal(cont.children.length, 12, 'máximo 12 puntos');
    assert.match(env.el('error-text').innerText, /máximo 12 puntos/i);
});

test('polinomial: rechaza X vacío, puntos incompletos y x repetida', () => {
    // X vacío
    let env = crearEntorno('lagrangepoly');
    cargarPuntos(env, [[1, 1], [2, 4], [3, 9]]);
    env.el('x-poly').value = '';
    env.ctx.calcularLagrangePolinomial();
    assert.match(salidaDe(env).error, /escribe el valor de X/);

    // Punto con campo vacío
    env = crearEntorno('lagrangepoly');
    const cont = cargarPuntos(env, [[1, 1], [2, 4], [3, 9]]);
    cont.children[1].querySelector('[data-campo="y"]').value = '';
    env.el('x-poly').value = '2';
    env.ctx.calcularLagrangePolinomial();
    assert.match(salidaDe(env).error, /P2 tiene campos vacíos/);

    // Dos puntos con la misma x
    env = crearEntorno('lagrangepoly');
    cargarPuntos(env, [[1, 1], [1, 5], [3, 9]]);
    env.el('x-poly').value = '2';
    env.ctx.calcularLagrangePolinomial();
    assert.match(salidaDe(env).error, /misma x \(1\)/);
});

test('polinomial: grafica los puntos conocidos y el valor interpolado', () => {
    const env = crearEntorno('lagrangepoly');
    cargarPuntos(env, [[1, 1], [2, 4], [3, 9]]);
    env.el('x-poly').value = '2.5';
    env.ctx.calcularLagrangePolinomial();

    const r = salidaDe(env);
    assert.equal(r.graficos.length, 1);
    const o = r.graficos[0].opts;
    assert.equal(o.puntos.length, 3, 'los 3 puntos conocidos');
    assert.equal(o.marcas[0].y, 6.25);
    assert.equal(r.graficos[0].expr, '1*x^2', 'la curva debe ser el polinomio');
});
