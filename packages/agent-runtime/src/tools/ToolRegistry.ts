import type { Agent, AgentType, Session } from '@straits/core';

export interface ToolDefinition {
  name: string;
  description: string;
  triggers: string[];
  parameters: Record<string, ToolParameter>;
  handler: ToolHandler;
}

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  default?: unknown;
}

export type ToolHandler = (context: ToolContext) => Promise<unknown>;

export interface ToolContext {
  session: Session;
  agent: Agent;
  userMessage: string;
  parameters?: Record<string, unknown>;
}

/**
 * ToolRegistry manages available tools for agents.
 */
export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private agentTools: Map<AgentType, string[]> = new Map();

  constructor() {
    this.registerDefaultTools();
  }

  /**
   * Register a tool.
   */
  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Associate tools with an agent type.
   */
  setAgentTools(agentType: AgentType, toolNames: string[]): void {
    this.agentTools.set(agentType, toolNames);
  }

  /**
   * Get tools available for an agent type.
   */
  getToolsForAgent(agentType: AgentType): Array<{ name: string; triggers: string[] }> {
    const toolNames = this.agentTools.get(agentType) || [];
    return toolNames
      .map((name) => this.tools.get(name))
      .filter((tool): tool is ToolDefinition => tool !== undefined)
      .map((tool) => ({ name: tool.name, triggers: tool.triggers }));
  }

  /**
   * Execute a tool.
   */
  async executeTool(toolName: string, context: ToolContext): Promise<unknown> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    return await tool.handler(context);
  }

  /**
   * Get tool definition.
   */
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Register default tools.
   */
  private registerDefaultTools(): void {
    // Add to Cart Tool (Retail)
    this.registerTool({
      name: 'addToCart',
      description: 'Add an item to the shopping cart',
      triggers: ['add to cart', 'buy', 'purchase', 'get this'],
      parameters: {
        productId: { type: 'string', description: 'Product ID', required: true },
        quantity: { type: 'number', description: 'Quantity', default: 1 },
      },
      handler: async (context) => {
        // Placeholder - actual implementation in worker
        return { success: true, message: 'Item added to cart' };
      },
    });

    // Search Products Tool (Retail)
    this.registerTool({
      name: 'searchProducts',
      description: 'Search for products in the catalog',
      triggers: ['search', 'find', 'looking for', 'show me'],
      parameters: {
        query: { type: 'string', description: 'Search query', required: true },
        filters: { type: 'object', description: 'Optional filters' },
      },
      handler: async (context) => {
        return { results: [], message: 'Search results' };
      },
    });

    // Place Order Tool (QR Menu)
    this.registerTool({
      name: 'placeOrder',
      description: 'Place a food order',
      triggers: ['order', "i'll have", 'i want', 'place order'],
      parameters: {
        items: { type: 'array', description: 'List of menu items', required: true },
        notes: { type: 'string', description: 'Special instructions' },
      },
      handler: async (context) => {
        return { success: true, orderId: 'ORD-123', message: 'Order placed' };
      },
    });

    // Search Menu Tool (QR Menu)
    this.registerTool({
      name: 'searchMenu',
      description: 'Search the restaurant menu',
      triggers: ['menu', 'what do you have', 'dishes', 'options'],
      parameters: {
        query: { type: 'string', description: 'Search query' },
        dietary: { type: 'string', description: 'Dietary restriction' },
      },
      handler: async (context) => {
        return { results: [], message: 'Menu items' };
      },
    });

    // Search Docs Tool (Support)
    this.registerTool({
      name: 'searchDocs',
      description: 'Search product documentation',
      triggers: ['how to', 'documentation', 'guide', 'help with'],
      parameters: {
        query: { type: 'string', description: 'Search query', required: true },
      },
      handler: async (context) => {
        return { results: [], message: 'Documentation results' };
      },
    });

    // Escalate to Human Tool (Support)
    this.registerTool({
      name: 'escalateToHuman',
      description: 'Escalate to human support',
      triggers: ['speak to human', 'real person', 'escalate', 'support agent'],
      parameters: {
        reason: { type: 'string', description: 'Reason for escalation' },
        priority: { type: 'string', description: 'Priority level' },
      },
      handler: async (context) => {
        return { ticketId: 'TKT-123', message: 'Escalated to human support' };
      },
    });

    // Generate Artifact Tool (Productivity)
    this.registerTool({
      name: 'generateArtifact',
      description: 'Generate the final document artifact',
      triggers: ['generate', 'create document', 'finalize', 'ready to generate'],
      parameters: {
        confirm: { type: 'boolean', description: 'Confirmation', required: true },
      },
      handler: async (context) => {
        return { generating: true, message: 'Generating artifact...' };
      },
    });

    // Set agent-tool associations
    this.setAgentTools('qr-menu', ['searchMenu', 'placeOrder']);
    this.setAgentTools('retail', ['searchProducts', 'addToCart']);
    this.setAgentTools('support', ['searchDocs', 'escalateToHuman']);
    this.setAgentTools('prd-generator', ['generateArtifact']);
    this.setAgentTools('sales-proposal', ['generateArtifact']);
    this.setAgentTools('postmortem', ['generateArtifact']);
    this.setAgentTools('roadmap', ['generateArtifact']);
    this.setAgentTools('sop-generator', ['generateArtifact']);
    this.setAgentTools('opinion-research', ['generateArtifact']);
  }
}
