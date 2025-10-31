/* Archivo: netlify/functions/made.js - CÓDIGO FINAL CORREGIDO */

// Dependencia necesaria para hacer la llamada HTTP
const fetch = require('node-fetch');

// --- CONSTANTES GLOBALES ---

// 🔒 La clave se lee de la variable de entorno de Netlify
const API_KEY = process.env.GEMINI_API_KEY; 
const API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

// Encabezados para solucionar el error de CORS
const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*", // Permite el acceso desde cualquier origen (tu WordPress)
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
};

// --- INSTRUCCIONES DEL SISTEMA PARA MADE ---
// Este es el rol avanzado y detallado que definiste
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
        return {
            statusCode: 204, // 204 No Content para preflight exitoso
            headers: CORS_HEADERS,
            body: '' 
        };
    }

    // 2. Verificaciones iniciales
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

        // 3. Construcción del cuerpo de la solicitud a Gemini (¡JSON VÁLIDO!)
        const requestBody = {
            // ✅ systemInstruction se envía correctamente a este nivel
            systemInstruction: SYSTEM_INSTRUCTIONS, 
            
            contents: [{
                role: "user",
                parts: [{text: userPrompt}]
            }]
            // El campo 'config' que causaba el error ya no está aquí
        };

        // 4. Llamada a la API de Gemini
        const response = await fetch(`${API_ENDPOINT}?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        const data = await response.json();

        if (!response.ok) {
            // Manejo de errores de la API de Google
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
        };
    }
};
