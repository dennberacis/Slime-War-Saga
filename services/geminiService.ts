
import { GoogleGenAI } from "@google/genai";

export const getBattleStrategy = async (level: number, playerUnits: string[]): Promise<string> => {
  try {
    // Ensure we use the latest API KEY from the environment, handling potential missing key safely
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a high-command tactical AI for Slime War: Saga. Level: ${level}. Player Army: ${playerUnits.join(', ')}. Provide a short, heroic 1-2 sentence strategy tip for the commander.`,
      config: {
        maxOutputTokens: 150,
        temperature: 0.8,
        thinkingConfig: { thinkingBudget: 0 } // Disable thinking for quick UI response
      }
    });

    return response.text || "Hold the line! Use your Miners to build a strong economy before launching a mass Warrior assault.";
  } catch (error) {
    // Suppress logs in production to avoid console noise if API key is missing
    return "Intelligence suggests focusing on early diamond collection. Protect your Miners at all costs!";
  }
};
