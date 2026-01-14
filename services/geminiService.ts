
import { GoogleGenAI, Type } from "@google/genai";
import { MenuItem, RestaurantMatch } from "../types.ts";

// Note: Removed window.process polyfill and getApiKey helper.
// The @google/genai library should be initialized using process.env.API_KEY directly.

const cleanJson = (text: string | undefined) => {
  if (!text) return "[]";
  
  // Try to find an array first
  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    return text.substring(firstBracket, lastBracket + 1);
  }
  
  // Try to find an object
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return text.substring(firstBrace, lastBrace + 1);
  }
  
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

// Fix: Correctly initialize GoogleGenAI using process.env.API_KEY as per guidelines
export const identifyDish = async (base64Image: string): Promise<{ dishName: string; description: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: "Identify this dish. Provide the dish name and a short appetizing description. Return strictly JSON." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            dishName: { type: Type.STRING },
            description: { type: Type.STRING }
          },
          required: ["dishName", "description"]
        },
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    
    const text = response.text;
    if (!text) throw new Error("Empty response from AI");
    return JSON.parse(text);
  } catch (error: any) {
    console.error("Gemini Vision Error:", error);
    return { 
      dishName: "Identification Failed", 
      description: "Could not identify the dish. Please ensure the food is clearly visible and try again." 
    };
  }
};

// Fix: Refactor to prioritize groundingMetadata over parsing response.text when using maps grounding
export const findNearbyRestaurantsForDish = async (dishName: string, lat: number, lng: number): Promise<RestaurantMatch[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Find real restaurants that serve ${dishName} near coordinates ${lat}, ${lng}.`,
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

    // Extract place information directly from grounding metadata as per guidelines
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const mapChunks = chunks.filter(c => c.maps);

    if (mapChunks.length > 0) {
      return mapChunks.map((c, i) => {
        const loc = getRandomOffset(lat, lng);
        return {
          id: `res_map_${Date.now()}_${i}`,
          name: c.maps?.title || "Nearby Restaurant",
          price: "$$",
          rating: 4.5,
          distance: calculateDistance(lat, lng, loc.lat, loc.lng),
          location: loc
        };
      });
    }

    // Fallback parsing (though grounding results are prioritized)
    const cleaned = cleanJson(response.text);
    const matches = JSON.parse(cleaned);
    const results = Array.isArray(matches) ? matches : [];

    return results.map((m: any, i: number) => {
      const matchLocation = getRandomOffset(lat, lng);
      return {
        id: `res_gen_${Date.now()}_${i}`,
        name: m.name || "Local Eatery",
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

// Fix: Update profile sync to handle potential non-JSON responses when search grounding is active
export const syncProfileFromUrl = async (url: string): Promise<{ menu: MenuItem[], location?: { lat: number, lng: number } }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Extract menu and location for: ${url}. Return as JSON.`,
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
    
    // Use cleanJson to extract JSON from potentially grounded response text
    const cleaned = cleanJson(response.text);
    return JSON.parse(cleaned || "{}");
  } catch (error) {
    console.error("Gemini Profile Sync Error:", error);
    return { menu: [] };
  }
};

// Fix: Standardize client initialization and model usage
export const checkPurchaseIntent = async (message: string): Promise<boolean> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Identify if this message implies a desire to order or visit: "${message}".`,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hasIntent: { type: Type.BOOLEAN }
          }
        },
        thinkingConfig: { thinkingBudget: 0 } 
      }
    });
    const cleaned = cleanJson(response.text);
    const result = JSON.parse(cleaned || "{}");
    return result.hasIntent || false;
  } catch (error) {
    return false;
  }
};
