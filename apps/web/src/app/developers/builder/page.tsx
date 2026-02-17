"use client";

import { useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { useAuthContext } from "@/providers/AuthProvider";
import { AgentTemplate } from "@/lib/agentTemplates";
import { TemplateStep } from "./TemplateStep";
import { BasicInfoStep, BasicInfo } from "./BasicInfoStep";
import { ConfigStep, AgentConfig } from "./ConfigStep";
import { ToolsStep, ToolsConfig, DEFAULT_BUILTINS, SkillConfig } from "./ToolsStep";
import { DocumentStep } from "./DocumentStep";
import { SuccessStep } from "./SuccessStep";

type Step = "template" | "basic" | "config" | "tools" | "documents" | "success";

const STEP_ORDER: Step[] = ["template", "basic", "config", "tools", "documents", "success"];
const STEP_LABELS: Record<Step, string> = {
  template: "Template",
  basic: "Info",
  config: "Configure",
  tools: "Tools & Skills",
  documents: "Documents",
  success: "Done",
};

export default function AgentBuilderPage() {
  const { isAuthenticated, isLoading } = useAuthContext();
  const [step, setStep] = useState<Step>("template");
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null);
  const [basicInfo, setBasicInfo] = useState<BasicInfo>({ name: "", slug: "", description: "", icon: "" });
  const [config, setConfig] = useState<AgentConfig>({
    systemPrompt: "",
    welcomeMessage: "",
    pricingType: "free",
    pricePerQuery: 0,
    freeQueries: 0,
    agentWallet: "",
    capabilities: [],
    brandColor: "",
    businessInfo: { phone: "", address: "", hours: "", website: "" },
    llmProvider: "",
    llmApiKey: "",
    llmModel: "",
    llmBaseUrl: "",
    chainId: 97,
  });
  const [toolsConfig, setToolsConfig] = useState<ToolsConfig>({ builtins: [], webhooks: [], mcpServers: [], skills: [] });
  const [createdAgent, setCreatedAgent] = useState<{ id: string; slug: string; name: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTemplateSelect = (template: AgentTemplate) => {
    setSelectedTemplate(template);
    setBasicInfo((prev) => ({
      ...prev,
      icon: template.icon,
      description: template.description,
    }));
    setConfig((prev) => ({
      ...prev,
      systemPrompt: template.systemPromptTemplate,
      welcomeMessage: template.welcomeMessageTemplate,
      capabilities: template.defaultCapabilities,
      pricingType: template.defaultPricingType,
    }));

    // Pre-check builtin tools from template defaults
    const preCheckedBuiltins = DEFAULT_BUILTINS.map((b) => ({
      ...b,
      enabled: template.defaultTools?.some((dt) => dt.builtinRef === b.ref) ?? false,
    }));

    // Populate template skills as pre-checked
    const templateSkills: SkillConfig[] = (template.defaultSkills || []).map((s, i) => ({
      id: crypto.randomUUID(),
      name: s.name,
      displayName: s.displayName,
      description: s.description,
      instructions: s.instructions,
      tags: s.tags || [],
      isTemplate: true,
      enabled: true,
    }));

    setToolsConfig({
      builtins: preCheckedBuiltins,
      webhooks: [],
      mcpServers: [],
      skills: templateSkills,
    });

    setStep("basic");
  };

  const handleCreateAgent = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Replace {businessName} placeholder in prompts
      const businessName = basicInfo.name;
      const systemPrompt = config.systemPrompt.replace(/\{businessName\}/g, businessName);
      const welcomeMessage = config.welcomeMessage.replace(/\{businessName\}/g, businessName);

      const hasBusinessInfo = config.businessInfo.phone || config.businessInfo.address || config.businessInfo.hours || config.businessInfo.website;

      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: basicInfo.name,
          slug: basicInfo.slug,
          description: basicInfo.description,
          category: selectedTemplate?.category || "customer-facing",
          template: selectedTemplate?.id || "custom",
          systemPrompt,
          welcomeMessage,
          icon: basicInfo.icon,
          pricingType: config.pricingType,
          pricePerQuery: config.pricePerQuery,
          freeQueries: config.freeQueries,
          agentWallet: config.agentWallet || null,
          capabilities: config.capabilities,
          brandColor: config.brandColor || null,
          businessInfo: hasBusinessInfo ? config.businessInfo : null,
          llmProvider: config.llmProvider || null,
          llmApiKey: config.llmApiKey || null,
          llmModel: config.llmModel || null,
          llmBaseUrl: config.llmBaseUrl || null,
          chainId: config.chainId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create agent");
      }

      const data = await res.json();
      const agentId = data.id;
      setCreatedAgent({ id: agentId, slug: data.slug, name: basicInfo.name });

      // Create tools for the agent
      const enabledBuiltins = toolsConfig.builtins.filter((b) => b.enabled);
      const toolPromises: Promise<Response>[] = [];

      for (const builtin of enabledBuiltins) {
        toolPromises.push(
          fetch(`/api/agents/${agentId}/tools`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: builtin.name,
              displayName: builtin.displayName,
              description: builtin.description,
              toolType: "builtin",
              builtinRef: builtin.ref,
              parametersSchema: { type: "object", properties: {} },
            }),
          })
        );
      }

      for (const wh of toolsConfig.webhooks) {
        if (!wh.name || !wh.webhookUrl) continue;
        // Convert fields to JSON schema
        const { fieldsToJsonSchema } = await import("./ToolsStep");
        toolPromises.push(
          fetch(`/api/agents/${agentId}/tools`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: wh.name,
              displayName: wh.displayName || wh.name,
              description: wh.description,
              toolType: "webhook",
              webhookUrl: wh.webhookUrl,
              webhookMethod: wh.webhookMethod,
              webhookHeaders: Object.keys(wh.webhookHeaders).length > 0 ? wh.webhookHeaders : undefined,
              parametersSchema: fieldsToJsonSchema(wh.parametersSchema),
            }),
          })
        );
      }

      // Create MCP server configs
      for (const server of toolsConfig.mcpServers) {
        if (!server.serverUrl) continue;
        toolPromises.push(
          fetch(`/api/agents/${agentId}/mcp-servers`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: server.name || server.displayName.toLowerCase().replace(/[^a-z0-9_-]/g, "-") || `mcp-${Date.now()}`,
              displayName: server.displayName || server.name,
              serverUrl: server.serverUrl,
              transportType: server.transportType,
              authHeaders: Object.keys(server.authHeaders).length > 0 ? server.authHeaders : undefined,
              toolFilter: server.toolFilter.length > 0 ? server.toolFilter : undefined,
            }),
          })
        );
      }

      await Promise.allSettled(toolPromises);

      // Seed skills (both template and custom)
      const enabledSkills = toolsConfig.skills.filter((s) => s.enabled && s.name && s.instructions);
      const skillPromises = enabledSkills.map((skill, index) =>
        fetch(`/api/agents/${agentId}/skills`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: skill.name,
            displayName: skill.displayName,
            description: skill.description,
            instructions: skill.instructions,
            tags: skill.tags || [],
            sortOrder: index,
          }),
        })
      );
      await Promise.allSettled(skillPromises);

      setStep("documents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auth check
  if (isLoading) {
    return (
      <div className="min-h-full">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-pulse text-gray-400">Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-full">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Sign in to Build Agents</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Create an account or sign in to start building your own AI agents.</p>
            <Link
              href="/login"
              className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const currentStepIndex = STEP_ORDER.indexOf(step);

  return (
    <div className="min-h-full">
      <Header />

      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link href="/developers" className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
            Developers
          </Link>
          <span className="text-gray-400 mx-2">/</span>
          <span className="text-sm text-gray-600 dark:text-gray-400">Agent Builder</span>
        </div>

        {/* Progress steps */}
        {step !== "success" && (
          <div className="flex items-center gap-2 mb-10">
            {STEP_ORDER.slice(0, -1).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                    i < currentStepIndex
                      ? "bg-indigo-600 text-white"
                      : i === currentStepIndex
                      ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-600 dark:ring-indigo-400"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                  }`}
                >
                  {i < currentStepIndex ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`text-xs hidden sm:block ${
                    i <= currentStepIndex ? "text-gray-900 dark:text-white" : "text-gray-400"
                  }`}
                >
                  {STEP_LABELS[s]}
                </span>
                {i < STEP_ORDER.length - 2 && (
                  <div className={`w-8 h-px ${i < currentStepIndex ? "bg-indigo-600" : "bg-gray-200 dark:bg-gray-700"}`} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
          </div>
        )}

        {/* Step content */}
        {step === "template" && <TemplateStep onSelect={handleTemplateSelect} />}
        {step === "basic" && (
          <BasicInfoStep
            initialData={basicInfo}
            onChange={setBasicInfo}
            onNext={() => setStep("config")}
            onBack={() => setStep("template")}
          />
        )}
        {step === "config" && (
          <ConfigStep
            initialData={config}
            onChange={setConfig}
            onSubmit={() => setStep("tools")}
            onBack={() => setStep("basic")}
            isSubmitting={false}
          />
        )}
        {step === "tools" && (
          <ToolsStep
            initialData={toolsConfig}
            onChange={setToolsConfig}
            onNext={handleCreateAgent}
            onBack={() => setStep("config")}
          />
        )}
        {step === "documents" && createdAgent && (
          <DocumentStep
            agentId={createdAgent.id}
            documentHints={selectedTemplate?.documentHints || "Upload any relevant documents."}
            onNext={() => setStep("success")}
            showBack={false}
          />
        )}
        {step === "success" && createdAgent && (
          <SuccessStep
            agentId={createdAgent.id}
            agentName={createdAgent.name}
            slug={createdAgent.slug}
          />
        )}
      </div>
    </div>
  );
}
