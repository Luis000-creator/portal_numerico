# Portal Numerico

Proyecto academico para la materia de Metodos Numericos. Plataforma web estatica con calculadora interactiva del Metodo de Biseccion, apuntes colaborativos con formulas LaTeX y fondo animado de particulas.

## Estructura

```
portal_numerico/
├── index.html              # Landing page (bienvenida, pagina raiz)
├── app.html                # Aplicacion: calculadora, apuntes y redes
├── README-GITHUB-PAGES.md  # Guia de despliegue en GitHub Pages
├── css/
│   └── styles.css          # Estilos del sitio (tema oscuro)
├── js/
│   ├── supabase-config.js  # Conexion con Supabase (clave publica)
│   ├── biseccion.js        # Evaluador mathjs, metodo de biseccion y KaTeX
│   ├── apuntes.js          # Carga y publicacion de apuntes en Supabase
│   └── canvas-animation.js # Animacion de estrellas y simbolos
└── sql/
    └── supabase.sql        # Esquema de la tabla apuntes (ejecutar en Supabase)
```

## Despliegue

Ver `README-GITHUB-PAGES.md` para los pasos de base de datos y GitHub Pages.
