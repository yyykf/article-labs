export type OpenAIConfig = {
  apiKeyConfigured: boolean;
  baseURL: string;
  model: string;
};

export function getOpenAIConfig(): OpenAIConfig {
  return {
    apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
    baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    model: process.env.OPENAI_MODEL || "gpt-5.4"
  };
}

export function getOpenAIAuthHeaders(): Record<string, string> {
  const config = getOpenAIConfig();
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set. Copy .env.example to .env.local and add your key.");
  }

  return {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    "Content-Type": "application/json",
    "OpenAI-Beta": "responses=v1"
  };
}

export function responsesUrl(): string {
  const baseURL = getOpenAIConfig().baseURL.replace(/\/+$/, "");
  return `${baseURL}/responses`;
}
