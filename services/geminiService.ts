
import { GoogleGenAI, Type } from "@google/genai";
import { ClothingItem, InspirationImage, OutfitSuggestion, GroundingSource, StyleProfile } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateOutfits = async (
  wardrobe: ClothingItem[], 
  inspiration: InspirationImage[],
  prompt: string,
  profile: StyleProfile,
  pinterestUrl?: string
): Promise<OutfitSuggestion[]> => {
  
  const wardrobeParts = wardrobe.map((item) => ({
    inlineData: {
      mimeType: "image/png",
      data: item.image.split(',')[1]
    }
  }));

  const inspirationParts = inspiration.map(item => ({
    inlineData: {
      mimeType: "image/png",
      data: item.image.split(',')[1]
    }
  }));

  const searchContext = pinterestUrl 
    ? `\nAdditionally, research the current aesthetic and fashion trends on this Pinterest board: ${pinterestUrl}. Replicate this board's "Visual DNA" using the user's wardrobe.`
    : "";

  const systemInstruction = `
    You are "The Lady's Personal Stylist". 
    Your primary goal is to provide THREE distinct outfit options from the user's WARDROBE that strictly adhere to their PERMANENT STYLE PROFILE.
    
    PERMANENT STYLE PROFILE:
    - Core Aesthetic: ${profile.aesthetic || 'Sophisticated and Timeless'}
    - Preferred Silhouettes: ${profile.silhouettes || 'Tailored and Balanced'}
    - Signature Colors: ${profile.signatureColors || 'Neutral and Cohesive'}
    - Forbidden Styles/Items: ${profile.forbidden || 'None'}

    Categories:
    1. "Classic": Elegant and timeless, the purest form of their profile.
    2. "Practical": Weather and comfort-optimized, but still stylish.
    3. "Bold": Fashion-forward, experimenting with their profile in new ways.

    ${searchContext}

    You MUST return a JSON block within your response.
    Format:
    {
      "outfits": [
        {
          "title": "Name",
          "description": "Explanation",
          "fashionGuideline": "Advice",
          "trendFactor": "Trend info",
          "identityMatch": "Briefly explain how this look respects the user's permanent profile preferences.",
          "type": "Classic",
          "items": ["0", "2"]
        }
      ]
    }
    The "items" array must contain indices of the provided WARDROBE images.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { 
          role: 'user', 
          parts: [
            ...wardrobeParts, 
            { text: "--- END OF WARDROBE ---" },
            ...inspirationParts,
            { text: "--- END OF INSPIRATION ---" },
            { text: prompt } 
          ] 
        }
      ],
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            outfits: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  fashionGuideline: { type: Type.STRING },
                  trendFactor: { type: Type.STRING },
                  identityMatch: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ["Classic", "Practical", "Bold"] },
                  items: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["title", "description", "fashionGuideline", "trendFactor", "identityMatch", "type", "items"]
              }
            }
          },
          required: ["outfits"]
        }
      }
    });

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const sources: GroundingSource[] = groundingChunks?.map((chunk: any) => ({
      title: chunk.web?.title || "Fashion Source",
      uri: chunk.web?.uri || "#"
    })).filter((s: any) => s.uri !== "#") || [];

    const data = JSON.parse(response.text || '{"outfits":[]}');
    
    return data.outfits.map((outfit: any) => ({
      ...outfit,
      sources,
      items: outfit.items.map((idx: string) => {
        const n = parseInt(idx);
        return wardrobe[n]?.id;
      }).filter(Boolean)
    }));
  } catch (error) {
    console.error("Gemini Error:", error);
    throw new Error("Our stylist is gathering current trends. Please try again.");
  }
};
