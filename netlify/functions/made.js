/* Archivo: netlify/functions/made.js - CÓDIGO FINAL VERSIÓN 4 (FIX de CONFIG) */

const fetch = require('node-fetch');

// --- CONSTANTES GLOBALES ---

const API_KEY = process.env.GEMINI_API_KEY; 
const API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*", 
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
};

// --- INSTRUCCIONES DEL SISTEMA PARA MADE ---
// Se envían como parte del prompt para evitar el error de JSON
const SYSTEM_INSTRUCTIONS = `
Eres MADE 🛍️, una Asistente de Compras Virtual experta, amable y altamente empática. Tu misión es actuar como una personal shopper digital.
Que sabes: Experta en tecnología 📱, ropa 👟, hogar 🛋️, cocina 🍳, y más.
Tu Tarea Principal: No dar la respuesta final, sino hacer preguntas clave y concisas (una a la vez) para refinar la búsqueda del cliente (Ej: "¿Cuál es tu presupuesto? 💸" o "¿Qué tipo de tela prefieres? 🌿").
Regla de Oro: NUNCA des una recomendación final a menos que el cliente te acorrale en 1-2 opciones. Siempre usa emojis 🤩 para mantener el tono ligero.
`;
// ------------------------------------------


// Función principal que Netlify ejecuta
exports.handler = async (event, context) => {
    
    // 1. Manejo de Peticiones 'preflight' (CORS)
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 204, headers: CORS_HEADERS, body: '' };
    }

    if (event.httpMethod !== "POST") {
        return { statusCode: 405, headers: CORS_HEADERS, body: "Método no permitido. Usa POST." };
    }
    if (!API_KEY) {
        return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: "Clave de API no configurada en el servidor." }) };
    }

    try {
        const body = JSON.parse(event.body);
        const userPrompt = body.user_prompt;

        if (!userPrompt) {
            return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Falta el parámetro 'user_prompt'." }) };
        }

        // 3. Construcción del cuerpo de la solicitud a Gemini (SOLUCIÓN JSON/400)
        const requestBody = {
            contents: [{
                role: "user",
                // ✅ CONCATENACIÓN: La instrucción de sistema se adjunta al mensaje del usuario
                // Esto bypassa el error de configuración JSON de la API.
                parts: [{text: SYSTEM_INSTRUCTIONS + "\n\n" + "El cliente dice: " + userPrompt}]
            }]
        };


        // 4. Llamada a la API de Gemini
        const response = await fetch(`${API_ENDPOINT}?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        const data = await response.json();

        if (!response.ok) {
            const errorMessage = data.error ? data.error.message : "Error desconocido de Gemini.";
            return {
                statusCode: response.status,
                headers: CORS_HEADERS, 
                body: JSON.stringify({ error: errorMessage })
            };
        }

        // 5. Retorno de la respuesta exitosa
        const geminiResponseText = data.candidates[0].content.parts[0].text; 

        return {
            statusCode: 200,
            headers: CORS_HEADERS, 
            body: JSON.stringify({ text: geminiResponseText }),
        };

    } catch (error) {
        console.error("Error al procesar la solicitud:", error);
        return { 
            statusCode: 500, 
            headers: CORS_HEADERS, 
            body: JSON.stringify({ error: "Error interno del servidor (Proxy)." }) 
        }
    }
}
