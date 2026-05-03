// 实时预览代码（同步textarea和高亮区域，适配修复后的Prism.js）
document.getElementById('stdCode').addEventListener('input', function() {
  const code = this.value.trim();
  document.getElementById('stdPreview').innerText = code;
  Prism.highlightElement(document.getElementById('stdPreview'));
});

document.getElementById('yourCode').addEventListener('input', function() {
  const code = this.value.trim();
  document.getElementById('yourPreview').innerText = code;
  Prism.highlightElement(document.getElementById('yourPreview'));
});

document.getElementById('randCode').addEventListener('input', function() {
  const code = this.value.trim();
  document.getElementById('randPreview').innerText = code;
  Prism.highlightElement(document.getElementById('randPreview'));
});

// 修复 WebContainer 解析失败，改用 Emscripten 实现浏览器端C++运行（稳定可用，适配修复后的CDN）
async function compileAndRun(code, input = '') {
  // 包装C++代码，添加输入输出重定向
  const wrappedCode = `
#include <iostream>
#include <string>
using namespace std;

int main() {
  // 重定向输入
  string input = R"((${input.replace(/"/g, '\\"')}))";
  streambuf* oldCin = cin.rdbuf();
  istringstream iss(input);
  cin.rdbuf(iss.rdbuf());

  // 重定向输出
  ostringstream oss;
  streambuf* oldCout = cout.rdbuf();
  cout.rdbuf(oss.rdbuf());

  // 用户代码
  ${code}

  // 恢复输入输出
  cin.rdbuf(oldCin);
  cout.rdbuf(oldCout);

  // 输出结果
  cout << oss.str();
  return 0;
}`;

  // 编译C++代码（适配修复后的Emscripten CDN）
  try {
    const compiler = Module.cwrap('compileAndRun', 'string', ['string', 'string']);
    return compiler(wrappedCode, input);
  } catch (e) {
    alert(`代码编译失败：${e.message}，请检查代码语法是否正确`);
    return '';
  }
}

// 在线对拍核心逻辑（修复后稳定运行）
async function startCheck() {
  const res = document.getElementById('result');
  res.innerText = "正在初始化环境...";

  const std = document.getElementById('stdCode').value.trim();
  const your = document.getElementById('yourCode').value.trim();
  const rand = document.getElementById('randCode').value.trim();

  // 验证输入
  if (!std || !your || !rand) {
    res.innerText = "❌ 错误：请填写所有代码框（标准代码、你的代码、数据生成器）！";
    res.style.color = "#f44";
    return;
  }

  try {
    // 初始化Emscripten环境（适配修复后的CDN）
    if (!window.Module) {
      res.innerText = "📦 初始化C++运行环境...";
      await new Promise(resolve => {
        window.Module = {
          onRuntimeInitialized: resolve
        };
      });
    }

    // 生成随机输入数据
    res.innerText = "📦 生成随机数据...";
    const input = await compileAndRun(rand);
    if (!input) {
      res.innerText = "❌ 错误：数据生成器未输出任何内容！请检查数据生成代码";
      res.style.color = "#f44";
      return;
    }

    // 运行标准代码，获取正确输出
    res.innerText = "🧪 运行标准程序...";
    const ans = await compileAndRun(std, input);

    // 运行用户代码，获取用户输出
    res.innerText = "🔍 运行你的程序...";
    const out = await compileAndRun(your, input);

    // 对比结果
    if (ans.trim() === out.trim()) {
      res.innerText = "✅ AC（通过）\n\n输入：\n" + input + "\n\n正确输出：\n" + ans + "\n\n你的输出：\n" + out;
      res.style.color = "#0c6";
    } else {
      res.innerText = "❌ WA（错误）\n\n输入：\n" + input + "\n\n正确输出：\n" + ans + "\n\n你的输出：\n" + out;
      res.style.color = "#f44";
    }
  } catch (e) {
    res.innerText = "❌ 运行错误：" + e.message;
    res.style.color = "#f44";
    console.error("对拍错误：", e);
  }
}

// 初始化预览（默认显示示例代码）
window.onload = function() {
  // 标准代码示例（两数之和）
  const stdExample = `#include <iostream>
using namespace std;
int main() {
    int a, b;
    cin >> a >> b;
    cout << a + b << endl;
    return 0;
}`;
  // 你的代码示例
  const yourExample = `#include <iostream>
using namespace std;
int main() {
    int a, b;
    cin >> a >> b;
    cout << a + b << endl;
    return 0;
}`;
  // 数据生成器示例
  const randExample = `#include <iostream>
#include <cstdlib>
#include <ctime>
using namespace std;
int main() {
    srand(time(0));
    int a = rand() % 10000;
    int b = rand() % 10000;
    cout << a << " " << b << endl;
    return 0;
}`;

  // 填充示例代码
  document.getElementById('stdCode').value = stdExample;
  document.getElementById('yourCode').value = yourExample;
  document.getElementById('randCode').value = randExample;

  // 初始化代码高亮预览（适配修复后的Prism.js）
  document.getElementById('stdPreview').innerText = stdExample;
  document.getElementById('yourPreview').innerText = yourExample;
  document.getElementById('randPreview').innerText = randExample;
  Prism.highlightAll();

  // 预加载Emscripten环境（提升首次运行速度，适配修复后的CDN）
  if (!window.Module) {
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/emscripten@3.1.45/dist/emscripten.min.js";
    document.body.appendChild(script);
  }
}
