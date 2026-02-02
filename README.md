# Guess the drawing - AI-Powered App Using BMAD Role-Based Context System

An application created with AI assistance, leveraging the BMAD (Be My AI Developer) methodology for role-based AI interactions with full application context.

> **Built with AI**: This project was developed using AI-assisted development, demonstrating how structured role-based prompting and application context can enhance AI collaboration.

## Features

- 🎭 **Role Switching**: Trigger AI to act as Developer, Architect, QA, DevOps, or Product Manager
- 📚 **Application Context**: Store and retrieve detailed application information
- 🔧 **Customizable**: Easy to add new roles and applications
- 🚀 **MCP Integration**: Works seamlessly with Claude Desktop and VS Code

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Build the Server

```bash
npm run build
```

### 3. Configure Claude Desktop or VS Code

Add this to your MCP settings:

**For Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "my-bmad": {
      "command": "node",
      "args": ["/Users/s.jelenic/Documents/Development/my-bmad/dist/index.js"]
    }
  }
}
```

**For VS Code** (Settings > Extensions > GitHub Copilot > MCP Servers):

Add the server path to your MCP configuration.

### 4. Restart Claude Desktop or VS Code

## Usage

Once configured, you can use these commands in your conversations:

### Act as a Role

```
Act as Developer
```

This will trigger the AI to use the developer role context and follow developer-specific instructions.

### Get Application Context

```
Tell me about example-app
```

The AI can retrieve full context about your applications including tech stack, architecture, services, and APIs.

### List Available Options

- "What roles are available?"
- "What applications do you have context for?"

## Customization

### Adding New Roles

Edit `context/roles.json`:

```json
{
  "roles": {
    "your-role": {
      "name": "Your Role Name",
      "description": "Brief description",
      "instructions": "Detailed instructions for the AI when acting in this role",
      "context_areas": ["area1", "area2"]
    }
  }
}
```

### Adding Applications

Edit `context/applications.json`:

```json
{
  "applications": {
    "your-app": {
      "name": "Your Application",
      "description": "What your app does",
      "technology_stack": ["Node.js", "React"],
      "architecture": {
        "type": "Microservices",
        "description": "Architecture description"
      },
      "repositories": [
        {
          "name": "repo-name",
          "url": "https://github.com/...",
          "description": "What this repo contains"
        }
      ],
      "key_services": [
        {
          "name": "Service Name",
          "description": "What it does",
          "tech": "Technology used"
        }
      ],
      "apis": [
        {
          "name": "API Name",
          "base_url": "https://api.example.com",
          "documentation": "https://docs.example.com"
        }
      ],
      "infrastructure": {
        "cloud": "AWS/Azure/GCP",
        "deployment": "Kubernetes/Docker",
        "monitoring": "DataDog/Prometheus/etc"
      }
    }
  }
}
```

### Adding More Context

You can extend the system by:

1. Adding new JSON files in the `context/` directory
2. Loading them in `src/index.ts` (similar to roles and applications)
3. Creating new tools to access the context

## Available Tools

The MCP server provides these tools:

- **act_as_role**: Switch to a specific role
- **get_application_context**: Get detailed application information
- **list_available_roles**: See all available roles
- **list_applications**: See all applications

## Development

### Watch Mode

```bash
npm run watch
```

### Run Without Building

```bash
npm run dev
```

## Project Structure

```
my-bmad/
├── src/
│   └── index.ts          # Main MCP server implementation
├── context/
│   ├── roles.json        # Role definitions
│   └── applications.json # Application context
├── package.json
├── tsconfig.json
└── README.md
```

## Tips

1. **Keep Context Updated**: Regularly update `applications.json` with your latest app info
2. **Use Specific Roles**: Different roles will give you different perspectives
3. **Combine Tools**: Use role switching + application context together
4. **Add Documentation**: Add links to wikis, docs, and runbooks in your application context

## Example Workflow

```
1. "Act as Developer"
   → AI switches to developer mode

2. "Tell me about the user-service in example-app"
   → AI retrieves application context and provides developer-focused response

3. "How should I implement authentication?"
   → AI responds with developer best practices using your app's tech stack
```

## Troubleshooting

- **Server not appearing**: Check MCP configuration path is absolute
- **Context not loading**: Ensure JSON files are valid (use a JSON validator)
- **Role not working**: Verify the role key matches exactly in roles.json

## Next Steps

1. Replace the example application with your real applications
2. Add more roles specific to your team
3. Add more context types (e.g., coding standards, deployment procedures, etc.)
4. Share your configuration with your team

## License

MIT
