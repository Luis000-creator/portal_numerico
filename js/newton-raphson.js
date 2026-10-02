// ============================================================================
// Itera - Newton-Raphson Module
// ============================================================================
// Contiene: lógica del método de Newton-Raphson para calculadora.html
// Requiere: mathjs (CDN UMD en calculadora.html) y utilidades compartidas de biseccion.js
// ============================================================================

// --- ALGORITMO DE NEWTON-RAPHSON ---

function calcularNewton() {
  const exprF = document.getElementById("funcion-newton").value.trim();
  let x_actual = parseFloat(document.getElementById("x0-newton").value);

  const crit = leerCriterio();
  if (!crit) return;
  const { criterio, valor: valorCriterio } = crit;

  limpiarTabla();
  const resContainer = document.getElementById("resultado-container");
  const tbody = document.getElementById("tabla-cuerpo");

  if (!exprF) {
    mostrarError("Error: Escribe la función f(x).");
    return;
  }
  if (!Number.isFinite(x_actual)) {
    mostrarError("Error: El valor inicial X₀ debe ser un número válido.");
    return;
  }

  // Compilar función y su derivada una sola vez para eficiencia
  let parsedF, parsedFPrime;
  if (typeof math === 'undefined' || !math.parse || !math.derivative) {
    mostrarError("La librería matemática aún se está cargando. Intenta de nuevo en un momento.");
    return;
  }
  try {
    parsedF = math.parse(exprF);
    parsedFPrime = math.derivative(parsedF, "x");
    actualizarPreviewDerivada(exprF, parsedFPrime);
  } catch (e) {
    mostrarError("Error: Sintaxis inválida en la función f(x).");
    return;
  }

  // Verificación inicial: f'(x₀) ≠ 0
  let fPrimeX0;
  try {
    fPrimeX0 = parsedFPrime.evaluate({ x: x_actual });
  } catch (e) {
    mostrarError("Error: No se pudo evaluar la derivada en X₀.");
    return;
  }
  if (!Number.isFinite(fPrimeX0) || Math.abs(fPrimeX0) < 1e-14) {
    mostrarError(
      `Error: La derivada f'(X₀) es cero o no está definida (${fPrimeX0}). El método falla.`,
    );
    return;
  }

  const maxIter =
    criterio === "iteraciones" ? Math.min(100, Math.max(1, Math.floor(valorCriterio))) : 100;
  let n = 1;
  let x_anterior = null;
  let fx_last = NaN,
    x_last = NaN,
    ea_last = null;
  let criterioAlcanzado = false;

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

    const tr = document.createElement("tr");
    tr.innerHTML = `<td data-label="Iter (n)">${n}</td><td data-label="xₙ">${x_actual.toFixed(6)}</td><td data-label="f(xₙ)">${fx.toFixed(6)}</td><td data-label="f'(xₙ)">${fpx.toFixed(6)}</td><td data-label="xₙ₊₁">${x_siguiente.toFixed(6)}</td><td data-label="Ea (%)">${ea === null ? "--" : ea.toFixed(4) + "%"}</td>`;
    tbody.appendChild(tr);

    fx_last = fx;
    x_last = x_siguiente;
    ea_last = ea;

    // Criterios de paro
    if (criterio === "iteraciones" && n >= maxIter) {
      criterioAlcanzado = true;
      break;
    }
    if (criterio === "tolerancia" && Math.abs(fx) <= valorCriterio) {
      criterioAlcanzado = true;
      break;
    }
    if (criterio === "error" && ea !== null && ea <= valorCriterio) {
      criterioAlcanzado = true;
      break;
    }

    // Divergencia: el valor se aleja demasiado
    if (Math.abs(x_siguiente) > 1e6) {
      mostrarError("Divergencia: El valor se está alejando demasiado de la solución.");
      break;
    }

    // Preparar siguiente iteración
    x_anterior = x_actual;
    x_actual = x_siguiente;
    n++;
  }

  resContainer.style.display = "block";

  // Mostrar resumen final (usa la función global de biseccion.js)
  // Evaluar f(x) en la raíz aproximada final para el resumen
  let fx_final = NaN;
  if (Number.isFinite(x_last)) {
    try {
      fx_final = parsedF.evaluate({ x: x_last });
    } catch (e) {
      fx_final = NaN;
    }
  }
  const residuo = Number.isFinite(fx_final) ? Math.abs(fx_final) : NaN;
  mostrarResumen(x_last, fx_final, n, criterio, valorCriterio, ea_last, criterioAlcanzado, {
    fx: "|f(x)| Final",
    tolerancia: `|f(x)| ≤ ${Number(valorCriterio).toFixed(6)}`,
  });
}

// Muestra la derivada f'(x) calculada con mathjs en el panel dedicado.
// Acepta la expresión o un nodo derivada ya calculado (para no derivar dos veces).
function actualizarPreviewDerivada(exprF, derivadaYaCalculada) {
  const preview = document.getElementById("preview-fpx-newton");
  if (!preview) return;
  const expr = (exprF || "").trim();
  if (!expr) {
    preview.innerHTML = "";
    preview.className = "preview-fx";
    return;
  }
  if (typeof math === 'undefined' || typeof katex === 'undefined') {
    preview.innerHTML = "";
    preview.className = "preview-fx";
    return;
  }
  try {
    const d = derivadaYaCalculada || math.derivative(math.parse(expr), "x");
    const latex = d.toTex();
    katex.render(`f'(x) = ${latex}`, preview, { displayMode: true, throwOnError: false });
    preview.className = "preview-fx preview-fx--valid";
  } catch (e) {
    preview.innerHTML = `<span class="preview-fx--invalid">No se pudo derivar aún. Revisa la sintaxis de f(x)...</span>`;
    preview.className = "preview-fx preview-fx--invalid";
  }
}

// Sincronizar previsualización KaTeX al cargar
document.addEventListener("DOMContentLoaded", () => {
  cablearPreview("funcion-newton", "preview-fx-newton", "f(x)");
  const inputFx = document.getElementById("funcion-newton");
  if (inputFx) {
    inputFx.addEventListener("input", (e) => actualizarPreviewDerivada(e.target.value));
    actualizarPreviewDerivada(inputFx.value);
  }
});

// --- EJEMPLOS RÁPIDOS PARA NEWTON-RAPHSON ---
function cargarEjemploNewton(expr, x0) {
  const inputFx = document.getElementById("funcion-newton");
  const inputX0 = document.getElementById("x0-newton");
  if (inputFx) {
    inputFx.value = expr;
    inputFx.dispatchEvent(new Event("input"));
    actualizarPreviewDerivada(expr);
  }
  if (inputX0) {
    inputX0.value = x0;
  }
}

window.actualizarPreviewDerivada = actualizarPreviewDerivada;
window.cargarEjemploNewton = cargarEjemploNewton;

// Exponer globalmente
window.calcularNewton = calcularNewton;

