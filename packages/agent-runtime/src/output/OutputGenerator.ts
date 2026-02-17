import type { Agent, Session, Message, GeneratedArtifact, ArtifactType } from '@straits/core';
import { generateId } from '@straits/core';
import { AGENT_PROMPTS } from '../prompts/templates';

export interface OutputGeneratorConfig {
  // Future: template customization options
}

export interface GenerateArtifactInput {
  agent: Agent;
  session: Session;
  conversationHistory: Message[];
}

/**
 * OutputGenerator creates structured artifacts from conversations.
 */
export class OutputGenerator {
  constructor(private config: OutputGeneratorConfig = {}) {}

  /**
   * Generate an artifact from the conversation.
   */
  async generateArtifact(input: GenerateArtifactInput): Promise<GeneratedArtifact> {
    const { agent, session, conversationHistory } = input;

    // Determine artifact type from agent type
    const artifactType = this.getArtifactType(agent.type);

    // Extract data from conversation
    const extractedData = this.extractDataFromConversation(
      conversationHistory,
      agent.type
    );

    // Get template and fill it
    const template = AGENT_PROMPTS[agent.type]?.artifactTemplate || '';
    const content = this.fillTemplate(template, extractedData);

    return {
      id: generateId(),
      type: artifactType,
      title: this.generateTitle(agent, extractedData),
      content,
      format: 'markdown',
      data: extractedData,
      createdAt: new Date(),
    };
  }

  /**
   * Map agent type to artifact type.
   */
  private getArtifactType(agentType: string): ArtifactType {
    const mapping: Record<string, ArtifactType> = {
      'prd-generator': 'prd',
      'sales-proposal': 'proposal',
      postmortem: 'postmortem',
      roadmap: 'roadmap',
      'sop-generator': 'sop',
      'opinion-research': 'stance-map',
      'qr-menu': 'order',
      retail: 'order',
      support: 'ticket',
    };
    return mapping[agentType] || 'prd';
  }

  /**
   * Extract structured data from conversation messages.
   */
  private extractDataFromConversation(
    messages: Message[],
    agentType: string
  ): Record<string, unknown> {
    const data: Record<string, unknown> = {
      date: new Date().toISOString().split('T')[0],
      version: '1.0',
    };

    // Extract based on agent type
    const questions = AGENT_PROMPTS[agentType as keyof typeof AGENT_PROMPTS]?.interviewQuestions || [];

    // Simple extraction: look for user answers following assistant questions
    let currentQuestion = '';

    for (const message of messages) {
      if (message.role === 'assistant') {
        // Check if this message contains a question
        for (const q of questions) {
          if (message.content.toLowerCase().includes(q.toLowerCase().slice(0, 20))) {
            currentQuestion = q;
            break;
          }
        }
      } else if (message.role === 'user' && currentQuestion) {
        // Map the answer to a field
        const fieldName = this.questionToFieldName(currentQuestion);
        data[fieldName] = message.content;
        currentQuestion = '';
      }
    }

    return data;
  }

  /**
   * Convert a question to a field name.
   */
  private questionToFieldName(question: string): string {
    // Simple heuristic mapping
    const mappings: Record<string, string> = {
      'problem': 'problemStatement',
      'target users': 'targetUsers',
      'features': 'features',
      'success': 'goals',
      'constraints': 'constraints',
      'timeline': 'timeline',
      'client': 'clientNeeds',
      'solution': 'solution',
      'budget': 'pricing',
      'impact': 'impact',
      'root cause': 'rootCause',
      'went well': 'wentWell',
      'improved': 'improvements',
      'action': 'actionItems',
      'goals': 'goals',
      'stakeholders': 'stakeholders',
      'priorities': 'priorities',
      'process': 'procedureName',
      'steps': 'steps',
      'topic': 'topic',
      'positions': 'positions',
    };

    const lowerQ = question.toLowerCase();
    for (const [key, field] of Object.entries(mappings)) {
      if (lowerQ.includes(key)) {
        return field;
      }
    }

    // Default: camelCase the first few words
    return question
      .toLowerCase()
      .split(' ')
      .slice(0, 3)
      .map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
      .join('');
  }

  /**
   * Fill a template with data.
   */
  private fillTemplate(template: string, data: Record<string, unknown>): string {
    let result = template;

    for (const [key, value] of Object.entries(data)) {
      const placeholder = `{{${key}}}`;
      const stringValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
      result = result.replace(new RegExp(placeholder, 'g'), stringValue);
    }

    // Remove unfilled placeholders
    result = result.replace(/\{\{[^}]+\}\}/g, '_To be filled_');

    return result;
  }

  /**
   * Generate a title for the artifact.
   */
  private generateTitle(agent: Agent, data: Record<string, unknown>): string {
    const typeNames: Record<string, string> = {
      'prd-generator': 'Product Requirements Document',
      'sales-proposal': 'Sales Proposal',
      postmortem: 'Incident Postmortem',
      roadmap: 'Product Roadmap',
      'sop-generator': 'Standard Operating Procedure',
      'opinion-research': 'Opinion Research Summary',
    };

    const typeName = typeNames[agent.type] || 'Document';
    const productName = data.productName || data.procedureName || data.topic || '';

    return productName ? `${typeName}: ${productName}` : typeName;
  }

  /**
   * Export artifact to different formats.
   */
  async exportArtifact(
    artifact: GeneratedArtifact,
    format: 'markdown' | 'json' | 'html'
  ): Promise<string> {
    switch (format) {
      case 'markdown':
        return artifact.content;

      case 'json':
        return JSON.stringify(
          {
            title: artifact.title,
            type: artifact.type,
            content: artifact.content,
            data: artifact.data,
            createdAt: artifact.createdAt,
          },
          null,
          2
        );

      case 'html':
        return this.markdownToHtml(artifact.content);

      default:
        return artifact.content;
    }
  }

  /**
   * Simple markdown to HTML conversion.
   */
  private markdownToHtml(markdown: string): string {
    let html = markdown
      // Headers
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Lists
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      // Line breaks
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1, h2, h3 { color: #1a1a1a; }
    li { margin: 8px 0; }
  </style>
</head>
<body>
  <p>${html}</p>
</body>
</html>`;
  }
}
