# Portal Numérico - versión GitHub Pages

Esta versión es estática: no necesita ejecutar Spring Boot ni tener tu laptop encendida. GitHub Pages sirve `index.html`, `styles.css` y JavaScript.

## 1. Base de datos compartida

La página está preparada para Supabase (PostgreSQL). Supabase se conecta desde el navegador mediante `supabase-js`.

1. Crea un proyecto en Supabase.
2. Abre SQL Editor.
3. Ejecuta `supabase.sql`.
4. Ve a Project Settings / API y copia la URL del proyecto y la Publishable/Anon key.
5. Abre `supabase-config.js` y reemplaza los valores de ejemplo.
6. Sube `index.html`, `styles.css`, `supabase-config.js` y `supabase.sql` a GitHub.

## 2. GitHub Pages

En el repositorio: Settings -> Pages -> Deploy from a branch -> `main` -> `/ (root)` -> Save.

## 3. Qué funciona sin servidor

- Resolución de bisección en el navegador.
- Tabla de iteraciones.
- Navegación Resolver / Teoría / Redes.
- Buscador de apuntes.
- Fondo animado.
- Apuntes compartidos mediante Supabase.

## 4. Seguridad

El archivo `supabase-config.js` contiene una clave publicable/anon, no una clave `service_role`. La protección real de la base depende de RLS/policies. El SQL incluido permite lectura e inserción públicas porque el objetivo actual es un portal colaborativo de clase.

Si quieres que solo tus compañeros puedan publicar y que nadie externo pueda hacerlo, hay que añadir autenticación antes de publicar.
