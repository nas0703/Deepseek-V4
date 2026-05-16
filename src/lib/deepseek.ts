import { Message, ModelOption, ChatMode } from '../types/chat';

export async function sendMessageToDeepSeek(
  messages: Omit<Message, 'id'>[],
  model: ModelOption,
  mode: ChatMode,
  config?: { temperature?: number, systemPrompt?: string, stream?: boolean, onChunk?: (text: string) => void, signal?: AbortSignal }
): Promise<Message> {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: config?.signal,
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
      errorMessage = errorData.error?.message || errorData.error || errorMessage;
    } catch (e) {
      if (textData.includes('<html')) {
        // Try to extract title or body from HTML, or provide a generic message based on status
        if (response.status === 413) {
            errorMessage = 'Payload Too Large: Maklumat yang dihantar adalah terlalu besar untuk diproses.';
        } else if (response.status === 504) {
            errorMessage = 'Gateway Timeout: Server mengambil masa yang terlalu lama untuk memberi respons.';
        } else if (response.status === 502) {
            errorMessage = 'Bad Gateway: Terdapat masalah pada pelayan (server) kami.';
        } else {
            // Extract from standard error pages if possible
            const match = textData.match(/<title>(.*?)<\/title>/is) || textData.match(/<pre>(.*?)<\/pre>/is);
            if (match && match[1]) {
                errorMessage = match[1].trim();
            } else {
                errorMessage = `Ralat API pelayan (${response.statusText})`;
            }
        }
      } else {
        errorMessage = textData || response.statusText;
      }
    }
    throw new Error(`API Error: ${response.status} - ${errorMessage}`);
  }

  if (config?.stream && config.onChunk) {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';
    let finalUsage: any = undefined;
    
    if (reader) {
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Parse SSE format
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the last incomplete line
        
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            const dataStr = line.slice(6);
            if (!dataStr) continue;
            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                throw new Error(data.error.message || data.error);
              }
              if (data.usage) {
                finalUsage = data.usage;
              }
              const delta = data.choices?.[0]?.delta?.content || '';
              if (delta) {
                fullText += delta;
                config.onChunk(fullText);
              }
            } catch (e) {
              console.error('Error parsing SSE:', e, dataStr);
              // Ignore parse errors for partial chunks, although JSON per line should be complete
            }
          }
        }
      }
    }
    
    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: fullText,
      usage: finalUsage
    };
  } else {
    const data = await response.json();
    return {
      id: crypto.randomUUID(),
      role: data.role,
      content: data.content,
      usage: data.usage
    };
  }
}
