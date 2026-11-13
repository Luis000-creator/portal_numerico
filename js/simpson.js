// ============================================================================
// Itera - Simpson 1/3 Module
// ============================================================================
// Contiene: integración numérica por la Regla de Simpson 1/3 para
// calculadora.html. Requiere las utilidades compartidas de biseccion.js
// (evaluarFuncion, limpiarTabla, mostrarError, mostrarResumenCustom).
// ============================================================================

// Tope de subintervalos para no congelar la tabla del DOM
const SIMPSON_MAX_N = 1000;

function calcularSimpson() {
    const campoFx = document.getElementById('funcion-simpson');
    const campoA = document.getElementById('a-simpson');
    const campoB = document.getElementById('b-simpson');
    const campoN = document.getElementById('n-simpson');

    const expr = campoFx ? campoFx.value.trim() : '';
    const aStr = campoA ? campoA.value.trim() : '';
    const bStr = campoB ? campoB.value.trim() : '';
    const nStr = campoN ? campoN.value.trim() : '';

    limpiarTabla();

    if (!expr) { mostrarError('Error: Escribe la función f(x) a integrar.'); return; }
    if (aStr === '' || bStr === '') {
        mostrarError('Error: Escribe los límites inferior (a) y superior (b) de integración.');
        return;
    }

    // Acepta constantes en los límites: "pi/2", "e", "2*pi"...
    const a = parseNumeroConConstantes(aStr);
    const b = parseNumeroConConstantes(bStr);
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
        mostrarError('Error: Los límites de integración deben ser números válidos (aceptan pi, e...).');
        return;
    }
    if (a === b) {
        mostrarError('Error: Los límites a y b deben ser distintos.');
        return;
    }

    const n = Number(nStr);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 2) {
        mostrarError('Error: n debe ser un número entero mayor o igual a 2.');
        return;
    }
    // La Regla de Simpson 1/3 exige un número PAR de subintervalos
    if (n % 2 !== 0) {
        const sugerido = n + 1;
        mostrarError(
            `Error: la Regla de Simpson 1/3 requiere un número PAR de subintervalos. ` +
            `Recibiste n = ${n}. Usa ${sugerido} (o ${n - 1 >= 2 ? n - 1 : 2}).`
        );
        return;
    }
    if (n > SIMPSON_MAX_N) {
        mostrarError(`Error: n = ${n} es demasiado grande. El máximo permitido es ${SIMPSON_MAX_N}.`);
        return;
    }

    const tbody = document.getElementById('tabla-cuerpo');
    const h = (b - a) / n;

    // --- Tabla de datos: i, x_i, f(x_i), coeficiente y producto ---
    let suma = 0;
    for (let i = 0; i <= n; i++) {
        const x = a + i * h;
        const y = evaluarFuncion(expr, x);
        if (!Number.isFinite(y)) {
            mostrarError(`Error: f(x) no está definida en x = ${x} (iteración i = ${i}). Revisa el dominio de la función.`);
            return;
        }
        const coef = (i === 0 || i === n) ? 1 : (i % 2 === 1 ? 4 : 2);
        const producto = coef * y;
        suma += producto;

        const tr = document.createElement('tr');
        tr.innerHTML =
            `<td data-label="i">${i}</td>` +
            `<td data-label="xᵢ">${x.toFixed(6)}</td>` +
            `<td data-label="f(xᵢ)">${y.toFixed(6)}</td>` +
            `<td data-label="Coeficiente">${coef}</td>` +
            `<td data-label="Producto">${producto.toFixed(6)}</td>`;
        tbody.appendChild(tr);
    }

    const integral = (h / 3) * suma;
    if (!Number.isFinite(integral)) {
        mostrarError('Error: la integral produjo un valor no válido. Revisa la función y los límites.');
        return;
    }

    // --- Gráfica con el área sombreada entre a y b ---
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    graficarResultado(expr, { a: lo, b: hi, sombra: { a: lo, b: hi }, etiqueta: 'f(x)' });

    // --- Resumen ---
    mostrarResumenCustom([
        { etiqueta: 'Integral Aproximada', valor: integral.toPrecision(10), tipo: 'principal', icono: 'fa-calculator' },
        { etiqueta: 'Paso h', valor: h.toPrecision(6), icono: 'fa-ruler-horizontal' },
        { etiqueta: 'Subintervalos (n)', valor: String(n), icono: 'fa-layer-group' },
        { etiqueta: 'Parábolas', valor: String(n / 2), icono: 'fa-chart-area' },
        { etiqueta: 'Puntos evaluados', valor: String(n + 1), icono: 'fa-table-list' },
    ], {
        informacion: `Simpson 1/3: I ≈ (h/3) · [f(a) + 4·Σimpares + 2·Σpares + f(b)] = (${h.toPrecision(6)} / 3) · ${suma.toPrecision(8)}`,
        tipoInfo: 'exito',
    });
}

window.calcularSimpson = calcularSimpson;

document.addEventListener('DOMContentLoaded', () => {
    cablearPreview('funcion-simpson', 'preview-fx-simpson', 'f(x)');
});
