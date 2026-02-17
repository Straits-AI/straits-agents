/**
 * Agent Skills Library
 * Handles SKILL.md parsing, storage, and system prompt injection.
 * Implements the Anthropic Agent Skills standard for portable expertise.
 */

import { getDB } from "./db";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AgentSkill {
  id: string;
  agentId: string;
  name: string;
  displayName: string;
  description: string;
  version: string;
  instructions: string;
  author: string | null;
  tags: string[];
  allowedTools: string[];
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface SkillRow {
  id: string;
  agent_id: string;
  name: string;
  display_name: string;
  description: string;
  version: string;
  instructions: string;
  author: string | null;
  tags: string | null;
  allowed_tools: string | null;
  is_active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SkillMdParsed {
  name: string;
  displayName: string;
  description: string;
  version: string;
  author: string | null;
  tags: string[];
  allowedTools: string[];
  instructions: string;
}

// ─── Row Mapper ──────────────────────────────────────────────────────────────

function rowToSkill(row: SkillRow): AgentSkill {
  return {
    id: row.id,
    agentId: row.agent_id,
    name: row.name,
    displayName: row.display_name,
    description: row.description,
    version: row.version,
    instructions: row.instructions,
    author: row.author,
    tags: row.tags ? JSON.parse(row.tags) : [],
    allowedTools: row.allowed_tools ? JSON.parse(row.allowed_tools) : [],
    isActive: row.is_active === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Skill Queries ──────────────────────────────────────────────────────────

/**
 * Get skill summaries for Agent Cards (metadata only, no instructions).
 */
export async function getAgentSkillsSummary(
  agentId: string
): Promise<Array<{ id: string; name: string; displayName: string; description: string; tags: string[] }>> {
  const db = await getDB();
  const result = await db
    .prepare(
      `SELECT id, name, display_name, description, tags
       FROM agent_skills WHERE agent_id = ? AND is_active = 1
       ORDER BY sort_order ASC`
    )
    .bind(agentId)
    .all<{ id: string; name: string; display_name: string; description: string; tags: string | null }>();

  return result.results.map((row) => ({
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    description: row.description,
    tags: row.tags ? JSON.parse(row.tags) : [],
  }));
}

/**
 * Get full skill data for system prompt injection.
 */
export async function getActiveSkillInstructions(agentId: string): Promise<AgentSkill[]> {
  const db = await getDB();
  const result = await db
    .prepare(
      `SELECT * FROM agent_skills WHERE agent_id = ? AND is_active = 1 ORDER BY sort_order ASC`
    )
    .bind(agentId)
    .all<SkillRow>();

  return result.results.map(rowToSkill);
}

/**
 * Get a single skill by ID.
 */
export async function getSkill(skillId: string): Promise<AgentSkill | null> {
  const db = await getDB();
  const row = await db
    .prepare("SELECT * FROM agent_skills WHERE id = ? AND is_active = 1")
    .bind(skillId)
    .first<SkillRow>();
  return row ? rowToSkill(row) : null;
}

// ─── System Prompt Formatting ────────────────────────────────────────────────

/**
 * Format skills as a system prompt section.
 */
export function formatSkillsForPrompt(skills: AgentSkill[]): string {
  if (skills.length === 0) return "";

  const sections = skills.map((skill) => {
    let section = `### ${skill.displayName}`;
    if (skill.description) section += `\n${skill.description}`;
    section += `\n\n${skill.instructions}`;
    return section;
  });

  return `## Skills & Expertise\n\n${sections.join("\n\n---\n\n")}`;
}

// ─── SKILL.md Parsing ────────────────────────────────────────────────────────

/**
 * Parse a SKILL.md file into structured data.
 * Format: YAML frontmatter (---) + markdown body.
 */
export function parseSkillMd(content: string): SkillMdParsed {
  const trimmed = content.trim();
  let frontmatter: Record<string, unknown> = {};
  let body = trimmed;

  // Check for YAML frontmatter
  if (trimmed.startsWith("---")) {
    const endIndex = trimmed.indexOf("---", 3);
    if (endIndex !== -1) {
      const yamlStr = trimmed.slice(3, endIndex).trim();
      body = trimmed.slice(endIndex + 3).trim();

      // Simple YAML parser (key: value lines)
      for (const line of yamlStr.split("\n")) {
        const colonIdx = line.indexOf(":");
        if (colonIdx === -1) continue;
        const key = line.slice(0, colonIdx).trim();
        let value: unknown = line.slice(colonIdx + 1).trim();

        // Handle arrays (simple inline YAML: [a, b, c])
        if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
          value = value
            .slice(1, -1)
            .split(",")
            .map((v) => v.trim().replace(/^["']|["']$/g, ""))
            .filter(Boolean);
        }

        frontmatter[key] = value;
      }
    }
  }

  return {
    name: String(frontmatter.name || "unnamed-skill"),
    displayName: String(frontmatter.display_name || frontmatter.displayName || frontmatter.name || "Unnamed Skill"),
    description: String(frontmatter.description || ""),
    version: String(frontmatter.version || "1.0.0"),
    author: frontmatter.author ? String(frontmatter.author) : null,
    tags: Array.isArray(frontmatter.tags) ? frontmatter.tags.map(String) : [],
    allowedTools: (() => {
      const tools = frontmatter.allowed_tools || frontmatter.allowedTools;
      return Array.isArray(tools) ? tools.map(String) : [];
    })(),
    instructions: body,
  };
}

/**
 * Generate SKILL.md content from a skill.
 */
export function generateSkillMd(skill: AgentSkill): string {
  const lines: string[] = ["---"];
  lines.push(`name: ${skill.name}`);
  lines.push(`display_name: ${skill.displayName}`);
  lines.push(`description: ${skill.description}`);
  lines.push(`version: ${skill.version}`);
  if (skill.author) lines.push(`author: ${skill.author}`);
  if (skill.tags.length > 0) lines.push(`tags: [${skill.tags.join(", ")}]`);
  if (skill.allowedTools.length > 0) lines.push(`allowed_tools: [${skill.allowedTools.join(", ")}]`);
  lines.push("---");
  lines.push("");
  lines.push(skill.instructions);

  return lines.join("\n");
}

// ─── Default Skills for Templates ────────────────────────────────────────────

export interface DefaultSkill {
  name: string;
  displayName: string;
  description: string;
  tags: string[];
  instructions: string;
}

export const TEMPLATE_DEFAULT_SKILLS: Record<string, DefaultSkill[]> = {
  restaurant: [
    {
      name: "menu-browsing",
      displayName: "Menu Browsing",
      description: "Help customers explore and understand the menu",
      tags: ["food", "menu"],
      instructions: `When helping customers browse the menu:
1. Ask about dietary restrictions or preferences first
2. Categorize suggestions by course (appetizers, mains, desserts)
3. Always mention prices when discussing specific dishes
4. Highlight popular or chef's special items
5. Proactively mention allergen information for each dish discussed`,
    },
    {
      name: "dietary-filter",
      displayName: "Dietary Filtering",
      description: "Filter menu items by dietary requirements",
      tags: ["food", "dietary", "allergies"],
      instructions: `When filtering for dietary needs:
- Vegetarian: exclude all meat and seafood items
- Vegan: exclude all animal products (dairy, eggs, honey)
- Gluten-free: identify items without wheat, barley, rye
- Nut-free: flag items with tree nuts or peanuts
- Always cross-reference with the knowledge base for accurate allergen info
- If unsure about an ingredient, say so and recommend asking the kitchen`,
    },
  ],
  retail: [
    {
      name: "product-comparison",
      displayName: "Product Comparison",
      description: "Compare products side by side with pros and cons",
      tags: ["retail", "shopping"],
      instructions: `When comparing products:
1. Present key specs in a structured format
2. Highlight price-to-value ratio
3. Mention use case differences
4. Include warranty and return policy info if available
5. Give a clear recommendation with reasoning`,
    },
  ],
  support: [
    {
      name: "troubleshooting",
      displayName: "Troubleshooting Guide",
      description: "Step-by-step issue resolution",
      tags: ["support", "troubleshooting"],
      instructions: `When troubleshooting issues:
1. Start by identifying the exact symptom
2. Ask clarifying diagnostic questions
3. Begin with the simplest possible fix
4. Provide numbered steps for each solution
5. Verify the fix worked before moving to the next
6. If 3 solutions fail, recommend human support escalation`,
    },
  ],
  // ─── Productivity Template Skills ──────────────────────────────────────────
  "prd-generator": [
    {
      name: "prd-writing",
      displayName: "PRD Writing",
      description: "Generate structured product requirements documents",
      tags: ["product", "prd", "requirements"],
      instructions: `When generating a PRD:
1. Start by asking: target user, problem statement, and business goal
2. Use consistent structure: Overview → Problem → Goals → User Stories → Requirements → Out of Scope → Risks
3. Write 3-8 user stories per feature area
4. Each user story needs acceptance criteria in "Given/When/Then" format
5. Prioritize with P0 (must-have), P1 (should-have), P2 (nice-to-have)
6. List 3-5 explicit non-goals under "Out of Scope"
7. Include success metrics with measurable targets
8. Flag open questions and assumptions that need validation`,
    },
    {
      name: "scope-breakdown",
      displayName: "Scope Breakdown",
      description: "Break features into phases and milestones",
      tags: ["product", "planning", "roadmap"],
      instructions: `When breaking down scope:
1. Identify the MVP (minimum viable product) — P0 items only
2. Group related user stories into phases (Phase 1, 2, 3)
3. Estimate relative complexity for each item (S/M/L/XL)
4. Identify dependencies between phases and items
5. Suggest a phased rollout plan with milestones
6. Flag technical risks that could affect timeline
7. Note which items can be parallelized vs. sequential`,
    },
  ],
  research: [
    {
      name: "research-synthesis",
      displayName: "Research Synthesis",
      description: "Synthesize information from multiple sources into coherent reports",
      tags: ["research", "analysis", "report"],
      instructions: `When synthesizing research:
1. Start with an executive summary (3-5 key points)
2. Organize findings by theme, not by source
3. Cite specific sources for each major claim
4. Note where sources agree and disagree
5. Quantify findings with data when available
6. Identify gaps in the available information
7. Distinguish between facts, analysis, and opinions
8. End with actionable recommendations and next steps`,
    },
    {
      name: "comparative-analysis",
      displayName: "Comparative Analysis",
      description: "Compare options, competitors, or viewpoints side by side",
      tags: ["research", "comparison", "analysis"],
      instructions: `When running comparisons:
1. Define clear evaluation criteria upfront
2. Use a structured table or matrix format
3. Rate each option against each criterion (e.g., 1-5 scale)
4. Highlight strengths and weaknesses fairly for each option
5. Note any context-dependent factors that affect rankings
6. Provide an overall recommendation with clear reasoning
7. Include a "Bottom Line" summary for quick decision-making`,
    },
  ],
  "sop-generator": [
    {
      name: "sop-writing",
      displayName: "SOP Writing",
      description: "Generate structured standard operating procedures",
      tags: ["sop", "documentation", "process"],
      instructions: `When writing an SOP:
1. Start with metadata: Title, Version, Owner, Last Updated, Purpose
2. Add a Quick Reference summary (5-7 bullet points for experienced users)
3. List prerequisites: tools, access, permissions needed
4. Write numbered steps with sub-steps where needed
5. Include decision points with clear if/then branching
6. Add quality check steps (checkpoints) after critical actions
7. Mark steps that require sign-off or approval
8. End with escalation contacts and common troubleshooting tips`,
    },
    {
      name: "checklist-creation",
      displayName: "Checklist Creation",
      description: "Create actionable checklists for processes",
      tags: ["checklist", "process", "quality"],
      instructions: `When creating checklists:
1. Group items by phase or category with clear headers
2. Each item should be a single, verifiable action
3. Order items in logical execution sequence
4. Mark critical items (must not be skipped) with a warning
5. Include estimated time per section
6. Add a sign-off field for accountability
7. Provide a "done" criteria for each item (how to verify completion)`,
    },
  ],
  "business-analyst": [
    {
      name: "swot-analysis",
      displayName: "SWOT Analysis",
      description: "Conduct structured SWOT analysis with prioritized findings",
      tags: ["business", "strategy", "analysis"],
      instructions: `When conducting a SWOT analysis:
1. Ask about the business/product, industry, and competitive context
2. Identify 4-6 items per quadrant (Strengths, Weaknesses, Opportunities, Threats)
3. Prioritize items by impact (High/Medium/Low)
4. Cross-reference: how can strengths exploit opportunities? How do weaknesses amplify threats?
5. End with 3-5 strategic recommendations that address the most critical findings
6. Present in a clear 2x2 matrix format`,
    },
    {
      name: "market-sizing",
      displayName: "Market Sizing",
      description: "Estimate market size using TAM/SAM/SOM framework",
      tags: ["business", "market", "strategy"],
      instructions: `When estimating market size:
1. Define the market clearly — geography, segment, time horizon
2. Calculate TAM (Total Addressable Market) using top-down or bottom-up approach
3. Narrow to SAM (Serviceable Addressable Market) based on actual reach
4. Estimate SOM (Serviceable Obtainable Market) based on realistic capture rate
5. Provide three scenarios: conservative, moderate, aggressive
6. State all assumptions explicitly
7. Include relevant industry growth rates (CAGR)`,
    },
  ],
  "requirements-gathering": [
    {
      name: "stakeholder-interview",
      displayName: "Stakeholder Interview",
      description: "Structured interview to elicit requirements from stakeholders",
      tags: ["requirements", "interview", "elicitation"],
      instructions: `When interviewing stakeholders:
1. Start with context: role, responsibilities, pain points
2. Ask open-ended questions first, then drill into specifics
3. Use "5 Whys" to uncover root needs behind stated solutions
4. Capture exact quotes for critical requirements
5. Identify implicit assumptions the stakeholder hasn't stated
6. Summarize back what you heard and ask for corrections
7. End with: "What haven't I asked about that I should have?"`,
    },
    {
      name: "requirements-documentation",
      displayName: "Requirements Documentation",
      description: "Produce structured requirements documents with IDs and traceability",
      tags: ["requirements", "documentation", "specs"],
      instructions: `When documenting requirements:
1. Assign unique IDs: FR-XXX (functional), NFR-XXX (non-functional)
2. Use precise language: "The system shall..." or "The user shall be able to..."
3. Each requirement must be testable — include acceptance criteria
4. Apply MoSCoW: Must / Should / Could / Won't
5. Group by functional area (e.g., Authentication, Payments, Notifications)
6. Cross-reference dependencies between requirements
7. Flag conflicts, ambiguities, or gaps with [OPEN] tags
8. Include a traceability matrix linking requirements to stakeholder goals`,
    },
  ],
};
