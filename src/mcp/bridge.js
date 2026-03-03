import { spawn } from 'child_process';
import { EventEmitter } from 'events';

export class MCPBridge extends EventEmitter {
  constructor(githubToken) {
    super();
    this.githubToken = githubToken;
    this.process = null;
  }

  async start() {
    // Spawn the official GitHub MCP server
    this.process = spawn('npx', ['-y', '@modelcontextprotocol/server-github'], {
      env: {
        ...process.env,
        GITHUB_PERSONAL_ACCESS_TOKEN: this.githubToken
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Bridge stdout to SSE
    this.process.stdout.on('data', (data) => {
      try {
        const lines = data.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          const parsed = JSON.parse(line);
          this.emit('message', parsed);
        }
      } catch (e) {
        // Non-JSON output, log it
        console.log('MCP stdout:', data.toString());
      }
    });

    this.process.stderr.on('data', (data) => {
      console.error('MCP stderr:', data.toString());
      this.emit('error', new Error(data.toString()));
    });

    this.process.on('close', (code) => {
      console.log(`MCP process exited with code ${code}`);
      this.emit('close', code);
    });
  }

  send(message) {
    if (this.process && this.process.stdin.writable) {
      this.process.stdin.write(JSON.stringify(message) + '\n');
    }
  }

  close() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}
