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
     · 防重复提交：提交中加锁 + 同一段内容 20 秒内不重复发送；
     · 失败自证：网络层失败时自动做一次同域名轻量探测，区分
                 「访问不到反馈服务器」与「提交被浏览器拦下」，并直接给出下一步（见 A 节）。
   改动记录：轮32（V3）新建；轮36（V3）新增失败自证（离线 / 超时 / 探测 · 四档可执行提示）。
   ============================================================ */
(function () {
  "use strict";

  /* ---------- A. 失败自证（纯函数 · 不碰 DOM · 可在无浏览器环境单测） ---------- */
  // 提交失败时，访客最想知道的是「下一步做什么」。这里把网络层失败分成四档，
  // 每档只给一句结论 + 一个可执行动作；判定顺序先窄后宽：离线 → 超时 →
  // 探测不通（访问不到服务器）→ 探测通过（服务器能访问，提交被浏览器拦下）。
  // 该函数只吃「探测结果」，不发请求、不碰 DOM，因此可以用 cscript 跑判定表。
  var FAIL_TEXT = {
    offline: "设备当前好像没有联网。请连上网络后再试一次。",
    timeout: "请求发出后一直没有回应（网络很慢，或被中途拦下）。可以换用手机流量或换一个浏览器再试一次。",
    unreachable: "当前网络访问不到反馈服务器（校园网 / 公司网屏蔽，或浏览器自带的拦截、云加速都会这样）。可以换一个网络（例如手机流量）、换一个浏览器再试；也可以直接用下面的邮箱发给我。",
    blocked: "反馈服务器能访问，但这条提交被浏览器拦下了（自带广告拦截 / 云加速的浏览器常见）。请换 Chrome 或 Safari 再试，也可以直接用下面的邮箱发给我。"
  };

  function diagnoseFail(env) {
    env = env || {};
    if (env.online === false) {
      return FAIL_TEXT.offline;
    }
    if (env.timeout) {
      return FAIL_TEXT.timeout;
    }
    if (env.probe === "fail") {
      return FAIL_TEXT.unreachable;
    }
    if (env.probe === "ok") {
      return FAIL_TEXT.blocked;
    }
    return "";
  }

  // 挂到 window：一是便于 cscript 离线判定表单测，二是便于日后在控制台自查
  window.FEEDBACK_DIAG = { diagnoseFail: diagnoseFail, texts: FAIL_TEXT };

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
    // ② 列名对不上，必须排在「未建表」之前：PostgREST 的原话
    //    （Could not find the 'content' column of 'feedback' in the schema cache）里含 schema cache，
    //    顺序反了会被下一条抢走，把「列名不匹配」误报成「还没建表」。
    //    另外 cloudError() 只拼了 HTTP 状态与 message、不带 PGRST 错误码，
    //    所以这里必须认措辞（Could not find the ... column）；只认 PGRST204 会永不命中。
    if (/column .* does not exist|Could not find the .* column|PGRST204|42703/i.test(detail)) {
      return "（feedback 表的列名对不上：请核对指引里的建表 SQL）";
    }
    // ③ 表不存在。这里不再用裸 relation 做匹配，避免误伤上面那两类报错。
    if (/does not exist|PGRST205|schema cache|Could not find the table/i.test(detail)) {
      return "（看起来还没建表：请在 Supabase 的 SQL Editor 里执行指引中的建表 SQL）";
    }
    if (/permission denied|42501|row-level security|violates row-level/i.test(detail)) {
      return "（feedback 表的写入权限没打开：请核对指引里的 RLS 策略与 grant 语句）";
    }
    if (/Invalid API key|No API key|JWT|401/i.test(detail)) {
      return "（publishable key 看起来无效：请核对 Project Settings → API Keys 里的 publishable key）";
    }
    // 网络层（无响应）现在由 A 节 diagnoseFail() 给出更具体的结论；
    // 这里保留一条兜底，措辞与 A 节保持一致，避免出现两套说法。
    if (/Failed to fetch|NetworkError|Load failed|ERR_|timeout/i.test(detail)) {
      return "（设备到反馈服务器的连接没能建立：可换一个网络（例如手机流量）或换一个浏览器再试；也可以直接用下面的邮箱发给我）";
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
  var SEND_TIMEOUT = 12000;  // 单次提交最多等 12 秒，超时按「网络无响应」归类
  var PROBE_TIMEOUT = 6000;  // 同域名探测最多等 6 秒
  var failSeq = 0;           // 失败序号：防止迟到的探测结论覆盖更新的状态

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

  function timeoutError() {
    var err = new Error("timeout");
    err.isTimeout = true;
    return err;
  }

  function sendCloud(payload) {
    // 12 秒上限：网络被中途掐断时，浏览器可能长时间挂着不报错。
    // 用 AbortController 真正中止请求；浏览器不支持时只做「超时判定」。
    var controller = (typeof AbortController === "function") ? new AbortController() : null;
    var timer = null;
    var options = {
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
    };
    if (controller) {
      options.signal = controller.signal;
    }

    var guard = new Promise(function (resolve, reject) {
      timer = setTimeout(function () {
        if (controller) {
          try {
            controller.abort();
          } catch (e) {
            /* 中止失败不影响下面的超时判定 */
          }
        }
        reject(timeoutError());
      }, SEND_TIMEOUT);
    });

    var request = window.fetch(baseUrl + "/rest/v1/" + encodeURIComponent(table), options)
      .then(function (res) {
        if (!res.ok) {
          return cloudError(res).then(function (message) {
            throw new Error(message);
          });
        }
        return true;
      });

    // 谁先结束谁生效；另一条的「迟到拒绝」在这里就地吞掉，
    // 避免控制台出现 Unhandled rejection 噪音（项目探针要求 __errs 为空）。
    request.catch(function () { /* 见上 */ });
    guard.catch(function () { /* 见上 */ });

    return Promise.race([request, guard]).then(function (result) {
      clearTimeout(timer);
      return result;
    }, function (err) {
      clearTimeout(timer);
      throw err;
    });
  }

  // 同域名轻量探测：no-cors + 不带 apikey，只求「连接是否建立」。
  // 能拿到响应（哪怕是 401）就算「能访问」；抛错则视为「访问不到」。
  // 它区分的是「网络/浏览器拦截」与「仅提交被拦」，读不到内容也不需要读。
  function probeHost() {
    var timer = null;
    var guard = new Promise(function (resolve) {
      timer = setTimeout(function () {
        resolve("fail");
      }, PROBE_TIMEOUT);
    });
    var probe = window.fetch(baseUrl + "/rest/v1/", {
      method: "GET",
      mode: "no-cors",
      cache: "no-store"
    }).then(function () {
      return "ok";
    }, function () {
      return "fail";
    });
    guard.catch(function () { /* 见上 */ });
    return Promise.race([probe, guard]).then(function (result) {
      clearTimeout(timer);
      return result;
    });
  }

  // 结论 + 原始英文错误：结论好懂，原始错误留作日后排查的线索
  function showDiag(text, detail) {
    var tail = detail ? "（技术详情：" + detail + "）" : "";
    setStatus("反馈没能发出去：" + text + tail, "warn");
    showFallback(true);
  }

  // 把「原始错误」翻译成访客能照做的提示：
  //   有 HTTP 响应 → 沿用既有 explain()（权限 / 表 / 格式 / 列名 / 键）；
  //   没有响应（网络层）→ 走 A 节 diagnoseFail()，必要时先探测一次再下结论。
  function failWith(err) {
    var detail = (err && err.message) ? err.message : String(err);
    var seq = ++failSeq;
    var online = (typeof navigator === "undefined" || navigator.onLine !== false);

    // ① 超时：请求发出去一直没有回应
    if (err && err.isTimeout) {
      showDiag(diagnoseFail({ online: online, timeout: true }), detail);
      return;
    }

    // ② 有 HTTP 响应：服务器已经回话，这一段沿用原有格式（含 HTTP 状态码与原文）
    if (!/Failed to fetch|NetworkError|Load failed|ERR_/i.test(detail)) {
      setStatus("反馈没能发出去：" + detail + explain(detail), "warn");
      showFallback(true);
      return;
    }

    // ③ 没联网：直接下结论，不额外发探测请求
    if (!online) {
      showDiag(diagnoseFail({ online: false }), detail);
      return;
    }

    // ④ 联网但没拿到响应：先探测同域名，再区分「访问不到」与「提交被拦」
    setStatus("反馈没能发出去：正在确认原因…", "warn");
    showFallback(true);
    probeHost().then(function (probe) {
      if (seq !== failSeq) {
        return; // 期间访客已重试或已有更新结论，丢弃这次结果
      }
      showDiag(diagnoseFail({ online: online, probe: probe }), detail);
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
      failWith(err);
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
