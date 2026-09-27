/* ============================================================
   「我的会客厅」留言板脚本（轮20 · USR-31）
   - 数据源：读 js/living-room-config.js —— 填了 Supabase 走云端共享；
     留空则回退本机 localStorage（页面与交互照常可用）
   - 零第三方库：用浏览器原生 fetch 直连 Supabase 的 PostgREST 接口
     （不引入 supabase-js，保持「零依赖」的课程约束）
   - 零 innerHTML：昵称与留言一律 textContent 写进 DOM，从源头杜绝 XSS
   - 新留言以「落座」动效在墙顶浮现（对应 css/style.css 的 .note--new）
   ============================================================ */
(function () {
  "use strict";

  /* ---------- 0. 元素与配置 ---------- */
  var wall = document.getElementById("parlorWall");
  var form = document.getElementById("parlorForm");
  var nameInput = document.getElementById("parlorName");
  var msgInput = document.getElementById("parlorMsg");
  var sendBtn = document.getElementById("parlorSend");
  var countEl = document.getElementById("parlorCount");
  var statusEl = document.getElementById("parlorStatus");
  var hintEl = document.getElementById("parlorHint");
  var emptyEl = document.getElementById("parlorEmpty");

  // 页面里没有会客厅板块（元素不全）时静默退出，不影响其它脚本
  if (!wall || !form || !nameInput || !msgInput || !sendBtn || !countEl || !statusEl || !hintEl) {
    return;
  }

  var cfg = window.LIVING_ROOM_CONFIG || {};
  var table = cfg.table || "messages";
  var baseUrl = String(cfg.supabaseUrl || "").replace(/\/+$/, "");
  var anonKey = String(cfg.supabaseAnonKey || "");

  // 两项都填了才走云端；否则一律本机模式（避免半配置状态下页面报错）
  var IS_CLOUD = /^https?:\/\//.test(baseUrl) && anonKey.length > 40;

  var LOCAL_KEY = "living-room-messages"; // 本机留言
  var NICK_KEY = "living-room-nickname"; // 只记住昵称，不记留言正文
  var NICK_MAX = 16;
  var BODY_MAX = 200;
  var KEEP_MAX = 100; // 本机模式最多保留的留言条数

  var items = []; // 内存中的留言列表（与墙上的顺序一致：最新的在最上面）
  var busy = false;

  /* ---------- 1. 通用小工具 ---------- */
  function toast(message) {
    if (typeof window.showToast === "function") {
      window.showToast(message);
    }
  }

  function setStatus(message, isWarn) {
    statusEl.textContent = message || "";
    if (isWarn) {
      statusEl.classList.add("is-warn");
    } else {
      statusEl.classList.remove("is-warn");
    }
  }

  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function toDate(value) {
    var d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  // 备注行上的时间：会客厅口径（刚刚 / N 分钟前 / … / 日期）
  function formatTime(value) {
    var d = toDate(value);
    if (!d) {
      return "";
    }
    var diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) {
      return "刚刚";
    }
    if (diff < 3600) {
      return Math.floor(diff / 60) + " 分钟前";
    }
    if (diff < 86400) {
      return Math.floor(diff / 3600) + " 小时前";
    }
    if (diff < 172800) {
      return "昨天";
    }
    if (diff < 2592000) {
      return Math.floor(diff / 86400) + " 天前";
    }
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  // 悬停提示用的完整时间（精确到分钟）
  function formatFull(value) {
    var d = toDate(value);
    if (!d) {
      return "";
    }
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) + " " +
      pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }

  /* ---------- 2. 渲染 ---------- */
  function normalize(row) {
    return {
      id: row && row.id !== undefined && row.id !== null ? row.id : "",
      nickname: String((row && row.nickname) || "").slice(0, NICK_MAX),
      body: String((row && row.body) || ""),
      created_at: (row && row.created_at) || ""
    };
  }

  // 一条留言 = 一张便签：备注行（小伙伴标签 + 昵称 + 时间）+ 留言正文
  function makeNote(item, isNew) {
    var li = document.createElement("li");
    li.className = isNew ? "note note--new" : "note";

    var meta = document.createElement("p");
    meta.className = "note__meta";

    var tag = document.createElement("span");
    tag.className = "note__tag";
    tag.textContent = "小伙伴";

    var who = document.createElement("span");
    who.className = "note__who";
    who.textContent = item.nickname || "匿名访客";

    var time = document.createElement("span");
    time.className = "note__time";
    time.textContent = formatTime(item.created_at);
    var full = formatFull(item.created_at);
    if (full) {
      time.title = full;
    }

    meta.appendChild(tag);
    meta.appendChild(who);
    meta.appendChild(time);

    var body = document.createElement("p");
    body.className = "note__body";
    // 关键：纯文本写入。留言内容里即使写了 <script> / <img onerror> 也只会原样显示
    body.textContent = item.body;

    li.appendChild(meta);
    li.appendChild(body);
    return li;
  }

  function updateCount() {
    countEl.textContent = items.length
      ? items.length + " 位小伙伴来过"
      : "还没有小伙伴来过";
  }

  function renderAll() {
    var i;
    var node;
    // 只清便签，空态便签本身始终留在墙内 —— 它靠 hidden 随「有没有留言」切换，
    // 这样它既不会脱离 DOM（外部随时可查），留言被清空时也能自己回到墙上
    for (i = wall.childNodes.length - 1; i >= 0; i--) {
      node = wall.childNodes[i];
      if (node.nodeType === 1 && node.classList.contains("note")) {
        wall.removeChild(node);
      }
    }
    for (i = 0; i < items.length; i++) {
      wall.appendChild(makeNote(items[i], false));
    }
    if (emptyEl) {
      if (emptyEl.parentNode !== wall) {
        wall.appendChild(emptyEl); // 空态便签排在所有留言之后（只在没有留言时可见）
      }
      emptyEl.hidden = items.length > 0;
    }
    updateCount();
  }

  // 新留言插到墙顶并播放「落座」动效（只有这一条带动效，其余保持静止）
  function prependNote(item) {
    if (emptyEl) {
      emptyEl.hidden = true; // 有第一位访客落座，空态便签收起（节点仍在墙内）
    }
    wall.insertBefore(makeNote(item, true), wall.firstChild);
    updateCount();
    wall.scrollTop = 0; // 新便签贴在墙顶：滚动容器里也一定看得见
  }

  /* ---------- 3. 本机模式（localStorage） ---------- */
  function localRead() {
    try {
      var raw = window.localStorage.getItem(LOCAL_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Object.prototype.toString.call(parsed) === "[object Array]" ? parsed : [];
    } catch (e) {
      return null; // null = 本机存储不可用（隐私模式 / 禁用存储）
    }
  }

  function localWrite(list) {
    try {
      window.localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ---------- 4. 云端模式（Supabase PostgREST） ---------- */
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

  // 把云端错误翻译成「下一步该做什么」，避免访客只看到一串英文报错
  function cloudFail(label, detail) {
    var extra = "";
    if (/column .* does not exist|PGRST204|42703/i.test(detail)) {
      // 表在，但列名对不上（多半是旧表 / 模板表占位，建表 SQL 被 if not exists 跳过了）
      extra = "（messages 表结构对不上：表里没有 nickname / body 列——旧表请先 drop 再执行指引里的建表 SQL）";
    } else if (/does not exist|PGRST205|schema cache|relation|Could not find the table/i.test(detail)) {
      extra = "（看起来还没建表：请在 Supabase 的 SQL Editor 里执行指引中的建表 SQL）";
    } else if (/Invalid API key|No API key|JWT|401/i.test(detail)) {
      extra = "（anon key 看起来无效：请核对 Project Settings → API 里的 anon public）";
    } else if (/Failed to fetch|NetworkError|Load failed|ERR_/i.test(detail)) {
      extra = "（先确认网络能访问 Supabase 域名）";
    }
    setStatus(label + "：" + detail + extra, true);
  }

  function loadCloud() {
    return window.fetch(
      baseUrl + "/rest/v1/" + encodeURIComponent(table) +
      "?select=id,nickname,body,created_at&order=created_at.desc&limit=60",
      {
        headers: { apikey: anonKey, Authorization: "Bearer " + anonKey },
        cache: "no-store"
      }
    ).then(function (res) {
      if (!res.ok) {
        return cloudError(res).then(function (message) {
          throw new Error(message);
        });
      }
      return res.json();
    }).then(function (rows) {
      items = rows.map(normalize);
      renderAll();
      setStatus("", false);
    });
  }

  function sendCloud(nickname, body) {
    return window.fetch(baseUrl + "/rest/v1/" + encodeURIComponent(table), {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: "Bearer " + anonKey,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({ nickname: nickname, body: body })
    }).then(function (res) {
      if (!res.ok) {
        return cloudError(res).then(function (message) {
          throw new Error(message);
        });
      }
      return res.json();
    }).then(function (rows) {
      if (Object.prototype.toString.call(rows) === "[object Array]" && rows.length) {
        return rows[0];
      }
      // 极端兜底：写入成功但没回传行数据时，本地拼一条同等结构的留言
      return { id: "", nickname: nickname, body: body, created_at: new Date().toISOString() };
    });
  }

  /* ---------- 5. 提交 ---------- */
  function commit(row) {
    items.unshift(row);
    if (items.length > KEEP_MAX) {
      items.length = KEEP_MAX;
    }
    prependNote(row);
    if (!IS_CLOUD && !localWrite(items)) {
      setStatus("本机存储不可用（可能是隐私模式），这条留言只在本次浏览中可见。", true);
    }
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (busy) {
      return;
    }

    var nickname = (nameInput.value || "").replace(/\s+/g, " ").trim().slice(0, NICK_MAX);
    var body = (msgInput.value || "").trim().slice(0, BODY_MAX);

    if (!body) {
      toast("先写点什么再留言吧～");
      msgInput.focus();
      return;
    }

    busy = true;
    sendBtn.disabled = true;
    sendBtn.textContent = "贴上墙…";

    var localRow = {
      id: "local-" + Date.now(),
      nickname: nickname,
      body: body,
      created_at: new Date().toISOString()
    };
    var task = IS_CLOUD ? sendCloud(nickname, body) : Promise.resolve(localRow);

    task.then(function (row) {
      commit(normalize(row));
      msgInput.value = "";
      setStatus("", false);
      if (nickname) {
        try {
          window.localStorage.setItem(NICK_KEY, nickname);
        } catch (e) {
          /* 记不住昵称不影响留言 */
        }
      }
      toast("留言已贴到墙上，谢谢你来做客！");
    }).catch(function (err) {
      var detail = err && err.message ? err.message : String(err);
      if (IS_CLOUD) {
        cloudFail("留言发送失败", detail);
      } else {
        setStatus("留言没能保存：" + detail, true);
      }
      toast("留言没发出去，再试一次吧");
    }).then(function () {
      busy = false;
      sendBtn.disabled = false;
      sendBtn.textContent = "留言";
    });
  });

  /* ---------- 6. 启动 ---------- */
  // 昵称回填：同一位小伙伴下次再来不用重打（只存昵称）
  try {
    var savedNick = window.localStorage.getItem(NICK_KEY);
    if (savedNick) {
      nameInput.value = savedNick.slice(0, NICK_MAX);
    }
  } catch (e) {
    /* 忽略 */
  }

  if (IS_CLOUD) {
    wall.setAttribute("data-mode", "cloud");
    hintEl.textContent = "云端留言板:会客厅的麦克风交给你啦!!";
    setStatus("正在读取云端留言…", false);
    loadCloud().catch(function (err) {
      wall.setAttribute("data-mode", "cloud-error");
      cloudFail("云端留言读取失败", err && err.message ? err.message : String(err));
      items = [];
      renderAll();
    });
  } else {
    wall.setAttribute("data-mode", "local");
    hintEl.textContent = "本机留言模式：留言只保存在你自己的浏览器里（在 js/living-room-config.js 填好 Supabase 配置即切换为云端共享）。";
    var local = localRead();
    items = (local || []).map(normalize);
    renderAll();
    if (local === null) {
      setStatus("这台设备的浏览器不允许本地存储（可能开了隐私模式），留言只能保留在本次浏览中。", true);
    }
  }

  // 备注行上的相对时间每分钟自己走一格（不重新拉取数据、不重排布局）
  window.setInterval(function () {
    var notes = wall.querySelectorAll(".note");
    for (var i = 0; i < notes.length && i < items.length; i++) {
      var timeEl = notes[i].querySelector(".note__time");
      if (timeEl) {
        timeEl.textContent = formatTime(items[i].created_at);
      }
    }
  }, 60000);
})();
