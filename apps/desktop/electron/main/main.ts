import { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, nativeImage, screen, desktopCapturer } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { createHash } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

const DIST = path.join(__dirname, '..', 'dist');
const PRELOAD = path.join(__dirname, '..', 'electron-dist', 'preload.mjs');

console.log('[DEV MODE]:', isDev);
console.log('[DIST PATH]:', DIST);
console.log('[PRELOAD PATH]:', PRELOAD);

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

async function getPrimaryScreenSource() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1920, height: 1080 },
    fetchWindowIcons: false,
  });

  return (
    sources.find((source) => source.display_id === String(primaryDisplay.id)) ||
    sources[0] ||
    null
  );
}

// ── Overlay Window (Stealth Mode) ──────────────────────────────

function createOverlayWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  overlayWindow = new BrowserWindow({
    width: 680,
    height: 42,
    minWidth: 320,
    minHeight: 42,
    maxWidth: Math.floor(width * 0.8),
    maxHeight: Math.floor(height * 0.9),
    x: Math.round(width / 2 - 340),
    y: 12,
    title: 'Windows Input Panel',        // Stealth: disguised title
    backgroundColor: '#0a0a0b',
    frame: false,
    transparent: true,
    resizable: true,                      // User-resizable
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    type: 'toolbar',
    focusable: true,
    webPreferences: {
      preload: PRELOAD,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Content protection: prevent this window from appearing in its own screenshots
  overlayWindow.setContentProtection(true);

  // Stealth: hide from Alt+Tab on Windows
  if (process.platform === 'win32') {
    try {
      const hwnd = overlayWindow.getNativeWindowHandle();
      const { applyStealthToWindow } = require('../native-module/index.js');
      applyStealthToWindow?.(hwnd);
    } catch { /* native module not available */ }
  }

  // Mac-specific stealth
  if (process.platform === 'darwin') {
    try {
      overlayWindow.setHiddenInMissionControl(true);
      overlayWindow.setWindowButtonVisibility(false);
    } catch { /* optional */ }
  }

  if (isDev) {
    overlayWindow.loadURL('http://localhost:1420/#/overlay');
    if (process.argv.includes('--devtools')) {
      overlayWindow.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    overlayWindow.loadFile(path.join(DIST, 'index.html'), { hash: '#/overlay' });
  }

  // Re-enforce alwaysOnTop every 5s (counters some fullscreen apps)
  const atopInterval = setInterval(() => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  }, 5000);

  // Show without stealing focus
  overlayWindow.once('ready-to-show', () => {
    overlayWindow?.showInactive();
  });

  overlayWindow.on('closed', () => {
    clearInterval(atopInterval);
    overlayWindow = null;
  });
}

// ── Main Launcher Window ──────────────────────────────────────

function createLauncherWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    title: 'CHEAT ME IN',
    backgroundColor: '#0a0a0b',
    show: true,
    webPreferences: {
      preload: PRELOAD,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:1420').catch((err) => {
      console.error('Failed to load URL:', err);
    });
    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
      console.error('Failed to load:', errorCode, errorDescription);
    });
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
      console.error('Renderer process gone:', details.reason);
    });
  } else {
    mainWindow.loadFile(path.join(DIST, 'index.html'));
  }

mainWindow.once('ready-to-show', () => {
    console.log('[WINDOW] ready-to-show fired');
    mainWindow?.show();
  });

  mainWindow.on('closed', () => { 
    console.log('[WINDOW] closed');
    mainWindow = null; 
  });
  
  mainWindow.on('show', () => {
    console.log('[WINDOW] show event fired');
  });
  
  console.log('[WINDOW] created, bounds:', mainWindow.getBounds());
}

// ── Tray ──────────────────────────────────────────────────────

function createTray() {
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAbwAAAG8B8aLcQwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAEoSURBVDiNpZMxTsNAEEX/rNeOAwUlHVdA4gJcAokLUNDRcAQkLkCBaOgouQIVHZyAgoKSK0QiIbbXuzMUiWNZxgkjjTT635dm5o8YYxwfH5fL5fIeYAwAoii6q9VqDwDgnHPjGOP7arX6EEJYxhgBYO/9Y5Zl1/M8DwAQQuA4jm+32+1r27YPAFYUhYcQ3k3TvEYMAKSUZ61W6y2E4Pu+LyJiRIQQQggppVBKoRACWmsAMM/zX0qpAQAopV4B4L+LZVk+AlBKYZomlFJYLBbfWmvked4CmOu6fgWgtf7quu4NAPR6vW273X5RSh2bppn6vn8KAP1+/2mxWGwBwDAMt7quPymlBgCglEIURQ+Z53mcMcY559773xhjFEJoACClRAiBEALGGEgp/2KM/QJrI7jNNO1X6gAAAABJRU5ErkJggg=='
  );
  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open CHEAT ME IN',
      click: () => {
        if (!mainWindow || mainWindow.isDestroyed()) createLauncherWindow();
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { label: 'Toggle Overlay', click: () => toggleOverlay() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setToolTip('CHEAT ME IN');
  tray.setContextMenu(contextMenu);
}

// ── Navigation ────────────────────────────────────────────────

function toggleOverlay() {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    createOverlayWindow();
    return;
  }
  if (overlayWindow.isVisible()) {
    overlayWindow.hide();
  } else {
    overlayWindow.showInactive();
  }
}

function switchToLauncher() {
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.hide();
  if (!mainWindow || mainWindow.isDestroyed()) createLauncherWindow();
  mainWindow?.show();
  mainWindow?.focus();
}

function switchToOverlay() {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
  if (!overlayWindow || overlayWindow.isDestroyed()) createOverlayWindow();
  overlayWindow?.showInactive();
}

// ── IPC Handlers ──────────────────────────────────────────────

function registerIpcHandlers() {
  // Window control
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize();
  });
  ipcMain.handle('window:close', () => mainWindow?.close());
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);
  ipcMain.handle('window:switchToLauncher', () => switchToLauncher());
  ipcMain.handle('window:switchToOverlay', () => switchToOverlay());

  // Overlay
  ipcMain.handle('overlay:toggle', () => toggleOverlay());
  ipcMain.handle('overlay:show', () => overlayWindow?.showInactive());
  ipcMain.handle('overlay:hide', () => overlayWindow?.hide());
  ipcMain.handle('overlay:setOpacity', (_e, opacity: number) => overlayWindow?.setOpacity(opacity));
  ipcMain.handle('overlay:setPassthrough', (_e, passthrough: boolean) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setIgnoreMouseEvents(passthrough, { forward: true });
    }
  });
  ipcMain.handle('overlay:setSize', (_e, width: number, height: number) => {
    overlayWindow?.setSize(Math.max(320, width), Math.max(42, height), false);
  });

  // Dynamic content resize — renderer reports actual content dimensions
  ipcMain.handle('overlay:resizeToContent', (_e, contentWidth: number, contentHeight: number) => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return;
    const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;
    const targetW = Math.min(Math.max(320, contentWidth + 16), Math.floor(screenW * 0.8));
    const targetH = Math.min(Math.max(42, contentHeight + 16), Math.floor(screenH * 0.9));
    overlayWindow.setSize(targetW, targetH, false);
  });

  // Disguise mode — stealth window renaming
  const disguiseTitles: Record<string, string> = {
    terminal: 'Windows PowerShell',
    settings: 'Settings',
    activity: 'Resource Monitor',
    notepad: 'Untitled - Notepad',
    calculator: 'Calculator',
    calendar: 'Calendar',
    none: 'CHEAT ME IN',
  };

  ipcMain.handle('disguise:set', (_e, mode: string) => {
    const title = disguiseTitles[mode] || 'CHEAT ME IN';
    overlayWindow?.setTitle(title);
  });

  ipcMain.handle('disguise:getOptions', async () => {
    return Object.keys(disguiseTitles);
  });

  // App info
  ipcMain.handle('app:getVersion', () => app.getVersion());
  ipcMain.handle('app:getPlatform', () => process.platform);
  ipcMain.handle('app:exit', () => app.quit());

  // AI query — calls OpenRouter (or custom BYO endpoint)
  ipcMain.handle('ai:query', async (_event, payload: { query: string; apiKey: string; model: string; systemPrompt?: string; baseUrl?: string; history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>; useOpenAICompat?: boolean; openAICompatUrl?: string; openAICompatModel?: string; openAICompatKey?: string }) => {
    const { query, apiKey, model, systemPrompt, baseUrl, history, useOpenAICompat, openAICompatUrl, openAICompatModel, openAICompatKey } = payload;
    
    // Handle OpenAI-compatible API (Ollama, etc.)
    if (useOpenAICompat) {
      if (!openAICompatUrl) return { response: 'Please set OpenAI-compatible API URL in Settings.' };
      if (!openAICompatModel) return { response: 'Please set OpenAI-compatible model name in Settings.' };
      if (!query?.trim()) return { response: 'Query is empty.' };

      const baseUrl = openAICompatUrl.replace(/\/$/, '');
      
      // Try OpenAI-compatible endpoint first (/v1/chat/completions)
      let endpoint = baseUrl + '/v1/chat/completions';
      let responseFormat = 'openai';
      
      try {
        const messages: any[] = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        if (Array.isArray(history) && history.length > 0) {
          messages.push(...history.slice(-8));
        }
        messages.push({ role: 'user', content: query });

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (openAICompatKey) {
          headers['Authorization'] = `Bearer ${openAICompatKey}`;
        }

        let res = await fetch(endpoint, {
          method: 'POST', headers, body: JSON.stringify({ model: openAICompatModel, messages, stream: false }),
        });

        // If 404, try Ollama's native /api/chat endpoint
        if (res.status === 404) {
          endpoint = baseUrl + '/api/chat';
          responseFormat = 'ollama';
          res = await fetch(endpoint, {
            method: 'POST', headers, body: JSON.stringify({ model: openAICompatModel, messages, stream: false }),
          });
        }

        if (!res.ok) {
          const errText = await res.text();
          return { response: `API error (${res.status}): ${errText.slice(0, 200)}` };
        }

        const data: any = await res.json();
        let content = '';
        
        if (responseFormat === 'openai') {
          content = data?.choices?.[0]?.message?.content || data?.message?.content || '';
        } else {
          // Ollama native format
          content = data?.message?.content || data?.response || '';
        }
        
        return { response: content || 'No response from AI.' };
      } catch (err: any) {
        return { response: `Request failed: ${err?.message || 'Unknown error'}. Make sure Ollama is running at ${baseUrl}` };
      }
    }

    // Default: OpenRouter
    if (!apiKey) return { response: 'Please set your API key in Settings.' };
    if (!query?.trim()) return { response: 'Query is empty.' };

    const endpoint = (baseUrl || 'https://openrouter.ai/api/v1').replace(/\/$/, '') + '/chat/completions';

    try {
      const messages: any[] = [];
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      if (Array.isArray(history) && history.length > 0) {
        messages.push(...history.slice(-8));
      }
      messages.push({ role: 'user', content: query });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      };
      if (!baseUrl) { headers['HTTP-Referer'] = 'https://natively.ai'; headers['X-Title'] = 'CHEAT ME IN'; }

      const res = await fetch(endpoint, {
        method: 'POST', headers, body: JSON.stringify({ model: model || 'inclusionai/ring-2.6-1t:free', messages }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { response: `API error (${res.status}): ${errText.slice(0, 200)}` };
      }

      const data: any = await res.json();
      const content = data?.choices?.[0]?.message?.content || data?.response || '';
      return { response: content || 'No response from AI.' };
    } catch (err: any) {
      return { response: `Request failed: ${err?.message || 'Unknown error'}` };
    }
  });

  // AI vision query — screenshot + text
  ipcMain.handle('ai:vision', async (_event, payload: { text: string; imageBase64: string; apiKey: string; model: string; baseUrl?: string; systemPrompt?: string; history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>; useOpenAICompat?: boolean; openAICompatUrl?: string; openAICompatModel?: string; openAICompatKey?: string }) => {
    const { text, imageBase64, apiKey, model, baseUrl, systemPrompt, history, useOpenAICompat, openAICompatUrl, openAICompatModel, openAICompatKey } = payload;

    // Handle OpenAI-compatible API (Ollama vision)
    if (useOpenAICompat) {
      if (!openAICompatUrl) return { response: 'Please set OpenAI-compatible API URL in Settings.' };
      if (!openAICompatModel) return { response: 'Please set OpenAI-compatible model name in Settings.' };
      if (!text?.trim()) return { response: 'Query is empty.' };

      const endpoint = openAICompatUrl.replace(/\/$/, '') + '/chat/completions';

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (openAICompatKey) {
          headers['Authorization'] = `Bearer ${openAICompatKey}`;
        }

        const messages: any[] = [];
        if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
        if (Array.isArray(history) && history.length > 0) {
          messages.push(...history.slice(-8));
        }
        messages.push({ role: 'user', content: [{ type: 'text', text }, { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } }] });

        const res = await fetch(endpoint, {
          method: 'POST', headers,
          body: JSON.stringify({ model: openAICompatModel, messages }),
        });

        if (!res.ok) {
          const errText = await res.text();
          // Check for vision model error
          if (errText.includes('does not support image') || errText.includes('image input') || errText.includes('vision') || res.status === 400) {
            return { response: 'This model does not support image/vision. Use a vision model like llava or use text-only mode.' };
          }
          return { response: `Vision error (${res.status}): ${errText.slice(0, 200)}` };
        }

        const data2: any = await res.json();
        const content = data2?.choices?.[0]?.message?.content || data2?.message?.content || '';
        
        // Check if response indicates no vision support
        if (!content && data2?.error?.message?.includes('image')) {
          return { response: 'This model does not support image/vision. Use a vision model or disable screenshot mode.' };
        }
        
        return { response: content || 'No response from AI.' };
      } catch (err: any) {
        // Check for common vision errors
        if (err?.message?.includes('image') || err?.message?.includes('vision')) {
          return { response: 'This model does not support vision. Use a vision-capable model or disable screenshot mode.' };
        }
        return { response: `Vision request failed: ${err?.message || 'Unknown error'}` };
      }
    }

    // Default: OpenRouter
    if (!apiKey) return { response: 'Please set your API key in Settings.' };

    const endpoint = (baseUrl || 'https://openrouter.ai/api/v1').replace(/\/$/, '') + '/chat/completions';

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      };
      if (!baseUrl) { headers['HTTP-Referer'] = 'https://natively.ai'; headers['X-Title'] = 'CHEAT ME IN'; }

      const messages: any[] = [];
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      if (Array.isArray(history) && history.length > 0) {
        messages.push(...history.slice(-8));
      }
      messages.push({ role: 'user', content: [{ type: 'text', text }, { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } }] });

      const res = await fetch(endpoint, {
        method: 'POST', headers,
        body: JSON.stringify({
          model: model || 'inclusionai/ring-2.6-1t:free',
          messages,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { response: `Vision error (${res.status}): ${errText.slice(0, 200)}` };
      }

      const data2: any = await res.json();
      const content = data2?.choices?.[0]?.message?.content || data2?.response || '';
      return { response: content || 'No response from AI.' };
    } catch (err: any) {
      return { response: `Vision request failed: ${err?.message || 'Unknown error'}` };
    }
  });

  // Deepgram transcription
  ipcMain.handle('deepgram:transcribe', async (_event, payload: { audioBase64: string; apiKey: string; model: string; mimeType?: string }) => {
    const { audioBase64, apiKey, model, mimeType } = payload;
    if (!apiKey) return { text: '' };

    try {
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      const res = await fetch(`https://api.deepgram.com/v1/listen?model=${model || 'nova-3'}`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': mimeType || 'audio/webm',
        },
        body: audioBuffer,
      });

      if (!res.ok) return { text: '' };
      const data3: any = await res.json();
      const transcript = data3?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
      return { text: transcript };
    } catch {
      return { text: '' };
    }
  });

  // Screen capture — hides overlay window first (user-triggered)
  ipcMain.handle('screenshot:capture', async () => {
    if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible()) {
      overlayWindow.hide();
      await new Promise((r) => setTimeout(r, 500));
    }
    try {
      const src = await getPrimaryScreenSource();
      return src ? src.thumbnail.toDataURL() : null;
    } finally {
      setTimeout(() => overlayWindow?.showInactive(), 200);
    }
  });

  // Silent screenshot — no window hide (used by auto-screen, window has contentProtection)
  ipcMain.handle('screenshot:captureSilent', async () => {
    try {
      const src = await getPrimaryScreenSource();
      return src ? src.thumbnail.toDataURL() : null;
    } catch { return null; }
  });

  // ── Mobile Web Server ────────────────────────────────────────

  let mobileServer: http.Server | null = null;
  let mobileServerPort = 7890;
  let lastConversationHtml = '';

  ipcMain.handle('mobile:start', async (_event, port: number) => {
    if (mobileServer) mobileServer.close();
    mobileServerPort = port || 7890;

    mobileServer = http.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', app: 'CHEAT ME IN', port: mobileServerPort }));
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      });

      res.end(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>CHEAT ME IN - Mobile View</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0b;color:#e4e4e7;font-size:15px;line-height:1.5;padding:16px}
.header{margin-bottom:20px;padding-bottom:12px;border-bottom:1px solid #27272a}
.header h1{font-size:18px;font-weight:600;color:#fafafa}
.header p{font-size:13px;color:#71717a;margin-top:2px}
.entry{padding:12px;margin-bottom:10px;border-radius:10px;background:#121214;border:1px solid #27272a}
.entry.user{border-left:3px solid #3b82f6}
.entry.assistant{border-left:3px solid #22c55e}
.entry.system{border-left:3px solid #f59e0b}
.entry .meta{display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px;color:#71717a}
.entry .role{font-weight:600;text-transform:capitalize}
.entry .content{font-size:14px;color:#e4e4e7;white-space:pre-wrap;word-break:break-word}
.empty{text-align:center;padding:40px 20px;color:#52525b;font-size:14px}
.footer{text-align:center;padding:20px;font-size:12px;color:#52525b}
.disclaimer{margin-top:16px;padding:12px;border-radius:8px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.15)}
.disclaimer p{font-size:12px;color:#ef4444/80;text-align:center}
</style>
</head>
<body>
<div class="header"><h1>CHEAT ME IN</h1><p>Live session — mobile view</p></div>
${lastConversationHtml || '<div class="empty">Waiting for conversation data...</div>'}
<div class="disclaimer"><p>⚠ Only use where recording & AI assistance are explicitly permitted.</p></div>
<div class="footer">CHEAT ME IN · Data stays local</div>
</body>
</html>`);
    });

    mobileServer.listen(mobileServerPort, '0.0.0.0', () => {
      console.log(`[CHEAT ME IN] Mobile view: http://localhost:${mobileServerPort}`);
    });

    return { port: mobileServerPort };
  });

  ipcMain.handle('mobile:stop', async () => {
    if (mobileServer) { mobileServer.close(); mobileServer = null; }
    return { stopped: true };
  });

  ipcMain.handle('mobile:update', async (_event, html: string) => {
    lastConversationHtml = html;
    return { updated: true };
  });

  ipcMain.handle('mobile:status', async () => {
    return { running: mobileServer !== null, port: mobileServerPort };
  });

  // ── RAG System ────────────────────────────────────────────────

  const RAG_API_BASE = 'http://localhost:4000/api/rag';

  ipcMain.handle('rag:index', async (_event, projectPath: string, projectName?: string) => {
    try {
      const res = await fetch(`${RAG_API_BASE}/index`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_path: projectPath, project_name: projectName }),
      });
      return await res.json();
    } catch (err: any) {
      return { status: 'error', error: err.message };
    }
  });

  ipcMain.handle('rag:search', async (_event, query: string, projectName?: string, topK?: number) => {
    try {
      const res = await fetch(`${RAG_API_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, project_name: projectName, top_k: topK || 5 }),
      });
      return await res.json();
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('rag:chat', async (_event, message: string, projectName?: string, conversationId?: string) => {
    try {
      const res = await fetch(`${RAG_API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, project_name: projectName, conversation_id: conversationId }),
      });
      return await res.json();
    } catch (err: any) {
      return { response: err.message };
    }
  });

  ipcMain.handle('rag:status', async () => {
    try {
      const res = await fetch(`${RAG_API_BASE}/status`);
      return await res.json();
    } catch {
      return { ollama_connected: false };
    }
  });

  ipcMain.handle('rag:conversations', async () => {
    try {
      const res = await fetch(`${RAG_API_BASE}/conversations`);
      return await res.json();
    } catch { return []; }
  });

  ipcMain.handle('rag:createConversation', async (_event, projectName?: string) => {
    try {
      const res = await fetch(`${RAG_API_BASE}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_name: projectName }),
      });
      return await res.json();
    } catch (err: any) {
      return { conversation_id: null, error: err.message };
    }
  });

  ipcMain.handle('rag:deleteConversation', async (_event, conversationId: string) => {
    try {
      await fetch(`${RAG_API_BASE}/conversations/${conversationId}`, { method: 'DELETE' });
      return { deleted: true };
    } catch { return { deleted: false }; }
  });

  // RAG Configuration
  ipcMain.handle('rag:getConfig', async () => {
    try {
      const res = await fetch(`${RAG_API_BASE}/config`);
      return await res.json();
    } catch { return { mode: 'local' }; }
  });

  ipcMain.handle('rag:setConfig', async (_event, config: { mode?: string; ollamaUrl?: string; customEndpoint?: string; apiKey?: string; embeddingModel?: string; chatModel?: string }) => {
    try {
      const res = await fetch(`${RAG_API_BASE}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('rag:clear', async () => {
    try {
      const res = await fetch(`${RAG_API_BASE}/clear`, { method: 'DELETE' });
      return await res.json();
    } catch { return { cleared: false }; }
  });
}

// ── Shortcuts ─────────────────────────────────────────────────

function registerShortcuts() {
  globalShortcut.register('CommandOrControl+Shift+Space', () => toggleOverlay());
  globalShortcut.register('CommandOrControl+Shift+R', () => {
    mainWindow?.webContents.send('shortcut:start-recording');
  });
  globalShortcut.register('CommandOrControl+Shift+L', () => switchToLauncher());
  globalShortcut.register('Escape', () => {
    if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible()) {
      overlayWindow.hide();
    }
  });
}

// ── App Lifecycle ─────────────────────────────────────────────

app.whenReady().then(() => {
  // Grant media (mic) + screen permissions for all windows
  app.on('browser-window-created', (_e, win) => {
    // Mic + camera permission
    win.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
      const allowed = ['media', 'mediaKeySystem', 'clipboard-read', 'clipboard-write'];
      callback(allowed.includes(permission));
    });
    // Also set media permission directly
    win.webContents.session.setPermissionCheckHandler((_wc, permission) => {
      return permission === 'media';
    });
  });

  // Create main window first (most important)
  createLauncherWindow();
  
  // Create overlay after a short delay to speed up initial load
  setTimeout(() => {
    try { createOverlayWindow(); } catch {}
  }, 1000);
  
  // Create tray after another delay
  setTimeout(() => {
    try { createTray(); } catch {}
  }, 2000);
  
  // Register IPC and shortcuts
  registerIpcHandlers();
  registerShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createLauncherWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
