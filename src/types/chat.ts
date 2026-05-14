import { ParsedAIResponse } from '../lib/parse-ai-response';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  parsedAction?: ParsedAIResponse;
  attachments?: {name: string, content: string}[];
  usage?: { prompt_tokens: number, completion_tokens: number, total_tokens: number };
}

export type ModelOption = 'deepseek-v4-flash' | 'deepseek-v4-pro';

export type ChatMode = 'General Chat' | 'Generate Code' | 'Fix Error' | 'Build Full App';
