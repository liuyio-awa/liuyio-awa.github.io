async function loadPostsFromGithub() {
  const postsContainer = document.getElementById('posts');
  postsContainer.innerHTML = '<div class="loading">加载中...</div>';
  const token = document.getElementById("githubToken").value.trim();

  if (!token) {
    postsContainer.innerHTML = '<div class="empty-posts">请输入 GitHub Token</div>';
    return;
  }

  try {
    octokit = new Octokit({ auth: token });
    let response;

    try {
      response = await octokit.rest.repos.getContent({
        owner: "liuyio-awa",
        repo: "liuyio-awa.github.io",
        path: "posts.json",
        ref: BRANCH
      });
    } catch (err) {
      if (err.status === 404) {
        await octokit.rest.repos.createOrUpdateFileContents({
          owner: "liuyio-awa",
          repo: "liuyio-awa.github.io",
          path: "posts.json",
          message: 'init posts',
          content: btoa('[]'),
          branch: BRANCH
        });
        response = await octokit.rest.repos.getContent({
          owner: "liuyio-awa",
          repo: "liuyio-awa.github.io",
          path: "posts.json",
          ref: BRANCH
        });
      } else throw err;
    }

    const content = atob(response.data.content);
    allPosts = JSON.parse(content) || [];
    allTags.clear();
    allPosts.forEach(post => {
      if (post.tags) post.tags.forEach(tag => allTags.add(tag.trim()));
    });

    renderPosts(allPosts);
  } catch (e) {
    postsContainer.innerHTML = '<div class="empty-posts">加载失败</div>';
    console.error(e);
  }
}

function renderPosts(posts) {
  const container = document.getElementById('posts');
  if (posts.length === 0) {
    container.innerHTML = '<div class="empty-posts">暂无文章</div>';
    return;
  }

  container.innerHTML = posts.map(post => `
    <div class="post">
      <h2>${escapeHtml(post.title)}</h2>
      <div class="post-tags">
        ${post.tags?.map(t => `<span class="post-tag">${escapeHtml(t)}</span>`).join('') || ''}
      </div>
      <div class="post-content">${renderMarkdown(post.content)}</div>
    </div>
  `).join('');

  Prism.highlightAll();
}

function renderTags() {
  const tagList = document.getElementById('tagList');
  tagList.innerHTML = '';
  allTags.forEach(tag => {
    const el = document.createElement('div');
    el.className = 'tag-item';
    el.innerText = tag;
    el.onclick = () => filterPostsByTag(tag);
    tagList.appendChild(el);
  });
}

function filterPostsByTag(tag) {
  renderPosts(allPosts.filter(p => p.tags?.includes(tag)));
}

function showAllPosts() {
  renderPosts(allPosts);
}

async function savePostToGithub() {
  const title = document.getElementById('title').value.trim();
  const tagsStr = document.getElementById('tags').value.trim();
  const content = document.getElementById('content').value.trim();
  const token = document.getElementById("githubToken").value.trim();

  if (!token) { alert("请输入 GitHub Token"); return; }
  if (!title || !content) { alert('标题和内容不能为空！'); return; }

  localStorage.setItem("ghToken", token);

  const tags = tagsStr.split(',').map(t => t.trim()).filter(Boolean);

  try {
    octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.repos.getContent({
      owner: "liuyio-awa",
      repo: "liuyio-awa.github.io",
      path: "posts.json",
      ref: BRANCH
    });

    const posts = JSON.parse(atob(data.content));
    posts.unshift({ title, tags, content, time: new Date().toLocaleString() });

    await octokit.rest.repos.createOrUpdateFileContents({
      owner: "liuyio-awa",
      repo: "liuyio-awa.github.io",
      path: "posts.json",
      message: `发布：${title}`,
      content: btoa(JSON.stringify(posts, null, 2)),
      branch: BRANCH,
      sha: data.sha
    });

    document.getElementById('title').value = '';
    document.getElementById('tags').value = '';
    document.getElementById('content').value = '';

    await loadPostsFromGithub();
    renderTags();
    alert('发布成功！');
  } catch (e) {
    alert('发布失败');
    console.error(e);
  }
}

function escapeHtml(unsafe) {
  return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function renderMarkdown(content) {
  content = content.replace(/```([\s\S]*?)```/g, (_, code) => {
    const lines = code.split('\n');
    const lang = lines[0].trim() || 'text';
    const c = lines.slice(1).join('\n');
    return `<pre><code class="language-${lang}">${escapeHtml(c)}</code></pre>`;
  });
  return content.replace(/\n/g, '<br>');
}
