// 1. 从 GitHub 仓库加载文章（核心功能，优化错误提示）
async function loadPostsFromGithub() {
  const postsContainer = document.getElementById('posts');
  postsContainer.innerHTML = '<div class="loading">加载中...</div>';

  // 获取用户输入的GitHub配置（默认填充你的仓库信息，减少输入错误）
  const token = document.getElementById('githubToken')?.value.trim() || localStorage.getItem('githubToken');
  const repo = document.getElementById('githubRepo')?.value.trim() || 'liuyio-awa.github.io' || localStorage.getItem('githubRepo');
  const branch = document.getElementById('githubBranch')?.value.trim() || 'main';

  // 验证配置，添加更详细的提示
  if (!token) {
    postsContainer.innerHTML = '<div class="empty-posts">请输入GitHub个人访问令牌（仅本地保存，不上传）</div>';
    return;
  }
  if (!repo || repo !== 'liuyio-awa.github.io') {
    postsContainer.innerHTML = '<div class="empty-posts">仓库名请填写 liuyio-awa.github.io（你的GitHub.io仓库）</div>';
    return;
  }

  try {
    // 初始化Octokit（用于操作GitHub，适配修复后的CDN引入）
    octokit = new Octokit({ auth: token });
    // 读取仓库中的posts.json文件（存储所有文章）
    let response;
    try {
      response = await octokit.rest.repos.getContent({
        owner: 'liuyio-awa', // 固定你的仓库所有者，避免解析错误
        repo: 'liuyio-awa.github.io', // 固定你的仓库名
        path: 'posts.json',
        ref: branch
      });
    } catch (err) {
      // 如果posts.json不存在，创建空文件，添加错误捕获
      if (err.status === 404) {
        try {
          await octokit.rest.repos.createOrUpdateFileContents({
            owner: 'liuyio-awa',
            repo: 'liuyio-awa.github.io',
            path: 'posts.json',
            message: '初始化文章存储文件',
            content: btoa('[]'), // 空的JSON字符串，base64编码
            branch: branch
          });
          response = await octokit.rest.repos.getContent({
            owner: 'liuyio-awa',
            repo: 'liuyio-awa.github.io',
            path: 'posts.json',
            ref: branch
          });
        } catch (createErr) {
          postsContainer.innerHTML = `<div class="empty-posts">创建posts.json失败：${createErr.message}</div>`;
          return;
        }
      } else if (err.status === 401) {
        postsContainer.innerHTML = '<div class="empty-posts">令牌无效或权限不足，请检查令牌是否正确、是否勾选repo权限</div>';
        return;
      } else {
        postsContainer.innerHTML = `<div class="empty-posts">加载失败：${err.message}</div>`;
        return;
      }
    }

    // 解析文章数据（base64解码）
    const content = atob(response.data.content);
    allPosts = JSON.parse(content) || [];
    allTags.clear();

    // 提取所有标签
    allPosts.forEach(post => {
      if (post.tags && post.tags.length > 0) {
        post.tags.forEach(tag => allTags.add(tag.trim()));
      }
    });

    // 渲染文章列表，适配代码高亮CDN
    renderPosts(allPosts);
  } catch (e) {
    postsContainer.innerHTML = `<div class="empty-posts">加载失败，请检查：1.令牌是否有效 2.仓库名是否正确</div>`;
    console.error('加载文章失败：', e);
  }
}

// 2. 渲染文章列表（不变，适配修复后的代码高亮）
function renderPosts(posts) {
  const postsContainer = document.getElementById('posts');
  if (posts.length === 0) {
    postsContainer.innerHTML = '<div class="empty-posts">暂无文章，快来发布第一篇吧！</div>';
    return;
  }

  postsContainer.innerHTML = posts.map(post => `
    <div class="post">
      <h2>${escapeHtml(post.title)}</h2>
      <div class="post-tags">
        ${post.tags.map(tag => `<span class="post-tag">${escapeHtml(tag)}</span>`).join('')}
      </div>
      <div class="post-content">${renderMarkdown(post.content)}</div>
    </div>
  `).join('');

  // 重新渲染代码高亮（适配修复后的Prism.js CDN，确保高亮生效）
  Prism.highlightAll();
}

// 3. 渲染标签筛选栏（不变）
function renderTags() {
  const tagList = document.getElementById('tagList');
  tagList.innerHTML = '';

  allTags.forEach(tag => {
    const tagItem = document.createElement('div');
    tagItem.className = 'tag-item';
    tagItem.innerText = tag;
    tagItem.onclick = () => filterPostsByTag(tag);
    tagList.appendChild(tagItem);
  });
}

// 4. 按标签筛选文章（不变）
function filterPostsByTag(tag) {
  const filteredPosts = allPosts.filter(post => post.tags.includes(tag));
  renderPosts(filteredPosts);
}

// 5. 显示所有文章（不变）
function showAllPosts() {
  renderPosts(allPosts);
}

// 6. 保存文章到 GitHub 仓库（核心功能，优化发布逻辑，添加详细错误提示）
async function savePostToGithub() {
  const titleInput = document.getElementById('title');
  const tagsInput = document.getElementById('tags');
  const contentInput = document.getElementById('content');
  const tokenInput = document.getElementById('githubToken');
  const repoInput = document.getElementById('githubRepo');
  const branchInput = document.getElementById('githubBranch');

  // 获取输入内容，固定仓库信息，减少错误
  const title = titleInput.value.trim();
  const tagsStr = tagsInput.value.trim();
  const content = contentInput.value.trim();
  const token = tokenInput.value.trim();
  const repo = 'liuyio-awa.github.io'; // 固定你的仓库名，避免输入错误
  const branch = 'main'; // 固定分支，避免输入错误

  // 验证输入，添加更详细的提示
  if (!title || !content) {
    alert('标题和内容不能为空！');
    return;
  }
  if (!token) {
    alert('请输入GitHub个人访问令牌（仅本地保存，不上传）！');
    return;
  }
  // 强制设置仓库名和分支，避免用户输入错误
  repoInput.value = repo;
  branchInput.value = branch;

  // 处理标签（分割、去重、去空）
  const tags = tagsStr.split(',')
    .map(tag => tag.trim())
    .filter(tag => tag !== '');

  try {
    // 初始化Octokit（适配修复后的CDN）
    octokit = new Octokit({ auth: token });
    // 读取现有文章，固定仓库信息
    let response;
    try {
      response = await octokit.rest.repos.getContent({
        owner: 'liuyio-awa',
        repo: repo,
        path: 'posts.json',
        ref: branch
      });
    } catch (getErr) {
      if (getErr.status === 404) {
        // 再次尝试创建空文件
        await octokit.rest.repos.createOrUpdateFileContents({
          owner: 'liuyio-awa',
          repo: repo,
          path: 'posts.json',
          message: '初始化文章存储文件',
          content: btoa('[]'),
          branch: branch
        });
        response = await octokit.rest.repos.getContent({
          owner: 'liuyio-awa',
          repo: repo,
          path: 'posts.json',
          ref: branch
        });
      } else if (getErr.status === 401) {
        alert('发布失败：令牌无效或权限不足！请检查令牌是否正确，是否勾选了repo所有子权限');
        return;
      } else {
        alert(`发布失败：读取文章文件失败，错误信息：${getErr.message}`);
        return;
      }
    }

    // 解析现有文章，添加新文章
    const existingContent = atob(response.data.content);
    const posts = JSON.parse(existingContent) || [];
    posts.unshift({
      title: title,
      tags: tags,
      content: content,
      time: new Date().toLocaleString(), // 发布时间
      id: Date.now().toString() // 唯一ID
    });

    // 保存到GitHub仓库（base64编码），添加错误捕获
    try {
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: 'liuyio-awa',
        repo: repo,
        path: 'posts.json',
        message: `发布文章：${title}`,
        content: btoa(JSON.stringify(posts, null, 2)), // 格式化JSON，base64编码
        branch: branch,
        sha: response.data.sha // 现有文件的SHA，用于更新
      });
    } catch (saveErr) {
      if (saveErr.status === 403) {
        alert('发布失败：令牌权限不足！请重新生成令牌，务必勾选repo所有子权限');
      } else {
        alert(`发布失败：保存文章失败，错误信息：${saveErr.message}`);
      }
      return;
    }

    // 本地存储GitHub配置（下次无需重复输入）
    localStorage.setItem('githubToken', token);
    localStorage.setItem('githubRepo', repo);

    // 重置输入框
    titleInput.value = '';
    tagsInput.value = '';
    contentInput.value = '';

    // 重新加载文章和标签
    await loadPostsFromGithub();
    renderTags();

    alert('发布成功！文章已保存到你的GitHub仓库！');
  } catch (e) {
    alert(`发布失败：${e.message}，请检查令牌是否有效、仓库名是否正确`);
    console.error('保存文章失败：', e);
  }
}

// 辅助函数：转义HTML特殊字符（防止XSS）
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 辅助函数：渲染Markdown（简单支持代码块、换行，适配代码高亮）
function renderMarkdown(content) {
  // 1. 代码块渲染（```语言 代码 ```）
  content = content.replace(/```([\s\S]*?)```/g, (match, code) => {
    // 提取语言（第一行）和代码内容
    const lines = code.split('\n');
    const lang = lines[0].trim() || 'text';
    const codeContent = lines.slice(1).join('\n');
    return `<pre><code class="language-${lang}">${escapeHtml(codeContent)}</code></pre>`;
  });

  // 2. 换行渲染
  content = content.replace(/\n/g, '<br>');

  return content;
}
