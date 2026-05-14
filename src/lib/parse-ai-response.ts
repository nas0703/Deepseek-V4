import { ProjectFile } from '../types/project';

export interface ParsedAIResponse {
  explanation?: string;
  files?: ProjectFile[];
  commands?: string[];
  notes?: string[];
  raw: string;
  isJson: boolean;
  error?: string;
}

export function parseAIResponse(rawMessage: string): ParsedAIResponse {
  let jsonString = rawMessage.trim();
  
  // Buang markdown formatting jika ada
  if (jsonString.startsWith('```json')) {
    jsonString = jsonString.slice(7);
  } else if (jsonString.startsWith('```')) {
    jsonString = jsonString.slice(3);
  }
  
  if (jsonString.endsWith('```')) {
    jsonString = jsonString.slice(0, -3);
  }
  
  jsonString = jsonString.trim();

  // Cuba extract JSON object jika wujud teks sebelum/selepas
  const startIndex = jsonString.indexOf('{');
  const lastIndex = jsonString.lastIndexOf('}');
  
  if (startIndex !== -1 && lastIndex !== -1 && lastIndex >= startIndex) {
    jsonString = jsonString.substring(startIndex, lastIndex + 1);
  }

  try {
    const parsed = JSON.parse(jsonString);
    return {
      ...parsed,
      raw: rawMessage,
      isJson: true
    };
  } catch (error) {
    return {
      raw: rawMessage,
      isJson: false,
      error: 'Invalid JSON format dari AI'
    };
  }
}
