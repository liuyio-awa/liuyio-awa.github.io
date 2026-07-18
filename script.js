// ================================================================
//  script.js  —  GitHub JSON 留言板  (修复版)
//  事件绑定不依赖外部库，确保按钮始终响应
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
    let isReady = false;          // 标记依赖是否加载完成

    // ----- 工具函数 (不依赖外部库) -----
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
        } catch (_) { return iso; }
    }
    function getColor(name) {
        let h = 0;
        for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
        const colors = ['#f44336','#e91e63','#9c27b0','#673ab7','#3f51b5','#2196f3','#03a9f4','#00bcd4','#009688','#4caf50','#8bc34a','#cddc39','#ffeb3b','#ffc107','#ff9800','#ff5722'];
        return colors[Math.abs(h) % colors.length];
    }

    // ----- 核心功能（依赖 Octokit，但调用前会检查）-----
    async function fetchMessages() {
        if (!token) {
            messageList.innerHTML = `<div class="empty-state">⚠️ 请先点击「配置」设置 GitHub Token</div>`;
            return [];
        }
        if (typeof Octokit === 'undefined') {
            messageList.innerHTML = `<div class="empty-state">❌ Octokit 库未加载，请检查网络或刷新页面</div>`;
            return [];
        }
        try {
            const octokit = new Octokit({ auth: token });
            let resp;
            try {
                resp = await octokit.rest.repos.getContent({ owner: OWNER, repo: REPO, path: PATH, ref: BRANCH });
            } catch (err) {
                if (err.status === 404) {
                    await octokit.rest.repos.createOrUpdateFileContents({
                        owner: OWNER, repo: REPO, path: PATH,
                        message: '初始化留言板', content: utf8ToBase64('[]'), branch: BRANCH
                    });
                    resp = await octokit.rest.repos.getContent({ owner: OWNER, repo: REPO, path: PATH, ref: BRANCH });
                } else throw err;
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

    async function saveMessages(messages) {
        if (!token) throw new Error('未配置 Token');
        if (typeof Octokit === 'undefined') throw new Error('Octokit 未加载');
        const octokit = new Octokit({ auth: token });
        let sha;
        try {
            const resp = await octokit.rest.repos.getContent({ owner: OWNER, repo: REPO, path: PATH, ref: BRANCH });
            sha = resp.data.sha;
        } catch (err) { if (err.status !== 404) throw err; }
        await octokit.rest.repos.createOrUpdateFileContents({
            owner: OWNER, repo: REPO, path: PATH,
            message: `更新留言 (${messages.length} 条)`,
            content: utf8ToBase64(JSON.stringify(messages, null, 2)),
            branch: BRANCH, sha: sha || undefined
        });
    }

    // ----- 渲染（依赖 marked 和 KaTeX，检查后使用）-----
    function renderMessages() {
        const container = messageList;
        let filtered = [...allMessages];
        const keyword = searchInput.value.trim().toLowerCase();
        if (keyword) {
            filtered = filtered.filter(m =>
                m.content.toLowerCase().includes(keyword) ||
                m.nickname.toLowerCase().includes(keyword)
            );
        }
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
            let contentHtml = msg.content || '';
            // 如果有 marked，则解析 Markdown
            if (typeof marked !== 'undefined') {
                contentHtml = marked.parse(contentHtml);
            } else {
                contentHtml = escapeHtml(contentHtml).replace(/\n/g, '<br>');
            }
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

        // 如果 KaTeX 可用，自动渲染 LaTeX
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
            } catch (e) { console.warn('KaTeX 渲染警告:', e); }
        }

        // 绑定删除事件
        container.querySelectorAll('.del-btn').forEach(btn => {
            btn.addEventListener('click', async function(e) {
                const id = this.dataset.id;
                if (!confirm('确定删除这条消息吗？')) return;
                await deleteMessage(id);
            });
        });

        // 公告栏
        const pinned = allMessages.filter(m => m.isPinned);
        if (pinned.length > 0) {
            const latestPin = pinned.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
            announceBar.classList.add('show');
            let pinContent = latestPin.content;
            if (typeof marked !== 'undefined') pinContent = marked.parseInline(pinContent);
            else pinContent = escapeHtml(pinContent);
            announceContent.innerHTML = `📌 <strong>${escapeHtml(latestPin.nickname)}</strong>：${pinContent}`;
        } else {
            announceBar.classList.remove('show');
        }
    }

    // ----- 加载 -----
    async function loadMessages() {
        if (!isReady) {
            // 如果依赖还未就绪，尝试等待
            if (typeof Octokit === 'undefined') {
                messageList.innerHTML = `<div class="empty-state">⏳ 正在加载依赖库，请稍后...</div>`;
                return;
            }
            isReady = true;
        }
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
            await loadMessages();
        }
    }

    // ----- 发送 -----
    async function sendMessage() {
        const nickname = nickInput.value.trim() || '匿名';
        const content = msgInput.value.trim();
        if (!content) return alert('请输入消息内容');
        if (!token) return alert('请先配置 Token');
        if (!isReady) {
            if (typeof Octokit === 'undefined') {
                alert('Octokit 库尚未加载，请刷新页面重试');
                return;
            }
            isReady = true;
        }

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

    // ----- 轮询 -----
    function startPolling() {
        if (pollingTimer) clearInterval(pollingTimer);
        pollingTimer = setInterval(loadMessages, 4000);
    }
    function stopPolling() {
        if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null; }
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
        // 重置 ready 状态，强制重新检查依赖
        isReady = false;
        loadMessages();
        startPolling();
    }

    // ============================================================
    //  初始化：不依赖任何外部库，先绑定所有事件
    // ============================================================
    function initApp() {
        console.log('✅ 留言板初始化开始');

        // 1. 先绑定所有按钮事件（确保点击有反馈）
        sendBtn.addEventListener('click', sendMessage);
        refreshBtn.addEventListener('click', function() {
            console.log('🔄 手动刷新');
            loadMessages();
        });
        configBtn.addEventListener('click', function() {
            console.log('⚙️ 打开配置');
            openModal();
        });
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

        // 2. 从 localStorage 恢复 Token 和昵称
        const savedToken = localStorage.getItem('chat_json_token');
        const savedNick = localStorage.getItem('chat_json_nick') || '访客';
        if (savedToken) {
            token = savedToken;
            nickInput.value = savedNick;
            // 尝试加载消息（但依赖可能还没加载，loadMessages 会检查）
            loadMessages();
            startPolling();
        } else {
            messageList.innerHTML = `<div class="empty-state">⚙️ 点击「配置」连接你的 GitHub 仓库</div>`;
        }

        // 3. 检测依赖加载情况
        if (typeof Octokit === 'undefined') {
            console.warn('⚠️ Octokit 未加载，将等待...');
            // 启动一个检测器，等 Octokit 加载后重试
            const checkDeps = setInterval(() => {
                if (typeof Octokit !== 'undefined') {
                    clearInterval(checkDeps);
                    console.log('✅ Octokit 已加载');
                    isReady = true;
                    if (token) loadMessages(); // 如果有 token，重新加载
                }
            }, 500);
            // 10秒后停止检测，避免无限循环
            setTimeout(() => clearInterval(checkDeps), 10000);
        } else {
            isReady = true;
            console.log('✅ Octokit 已就绪');
            if (token) loadMessages();
        }

        console.log('✅ 事件绑定完成，按钮已可点击');
    }

    // 确保 DOM 加载完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }

})();
