/**
 * Zero Studio Launcher — 启动服务器 + Neutralino 窗口
 */
const { spawn, exec } = require('child_process');
const path = require('path');
const http = require('http');

const ROOT = __dirname;
const PORT = 8765;

console.log('Zero Studio — 启动中...\n');

// 1. Start the analysis server
const server = spawn('node', [path.join(ROOT, 'server.js')], {
  cwd: ROOT,
  stdio: 'inherit',
});

// 2. Wait for server to be ready, then launch Neutralino
function waitForServer(retries = 30) {
  http.get(`http://localhost:${PORT}/api/recent`, (res) => {
    if (res.statusCode === 200) {
      console.log('✅ 服务就绪，启动桌面应用...\n');
      launchApp();
    } else {
      retry();
    }
  }).on('error', () => retry());

  function retry() {
    if (retries-- > 0) {
      setTimeout(() => waitForServer(retries), 500);
    } else {
      console.error('❌ 服务启动超时');
      server.kill();
      process.exit(1);
    }
  }
}

function launchApp() {
  const neu = spawn('npx', ['neu', 'run'], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  neu.on('close', () => {
    console.log('\nZero Studio 已关闭');
    server.kill();
    process.exit(0);
  });
}

waitForServer();
