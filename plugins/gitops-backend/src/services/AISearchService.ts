import { Config } from '@backstage/config';
import { Logger } from 'winston';

/**
 * Search result from AI-powered search
 */
export interface AISearchResult {
  id: string;
  title: string;
  content: string;
  source: 'documentation' | 'code' | 'config' | 'runbook' | 'api';
  path: string;
  relevanceScore: number;
  highlights: string[];
  metadata?: Record<string, any>;
}

/**
 * Search response with context
 */
export interface AISearchResponse {
  query: string;
  results: AISearchResult[];
  summary: string;
  suggestedQueries: string[];
  totalResults: number;
  searchTime: number;
  llmModel?: string;
}

/**
 * Document for indexing
 */
export interface IndexedDocument {
  id: string;
  title: string;
  content: string;
  source: 'documentation' | 'code' | 'config' | 'runbook' | 'api';
  path: string;
  metadata?: Record<string, any>;
  embedding?: number[];
  lastIndexed: string;
}

/**
 * LLM Provider configuration
 */
export interface LLMProviderConfig {
  provider: 'openai' | 'anthropic' | 'ollama' | 'azure-openai';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  embeddingModel?: string;
}

/**
 * AI Search Service Configuration
 */
export interface AISearchServiceConfig {
  enabled: boolean;
  llmProvider: LLMProviderConfig;
  indexPath?: string;
  maxResults?: number;
  minRelevanceScore?: number;
}

/**
 * AI-Powered Search Service
 *
 * Provides semantic search capabilities using LLM embeddings and natural language
 * query understanding. Supports multiple LLM providers (OpenAI, Anthropic, Ollama).
 *
 * Features:
 * - Vector-based semantic search
 * - Natural language query understanding
 * - Multi-source search (docs, code, configs)
 * - Query suggestions and refinement
 * - LLM-generated result summaries
 */
export class AISearchService {
  private config: AISearchServiceConfig;
  private logger: Logger;
  private documentIndex: Map<string, IndexedDocument> = new Map();
  private isIndexed: boolean = false;

  constructor(config: Config, logger: Logger) {
    this.logger = logger;

    const aiSearchConfig = config.getOptionalConfig('gitops.aiSearch');

    this.config = {
      enabled: aiSearchConfig?.getOptionalBoolean('enabled') ?? false,
      llmProvider: {
        provider: (aiSearchConfig?.getOptionalString('provider') || 'openai') as any,
        apiKey: aiSearchConfig?.getOptionalString('apiKey') || process.env.OPENAI_API_KEY,
        baseUrl: aiSearchConfig?.getOptionalString('baseUrl'),
        model: aiSearchConfig?.getOptionalString('model') || 'gpt-4o-mini',
        embeddingModel: aiSearchConfig?.getOptionalString('embeddingModel') || 'text-embedding-3-small',
      },
      indexPath: aiSearchConfig?.getOptionalString('indexPath'),
      maxResults: aiSearchConfig?.getOptionalNumber('maxResults') || 10,
      minRelevanceScore: aiSearchConfig?.getOptionalNumber('minRelevanceScore') || 0.5,
    };

    this.logger.info(`AI Search Service initialized (enabled: ${this.config.enabled}, provider: ${this.config.llmProvider.provider})`);
  }

  /**
   * Check if AI Search is enabled and configured
   */
  isEnabled(): boolean {
    return this.config.enabled && !!this.config.llmProvider.apiKey;
  }

  /**
   * Get service status and configuration
   */
  getStatus(): {
    enabled: boolean;
    provider: string;
    indexed: boolean;
    documentCount: number;
  } {
    return {
      enabled: this.isEnabled(),
      provider: this.config.llmProvider.provider,
      indexed: this.isIndexed,
      documentCount: this.documentIndex.size,
    };
  }

  /**
   * Search using natural language query
   */
  async search(query: string, options?: {
    sources?: ('documentation' | 'code' | 'config' | 'runbook' | 'api')[];
    maxResults?: number;
    includeContext?: boolean;
  }): Promise<AISearchResponse> {
    const startTime = Date.now();
    const maxResults = options?.maxResults || this.config.maxResults || 10;

    try {
      // If AI is enabled and configured, use LLM for search
      if (this.isEnabled()) {
        return await this.performAISearch(query, options);
      }

      // Fallback to keyword-based search
      return await this.performKeywordSearch(query, options);
    } catch (error) {
      this.logger.error('AI Search error:', error);

      // Return empty results on error
      return {
        query,
        results: [],
        summary: 'Search encountered an error. Please try again.',
        suggestedQueries: [],
        totalResults: 0,
        searchTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Perform AI-powered semantic search
   */
  private async performAISearch(query: string, options?: {
    sources?: ('documentation' | 'code' | 'config' | 'runbook' | 'api')[];
    maxResults?: number;
    includeContext?: boolean;
  }): Promise<AISearchResponse> {
    const startTime = Date.now();
    const maxResults = options?.maxResults || this.config.maxResults || 10;

    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query);

    // Search indexed documents
    const scoredResults = Array.from(this.documentIndex.values())
      .filter(doc => !options?.sources || options.sources.includes(doc.source))
      .map(doc => ({
        doc,
        score: doc.embedding ? this.cosineSimilarity(queryEmbedding, doc.embedding) : 0,
      }))
      .filter(item => item.score >= (this.config.minRelevanceScore || 0.5))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);

    // Convert to search results
    const results: AISearchResult[] = scoredResults.map(({ doc, score }) => ({
      id: doc.id,
      title: doc.title,
      content: doc.content.substring(0, 500) + (doc.content.length > 500 ? '...' : ''),
      source: doc.source,
      path: doc.path,
      relevanceScore: score,
      highlights: this.extractHighlights(doc.content, query),
      metadata: doc.metadata,
    }));

    // Generate summary using LLM
    const summary = await this.generateSearchSummary(query, results);

    // Generate suggested queries
    const suggestedQueries = await this.generateSuggestedQueries(query, results);

    return {
      query,
      results,
      summary,
      suggestedQueries,
      totalResults: results.length,
      searchTime: Date.now() - startTime,
      llmModel: this.config.llmProvider.model,
    };
  }

  /**
   * Fallback keyword-based search (when AI is not available)
   */
  private async performKeywordSearch(query: string, options?: {
    sources?: ('documentation' | 'code' | 'config' | 'runbook' | 'api')[];
    maxResults?: number;
  }): Promise<AISearchResponse> {
    const startTime = Date.now();
    const maxResults = options?.maxResults || this.config.maxResults || 10;
    const queryTerms = query.toLowerCase().split(/\s+/);

    // Score documents by keyword matching
    const scoredResults = Array.from(this.documentIndex.values())
      .filter(doc => !options?.sources || options.sources.includes(doc.source))
      .map(doc => {
        const content = (doc.title + ' ' + doc.content).toLowerCase();
        const matchedTerms = queryTerms.filter(term => content.includes(term));
        const score = matchedTerms.length / queryTerms.length;
        return { doc, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);

    const results: AISearchResult[] = scoredResults.map(({ doc, score }) => ({
      id: doc.id,
      title: doc.title,
      content: doc.content.substring(0, 500) + (doc.content.length > 500 ? '...' : ''),
      source: doc.source,
      path: doc.path,
      relevanceScore: score,
      highlights: this.extractHighlights(doc.content, query),
      metadata: doc.metadata,
    }));

    return {
      query,
      results,
      summary: results.length > 0
        ? `Found ${results.length} results matching "${query}".`
        : `No results found for "${query}". Try different keywords.`,
      suggestedQueries: this.generateBasicSuggestions(query),
      totalResults: results.length,
      searchTime: Date.now() - startTime,
    };
  }

  /**
   * Index a document for search
   */
  async indexDocument(document: Omit<IndexedDocument, 'id' | 'lastIndexed' | 'embedding'>): Promise<void> {
    const id = this.generateDocumentId(document.path);

    // Generate embedding if AI is enabled
    let embedding: number[] | undefined;
    if (this.isEnabled()) {
      try {
        embedding = await this.generateEmbedding(document.title + ' ' + document.content);
      } catch (error) {
        this.logger.warn(`Failed to generate embedding for ${document.path}:`, error);
      }
    }

    this.documentIndex.set(id, {
      ...document,
      id,
      embedding,
      lastIndexed: new Date().toISOString(),
    });

    this.isIndexed = true;
  }

  /**
   * Index multiple documents in batch
   */
  async indexDocuments(documents: Omit<IndexedDocument, 'id' | 'lastIndexed' | 'embedding'>[]): Promise<{
    indexed: number;
    failed: number;
    errors: string[];
  }> {
    let indexed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const doc of documents) {
      try {
        await this.indexDocument(doc);
        indexed++;
      } catch (error: any) {
        failed++;
        errors.push(`${doc.path}: ${error.message}`);
      }
    }

    this.logger.info(`Indexed ${indexed} documents, ${failed} failed`);
    return { indexed, failed, errors };
  }

  /**
   * Remove a document from the index
   */
  removeDocument(path: string): boolean {
    const id = this.generateDocumentId(path);
    return this.documentIndex.delete(id);
  }

  /**
   * Clear all indexed documents
   */
  clearIndex(): void {
    this.documentIndex.clear();
    this.isIndexed = false;
    this.logger.info('Document index cleared');
  }

  /**
   * Get indexed document count by source
   */
  getIndexStats(): Record<string, number> {
    const stats: Record<string, number> = {
      total: 0,
      documentation: 0,
      code: 0,
      config: 0,
      runbook: 0,
      api: 0,
    };

    this.documentIndex.forEach(doc => {
      stats.total++;
      stats[doc.source]++;
    });

    return stats;
  }

  /**
   * Generate embedding for text using configured LLM provider
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    const { provider, apiKey, baseUrl, embeddingModel } = this.config.llmProvider;

    if (!apiKey) {
      throw new Error('API key not configured for LLM provider');
    }

    switch (provider) {
      case 'openai':
      case 'azure-openai':
        return this.generateOpenAIEmbedding(text, apiKey, baseUrl, embeddingModel);

      case 'ollama':
        return this.generateOllamaEmbedding(text, baseUrl || 'http://localhost:11434', embeddingModel);

      default:
        // Return a simple hash-based embedding as fallback
        return this.generateSimpleEmbedding(text);
    }
  }

  /**
   * Generate embedding using OpenAI API
   */
  private async generateOpenAIEmbedding(text: string, apiKey: string, baseUrl?: string, model?: string): Promise<number[]> {
    const url = baseUrl || 'https://api.openai.com/v1';

    const response = await fetch(`${url}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'text-embedding-3-small',
        input: text.substring(0, 8000), // Limit input length
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as any;
    return data.data[0].embedding;
  }

  /**
   * Generate embedding using Ollama (local LLM)
   */
  private async generateOllamaEmbedding(text: string, baseUrl: string, model?: string): Promise<number[]> {
    const response = await fetch(`${baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'nomic-embed-text',
        prompt: text.substring(0, 8000),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as any;
    return data.embedding;
  }

  /**
   * Simple hash-based embedding (fallback when no LLM available)
   */
  private generateSimpleEmbedding(text: string): number[] {
    const embedding = new Array(256).fill(0);
    const words = text.toLowerCase().split(/\s+/);

    words.forEach((word, i) => {
      const hash = this.hashString(word);
      embedding[hash % 256] += 1 / words.length;
    });

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / (magnitude || 1));
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Generate search summary using LLM
   */
  private async generateSearchSummary(query: string, results: AISearchResult[]): Promise<string> {
    if (results.length === 0) {
      return `No results found for "${query}". Try rephrasing your query or using different keywords.`;
    }

    if (!this.isEnabled()) {
      return `Found ${results.length} results matching "${query}".`;
    }

    try {
      const { apiKey, baseUrl, model } = this.config.llmProvider;
      const url = baseUrl || 'https://api.openai.com/v1';

      const context = results.slice(0, 3).map(r => r.content).join('\n\n');

      const response = await fetch(`${url}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that summarizes search results. Provide a brief 2-3 sentence summary of what the user can find in these results.',
            },
            {
              role: 'user',
              content: `Query: "${query}"\n\nTop results:\n${context}`,
            },
          ],
          max_tokens: 150,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        throw new Error('LLM API error');
      }

      const data = await response.json() as any;
      return data.choices[0].message.content;
    } catch (error) {
      this.logger.warn('Failed to generate search summary:', error);
      return `Found ${results.length} results matching "${query}".`;
    }
  }

  /**
   * Generate suggested queries using LLM
   */
  private async generateSuggestedQueries(query: string, results: AISearchResult[]): Promise<string[]> {
    if (!this.isEnabled()) {
      return this.generateBasicSuggestions(query);
    }

    try {
      const { apiKey, baseUrl, model } = this.config.llmProvider;
      const url = baseUrl || 'https://api.openai.com/v1';

      const response = await fetch(`${url}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Generate 3 related search queries based on the user query. Return only the queries, one per line.',
            },
            {
              role: 'user',
              content: query,
            },
          ],
          max_tokens: 100,
          temperature: 0.5,
        }),
      });

      if (!response.ok) {
        throw new Error('LLM API error');
      }

      const data = await response.json() as any;
      const suggestions = data.choices[0].message.content
        .split('\n')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0)
        .slice(0, 3);

      return suggestions;
    } catch (error) {
      this.logger.warn('Failed to generate query suggestions:', error);
      return this.generateBasicSuggestions(query);
    }
  }

  /**
   * Generate basic query suggestions without LLM
   */
  private generateBasicSuggestions(query: string): string[] {
    const words = query.split(/\s+/);
    const suggestions: string[] = [];

    // Add "how to" variant
    if (!query.toLowerCase().startsWith('how')) {
      suggestions.push(`How to ${query.toLowerCase()}`);
    }

    // Add "example" variant
    suggestions.push(`${query} example`);

    // Add longer query
    if (words.length < 3) {
      suggestions.push(`${query} guide tutorial`);
    }

    return suggestions.slice(0, 3);
  }

  /**
   * Extract highlights from content
   */
  private extractHighlights(content: string, query: string): string[] {
    const highlights: string[] = [];
    const queryTerms = query.toLowerCase().split(/\s+/);
    const sentences = content.split(/[.!?]+/);

    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      if (queryTerms.some(term => lowerSentence.includes(term))) {
        const trimmed = sentence.trim();
        if (trimmed.length > 20 && trimmed.length < 200) {
          highlights.push(trimmed);
          if (highlights.length >= 3) break;
        }
      }
    }

    return highlights;
  }

  /**
   * Generate document ID from path
   */
  private generateDocumentId(path: string): string {
    return `doc_${this.hashString(path).toString(16)}`;
  }

  /**
   * Simple string hash function
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Answer a question using RAG (Retrieval Augmented Generation)
   */
  async answerQuestion(question: string): Promise<{
    answer: string;
    sources: AISearchResult[];
    confidence: number;
  }> {
    // First, search for relevant documents
    const searchResponse = await this.search(question, { maxResults: 5 });

    if (!this.isEnabled() || searchResponse.results.length === 0) {
      return {
        answer: 'I could not find enough information to answer this question. Please try rephrasing or check the documentation manually.',
        sources: searchResponse.results,
        confidence: 0,
      };
    }

    try {
      const { apiKey, baseUrl, model } = this.config.llmProvider;
      const url = baseUrl || 'https://api.openai.com/v1';

      // Prepare context from search results
      const context = searchResponse.results
        .map(r => `[${r.source}] ${r.title}:\n${r.content}`)
        .join('\n\n---\n\n');

      const response = await fetch(`${url}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a helpful DevOps assistant. Answer the user's question based ONLY on the provided context. If the context doesn't contain enough information, say so. Be concise and practical.`,
            },
            {
              role: 'user',
              content: `Context:\n${context}\n\n---\n\nQuestion: ${question}`,
            },
          ],
          max_tokens: 500,
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        throw new Error('LLM API error');
      }

      const data = await response.json() as any;
      const answer = data.choices[0].message.content;

      // Calculate confidence based on search relevance
      const avgRelevance = searchResponse.results.reduce((sum, r) => sum + r.relevanceScore, 0) / searchResponse.results.length;

      return {
        answer,
        sources: searchResponse.results,
        confidence: avgRelevance,
      };
    } catch (error) {
      this.logger.error('Failed to generate answer:', error);
      return {
        answer: 'An error occurred while generating the answer. Please try again.',
        sources: searchResponse.results,
        confidence: 0,
      };
    }
  }
}
