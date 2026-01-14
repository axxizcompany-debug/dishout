import { GoogleGenAI, Type } from "@google/genai";
import { MenuItem, RestaurantMatch } from "../types.ts";

const cleanJson = (text: string | undefined) => {
  if (!text) return "[]";
  
  // Prioritize finding an array block first
  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    return text.substring(firstBracket, lastBracket + 1);
  }
  
  // Then try to find an object block
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return text.substring(firstBrace, lastBrace + 1);
  }
  
  // If no JSON-like structures are found, return an empty array string to prevent JSON.parse errors
  return "[]";
};

const getRandomOffset = (lat: number, lng: number) => {
  const latOffset = (Math.random() - 0.5) * 0.04;
  const lngOffset = (Math.random() - 0.5) * 0.04;
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

export const identifyDish = async (base64Image: string): Promise<{ dishName: string; description: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: "Identify this dish precisely. Return ONLY a JSON object: { \"dishName\": \"...\", \"description\": \"...\" }" }
        ]
      },
      config: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    return JSON.parse(cleanJson(response.text));
  } catch (error) {
    console.error("Gemini Vision Error:", error);
    return { dishName: "Delicious Dish", description: "Freshly prepared gourmet meal." };
  }
};

export const findNearbyRestaurantsForDish = async (dishName: string, lat: number, lng: number): Promise<RestaurantMatch[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Search for real restaurants serving ${dishName} near lat: ${lat}, lng: ${lng}. 
      Return ONLY a JSON array of objects. Each object MUST have: "name", "price" (e.g., "$$"), and "rating" (number).
      If no restaurants are found, return exactly []. Do not include any text or conversation.`,
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

    const cleaned = cleanJson(response.text);
    const matches = JSON.parse(cleaned);
    const results = Array.isArray(matches) ? matches : [];
    
    return results.map((m: any, i: number) => {
      const matchLocation = getRandomOffset(lat, lng);
      return {
        id: `res_${Date.now()}_${i}`,
        name: m.name || "Bistro",
        price: m.price || "$$",
        rating: m.rating || 4.5,
        distance: calculateDistance(lat, lng, matchLocation.lat, matchLocation.lng),
        location: matchLocation
      };
    });
  } catch (error) {
    console.error("Gemini Maps Error:", error);
    return [];
  }
};

export const syncProfileFromUrl = async (url: string): Promise<{ menu: MenuItem[], location?: { lat: number, lng: number } }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Extract menu and coordinates for: ${url}. Return JSON: { \"menu\": [{\"name\": \"...\", \"description\": \"...\", \"price\": \"... AED\"}], \"location\": {\"lat\": 0, \"lng\": 0} }`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json'
      }
    });
    return JSON.parse(cleanJson(response.text));
  } catch (error) {
    console.error("Gemini Profile Sync Error:", error);
    return { menu: [] };
  }
};

export const checkPurchaseIntent = async (message: string): Promise<boolean> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Is intent to buy or visit present? "${message}". Reply only true/false.`,
      config: { thinkingConfig: { thinkingBudget: 0 } }
    });
    return response.text?.toLowerCase().includes('true') || false;
  } catch (error) {
    return false;
  }
};