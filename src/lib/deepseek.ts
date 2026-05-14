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
    const textData = await response.text();
    try {
      const errorData = JSON.parse(textData);
      errorMessage = errorData.error || errorMessage;
    } catch (e) {
      errorMessage = textData || response.statusText;
    }
    throw new Error(`API Error: ${response.status} - ${errorMessage}`);
  }

  const data = await response.json();
  
  return {
    id: crypto.randomUUID(),
    role: data.role,
    content: data.content,
    usage: data.usage
  };
}
