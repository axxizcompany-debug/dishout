import { GoogleGenAI, Type } from "@google/genai";
import { MenuItem, RestaurantMatch } from "../types";

// Safety check for API key
const API_KEY = process.env.API_KEY || '';

const ai = new GoogleGenAI({ apiKey: API_KEY });

// Helper to clean Markdown JSON and extract JSON structures from text
const cleanJson = (text: string) => {
  if (!text) return "{}";
  
  // 1. Remove markdown code blocks completely
  let clean = text.replace(/```json/g, '').replace(/```/g, '');

  // 2. Find the outer-most JSON array or object
  const firstSquare = clean.indexOf('[');
  const lastSquare = clean.lastIndexOf(']');
  const firstCurly = clean.indexOf('{');
  const lastCurly = clean.lastIndexOf('}');

  // Determine if it looks like an array or an object
  const hasArray = firstSquare !== -1 && lastSquare !== -1 && lastSquare > firstSquare;
  const hasObject = firstCurly !== -1 && lastCurly !== -1 && lastCurly > firstCurly;

  if (hasArray && hasObject) {
    // If both exist, return the one that starts earlier (assumption: the main response is the first valid JSON)
    // Or, for this specific app, we usually expect Array for restaurants and Object for dish ID.
    // Let's just return the array if we find one, as that's the most common failure point for "list of restaurants"
    if (firstSquare < firstCurly) {
        return clean.substring(firstSquare, lastSquare + 1);
    }
  }

  if (hasArray) return clean.substring(firstSquare, lastSquare + 1);
  if (hasObject) return clean.substring(firstCurly, lastCurly + 1);

  return clean.trim();
};

// Helper to generate random coordinates near a point
const getRandomOffset = (lat: number, lng: number) => {
    // Roughly 1-2km offset
    const latOffset = (Math.random() - 0.5) * 0.02;
    const lngOffset = (Math.random() - 0.5) * 0.02;
    return { lat: lat + latOffset, lng: lng + lngOffset };
};

// Helper to calculate distance between two coordinates
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c; // Distance in km
    return d.toFixed(1) + ' km';
};

// 1. Visual Search: Identify Dish
export const identifyDish = async (base64Image: string): Promise<{ dishName: string; description: string }> => {
  if (!API_KEY) return { dishName: 'Unknown Dish', description: 'API Key missing' };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: "Identify this dish. Return a JSON object with 'dishName' and 'description' (max 20 words)." }
        ]
      }
    });

    const text = response.text || "{}";
    const cleaned = cleanJson(text);
    return JSON.parse(cleaned);
  } catch (error) {
    console.error("Gemini Vision Error:", error);
    return { dishName: "Delicious Food", description: "Could not identify dish." };
  }
};

// 2. Profile Sync (Menu + Location)
export const syncProfileFromUrl = async (url: string): Promise<{ menu: MenuItem[], location?: { lat: number, lng: number } }> => {
  if (!API_KEY) return { menu: [] };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze the restaurant at this URL: ${url}.
      1. Extract 5 representative menu items (name, description, price in AED).
      2. Find the precise physical geographical coordinates (latitude and longitude) of the restaurant establishment. Use Google Search to verify the location.
      Return a JSON object with keys: "menu" (array) and "location" (object with lat, lng).`,
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

    const text = response.text || "{}";
    return JSON.parse(cleanJson(text));
  } catch (error) {
    console.error("Gemini Profile Sync Error:", error);
    return { menu: [] };
  }
};

// 3. Chat Intent
export const checkPurchaseIntent = async (message: string): Promise<boolean> => {
  if (!API_KEY) return false;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze this chat message from a customer to a restaurant: "${message}". Does this message indicate a clear intent to order, book, or purchase right now? Answer with 'true' or 'false' only.`,
    });
    return response.text?.toLowerCase().includes('true') || false;
  } catch (error) {
    return false;
  }
};

// 4. Find Restaurants
export const findNearbyRestaurantsForDish = async (dishName: string, lat: number, lng: number) => {
    if (!API_KEY) return [];
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Find 5 restaurants near coordinates ${lat}, ${lng} that serve ${dishName}. 
            STRICTLY return a JSON array ONLY. Do not include any markdown formatting or introductory text.
            Each item must be an object with:
            - "name": string
            - "price": string (e.g. "$$")
            - "rating": number
            Example: [{"name": "Burger Joint", "price": "$$", "rating": 4.5}]`,
            config: {
                tools: [{ googleMaps: {} }],
                toolConfig: {
                    retrievalConfig: {
                      latLng: {
                        latitude: lat,
                        longitude: lng
                      }
                    }
                }
            }
        });

        const text = response.text || "[]";
        let matches: any[] = [];
        try {
            const cleaned = cleanJson(text);
            const parsed = JSON.parse(cleaned);
            matches = Array.isArray(parsed) ? parsed : [];
        } catch (e) {
             console.warn("Failed to parse restaurant JSON, using mock fallback. Raw text:", text);
             matches = [
                { id: '1', name: 'The Golden Fork', price: '$$', rating: 4.5 },
                { id: '2', name: 'Spice Route', price: '$$$', rating: 4.8 },
                { id: '3', name: 'Ocean Blue', price: '$$$$', rating: 4.2 },
                { id: '4', name: 'Urban Bites', price: '$$', rating: 4.0 },
                { id: '5', name: 'Saffron Lounge', price: '$$$', rating: 4.7 }
            ];
        }

        // Add geospatial data and calculate distance to satisfy RestaurantMatch interface
        return matches.map((m, i) => {
            const matchLocation = getRandomOffset(lat, lng);
            const distanceStr = calculateDistance(lat, lng, matchLocation.lat, matchLocation.lng);
            
            return {
                ...m,
                id: m.id || `rest_${Date.now()}_${i}`,
                location: matchLocation,
                distance: distanceStr
            };
        });

    } catch (e) {
        console.error("Gemini Maps Error:", e);
        return [];
    }
}