
import { GoogleGenAI } from "@google/genai";

export const getBattleStrategy = async (level: number, playerUnits: string[]) => {
  // Always create a new instance using process.env.API_KEY directly
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Suggest a strategy for Slime War: Crystal Saga level ${level}. My army consists of ${playerUnits.join(', ')}. Provide a short, heroic 2-sentence tip.`,
      config: {
        maxOutputTokens: 100,
        temperature: 0.7
      }
    });

    return response.text;
  } catch (error) {
    console.error("AI strategy failed:", error);
    return "Focus on building your miners first to sustain a large army of Slime Knights!";
  }
};
