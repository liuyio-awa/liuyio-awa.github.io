// ===== script.js =====
(function() {
    'use strict';

    console.log('🚀 留言板启动 (原生 fetch 版)');

    // DOM 引用
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

    // 固定仓库信息（改成你自己的）
    const OWNER = 'liuyio-awa';
    const REPO = 'liuyio-awa.github.io';
    const PATH = 'posts.json';
    const BRANCH = 'main';

    let token = '';
    let allMessages = [];
    let pollingTimer = null;

    // 工具函数（同上）
    function utf8ToBase64(str) { return btoa(unescape(encodeURIComponent(str))); }
    function base64ToUtf8(base64) { return decodeURIComponent(escape(atob(base64))); }
    function escapeHtml(text) { if (!text) return ''; const d=document.createElement('div'); d.textContent=text; return d.innerHTML; }
    function generateId() { return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7); }
    function formatTime(iso) { try { return new Date(iso).toLocaleString('zh-CN',{hour12:false}); } catch(_){return iso;} }
    function getColor(name) {
        let h=0; for(let i=0;i<name.length;i++) h=name.charCodeAt(i)+((h<<5)-h);
        const colors=['#f44336','#e91e63','#9c27b0','#673ab7','#3f51b5','#2196f3','#03a9f4','#00bcd4','#009688','#4caf50','#8bc34a','#cddc39','#ffeb3b','#ffc107','#ff9800','#ff5722'];
        return colors[Math.abs(h)%colors.length];
    }

    // API 操作（完全同单文件版，此处省略重复，请从单文件复制）
    // 注意：所有函数定义和逻辑与单文件版完全一致，只需复制过来即可。
    // 为了保持回答简洁，这里不重复粘贴，实际操作时请从单文件中的 <script> 里复制全部内容。

    // 初始化函数等...
    // 全部代码与单文件版 script 一致。

})();
