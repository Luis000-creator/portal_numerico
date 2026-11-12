'use strict';
// ============================================================================
// Tests de la interfaz compartida (selector de métodos, criterio de paro)
// Verifica que los 7 métodos existen en CONFIG_METODOS / EJECUTORES y que
// los métodos no iterativos ocultan el criterio de paro.
// Ejecutar con:  node --test tests/*.test.js
// ============================================================================

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cargarModulos } = require('./helpers/env');

const TODOS = [
    'biseccion', 'puntofijo', 'newton',
    'taylor', 'lagrangelineal', 'lagrangepoly', 'simpson',
];

function crearUI() {
    // biseccion + punto-fijo definen la UI; los módulos nuevos, sus ejecutores
    return cargarModulos([
        'js/biseccion.js', 'js/punto-fijo.js', 'js/newton-raphson.js',
        'js/taylor.js', 'js/lagrange.js', 'js/simpson.js',
    ]);
}

test('selector: los 7 métodos están configurados y tienen ejecutor', () => {
    const { ctx } = crearUI();
    for (const m of TODOS) {
        assert.ok(ctx.CONFIG_METODOS[m], `falta CONFIG_METODOS[${m}]`);
        const nombre = ctx.EJECUTORES[m];
        assert.ok(nombre, `falta EJECUTORES[${m}]`);
        assert.equal(typeof ctx[nombre], 'function',
            `window.${nombre} no está expuesta (el router no podría llamarla)`);
    }
});

test('selector: cada método muestra solo su bloque de inputs', () => {
    const { ctx, el } = crearUI();
    for (const m of TODOS) {
        ctx.alternarMetodoUI(); // con selector aún en biseccion
        el('metodo-selector').value = m;
        ctx.alternarMetodoUI();

        for (const otro of TODOS) {
            const bloque = el(ctx.CONFIG_METODOS[otro].bloque);
            const esperado = otro === m ? '' : 'none';
            assert.equal(bloque.style.display, esperado,
                `con "${m}" el bloque de "${otro}" debe estar "${esperado || 'visible'}"`);
        }
    }
});

test('los métodos no iterativos ocultan el criterio de paro', () => {
    const { ctx, el } = crearUI();

    const sinCriterio = ['taylor', 'lagrangelineal', 'lagrangepoly', 'simpson'];
    for (const m of sinCriterio) {
        el('metodo-selector').value = m;
        ctx.alternarMetodoUI();
        assert.equal(el('grupo-criterio').style.display, 'none',
            `${m} no itera: el criterio debe ocultarse`);
        assert.equal(el('grupo-valor-criterio').style.display, 'none',
            `${m}: el valor de criterio debe ocultarse`);
        assert.equal(el('criterio').disabled, true, `${m}: select deshabilitado`);
        assert.equal(el('valorCriterio').disabled, true, `${m}: input deshabilitado`);
        assert.equal(el('valorCriterio').required, false,
            `${m}: no debe exigir un criterio para poder enviar`);
    }

    for (const m of ['biseccion', 'puntofijo', 'newton']) {
        el('metodo-selector').value = m;
        ctx.alternarMetodoUI();
        assert.equal(el('grupo-criterio').style.display, '',
            `${m} sí usa criterio de paro`);
        assert.equal(el('criterio').disabled, false);
        assert.equal(el('valorCriterio').required, true);
    }
});

test('alternarMetodoUI actualiza título, subtítulo y cabecera de la tabla', () => {
    const { ctx, el } = crearUI();

    el('metodo-selector').value = 'simpson';
    ctx.alternarMetodoUI();
    assert.equal(el('titulo-metodo').innerText, 'Regla de Simpson 1/3');
    assert.match(el('tabla-cabecera').innerHTML, /Coeficiente/);
    assert.match(el('tabla-cabecera').innerHTML, /f\(xᵢ\)/);

    el('metodo-selector').value = 'lagrangepoly';
    ctx.alternarMetodoUI();
    assert.equal(el('titulo-metodo').innerText, 'Interpolación Polinomial de Lagrange');
    assert.match(el('tabla-cabecera').innerHTML, /Lᵢ\(x\)/);
});

test('el router no ejecuta métodos inexistentes y limpia resultados al cambiar', async () => {
    const { ctx, el } = crearUI();

    // ejecutar sin método configurado no lanza excepción
    el('metodo-selector').value = 'no-existe';
    await ctx.ejecutarCalculo({ preventDefault() {} });
    assert.match(el('error-text').innerText, /aún no está disponible/);

    // cambiar de método limpia tabla, resultados y gráfica
    el('metodo-selector').value = 'biseccion';
    ctx.alternarMetodoUI();
    el('tabla-cuerpo').innerHTML = '<tr></tr>';
    el('resultado-container').style.display = 'block';
    el('metodo-selector').value = 'simpson';
    ctx.alternarMetodoUI();
    assert.equal(el('tabla-cuerpo').children.length, 0, 'la tabla debe limpiarse');
    assert.equal(el('resultado-container').style.display, 'none');
    assert.equal(el('grafica-container').style.display, 'none');
});

test('los menús matemáticos se conectan a cada input de función', () => {
    const { ctx, el } = crearUI();
    ctx.inicializarMenusMatematicos();
    // El DOM falso no tiene nodos .math-menu (querySelectorAll → []),
    // así que aquí solo verificamos que no lanza.
    assert.equal(typeof ctx.inicializarMenusMatematicos, 'function');
    assert.ok(el('menu-taylor'));
    assert.ok(el('menu-simpson'));
});
