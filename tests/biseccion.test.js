'use strict';
// ============================================================================
// Tests de regresión para js/biseccion.js
// Cubre los bugs B1 (raíz exacta), B2 (Ea Infinity) y B3 (límite de 100
// iteraciones) detectados en la auditoría, más casos de convergencia normal.
// Ejecutar con:  node --test tests/
// ============================================================================

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { correrBiseccion, raizDelResumen } = require('./helpers/env');

// --- B1: la raíz exacta no debe perderse ni desviar la convergencia ---

test('B1: criterio iteraciones, raíz exacta en x_m = 0 converge a 0', () => {
    const r = correrBiseccion({ expr: 'x', a: -1, b: 3, criterio: 'iteraciones', valor: 5 });
    assert.equal(r.hayError, false, `no debe haber error: ${r.error}`);
    assert.equal(raizDelResumen(r.resumen), '0.000000',
        `antes del fix devolvía 0.875; resumen = ${r.resumen}`);
});

test('B1: criterio error, raíz exacta converge a 0 (antes: 0.9921875)', () => {
    const r = correrBiseccion({ expr: 'x', a: -1, b: 3, criterio: 'error', valor: 1 });
    assert.equal(r.hayError, false, `no debe haber error: ${r.error}`);
    assert.equal(raizDelResumen(r.resumen), '0.000000');
});

test('B1: la raíz exacta detiene el cálculo y el residuo es 0', () => {
    const r = correrBiseccion({ expr: 'x', a: -1, b: 3, criterio: 'iteraciones', valor: 5 });
    assert.match(r.resumen, /x = 0\.000000/);
    // Segunda tarjeta del resumen: valor final de f(x)
    assert.match(r.resumen, /0\.000000/);
});

// --- B2: Ea indefinido cuando x_m = 0 (no debe imprimir Infinity) ---

test('B2: cuando x_m = 0 el Ea muestra N/A y nunca Infinity', () => {
    // f(x) = x + 10 en [-15, 45]: en la iteración 2 el punto medio es 0
    // y f(0) = 10 ≠ 0, así que el Ea relativo queda indefinido.
    const r = correrBiseccion({ expr: 'x + 10', a: -15, b: 45, criterio: 'iteraciones', valor: 4 });

    assert.equal(r.hayError, false, `no debe haber error: ${r.error}`);
    assert.ok(r.filas.length >= 2, 'debe haber al menos 2 filas');
    assert.match(r.filas[1], /N\/A/, `la fila 2 debe mostrar N/A: ${r.filas[1]}`);

    const tabla = r.filas.join('\n');
    assert.ok(!tabla.includes('Infinity'), 'la tabla no debe contener Infinity');
    assert.ok(!tabla.includes('NaN'), 'la tabla no debe contener NaN');
});

// --- B3: el límite de 100 iteraciones debe avisarse ---

test('B3: pedir 1000 iteraciones avisa que se limitó a 100', () => {
    const r = correrBiseccion({ expr: 'x^3 - x - 2', a: 1, b: 2, criterio: 'iteraciones', valor: 1000 });
    assert.match(r.info, /limitó a 100/, `falta aviso de truncamiento: "${r.info}"`);
    assert.ok(r.filas.length <= 100, 'nunca debe exceder 100 filas');
});

test('B3: tolerancia inalcanzable avisa que no se cumplió el criterio', () => {
    // Intervalo enorme con raíz muy cerca de 0: 100 iteraciones no bastan
    // para alcanzar una tolerancia de 1e-300.
    const r = correrBiseccion({ expr: 'x - 1e-20', a: -1e-10, b: 1e10, criterio: 'tolerancia', valor: '1e-300' });
    assert.equal(r.hayError, false, `no debe haber error: ${r.error}`);
    assert.equal(r.filas.length, 100, 'debe agotar las 100 iteraciones');
    assert.match(r.info, /sin cumplir el criterio/, `falta aviso: "${r.info}"`);
});

// --- Regresión: el comportamiento normal no debe romperse ---

test('regresión: x^3 - x - 2 en [1,2] converge con tolerancia 0.001', () => {
    const r = correrBiseccion({ expr: 'x^3 - x - 2', a: 1, b: 2, criterio: 'tolerancia', valor: 0.001 });
    assert.equal(r.hayError, false, `no debe haber error: ${r.error}`);

    const raiz = Number(raizDelResumen(r.resumen));
    assert.ok(Number.isFinite(raiz), `raíz inválida: ${r.resumen}`);
    assert.ok(Math.abs(raiz - 1.521484) < 0.001, `raíz = ${raiz}, esperada ≈ 1.521484`);

    // El residuo debe cumplir la tolerancia pedida
    const f = raiz ** 3 - raiz - 2;
    assert.ok(Math.abs(f) <= 0.001, `|f(raíz)| = ${Math.abs(f)} excede la tolerancia`);
});

test('regresión: log() base 10 funciona (antes devolvía NaN)', () => {
    // Raíz de log10(x) - 1 = 0  →  x = 10
    const r = correrBiseccion({ expr: 'log(x) - 1', a: 1, b: 100, criterio: 'tolerancia', valor: 0.001 });
    assert.equal(r.hayError, false, `log() sigue fallando: ${r.error}`);

    const raiz = Number(raizDelResumen(r.resumen));
    assert.ok(Math.abs(raiz - 10) < 0.01, `raíz = ${raiz}, esperada ≈ 10`);
});

test('regresión: la raíz exacta en un extremo sigue funcionando', () => {
    const r = correrBiseccion({ expr: 'x^2 - 4', a: 2, b: 5, criterio: 'tolerancia', valor: 0.001 });
    assert.equal(r.hayError, false);
    assert.equal(raizDelResumen(r.resumen), '2.000000');
});
