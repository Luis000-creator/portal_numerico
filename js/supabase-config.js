// ==========================================================
// PORTAL NUMÉRICO - CONEXIÓN CON SUPABASE
// ==========================================================

// URL pública del proyecto
const SUPABASE_URL =
    "https://ekmgyckzxhuiyzlncryw.supabase.co";

// Publishable Key pública.
// Esta clave puede utilizarse en el frontend de GitHub Pages.
const SUPABASE_KEY =
    "sb_publishable_xQlhnjx88qMmDn0wBsbY5A_19a-h7QI";

// Crear cliente de Supabase
window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

console.log("Supabase conectado correctamente.");