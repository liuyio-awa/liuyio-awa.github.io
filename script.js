// ================================================================
//  script.js  —  GitHub JSON 留言板 全部逻辑
//  依赖：Octokit, marked, KaTeX (已在 index.html 中加载)
// ================================================================

(function() {
    'use strict';

    // ----- DOM 引用 -----
    const messageList = document.getElementById('messageList');
    const nickInput = document.getElementById('nickInput');
    const msgInput = document.getElementById('msgInput');
    const sendBtn = document.getElementById('sendBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const configBtn = document.getElementById('configBtn');
    const configModal = document.getElementById('configModal');
    const tokenInput = document.getElementById('tokenInput');
    const defaultNickInput = document.getElementById('defaultNickInput');
    const modalSave = document.getElementById('modalSave');
    const modalCancel = document.getElementById('modalCancel');
    const searchInput = document.getElementById('searchInput');
    const clearSearch = document.getElementById('clearSearch');
    const pinCheckbox = document.getElementById('pinCheckbox');
    const announceBar = document.getElementById('announceBar');
    const announceContent = document.getElementById('announceContent');
    const closeAnnounce = document.getElementById('closeAnnounce');

    // ----- 固定配置（改成你自己的仓库） -----
    const OWNER = 'liuyio-awa';
    const REPO = 'liuyio-awa.github.io';
    const PATH = 'posts.json';
    const BRANCH = 'main';

    // ----- 状态 -----
    let token = '';
    let allMessages = [];
    let pollingTimer = null;

    // ----- 工具：UTF-8 安全 Base64 -----
    function utf8ToBase64(str) {
        return btoa(unescape(encodeURIComponent(str)));
    }

    function base64ToUtf8(base64) {
        return decodeURIComponent(escape(atob(base64)));
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function generateId() {
        return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    }

    function formatTime(iso) {
        try {
            const d = new Date(iso);
            return d.toLocaleString('zh-CN', { hour12: false });
        } catch (_) {
            return iso;
        }
    }

    function getColor(name) {
        let h = 0;
        for (let i = 0; i < name.length; i++) {
            h = name.charCodeAt(i) + ((h << 5) - h);
        }
        const colors = [
            '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
            '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50',
            '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'
        ];
        return colors[Math.abs(h) % colors.length];
    }

    // ----- 核心：读取 posts.json -----
    async function fetchMessages() {
        if (!token) {
            messageList.innerHTML = `<div class="empty-state">⚠️ 请先点击「配置」设置 GitHub Token</div>`;
            return [];
        }
        try {
            const octokit = new Octokit({ auth: token });
            let resp;
            try {
                resp = await octokit.rest.repos.getContent({
                    owner: OWNER,
                    repo: REPO,
                    path: PATH,
                    ref: BRANCH
                });
            } catch (err) {
                if (err.status === 404) {
                    // 自动初始化空文件
                    await octokit.rest.repos.createOrUpdateFileContents({
                        owner: OWNER,
                        repo: REPO,
                        path: PATH,
                        message: '初始化留言板',
                        content: utf8ToBase64('[]'),
                        branch: BRANCH
                    });
                    resp = await octokit.rest.repos.getContent({
                        owner: OWNER,
                        repo: REPO,
                        path: PATH,
                        ref: BRANCH
                    });
                } else {
                    throw err;
                }
            }
            const raw = base64ToUtf8(resp.data.content);
            return JSON.parse(raw);
        } catch (err) {
            console.error('读取失败:', err);
            if (err.status === 401) {
                messageList.innerHTML = `<div class="empty-state">❌ Token 无效或权限不足，请重新配置</div>`;
            } else {
                messageList.innerHTML = `<div class="empty-state">❌ 读取失败：${escapeHtml(err.message)}</div>`;
            }
            return [];
        }
    }

    // ----- 核心：写入 posts.json -----
    async function saveMessages(messages) {
        if (!token) throw new Error('未配置 Token');
        const octokit = new Octokit({ auth: token });
        let sha;
        try {
            const resp = await octokit.rest.repos.getContent({
                owner: OWNER,
                repo: REPO,
                path: PATH,
                ref: BRANCH
            });
            sha = resp.data.sha;
        } catch (err) {
            if (err.status !== 404) throw err;
        }
        await octokit.rest.repos.createOrUpdateFileContents({
            owner: OWNER,
            repo: REPO,
            path: PATH,
            message: `更新留言 (${messages.length} 条)`,
            content: utf8ToBase64(JSON.stringify(messages, null, 2)),
            branch: BRANCH,
            sha: sha || undefined
        });
    }

    // ----- 渲染（集成 Markdown + KaTeX）-----
    function renderMessages() {
        const container = messageList;
        let filtered = [...allMessages];

        // 搜索过滤
        const keyword = searchInput.value.trim().toLowerCase();
        if (keyword) {
            filtered = filtered.filter(m =>
                m.content.toLowerCase().includes(keyword) ||
                m.nickname.toLowerCase().includes(keyword)
            );
        }

        // 排序：置顶优先，再按时间降序
        filtered.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return new Date(b.timestamp) - new Date(a.timestamp);
        });

        if (filtered.length === 0) {
            container.innerHTML = `<div class="empty-state">📭 暂无消息，发一条吧！</div>`;
            return;
        }

        let html = '';
        filtered.forEach(msg => {
            const avatarLetter = (msg.nickname || '?').charAt(0).toUpperCase();
            const color = getColor(msg.nickname || '匿名');
            const time = formatTime(msg.timestamp);

            // 用 marked 解析 Markdown
            let contentHtml = marked.parse(msg.content || '');

            html += `
                <div class="msg" data-id="${escapeHtml(msg.id)}">
                    <div class="avatar" style="background:${color};">${escapeHtml(avatarLetter)}</div>
                    <div class="bubble">
                        <div class="meta">
                            <span class="author">${escapeHtml(msg.nickname || '匿名')}</span>
                            <span class="time">${escapeHtml(time)}</span>
                            ${msg.isPinned ? '<span class="badge-pin">📌 置顶</span>' : ''}
                        </div>
                        <div class="content">${contentHtml}</div>
                        <div class="actions">
                            <button class="del-btn" data-id="${escapeHtml(msg.id)}">🗑 删除</button>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
        container.scrollTop = 0;

        // ===== KaTeX 自动渲染 LaTeX =====
        if (window.renderMathInElement) {
            try {
                renderMathInElement(container, {
                    delimiters: [
                        { left: '$$', right: '$$', display: true },
                        { left: '\\(', right: '\\)', display: false },
                        { left: '\\[', right: '\\]', display: true }
                    ],
                    throwOnError: false
                });
            } catch (e) {
                console.warn('KaTeX 渲染警告:', e);
            }
        }

        // 绑定删除事件
        container.querySelectorAll('.del-btn').forEach(btn => {
            btn.addEventListener('click', async function(e) {
                const id = this.dataset.id;
                if (!confirm('确定要删除这条消息吗？')) return;
                await deleteMessage(id);
            });
        });

        // 公告栏（最新置顶）
        const pinned = allMessages.filter(m => m.isPinned);
        if (pinned.length > 0) {
            const latestPin = pinned.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
            announceBar.classList.add('show');
            const pinContent = marked.parseInline(latestPin.content);
            announceContent.innerHTML =
                `📌 <strong>${escapeHtml(latestPin.nickname)}</strong>：${pinContent}`;
        } else {
            announceBar.classList.remove('show');
        }
    }

    // ----- 加载 -----
    async function loadMessages() {
        const msgs = await fetchMessages();
        if (msgs) {
            allMessages = msgs;
            renderMessages();
        }
    }

    // ----- 删除 -----
    async function deleteMessage(id) {
        if (!token) return alert('未配置 Token');
        const idx = allMessages.findIndex(m => m.id === id);
        if (idx === -1) return;
        try {
            allMessages.splice(idx, 1);
            await saveMessages(allMessages);
            renderMessages();
        } catch (err) {
            alert('删除失败：' + err.message);
            await loadMessages(); // 回滚
        }
    }

    // ----- 发送 -----
    async function sendMessage() {
        const nickname = nickInput.value.trim() || '匿名';
        const content = msgInput.value.trim();
        if (!content) return alert('请输入消息内容');
        if (!token) return alert('请先配置 Token');

        const newMsg = {
            id: generateId(),
            nickname: nickname,
            content: content,
            timestamp: new Date().toISOString(),
            isPinned: pinCheckbox.checked
        };

        sendBtn.disabled = true;
        try {
            allMessages.push(newMsg);
            await saveMessages(allMessages);
            msgInput.value = '';
            msgInput.style.height = 'auto';
            pinCheckbox.checked = false;
            await loadMessages();
        } catch (err) {
            alert('发送失败：' + err.message);
            await loadMessages();
        } finally {
            sendBtn.disabled = false;
            msgInput.focus();
        }
    }

    // ----- 轮询（每 4 秒刷新）-----
    function startPolling() {
        if (pollingTimer) clearInterval(pollingTimer);
        pollingTimer = setInterval(loadMessages, 4000);
    }

    function stopPolling() {
        if (pollingTimer) {
            clearInterval(pollingTimer);
            pollingTimer = null;
        }
    }

    // ----- 配置弹窗 -----
    function openModal() {
        tokenInput.value = token || '';
        defaultNickInput.value = nickInput.value || '访客';
        configModal.classList.add('active');
    }

    function closeModal() {
        configModal.classList.remove('active');
    }

    function saveConfig() {
        const newToken = tokenInput.value.trim();
        const defaultNick = defaultNickInput.value.trim() || '访客';
        if (!newToken) return alert('请输入 GitHub Token');
        token = newToken;
        nickInput.value = defaultNick;
        localStorage.setItem('chat_json_token', token);
        localStorage.setItem('chat_json_nick', defaultNick);
        closeModal();
        loadMessages();
        startPolling();
    }

    // ----- 初始化（确保依赖已加载）-----
    function initApp() {
        // 检查 Octokit 是否可用
        if (typeof Octokit === 'undefined') {
            console.warn('Octokit 未加载，等待中...');
            setTimeout(initApp, 200);
            return;
        }

        // 从 localStorage 恢复
        const savedToken = localStorage.getItem('chat_json_token');
        const savedNick = localStorage.getItem('chat_json_nick') || '访客';

        if (savedToken) {
            token = savedToken;
            nickInput.value = savedNick;
            loadMessages();
            startPolling();
        } else {
            messageList.innerHTML = `<div class="empty-state">⚙️ 点击「配置」连接你的 GitHub 仓库</div>`;
        }

        // ----- 事件绑定 -----
        sendBtn.addEventListener('click', sendMessage);
        refreshBtn.addEventListener('click', loadMessages);
        configBtn.addEventListener('click', openModal);
        modalCancel.addEventListener('click', closeModal);
        modalSave.addEventListener('click', saveConfig);
        closeAnnounce.addEventListener('click', () => announceBar.classList.remove('show'));

        msgInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        msgInput.addEventListener('input', () => {
            msgInput.style.height = 'auto';
            msgInput.style.height = Math.min(msgInput.scrollHeight, 120) + 'px';
        });

        searchInput.addEventListener('input', renderMessages);
        clearSearch.addEventListener('click', () => {
            searchInput.value = '';
            renderMessages();
        });

        configModal.addEventListener('click', (e) => {
            if (e.target === configModal) closeModal();
        });

        window.addEventListener('beforeunload', stopPolling);
    }

    // 启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }

})();
