#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Role {
  id: string;
  name: string;
  description: string;
  instructions: string;
  context_areas: string[];
}

interface Application {
  name: string;
  description: string;
  technology_stack: string[];
  architecture: {
    type: string;
    description: string;
  };
  repositories?: Array<{
    name: string;
    url: string;
    description: string;
  }>;
  key_services?: Array<{
    name: string;
    description: string;
    tech: string;
  }>;
  apis?: Array<{
    name: string;
    base_url: string;
    documentation: string;
  }>;
  infrastructure?: {
    cloud: string;
    deployment: string;
    monitoring: string;
  };
}

class BMADServer {
  private server: Server;
  private roles: Record<string, Role> = {};
  private applications: Record<string, Application> = {};
  private contextPath: string;

  constructor() {
    this.server = new Server(
      {
        name: "my-bmad",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    // Context path should be one level up from dist when built
    this.contextPath = path.join(__dirname, "..", "context");

    this.setupHandlers();
    this.loadContext();
  }

  private async loadContext() {
    try {
      // Load roles from individual markdown files
      const rolesDir = path.join(this.contextPath, "roles");
      const roleFiles = await fs.readdir(rolesDir);
      
      for (const file of roleFiles) {
        if (file.endsWith(".md")) {
          const roleId = file.replace(".md", "");
          const content = await fs.readFile(
            path.join(rolesDir, file),
            "utf-8"
          );
          this.roles[roleId] = this.parseRoleMarkdown(content, roleId);
        }
      }

      const appsData = await fs.readFile(
        path.join(this.contextPath, "applications.json"),
        "utf-8"
      );
      const appsJson = JSON.parse(appsData);
      this.applications = appsJson.applications;
    } catch (error) {
      console.error("Error loading context:", error);
    }
  }

  private parseRoleMarkdown(content: string, id: string): Role {
    const lines = content.split("\n");
    let name = "";
    let description = "";
    let instructions = "";
    let contextAreas: string[] = [];
    
    let currentSection = "";
    let instructionsLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.startsWith("# ")) {
        name = line.substring(2).trim();
      } else if (line.startsWith("## Instructions")) {
        currentSection = "instructions";
      } else if (line.startsWith("## Context Areas")) {
        currentSection = "context_areas";
      } else if (line.startsWith("## ")) {
        currentSection = "other";
      } else if (currentSection === "instructions" && line.trim()) {
        instructionsLines.push(line);
      } else if (currentSection === "context_areas" && line.trim().startsWith("-")) {
        contextAreas.push(line.trim().substring(1).trim());
      } else if (!description && name && line.trim() && !line.startsWith("#")) {
        description = line.trim();
      }
    }
    
    instructions = instructionsLines.join("\n").trim();
    
    return {
      id,
      name: name || id,
      description: description || "No description",
      instructions: instructions || "No specific instructions",
      context_areas: contextAreas,
    };
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "act_as_role",
          description:
            "Switch to a specific role (e.g., 'Developer', 'Architect', 'Tester') to get role-specific instructions and context",
          inputSchema: {
            type: "object",
            properties: {
              role: {
                type: "string",
                description:
                  "The role to act as (developer, architect, tester, devops, product)",
                enum: Object.keys(this.roles),
              },
            },
            required: ["role"],
          },
        },
        {
          name: "get_application_context",
          description:
            "Get detailed context about a specific application including architecture, tech stack, services, and APIs",
          inputSchema: {
            type: "object",
            properties: {
              application: {
                type: "string",
                description: "The application name to get context for",
              },
            },
            required: ["application"],
          },
        },
        {
          name: "list_available_roles",
          description: "List all available roles you can act as",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "list_applications",
          description: "List all applications with their basic information",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
      ],
    }));

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: "bmad://roles/all",
          name: "All Roles",
          description: "Complete list of all available roles",
          mimeType: "application/json",
        },
        {
          uri: "bmad://applications/all",
          name: "All Applications",
          description: "Complete list of all applications",
          mimeType: "application/json",
        },
      ],
    }));

    // Read resources
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;

      if (uri === "bmad://roles/all") {
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(this.roles, null, 2),
            },
          ],
        };
      }

      if (uri === "bmad://applications/all") {
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(this.applications, null, 2),
            },
          ],
        };
      }

      throw new Error(`Unknown resource: ${uri}`);
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "act_as_role": {
          const role = args?.role as string;
          const roleData = this.roles[role];

          if (!roleData) {
            return {
              content: [
                {
                  type: "text",
                  text: `Role '${role}' not found. Available roles: ${Object.keys(
                    this.roles
                  ).join(", ")}`,
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text",
                text: `# Acting as: ${roleData.name}\n\n${roleData.description}\n\n## Instructions\n\n${roleData.instructions}\n\n## Context Areas\n\nYou should focus on these areas: ${roleData.context_areas.join(", ")}`,
              },
            ],
          };
        }

        case "get_application_context": {
          const appName = args?.application as string;
          const app = this.applications[appName];

          if (!app) {
            return {
              content: [
                {
                  type: "text",
                  text: `Application '${appName}' not found. Available applications: ${Object.keys(
                    this.applications
                  ).join(", ")}`,
                },
              ],
            };
          }

          let context = `# ${app.name}\n\n${app.description}\n\n`;
          context += `## Technology Stack\n\n${app.technology_stack.join(", ")}\n\n`;
          context += `## Architecture\n\n**Type:** ${app.architecture.type}\n\n${app.architecture.description}\n\n`;

          if (app.repositories && app.repositories.length > 0) {
            context += `## Repositories\n\n`;
            app.repositories.forEach((repo) => {
              context += `- **${repo.name}**: ${repo.description}\n  - ${repo.url}\n`;
            });
            context += `\n`;
          }

          if (app.key_services && app.key_services.length > 0) {
            context += `## Key Services\n\n`;
            app.key_services.forEach((service) => {
              context += `- **${service.name}** (${service.tech}): ${service.description}\n`;
            });
            context += `\n`;
          }

          if (app.apis && app.apis.length > 0) {
            context += `## APIs\n\n`;
            app.apis.forEach((api) => {
              context += `- **${api.name}**\n  - Base URL: ${api.base_url}\n  - Docs: ${api.documentation}\n`;
            });
            context += `\n`;
          }

          if (app.infrastructure) {
            context += `## Infrastructure\n\n`;
            context += `- **Cloud:** ${app.infrastructure.cloud}\n`;
            context += `- **Deployment:** ${app.infrastructure.deployment}\n`;
            context += `- **Monitoring:** ${app.infrastructure.monitoring}\n`;
          }

          return {
            content: [
              {
                type: "text",
                text: context,
              },
            ],
          };
        }

        case "list_available_roles": {
          let rolesList = "# Available Roles\n\n";
          Object.entries(this.roles).forEach(([key, role]) => {
            rolesList += `## ${role.name} (${key})\n\n${role.description}\n\n`;
          });

          return {
            content: [
              {
                type: "text",
                text: rolesList,
              },
            ],
          };
        }

        case "list_applications": {
          let appsList = "# Applications\n\n";
          Object.entries(this.applications).forEach(([key, app]) => {
            appsList += `## ${app.name} (${key})\n\n${app.description}\n\n`;
            appsList += `**Tech Stack:** ${app.technology_stack.join(", ")}\n\n`;
          });

          return {
            content: [
              {
                type: "text",
                text: appsList,
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("BMAD MCP Server running on stdio");
  }
}

const server = new BMADServer();
server.run().catch(console.error);
