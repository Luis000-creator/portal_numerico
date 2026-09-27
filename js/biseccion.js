// ============================================================================
// Portal Numérico - Bisección Module
// ============================================================================
// Contiene: evaluador de expresiones con mathjs y logica del metodo
// de biseccion para calculadora.html
// ============================================================================

function mostrarCampoCriterio() {
    const criterio = document.getElementById('criterio');
    const label = document.getElementById('label-criterio');
    const input = document.getElementById('valorCriterio');
    if (!criterio || !label || !input) return;

    const valor = criterio.value;
    if (valor === 'tolerancia') {
        label.innerText = "Valor de Tolerancia";
        input.placeholder = "0.0001";
    } else if (valor === 'error') {
        label.innerText = "Porcentaje de Error Máximo Permitido (%)";
        input.placeholder = "1.0 o 0.5";
    } else if (valor === 'iteraciones') {
        label.innerText = "Número Exacto de Iteraciones";
        input.placeholder = "10 o 15";
    }
}

// Exponer globalmente
window.mostrarCampoCriterio = mostrarCampoCriterio;

// --- MOSTRAR MENSAJE DE INFO (intervalo auto, avisos, etc.) ---
function mostrarInfo(mensaje, tipo = 'info') {
    const box = document.getElementById('info-box');
    const text = document.getElementById('info-text');
    if (!box || !text) return;
    text.innerHTML = mensaje;
    box.className = 'info-box info-box--' + tipo;
    box.style.display = 'block';
}

function ocultarInfo() {
    const box = document.getElementById('info-box');
    if (box) box.style.display = 'none';
}

window.mostrarInfo = mostrarInfo;
window.ocultarInfo = ocultarInfo;

// --- EVALUADOR DE EXPRESIONES MATEMÁTICAS ---

// Usamos mathjs (CDN UMD en calculadora.html) para evaluacion segura.
// mathjs maneja el simbolo '^', constantes y funciones de forma nativa.

function evaluarFuncion(expr, x) {
    try {
        const result = math.evaluate(expr, { x });
        return Number.isFinite(result) ? result : NaN;
    } catch (err) { return NaN; }
}

function buscarIntervaloAuto(expr) {
    const inicio = -100.0, fin = 100.0, paso = 0.25;
    let mejorIntervalo = null;
    let menorDistancia = Infinity;

    for (let x = inicio; x < fin; x += paso) {
        const fa = evaluarFuncion(expr, x);
        const fb = evaluarFuncion(expr, x + paso);

        // Saltar zonas discontinuas o no definidas
        if (!Number.isFinite(fa) || !Number.isFinite(fb)) continue;
        if (esDiscontinuo(expr, x)) continue;

        // Raíz exacta en extremo
        if (Math.abs(fa) < 1e-12) {
            return [x, x + paso, 'exacta', x];
        }
        if (Math.abs(fb) < 1e-12) {
            return [x, x + paso, 'exacta', x + paso];
        }

        if (fa * fb < 0) {
            // Priorizar intervalo cercano a 0 (más intuitivo para el usuario)
            const centro = (x + x + paso) / 2;
            const dist = Math.abs(centro);
            if (dist < menorDistancia) {
                menorDistancia = dist;
                mejorIntervalo = [x, x + paso];
            }
        }
    }

    if (mejorIntervalo) return [...mejorIntervalo, 'auto'];
    return [0, 2, 'default'];
}

// Exponer globalmente
window.evaluarFuncion = evaluarFuncion;
window.buscarIntervaloAuto = buscarIntervaloAuto;

// Helpers de UI para errores
function mostrarError(mensaje) {
    const errorBox = document.getElementById('error-box');
    const errorText = document.getElementById('error-text');
    if (errorBox && errorText) {
        errorText.innerText = mensaje;
        errorBox.style.display = 'block';
    }
}

// --- HELPERS COMPARTIDOS ENTRE MÉTODOS ---

// Detectar si un punto tiene comportamiento discontinuo (saltos bruscos)
function esDiscontinuo(expr, x, paso = 0.01) {
    const f1 = evaluarFuncion(expr, x - paso);
    const f2 = evaluarFuncion(expr, x);
    const f3 = evaluarFuncion(expr, x + paso);

    if (!Number.isFinite(f1) || !Number.isFinite(f2) || !Number.isFinite(f3)) return true;

    // Salto brusco: diferencia relativa muy grande entre puntos cercanos
    const maxVal = Math.max(Math.abs(f1), Math.abs(f2), Math.abs(f3));
    const minVal = Math.min(Math.abs(f1), Math.abs(f2), Math.abs(f3));

    if (maxVal > 1e6 && minVal < 1e-6) return true;
    if (minVal > 0 && maxVal / minVal > 1e4) return true;

    return false;
}

window.esDiscontinuo = esDiscontinuo;

// Lee el criterio de paro y su valor (acepta fracciones como 1/16).
// Muestra error y retorna null si el valor no es valido.
function leerCriterio() {
    const criterio = document.getElementById('criterio').value;
    let valor;
    try {
        valor = math.evaluate(document.getElementById('valorCriterio').value);
        valor = Number(valor);
    } catch (e) {
        mostrarError('El valor del criterio debe ser un número o una fracción válida (ej. 1/16).');
        return null;
    }
    if (!Number.isFinite(valor) || valor <= 0) {
        mostrarError('Error: El criterio de paro debe ser mayor que 0.');
        return null;
    }
    return { criterio, valor };
}

// Limpia errores y tabla previa antes de un calculo
function limpiarTabla() {
    const errorBox = document.getElementById('error-box');
    const resContainer = document.getElementById('resultado-container');
    const tbody = document.getElementById('tabla-cuerpo');
    if (errorBox) errorBox.style.display = 'none';
    if (resContainer) resContainer.style.display = 'none';
    if (tbody) tbody.innerHTML = '';
    ocultarInfo();
}

// Conecta un input de funcion con su previsualizacion KaTeX en vivo
function cablearPreview(inputId, previewId, prefijo) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (!input || !preview) return;
    input.addEventListener('input', function(e) {
        const expr = e.target.value.trim();
        if (!expr) {
            preview.innerHTML = '';
            preview.className = 'preview-fx';
            return;
        }
        try {
            const latex = math.parse(expr).toTex();
            katex.render(`${prefijo} = ${latex}`, preview, { displayMode: true, throwOnError: false });
            preview.className = 'preview-fx preview-fx--valid';
        } catch (err) {
            preview.innerHTML = `<span class="preview-fx--invalid">Expresión no reconocida aún. Sigue escribiendo...</span>`;
            preview.className = 'preview-fx preview-fx--invalid';
        }
    });
}

// --- LÓGICA DE BISECCIÓN CLIENT-SIDE ---

function calcularBiseccion() {
    const expr = document.getElementById('funcion').value;

    if (!expr) {
        mostrarError('Error: Escribe una función f(x).');
        return;
    }

    const crit = leerCriterio();
    if (!crit) return;
    const { criterio, valor: valorCriterio } = crit;

    // 2. Lógica de Intervalo Automático
    let a_str = document.getElementById('a').value.trim();
    let b_str = document.getElementById('b').value.trim();
    let a, b;
    let intervaloModo = 'manual';

    if (a_str === '' || b_str === '') {
        const autoInt = buscarIntervaloAuto(expr);
        a = autoInt[0];
        b = autoInt[1];
        intervaloModo = autoInt[2] || 'auto';
        document.getElementById('a').value = a;
        document.getElementById('b').value = b;
    } else {
        a = parseFloat(a_str);
        b = parseFloat(b_str);
    }

    limpiarTabla();
    ocultarInfo();
    const resContainer = document.getElementById('resultado-container');
    const tbody = document.getElementById('tabla-cuerpo');

    if (!Number.isFinite(a) || !Number.isFinite(b) || a >= b) {
        mostrarError('Error: El intervalo debe cumplir a < b y contener números válidos.');
        return;
    }

    // Mostrar indicador de intervalo automático
    if (intervaloModo === 'auto' || intervaloModo === 'exacta') {
        mostrarInfo(`Intervalo automático detectado: [${a.toFixed(4)}, ${b.toFixed(4)}]. Puedes modificarlo manualmente si es necesario.`, 'info');
    }

    let fa = evaluarFuncion(expr, a);
    let fb = evaluarFuncion(expr, b);
    if (!Number.isFinite(fa) || !Number.isFinite(fb)) {
        mostrarError('Error: Revisa la sintaxis de tu función f(x).');
        return;
    }

    // Detectar raíz exacta en extremos
    if (fa === 0) {
        mostrarInfo(`Raíz exacta encontrada en el extremo! f(${a.toFixed(4)}) = 0. No se requieren más iteraciones.`, 'exito');
        const tr = document.createElement('tr');
        tr.innerHTML = `<td data-label="Iter">0</td><td data-label="a">${a.toFixed(4)}</td><td data-label="b">${b.toFixed(4)}</td><td data-label="x_m"><strong>${a.toFixed(4)}</strong></td><td data-label="f(x_m)">0.0000</td><td data-label="Ea (%)">--</td>`;
        tbody.appendChild(tr);
        resContainer.style.display = 'block';
        mostrarResumen(a, 0, 0, criterio, valorCriterio);
        return;
    }
    if (fb === 0) {
        mostrarInfo(`Raíz exacta encontrada en el extremo! f(${b.toFixed(4)}) = 0. No se requieren más iteraciones.`, 'exito');
        const tr = document.createElement('tr');
        tr.innerHTML = `<td data-label="Iter">0</td><td data-label="a">${a.toFixed(4)}</td><td data-label="b">${b.toFixed(4)}</td><td data-label="x_m"><strong>${b.toFixed(4)}</strong></td><td data-label="f(x_m)">0.0000</td><td data-label="Ea (%)">--</td>`;
        tbody.appendChild(tr);
        resContainer.style.display = 'block';
        mostrarResumen(b, 0, 0, criterio, valorCriterio);
        return;
    }

    if (fa * fb > 0) {
        mostrarError('Error: f(a) y f(b) deben tener signos opuestos (Teorema de Bolzano).');
        return;
    }

    let x_m_anterior = null;
    const maxIter = criterio === 'iteraciones' ? Math.min(100, Math.max(1, Math.floor(valorCriterio))) : 100;
    let n = 1;
    let criterioAlcanzado = false;

    while (n <= maxIter) {
        const x_m = (a + b) / 2;
        const fx_m = evaluarFuncion(expr, x_m);
        if (!Number.isFinite(fx_m)) {
            mostrarError('Error: La función produjo un valor no válido durante el cálculo.');
            return;
        }
        const ea = x_m_anterior === null ? null : Math.abs((x_m - x_m_anterior) / x_m) * 100;
        const tr = document.createElement('tr');
        tr.innerHTML = `<td data-label="Iter">${n}</td><td data-label="a">${a.toFixed(4)}</td><td data-label="b">${b.toFixed(4)}</td><td data-label="x_m">${x_m.toFixed(4)}</td><td data-label="f(x_m)">${fx_m.toFixed(4)}</td><td data-label="Ea (%)">${ea === null ? '--' : ea.toFixed(4) + '%'}</td>`;
        tbody.appendChild(tr);

        // Criterios de paro (combinados: f(x_m) y cambio en x_m)
        let parar = false;
        if (criterio === 'iteraciones' && n >= maxIter) parar = true;
        if (criterio === 'tolerancia') {
            if (Math.abs(fx_m) <= valorCriterio) parar = true;
            if (x_m_anterior !== null && Math.abs(x_m - x_m_anterior) <= valorCriterio) parar = true;
        }
        if (criterio === 'error' && ea !== null && ea <= valorCriterio) parar = true;

        if (parar) {
            criterioAlcanzado = true;
            break;
        }

        if (fa * fx_m < 0) { b = x_m; fb = fx_m; }
        else { a = x_m; fa = fx_m; }
        x_m_anterior = x_m;
        n++;
    }

    const x_final = (a + b) / 2;
    const fx_final = evaluarFuncion(expr, x_final);
    const ea_final = x_m_anterior === null ? null : Math.abs((x_final - x_m_anterior) / x_final) * 100;

    resContainer.style.display = 'block';
    mostrarResumen(x_final, fx_final, n, criterio, valorCriterio, ea_final, criterioAlcanzado);
}

// --- MOSTRAR RESUMEN FINAL DE LA RAÍZ ---
function mostrarResumen(x_raiz, fx_val, iteraciones, criterio, valorCriterio, ea_final = null, criterioAlcanzado = false, etiquetas = {}) {
    const resumenBox = document.getElementById('resumen-container');
    const btnCopy = document.getElementById('btn-copy-icon');
    if (!resumenBox) return;

    const raizStr = Number.isFinite(x_raiz) ? x_raiz.toFixed(6) : 'N/A';
    const fxStr = Number.isFinite(fx_val) ? fx_val.toFixed(6) : 'N/A';
    const eaStr = ea_final !== null ? ea_final.toFixed(4) + '%' : 'N/A';

    const etiquetaFx = etiquetas.fx || 'f(x) Final';
    let textoCriterio = '';
    if (criterio === 'tolerancia') {
        textoCriterio = etiquetas.tolerancia || `|f(x)| ≤ ${Number(valorCriterio).toFixed(6)}  ó  |Δx| ≤ ${Number(valorCriterio).toFixed(6)}`;
    } else if (criterio === 'error') {
        textoCriterio = `Ea ≤ ${Number(valorCriterio).toFixed(4)}%`;
    } else {
        textoCriterio = `${iteraciones} iteraciones`;
    }

    resumenBox.innerHTML = `
        <div class="resumen-grid">
            <div class="resumen-card resumen-card--raiz">
                <span class="resumen-icon"><i class="fa-solid fa-bullseye"></i></span>
                <span class="resumen-label">Raíz Aproximada</span>
                <span class="resumen-value">x = ${raizStr}</span>
            </div>
            <div class="resumen-card">
                <span class="resumen-icon"><i class="fa-solid fa-square-root-variable"></i></span>
                <span class="resumen-label">${etiquetaFx}</span>
                <span class="resumen-value">${fxStr}</span>
            </div>
            <div class="resumen-card">
                <span class="resumen-icon"><i class="fa-solid fa-rotate"></i></span>
                <span class="resumen-label">Iteraciones</span>
                <span class="resumen-value">${iteraciones}</span>
            </div>
            <div class="resumen-card">
                <span class="resumen-icon"><i class="fa-solid fa-percent"></i></span>
                <span class="resumen-label">Ea Final</span>
                <span class="resumen-value">${eaStr}</span>
            </div>
            <div class="resumen-card resumen-card--criterio">
                <span class="resumen-label">Criterio de Paro</span>
                <span class="resumen-value resumen-value--small">${textoCriterio}</span>
            </div>
        </div>
    `;
    resumenBox.style.display = 'block';

    // Mostrar botones de acción (copiar + exportar)
    if (btnCopy) btnCopy.style.display = 'inline-flex';
    const btnExport = document.getElementById('btn-export-csv');
    if (btnExport) btnExport.style.display = 'inline-flex';
}

window.mostrarResumen = mostrarResumen;

window.calcularBiseccion = calcularBiseccion;
window.mostrarError = mostrarError;
window.leerCriterio = leerCriterio;
window.limpiarTabla = limpiarTabla;
window.cablearPreview = cablearPreview;

// --- PREVISUALIZACIÓN EN VIVO CON KATEX ---
document.addEventListener('DOMContentLoaded', () => {
    cablearPreview('funcion', 'preview-fx', 'f(x)');
});

// --- COPIAR TABLA DE RESULTADOS (botón icono en cabecera) ---
function copiarTablaClipboard() {
    const tabla = document.querySelector('.procedure-table');
    const tbody = document.getElementById('tabla-cuerpo');
    if (!tabla || !tbody || !tbody.rows.length) {
        mostrarError('No hay resultados para copiar.');
        return;
    }

    let texto = '';
    for (const row of tabla.rows) {
        const cols = Array.from(row.cells).map(c => c.innerText.trim());
        texto += cols.join('\t') + '\n';
    }

    navigator.clipboard.writeText(texto).then(() => {
        const btn = document.getElementById('btn-copy-icon');
        if (!btn) return;
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check" style="color: #34d399;"></i>';
        setTimeout(() => { btn.innerHTML = originalHTML; }, 2000);
    }).catch(() => {
        mostrarError('No se pudo copiar. Usa Ctrl+C manualmente.');
    });
}

window.copiarTablaClipboard = copiarTablaClipboard;

// Exportar tabla como archivo .csv compatible con Excel
function exportarTablaCSV() {
    const tabla = document.querySelector('.procedure-table');
    const tbody = document.getElementById('tabla-cuerpo');
    if (!tabla || !tbody || !tbody.rows.length) {
        mostrarError('No hay resultados para exportar.');
        return;
    }

    const csv = [];
    Array.from(tabla.rows).forEach(row => {
        const cols = Array.from(row.cells).map(c => `"${c.innerText.trim().replace(/"/g, '""')}"`);
        csv.push(cols.join(','));
    });

    const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tabla_metodos_numericos.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

window.exportarTablaCSV = exportarTablaCSV;
