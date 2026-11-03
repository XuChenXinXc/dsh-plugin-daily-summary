/**
 * @deepseek-ai/dsh-plugin-daily-summary - Client script
 * 随时可打开、关闭、配置推送时间及内容勾选项的 Toast 与常驻悬浮入口
 * 支持用户手动记录待办（持续提醒）与昨日自动提炼待办（标注仅供参考）
 * 精准定时推送到达唤醒、防滚动条跳顶、优雅微质感 UI/UX
 */

function initDailySummary() {
  if (typeof document === 'undefined') return;
  if (window.__DSH_DAILY_SUMMARY_INITIALIZED__) return;
  window.__DSH_DAILY_SUMMARY_INITIALIZED__ = true;

  const ROOT_ID = 'dsh-daily-summary-root';
  const STYLE_ID = 'dsh-daily-summary-style';

  // 避免重复初始化
  if (document.getElementById(ROOT_ID)) {
    return;
  }

  // 状态中心
  const state = {
    isOpen: false,
    showSettings: false,
    loading: false,
    data: null,
    manualTodos: [],
    config: {
      pushTime: '09:00',
      autoPop: true,
      contentOptions: {
        quote: true,
        summary: true,
        todos: true,
      },
    },
    hasUnread: false,
    copied: false,
    justOpened: false,
    lastPushedMinute: '',
  };

  // 注入样式
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID} {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
        user-select: none;
        pointer-events: none;
        -webkit-font-smoothing: antialiased;
      }

      .hidden {
        display: none !important;
      }

      /* 常驻悬浮打开按钮 (FAB) */
      .dsh-ds-fab {
        pointer-events: auto;
        width: 50px;
        height: 50px;
        border-radius: 16px;
        background: linear-gradient(135deg, #2f81f7 0%, #1f6feb 100%);
        color: #ffffff;
        box-shadow: 0 10px 28px -4px rgba(31, 111, 235, 0.45), 0 4px 12px rgba(0, 0, 0, 0.25);
        border: 1px solid rgba(255, 255, 255, 0.25);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease;
        position: relative;
        margin-left: auto;
      }

      .dsh-ds-fab:hover {
        transform: translateY(-2px) scale(1.05);
        box-shadow: 0 14px 32px -4px rgba(31, 111, 235, 0.6), 0 6px 16px rgba(0, 0, 0, 0.3);
      }

      .dsh-ds-fab:active {
        transform: translateY(0) scale(0.96);
      }

      .dsh-ds-fab-dot {
        position: absolute;
        top: -3px;
        right: -3px;
        width: 13px;
        height: 13px;
        border-radius: 50%;
        background: #f85149;
        border: 2px solid #161b22;
        box-shadow: 0 0 10px rgba(248, 81, 73, 0.8);
        animation: dsh-ds-pulse 2s infinite ease-in-out;
      }

      @keyframes dsh-ds-pulse {
        0%, 100% { transform: scale(1); opacity: 0.95; }
        50% { transform: scale(1.25); opacity: 1; }
      }

      /* 弹窗卡片 (Glassmorphism 玻璃拟态与平滑层次) */
      .dsh-ds-card {
        pointer-events: auto;
        width: 480px;
        max-width: calc(100vw - 40px);
        max-height: 86vh;
        background: rgba(22, 27, 34, 0.94);
        backdrop-filter: blur(24px) saturate(180%);
        -webkit-backdrop-filter: blur(24px) saturate(180%);
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 18px;
        box-shadow: 0 24px 60px -8px rgba(0, 0, 0, 0.65), 0 0 1px 1px rgba(255, 255, 255, 0.08);
        display: flex;
        flex-direction: column;
        color: #e6edf3;
        overflow: hidden;
        margin-bottom: 14px;
        transform-origin: bottom right;
      }

      .dsh-ds-card.anim-pop {
        animation: dsh-ds-pop 0.32s cubic-bezier(0.16, 1.25, 0.3, 1);
      }

      @keyframes dsh-ds-pop {
        0% { transform: scale(0.88) translateY(18px); opacity: 0; }
        100% { transform: scale(1) translateY(0); opacity: 1; }
      }

      /* 头部 */
      .dsh-ds-header {
        padding: 14px 18px;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.01) 100%);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .dsh-ds-header-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14.5px;
        font-weight: 600;
        letter-spacing: -0.2px;
        color: #ffffff;
      }

      .dsh-ds-badge {
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 20px;
        background: rgba(56, 139, 253, 0.16);
        color: #58a6ff;
        border: 1px solid rgba(56, 139, 253, 0.35);
        font-weight: 500;
        letter-spacing: 0;
      }

      .dsh-ds-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .dsh-ds-btn-icon {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.06);
        color: #8b949e;
        cursor: pointer;
        width: 30px;
        height: 30px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        transition: all 0.18s ease;
      }

      .dsh-ds-btn-icon:hover {
        background: rgba(255, 255, 255, 0.12);
        color: #ffffff;
        border-color: rgba(255, 255, 255, 0.18);
        transform: scale(1.04);
      }

      .dsh-ds-btn-icon.active {
        background: rgba(56, 139, 253, 0.25);
        color: #58a6ff;
        border-color: rgba(56, 139, 253, 0.5);
      }

      /* 设置面板 (折叠式半透明卡片) */
      .dsh-ds-settings-panel {
        background: rgba(13, 17, 23, 0.7);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        padding: 14px 18px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        font-size: 12.5px;
      }

      .dsh-ds-setting-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .dsh-ds-time-input {
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 8px;
        color: #ffffff;
        padding: 5px 10px;
        font-size: 13px;
        font-weight: 500;
        outline: none;
        transition: border-color 0.2s, box-shadow 0.2s;
      }

      .dsh-ds-time-input:focus {
        border-color: #58a6ff;
        box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.25);
      }

      .dsh-ds-options-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
        background: rgba(0, 0, 0, 0.35);
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.08);
      }

      .dsh-ds-checkbox-label {
        display: flex;
        align-items: center;
        gap: 9px;
        cursor: pointer;
        font-size: 12.5px;
        color: #c9d1d9;
        transition: color 0.15s;
      }

      .dsh-ds-checkbox-label:hover {
        color: #ffffff;
      }

      .dsh-ds-checkbox-label input {
        cursor: pointer;
        width: 15px;
        height: 15px;
        accent-color: #1f6feb;
      }

      /* 内容主体 */
      .dsh-ds-body {
        padding: 16px 18px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
        font-size: 13px;
        line-height: 1.55;
        max-height: 62vh;
      }

      /* 滚动条美化 */
      .dsh-ds-body::-webkit-scrollbar {
        width: 6px;
      }
      .dsh-ds-body::-webkit-scrollbar-track {
        background: transparent;
      }
      .dsh-ds-body::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.15);
        border-radius: 6px;
      }
      .dsh-ds-body::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      /* 晨间鼓励语录卡片 (极光渐变风格) */
      .dsh-ds-quote-box {
        background: linear-gradient(135deg, rgba(56, 139, 253, 0.14) 0%, rgba(137, 87, 229, 0.14) 50%, rgba(46, 160, 67, 0.12) 100%);
        border: 1px solid rgba(56, 139, 253, 0.3);
        border-radius: 12px;
        padding: 12px 16px;
        color: #ffffff;
        font-size: 13.5px;
        line-height: 1.6;
        display: flex;
        gap: 10px;
        align-items: flex-start;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      }

      .dsh-ds-quote-icon {
        font-size: 16px;
        line-height: 1;
        filter: drop-shadow(0 2px 4px rgba(255, 215, 0, 0.3));
      }

      /* 统计概览胶囊卡 */
      .dsh-ds-stats-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }

      .dsh-ds-stat-card {
        background: rgba(255, 255, 255, 0.035);
        border: 1px solid rgba(255, 255, 255, 0.07);
        border-radius: 12px;
        padding: 10px 14px;
        display: flex;
        flex-direction: column;
        transition: background 0.2s, border-color 0.2s;
      }

      .dsh-ds-stat-card:hover {
        background: rgba(255, 255, 255, 0.06);
        border-color: rgba(255, 255, 255, 0.12);
      }

      .dsh-ds-stat-label {
        font-size: 11.5px;
        color: #8b949e;
        display: flex;
        align-items: center;
        gap: 5px;
      }

      .dsh-ds-stat-val {
        font-size: 18px;
        font-weight: 700;
        color: #ffffff;
        margin-top: 4px;
        letter-spacing: -0.3px;
      }

      .dsh-ds-section-title {
        font-size: 12px;
        font-weight: 600;
        color: #8b949e;
        letter-spacing: 0.6px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
        text-transform: uppercase;
      }

      /* 会话列表卡片 */
      .dsh-ds-session-item {
        background: rgba(255, 255, 255, 0.025);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 10px;
        padding: 10px 12px;
        margin-bottom: 8px;
        transition: all 0.2s ease;
      }

      .dsh-ds-session-item:hover {
        background: rgba(255, 255, 255, 0.05);
        border-color: rgba(255, 255, 255, 0.12);
        transform: translateX(2px);
      }

      .dsh-ds-session-name {
        font-weight: 600;
        color: #f0f6fc;
        font-size: 13px;
        margin-bottom: 4px;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .dsh-ds-session-desc {
        color: #8b949e;
        font-size: 12px;
        line-height: 1.5;
      }

      /* 手动待办输入区 */
      .dsh-ds-add-todo-box {
        display: flex;
        gap: 8px;
        margin-bottom: 10px;
      }

      .dsh-ds-todo-input {
        flex: 1;
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 9px;
        color: #ffffff;
        padding: 7px 12px;
        font-size: 12.5px;
        outline: none;
        transition: all 0.2s ease;
      }

      .dsh-ds-todo-input:focus {
        border-color: #2f81f7;
        box-shadow: 0 0 0 3px rgba(47, 129, 247, 0.25);
        background: rgba(0, 0, 0, 0.55);
      }

      /* 徽标设计 */
      .dsh-ds-tag-manual {
        font-size: 10.5px;
        padding: 2px 7px;
        border-radius: 6px;
        background: rgba(46, 160, 67, 0.15);
        color: #3fb950;
        border: 1px solid rgba(46, 160, 67, 0.35);
        font-weight: 600;
      }

      .dsh-ds-tag-auto {
        font-size: 10.5px;
        padding: 2px 7px;
        border-radius: 6px;
        background: rgba(210, 153, 34, 0.15);
        color: #e3b341;
        border: 1px solid rgba(210, 153, 34, 0.35);
        font-weight: 600;
      }

      /* TODO 项卡片 */
      .dsh-ds-todo-item {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.025);
        border-radius: 9px;
        margin-bottom: 6px;
        border: 1px solid rgba(255, 255, 255, 0.05);
        transition: all 0.18s ease;
      }

      .dsh-ds-todo-item:hover {
        background: rgba(255, 255, 255, 0.045);
        border-color: rgba(255, 255, 255, 0.1);
      }

      .dsh-ds-todo-item.manual-item {
        border-left: 3.5px solid #2ea043;
      }

      .dsh-ds-todo-item.auto-item {
        border-left: 3.5px solid #d29922;
      }

      .dsh-ds-todo-item.completed {
        opacity: 0.5;
      }

      .dsh-ds-todo-item.completed .dsh-ds-todo-title {
        text-decoration: line-through;
        color: #8b949e;
      }

      .dsh-ds-todo-item input[type="checkbox"] {
        cursor: pointer;
        margin-top: 3.5px;
        width: 15px;
        height: 15px;
        accent-color: #2ea043;
      }

      .dsh-ds-todo-content {
        flex: 1;
        word-break: break-word;
      }

      .dsh-ds-todo-title {
        font-size: 12.5px;
        color: #e6edf3;
        font-weight: 500;
        line-height: 1.45;
        transition: color 0.15s;
      }

      .dsh-ds-todo-meta {
        font-size: 11px;
        color: #8b949e;
        margin-top: 3px;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .dsh-ds-todo-del {
        background: transparent;
        border: none;
        color: #8b949e;
        cursor: pointer;
        font-size: 13px;
        padding: 2px 6px;
        border-radius: 6px;
        opacity: 0.5;
        transition: all 0.15s ease;
      }

      .dsh-ds-todo-del:hover {
        opacity: 1;
        color: #f85149;
        background: rgba(248, 81, 73, 0.15);
      }

      /* 底部操作条 */
      .dsh-ds-footer {
        padding: 12px 18px;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.01) 0%, rgba(255, 255, 255, 0.04) 100%);
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .dsh-ds-btn {
        padding: 6px 14px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        background: rgba(255, 255, 255, 0.06);
        color: #e6edf3;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .dsh-ds-btn:hover {
        background: rgba(255, 255, 255, 0.12);
        border-color: rgba(255, 255, 255, 0.22);
      }

      .dsh-ds-btn:active {
        transform: scale(0.97);
      }

      .dsh-ds-btn-primary {
        background: linear-gradient(135deg, #2f81f7 0%, #1f6feb 100%);
        border-color: rgba(255, 255, 255, 0.2);
        color: #ffffff;
        box-shadow: 0 4px 12px rgba(31, 111, 235, 0.35);
      }

      .dsh-ds-btn-primary:hover {
        background: linear-gradient(135deg, #388bfd 0%, #2f81f7 100%);
        box-shadow: 0 6px 16px rgba(31, 111, 235, 0.5);
      }

      /* 转为我的待办 按钮 */
      .dsh-ds-btn-convert {
        font-size: 10.5px;
        padding: 2px 7px;
        border-radius: 6px;
        background: rgba(46, 160, 67, 0.12);
        color: #3fb950;
        border: 1px solid rgba(46, 160, 67, 0.3);
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .dsh-ds-btn-convert:hover {
        background: rgba(46, 160, 67, 0.22);
        border-color: rgba(46, 160, 67, 0.5);
      }
    `;
    document.head.appendChild(style);
  }

  // 更新总计数统计展示
  function updateCounters() {
    const pendingManualCount = state.manualTodos.filter(t => t.status !== 'completed').length;
    const pendingAutoCount = (state.data?.todos || []).filter(t => t.status !== 'completed').length;
    const totalPendingCount = pendingManualCount + pendingAutoCount;

    const totalEl = document.getElementById('dsh-ds-stat-total-todos');
    if (totalEl) totalEl.textContent = `${totalPendingCount} 项未完成`;

    const manualPendingEl = document.getElementById('dsh-ds-manual-pending-count');
    if (manualPendingEl) manualPendingEl.textContent = `${pendingManualCount} 待完成`;

    const autoPendingEl = document.getElementById('dsh-ds-auto-pending-count');
    if (autoPendingEl) autoPendingEl.textContent = `${pendingAutoCount} 项`;
  }

  // 渲染 DOM
  function render() {
    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement('div');
      root.id = ROOT_ID;
      document.body.appendChild(root);
    }

    const oldBody = root.querySelector('.dsh-ds-body');
    const savedScrollTop = oldBody ? oldBody.scrollTop : 0;

    const { isOpen, showSettings, loading, data, manualTodos, config, hasUnread, copied, justOpened } = state;
    const opts = config.contentOptions || { quote: true, summary: true, todos: true };
    const sessions = data?.sessions || [];
    const autoTodos = data?.todos || [];

    const pendingManualCount = manualTodos.filter(t => t.status !== 'completed').length;
    const pendingAutoCount = autoTodos.filter(t => t.status !== 'completed').length;
    const totalPendingCount = pendingManualCount + pendingAutoCount;

    root.innerHTML = `
      <!-- 弹窗卡片 -->
      <div class="dsh-ds-card ${isOpen ? '' : 'hidden'} ${justOpened ? 'anim-pop' : ''}" id="dsh-ds-card-box">
        <!-- 头部 -->
        <div class="dsh-ds-header">
          <div class="dsh-ds-header-title">
            <span>📋 昨日回顾与今日待办</span>
            ${data?.date ? `<span class="dsh-ds-badge">${data.date}</span>` : ''}
          </div>
          <div class="dsh-ds-actions">
            <button class="dsh-ds-btn-icon ${showSettings ? 'active' : ''}" id="dsh-ds-btn-settings" title="配置每日推送时间与内容模块">⚙️</button>
            <button class="dsh-ds-btn-icon" id="dsh-ds-btn-close" title="收起/关闭">—</button>
          </div>
        </div>

        <!-- 设置面板 -->
        <div class="dsh-ds-settings-panel" id="dsh-ds-settings-box" style="display: ${showSettings ? 'flex' : 'none'};">
          <div class="dsh-ds-setting-row">
            <span style="font-weight: 500;">每日定时推送时刻：</span>
            <input type="time" class="dsh-ds-time-input" id="dsh-ds-input-time" value="${config.pushTime || '09:00'}">
          </div>
          <div class="dsh-ds-setting-row">
            <span>到达指定时刻自动弹出：</span>
            <input type="checkbox" id="dsh-ds-input-autopop" ${config.autoPop !== false ? 'checked' : ''}>
          </div>
          <div style="font-size: 11.5px; color: #8b949e; margin-top: 4px;">
            推送内容模块多选（勾选哪几项就展示哪几项）：
          </div>
          <div class="dsh-ds-options-group">
            <label class="dsh-ds-checkbox-label">
              <input type="checkbox" id="dsh-ds-opt-quote" ${opts.quote ? 'checked' : ''}>
              <span>🌟 晨间鼓励/励志箴言</span>
            </label>
            <label class="dsh-ds-checkbox-label">
              <input type="checkbox" id="dsh-ds-opt-summary" ${opts.summary ? 'checked' : ''}>
              <span>💬 昨日核心会话与互动总结</span>
            </label>
            <label class="dsh-ds-checkbox-label">
              <input type="checkbox" id="dsh-ds-opt-todos" ${opts.todos ? 'checked' : ''}>
              <span>📋 待办事项（我的备忘 + AI提炼仅供参考）</span>
            </label>
          </div>
        </div>

        <!-- 内容主体 -->
        <div class="dsh-ds-body">
          <!-- 鼓励语录 -->
          ${opts.quote && data?.quote ? `
            <div class="dsh-ds-quote-box">
              <span class="dsh-ds-quote-icon">✨</span>
              <span>${data.quote}</span>
            </div>
          ` : ''}

          <!-- 统计概览 -->
          ${(opts.summary || opts.todos) ? `
            <div class="dsh-ds-stats-row">
              ${opts.summary ? `
                <div class="dsh-ds-stat-card">
                  <span class="dsh-ds-stat-label">💬 昨日探索会话</span>
                  <span class="dsh-ds-stat-val">${data?.sessionCount || 0} 个</span>
                </div>
              ` : ''}
              ${opts.todos ? `
                <div class="dsh-ds-stat-card">
                  <span class="dsh-ds-stat-label">📌 待完成任务总计</span>
                  <span class="dsh-ds-stat-val" id="dsh-ds-stat-total-todos" style="color: #58a6ff;">${totalPendingCount} 项未完成</span>
                </div>
              ` : ''}
            </div>
          ` : ''}

          <!-- 昨日对话总结 -->
          ${opts.summary ? `
            <div>
              <div class="dsh-ds-section-title">昨日对话要点提炼</div>
              ${sessions.length === 0 ? `
                <div style="color: #8b949e; font-size: 12px; padding: 6px 0;">昨日暂无活跃对话记录。</div>
              ` : sessions.map(s => `
                <div class="dsh-ds-session-item">
                  <div class="dsh-ds-session-name">
                    <span>💬</span>
                    <span>${s.title}</span>
                  </div>
                  <div class="dsh-ds-session-desc">${s.summary}</div>
                </div>
              `).join('')}
            </div>
          ` : ''}

          <!-- 待办清单 -->
          ${opts.todos ? `
            <div>
              <div class="dsh-ds-section-title">
                <span>待办事项清单</span>
                ${(manualTodos.length > 0 || autoTodos.length > 0) ? `
                  <button class="dsh-ds-btn" id="dsh-ds-btn-copy" style="font-size: 11px; padding: 2px 8px;">
                    ${copied ? '✓ 已复制！' : '复制全部未完成待办'}
                  </button>
                ` : ''}
              </div>

              <!-- 手动记录待办输入区 -->
              <div class="dsh-ds-add-todo-box">
                <input type="text" class="dsh-ds-todo-input" id="dsh-ds-new-todo-input" placeholder="输入待办事项，按回车直接保存...">
                <button class="dsh-ds-btn dsh-ds-btn-primary" id="dsh-ds-btn-add-todo" style="padding: 6px 12px;">添加</button>
              </div>

              <!-- 1. 我的手动待办清单 (持续提醒) -->
              <div style="margin-top: 10px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                  <span style="font-size: 11.5px; font-weight: 600; color: #3fb950; display: flex; align-items: center; gap: 6px;">
                    <span>📌 我的备忘待办</span>
                    <span class="dsh-ds-tag-manual">重要 · 跨天保留</span>
                  </span>
                  <span style="font-size: 11px; color: #8b949e;" id="dsh-ds-manual-pending-count">${pendingManualCount} 待完成</span>
                </div>
                <div id="dsh-ds-manual-todos-list">
                  ${manualTodos.length === 0 ? `
                    <div id="dsh-ds-manual-empty-tip" style="color: #8b949e; font-size: 12px; padding: 6px 8px;">
                      暂无手动待办，可在上方输入框快速添加。
                    </div>
                  ` : manualTodos.map((t) => `
                    <div class="dsh-ds-todo-item manual-item ${t.status === 'completed' ? 'completed' : ''}" id="dsh-todo-item-${t.id}">
                      <input type="checkbox" data-manual-id="${t.id}" ${t.status === 'completed' ? 'checked' : ''}>
                      <div class="dsh-ds-todo-content">
                        <div class="dsh-ds-todo-title">${t.content}</div>
                        <div class="dsh-ds-todo-meta">
                          <span>自定待办</span>
                          ${t.createdAt ? `<span>· ${t.createdAt.slice(0, 10)}</span>` : ''}
                        </div>
                      </div>
                      <button class="dsh-ds-todo-del" data-del-manual-id="${t.id}" title="删除此项">✕</button>
                    </div>
                  `).join('')}
                </div>
              </div>

              <!-- 2. 昨日会话自动提炼待办 (标注仅供参考) -->
              <div style="margin-top: 14px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                  <span style="font-size: 11.5px; font-weight: 600; color: #e3b341; display: flex; align-items: center; gap: 6px;">
                    <span>🤖 昨日会话提炼待办</span>
                    <span class="dsh-ds-tag-auto">AI提炼 · 仅供参考</span>
                  </span>
                  <span style="font-size: 11px; color: #8b949e;" id="dsh-ds-auto-pending-count">${pendingAutoCount} 项</span>
                </div>
                ${autoTodos.length === 0 ? `
                  <div style="color: #8b949e; font-size: 12px; padding: 6px 8px;">
                    昨日对话中未提炼出待办。
                  </div>
                ` : autoTodos.map((t, idx) => `
                  <div class="dsh-ds-todo-item auto-item ${t.status === 'completed' ? 'completed' : ''}" id="dsh-auto-todo-${idx}">
                    <input type="checkbox" data-auto-idx="${idx}" ${t.status === 'completed' ? 'checked' : ''}>
                    <div class="dsh-ds-todo-content">
                      <div class="dsh-ds-todo-title">${t.content}</div>
                      <div class="dsh-ds-todo-meta">
                        <span>来自: ${t.sessionTitle}</span>
                        <button class="dsh-ds-btn-convert" data-convert-idx="${idx}">
                          ➕ 转为我的待办
                        </button>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          ${(!opts.quote && !opts.summary && !opts.todos) ? `
            <div style="text-align: center; color: #8b949e; padding: 24px 0;">
              未勾选任何推送内容项，请在右上角设置中开启。
            </div>
          ` : ''}
        </div>

        <!-- 底部操作区 -->
        <div class="dsh-ds-footer">
          <button class="dsh-ds-btn" id="dsh-ds-btn-rescan" ${loading ? 'disabled' : ''}>
            ${loading ? '正在分析...' : '🔄 重新扫描昨日'}
          </button>
          <button class="dsh-ds-btn dsh-ds-btn-primary" id="dsh-ds-btn-done">我知道了</button>
        </div>
      </div>

      <!-- 常驻悬浮打开按钮 (FAB) -->
      <div class="dsh-ds-fab" id="dsh-ds-fab" title="点击随时打开昨日回顾与今日待办">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
          <path d="m9 16 2 2 4-4"></path>
        </svg>
        ${hasUnread && !isOpen ? '<div class="dsh-ds-fab-dot"></div>' : ''}
      </div>
    `;

    bindEvents();

    if (state.justOpened) {
      setTimeout(() => {
        state.justOpened = false;
        const cardBox = document.getElementById('dsh-ds-card-box');
        if (cardBox) cardBox.classList.remove('anim-pop');
      }, 350);
    }

    const newBody = root.querySelector('.dsh-ds-body');
    if (newBody && savedScrollTop > 0) {
      newBody.scrollTop = savedScrollTop;
    }
  }

  // 绑定事件
  function bindEvents() {
    const fab = document.getElementById('dsh-ds-fab');
    if (fab) {
      fab.onclick = () => {
        const willOpen = !state.isOpen;
        state.isOpen = willOpen;
        if (willOpen) {
          state.justOpened = true;
          markAsRead();
        }
        render();
      };
    }

    const closeBtn = document.getElementById('dsh-ds-btn-close');
    if (closeBtn) {
      closeBtn.onclick = () => {
        state.isOpen = false;
        render();
      };
    }

    const doneBtn = document.getElementById('dsh-ds-btn-done');
    if (doneBtn) {
      doneBtn.onclick = () => {
        state.isOpen = false;
        markAsRead();
        render();
      };
    }

    const settingsBtn = document.getElementById('dsh-ds-btn-settings');
    const settingsPanel = document.getElementById('dsh-ds-settings-box');
    if (settingsBtn && settingsPanel) {
      settingsBtn.onclick = () => {
        state.showSettings = !state.showSettings;
        settingsPanel.style.display = state.showSettings ? 'flex' : 'none';
        settingsBtn.classList.toggle('active', state.showSettings);
      };
    }

    const timeInput = document.getElementById('dsh-ds-input-time');
    if (timeInput) {
      timeInput.onchange = () => {
        state.config.pushTime = timeInput.value;
        state.lastPushedMinute = ''; // 重置防重，允许新时间生效
        saveConfig();
      };
    }

    const autoPopInput = document.getElementById('dsh-ds-input-autopop');
    if (autoPopInput) {
      autoPopInput.onchange = () => {
        state.config.autoPop = autoPopInput.checked;
        saveConfig();
      };
    }

    const optQuote = document.getElementById('dsh-ds-opt-quote');
    const optSummary = document.getElementById('dsh-ds-opt-summary');
    const optTodos = document.getElementById('dsh-ds-opt-todos');

    const handleOptChange = () => {
      state.config.contentOptions = {
        quote: optQuote ? optQuote.checked : true,
        summary: optSummary ? optSummary.checked : true,
        todos: optTodos ? optTodos.checked : true,
      };
      saveConfig();
      render();
    };

    if (optQuote) optQuote.onchange = handleOptChange;
    if (optSummary) optSummary.onchange = handleOptChange;
    if (optTodos) optTodos.onchange = handleOptChange;

    // 手动待办添加
    const newTodoInput = document.getElementById('dsh-ds-new-todo-input');
    const addTodoBtn = document.getElementById('dsh-ds-btn-add-todo');

    const submitNewTodo = async () => {
      if (!newTodoInput) return;
      const text = newTodoInput.value.trim();
      if (!text) return;
      newTodoInput.value = '';
      newTodoInput.focus();

      const tempId = 'm_' + Date.now();
      const newTodo = {
        id: tempId,
        content: text,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      state.manualTodos.unshift(newTodo);

      const listEl = document.getElementById('dsh-ds-manual-todos-list');
      const emptyTip = document.getElementById('dsh-ds-manual-empty-tip');
      if (emptyTip) emptyTip.remove();

      if (listEl) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'dsh-ds-todo-item manual-item';
        itemDiv.id = `dsh-todo-item-${tempId}`;
        itemDiv.innerHTML = `
          <input type="checkbox" data-manual-id="${tempId}">
          <div class="dsh-ds-todo-content">
            <div class="dsh-ds-todo-title">${text}</div>
            <div class="dsh-ds-todo-meta">
              <span>自定待办</span>
              <span>· ${newTodo.createdAt.slice(0, 10)}</span>
            </div>
          </div>
          <button class="dsh-ds-todo-del" data-del-manual-id="${tempId}" title="删除此项">✕</button>
        `;
        listEl.prepend(itemDiv);
        bindTodoItemEvents(itemDiv, tempId);
      }

      updateCounters();

      try {
        const res = await fetch('/dsh-daily-summary/manual-todos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: text }),
        });
        const json = await res.json();
        if (json.success && json.todos) {
          state.manualTodos = json.todos;
        }
      } catch (e) {
        console.error(e);
      }
    };

    if (addTodoBtn) addTodoBtn.onclick = submitNewTodo;
    if (newTodoInput) {
      newTodoInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitNewTodo();
        }
      };
    }

    function bindTodoItemEvents(itemEl, id) {
      const cb = itemEl.querySelector('input[type="checkbox"]');
      if (cb) {
        cb.onchange = async () => {
          const isDone = cb.checked;
          itemEl.classList.toggle('completed', isDone);
          const target = state.manualTodos.find(t => t.id === id);
          if (target) target.status = isDone ? 'completed' : 'pending';
          updateCounters();
          try {
            await fetch('/dsh-daily-summary/manual-todos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'update', id, status: isDone ? 'completed' : 'pending' }),
            });
          } catch (e) {
            console.error(e);
          }
        };
      }

      const delBtn = itemEl.querySelector('button.dsh-ds-todo-del');
      if (delBtn) {
        delBtn.onclick = async () => {
          itemEl.remove();
          state.manualTodos = state.manualTodos.filter(t => t.id !== id);
          updateCounters();
          try {
            await fetch('/dsh-daily-summary/manual-todos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'delete', id }),
            });
          } catch (e) {
            console.error(e);
          }
        };
      }
    }

    state.manualTodos.forEach(t => {
      const el = document.getElementById(`dsh-todo-item-${t.id}`);
      if (el) bindTodoItemEvents(el, t.id);
    });

    const autoCheckboxes = document.querySelectorAll('input[data-auto-idx]');
    autoCheckboxes.forEach((cb) => {
      cb.onchange = () => {
        const idx = parseInt(cb.getAttribute('data-auto-idx'), 10);
        const item = state.data?.todos?.[idx];
        if (item) {
          item.status = cb.checked ? 'completed' : 'pending';
          const cardEl = document.getElementById(`dsh-auto-todo-${idx}`);
          if (cardEl) cardEl.classList.toggle('completed', cb.checked);
          updateCounters();
        }
      };
    });

    const convertBtns = document.querySelectorAll('button[data-convert-idx]');
    convertBtns.forEach((btn) => {
      btn.onclick = async () => {
        const idx = parseInt(btn.getAttribute('data-convert-idx'), 10);
        const item = state.data?.todos?.[idx];
        if (!item) return;

        btn.disabled = true;
        btn.textContent = '✓ 已转为我的待办';

        const tempId = 'm_' + Date.now();
        const newTodo = {
          id: tempId,
          content: item.content,
          status: 'pending',
          createdAt: new Date().toISOString(),
        };
        state.manualTodos.unshift(newTodo);

        const listEl = document.getElementById('dsh-ds-manual-todos-list');
        const emptyTip = document.getElementById('dsh-ds-manual-empty-tip');
        if (emptyTip) emptyTip.remove();

        if (listEl) {
          const itemDiv = document.createElement('div');
          itemDiv.className = 'dsh-ds-todo-item manual-item';
          itemDiv.id = `dsh-todo-item-${tempId}`;
          itemDiv.innerHTML = `
            <input type="checkbox" data-manual-id="${tempId}">
            <div class="dsh-ds-todo-content">
              <div class="dsh-ds-todo-title">${item.content}</div>
              <div class="dsh-ds-todo-meta">
                <span>自定待办</span>
                <span>· ${newTodo.createdAt.slice(0, 10)}</span>
              </div>
            </div>
            <button class="dsh-ds-todo-del" data-del-manual-id="${tempId}" title="删除此项">✕</button>
          `;
          listEl.prepend(itemDiv);
          bindTodoItemEvents(itemDiv, tempId);
        }

        updateCounters();

        try {
          const res = await fetch('/dsh-daily-summary/manual-todos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: item.content }),
          });
          const json = await res.json();
          if (json.success && json.todos) {
            state.manualTodos = json.todos;
          }
        } catch (e) {
          console.error(e);
        }
      };
    });

    const copyBtn = document.getElementById('dsh-ds-btn-copy');
    if (copyBtn) {
      copyBtn.onclick = () => {
        const pendingManual = (state.manualTodos || []).filter(t => t.status !== 'completed');
        const pendingAuto = (state.data?.todos || []).filter(t => t.status !== 'completed');

        const lines = [];
        if (pendingManual.length > 0) {
          lines.push('【📌 我的备忘待办】');
          pendingManual.forEach(t => lines.push(`- [ ] ${t.content}`));
        }
        if (pendingAuto.length > 0) {
          lines.push('\n【🤖 昨日会话提炼待办 (仅供参考)】');
          pendingAuto.forEach(t => lines.push(`- [ ] ${t.content} (来自: ${t.sessionTitle})`));
        }

        if (lines.length === 0) return;
        navigator.clipboard.writeText(lines.join('\n'));
        copyBtn.textContent = '✓ 已复制！';
        setTimeout(() => {
          copyBtn.textContent = '复制全部未完成待办';
        }, 2000);
      };
    }

    const rescanBtn = document.getElementById('dsh-ds-btn-rescan');
    if (rescanBtn) {
      rescanBtn.onclick = async () => {
        state.loading = true;
        rescanBtn.disabled = true;
        rescanBtn.textContent = '正在分析...';
        try {
          const res = await fetch('/dsh-daily-summary/trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ forceYesterday: true }),
          });
          const json = await res.json();
          if (json.success && json.summary) {
            state.data = json.summary;
            state.hasUnread = true;
          }
        } catch (e) {
          console.error(e);
        } finally {
          state.loading = false;
          render();
        }
      };
    }
  }

  // 触发定时推送主动弹出
  async function triggerDailyPushPop() {
    if (state.isOpen) return;
    state.hasUnread = true;
    state.isOpen = true;
    state.justOpened = true;
    render();
    try {
      const res = await fetch('/dsh-daily-summary/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceYesterday: true }),
      });
      const json = await res.json();
      if (json.success && json.summary) {
        state.data = json.summary;
        render();
      }
    } catch {}
  }

  // 检查当前系统时间是否命中 pushTime
  function checkPushTimer() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const currentHHmm = `${hh}:${mm}`;

    const targetTime = state.config.pushTime || '09:00';
    if (currentHHmm === targetTime) {
      if (state.lastPushedMinute !== currentHHmm) {
        state.lastPushedMinute = currentHHmm;
        if (state.config.autoPop !== false) {
          triggerDailyPushPop();
        }
      }
    }
  }

  // 获取数据
  async function loadData() {
    try {
      const res = await fetch('/dsh-daily-summary');
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) {
        state.data = json.summary;
        if (Array.isArray(json.manualTodos)) {
          state.manualTodos = json.manualTodos;
        }
        if (json.config) {
          state.config = {
            ...json.config,
            contentOptions: {
              quote: true,
              summary: true,
              todos: true,
              ...(json.config.contentOptions || {}),
            },
          };
        }
        state.hasUnread = Boolean(json.hasUnread);

        if (state.config.autoPop && state.hasUnread && !state.isOpen) {
          state.isOpen = true;
          state.justOpened = true;
        }

        render();
      }
    } catch (e) {
      console.warn('[daily-summary] fetch failed:', e);
    }
  }

  // 保存配置
  async function saveConfig() {
    try {
      await fetch('/dsh-daily-summary/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state.config),
      });
    } catch (e) {
      console.error(e);
    }
  }

  // 标记已读
  async function markAsRead() {
    state.hasUnread = false;
    try {
      await fetch('/dsh-daily-summary/read', { method: 'POST' });
    } catch {}
  }

  // 暴露全局切换函数
  window.toggleDailySummary = function (forceOpen) {
    const willOpen = typeof forceOpen === 'boolean' ? forceOpen : !state.isOpen;
    state.isOpen = willOpen;
    if (willOpen) {
      state.justOpened = true;
    }
    render();
  };

  // 启动
  injectStyles();
  loadData();
  render();

  // 每 3 秒比对一次系统时间，确保定时到达时 100% 毫秒级主动唤醒
  setInterval(checkPushTimer, 3000);

  // 每 30 秒后台静默同步一次数据
  setInterval(loadData, 30 * 1000);
}

// 注册 Cordis / DSH ModuleLoader
if (typeof window !== 'undefined' && window.__ModuleLoader__ && typeof window.__ModuleLoader__.load === 'function') {
  window.__ModuleLoader__.load({
    id: 'dsh-plugin-daily-summary',
    factory: function () {
      initDailySummary();
      return {
        apply: function (ctx) {
          initDailySummary();
        },
      };
    },
  });
}

// 保证直接执行
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDailySummary);
  } else {
    initDailySummary();
  }
}
