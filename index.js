import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const inject = ['webServer', 'sessionQuery'];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = path.join(__dirname, 'user-config.json');
const DATA_FILE = path.join(__dirname, 'daily-cache.json');
const MANUAL_TODOS_FILE = path.join(__dirname, 'manual-todos.json');
const CLIENT_FILE = path.join(__dirname, 'client.js');

// 励志/鼓励语录库
const QUOTES = [
  "🌅 每一份积累都在为突破积蓄力量，开启专注而高效的新一天！",
  "💪 昨天你完成了深入的探索与实践，今天继续保持节奏，稳步前行！",
  "✨ 卓越源于对细节的坚持，把眼前的小事做好，今日亦将收获斐然！",
  "🚀 保持好奇心与行动力，勇敢拥抱挑战，灵感与代码与你同在！",
  "🎯 专注当下，行而不辍，未来属于每一个脚踏实地的创造者！",
  "🌟 每一个解决的问题，都是通向更大可能性的阶梯，加油！",
];

// 默认用户配置
const DEFAULT_CONFIG = {
  pushTime: '09:00', // 每天推送时刻（HH:mm）
  autoPop: true,     // 是否自动弹出 Toast
  contentOptions: {
    quote: true,     // 鼓励文案
    summary: true,   // 昨日总结
    todos: true,     // 待办事项
  },
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      return {
        ...DEFAULT_CONFIG,
        ...saved,
        contentOptions: { ...DEFAULT_CONFIG.contentOptions, ...(saved.contentOptions || {}) },
      };
    }
  } catch (e) {}
  return { ...DEFAULT_CONFIG };
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
  } catch (e) {
    console.error('[daily-summary] Failed to save config:', e);
  }
}

function loadCache() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }
  } catch (e) {}
  return null;
}

function saveCache(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('[daily-summary] Failed to save cache:', e);
  }
}

function loadManualTodos() {
  try {
    if (fs.existsSync(MANUAL_TODOS_FILE)) {
      return JSON.parse(fs.readFileSync(MANUAL_TODOS_FILE, 'utf-8'));
    }
  } catch (e) {}
  return [];
}

function saveManualTodos(todos) {
  try {
    fs.writeFileSync(MANUAL_TODOS_FILE, JSON.stringify(todos, null, 2), 'utf-8');
  } catch (e) {
    console.error('[daily-summary] Failed to save manual todos:', e);
  }
}

export function apply(ctx, pluginConfig = {}) {
  let userConfig = { ...loadConfig(), ...pluginConfig };
  let cachedData = loadCache();
  let manualTodos = loadManualTodos();
  let hasUnread = Boolean(cachedData && !cachedData.isRead);
  let isGenerating = false;
  let schedulerTimer = null;

  function formatDate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 随机或按日期挑选一条鼓励语
  function getDailyQuote(dateStr) {
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
      hash = (hash << 5) - hash + dateStr.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % QUOTES.length;
    return QUOTES[idx];
  }

  // 分析昨日对话
  async function generateSummary(forceYesterday = true) {
    if (isGenerating) return cachedData;
    isGenerating = true;

    try {
      const now = new Date();
      const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (forceYesterday ? 1 : 0));
      const targetDateStr = formatDate(targetDate);

      const startOfTarget = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0).getTime();
      const endOfTarget = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999).getTime();

      let sessions = [];
      try {
        sessions = await ctx.sessionQuery.listSessions();
      } catch (err) {
        console.warn('[daily-summary] listSessions failed:', err);
      }

      // 优先按目标时间区间进行预过滤，确保昨日会话一个不漏
      let candidateSessions = sessions || [];
      const filtered = candidateSessions.filter(s => {
        const up = s.header?.updatedAt || s.header?.createdAt || 0;
        return up >= startOfTarget && up <= (endOfTarget + 86400000);
      });
      if (filtered.length > 0) {
        candidateSessions = filtered.slice(0, 50);
      } else {
        candidateSessions = candidateSessions.slice(0, 30);
      }
      const matchedSessions = [];
      const allTodos = [];
      let totalMessages = 0;

      for (const s of candidateSessions) {
        const sessionId = s.header?.id;
        if (!sessionId) continue;

        let events = [];
        try {
          events = await ctx.sessionQuery.listEvents(sessionId);
        } catch {
          continue;
        }

        const targetEvents = events.filter(e => e.time >= startOfTarget && e.time <= endOfTarget);
        if (targetEvents.length === 0) continue;

        let sessionSnapshot = null;
        try {
          sessionSnapshot = await ctx.sessionQuery.readSession(sessionId);
        } catch {
          continue;
        }

        let title = sessionId.slice(0, 8);
        try {
          const titleSnapshot = await ctx.sessionQuery.readTitle(sessionId);
          if (titleSnapshot?.title) title = titleSnapshot.title;
        } catch {}

        const userMessages = [];
        const assistantMessages = [];
        const sessionTodos = [];

        for (const rawEv of sessionSnapshot.events || []) {
          const evTime = rawEv.time || rawEv.createdAt || 0;
          if (evTime > 0 && (evTime < startOfTarget || evTime > endOfTarget)) {
            continue;
          }

          if (rawEv.type === 'tool_call' || rawEv.tool === 'todo_write' || rawEv.name === 'todo_write') {
            const args = rawEv.args || rawEv.arguments || rawEv.input || {};
            if (Array.isArray(args.todos)) {
              for (const item of args.todos) {
                sessionTodos.push({
                  content: item.content || item.text || '',
                  status: item.status || 'pending',
                  sessionTitle: title,
                  sessionId,
                  isAuto: true,
                });
              }
            }
          }

          const text = rawEv.content || rawEv.text || rawEv.prompt || (typeof rawEv.message === 'string' ? rawEv.message : '');
          if (typeof text === 'string' && text.trim()) {
            if (rawEv.type === 'user' || rawEv.role === 'user' || rawEv.type === 'prompt') {
              userMessages.push(text.trim());
            } else if (rawEv.type === 'assistant' || rawEv.role === 'assistant') {
              assistantMessages.push(text.trim());
            }

            const todoRegex = /- \[( |x|X)\] ([^\r\n]+)/g;
            let match;
            while ((match = todoRegex.exec(text)) !== null) {
              const isCompleted = match[1].toLowerCase() === 'x';
              sessionTodos.push({
                content: match[2].trim(),
                status: isCompleted ? 'completed' : 'pending',
                sessionTitle: title,
                sessionId,
                isAuto: true,
              });
            }
          }
        }

        const uniqueTodos = [];
        const seen = new Set();
        for (const t of sessionTodos) {
          if (!seen.has(t.content)) {
            seen.add(t.content);
            uniqueTodos.push(t);
            allTodos.push(t);
          }
        }

        totalMessages += (userMessages.length + assistantMessages.length);

        let summaryText = '';
        if (userMessages.length > 0) {
          const firstPrompt = userMessages[0].slice(0, 80);
          summaryText = `探讨内容: "${firstPrompt}"${userMessages.length > 1 ? ` 等共 ${userMessages.length} 轮互动` : ''}`;
        } else {
          summaryText = `共产生 ${targetEvents.length} 次操作与记录`;
        }

        matchedSessions.push({
          id: sessionId,
          title,
          messageCount: userMessages.length + assistantMessages.length,
          userPrompts: userMessages.slice(0, 3),
          summary: summaryText,
          todos: uniqueTodos,
        });
      }

      const result = {
        date: targetDateStr,
        targetDate: targetDateStr,
        quote: getDailyQuote(targetDateStr),
        generatedAt: new Date().toISOString(),
        sessionCount: matchedSessions.length,
        totalMessages,
        hasActivity: matchedSessions.length > 0,
        sessions: matchedSessions,
        todos: allTodos,
        isRead: false,
      };

      cachedData = result;
      hasUnread = true;
      saveCache(result);
      return result;
    } catch (e) {
      console.error('[daily-summary] generateSummary failed:', e);
      return cachedData;
    } finally {
      isGenerating = false;
    }
  }

  // 定时调度器
  function scheduleNext() {
    if (schedulerTimer) {
      clearTimeout(schedulerTimer);
      schedulerTimer = null;
    }

    const pushTime = userConfig.pushTime || '09:00';
    const [hhStr, mmStr] = pushTime.split(':');
    const targetHour = parseInt(hhStr, 10) || 9;
    const targetMinute = parseInt(mmStr, 10) || 0;

    const now = new Date();
    const nextRun = new Date(now.getFullYear(), now.getMonth(), now.getDate(), targetHour, targetMinute, 0, 0);

    if (nextRun.getTime() <= now.getTime()) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    const delay = nextRun.getTime() - now.getTime();
    schedulerTimer = setTimeout(async () => {
      try {
        await generateSummary(true);
      } catch (err) {
        console.error('[daily-summary] Cron error:', err);
      } finally {
        scheduleNext();
      }
    }, delay);
  }

  scheduleNext();

  const sendJson = (res, statusCode, body) => {
    res.statusCode = statusCode;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(JSON.stringify(body));
  };

  const parseBody = (req) => new Promise((resolve) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });

  // 注册 Web 页面脚本直接注入 (确保无论如何刷新页面都能自动加载前端 UI)
  ctx.on('webserver/index-inject', (table) => {
    table.push({
      kind: 'script-src',
      placement: 'body',
      src: '/dsh-daily-summary/client.js',
    });
  });

  // 提供客户端脚本资源
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-daily-summary/client.js',
    handler: (req, res) => {
      try {
        const content = fs.readFileSync(CLIENT_FILE, 'utf-8');
        res.statusCode = 200;
        res.setHeader('content-type', 'application/javascript; charset=utf-8');
        res.setHeader('cache-control', 'no-cache');
        res.end(content);
      } catch (err) {
        res.statusCode = 500;
        res.end('/* Failed to read client.js */');
      }
    },
  }), 'daily-summary: GET /dsh-daily-summary/client.js');

  // 获取数据接口
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-daily-summary',
    handler: async (req, res) => {
      if (req.method === 'GET') {
        const latestCache = loadCache();
        if (latestCache) cachedData = latestCache;
        manualTodos = loadManualTodos();

        if (!cachedData) {
          const now = new Date();
          const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
          const yDateStr = formatDate(yesterday);
          cachedData = {
            date: yDateStr,
            targetDate: yDateStr,
            quote: getDailyQuote(yDateStr),
            generatedAt: new Date().toISOString(),
            sessionCount: 0,
            totalMessages: 0,
            hasActivity: false,
            sessions: [],
            todos: [],
            isRead: false,
          };
          generateSummary(true).catch(console.error);
        } else if (!cachedData.quote) {
          cachedData.quote = getDailyQuote(cachedData.date || formatDate(new Date()));
        }

        sendJson(res, 200, {
          success: true,
          summary: cachedData,
          manualTodos,
          config: userConfig,
          hasUnread,
        });
      } else {
        res.statusCode = 405;
        res.end();
      }
    },
  }), 'daily-summary: GET /dsh-daily-summary');

  // 标记已读接口
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-daily-summary/read',
    handler: async (req, res) => {
      if (req.method === 'POST') {
        hasUnread = false;
        if (cachedData) {
          cachedData.isRead = true;
          saveCache(cachedData);
        }
        sendJson(res, 200, { success: true });
      } else {
        res.statusCode = 405;
        res.end();
      }
    },
  }), 'daily-summary: POST /dsh-daily-summary/read');

  // 手动待办 CRUD 接口
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-daily-summary/manual-todos',
    handler: async (req, res) => {
      manualTodos = loadManualTodos();
      if (req.method === 'GET') {
        sendJson(res, 200, { success: true, todos: manualTodos });
      } else if (req.method === 'POST') {
        const body = await parseBody(req);
        if (body.action === 'delete') {
          manualTodos = manualTodos.filter(t => t.id !== body.id);
        } else if (body.action === 'update') {
          const item = manualTodos.find(t => t.id === body.id);
          if (item) {
            if (typeof body.status === 'string') item.status = body.status;
            if (typeof body.content === 'string') item.content = body.content;
          }
        } else if (body.content && body.content.trim()) {
          const newTodo = {
            id: 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            content: body.content.trim(),
            status: 'pending',
            createdAt: new Date().toISOString(),
          };
          manualTodos.unshift(newTodo);
        }
        saveManualTodos(manualTodos);
        sendJson(res, 200, { success: true, todos: manualTodos });
      } else {
        res.statusCode = 405;
        res.end();
      }
    },
  }), 'daily-summary: /dsh-daily-summary/manual-todos');

  // 配置保存与读取接口
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-daily-summary/config',
    handler: async (req, res) => {
      if (req.method === 'GET') {
        sendJson(res, 200, { success: true, config: userConfig });
      } else if (req.method === 'POST') {
        const body = await parseBody(req);
        if (body.pushTime && /^([01]\d|2[0-3]):([0-5]\d)$/.test(body.pushTime)) {
          userConfig.pushTime = body.pushTime;
        }
        if (typeof body.autoPop === 'boolean') {
          userConfig.autoPop = body.autoPop;
        }
        if (typeof body.contentOptions === 'object' && body.contentOptions !== null) {
          userConfig.contentOptions = {
            quote: Boolean(body.contentOptions.quote),
            summary: Boolean(body.contentOptions.summary),
            todos: Boolean(body.contentOptions.todos),
          };
        }
        saveConfig(userConfig);
        scheduleNext();
        sendJson(res, 200, { success: true, config: userConfig });
      } else {
        res.statusCode = 405;
        res.end();
      }
    },
  }), 'daily-summary: /dsh-daily-summary/config');

  // 手动触发扫描
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-daily-summary/trigger',
    handler: async (req, res) => {
      if (req.method === 'POST') {
        const body = await parseBody(req);
        const result = await generateSummary(body.forceYesterday !== false);
        hasUnread = true;
        sendJson(res, 200, { success: true, summary: result });
      } else {
        res.statusCode = 405;
        res.end();
      }
    },
  }), 'daily-summary: POST /dsh-daily-summary/trigger');

  return () => {
    if (schedulerTimer) clearTimeout(schedulerTimer);
  };
}
