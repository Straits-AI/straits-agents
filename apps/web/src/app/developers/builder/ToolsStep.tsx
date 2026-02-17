"use client";

import { useState } from "react";

interface BuiltinToolConfig {
  ref: string;
  name: string;
  displayName: string;
  description: string;
  enabled: boolean;
}

interface WebhookToolConfig {
  id: string;
  name: string;
  displayName: string;
  description: string;
  webhookUrl: string;
  webhookMethod: string;
  webhookHeaders: Record<string, string>;
  parametersSchema: SchemaField[];
}

interface SchemaField {
  name: string;
  type: "string" | "number" | "boolean";
  description: string;
  required: boolean;
}

export interface SkillConfig {
  id: string;
  name: string;
  displayName: string;
  description: string;
  instructions: string;
  tags: string[];
  isTemplate: boolean;
  enabled: boolean;
}

export interface McpServerConfig {
  id: string;
  name: string;
  displayName: string;
  serverUrl: string;
  transportType: "streamable-http" | "sse";
  authHeaders: Record<string, string>;
  toolFilter: string[];
}

export interface ToolsConfig {
  builtins: BuiltinToolConfig[];
  webhooks: WebhookToolConfig[];
  mcpServers: McpServerConfig[];
  skills: SkillConfig[];
}

export const DEFAULT_BUILTINS: BuiltinToolConfig[] = [
  {
    ref: "search_documents",
    name: "search_documents",
    displayName: "Search Knowledge Base",
    description: "Search the agent's uploaded documents for relevant information.",
    enabled: false,
  },
  {
    ref: "get_user_memory",
    name: "get_user_memory",
    displayName: "User Memory",
    description: "Recall what the agent remembers about the current user.",
    enabled: false,
  },
  {
    ref: "think",
    name: "think",
    displayName: "Think (Reasoning)",
    description: "Think step-by-step about complex questions before answering.",
    enabled: false,
  },
  {
    ref: "discover_agents",
    name: "discover_agents",
    displayName: "Discover Agents",
    description: "Search the marketplace for other agents that can help with a task.",
    enabled: false,
  },
];

function createEmptyWebhook(): WebhookToolConfig {
  return {
    id: crypto.randomUUID(),
    name: "",
    displayName: "",
    description: "",
    webhookUrl: "",
    webhookMethod: "POST",
    webhookHeaders: {},
    parametersSchema: [],
  };
}

function createEmptyMcpServer(): McpServerConfig {
  return {
    id: crypto.randomUUID(),
    name: "",
    displayName: "",
    serverUrl: "",
    transportType: "streamable-http",
    authHeaders: {},
    toolFilter: [],
  };
}

/** Curated MCP servers users can one-click add */
interface SuggestedMcpServer {
  displayName: string;
  name: string;
  serverUrl: string;
  transportType: "streamable-http" | "sse";
  description: string;
  requiresAuth: boolean;
  authHint?: string;
  icon: string;
}

const SUGGESTED_MCP_SERVERS: SuggestedMcpServer[] = [
  {
    displayName: "Cloudflare Docs",
    name: "cloudflare-docs",
    serverUrl: "https://docs.mcp.cloudflare.com/sse",
    transportType: "sse",
    description: "Search and query Cloudflare developer documentation.",
    requiresAuth: false,
    icon: "☁️",
  },
  {
    displayName: "Exa Search",
    name: "exa-search",
    serverUrl: "https://mcp.exa.ai/mcp",
    transportType: "streamable-http",
    description: "Web search and research powered by Exa's neural search engine.",
    requiresAuth: true,
    authHint: "Requires EXA_API_KEY — get one at exa.ai",
    icon: "🔎",
  },
  {
    displayName: "HuggingFace",
    name: "huggingface",
    serverUrl: "https://huggingface.co/mcp",
    transportType: "streamable-http",
    description: "Search models, datasets, and papers on HuggingFace Hub.",
    requiresAuth: false,
    icon: "🤗",
  },
  {
    displayName: "AWS Documentation",
    name: "aws-docs",
    serverUrl: "https://knowledge-mcp.global.api.aws",
    transportType: "streamable-http",
    description: "Search and query AWS documentation and best practices.",
    requiresAuth: false,
    icon: "📦",
  },
];

function createEmptySkill(): SkillConfig {
  return {
    id: crypto.randomUUID(),
    name: "",
    displayName: "",
    description: "",
    instructions: "",
    tags: [],
    isTemplate: false,
    enabled: true,
  };
}

interface ToolsStepProps {
  initialData?: ToolsConfig;
  onChange: (config: ToolsConfig) => void;
  onNext: () => void;
  onBack: () => void;
}

export function ToolsStep({ initialData, onChange, onNext, onBack }: ToolsStepProps) {
  const [builtins, setBuiltins] = useState<BuiltinToolConfig[]>(
    initialData?.builtins && initialData.builtins.length > 0 ? initialData.builtins : DEFAULT_BUILTINS
  );
  const [webhooks, setWebhooks] = useState<WebhookToolConfig[]>(
    initialData?.webhooks || []
  );
  const [mcpServers, setMcpServers] = useState<McpServerConfig[]>(
    initialData?.mcpServers || []
  );
  const [skills, setSkills] = useState<SkillConfig[]>(
    initialData?.skills || []
  );
  const [expandedWebhook, setExpandedWebhook] = useState<string | null>(null);
  const [expandedMcp, setExpandedMcp] = useState<string | null>(null);
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [showRawSchema, setShowRawSchema] = useState<Record<string, boolean>>({});
  const [showImportSkill, setShowImportSkill] = useState(false);
  const [importText, setImportText] = useState("");
  const [showMcpAdvanced, setShowMcpAdvanced] = useState<Record<string, boolean>>({});

  const updateAndNotify = (
    newBuiltins: BuiltinToolConfig[],
    newWebhooks: WebhookToolConfig[],
    newMcpServers?: McpServerConfig[],
    newSkills?: SkillConfig[]
  ) => {
    setBuiltins(newBuiltins);
    setWebhooks(newWebhooks);
    if (newMcpServers !== undefined) setMcpServers(newMcpServers);
    if (newSkills !== undefined) setSkills(newSkills);
    onChange({
      builtins: newBuiltins,
      webhooks: newWebhooks,
      mcpServers: newMcpServers ?? mcpServers,
      skills: newSkills ?? skills,
    });
  };

  const toggleBuiltin = (ref: string) => {
    const updated = builtins.map((b) =>
      b.ref === ref ? { ...b, enabled: !b.enabled } : b
    );
    updateAndNotify(updated, webhooks);
  };

  // ── Webhook helpers ──
  const addWebhook = () => {
    const newWh = createEmptyWebhook();
    const updated = [...webhooks, newWh];
    setExpandedWebhook(newWh.id);
    updateAndNotify(builtins, updated);
  };

  const removeWebhook = (id: string) => {
    const updated = webhooks.filter((w) => w.id !== id);
    updateAndNotify(builtins, updated);
  };

  const updateWebhook = (id: string, fields: Partial<WebhookToolConfig>) => {
    const updated = webhooks.map((w) => (w.id === id ? { ...w, ...fields } : w));
    updateAndNotify(builtins, updated);
  };

  const addSchemaField = (webhookId: string) => {
    const wh = webhooks.find((w) => w.id === webhookId);
    if (!wh) return;
    updateWebhook(webhookId, {
      parametersSchema: [...wh.parametersSchema, { name: "", type: "string", description: "", required: false }],
    });
  };

  const updateSchemaField = (webhookId: string, index: number, field: Partial<SchemaField>) => {
    const wh = webhooks.find((w) => w.id === webhookId);
    if (!wh) return;
    const updated = [...wh.parametersSchema];
    updated[index] = { ...updated[index], ...field };
    updateWebhook(webhookId, { parametersSchema: updated });
  };

  const removeSchemaField = (webhookId: string, index: number) => {
    const wh = webhooks.find((w) => w.id === webhookId);
    if (!wh) return;
    updateWebhook(webhookId, {
      parametersSchema: wh.parametersSchema.filter((_, i) => i !== index),
    });
  };

  // ── MCP Server helpers ──
  const addMcpServer = () => {
    const newServer = createEmptyMcpServer();
    const updated = [...mcpServers, newServer];
    setExpandedMcp(newServer.id);
    updateAndNotify(builtins, webhooks, updated);
  };

  const removeMcpServer = (id: string) => {
    const updated = mcpServers.filter((s) => s.id !== id);
    updateAndNotify(builtins, webhooks, updated);
  };

  const updateMcpServer = (id: string, fields: Partial<McpServerConfig>) => {
    const updated = mcpServers.map((s) => (s.id === id ? { ...s, ...fields } : s));
    updateAndNotify(builtins, webhooks, updated);
  };

  // ── Skill helpers ──
  const toggleSkill = (id: string) => {
    const updated = skills.map((s) =>
      s.id === id ? { ...s, enabled: !s.enabled } : s
    );
    updateAndNotify(builtins, webhooks, undefined, updated);
  };

  const addSkill = () => {
    const newSkill = createEmptySkill();
    const updated = [...skills, newSkill];
    setExpandedSkill(newSkill.id);
    updateAndNotify(builtins, webhooks, undefined, updated);
  };

  const removeSkill = (id: string) => {
    const updated = skills.filter((s) => s.id !== id);
    updateAndNotify(builtins, webhooks, undefined, updated);
  };

  const updateSkill = (id: string, fields: Partial<SkillConfig>) => {
    const updated = skills.map((s) => (s.id === id ? { ...s, ...fields } : s));
    updateAndNotify(builtins, webhooks, undefined, updated);
  };

  const handleImportSkill = () => {
    if (!importText.trim()) return;
    const text = importText.trim();
    let fm: Record<string, string> = {};
    let body = text;

    if (text.startsWith("---")) {
      const endIdx = text.indexOf("---", 3);
      if (endIdx !== -1) {
        const yaml = text.slice(3, endIdx).trim();
        body = text.slice(endIdx + 3).trim();
        for (const line of yaml.split("\n")) {
          const ci = line.indexOf(":");
          if (ci === -1) continue;
          fm[line.slice(0, ci).trim()] = line.slice(ci + 1).trim();
        }
      }
    }

    const name = (fm.name || "imported-skill").toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const tags = fm.tags ? fm.tags.replace(/[\[\]]/g, "").split(",").map((t) => t.trim()).filter(Boolean) : [];

    const newSkill: SkillConfig = {
      id: crypto.randomUUID(),
      name,
      displayName: fm.display_name || fm.displayName || fm.name || "Imported Skill",
      description: fm.description || "",
      instructions: body,
      tags,
      isTemplate: false,
      enabled: true,
    };

    const updated = [...skills, newSkill];
    setImportText("");
    setShowImportSkill(false);
    updateAndNotify(builtins, webhooks, undefined, updated);
  };

  const enabledToolCount = builtins.filter((b) => b.enabled).length + webhooks.length + mcpServers.length;
  const enabledSkillCount = skills.filter((s) => s.enabled).length;
  const totalCount = enabledToolCount + enabledSkillCount;

  const templateSkills = skills.filter((s) => s.isTemplate);
  const customSkills = skills.filter((s) => !s.isTemplate);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Tools & Skills</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Give your agent tools to take actions and skills to define expertise. Both are optional.
      </p>

      {/* ── Built-in Tools ── */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Built-in Tools</h3>
        <div className="space-y-3">
          {builtins.map((b) => (
            <label
              key={b.ref}
              className="flex items-start gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
            >
              <input
                type="checkbox"
                checked={b.enabled}
                onChange={() => toggleBuiltin(b.ref)}
                className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <div className="font-medium text-gray-900 dark:text-white text-sm">{b.displayName}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{b.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* ── Webhook Tools ── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Webhook Tools</h3>
          <button
            onClick={addWebhook}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-medium"
          >
            + Add Webhook Tool
          </button>
        </div>

        {webhooks.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No webhook tools configured. Click &ldquo;Add Webhook Tool&rdquo; to connect external APIs.</p>
        ) : (
          <div className="space-y-3">
            {webhooks.map((wh) => (
              <div
                key={wh.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
              >
                {/* Header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  onClick={() => setExpandedWebhook(expandedWebhook === wh.id ? null : wh.id)}
                >
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white text-sm">
                      {wh.displayName || "Untitled Tool"}
                    </span>
                    {wh.name && (
                      <span className="ml-2 text-xs text-gray-400 font-mono">{wh.name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); removeWebhook(wh.id); }}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${expandedWebhook === wh.id ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Expanded Form */}
                {expandedWebhook === wh.id && (
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Function Name</label>
                        <input
                          type="text"
                          value={wh.name}
                          onChange={(e) => updateWebhook(wh.id, { name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
                          placeholder="check_inventory"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Display Name</label>
                        <input
                          type="text"
                          value={wh.displayName}
                          onChange={(e) => updateWebhook(wh.id, { displayName: e.target.value })}
                          placeholder="Check Inventory"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Description (LLM-facing)</label>
                      <textarea
                        value={wh.description}
                        onChange={(e) => updateWebhook(wh.id, { description: e.target.value })}
                        placeholder="Check inventory for a specific product by name or SKU"
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                      <div className="col-span-3">
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Webhook URL</label>
                        <input
                          type="url"
                          value={wh.webhookUrl}
                          onChange={(e) => updateWebhook(wh.id, { webhookUrl: e.target.value })}
                          placeholder="https://api.example.com/inventory"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Method</label>
                        <select
                          value={wh.webhookMethod}
                          onChange={(e) => updateWebhook(wh.id, { webhookMethod: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                        >
                          <option value="POST">POST</option>
                          <option value="GET">GET</option>
                          <option value="PUT">PUT</option>
                        </select>
                      </div>
                    </div>

                    {/* Parameters Schema */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">Parameters</label>
                        <div className="flex gap-3">
                          <button
                            onClick={() => setShowRawSchema({ ...showRawSchema, [wh.id]: !showRawSchema[wh.id] })}
                            className="text-xs text-gray-400 hover:text-gray-600"
                          >
                            {showRawSchema[wh.id] ? "Visual Editor" : "Raw JSON"}
                          </button>
                          {!showRawSchema[wh.id] && (
                            <button
                              onClick={() => addSchemaField(wh.id)}
                              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
                            >
                              + Add Field
                            </button>
                          )}
                        </div>
                      </div>

                      {showRawSchema[wh.id] ? (
                        <textarea
                          value={JSON.stringify(fieldsToJsonSchema(wh.parametersSchema), null, 2)}
                          onChange={(e) => {
                            try {
                              const parsed = JSON.parse(e.target.value);
                              updateWebhook(wh.id, { parametersSchema: jsonSchemaToFields(parsed) });
                            } catch {
                              // Invalid JSON — don't update
                            }
                          }}
                          rows={6}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs font-mono"
                        />
                      ) : (
                        <div className="space-y-2">
                          {wh.parametersSchema.map((field, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={field.name}
                                onChange={(e) => updateSchemaField(wh.id, i, { name: e.target.value })}
                                placeholder="name"
                                className="w-28 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-xs font-mono"
                              />
                              <select
                                value={field.type}
                                onChange={(e) => updateSchemaField(wh.id, i, { type: e.target.value as SchemaField["type"] })}
                                className="w-24 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-xs"
                              >
                                <option value="string">string</option>
                                <option value="number">number</option>
                                <option value="boolean">boolean</option>
                              </select>
                              <input
                                type="text"
                                value={field.description}
                                onChange={(e) => updateSchemaField(wh.id, i, { description: e.target.value })}
                                placeholder="description"
                                className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-xs"
                              />
                              <label className="flex items-center gap-1 text-xs text-gray-500">
                                <input
                                  type="checkbox"
                                  checked={field.required}
                                  onChange={(e) => updateSchemaField(wh.id, i, { required: e.target.checked })}
                                  className="rounded text-indigo-600"
                                />
                                Req
                              </label>
                              <button
                                onClick={() => removeSchemaField(wh.id, i)}
                                className="text-red-400 hover:text-red-600 text-xs"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          {wh.parametersSchema.length === 0 && (
                            <p className="text-xs text-gray-400 italic">No parameters. Click &ldquo;Add Field&rdquo; to define input parameters.</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── MCP Servers ── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">MCP Servers</h3>
            <p className="text-xs text-gray-400 mt-0.5">Connect Model Context Protocol servers to give your agent external tools.</p>
          </div>
          <button
            onClick={addMcpServer}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-medium"
          >
            + Add MCP Server
          </button>
        </div>

        {/* Suggested MCP Servers (quick-add) */}
        {SUGGESTED_MCP_SERVERS.some((s) => !mcpServers.some((m) => m.name === s.name)) && (
          <div className="mb-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">Popular Servers</p>
            <div className="grid grid-cols-2 gap-2">
              {SUGGESTED_MCP_SERVERS.map((suggested) => {
                const alreadyAdded = mcpServers.some((s) => s.name === suggested.name);
                return (
                  <button
                    key={suggested.name}
                    disabled={alreadyAdded}
                    onClick={() => {
                      const newServer: McpServerConfig = {
                        id: crypto.randomUUID(),
                        name: suggested.name,
                        displayName: suggested.displayName,
                        serverUrl: suggested.serverUrl,
                        transportType: suggested.transportType,
                        authHeaders: {},
                        toolFilter: [],
                      };
                      const updated = [...mcpServers, newServer];
                      if (suggested.requiresAuth) {
                        setExpandedMcp(newServer.id);
                        setShowMcpAdvanced({ ...showMcpAdvanced, [newServer.id]: true });
                      }
                      updateAndNotify(builtins, webhooks, updated);
                    }}
                    className={`flex items-start gap-2 p-3 border rounded-lg text-left transition-colors ${
                      alreadyAdded
                        ? "border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-900/20 cursor-default"
                        : "border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10"
                    }`}
                  >
                    <span className="text-lg leading-none mt-0.5">{suggested.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-gray-900 dark:text-white text-sm truncate">{suggested.displayName}</span>
                        {suggested.requiresAuth && (
                          <span className="text-xs px-1 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded shrink-0">Key</span>
                        )}
                        {alreadyAdded && (
                          <span className="text-xs text-green-600 dark:text-green-400 shrink-0">Added</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{suggested.description}</div>
                      {suggested.authHint && (
                        <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">{suggested.authHint}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {mcpServers.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Click a suggested server above or &ldquo;Add MCP Server&rdquo; to connect your own.</p>
        ) : (
          <div className="space-y-3">
            {mcpServers.map((server) => (
              <div
                key={server.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
              >
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  onClick={() => setExpandedMcp(expandedMcp === server.id ? null : server.id)}
                >
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white text-sm">
                      {server.displayName || "Untitled Server"}
                    </span>
                    {server.serverUrl && (
                      <span className="ml-2 text-xs text-gray-400 font-mono truncate max-w-xs inline-block align-bottom">{server.serverUrl}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded">
                      {server.transportType === "sse" ? "SSE" : "Streamable HTTP"}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeMcpServer(server.id); }}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${expandedMcp === server.id ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {expandedMcp === server.id && (
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Display Name</label>
                        <input
                          type="text"
                          value={server.displayName}
                          onChange={(e) => updateMcpServer(server.id, { displayName: e.target.value })}
                          placeholder="My Tool Server"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Server Name (slug)</label>
                        <input
                          type="text"
                          value={server.name}
                          onChange={(e) => updateMcpServer(server.id, { name: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "-") })}
                          placeholder="my-tool-server"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Server URL</label>
                      <input
                        type="url"
                        value={server.serverUrl}
                        onChange={(e) => updateMcpServer(server.id, { serverUrl: e.target.value })}
                        placeholder="https://mcp.example.com/sse"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Transport</label>
                      <select
                        value={server.transportType}
                        onChange={(e) => updateMcpServer(server.id, { transportType: e.target.value as McpServerConfig["transportType"] })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                      >
                        <option value="streamable-http">Streamable HTTP</option>
                        <option value="sse">Server-Sent Events (SSE)</option>
                      </select>
                    </div>

                    {/* Advanced settings */}
                    <div>
                      <button
                        onClick={() => setShowMcpAdvanced({ ...showMcpAdvanced, [server.id]: !showMcpAdvanced[server.id] })}
                        className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
                      >
                        <svg className={`w-3 h-3 transition-transform ${showMcpAdvanced[server.id] ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        Advanced
                      </button>

                      {showMcpAdvanced[server.id] && (
                        <div className="mt-3 space-y-3 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                          <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Auth Headers (JSON)</label>
                            <textarea
                              value={JSON.stringify(server.authHeaders, null, 2)}
                              onChange={(e) => {
                                try {
                                  const parsed = JSON.parse(e.target.value);
                                  updateMcpServer(server.id, { authHeaders: parsed });
                                } catch {
                                  // Invalid JSON
                                }
                              }}
                              rows={3}
                              placeholder='{"Authorization": "Bearer ..."}'
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                              Tool Filter <span className="text-gray-400">(comma-separated tool names, empty = all)</span>
                            </label>
                            <input
                              type="text"
                              value={server.toolFilter.join(", ")}
                              onChange={(e) => updateMcpServer(server.id, {
                                toolFilter: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                              })}
                              placeholder="tool_a, tool_b"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Skills ── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Skills</h3>
            <p className="text-xs text-gray-400 mt-0.5">Skills define expertise and behavior guidelines for your agent.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowImportSkill(!showImportSkill)}
              className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Import SKILL.md
            </button>
            <button
              onClick={addSkill}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-medium"
            >
              + Add Custom Skill
            </button>
          </div>
        </div>

        {/* Import modal */}
        {showImportSkill && (
          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3 mb-4">
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={8}
              placeholder={"---\nname: my-skill\ndisplay_name: My Skill\ndescription: What it does\ntags: [tag1, tag2]\n---\n\nInstructions go here..."}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm font-mono"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowImportSkill(false); setImportText(""); }} className="text-sm text-gray-500">Cancel</button>
              <button
                onClick={handleImportSkill}
                disabled={!importText.trim()}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                Import
              </button>
            </div>
          </div>
        )}

        {/* Template skills (pre-checked) */}
        {templateSkills.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">Template Skills</p>
            <div className="space-y-3">
              {templateSkills.map((skill) => (
                <label
                  key={skill.id}
                  className="flex items-start gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={skill.enabled}
                    onChange={() => toggleSkill(skill.id)}
                    className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white text-sm">{skill.displayName}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{skill.description}</div>
                    {skill.tags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {skill.tags.map((tag) => (
                          <span key={tag} className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Custom skills (expandable cards) */}
        {customSkills.length > 0 && (
          <div className="space-y-3">
            {templateSkills.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Custom Skills</p>
            )}
            {customSkills.map((skill) => (
              <div
                key={skill.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
              >
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  onClick={() => setExpandedSkill(expandedSkill === skill.id ? null : skill.id)}
                >
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white text-sm">
                      {skill.displayName || "Untitled Skill"}
                    </span>
                    {skill.name && (
                      <span className="ml-2 text-xs text-gray-400 font-mono">{skill.name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); removeSkill(skill.id); }}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${expandedSkill === skill.id ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {expandedSkill === skill.id && (
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Skill Name</label>
                        <input
                          type="text"
                          value={skill.name}
                          onChange={(e) => updateSkill(skill.id, { name: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                          placeholder="menu-browsing"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Display Name</label>
                        <input
                          type="text"
                          value={skill.displayName}
                          onChange={(e) => updateSkill(skill.id, { displayName: e.target.value })}
                          placeholder="Menu Browsing"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Description</label>
                      <input
                        type="text"
                        value={skill.description}
                        onChange={(e) => updateSkill(skill.id, { description: e.target.value })}
                        placeholder="Help customers explore the menu"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Tags (comma-separated)</label>
                      <input
                        type="text"
                        value={skill.tags.join(", ")}
                        onChange={(e) => updateSkill(skill.id, { tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                        placeholder="food, menu"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Instructions (markdown)</label>
                      <textarea
                        value={skill.instructions}
                        onChange={(e) => updateSkill(skill.id, { instructions: e.target.value })}
                        rows={8}
                        placeholder="When helping with this task..."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {skills.length === 0 && !showImportSkill && (
          <p className="text-sm text-gray-400 italic">No skills configured. Skills are optional behavior guidelines.</p>
        )}
      </div>

      {/* ── Navigation ── */}
      <div className="flex justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onBack}
          className="px-6 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          Back
        </button>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">
            {enabledToolCount} tool{enabledToolCount !== 1 ? "s" : ""}, {enabledSkillCount} skill{enabledSkillCount !== 1 ? "s" : ""}
          </span>
          <button
            onClick={onNext}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            Create Agent
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Schema Helpers ──────────────────────────────────────────────────────────

export function fieldsToJsonSchema(fields: SchemaField[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const field of fields) {
    if (!field.name) continue;
    properties[field.name] = {
      type: field.type,
      description: field.description || undefined,
    };
    if (field.required) required.push(field.name);
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

function jsonSchemaToFields(schema: Record<string, unknown>): SchemaField[] {
  const props = (schema.properties || {}) as Record<string, Record<string, unknown>>;
  const required = (schema.required || []) as string[];

  return Object.entries(props).map(([name, def]) => ({
    name,
    type: (def.type as SchemaField["type"]) || "string",
    description: (def.description as string) || "",
    required: required.includes(name),
  }));
}
