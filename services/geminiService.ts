import { GoogleGenAI, Type } from "@google/genai";
import { MenuItem, RestaurantMatch } from "../types.ts";

const cleanJson = (text: string | undefined) => {
  if (!text) return "[]";
  
  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    return text.substring(firstBracket, lastBracket + 1);
  }
  
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

export const identifyDish = async (base64Image: string): Promise<{ dishName: string; description: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: "Identify this dish precisely. Provide a name and a short appetizing description. Return only valid JSON." }
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
    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Vision Error:", error);
    // Return a structured error fallback instead of throwing to prevent UI crash
    return { dishName: "Unknown Dish", description: "We couldn't identify this specific dish. Try a clearer image." };
  }
};

export const findNearbyRestaurantsForDish = async (dishName: string, lat: number, lng: number): Promise<RestaurantMatch[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    // Maps grounding is only supported in Gemini 2.5 series models.
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-09-2025',
      contents: `Find real restaurants that serve ${dishName} near lat: ${lat}, lng: ${lng}. Return as a JSON array of objects with "name", "price", and "rating".`,
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
    
    // Fallback if the prompt didn't return JSON but the tool hit grounded metadata
    if (results.length === 0 && response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
       const chunks = response.candidates[0].groundingMetadata.groundingChunks;
       const mapResults = chunks.filter(c => c.maps).map((c, i) => ({
           name: c.maps?.title || "Nearby Restaurant",
           price: "$$",
           rating: 4.5
       }));
       if (mapResults.length > 0) return mapResults.map((m, i) => {
           const loc = getRandomOffset(lat, lng);
           return {
               id: `res_map_${Date.now()}_${i}`,
               ...m,
               distance: calculateDistance(lat, lng, loc.lat, loc.lng),
               location: loc
           };
       });
    }

    return results.map((m: any, i: number) => {
      const matchLocation = getRandomOffset(lat, lng);
      return {
        id: `res_json_${Date.now()}_${i}`,
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

export const syncProfileFromUrl = async (url: string): Promise<{ menu: MenuItem[], location?: { lat: number, lng: number } }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Extract menu and coordinates for: ${url}.`,
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
    return JSON.parse(response.text || "{}");
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
      contents: `Determine if this message shows intent to buy or visit: "${message}".`,
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
    const result = JSON.parse(response.text || "{}");
    return result.hasIntent || false;
  } catch (error) {
    return false;
  }
};