import { Message, ModelOption, ChatMode } from '../types/chat';

export async function sendMessageToDeepSeek(
  messages: Omit<Message, 'id'>[],
  model: ModelOption,
  mode: ChatMode,
  config?: { temperature?: number, systemPrompt?: string }
): Promise<Message> {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      model,
      mode,
      ...config
    }),
  });

  if (!response.ok) {
    let errorMessage = 'Unknown error occurred.';
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch (e) {
      errorMessage = await response.text();
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  
  return {
    id: crypto.randomUUID(),
    role: data.role,
    content: data.content,
    usage: data.usage
  };
}
