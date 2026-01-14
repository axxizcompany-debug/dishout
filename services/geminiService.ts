
import { GoogleGenAI, Type } from "@google/genai";
import { MenuItem, RestaurantMatch } from "../types";

// Helper to clean Markdown JSON and extract JSON structures from text
const cleanJson = (text: string) => {
  if (!text) return "{}";
  const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  return jsonMatch ? jsonMatch[0] : text.trim();
};

// Helper to generate random coordinates near a point if search results lack them
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

// 1. Visual Search: Identify Dish using Gemini 3 Flash
export const identifyDish = async (base64Image: string): Promise<{ dishName: string; description: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: "Identify this dish. Return ONLY a JSON object with 'dishName' and 'description' (max 20 words)." }
        ]
      },
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text || "{}";
    return JSON.parse(cleanJson(text));
  } catch (error) {
    console.error("Gemini Vision Error:", error);
    return { dishName: "Delicious Food", description: "Could not identify dish." };
  }
};

// 2. Profile Sync using Gemini 3 Pro (Complex Reasoning)
export const syncProfileFromUrl = async (url: string): Promise<{ menu: MenuItem[], location?: { lat: number, lng: number } }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Analyze the restaurant at this URL: ${url}. 
      1. Extract 5 menu items (name, description, price in AED). 
      2. Find the coordinates (lat, lng).
      Return JSON only.`,
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
                }
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

    return JSON.parse(cleanJson(response.text || "{}"));
  } catch (error) {
    console.error("Gemini Profile Sync Error:", error);
    return { menu: [] };
  }
};

// 3. Chat Intent using Gemini 3 Flash
export const checkPurchaseIntent = async (message: string): Promise<boolean> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Does this message indicate a clear intent to order or book? "${message}". Answer with true/false only.`,
    });
    return response.text?.toLowerCase().includes('true') || false;
  } catch (error) {
    return false;
  }
};

// 4. Find Restaurants using Gemini 2.5 Flash with Maps Grounding
export const findNearbyRestaurantsForDish = async (dishName: string, lat: number, lng: number): Promise<RestaurantMatch[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Find 5 specific restaurants near ${lat}, ${lng} that serve ${dishName}. Return a JSON array of objects with 'name', 'price' ($ to $$$$), and 'rating' (1-5).`,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: { latitude: lat, longitude: lng }
          }
        }
      }
    });

    const text = response.text || "[]";
    const parsed = JSON.parse(cleanJson(text));
    const matches = Array.isArray(parsed) ? parsed : [];

    // Extract grounding URLs if available
    const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    return matches.map((m, i) => {
      const matchLocation = getRandomOffset(lat, lng);
      return {
        ...m,
        id: `rest_${Date.now()}_${i}`,
        location: matchLocation,
        distance: calculateDistance(lat, lng, matchLocation.lat, matchLocation.lng),
        groundingUrl: grounding[i]?.maps?.uri || null
      };
    });
  } catch (e) {
    console.error("Gemini Maps Error:", e);
    return [];
  }
};
