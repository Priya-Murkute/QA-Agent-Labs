import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

export const ai = new OpenAI ({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
});

export const model = process.env.AI_MODEL ?? 'gpt-5';