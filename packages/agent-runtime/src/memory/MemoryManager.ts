import type { Message, SessionMemory } from '@straits/core';
import { truncateText } from '@straits/core';

export interface MemoryManagerConfig {
  maxFacts?: number;
  maxSummaryLength?: number;
}

/**
 * MemoryManager handles session memory operations including
 * fact extraction, preference tracking, and summarization.
 */
export class MemoryManager {
  private maxFacts: number;
  private maxSummaryLength: number;

  constructor(config: MemoryManagerConfig = {}) {
    this.maxFacts = config.maxFacts ?? 20;
    this.maxSummaryLength = config.maxSummaryLength ?? 2000;
  }

  /**
   * Extract facts and preferences from messages and store in memory.
   */
  async extractAndStoreFacts(memory: SessionMemory, messages: Message[]): Promise<SessionMemory> {
    const newFacts: string[] = [];
    const newPreferences: Record<string, unknown> = { ...memory.preferences };

    for (const message of messages) {
      if (message.role === 'user') {
        // Extract preferences from user messages
        const prefs = this.extractPreferences(message.content);
        Object.assign(newPreferences, prefs);

        // Extract facts from user statements
        const facts = this.extractFacts(message.content);
        newFacts.push(...facts);
      }
    }

    // Deduplicate and limit facts
    const allFacts = [...memory.facts, ...newFacts];
    const uniqueFacts = [...new Set(allFacts)].slice(-this.maxFacts);

    return {
      ...memory,
      facts: uniqueFacts,
      preferences: newPreferences,
    };
  }

  /**
   * Extract preferences from user message.
   */
  private extractPreferences(content: string): Record<string, unknown> {
    const preferences: Record<string, unknown> = {};
    const lowerContent = content.toLowerCase();

    // Dietary preferences
    const dietaryKeywords = [
      'vegetarian',
      'vegan',
      'gluten-free',
      'dairy-free',
      'halal',
      'kosher',
      'allergic to',
      'no nuts',
      'no seafood',
    ];
    for (const keyword of dietaryKeywords) {
      if (lowerContent.includes(keyword)) {
        preferences['dietary'] = keyword;
      }
    }

    // Budget preferences
    if (lowerContent.includes('budget') || lowerContent.includes('cheap')) {
      preferences['budget'] = 'low';
    } else if (lowerContent.includes('premium') || lowerContent.includes('expensive')) {
      preferences['budget'] = 'high';
    }

    // Urgency
    if (lowerContent.includes('urgent') || lowerContent.includes('asap')) {
      preferences['urgency'] = 'high';
    }

    return preferences;
  }

  /**
   * Extract facts from user statements.
   */
  private extractFacts(content: string): string[] {
    const facts: string[] = [];

    // Look for statements that indicate facts
    const factPatterns = [
      /I am (.+?)(?:\.|,|$)/gi,
      /I have (.+?)(?:\.|,|$)/gi,
      /I work (?:at|for|in) (.+?)(?:\.|,|$)/gi,
      /my (\w+) is (.+?)(?:\.|,|$)/gi,
      /I need (.+?)(?:\.|,|$)/gi,
      /I want (.+?)(?:\.|,|$)/gi,
    ];

    for (const pattern of factPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const fact = match[0].trim();
        if (fact.length > 5 && fact.length < 100) {
          facts.push(truncateText(fact, 100));
        }
      }
    }

    return facts;
  }

  /**
   * Summarize older messages when memory gets too long.
   */
  async summarizeMessages(messages: Message[]): Promise<string> {
    // Group messages by topic/intent
    const summaryParts: string[] = [];

    let currentTopic = '';
    let topicMessages: string[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') continue;

      const prefix = msg.role === 'user' ? 'User asked about' : 'Assistant explained';
      const summary = `${prefix}: ${truncateText(msg.content, 50)}`;

      // Simple topic detection based on keywords
      const topic = this.detectTopic(msg.content);
      if (topic !== currentTopic && topicMessages.length > 0) {
        summaryParts.push(`[${currentTopic}] ${topicMessages.join(' → ')}`);
        topicMessages = [];
      }
      currentTopic = topic;
      topicMessages.push(summary);
    }

    if (topicMessages.length > 0) {
      summaryParts.push(`[${currentTopic}] ${topicMessages.join(' → ')}`);
    }

    return truncateText(summaryParts.join('\n'), this.maxSummaryLength);
  }

  /**
   * Detect the topic of a message.
   */
  private detectTopic(content: string): string {
    const lowerContent = content.toLowerCase();

    const topics: Record<string, string[]> = {
      'product inquiry': ['what is', 'tell me about', 'describe', 'features'],
      ordering: ['order', 'buy', 'purchase', 'add to cart', 'checkout'],
      support: ['help', 'problem', 'issue', 'error', 'not working'],
      pricing: ['price', 'cost', 'how much', 'discount'],
      requirements: ['need', 'require', 'must have', 'should'],
    };

    for (const [topic, keywords] of Object.entries(topics)) {
      if (keywords.some((kw) => lowerContent.includes(kw))) {
        return topic;
      }
    }

    return 'general';
  }

  /**
   * Clear old data from memory while preserving key information.
   */
  pruneMemory(memory: SessionMemory): SessionMemory {
    return {
      ...memory,
      facts: memory.facts.slice(-this.maxFacts),
      summary: memory.summary ? truncateText(memory.summary, this.maxSummaryLength) : undefined,
    };
  }
}
