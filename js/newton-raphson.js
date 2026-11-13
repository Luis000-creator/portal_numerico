// ============================================================================
// Itera - Newton-Raphson Module
// ============================================================================
// Contiene: lógica del método de Newton-Raphson para calculadora.html
// Requiere: mathjs (CDN UMD en calculadora.html) y utilidades compartidas de biseccion.js
// ============================================================================

// --- ALGORITMO DE NEWTON-RAPHSON ---

function calcularNewton() {
  const exprF = normalizarExpresion(document.getElementById("funcion-newton").value.trim());
  // Acepta constantes en X₀: "pi", "e", "pi/2"... (inputs type="text")
  let x_actual = parseNumeroConConstantes(document.getElementById("x0-newton").value);

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

  // Verificación inicial: f(x₀) en dominio y f'(x₀) ≠ 0
  let fPrimeX0;
  try {
    fPrimeX0 = parsedFPrime.evaluate({ x: x_actual });
  } catch (e) {
    fPrimeX0 = NaN;
  }
  if (!Number.isFinite(fPrimeX0) || Math.abs(fPrimeX0) < 1e-14) {
    // Si además f(x₀) no existe, el problema real es el dominio de f (p. ej.
    // sqrt(x) con x₀ < 0), no la derivada: se usa el mensaje de dominio.
    let fX0 = NaN;
    try {
      fX0 = parsedF.evaluate({ x: x_actual });
    } catch (e) {
      fX0 = NaN;
    }
    if (!Number.isFinite(fX0)) {
      mostrarError(mensajeErrorEvaluacion(exprF, `x = ${x_actual}`, 'f(x)'));
      return;
    }
    mostrarError(
      `Error: La derivada f'(X₀) es cero o no está definida (${fPrimeX0}). El método falla.`,
    );
    return;
  }

  const maxIterSolicitado =
    criterio === "iteraciones" ? Math.max(1, Math.floor(valorCriterio)) : 100;
  const maxIter = Math.min(100, maxIterSolicitado);
  const truncadoPorLimite = maxIterSolicitado > maxIter;
  const xs = [];
  let n = 1;
  let x_anterior = null;
  let fx_last = NaN,
    x_last = NaN,
    ea_last = null;
  let criterioAlcanzado = false;
  let motivoParo = null;
  // Paro ANTES del límite de iteraciones (divergencia o error de evaluación):
  // el mensaje post-loop debe decir la iteración REAL, no "límite de 100".
  let paroAnticipado = false;

  while (n <= maxIter) {
    xs.push(x_actual);
    // Evaluar f(x) y f'(x) por separado: un infinito es divergencia, un NaN
    // o un throw es dominio/sintaxis (mensaje de Bisección reutilizado) y la
    // derivada tiene su propio mensaje. Antes todo caía en un genérico.
    let fx = NaN, fpx = NaN;
    try {
      fx = parsedF.evaluate({ x: x_actual });
    } catch (e) {
      fx = NaN;
    }
    try {
      fpx = parsedFPrime.evaluate({ x: x_actual });
    } catch (e) {
      fpx = NaN;
    }

    if (!Number.isFinite(fx)) {
      if (fx === Infinity || fx === -Infinity) {
        mostrarError(`Divergencia: f(x) tiende a ${fx > 0 ? '+∞' : '−∞'} en la iteración ${n}.`);
        motivoParo = 'divergencia';
      } else {
        mostrarError(mensajeErrorEvaluacion(exprF, `x = ${x_actual}`, 'f(x)'));
        motivoParo = 'error de evaluación de f(x)';
      }
      paroAnticipado = true;
      break;
    }
    if (!Number.isFinite(fpx)) {
      mostrarError(`Error: la derivada f'(x) no está definida en x = ${x_actual} (revisa el dominio de f(x)).`);
      motivoParo = 'derivada no definida';
      paroAnticipado = true;
      break;
    }
    if (Math.abs(fpx) < 1e-14) {
      mostrarError(`Derivada f'(x) ≈ 0 en la iteración ${n}. División por cero inminente.`);
      motivoParo = 'derivada ≈ 0';
      paroAnticipado = true;
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

    // Criterios de paro (registrando cuál se cumplió, para el resumen)
    if (criterio === "iteraciones" && n >= maxIter) {
      criterioAlcanzado = true;
      motivoParo = `${n} iteraciones pedidas`;
      break;
    }
    if (criterio === "tolerancia" && Math.abs(fx) <= valorCriterio) {
      criterioAlcanzado = true;
      motivoParo = `residuo |f(x)| ≤ ${numTexto(valorCriterio)}`;
      break;
    }
    if (criterio === "error" && ea !== null && ea <= valorCriterio) {
      criterioAlcanzado = true;
      motivoParo = `Ea ≤ ${numTexto(valorCriterio)}%`;
      break;
    }

    // Divergencia: el valor se aleja demasiado
    if (Math.abs(x_siguiente) > 1e6) {
      mostrarError("Divergencia: El valor se está alejando demasiado de la solución.");
      motivoParo = 'divergencia';
      paroAnticipado = true;
      break;
    }

    // Preparar siguiente iteración
    x_anterior = x_actual;
    x_actual = x_siguiente;
    n++;
  }

  resContainer.style.display = "block";
  if (paroAnticipado) {
    // Paro por divergencia/error antes del límite: se informa la iteración
    // REAL en la que se detuvo (la que cuenta la tabla), no el límite.
    agregarInfo(
      `El cálculo se detuvo en la iteración ${n} (${motivoParo || 'paro anticipado'}) ` +
      `antes de las ${maxIter} iteraciones; no se cumplió el criterio de paro.` +
      (truncadoPorLimite ? ` Se habían pedido ${maxIterSolicitado} iteraciones (límite de seguridad: ${maxIter}).` : ''),
      "info"
    );
  } else if (truncadoPorLimite) {
    agregarInfo(`Se solicitaron ${maxIterSolicitado} iteraciones, pero el cálculo se limitó a ${maxIter} por seguridad.`, "info");
  } else if (!criterioAlcanzado) {
    agregarInfo(`Se alcanzó el límite de ${maxIter} iteraciones sin cumplir el criterio de paro.`, "info");
  }

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
  const etiquetas = {
    fx: "|f(x)| Final",
    tolerancia: `|f(x)| ≤ ${numTexto(valorCriterio)}`,
    abs: true,
    motivo: motivoParo,
  };
  if (!criterioAlcanzado) {
    etiquetas.etiquetaRaiz = "Último estimado (sin converger)";
    etiquetas.estado = "fallo";
    if (paroAnticipado) {
      // Divergencia: el iterado final es un número gigante sin valor
      // informativo; la tarjeta muestra '—' (el detalle está en la tabla y
      // en el mensaje de error).
      etiquetas.raizStr = "—";
      etiquetas.fxStr = "—";
      etiquetas.estadoTexto = `Detenido en la iteración ${n} (sin converger)`;
    } else {
      etiquetas.estadoTexto = "Criterio no alcanzado";
    }
  }
  if (Number.isFinite(residuo) && residuo > Math.max(valorCriterio * 10, 1e-12) && !criterioAlcanzado) {
    agregarInfo(
      `El método terminó sin cumplir el criterio: |f(x)| = ${numTexto(residuo)}. El valor mostrado no es una raíz verificada.`,
      "aviso"
    );
  }
  mostrarResumen(
    x_last, fx_final,
    tbody.children.length,
    criterio, valorCriterio, ea_last, criterioAlcanzado, etiquetas
  );
  graficarResultado(exprF, { xs, raiz: criterioAlcanzado ? x_last : null });
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
    const d = derivadaYaCalculada || math.derivative(math.parse(normalizarExpresion(expr)), "x");
    // mathjs 11.8 serializa "sin(x) - x/2" como "cos(x) + -1 / 2": el signo
    // negativo queda como término de la suma y toTex lo pinta como
    // "\frac{-1}{2}". Se limpia el "+ -" y se regenera el LaTeX; si el
    // re-parse falla se usa el toTex original.
    let latex;
    try {
      latex = math.parse(d.toString().replace(/\+\s*-/g, '-')).toTex();
    } catch (e) {
      latex = d.toTex();
    }
    katex.render(`f'(x) = ${latex}`, preview, { displayMode: true, throwOnError: false });
    preview.className = "preview-fx preview-fx--valid";
  } catch (e) {
    preview.innerHTML = `<span class="preview-fx--invalid">No se pudo derivar aún. Revisa la sintaxis de f(x)...</span>`;
    preview.className = "preview-fx preview-fx--invalid";
  }
}

// Sincronizar previsualización KaTeX al interactuar (lazy: sin render en carga)
document.addEventListener("DOMContentLoaded", () => {
  cablearPreview("funcion-newton", "preview-fx-newton", "f(x)");
  const inputFx = document.getElementById("funcion-newton");
  if (inputFx) {
    inputFx.addEventListener("input", (e) => {
      if (window.Vendor && window.Vendor.ensureCalc) {
        window.Vendor.ensureCalc()
          .then(() => actualizarPreviewDerivada(document.getElementById("funcion-newton")?.value || ""))
          .catch(() => {});
      } else {
        actualizarPreviewDerivada(e.target.value);
      }
    });
  }
});

window.actualizarPreviewDerivada = actualizarPreviewDerivada;

// Exponer globalmente
window.calcularNewton = calcularNewton;

