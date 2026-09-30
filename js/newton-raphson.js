// ============================================================================
// Portal Numérico - Newton-Raphson Module
// ============================================================================
// Contiene: lógica del método de Newton-Raphson para calculadora.html
// Requiere: mathjs (CDN UMD en calculadora.html) y utilidades compartidas de biseccion.js
// ============================================================================

const CABECERA_NEWTON = '<tr><th>Iter (n)</th><th>xₙ</th><th>f(xₙ)</th><th>f\'(xₙ)</th><th>xₙ₊₁</th><th>Ea (%)</th></tr>';

// --- ALGORITMO DE NEWTON-RAPHSON ---

function calcularNewton() {
    const exprF = document.getElementById('funcion-newton').value.trim();
    let x_actual = parseFloat(document.getElementById('x0-newton').value);

    const crit = leerCriterio();
    if (!crit) return;
    const { criterio, valor: valorCriterio } = crit;

    limpiarTabla();
    const resContainer = document.getElementById('resultado-container');
    const tbody = document.getElementById('tabla-cuerpo');

    if (!exprF) {
        mostrarError('Error: Escribe la función f(x).');
        return;
    }
    if (!Number.isFinite(x_actual)) {
        mostrarError('Error: El valor inicial X₀ debe ser un número válido.');
        return;
    }

    // Compilar función y su derivada una sola vez para eficiencia
    let parsedF, parsedFPrime;
    try {
        parsedF = math.parse(exprF);
        parsedFPrime = math.derivative(parsedF, 'x');
    } catch (e) {
        mostrarError('Error: Sintaxis inválida en la función f(x).');
        return;
    }

    // Verificación inicial: f'(x₀) ≠ 0
    let fPrimeX0;
    try {
        fPrimeX0 = parsedFPrime.evaluate({ x: x_actual });
    } catch (e) {
        mostrarError('Error: No se pudo evaluar la derivada en X₀.');
        return;
    }
    if (!Number.isFinite(fPrimeX0) || Math.abs(fPrimeX0) < 1e-14) {
        mostrarError(`Error: La derivada f'(X₀) es cero o no está definida (${fPrimeX0}). El método falla.`);
        return;
    }

    const maxIter = criterio === 'iteraciones' ? Math.min(100, Math.max(1, Math.floor(valorCriterio))) : 100;
    let n = 1;
    let x_anterior = null;

    while (n <= maxIter) {
        // Evaluar f(x) y f'(x)
        let fx, fpx;
        try {
            fx = parsedF.evaluate({ x: x_actual });
            fpx = parsedFPrime.evaluate({ x: x_actual });
        } catch (e) {
            mostrarError(`Error al evaluar la función o su derivada en la iteración ${n}.`);
            break;
        }

        // Control de valores no válidos
        if (!Number.isFinite(fx) || !Number.isFinite(fpx)) {
            mostrarError(`Valor no finito detectado en la iteración ${n}.`);
            break;
        }
        if (Math.abs(fpx) < 1e-14) {
            mostrarError(`Derivada f'(x) ≈ 0 en la iteración ${n}. División por cero inminente.`);
            break;
        }

        // Fórmula de Newton-Raphson: x_{n+1} = x_n - f(x_n)/f'(x_n)
        const x_siguiente = x_actual - fx / fpx;

        // Error relativo porcentual |x_{n+1} - x_n| / |x_{n+1}|
        let ea = null;
        if (x_anterior !== null && x_siguiente !== 0) {
            ea = Math.abs((x_siguiente - x_actual) / x_siguiente) * 100;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${n}</td><td>${x_actual.toFixed(6)}</td><td>${fx.toFixed(6)}</td><td>${fpx.toFixed(6)}</td><td>${x_siguiente.toFixed(6)}</td><td>${ea === null ? '--' : ea.toFixed(4) + '%'}</td>`;
        tbody.appendChild(tr);

        // Criterios de paro
        if (criterio === 'iteraciones' && n >= maxIter) break;
        if (criterio === 'tolerancia' && Math.abs(fx) <= valorCriterio) break;
        if (criterio === 'error' && ea !== null && ea <= valorCriterio) break;

        // Divergencia: el valor se aleja demasiado
        if (Math.abs(x_siguiente) > 1e6) {
            mostrarError('Divergencia: El valor se está alejando demasiado de la solución.');
            break;
        }

        // Preparar siguiente iteración
        x_anterior = x_actual;
        x_actual = x_siguiente;
        n++;
    }
    resContainer.style.display = 'block';
}

// Sincronizar previsualización KaTeX al cargar
document.addEventListener('DOMContentLoaded', () => {
    cablearPreview('funcion-newton', 'preview-fx-newton', 'f(x)');
});

// Exponer globalmente
window.calcularNewton = calcularNewton;