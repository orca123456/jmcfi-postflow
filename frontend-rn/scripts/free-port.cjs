const { execSync } = require('node:child_process');

const port = Number(process.argv[2] || 3000);

try {
  if (process.platform === 'win32') {
    const netstat = execSync('netstat -ano -p tcp', { encoding: 'utf8' });
    for (const line of netstat.split('\n')) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5 && parts[1].endsWith(`:${port}`) && parts[3] === 'LISTENING') {
        const pid = parseInt(parts[4], 10);
        if (pid && pid !== process.pid) {
          try {
            execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
            console.log(`Freed port ${port} (terminated stale PID ${pid})`);
          } catch (_) {}
        }
      }
    }
  }
} catch (_) {}

