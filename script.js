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
      // 如果posts.json不存在，创建空
