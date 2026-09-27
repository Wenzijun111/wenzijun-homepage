/* ============================================================
   V1-MVP · 温梓君个人主页脚本
   - 主题切换（深色 / 亮色）
   - 移动端汉堡导航展开收起
   - 数字分身聊天 Demo（本地问答匹配，无任何网络 API）
   - 魔法卡片：「项目 / 作品」板块的卡片描边跟随指针亮起（轮14 起；轮15 撤「技能 & 兴趣」、轮21 删「观点随笔」）
   注意：本文件为纯前端本地模拟，不调用任何后端 / 外部接口。
   ============================================================ */
(function () {
  "use strict";

  /* ---------- 1. 主题切换（轮13：Day/Night 天空开关） ---------- */
  var root = document.documentElement;
  var themeSwitch = document.getElementById("themeSwitch");

  // 默认深色；若本地存有主题则沿用（head 内联脚本已按存储值设过一次，这里兜底，重复设置无副作用）
  var storedTheme = null;
  try {
    storedTheme = localStorage.getItem("site-theme");
  } catch (e) {
    storedTheme = null;
  }
  if (storedTheme === "light") {
    root.setAttribute("data-theme", "light");
  }

  function isLightTheme() {
    return root.getAttribute("data-theme") === "light";
  }

  // 主题真值是 html[data-theme]，开关只做镜像；因此始终从同一处写入
  function applyTheme(isLight) {
    if (isLight) {
      root.setAttribute("data-theme", "light");
    } else {
      root.removeAttribute("data-theme"); // 回到深色
    }
    try {
      localStorage.setItem("site-theme", isLight ? "light" : "dark");
    } catch (e) {
      /* 隐私模式下忽略 */
    }
    syncSwitch(); // 同步开关（含 role="switch" 的 aria-checked）
  }

  // 把开关（checked + aria-checked）对齐到当前主题
  function syncSwitch() {
    var isLight = isLightTheme();
    if (themeSwitch) {
      themeSwitch.checked = isLight;
      themeSwitch.setAttribute("aria-checked", isLight ? "true" : "false");
    }
  }

  syncSwitch();

  if (themeSwitch) {
    themeSwitch.addEventListener("change", function () {
      applyTheme(themeSwitch.checked);
    });
  }

  /* ---------- 2. 移动端汉堡导航 ---------- */
  var navToggle = document.getElementById("navToggle");
  var navMenu = document.getElementById("navMenu");
  var body = document.body;

  // 打开菜单时锁定页面滚动，关闭后恢复
  function setBodyScrollLock(locked) {
    body.classList.toggle("no-scroll", locked);
  }

  function openNav() {
    navMenu.classList.add("is-open");
    navToggle.setAttribute("aria-expanded", "true");
    navToggle.setAttribute("aria-label", "关闭菜单");
    setBodyScrollLock(true);
  }

  function closeNav() {
    navMenu.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.setAttribute("aria-label", "打开菜单");
    setBodyScrollLock(false);
  }

  navToggle.addEventListener("click", function () {
    var open = navMenu.classList.contains("is-open");
    if (open) {
      closeNav();
    } else {
      openNav();
    }
  });

  // 点击导航链接后收起（锚点跳转）
  navMenu.querySelectorAll(".nav__link").forEach(function (link) {
    link.addEventListener("click", closeNav);
  });

  // 点击页面其他区域收起菜单
  document.addEventListener("click", function (event) {
    if (
      navMenu.classList.contains("is-open") &&
      !navMenu.contains(event.target) &&
      !navToggle.contains(event.target)
    ) {
      closeNav();
    }
  });

  // Esc 关闭菜单（键盘用户的出口，避免「打开后键盘关不掉」；
  // 与 js/roam.js 翻牌卡的 Esc 行为对齐，并把焦点交还开关以便继续导航）
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && navMenu.classList.contains("is-open")) {
      closeNav();
      navToggle.focus();
    }
  });

  // 关闭菜单后恢复滚动；窗口尺寸变化（如旋转/放大）时兜底恢复
  window.addEventListener("resize", function () {
    if (navMenu.classList.contains("is-open")) {
      closeNav();
    }
  });

  // 点击 logo 跳转首页（顶部）后收起菜单、移除高亮
  var brandLink = document.querySelector(".brand");
  if (brandLink) {
    brandLink.addEventListener("click", function () {
      closeNav();
      clearActiveNav();
    });
  }

  /* ---------- 当前页面导航项高亮（滚动监听 / scroll-spy） ---------- */
  var navLinks = Array.prototype.slice.call(
    document.querySelectorAll(".nav__link")
  );
  var spyTargets = [];

  // 收集导航链接对应的区块（含首屏 hero 顶部）
  navLinks.forEach(function (link) {
    var id = link.getAttribute("href");
    if (id && id.charAt(0) === "#") {
      var section = document.querySelector(id);
      if (section) {
        spyTargets.push({ link: link, section: section });
      }
    }
  });

  function clearActiveNav() {
    navLinks.forEach(function (l) {
      l.classList.remove("is-active");
    });
  }

  // 目标是否已渲染：轮18b 起「联系我」默认收在终页内部（hidden），
  // 未展开时它的一切位置量都是 0，必须跳过，否则高亮会一直错误地停在 Contact
  function isRendered(el) {
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function updateActiveNav() {
    var pos = window.scrollY + window.innerHeight * 0.28;
    var current = null;
    var lastRendered = null;
    for (var i = 0; i < spyTargets.length; i++) {
      var section = spyTargets[i].section;
      if (!isRendered(section)) {
        continue;
      }
      lastRendered = spyTargets[i];
      // 用文档坐标而非 offsetTop：兼容嵌在区块内部的锚点（轮18b 的 #contact）
      var top = section.getBoundingClientRect().top + window.scrollY;
      if (top <= pos) {
        current = spyTargets[i];
      }
    }
    // 若已在最底部，高亮最后一个「可见」区块（Contact；未展开时为其前方的区块）
    if (
      lastRendered &&
      window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2
    ) {
      current = lastRendered;
    }
    clearActiveNav();
    if (current) {
      current.link.classList.add("is-active");
    }
  }

  // 点击导航项时立即高亮目标，避免滚动监听时序造成的瞬时空白
  navLinks.forEach(function (link) {
    link.addEventListener("click", function () {
      clearActiveNav();
      link.classList.add("is-active");
    });
  });

  window.addEventListener("scroll", updateActiveNav, { passive: true });
  window.addEventListener("resize", updateActiveNav);
  updateActiveNav();

  /* ---------- 吸顶导航滚动态：滚动后才出现轻微背景 + 毛玻璃 ---------- */
  // 阈值取小值：轻微滚动即进入「已滚动」态，避免停在顶部边缘时反复抖动
  var header = document.querySelector(".header");
  var HEADER_SCROLL_THRESHOLD = 8;

  function updateHeaderState() {
    if (!header) {
      return;
    }
    header.classList.toggle(
      "is-scrolled",
      window.scrollY > HEADER_SCROLL_THRESHOLD
    );
  }

  window.addEventListener("scroll", updateHeaderState, { passive: true });
  // 刷新后浏览器可能已恢复到某个滚动位置，加载时立即同步一次
  updateHeaderState();

  /* ---------- 3. 数字分身聊天 Demo（本地问答匹配） ---------- */

  // 预存知识库问答映射（前端匹配，无 API）
  var QA_MAP = [
    {
      match: ["你是谁", "你叫什么", "你是"],
      answer:
        "我是温梓君，天大-港理工深圳未来技术学院计算机大一学生，工作认真踏实，生活活泼灵动，一名持续自学的入门开发者，同时参与学校学风建设工作组。"
    },
    {
      match: ["关心", "方向", "关注", "AI协作", "协作"],
      answer:
        "我很关心在AI普及的时代，人类独有的创造力、思辨力该如何发挥，思考人如何和AI工具更好协作，而不是取代与被取代的对抗关系。"
    },
    {
      match: ["最近", "在做什么", "现在做", "忙什么"],
      answer:
        "我正在夯实计算机与数学专业基础，练习Python、网页开发，完成课程个人主页迭代项目，同时参与学校学风建设工作组，也在音乐、旅行、美食等兴趣中进一步丰富自己。"
    },
    {
      match: ["擅长", "优势", "强项", "长处"],
      answer:
        "我擅长有条理地解决问题，习惯结构化学习，能动能静的性格也让我能很好地处理各类事务。"
    },
    {
      match: ["学习方式", "怎么学", "学习方法", "如何学习"],
      answer:
        "我习惯结构化学习，把大任务拆解成小块，采用迭代思维逐步完善作品。"
    },
    {
      match: ["爱好", "兴趣", "课余", "平时"],
      answer:
        "我喜欢探索AI工具、网页设计，听多流派音乐，旅游、品尝美食，也会看体育比赛。"
    },
    {
      match: ["技能", "掌握", "会什么", "擅长什么"],
      answer:
        "我掌握Python入门编程，会利用AI工具辅助学习工作，熟悉办公学术工具。"
    },
    {
      match: ["规划", "计划", "未来", "打算", "学习规划"],
      answer:
        "大一剩余阶段会巩固数理基础，学习离散数学、JavaScript、基础算法；大二主攻操作系统、计算机网络等核心专业课，尝试AI-Agent等AI应用实践，完成更多小型项目；长远希望探索人机交互、AI工具应用方向，沉淀个人作品集，思考AI时代人与工具的协作模式。"
    }
  ];

  var FALLBACK_ANSWER =
    "这个问题我暂时无法回答，欢迎浏览页面其他内容了解我。";

  var chatStream = document.getElementById("chatStream");
  var chatForm = document.getElementById("chatForm");
  var chatInput = document.getElementById("chatInput");

  function renderMessage(text, who) {
    var msg = document.createElement("div");
    msg.className = "msg " + (who === "user" ? "msg--user" : "msg--ai");
    msg.textContent = text;
    chatStream.appendChild(msg);
    scrollChatToBottom();
  }

  // 始终将最新消息滚动到可视底部（新消息自动滚动）
  function scrollChatToBottom() {
    chatStream.scrollTop = chatStream.scrollHeight;
  }

  // 插入“正在思考”占位消息，返回其 DOM 以便稍后替换
  function renderThinking() {
    var msg = document.createElement("div");
    msg.className = "msg msg--ai msg--thinking";
    msg.innerHTML =
      '<span class="msg__label">正在思考</span>' +
      '<span class="thinking"><span></span><span></span><span></span></span>';
    chatStream.appendChild(msg);
    scrollChatToBottom();
    return msg;
  }

  function handleQuestion(question) {
    var clean = question.trim();
    if (!clean) {
      return;
    }
    renderMessage("问：" + clean, "user");
    // 先显示“正在思考”加载态，极短延迟后替换为答案，提供打字/思考感（本地，无网络）
    var thinkingMsg = renderThinking();
    setTimeout(function () {
      var answer = "答：" + findAnswer(clean);
      var aiMsg = document.createElement("div");
      aiMsg.className = "msg msg--ai";
      aiMsg.textContent = answer;
      chatStream.replaceChild(aiMsg, thinkingMsg);
      scrollChatToBottom();
    }, 620);
    chatInput.value = "";
  }

  function findAnswer(question) {
    var normalized = question.trim().replace(/[，。？！?\s]/g, "");
    if (!normalized) {
      return FALLBACK_ANSWER;
    }
    for (var i = 0; i < QA_MAP.length; i++) {
      var entry = QA_MAP[i];
      for (var j = 0; j < entry.match.length; j++) {
        if (normalized.indexOf(entry.match[j]) !== -1) {
          return entry.answer;
        }
      }
    }
    return FALLBACK_ANSWER;
  }

  chatForm.addEventListener("submit", function (event) {
    event.preventDefault();
    handleQuestion(chatInput.value);
  });

  // 快捷提问按钮：点击自动填充并发送
  document.querySelectorAll(".quick-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      handleQuestion(btn.getAttribute("data-question") || "");
    });
  });

  // 启动时给出欢迎消息
  renderMessage(
    "你好，我是温梓君的数字分身原型。可以在下方输入问题或点快捷按钮问我，例如「你是谁？」",
    "ai"
  );

  /* ---------- 4. 邮箱一键复制 + 提示 ---------- */
  var toast = document.getElementById("toast");
  var toastTimer = null;

  function showToast(message) {
    if (!toast) {
      return;
    }
    toast.textContent = message;
    toast.classList.add("is-visible");
    if (toastTimer) {
      clearTimeout(toastTimer);
    }
    toastTimer = setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 1800);
  }

  // 轮20：「我的会客厅」留言板脚本（js/living-room.js）复用同一个全局提示条，
  // 故把 showToast 挂到 window 上（只暴露这一个方法，不暴露内部状态）
  window.showToast = showToast;

  function copyText(text) {
    // 优先用异步剪贴板 API，失败（如非 HTTPS / 旧浏览器）回退到 execCommand
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(
        function () {
          return true;
        },
        function () {
          return legacyCopy(text);
        }
      );
    }
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText =
      "position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none;";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (e) {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }

  document.querySelectorAll(".copy-email").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var text = btn.getAttribute("data-copy") || "";
      copyText(text).then(function (ok) {
        showToast(ok ? "邮箱已复制：" + text : "复制失败，请手动复制");
      });
    });
  });

  /* ---------- 5. 首屏弥散光块背景：Canvas 圆块径向场（轮10 · 弥散场 v3） ---------- */
  // 轮10 需求原文：弥散颗粒渐变 / 色块柔和晕染 / 边界模糊弥散 / 均匀细腻的胶片颗粒 /
  //               色彩缓慢移动 / 形状整体规则一点（光块整体是圆的在移动）/ 不要像烟一样 /
  //               颜色可以多一些渐变、不局限于蓝、与整体协调 / 多一些荧光科技感。
  // 参考站实测（ffmpeg 抽帧 + 逐帧连通域与频谱分析，脚本 .deepworks/tmp/ref_style.py）：
  //   1) 亮区每帧恰好 2 个连通域（数量恒定 → 形状规则），连通域填充率 p50 0.80（正圆 = 0.785）
  //      → 光块是「圆 / 近圆」，不是烟状纤维；长宽比 p50 1.41（最大 2.4，从不细长）；
  //   2) 亮度梯度均值 2.80、|grad| > 40 的像素仅 0.01% → 完全没有硬边（边界模糊弥散）；
  //   3) 高频残差 std：暗部 1.02、亮部 4.10（0~255 亮度尺度）→ 颗粒很细，且亮处更明显（胶片特征）；
  //   4) 亮部质心水平往返 −6.9% ~ +4.2% 视口宽/秒，垂直跨度仅 10.8% → 主要是横向缓慢移动；
  //   5) 单块面积在 0.4% ↔ 27% 画面之间胀缩 → 呼吸（胀缩）幅度很大；
  //   6) 亮部色相 100% 落在 150°~209°（青绿→青蓝），另两角与中心纯黑。
  // 机制（v3 用「少量大圆块的径向衰减场」取代 v2 的「域扭曲连续场」——
  //       域扭曲正是「像烟」的病根：形状不规则、边界被撕开）：
  //   1) 4 个圆块（2 大 + 2 小）各做高斯型径向衰减 → 天然的圆 + 天然的软边，不可能长成烟；
  //   2) 每像素按四块权重加权混色（四色渐变的中间色由混色自然生成），再过一道「荧光增亮」；
  //   3) 横向缓慢往返 + 周期性胀缩，时间项全部写成 sin/cos(k·2πt/PERIOD)（k 为整数）→ 20 秒严格无缝循环；
  //   4) 极小幅度的低频缓变扰动只给边缘加「晕染」的不均匀感，不破坏圆形（这是与 v2 的关键区别）；
  //   5) 静态「安全场」（顶部收敛 + 文字安全区 + 暗角）在 resize / 换主题时预计算一次，
  //      逐帧只做一次查表乘法：既保住吸顶导航与贴底文字的对比度，又省掉逐像素开方；
  //   6) 胶片颗粒分两层，都由本文件驱动：
  //      第一层 = CSS 的 SVG feTurbulence 均匀底噪（.hero::after，1px 级，强度 0.02），每帧随机
  //               平移 1px → 静态噪点变成「会呼吸的细颗粒」，成本只是一次合成；
  //      第二层 = 画布内的 overlay 亮度加权颗粒（见 draw() 里的说明）：纯黑处 ≈ 0（黑底保持
  //               纯黑）、中亮处最强 → 复现参考站「亮部颗粒约为暗部 4 倍」的胶片特征；
  //      轮10b 曾试图用 mix-blend-mode 的 DOM 层做第二层，实测 Chromium 会把参与 CSS 混合的
  //      层按更低分辨率光栅化（颗粒块化：4px 相关 lag4 0.25~0.50，普通层只有 0.05）→ 改为
  //      画布内合成：画布内的混合始终按画布自身分辨率逐像素进行。
  // 闭环口径：光场本身严格 20 秒闭环（逐帧颗粒是刻意的随机量、真胶片颗粒本来不周期，不在闭环内），
  //           因此比对闭环时应带 ?fluidGrain=0 关闭两层颗粒。
  // 诊断开关（只在 URL 上显式给出时生效，不影响正常访问）：
  //   ?fluidT=5       冻结在循环第 5 秒（静态帧，便于截图与逐像素验收）
  //   ?fluidGrain=0   关闭两层颗粒（CSS 均匀底噪 + 画布 overlay 颗粒）→ 用于验证光场本身的 20 秒闭环
  //   ?fluidGA=<0~1>  覆写画布颗粒层强度（默认 0.24）→ 便于目视对比强弱，例：/?fluidGA=0.36
  // 可访问性与耗电：尊重 prefers-reduced-motion（只画一帧静态）、标签页不可见或首屏滚出视口时暂停绘制。
  (function () {
    var canvas = document.querySelector(".hero__canvas");
    if (!canvas || !canvas.getContext) {
      return;
    }
    var ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    // 低分辨率「场缓冲」（离屏）：逐像素渲染都发生在这里，像素上限固定 → 大屏也不拖慢；
    // 可见画布只负责「放大 + 颗粒合成」两件全分辨率的事。
    var buf = document.createElement("canvas");
    var bctx = buf.getContext("2d");
    if (!bctx) {
      return;
    }

    var MIN_SCALE = 4;      // 常规视口的最低降采样倍数（绘制分辨率 = 视口 / SCALE）
    var MAX_PIX = 110000;   // 低分辨率缓冲像素上限：大屏自动再降分辨率，逐像素渲染不超预算
    var PERIOD = 20;        // 一个完整循环 20 秒
    var FPS = 30;           // 绘制上限 30 帧/秒（参考站视频为 29.88 fps）
    var STATIC_T = 5.0;     // reduced-motion 下呈现的静态时刻（秒）：光块最大的相位
    var TAU = 6.2832;
    var K_MAX = 1.25;       // 光块叠加权重上限（>1 = 叠加处更亮；深色主题的「荧光」来源之一）
    var FLUOR = 0.28;       // 荧光增亮：叠加越强提亮越多（深色主题；亮色主题为 0）
    var WARP_PX = 0.12;     // 边缘缓变扰动的位移幅度（占短边比例）→ 晕染感；越小越「圆」
    var WARP_SC = 0.035;    // 扰动的空间频率（噪声单位/像素，越小越缓）
    var WARP_NOISE = 1.15;  // 扰动的时间位移幅度（噪声单位）：由 sin/cos 组成 → 严格闭环
    var DENS_LO = 0.78;     // 内部密度下限（0.78~1.0 的轻微层次，避免光块变成一整块平板）
    var GRAIN_TILE = 128;    // 颗粒噪声贴图边长（预计算成小画布 → CanvasPattern，逐帧只换偏移）
    var GRAIN_AMP = 96;      // 贴图噪声相对中性灰的幅度（0~255 尺度；三角分布 std ≈ 0.41×幅度）
    var GRAIN_ALPHA = 0.36;  // 画布内 overlay 颗粒层强度（可用 ?fluidGA= 临时覆写：纯黑处几乎不动、中亮处最强）
    var SS_MAX_PIX = 1400000; // 可见画布（屏幕分辨率）像素上限：4K 视口按比例再降一档
    var TOP_LO = 0.22;      // 顶部收敛带起点强度（吸顶导航直接压在画布上）
    var NAV_KEEP = 0.135;   // 顶部收敛带「压到底」的高度（覆盖导航墨迹最下沿）
    var TOP_FADE = 0.170;   // 顶部收敛带结束高度（NAV_KEEP~TOP_FADE 之间平滑回升 → 无横向硬边）
    var SAFE_SX = 0.03;     // 文字安全区软边（x，视口宽比例）
    var SAFE_SY = 0.025;    // 文字安全区软边（y，视口高比例）
    var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];  // 4x4 有序抖动

    // 文字安全区（视口比例 x0,x1,y0,y1,keep）：光块在矩形内按 keep 衰减，边缘用 smoothstep 软化。
    // 数值来自 .deepworks/tmp/ceiling_r10.py 反解（含噪点均值口径的 WCAG 上限）并留安全余量：
    //   - avatar + eyebrow 段（x 26%~74%，y 21.5%~49.5%）：
    //     avatar 的「WZJ」与 eyebrow 都是 --color-accent-strong，实测上限最紧 → keep 0.22
    //   - title / tagline / intro 行（x 0.5%~99.5%，y 53%~81.5%）：上限 110 / 122 / 88 → keep 0.30
    //   - actions 行（x 31%~69%，y 87.5%~100%）：上限 206 → keep 0.62
    // 注意 1：keep 必须作用在「已裁剪的强度」上（见 draw() 里的 ks 计算顺序），
    //         否则 4 块重叠处 acc 可达 3.4，乘 keep 后仍会顶到 kMax，安全区形同虚设。
    // 注意 2：保护只在矩形「内缩 SAFE_SX/SAFE_SY」之后才是全额，边缘是平滑过渡，
    //         所以每个矩形都要留出余量；实测还发现文字墨迹位置在不同加载时机有
    //         ±3% 视口高的抖动（字体加载时机），矩形据此留了 ≥2% 的余量。
    var SAFE = [
      [0.26, 0.74, 0.215, 0.495, 0.22],
      [0.005, 0.995, 0.530, 0.815, 0.30],
      [0.31, 0.69, 0.875, 1.000, 0.62]
    ];

    // 光块参数（轮10 选定：2 大 + 2 小，方案 C 四色霓虹，体量「再大一些、更弥散」）：
    //   x/y = 基准位置（视口比例），r = 基准半径（占视口短边比例），ax/ay = 横/纵位移幅度，
    //   ph = 位移相位，bAmp/bPh = 胀缩幅度/相位，k = 谐波次数（整数 → 严格闭环），gi = 该块强度权重
    var BLOBS = [
      { x: 0.24, y: 0.40, r: 0.50, ax: 0.15, ay: 0.03, ph: 0.00, bAmp: 0.26, bPh: 0.0, k: 1, gi: 1.00 },
      { x: 0.80, y: 0.62, r: 0.46, ax: 0.17, ay: 0.02, ph: 3.14, bAmp: 0.24, bPh: 1.1, k: 1, gi: 0.94 },
      { x: 0.16, y: 0.80, r: 0.30, ax: 0.10, ay: 0.02, ph: 1.60, bAmp: 0.38, bPh: 2.2, k: 2, gi: 0.78 },
      { x: 0.86, y: 0.24, r: 0.27, ax: 0.12, ay: 0.02, ph: 4.60, bAmp: 0.40, bPh: 3.4, k: 2, gi: 0.70 }
    ];
    var NB = BLOBS.length;

    var palette = null;
    var w = 0;              // 低分辨率场缓冲尺寸
    var h = 0;
    var SW = 0;             // 可见画布（屏幕分辨率）尺寸
    var SH = 0;
    var img = null;
    var safeA = null;       // 静态安全场（安全区衰减 × 顶部收敛）
    var vaA = null;         // 静态暗角 alpha（随主题变化 → 与 palette 同步重建）
    var fieldDirty = true;  // 调色板或尺寸变化后需要重建静态场
    var elapsed = 0;        // 累计动画时间（暂停/恢复不跳变）
    var lastTs = 0;
    var lastDraw = -1e9;
    var rafId = 0;
    var running = false;
    var tabVisible = true;
    var onScreen = true;
    var reduceMedia = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    var reduced = !!(reduceMedia && reduceMedia.matches);

    // 诊断开关（URL 显式给出才生效）
    var qs = null;
    try {
      qs = new URLSearchParams(window.location.search);
    } catch (e) {
      qs = null;
    }
    var FREEZE_T = qs && qs.has("fluidT") ? Math.max(0, parseFloat(qs.get("fluidT")) || 0) : -1;
    var GRAIN_ON = !(qs && String(qs.get("fluidGrain")) === "0");
    if (qs && qs.has("fluidGA")) {              // 颗粒强度覆写（只影响本机调试，不影响默认观感）
      var ga = parseFloat(qs.get("fluidGA"));
      if (isFinite(ga)) {
        GRAIN_ALPHA = Math.max(0, Math.min(1, ga));
      }
    }

    // 固定种子的置换表 → 每次刷新形态一致（确定性，便于复现、截图对比与逐像素验收）
    var PERM = new Uint8Array(512);
    (function () {
      var seed = 20260916;
      var p = new Uint8Array(256);
      var i, j, tmp;
      for (i = 0; i < 256; i++) {
        p[i] = i;
      }
      for (i = 255; i > 0; i--) {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        j = seed % (i + 1);
        tmp = p[i];
        p[i] = p[j];
        p[j] = tmp;
      }
      for (i = 0; i < 512; i++) {
        PERM[i] = p[i & 255];
      }
    })();


    // 颗粒噪声贴图：一次性预计算成小画布，再做成 CanvasPattern（逐帧只换采样偏移，几乎不花算力）。
    // 用「两个均匀随机数相加」得到三角分布，比 0/1 二值噪声更接近胶片颗粒的柔和感；均值正好压在中性灰。
    var gcanvas = document.createElement("canvas");
    var gctx = null;
    var GPAINT = null;
    (function () {
      var seed = 987654321;
      gcanvas.width = GRAIN_TILE;
      gcanvas.height = GRAIN_TILE;
      gctx = gcanvas.getContext("2d");
      var gimg = gctx.createImageData(GRAIN_TILE, GRAIN_TILE);
      var d = gimg.data;
      for (var i = 0, k = 0; i < GRAIN_TILE * GRAIN_TILE; i++, k += 4) {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        var u1 = seed / 2147483648;
        seed = (seed * 1103515245 + 12345) % 2147483648;
        var u2 = seed / 2147483648;
        var v = Math.round(128 + (u1 + u2 - 1) * GRAIN_AMP);
        d[k] = d[k + 1] = d[k + 2] = v;
        d[k + 3] = 255;
      }
      gctx.putImageData(gimg, 0, 0);
    })();
    function grainPattern() {
      if (!GPAINT) {
        GPAINT = ctx.createPattern(gcanvas, "repeat");
      }
      return GPAINT;
    }

    function hash2(ix, iy) {
      return PERM[(PERM[ix & 255] + (iy & 255)) & 255] / 255;
    }

    function vnoise(x, y) {   // 值噪声 + 平滑插值，返回 0~1
      var ix = Math.floor(x);
      var iy = Math.floor(y);
      var fx = x - ix;
      var fy = y - iy;
      var ux = fx * fx * (3 - 2 * fx);
      var uy = fy * fy * (3 - 2 * fy);
      var a = hash2(ix, iy);
      var b = hash2(ix + 1, iy);
      var c = hash2(ix, iy + 1);
      var e = hash2(ix + 1, iy + 1);
      var top = a + (b - a) * ux;
      var bot = c + (e - c) * ux;
      return top + (bot - top) * uy;
    }

    function clamp01(v) {
      return v < 0 ? 0 : (v > 1 ? 1 : v);
    }

    function smooth01(v) {   // 0~1 平滑过渡（输入已裁剪）
      return v * v * (3 - 2 * v);
    }

    function readPalette() {
      var cs = getComputedStyle(document.documentElement);
      function triple(name, fallback) {
        var parts = (cs.getPropertyValue(name) || "").split(",");
        if (parts.length !== 3) {
          return fallback;
        }
        var out = [];
        for (var i = 0; i < 3; i++) {
          var n = parseInt(parts[i], 10);
          if (isNaN(n)) {
            return fallback;
          }
          out.push(n);
        }
        return out;
      }
      function num(name, fallback) {
        var v = parseFloat(cs.getPropertyValue(name));
        return isNaN(v) ? fallback : v;
      }
      var blend = (cs.getPropertyValue("--fluid-blend") || "lighter").trim() || "lighter";
      palette = {
        base: triple("--fluid-base", [15, 22, 32]),
        cols: [
          triple("--fluid-b1", [46, 214, 200]),   // 青绿（大块）
          triple("--fluid-b2", [88, 146, 236]),   // 冷蓝（大块）
          triple("--fluid-b3", [166, 104, 244]),  // 紫（小块）
          triple("--fluid-b4", [230, 84, 198])    // 品红（小块）
        ],
        veil: triple("--fluid-veil", [4, 7, 12]),
        vignette: num("--fluid-vignette", 0.86),
        blend: blend,
        // 深色主题：叠加混合 + 荧光增亮；亮色主题：乘性混合（颜色比底色深时才可见）+ 不加增亮
        dark: blend === "lighter",
        kMax: blend === "lighter" ? K_MAX : 1.0,
        fluor: blend === "lighter" ? FLUOR : 0
      };
      fieldDirty = true;      // 暗角 alpha 依赖 --fluid-vignette/--fluid-veil，主题切换后必须重建
    }

    // 预计算静态场：文字安全区 × 顶部收敛（几何相关）与暗角 alpha（主题相关）。
    // 只在 resize / 主题切换时重建，逐帧渲染只做一次查表乘法。
    function buildField() {
      if (w <= 0 || h <= 0) {
        return;
      }
      var n = w * h;
      if (!safeA || safeA.length !== n) {
        safeA = new Float32Array(n);
      }
      if (!vaA || vaA.length !== n) {
        vaA = new Float32Array(n);
      }
      var minSide = Math.min(w, h);
      var vIn = 0.10 * minSide;
      var vSpan = 0.80 * Math.max(w, h) - vIn;
      var vig = palette ? palette.vignette : 0.86;
      var cx = 0.5 * w;
      var cy = 0.42 * h;
      var invW = 1 / w;
      var invH = 1 / h;
      var pk = 0, x, y, nx, ny, i, rc, f, mul, ex, ey, e, dx, dy, dist;
      for (y = 0; y < h; y++) {
        ny = y * invH;
        // 顶部收敛：NAV_KEEP 以下压到 TOP_LO，到 TOP_FADE 平滑回升到 1（无横向硬边）
        var topF = 1;
        if (ny < TOP_FADE) {
          topF = ny < NAV_KEEP ? TOP_LO
            : TOP_LO + (1 - TOP_LO) * smooth01((ny - NAV_KEEP) / (TOP_FADE - NAV_KEEP));
        }
        for (x = 0; x < w; x++, pk++) {
          nx = x * invW;
          mul = topF;
          for (i = 0; i < SAFE.length; i++) {
            rc = SAFE[i];
            ex = (nx - rc[0]) < (rc[1] - nx) ? (nx - rc[0]) : (rc[1] - nx);
            ey = (ny - rc[2]) < (rc[3] - ny) ? (ny - rc[2]) : (rc[3] - ny);
            e = smooth01(clamp01(ex / SAFE_SX * 0.5 + 0.5)) * smooth01(clamp01(ey / SAFE_SY * 0.5 + 0.5));
            f = 1 + (rc[4] - 1) * e;
            mul *= f;
          }
          safeA[pk] = mul;
          // 暗角罩层（很轻的四周收敛）
          dx = x - cx;
          dy = y - cy;
          dist = Math.sqrt(dx * dx + dy * dy);
          e = (dist - vIn) / vSpan;
          if (e <= 0) {
            vaA[pk] = 0;
          } else {
            if (e > 1) {
              e = 1;
            }
            vaA[pk] = (e <= 0.55 ? e * (0.05 / 0.55) : 0.05 + (e - 0.55) * (0.25 / 0.45)) * vig;
          }
        }
      }
    }

    // 按视口尺寸准备低分辨率画布；尺寸未变时返回 false（避免无谓重绘）
    function resize() {
      var cw = canvas.clientWidth || window.innerWidth;
      var ch = canvas.clientHeight || window.innerHeight;
      // ① 低分辨率「场缓冲」：逐像素渲染发生在这里（像素上限固定，成本与视口大小无关）
      var scale = Math.max(MIN_SCALE, Math.sqrt(cw * ch / MAX_PIX));
      var nw = Math.max(32, Math.round(cw / scale));
      var nh = Math.max(32, Math.round(ch / scale));
      // ② 可见画布：屏幕分辨率（1px 级颗粒必须在这一层合成；超大视口按 SS_MAX_PIX 再降一档）
      var sscale = Math.max(1, Math.sqrt(cw * ch / SS_MAX_PIX));
      var sw = Math.max(64, Math.round(cw / sscale));
      var sh = Math.max(64, Math.round(ch / sscale));
      if (nw === w && nh === h && sw === SW && sh === SH) {
        return false;
      }
      w = nw;
      h = nh;
      SW = sw;
      SH = sh;
      buf.width = w;
      buf.height = h;
      canvas.width = SW;
      canvas.height = SH;
      img = bctx.createImageData(w, h);
      ctx.imageSmoothingEnabled = true;
      buildField();
      fieldDirty = false;
      return true;
    }

    // 逐帧把 4 个圆块的圆心/半径/权重算好（避免在内层循环里重复三角运算）
    var fx = new Float64Array(NB);
    var fy = new Float64Array(NB);
    var fr = new Float64Array(NB);
    var fw = new Float64Array(NB);

    function layout(ts) {
      var ph = ts / PERIOD * TAU;
      var minSide = Math.min(w, h);
      for (var i = 0; i < NB; i++) {
        var b = BLOBS[i];
        var a1 = b.k * ph + b.ph;                                  // 位移相位（整数谐波 → 闭环）
        var a2 = b.k * ph + b.bPh;                                 // 胀缩相位（整数谐波 → 闭环）
        fr[i] = b.r * minSide * (1 + b.bAmp * Math.sin(a2));       // 半径呼吸（胀缩）
        fx[i] = (b.x + b.ax * Math.sin(a1)) * w;                   // 横向缓慢往返
        fy[i] = (b.y + b.ay * Math.cos(a1)) * h;                   // 纵向极小幅度随动
        fw[i] = b.gi;
      }
    }

    function draw(ts) {
      if (fieldDirty) {
        buildField();          // 主题切换等只改调色板不改尺寸的情形，在这里补建
        fieldDirty = false;
      }
      var p = palette;
      var data = img.data;
      var cols = p.cols;
      var base = p.base;
      var veil = p.veil;
      var kMax = p.kMax;
      var fluor = p.fluor;
      var ph = ts / PERIOD * TAU;
      // 边缘缓变扰动的时间位移：由整数谐波的 sin/cos 组成 → 20 秒后严格回到初值（闭环）
      var wox = WARP_NOISE * (Math.sin(ph) + 0.35 * Math.sin(2 * ph + 0.7));
      var woy = WARP_NOISE * (Math.cos(ph) + 0.35 * Math.cos(2 * ph + 0.7));
      layout(ts);
      var minSide = Math.min(w, h);
      var warpPx = WARP_PX * minSide;
      var b0 = base[0], b1 = base[1], b2 = base[2];
      // 逐帧随机平移的颗粒采样偏移（画布颗粒 = 贴图整体偏移；CSS 底噪的平移在函数尾部设置）
      var gox = GRAIN_ON ? (Math.random() * GRAIN_TILE) | 0 : 0;
      var goy = GRAIN_ON ? (Math.random() * GRAIN_TILE) | 0 : 0;
      var x, y, k = 0, pk = 0;
      var cc, dx, dy, q, wt, acc, mr, mg, mb, dens, ks, gl, va, dit, nx, ny, wxk, wyk, rr;

      for (y = 0; y < h; y++) {
        for (x = 0; x < w; x++, k += 4, pk++) {
          // 低频缓变扰动：只给边缘加「晕染」的不均匀感（幅度很小，圆块仍然是圆）
          nx = x * WARP_SC + wox;
          ny = y * WARP_SC + woy;
          wxk = (vnoise(nx, ny) - 0.5) * warpPx;
          wyk = (vnoise(nx + 37.7, ny + 91.1) - 0.5) * warpPx;

          acc = 0; mr = 0; mg = 0; mb = 0;
          for (var i = 0; i < NB; i++) {
            dx = x + wxk - fx[i];                     // 单位：低分辨率缓冲像素
            dy = y + wyk - fy[i];
            rr = fr[i];
            q = 1 - (dx * dx + dy * dy) / (rr * rr);
            // 高斯型径向衰减：圆心处 1、半径处 0，过渡带很宽 → 天然的圆 + 天然的软边（边界模糊弥散）
            if (q > 0) {
              q = q * q * (3 - 2 * q);                // smoothstep → 边缘更软、无硬边
              wt = q * fw[i];
              cc = cols[i];
              acc += wt;
              mr += wt * cc[0];
              mg += wt * cc[1];
              mb += wt * cc[2];
            }
          }

          var r = b0, g = b1, bl = b2;
          if (acc > 0.0009) {
            mr /= acc;
            mg /= acc;
            mb /= acc;
            // 内部轻微密度起伏（避免光块变成一整块平板；幅度小 → 仍是「柔和晕染」）
            dens = DENS_LO + (1 - DENS_LO) * vnoise(nx * 0.6 + 13.1, ny * 0.6 + 5.7);
            // 静态安全场：文字区 / 导航带收敛。「先裁剪再乘 keep」是关键：
            // 先 min 到 kMax 再乘 safeA[pk]，keep 才能线性地约束最终强度；
            // 若反过来（acc × keep 后再 min），4 块重叠处 acc≈3.4 会把 keep 完全吃掉。
            ks = acc * dens;
            if (ks > kMax) {
              ks = kMax;
            }
            ks *= safeA[pk];
            // 荧光增亮：叠加越强提亮越多（深色主题才有；亮色主题 fluor = 0）
            gl = 1 + fluor * smooth01(ks > 1 ? 1 : ks);
            r = b0 + (mr - b0) * ks * gl;
            g = b1 + (mg - b1) * ks * gl;
            bl = b2 + (mb - b2) * ks * gl;
          }

          // 暗角罩层
          va = vaA[pk];
          if (va > 0) {
            r += (veil[0] - r) * va;
            g += (veil[1] - g) * va;
            bl += (veil[2] - bl) * va;
          }

          // 4x4 有序抖动：抑制大片平滑渐变在放大后的色带
          dit = (BAYER[(y & 3) * 4 + (x & 3)] - 7.5) * 0.35;
          data[k] = r + dit;
          data[k + 1] = g + dit;
          data[k + 2] = bl + dit;
          data[k + 3] = 255;
        }
      }
      bctx.putImageData(img, 0, 0);        // 逐像素的场写在低分辨率缓冲里
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.drawImage(buf, 0, 0, w, h, 0, 0, SW, SH);   // 平滑放大到屏幕分辨率（与原 CSS 拉伸等价）
      // 第二层颗粒：画布内的 overlay 亮度加权胶片颗粒。
      // 为什么不加一个 mix-blend-mode 的 DOM 层：Chromium 会把参与 CSS 混合的层按更低的分辨率
      // 光栅化，实测颗粒会块化（4px 相关 lag4 0.25~0.50，普通层只有 0.05）→ 只能放在画布内合成，
      // 画布内的混合始终按画布自身分辨率逐像素进行，颗粒稳定在 1px 级。
      // overlay 是乘性混合：纯黑处 Δ≈0（黑底保持纯黑）→ 中亮处最强 → 近白处收敛，
      // 正好复现参考站「亮部颗粒约为暗部 4 倍」的胶片特征（参考站实测 亮部 4.10 / 暗部 1.02）。
      if (GRAIN_ON) {
        var pat = grainPattern();
        if (pat) {
          ctx.globalCompositeOperation = "overlay";
          ctx.globalAlpha = GRAIN_ALPHA;
          ctx.fillStyle = pat;
          ctx.translate(-gox, -goy);       // 贴图整体随机偏移 → 颗粒每帧都在动（真胶片颗粒不周期）
          ctx.fillRect(0, 0, SW + GRAIN_TILE, SH + GRAIN_TILE);
          ctx.translate(gox, goy);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = "source-over";
        }
        // 第一层颗粒（CSS 均匀底噪）也每帧整体平移 1px → 与画布颗粒叠成「会呼吸的细颗粒」
        var st = document.documentElement.style;
        st.setProperty("--grain-x", ((Math.random() * 8) | 0) + "px");
        st.setProperty("--grain-y", ((Math.random() * 8) | 0) + "px");
      }
    }

    function step(ts) {
      rafId = 0;
      if (!running) {
        return;
      }
      if (!lastTs) {
        lastTs = ts;
      }
      var dt = (ts - lastTs) / 1000;
      lastTs = ts;
      if (dt > 0.25) {
        dt = 0.25;                        // 长时间不可见后回来：不让时间跳变
      }
      elapsed += dt;
      if (ts - lastDraw >= 1000 / FPS - 2) {
        lastDraw = ts;
        draw(elapsed);
      }
      rafId = requestAnimationFrame(step);
    }

    function start() {
      if (rafId || reduced || FREEZE_T >= 0) {
        return;
      }
      running = true;
      lastTs = 0;
      rafId = requestAnimationFrame(step);
    }

    function stop() {
      running = false;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    }

    // 状态收敛：只有「未开启减少动效 + 标签页可见 + 首屏在视口内」才持续绘制，否则停笔
    function sync() {
      readPalette();
      resize();
      if (FREEZE_T >= 0) {                 // 诊断：冻结在指定相位（静态）
        stop();
        draw(FREEZE_T);
        return;
      }
      if (!reduced && tabVisible && onScreen) {
        start();
        return;
      }
      stop();
      if (tabVisible && onScreen) {
        draw(reduced ? STATIC_T : elapsed); // reduced-motion：只呈现静止的一帧
      }
    }

    if (reduceMedia) {
      var onReduceChange = function () {
        reduced = !!reduceMedia.matches;
        sync();
      };
      if (reduceMedia.addEventListener) {
        reduceMedia.addEventListener("change", onReduceChange);
      } else if (reduceMedia.addListener) {
        reduceMedia.addListener(onReduceChange);   // 旧版浏览器兜底
      }
    }

    document.addEventListener("visibilitychange", function () {
      tabVisible = !document.hidden;
      sync();
    });

    var hero = document.querySelector(".hero");
    if (window.IntersectionObserver && hero) {
      new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          onScreen = entries[i].isIntersecting;
        }
        sync();
      }, { threshold: 0 }).observe(hero);
    } else if (hero) {
      window.addEventListener("scroll", function () {
        onScreen = hero.getBoundingClientRect().bottom > 0;
        sync();
      }, { passive: true });
    }

    var resizeTimer = 0;
    window.addEventListener("resize", function () {
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
      resizeTimer = setTimeout(function () {
        resizeTimer = 0;
        if (resize()) {
          sync();
        } else if (!running) {
          draw(reduced ? STATIC_T : (FREEZE_T >= 0 ? FREEZE_T : elapsed));   // 仅高度换算到同一低分辨率时，补画一帧
        }
      }, 150);
    });

    // 主题切换后重新读取调色板（颜色始终以 CSS 变量为准）
    if (window.MutationObserver) {
      new MutationObserver(function () {
        readPalette();
        if (!running) {
          draw(FREEZE_T >= 0 ? FREEZE_T : (reduced ? STATIC_T : elapsed));
        }
      }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    }

    document.documentElement.classList.add("js-hero-canvas");
    window.__fluidDebug = function () {
      return {
        w: w, h: h, sw: SW, sh: SH, t: FREEZE_T >= 0 ? FREEZE_T : elapsed, period: PERIOD,
        blobs: NB, grain: GRAIN_ON, grainAlpha: GRAIN_ON ? GRAIN_ALPHA : 0,
        dark: !!(palette && palette.dark), kMax: palette ? palette.kMax : 0
      };
    };
    sync();
  })();

  /* ---------- 6. 魔法卡片（轮14 最初服务「技能 & 兴趣 / 项目作品 / 观点随笔」三个板块；
     轮15 撤「技能 & 兴趣」、轮21 删「观点随笔」，现仅「项目 / 作品」） ----------
     出处：Magic UI「Magic Card」（MIT，Copyright (c) Magic UI）；本站零依赖，本块为自研重写。
     本块只做一件事：把指针相对每张卡「左上角」的坐标写进该卡的 --mg-x / --mg-y（px），
     其余全部交给 CSS（描边光带 + 卡面光晕）。
     - 鼠标：pointermove 记录坐标 → requestAnimationFrame 里每帧最多写一次；
       pointerleave 把坐标推回卡外（-400px）→ 描边回落成普通 --color-border。
     - 触屏：轻触（pointerdown）在该点出光并挂 .is-magic-active，抬指 ~0.55s 后
       撤销并复位（也支持按住拖动跟随）；Class 撤销后卡片完全回到静默态。
     - 键盘 / 无指针事件 / JS 未执行：不挂监听、变量停在卡外 → 卡片就是普通描边卡片。 */

  (function initMagicCards() {
    var cards = document.querySelectorAll(".card--magic");
    if (!cards.length || !window.PointerEvent) {
      return;
    }

    var OFFSCREEN = -400;   // 卡外坐标（与 css/style.css 里 --mg-x/--mg-y 的默认值一致）
    var TOUCH_HOLD = 550;   // 触屏抬指后光晕停留时长（ms），略长于 CSS 的 0.28s 淡出

    Array.prototype.forEach.call(cards, function (card) {
      var frame = 0;         // 待写入的 requestAnimationFrame 句柄
      var next = null;       // 本帧要写入的坐标
      var px = null;         // 已写入的坐标（跳过无变化的写入）
      var py = null;
      var holdTimer = 0;

      function flush() {
        frame = 0;
        if (!next) {
          return;
        }
        if (next.x !== px || next.y !== py) {
          card.style.setProperty("--mg-x", next.x + "px");
          card.style.setProperty("--mg-y", next.y + "px");
          px = next.x;
          py = next.y;
        }
      }

      // 只记录坐标：本帧内多次 move 只保留最后一次，避免高频指针事件里反复触发布局
      function track(clientX, clientY) {
        var rect = card.getBoundingClientRect();
        next = { x: Math.round(clientX - rect.left), y: Math.round(clientY - rect.top) };
        if (!frame) {
          frame = requestAnimationFrame(flush);
        }
      }

      // 复位：丢掉落帧待写入的坐标，并把变量推回卡外（描边回落普通描边色）
      function reset() {
        if (frame) {
          cancelAnimationFrame(frame);
          frame = 0;
        }
        next = null;
        if (px !== OFFSCREEN || py !== OFFSCREEN) {
          card.style.setProperty("--mg-x", OFFSCREEN + "px");
          card.style.setProperty("--mg-y", OFFSCREEN + "px");
          px = OFFSCREEN;
          py = OFFSCREEN;
        }
      }

      card.addEventListener(
        "pointermove",
        function (e) {
          track(e.clientX, e.clientY); // 触屏按住拖动时同样跟随
        },
        { passive: true }
      );

      card.addEventListener("pointerleave", function (e) {
        if (e.pointerType !== "mouse") {
          return; // 触屏的离开不等于交互结束，交给抬指后的 holdTimer
        }
        reset();
      });

      card.addEventListener("pointerdown", function (e) {
        if (e.pointerType === "mouse") {
          return; // 鼠标路径完全交给 :hover 与 pointermove
        }
        if (holdTimer) {
          clearTimeout(holdTimer);
          holdTimer = 0;
        }
        track(e.clientX, e.clientY);
        card.classList.add("is-magic-active");
      });

      function releaseTouch() {
        if (holdTimer) {
          clearTimeout(holdTimer);
        }
        holdTimer = setTimeout(function () {
          holdTimer = 0;
          card.classList.remove("is-magic-active");
          reset();
        }, TOUCH_HOLD);
      }

      card.addEventListener("pointerup", releaseTouch);
      card.addEventListener("pointercancel", releaseTouch);
    });
  })();

  /* ---------- 7. 终页 Ready：加载动画 → 展开「联系我」并滚过去（轮18 · USR-29 / 轮18b） ---------- */
  // 你的修订口径：点 Ready → 按钮转圈（加载动画）→ 展开已并入终页的「联系我」→ 平滑滚动过去。
  // 「联系我」默认收起（hidden）；它其中的 .copy-email 已被第 4 节的统一绑定接管。
  var readyBtn = document.getElementById("readyBtn");
  var contactBlock = document.getElementById("contact");
  var REDUCED_MOTION =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var READY_DELAY = 900; // 加载动画时长（ms）；降低动态效果时跳过度等待

  function revealContact() {
    if (!contactBlock || !contactBlock.hidden) {
      return;
    }
    contactBlock.hidden = false;
    contactBlock.setAttribute("data-revealed", "true");
    if (readyBtn) {
      readyBtn.setAttribute("aria-expanded", "true");
    }
  }

  // 滚到「联系我」：自己算位置，避开吸顶导航遮挡（原生锚点在嵌套元素上会顶到视口最上沿）
  function scrollToContact(behavior) {
    if (!contactBlock) {
      return;
    }
    var header = document.querySelector(".header");
    var headerH = header ? header.offsetHeight : 0;
    var top =
      contactBlock.getBoundingClientRect().top + window.scrollY - headerH - 16;
    window.scrollTo({ top: top < 0 ? 0 : top, behavior: behavior });
  }

  if (readyBtn && contactBlock) {
    var readyBusy = false;

    readyBtn.addEventListener("click", function () {
      // 已经展开过：不再播动画，直接滚过去
      if (!contactBlock.hidden) {
        scrollToContact(REDUCED_MOTION ? "auto" : "smooth");
        return;
      }
      if (readyBusy) {
        return;
      }
      readyBusy = true;
      readyBtn.classList.add("is-loading");
      readyBtn.setAttribute("aria-busy", "true");

      setTimeout(function () {
        revealContact();
        readyBtn.classList.remove("is-loading");
        readyBtn.removeAttribute("aria-busy");
        readyBusy = false;
        scrollToContact(REDUCED_MOTION ? "auto" : "smooth");
      }, REDUCED_MOTION ? 0 : READY_DELAY);
    });
  }

  // 站内任何指向 #contact 的链接（导航「Contact」、header 栏主按钮「联系我」，
  // 后者 ≤1024px 由既有设计隐藏）：若「联系我」还没展开，先展开再滚过去
  // —— 否则浏览器无法滚到 display:none 的目标
  Array.prototype.forEach.call(
    document.querySelectorAll('a[href="#contact"]'),
    function (link) {
      link.addEventListener("click", function (event) {
        if (!contactBlock || !contactBlock.hidden) {
          return; // 已展开：交回浏览器原生锚点行为
        }
        event.preventDefault();
        revealContact();
        scrollToContact("auto");
      });
    }
  );
})();
