import { NextResponse } from "next/server";
import { getArtifact, artifactTemplates } from "@/lib/artifacts";
import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET export artifact in various formats
export async function GET(
  request: Request,
  context: { params: Promise<{ artifactId: string }> }
) {
  try {
    const { artifactId } = await context.params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "markdown";

    const artifact = await getArtifact(artifactId);

    if (!artifact) {
      return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
    }

    // Auth: check session ownership via the artifact's session
    const db = await getDB();
    const sessionRow = await db
      .prepare("SELECT user_id FROM sessions WHERE artifact_id = ?")
      .bind(artifactId)
      .first<{ user_id: string | null }>();

    if (sessionRow?.user_id) {
      const authSession = await getSession();
      if (!authSession || authSession.userId !== sessionRow.user_id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    switch (format) {
      case "markdown":
      case "md":
        return new Response(artifact.content, {
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Content-Disposition": `attachment; filename="${sanitizeFilename(artifact.title)}.md"`,
          },
        });

      case "json":
        return new Response(
          JSON.stringify(
            {
              id: artifact.id,
              type: artifact.type,
              title: artifact.title,
              data: artifact.data,
              createdAt: artifact.createdAt,
            },
            null,
            2
          ),
          {
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Content-Disposition": `attachment; filename="${sanitizeFilename(artifact.title)}.json"`,
            },
          }
        );

      case "html":
        const html = generateHtmlExport(artifact);
        return new Response(html, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Disposition": `attachment; filename="${sanitizeFilename(artifact.title)}.html"`,
          },
        });

      case "txt":
        const plainText = stripMarkdown(artifact.content);
        return new Response(plainText, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Disposition": `attachment; filename="${sanitizeFilename(artifact.title)}.txt"`,
          },
        });

      default:
        return NextResponse.json(
          { error: "Unsupported format. Use: markdown, json, html, or txt" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Failed to export artifact:", error);
    return NextResponse.json(
      { error: "Failed to export artifact" },
      { status: 500 }
    );
  }
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 50);
}

function stripMarkdown(content: string): string {
  return content
    .replace(/#{1,6}\s/g, "") // Remove headers
    .replace(/\*\*(.*?)\*\*/g, "$1") // Remove bold
    .replace(/\*(.*?)\*/g, "$1") // Remove italic
    .replace(/`(.*?)`/g, "$1") // Remove inline code
    .replace(/\[(.*?)\]\(.*?\)/g, "$1") // Remove links
    .replace(/---/g, "----------------------------") // Convert horizontal rules
    .trim();
}

interface Artifact {
  id: string;
  sessionId: string;
  type: string;
  title: string;
  content: string;
  format: string;
  data: Record<string, unknown>;
  createdAt: string;
}

function generateHtmlExport(artifact: Artifact): string {
  const template = artifactTemplates[artifact.type];
  const templateName = template?.name || "Document";

  // Escape HTML in content first to prevent XSS, then apply markdown formatting
  let safeContent = escapeHtml(artifact.content);

  // Convert markdown to basic HTML (on already-escaped content)
  let bodyContent = safeContent
    .replace(/^# (.*?)$/gm, "<h1>$1</h1>")
    .replace(/^## (.*?)$/gm, "<h2>$1</h2>")
    .replace(/^### (.*?)$/gm, "<h3>$1</h3>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^- (.*?)$/gm, "<li>$1</li>")
    .replace(/(<li>.*?<\/li>\n)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/^---$/gm, "<hr/>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br/>");

  bodyContent = `<p>${bodyContent}</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(artifact.title)}</title>
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      background: #fff;
    }
    h1 {
      font-size: 2em;
      border-bottom: 2px solid #4f46e5;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    h2 {
      font-size: 1.5em;
      color: #1f2937;
      margin-top: 30px;
      margin-bottom: 15px;
    }
    h3 {
      font-size: 1.2em;
      color: #374151;
    }
    p {
      margin: 10px 0;
    }
    ul {
      margin: 10px 0;
      padding-left: 25px;
    }
    li {
      margin: 5px 0;
    }
    hr {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 30px 0;
    }
    strong {
      color: #1f2937;
    }
    em {
      color: #6b7280;
      font-style: italic;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .header .type {
      color: #4f46e5;
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 0.9em;
    }
    @media print {
      body {
        padding: 0;
      }
      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="type">${escapeHtml(templateName)}</div>
  </div>
  ${bodyContent}
  <div class="footer">
    Generated by Straits Agents | ${new Date(artifact.createdAt).toLocaleDateString()}
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char]);
}
