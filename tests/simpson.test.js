'use strict';
// ============================================================================
// Tests de la Regla de Simpson 1/3 (js/simpson.js)
// Ejecutar con:  node --test tests/*.test.js
// ============================================================================

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cargarModulos, salidaDe } = require('./helpers/env');

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

function valorTarjeta(resumen, etiqueta) {
    const re = new RegExp(
        `resumen-label">${etiqueta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</span>\\s*<span class="resumen-value">([^<]*)<`
    );
    const m = re.exec(resumen);
    return m ? m[1] : null;
}

test('Simpson: ∫₀² x² dx = 8/3 con n = 4', () => {
    const r = correrSimpson({ expr: 'x^2', a: 0, b: 2, n: 4 });
    assert.equal(r.hayError, false, `no debe fallar: ${r.error}`);

    const I = Number(valorTarjeta(r.resumen, 'Integral Aproximada'));
    assert.ok(Math.abs(I - 8 / 3) < 1e-9, `I = ${I}, esperada 2.6666...`);

    // 5 puntos evaluados (n+1) y 2 parábolas (n/2)
    assert.equal(r.filas.length, 5, 'la tabla debe tener n+1 filas');
    assert.equal(valorTarjeta(r.resumen, 'Subintervalos (n)'), '4');
    assert.equal(valorTarjeta(r.resumen, 'Puntos evaluados'), '5');
});

test('Simpson: la tabla aplica los coeficientes 1-4-2-4-1', () => {
    const r = correrSimpson({ expr: 'x^2', a: 0, b: 2, n: 4 });
    const coefs = r.filas.map((f) => /Coeficiente">(\d+)</.exec(f)[1]);
    assert.deepEqual(coefs, ['1', '4', '2', '4', '1']);
});

test('Simpson: reproduce exactamente los polinomios de grado ≤ 3', () => {
    // ∫₀¹ (x³ + 2x + 1) dx = 1/4 + 1 + 1 = 2.25  (Simpson es exacto hasta grado 3)
    const r = correrSimpson({ expr: 'x^3 + 2*x + 1', a: 0, b: 1, n: 4 });
    assert.equal(r.hayError, false, `no debe fallar: ${r.error}`);
    const I = Number(valorTarjeta(r.resumen, 'Integral Aproximada'));
    assert.ok(Math.abs(I - 2.25) < 1e-9, `I = ${I}, esperada 2.25`);
});

test('Simpson: ∫₀¹ e^(-x²) dx ≈ 0.7468241328 (referencia)', () => {
    const r = correrSimpson({ expr: 'exp(-x^2)', a: 0, b: 1, n: 100 });
    assert.equal(r.hayError, false, `no debe fallar: ${r.error}`);
    const I = Number(valorTarjeta(r.resumen, 'Integral Aproximada'));
    assert.ok(Math.abs(I - 0.7468241328) < 1e-6, `I = ${I}`);
});

test('Simpson: pide n PAR y sugiere el siguiente', () => {
    const r = correrSimpson({ expr: 'x^2', a: 0, b: 2, n: 3 });
    assert.equal(r.hayError, true, 'n impar debe rechazarse');
    assert.match(r.error, /PAR/);
    assert.match(r.error, /Usa 4/, 'debe sugerir n = 4');
});

test('Simpson: valida n ≥ 2, entero y límites distintos', () => {
    assert.match(correrSimpson({ expr: 'x^2', a: 0, b: 2, n: 1 }).error, /mayor o igual a 2/);
    assert.match(correrSimpson({ expr: 'x^2', a: 0, b: 2, n: 0 }).error, /mayor o igual a 2/);
    assert.match(correrSimpson({ expr: 'x^2', a: 0, b: 2, n: 'abc' }).error, /entero/);
    assert.match(correrSimpson({ expr: 'x^2', a: 2, b: 2, n: 4 }).error, /distintos/);
    assert.match(correrSimpson({ expr: '', a: 0, b: 2, n: 4 }).error, /función f\(x\)/);
    assert.match(correrSimpson({ expr: 'x^2', a: '', b: 2, n: 4 }).error, /límites/);
});

test('Simpson: avisa si f(x) no está definida en un nodo', () => {
    const r = correrSimpson({ expr: '1/x', a: 0, b: 2, n: 4 });
    assert.equal(r.hayError, true);
    assert.match(r.error, /no está definida en x = 0/);
});

test('Simpson: sombrea el área entre a y b en la gráfica', () => {
    const r = correrSimpson({ expr: 'x^2', a: 0, b: 2, n: 4 });
    assert.equal(r.graficos.length, 1, 'debe dibujar una gráfica');
    // (comparación campo a campo: el objeto viene de otro realm de JS)
    assert.equal(r.graficos[0].opts.sombra.a, 0);
    assert.equal(r.graficos[0].opts.sombra.b, 2);
    assert.equal(r.graficos[0].expr, 'x^2');
});

test('Simpson: invierte el signo si b < a (integración decreciente)', () => {
    const r = correrSimpson({ expr: 'x^2', a: 2, b: 0, n: 4 });
    assert.equal(r.hayError, false, `no debe fallar: ${r.error}`);
    const I = Number(valorTarjeta(r.resumen, 'Integral Aproximada'));
    assert.ok(Math.abs(I + 8 / 3) < 1e-9, `I = ${I}, esperada -2.6666...`);
});
