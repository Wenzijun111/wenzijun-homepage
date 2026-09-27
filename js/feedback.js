/* ============================================================
   V3 私密反馈（课程需求 CRS-5 · 轮32 新建）
   ------------------------------------------------------------
   一个「只有站主能看」的反馈通道，与公开的会客厅留言墙是两套东西：
     · 会客厅留言墙 = 公开互动（访客能看见彼此）；
     · 本表单     = 私密反馈（访客写给我一个人看，页面上不会有任何回显列表）。
   数据落点：Supabase 的 feedback 表，行级安全里只开了一条 INSERT 策略，
   所以浏览器端只能「写入」，读不到、改不了、删不掉任何一条内容。
   配套说明见 docs/指引：V3 私密反馈-云端接入四步走.md。

   实现约定（与 js/living-room.js 同一口径）：
     · 零第三方库：原生 fetch 直连 Supabase PostgREST，不引入 supabase-js；
     · 零 innerHTML：所有用户输入一律 textContent 写进 DOM（从源头杜绝 XSS）；
     · 提交过程：提交中禁用按钮并改文案 → 成功才提示并清空；
                 失败保留已输入内容并给出「下一步该做什么」，绝不假装成功；
     · 防重复提交：提交中加锁 + 同一段内容 20 秒内不重复发送。
   改动记录：轮32（V3）新建。
   ============================================================ */
(function () {
  "use strict";

  /* ---------- 0. 元素与配置 ---------- */
  var entry = document.getElementById("fbEntry");
  var overlay = document.getElementById("fbOverlay");
  var closeBtn = document.getElementById("fbClose");
  var form = document.getElementById("fbForm");
  var nameInput = document.getElementById("fbName");
  var relationSelect = document.getElementById("fbRelation");
  var deviceSelect = document.getElementById("fbDevice");
  var msgInput = document.getElementById("fbMessage");
  var countEl = document.getElementById("fbCount");
  var statusEl = document.getElementById("fbStatus");
  var sendBtn = document.getElementById("fbSend");
  var fallbackEl = document.getElementById("fbFallback");
  var fallbackMail = document.getElementById("fbFallbackMail");

  // 首页没有这套元素（例如副页面）时静默退出，不影响其它脚本
  if (!entry || !overlay || !closeBtn || !form || !nameInput || !relationSelect ||
      !deviceSelect || !msgInput || !statusEl || !sendBtn) {
    return;
  }

  var cfg = window.FEEDBACK_CONFIG || {};
  var table = cfg.table || "feedback";
  var baseUrl = String(cfg.supabaseUrl || "").replace(/\/+$/, "");
  var publishableKey = String(cfg.supabasePublishableKey || "");
  var version = String(cfg.version || "V2");
  var ownerEmail = String(cfg.ownerEmail || "");

  // 两项都填了才走云端；否则进入「未接通」状态：如实告知 + 给邮件兜底，不假装发送成功
  var IS_CLOUD = /^https?:\/\//.test(baseUrl) && publishableKey.length > 20;

  var NAME_MAX = 24;
  var BODY_MAX = 1000;
  var NAME_KEY = "feedback-name"; // 只记称呼，方便同一位访客下次再来；不记反馈正文
  var DUP_WINDOW = 20000;         // 同一段内容 20 秒内视为重复提交

  var busy = false;
  var lastFocus = null;           // 关闭后把焦点还给入口按钮
  var lastSent = { text: "", at: 0 };

  /* ---------- 1. 通用小工具 ---------- */
  function toast(message) {
    if (typeof window.showToast === "function") {
      window.showToast(message);
    }
  }

  function setStatus(message, kind) {
    statusEl.textContent = message || "";
    statusEl.classList.remove("is-warn", "is-ok");
    if (kind === "warn") {
      statusEl.classList.add("is-warn");
    } else if (kind === "ok") {
      statusEl.classList.add("is-ok");
    }
  }

  // 兜底邮件行的显隐（只在需要人工兜底时才出现）
  function showFallback(show) {
    if (fallbackEl) {
      fallbackEl.hidden = !show;
    }
  }

  // 把云端错误翻译成「下一步该做什么」，避免访客只看到一串英文报错。
  // 规则顺序有讲究：先窄后宽，否则宽泛规则会把具体错误盖掉。
  function explain(detail) {
    // ① 约束没通过，必须排在「未建表」之前 —— 这句话里也含 relation 一词
    //    （new row for relation "feedback" violates check constraint ...），
    //    顺序反了会把「内容不合格式」误报成「还没建表」，把人引到错方向。
    if (/23514|violates check constraint/i.test(detail)) {
      return "（这条内容没通过后台的格式校验：多为关系/设备选项不在允许范围，或字数超出限制）";
    }
    // ② 表不存在。这里不再用裸 relation 做匹配，避免误伤上面那类报错。
    if (/does not exist|PGRST205|schema cache|Could not find the table/i.test(detail)) {
      return "（看起来还没建表：请在 Supabase 的 SQL Editor 里执行指引中的建表 SQL）";
    }
    if (/column .* does not exist|PGRST204|42703/i.test(detail)) {
      return "（feedback 表的列名对不上：请核对指引里的建表 SQL）";
    }
    if (/permission denied|42501|row-level security|violates row-level/i.test(detail)) {
      return "（feedback 表的写入权限没打开：请核对指引里的 RLS 策略与 grant 语句）";
    }
    if (/Invalid API key|No API key|JWT|401/i.test(detail)) {
      return "（publishable key 看起来无效：请核对 Project Settings → API Keys 里的 publishable key）";
    }
    if (/Failed to fetch|NetworkError|Load failed|ERR_|timeout/i.test(detail)) {
      return "（先确认网络能访问 Supabase 域名，再试一次）";
    }
    return "";
  }

  // 自动识别当前设备类型，作为下拉框的默认值（访客可改）
  function detectDevice() {
    var ua = navigator.userAgent || "";
    var touchPoints = navigator.maxTouchPoints || 0;
    // iPadOS 13+ 的 UA 伪装成 Macintosh，靠触点数量把它认回来
    if (/Macintosh/i.test(ua) && touchPoints > 1) {
      return "平板";
    }
    if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
      return "平板";
    }
    if (/Mobi|Android|iPhone|iPod|Windows Phone/i.test(ua)) {
      return "手机";
    }
    return "电脑";
  }

  function updateCount() {
    if (!countEl) {
      return;
    }
    var used = (msgInput.value || "").length;
    countEl.textContent = used ? used + " / " + BODY_MAX + " 字" : "最多 " + BODY_MAX + " 字";
  }

  /* ---------- 2. 开合面板 ---------- */
  function openPanel() {
    lastFocus = document.activeElement;
    overlay.hidden = false;
    entry.setAttribute("aria-expanded", "true");
    document.body.classList.add("no-scroll"); // 复用站点已有的滚动锁
    nameInput.focus();
  }

  function closePanel() {
    overlay.hidden = true;
    entry.setAttribute("aria-expanded", "false");
    document.body.classList.remove("no-scroll");
    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus();
    } else {
      entry.focus();
    }
  }

  entry.addEventListener("click", function () {
    if (overlay.hidden) {
      openPanel();
    } else {
      closePanel();
    }
  });

  closeBtn.addEventListener("click", closePanel);

  // 点遮罩空白处关闭：只在点到遮罩自身（不是面板内部）时才关
  overlay.addEventListener("click", function (event) {
    if (event.target === overlay) {
      closePanel();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !overlay.hidden) {
      closePanel();
    }
  });

  msgInput.addEventListener("input", updateCount);

  /* ---------- 3. 提交 ---------- */
  function cloudError(res) {
    return res.text().then(function (text) {
      var message = "HTTP " + res.status;
      try {
        var parsed = JSON.parse(text);
        if (parsed && (parsed.message || parsed.hint || parsed.details)) {
          message += "：" + (parsed.message || parsed.hint || parsed.details);
        }
      } catch (e) {
        if (text) {
          message += "：" + text.slice(0, 140);
        }
      }
      return message;
    });
  }

  function sendCloud(payload) {
    return window.fetch(baseUrl + "/rest/v1/" + encodeURIComponent(table), {
      method: "POST",
      headers: {
        apikey: publishableKey,
        Authorization: "Bearer " + publishableKey,
        "Content-Type": "application/json",
        // return=minimal：只要「写进去了」这个结果，不需要把整行读回来。
        // 访客本来就没有读取权限（RLS 只开 INSERT），若用 return=representation
        // 反而会因为缺读权限而失败——这一点是本表的权限设计决定的。
        Prefer: "return=minimal"
      },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (!res.ok) {
        return cloudError(res).then(function (message) {
          throw new Error(message);
        });
      }
      return true;
    });
  }

  function done(message) {
    busy = false;
    sendBtn.disabled = false;
    sendBtn.textContent = "发送反馈";
    setStatus(message, "ok");
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (busy) {
      return; // 提交中：直接忽略重复点击
    }

    var name = (nameInput.value || "").replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
    var relation = relationSelect.value || "";
    var device = deviceSelect.value || "其他";
    var message = (msgInput.value || "").trim().slice(0, BODY_MAX);

    if (!relation) {
      setStatus("请先选择你与站主的关系", "warn");
      relationSelect.focus();
      return;
    }
    if (!message) {
      setStatus("反馈内容还没写呢，写点什么再发送吧～", "warn");
      msgInput.focus();
      return;
    }

    // 防重复提交（第二道）：同一段内容短时间内不重复发送
    if (lastSent.text === relation + "|" + device + "|" + message && Date.now() - lastSent.at < DUP_WINDOW) {
      setStatus("这条反馈刚刚已经发送过了，不用重复提交～", "ok");
      return;
    }

    if (!IS_CLOUD) {
      // 未接通云端：如实说明，并把邮箱兜底亮出来（绝不显示「发送成功」）
      setStatus("反馈通道还没接通（缺少 Supabase 配置），这条内容没有被发送。", "warn");
      showFallback(true);
      return;
    }

    busy = true;
    sendBtn.disabled = true;
    sendBtn.textContent = "发送中…";
    setStatus("正在发送…", "");

    // 组装这一行：name 选填（空则留 NULL），version 由配置自动按当前页面版本带上
    var payload = {
      name: name || null,
      relation: relation,
      device: device,
      message: message,
      version: version
    };

    sendCloud(payload).then(function () {
      lastSent = { text: relation + "|" + device + "|" + message, at: Date.now() };
      msgInput.value = "";
      updateCount();
      showFallback(false);
      done("已收到你的反馈，谢谢！这条内容只有站主能看到。");
      toast("反馈已发送，谢谢你！");
      try {
        if (name) {
          window.localStorage.setItem(NAME_KEY, name);
        }
      } catch (e) {
        /* 记不住称呼不影响发送 */
      }
    }).catch(function (err) {
      // 失败：保留访客已经写好的全部内容，只提示原因与下一步
      var detail = err && err.message ? err.message : String(err);
      setStatus("反馈没能发出去：" + detail + explain(detail), "warn");
      showFallback(true);
      toast("没发出去，内容还在，可以再试一次");
    }).then(function () {
      if (busy) {
        // 成功分支已在 done() 里复位；这里只兜住失败分支
        busy = false;
        sendBtn.disabled = false;
        sendBtn.textContent = "发送反馈";
      }
    });
  });

  /* ---------- 4. 启动 ---------- */
  // 兜底邮箱：统一从配置里取，避免「配置改了、页面文案没跟上」
  if (fallbackMail && ownerEmail) {
    fallbackMail.href = "mailto:" + ownerEmail;
    fallbackMail.textContent = ownerEmail;
  }

  deviceSelect.value = detectDevice();
  updateCount();
  overlay.hidden = true;

  // 称呼回填：同一位访客下次再来不用重打（只存称呼）
  try {
    var savedName = window.localStorage.getItem(NAME_KEY);
    if (savedName) {
      nameInput.value = savedName.slice(0, NAME_MAX);
    }
  } catch (e) {
    /* 忽略 */
  }

  if (!IS_CLOUD) {
    setStatus("反馈通道还没接通（缺少 Supabase 配置），暂时无法发送。", "warn");
    showFallback(true);
  }
})();
