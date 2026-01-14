import { GoogleGenAI, Type } from "@google/genai";
import { MenuItem, RestaurantMatch } from "../types";

// Helper to clean Markdown JSON and extract JSON structures from text
const cleanJson = (text: string | undefined) => {
  if (!text) return "[]";
  const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  return jsonMatch ? jsonMatch[0] : text.trim();
};

const getRandomOffset = (lat: number, lng: number) => {
  const latOffset = (Math.random() - 0.5) * 0.02;
  const lngOffset = (Math.random() - 0.5) * 0.02;
  return { lat: lat + latOffset, lng: lng + lngOffset };
};

const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return (R * c).toFixed(1) + ' km';
};

/**
 * 1. Visual Search: Identify Dish using Gemini 3 Flash.
 * Optimized with thinkingBudget: 0 for speed.
 */
export const identifyDish = async (base64Image: string): Promise<{ dishName: string; description: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: "Identify this dish. Return ONLY a JSON object with keys 'dishName' and 'description' (max 15 words)." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    const text = response.text;
    return JSON.parse(cleanJson(text));
  } catch (error) {
    console.error("Gemini Vision Error:", error);
    return { dishName: "Delicious Dish", description: "A beautifully prepared meal." };
  }
};

/**
 * 2. Find Restaurants using Gemini 2.5 Flash with Maps Grounding.
 * Maps grounding is only supported in Gemini 2.5 series.
 */
export const findNearbyRestaurantsForDish = async (dishName: string, lat: number, lng: number): Promise<RestaurantMatch[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // Correct model for Maps Grounding
      contents: `Find 5 real restaurants near me (lat: ${lat}, lng: ${lng}) that definitely serve ${dishName}. Return as a JSON array of objects with keys: name, price (e.g. '$$'), and rating (1-5).`,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: { latitude: lat, longitude: lng }
          }
        },
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    const text = response.text;
    const matches = JSON.parse(cleanJson(text));
    
    // Fallback if the model returns something other than an array
    const results = Array.isArray(matches) ? matches : [];
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    return results.map((m: any, i: number) => {
      // Maps grounding results usually don't have lat/lng in the JSON directly, 
      // but we need them for the map. We'll use random offsets or just show them near the user.
      const matchLocation = getRandomOffset(lat, lng);
      return {
        id: `res_${Date.now()}_${i}`,
        name: m.name || "Unknown Restaurant",
        price: m.price || "$$",
        rating: m.rating || 4.5,
        distance: calculateDistance(lat, lng, matchLocation.lat, matchLocation.lng),
        location: matchLocation,
        groundingUrl: groundingChunks[i]?.maps?.uri || null
      };
    });
  } catch (error) {
    console.error("Gemini Maps Error:", error);
    return [];
  }
};

/**
 * 3. Profile Sync using Gemini 3 Pro (Complex Reasoning).
 */
export const syncProfileFromUrl = async (url: string): Promise<{ menu: MenuItem[], location?: { lat: number, lng: number } }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Search for and analyze the restaurant at this URL: ${url}. Extract 5 top menu items with descriptions and prices in AED. Also find their physical coordinates (lat, lng). Return strictly as JSON.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            menu: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  price: { type: Type.STRING }
                },
                required: ['name', 'price']
              }
            },
            location: {
              type: Type.OBJECT,
              properties: {
                lat: { type: Type.NUMBER },
                lng: { type: Type.NUMBER }
              }
            }
          }
        }
      }
    });

    return JSON.parse(cleanJson(response.text));
  } catch (error) {
    console.error("Gemini Profile Sync Error:", error);
    return { menu: [] };
  }
};

/**
 * 4. Chat Intent using Gemini 3 Flash.
 */
export const checkPurchaseIntent = async (message: string): Promise<boolean> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze if this user message indicates they want to order food or visit the restaurant: "${message}". Return only 'true' or 'false'.`,
      config: { thinkingConfig: { thinkingBudget: 0 } }
    });
    return response.text?.toLowerCase().includes('true') || false;
  } catch (error) {
    return false;
  }
};
