# Guía de Implementación: Nuevos Métodos Numéricos (Portal Numérico)

**Contexto para el Agente de IA:**
Este documento describe los requerimientos matemáticos, lógicos y de interfaz para implementar cuatro nuevos métodos numéricos en un proyecto web educativo basado en Vanilla JS (ES6), HTML y CSS. El proyecto ya utiliza `math.js` para evaluación matemática y cálculo de derivadas, y `KaTeX` para el renderizado de fórmulas.

Tu objetivo como IA será generar los archivos `.js` y los bloques HTML requeridos siguiendo estrictamente estas especificaciones.

---

## 1. Series de Taylor y Maclaurin

### 1.1 Fórmula Matemática
La aproximación de una función $f(x)$ mediante un polinomio de Taylor de grado $n$ centrado en $a$ es:
$$f(x) \approx P_n(x) = \sum_{k=0}^{n} \frac{f^{(k)}(a)}{k!} (x-a)^k$$
*Nota:* Si $a = 0$, se le conoce como Serie de Maclaurin.

### 1.2 Entradas (Inputs del DOM)
*   `funcion`: String de la función $f(x)$ (Ej. `cos(x)`).
*   `a`: Punto base / centro (Número).
*   `x`: Punto a evaluar / predecir (Número).
*   `n`: Grado del polinomio / Número de términos (Entero positivo).

### 1.3 Salidas (Outputs al DOM)
*   **Tabla de iteraciones:** Columnas: `Orden (n)`, `Derivada f^(n)(x)`, `Evaluación f^(n)(a)`, `Término de la serie`, `Aproximación actual`, `Error Verdadero (%)`.
*   **Resumen final:** Valor real (si es posible calcularlo con `math.evaluate`), valor aproximado y error.

### 1.4 Lógica del Script
1. Validar inputs y parsear la función con `math.js`.
2. Para cada orden $k$ desde $0$ hasta $n$:
   - Calcular la derivada de orden $k$ usando `math.derivative(expr, 'x')` recursivamente. (En $k=0$, es la función original).
   - Evaluar la derivada en el punto $a$.
   - Calcular el término $T_k = \frac{f^{(k)}(a)}{math.factorial(k)} \times (x - a)^k$.
   - Sumar $T_k$ al acumulador de la aproximación.
3. Para mostrar el polinomio en KaTeX, concatenar los términos algebraicos generados y renderizarlos usando `.toTex()` de `math.js`.

### 1.5 Graficación
*   Debe mostrarse en un canvas (ej. usando `Chart.js` o `Plotly`).
*   Trazar la curva original $f(x)$ y la curva del polinomio de Taylor $P_n(x)$ superpuestas en el intervalo $[a - 5, a + 5]$ para visualizar cómo la aproximación "abraza" a la función original en el punto $a$.

---

## 2. Interpolación Lineal de Lagrange

### 2.1 Fórmula Matemática
Dados dos puntos $(x_0, y_0)$ y $(x_1, y_1)$, se busca un polinomio de primer grado:
$$f_1(x) = \frac{x - x_1}{x_0 - x_1} y_0 + \frac{x - x_0}{x_1 - x_0} y_1$$

### 2.2 Entradas
*   `x0`, `y0`: Coordenadas del primer punto conocido.
*   `x1`, `y1`: Coordenadas del segundo punto conocido.
*   `x`: Valor de $X$ que se desea interpolar (predecir su $Y$).

### 2.3 Salidas
*   **Paso a paso:** Mostrar la sustitución de los valores en la fórmula original usando KaTeX.
*   **Resultado final:** El valor interpolado $y$ correspondiente a $x$.

### 2.4 Lógica del Script
1. Validar que $x_0 \neq x_1$ para evitar división por cero.
2. Calcular cada uno de los dos términos por separado.
3. Sumar para obtener $f_1(x)$.
4. Construir el string de la fórmula sustituida y renderizar con `KaTeX`.

---

## 3. Interpolación Polinomial de Lagrange (General)

### 3.1 Fórmula Matemática
Dado un conjunto de $n+1$ puntos $(x_i, y_i)$, el polinomio interpolante de grado $n$ es:
$$f_n(x) = \sum_{i=0}^{n} L_i(x) y_i$$
Donde $L_i(x)$ son los polinomios base de Lagrange:
$$L_i(x) = \prod_{\substack{j=0 \\ j \neq i}}^{n} \frac{x - x_j}{x_i - x_j}$$

### 3.2 Entradas
*   **Tabla Dinámica de Puntos:** Una interfaz donde el usuario pueda agregar o eliminar filas para ingresar pares de valores $(x_i, y_i)$. Mínimo 3 puntos.
*   `x`: Valor a interpolar.

### 3.3 Salidas
*   **Tabla de coeficientes:** Mostrar el valor calculado de cada $L_i(x)$.
*   **Polinomio Final:** La ecuación polinomial resultante (Renderizada en KaTeX).
*   **Resultado:** El valor $y$ aproximado.

### 3.4 Lógica del Script
1. Leer los datos de la tabla DOM hacia un arreglo de objetos `[{x, y}, ...]`.
2. Bucle externo (`i` desde $0$ a $n$): 
   - Inicializar $L_i = 1$.
   - Bucle interno (`j` desde $0$ a $n$):
     - Si $j \neq i$, $L_i \times= \frac{x - x_j}{x_i - x_j}$.
   - Sumar $(L_i \times y_i)$ al resultado total.
3. Mostrar procedimiento paso a paso multiplicando los factores para fines didácticos.

### 3.5 Graficación (Aplica para Lagrange Lineal y Polinomial)
*   Crear un gráfico de dispersión (Scatter plot) con los puntos conocidos marcados claramente (puntos gruesos).
*   Graficar la curva del polinomio resultante evaluándolo en un rango amplio que cubra los puntos.
*   Marcar el punto interpolado $(x, f(x))$ en un color distinto (ej. rojo neón o cian).

---

## 4. Integración Numérica: Regla de Simpson 1/3

### 4.1 Fórmula Matemática
Aproxima la integral definida de una función usando parábolas.
$$I = \int_a^b f(x)dx \approx \frac{h}{3} \left[ f(x_0) + 4\sum_{i=1, 3, 5...}^{n-1} f(x_i) + 2\sum_{j=2, 4, 6...}^{n-2} f(x_j) + f(x_n) \right]$$
Donde $h = \frac{b - a}{n}$ y $n$ debe ser un número **par** de subintervalos.

### 4.2 Entradas
*   `funcion`: String de la función a integrar $f(x)$.
*   `a`: Límite inferior de integración.
*   `b`: Límite superior de integración.
*   `n`: Número de subintervalos (Debe requerirse que sea par en la UI).

### 4.3 Salidas
*   **Tabla de Datos:** Mostrar el paso $h$, y una tabla con columnas $i$, $x_i$, $f(x_i)$, `Coeficiente (1, 4 o 2)`, `Producto`.
*   **Resultado:** El área aproximada bajo la curva.

### 4.4 Lógica del Script
1. Validar que $n > 0$ y $n \% 2 === 0$. Si no es par, lanzar alerta.
2. Calcular $h = (b - a) / n$.
3. Inicializar la suma con $f(a) + f(b)$.
4. Ciclo `for` desde $i = 1$ hasta $n - 1$:
   - Calcular $x_i = a + i \times h$.
   - Evaluar $y_i = math.evaluate(funcion, \{x: x_i\})$.
   - Si $i$ es impar, sumar $4 \times y_i$. Si $i$ es par, sumar $2 \times y_i$.
5. Multiplicar la suma total por $(h / 3)$.

### 4.5 Graficación
*   Graficar la función $f(x)$ continua.
*   Resaltar (sombrear) el área delimitada entre $x=a$ y $x=b$ por debajo de la curva para representar visualmente la integral calculada.
---

## 5. Estado de implementación

Actualizado: 2026-11-12 · Rama `main` · Tests: `node --test tests/` → **46/46**

### ✅ Implementado

| # | Método | Archivo | Entradas | Salidas |
|---|--------|---------|----------|---------|
| 1 | Series de Taylor y Maclaurin | `js/taylor.js` | `funcion-taylor`, `a-taylor`, `x-taylor`, `n-taylor` | Tabla orden 0..n (derivada, f⁽ⁿ⁾(a), término, aproximación, error verdadero %), Pₙ(x) en KaTeX, gráfica f(x) + Pₙ(x) |
| 2 | Interpolación Lineal de Lagrange | `js/lagrange.js` | `x0/y0`, `x1/y1`, `x-lineal` | Sustitución en KaTeX, tabla de términos, recta + 2 puntos + punto interpolado |
| 3 | Interpolación Polinomial de Lagrange | `js/lagrange.js` | Tabla dinámica `#tabla-puntos` (3–12 filas), `x-poly` | Tabla Lᵢ(x)·yᵢ, polinomio en KaTeX, dispersión + curva + marca |
| 4 | Regla de Simpson 1/3 | `js/simpson.js` | `funcion-simpson`, `a-simpson`, `b-simpson`, `n-simpson` | Tabla i/xᵢ/f(xᵢ)/coef(1-4-2)/producto, integral, gráfica con área sombreada |

Compartido:
- `js/graficadora.js`: 2+ curvas, dispersión, marcas múltiples, sombreado de área, rango exacto, leyenda.
- `js/punto-fijo.js`: `CONFIG_METODOS` (7 métodos) + `EJECUTORES` (router) + ocultado del criterio de paro para los métodos no iterativos.
- `js/biseccion.js`: `mostrarResumenCustom`, `renderizarProcedimiento`/`ocultarProcedimiento` (KaTeX), `numTexto`, tarjeta de Estado.
- `pages/calculadora.html`: 4 opciones nuevas, 4 bloques de inputs, `#grupo-criterio`, `#procedimiento-katex`, 3 `<script defer>` nuevos.
- `css/styles.css`: `.tabla-puntos`, `.punto-fila`, `.btn-quitar-punto`, `.resumen-card--ok/--warn`, `.procedimiento-katex`.

### ✅ Bugs corregidos en la auditoría (commit `f913549`)

- **B1** (grave): la raíz exacta (`f(x_m) = 0`) se perdía y el intervalo colapsaba hacia `b`.
- **B2**: `Ea = Infinity%` cuando `x_m = 0` → ahora `N/A`.
- **B3**: pedir >100 iteraciones se truncaba en silencio → ahora avisa.

### ⚠️ Desviaciones de esta guía (decisiones tomadas)

- **Gráficas**: se usa el canvas propio (`js/graficadora.js`) en lugar de Chart.js/Plotly (ya decidido: cero dependencias nuevas).
- **Taylor**: el intervalo es `[a - span, a + span]` con `span = max(5, |x - a|·1.25)`; es `[a-5, a+5]` salvo que `x` esté lejos.
- **Lagrange**: la lineal usa inputs sueltos (no tabla); la polinomial exige **3** puntos (la spec no fija mínimo, se alinea con el grado 2).
- **Topes de seguridad**: Taylor `n ≤ 20`, Lagrange `≤ 12` puntos, Simpson `n ≤ 1000`.
- **Simpson**: valida `n ≥ 2` **par** (la spec decía `n > 0` par, lo cual haría `n = 0` inválido).

### ⬜ Pendiente / mejoras futuras

- [ ] Lagrange polinomial: mostrar la multiplicación **factor por factor** de cada `Lᵢ(x)` en KaTeX (ahora solo se muestra el polinomio final y la tabla de aportes).
- [ ] Simpson: añadir la fórmula del **error estimado** de la regla (`-((b-a)/180)·h⁴·f⁴(ξ)`) al resumen.
- [ ] Taylor: `math.derivative` no puede derivar `abs`, `floor`, `sign`; ya se avisa, pero podría ofrecerse diferenciación numérica como respaldo.
- [ ] La tabla de puntos de Lagrange **no se limpia** al cambiar de método (se conserva a propósito; revisar si conviene resetearla).
- [ ] Actualizar `index.html` y `apuntes.html` para anunciar los 4 métodos nuevos (descubrimiento).
- [ ] Prueba manual en navegador de los 7 métodos (los tests usan un DOM falso; no hay E2E).
- [ ] Accesibilidad: revisar `aria-live` del bloque de procedimiento y el foco tras un error.
