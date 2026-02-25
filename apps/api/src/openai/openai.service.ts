import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class OpenAIService {
  private client: OpenAI;
  private logger = new Logger('OpenAIService');

  constructor(private config: ConfigService) {
    this.client = new OpenAI({
      apiKey: config.get<string>('OPENAI_API_KEY'),
    });
  }

  async chat(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: { model?: string; temperature?: number; maxTokens?: number },
  ): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: options?.model || this.config.get('OPENAI_MODEL', 'gpt-4o'),
        messages,
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens || 4096,
      });
      return response.choices[0]?.message?.content || '';
    } catch (error) {
      this.logger.error('OpenAI chat error', error);
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: this.config.get('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-small'),
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      this.logger.error('OpenAI embedding error', error);
      throw error;
    }
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const response = await this.client.embeddings.create({
        model: this.config.get('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-small'),
        input: texts,
      });
      return response.data.map((d) => d.embedding);
    } catch (error) {
      this.logger.error('OpenAI batch embedding error', error);
      throw error;
    }
  }
}
