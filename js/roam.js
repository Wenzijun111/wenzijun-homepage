/* ============================================================
   副页面共用脚本 · 音乐探索（music.html）/ 生活漫游（life.html）（轮22）
   ------------------------------------------------------------
   两个页面共用本脚本，按「页面上是否存在对应元素」自动启用各自模块：
     ① 标记「JS 可用」→ 渐显样式只在 .js 下生效，脚本挂掉时内容照常全显；
     ② 滚动渐显：IntersectionObserver 优先，缺失则直接全显；另有 1.5s 兜底；
     ③ 顶部滚动进度光带（#roamProgress）：把滚动进度映射为 scaleX，只改 transform；
     ④ 音乐探索页 · 流派关系图谱：点击 / 键盘选中流派 → 右侧面板平滑切换内容，
        同时提亮该流派的全部关联线（直观展示「流派互相影响、彼此融合」）；
        悬浮 / 聚焦 → 关联线淡亮 + 节点弹出极简气质短句（短句显隐本身是纯 CSS）；
     ⑤ 生活漫游页 · 八大兴趣翻牌卡：点击 / 回车 / 空格切换正反面（aria-pressed 同步）；
     ⑥ 生活漫游页 · 卡片横向轨道：滚轮横滑 / 鼠标拖动 / 左右按钮 / 键盘聚焦带入视野，
        并同步两端渐变遮罩状态（是否还能往左 / 往右滑）。
   不做的事：不写 localStorage（主题跟随主线，已在各页 <head> 首帧应用）、
             不引入任何第三方库、不用 innerHTML 写内容（流派文案一律 textContent 写入）。
   ============================================================ */
(function () {
  "use strict";

  var doc = document;
  var root = doc.documentElement;

  /* ① JS 可用标记 */
  root.classList.add("js");

  var reduceMotion = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  /* ② 滚动渐显 */
  var items = Array.prototype.slice.call(doc.querySelectorAll("[data-reveal]"));

  function showAll() {
    for (var i = 0; i < items.length; i++) {
      items[i].classList.add("is-in");
    }
  }

  if (reduceMotion || !window.IntersectionObserver) {
    showAll();
  } else {
    /* threshold 取 0：只要元素任意一部分越过「视口下沿上方 10%」这条线就渐显。
       原因同 journey.js：页面底部很短的元素按比例判定可能永远不达标。 */
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          entries[i].target.classList.add("is-in");
          io.unobserve(entries[i].target);
        }
      }
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0 });

    for (var j = 0; j < items.length; j++) {
      io.observe(items[j]);
    }

    window.setTimeout(function () {
      var limit = window.innerHeight * 1.2;
      for (var k = 0; k < items.length; k++) {
        if (items[k].getBoundingClientRect().top < limit) {
          items[k].classList.add("is-in");
        }
      }
    }, 1500);
  }

  /* ③ 顶部滚动进度光带 */
  var bar = doc.getElementById("roamProgress");

  function paintProgress() {
    if (!bar) {
      return;
    }
    var max = root.scrollHeight - root.clientHeight;
    var y = window.pageYOffset || root.scrollTop || 0;
    var p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
    bar.style.transform = "scaleX(" + p.toFixed(4) + ")";
  }

  if (bar) {
    paintProgress();
    window.addEventListener("scroll", function () {
      window.requestAnimationFrame(paintProgress);
    }, { passive: true });
    window.addEventListener("resize", paintProgress);
  }

  /* ============================================================
     ④ 音乐探索页 · 流派关系图谱
     ========================================================== */

  /* 九大流派详情文案（逐字取自用户提供的原文） */
  var GENRES = {
    classical: {
      name: "古典",
      en: "Classical",
      songs: [
        "Piano Concerto No. 2 in C Minor, Op. 18 - I. Moderato",
        "June-Barcarolle (from The Seasons), Op.37b No.6",
        "Onegin Ballet Suite - Stolze & Tchaikovsky: Onegin: Final Scene",
      ],
      intro: "最古老的声音秩序。以严谨乐章构建情绪，用纯粹器乐铺展时空。没有歌词的叙事，却容纳最辽阔的情绪宇宙，是所有现代音乐的源头底色。"
    },
    pop: {
      name: "流行",
      en: "Pop",
      songs: [
        "One And Only",
        "stupid song",
        "I Have Nothing",
        "人世间",
        "夏日倾情",
        "Bridge Over Troubled Water",
      ],
      intro: "包容万象的声音集合。吸收所有流派的亮点，融合、再造、新生。通俗却不单调，承载着大众最细腻、最真实的情绪切片。"
    },
    rnb: {
      name: "节奏布鲁斯",
      en: "R&B",
      songs: [
        "All Night Long",
        "Man I Need",
        "Honeymoon Avenue",
        "Love On Top",
      ],
      intro: "流动且细腻的律动美学。人声婉转、节奏温柔，将情绪揉进节拍里，慵懒又深情，是最适合独处漫游的声音。"
    },
    jazz: {
      name: "爵士",
      en: "Jazz",
      songs: [
        "That's Life",
        "Cheek To Cheek",
        "Old & Crazy",
      ],
      intro: "自由的声音实验。不拘束节拍、不固化旋律，即兴是它的灵魂。在错落和声里，听见声音最松弛、最灵动的可能性。"
    },
    rock: {
      name: "摇滚",
      en: "Rock",
      songs: [
        "Eye of the Tiger",
        "Rocket Man",
        "What's Up?",
      ],
      intro: "打破边界的听觉力量。热烈、坦荡、挣脱框架。它是情绪的爆发，是态度的表达，是音乐不断突破、不断新生的原动力。"
    },
    electronic: {
      name: "电子",
      en: "Electronic",
      songs: [
        "Rain On Me",
        "Ray of Light",
        "One Kiss",
      ],
      intro: "科技创造的全新声场。以机器重构音色，以节奏搭建虚拟空间，让声音脱离实体，进入无限、空灵、未来的听觉维度。"
    },
    country: {
      name: "乡村",
      en: "Country",
      songs: [
        "Somewhere Over Laredo",
        "Spark Fly",
        "Be Her",
      ],
      intro: "最质朴的听觉烟火。温柔、松弛、叙事感极强，以简单旋律诉说生活与归途，像一场缓慢、温柔的人间漫游。"
    },
    soundtrack: {
      name: "电影原声",
      en: "Soundtrack",
      songs: [
        "Look What I Found",
        "There You'll Be",
        "For Good",
        "Skyfall",
        "What Else Can I Do?",
      ],
      intro: "自带画面的旋律。每一段配乐都承载剧情、情绪与场景，听歌即是漫游一场别人的山河与故事。"
    },
    multilingual: {
      name: "多语种",
      en: "Multilingual",
      songs: [
        "Luna de Xelajú",
        "La Vie En Rose",
        "Hymne À L'Amour",
      ],
      intro: "跨越语言的听觉漫游。不同国度、不同语境、不同文化，旋律是通用语言，带我穿越地域壁垒，听见世界的多元模样。"
    }
  };

  (function initMusicMap() {
    var map = doc.getElementById("musicMap");
    if (!map) {
      return;
    }

    var nodes = Array.prototype.slice.call(map.querySelectorAll(".mmap__node"));
    var lines = Array.prototype.slice.call(map.querySelectorAll(".mmap__line"));
    var panel = doc.getElementById("musicPanel");
    if (!nodes.length || !lines.length) {
      return;
    }

    /* 建邻接表：line 的 data-from / data-to 即「互相影响」的两端 */
    var edges = [];
    var neighbours = {};

    lines.forEach(function (line) {
      var a = line.getAttribute("data-from");
      var b = line.getAttribute("data-to");
      if (!a || !b) {
        return;
      }
      edges.push({ el: line, a: a, b: b });
      (neighbours[a] = neighbours[a] || []).push(b);
      (neighbours[b] = neighbours[b] || []).push(a);
    });

    var selected = null;
    var hovered = null;

    /* 线条状态：与当前「聚焦流派」相连的提亮，其余压暗；无聚焦时全部回到默认 */
    function paintLines(focus) {
      edges.forEach(function (edge) {
        var hit = focus && (edge.a === focus || edge.b === focus);
        edge.el.classList.toggle("is-lit", Boolean(hit));
        edge.el.classList.toggle("is-dim", Boolean(focus) && !hit);
      });
    }

    function pushPanel(key) {
      if (!panel) {
        return;
      }
      var data = GENRES[key];
      var node = null;
      for (var n = 0; n < nodes.length; n++) {
        if (nodes[n].getAttribute("data-genre") === key) {
          node = nodes[n];
        }
      }
      var auraEl = node ? node.querySelector(".mmap__aura") : null;

      panel.textContent = "";

      var step = doc.createElement("p");
      step.className = "mpanel__step";
      step.textContent = "流派详情";
      panel.appendChild(step);

      var title = doc.createElement("h3");
      title.className = "mpanel__title";
      title.textContent = data ? data.name : key;
      if (data) {
        var en = doc.createElement("span");
        en.className = "mpanel__en";
        en.textContent = data.en;
        title.appendChild(en);
      }
      panel.appendChild(title);

      /* 流派介绍 */
      var blockIntro = doc.createElement("div");
      blockIntro.className = "mpanel__block";
      var labelIntro = doc.createElement("p");
      labelIntro.className = "mpanel__label";
      labelIntro.textContent = "流派介绍";
      var textIntro = doc.createElement("p");
      textIntro.className = "mpanel__text";
      textIntro.textContent = data ? data.intro : "";
      blockIntro.appendChild(labelIntro);
      blockIntro.appendChild(textIntro);
      panel.appendChild(blockIntro);

      /* 代表气质：取该节点悬浮时弹出的那句极简气质短句（同一份数据） */
      var blockAura = doc.createElement("div");
      blockAura.className = "mpanel__block";
      var labelAura = doc.createElement("p");
      labelAura.className = "mpanel__label";
      labelAura.textContent = "代表气质";
      var textAura = doc.createElement("p");
      textAura.className = "mpanel__text mpanel__text--aura";
      textAura.textContent = auraEl ? auraEl.textContent : "";
      blockAura.appendChild(labelAura);
      blockAura.appendChild(textAura);
      panel.appendChild(blockAura);

      /* 我的收藏曲目：逐字取自你提供的歌单（每流派一组，顺序照你给的原文） */
      var songs = data && data.songs ? data.songs : [];
      var blockSongs = doc.createElement("div");
      blockSongs.className = "mpanel__block";
      var labelSongs = doc.createElement("p");
      labelSongs.className = "mpanel__label";
      labelSongs.textContent = "我的收藏曲目";
      var samples = doc.createElement("div");
      samples.className = "mpanel__samples";
      songs.forEach(function (title) {
        var chip = doc.createElement("span");
        chip.className = "mpanel__sample";
        chip.textContent = title;
        samples.appendChild(chip);
      });
      blockSongs.appendChild(labelSongs);
      blockSongs.appendChild(samples);
      panel.appendChild(blockSongs);
    }

    function refocus() {
      var focus = hovered || selected;
      paintLines(focus);
    }

    nodes.forEach(function (node) {
      var key = node.getAttribute("data-genre");

      node.addEventListener("click", function () {
        selected = key;
        nodes.forEach(function (other) {
          other.setAttribute("aria-pressed", other === node ? "true" : "false");
        });
        pushPanel(key);
        refocus();
      });

      /* 悬浮 / 聚焦：节点柔光放大由 CSS 负责，这里只负责「关联线条淡亮」 */
      node.addEventListener("mouseenter", function () {
        hovered = key;
        refocus();
      });
      node.addEventListener("mouseleave", function () {
        hovered = null;
        refocus();
      });
      node.addEventListener("focus", function () {
        hovered = key;
        refocus();
      });
      node.addEventListener("blur", function () {
        hovered = null;
        refocus();
      });
    });
  })();

  /* ============================================================
     ⑤ 生活漫游页 · 八大兴趣翻牌卡
     ========================================================== */

  (function initLifeCards() {
    var flips = Array.prototype.slice.call(doc.querySelectorAll(".lcard__flip"));
    if (!flips.length) {
      return;
    }

    flips.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var flipped = btn.getAttribute("aria-pressed") === "true";
        btn.setAttribute("aria-pressed", flipped ? "false" : "true");
      });

      /* Esc：把当前卡翻回正面（键盘用户的出口，避免「翻过去回不来」） */
      btn.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
          btn.setAttribute("aria-pressed", "false");
        }
      });
    });
  })();

  /* ============================================================
     ⑥ 生活漫游页 · 卡片横向轨道（轮23）
     ------------------------------------------------------------
     「悬浮式横向滚动」的手动控制，全部是渐进增强（脚本挂掉仍可用原生滚动条 / 触屏横滑）：
       - 滚轮：一律交给浏览器做原生纵向滚动（轮27 起不再接管）；横向浏览用
         鼠标拖动 / 左右按钮 / 触屏原生横滑，避免在轨道上滚轮「滚不动页面」；
       - 鼠标拖动：pointerdown/move/up 自己算位移（只接管鼠标，触屏交给浏览器原生横滑），
         拖动期间临时关掉 scroll-snap；拖动后紧接着的那一次 click 不触发翻面；
       - 左右按钮：一次推进一张卡（含间距），平滑滚动（降低动态效果时不用平滑）；
       - 键盘：Tab 聚焦到卡时把它带进视野（只改轨道自身的 scrollLeft，不动页面纵向位置）；
       - 两端遮罩：滚动 / 缩放时切换 is-at-start / is-at-end / is-static 三个状态类。
     ========================================================== */

  (function initCardRail() {
    var wrap = doc.querySelector("[data-rail-wrap]");
    if (!wrap) {
      return;
    }
    var rail = wrap.querySelector(".lrail");
    if (!rail) {
      return;
    }

    var EDGE = 2; /* 亚像素误差容差 */

    function maxScroll() {
      return rail.scrollWidth - rail.clientWidth;
    }

    /* 状态类：两端是否还有内容（CSS 据此决定遮罩与按钮的去留） */
    function sync() {
      var m = maxScroll();
      var x = rail.scrollLeft;
      wrap.classList.toggle("is-static", m <= EDGE);
      wrap.classList.toggle("is-at-start", x <= EDGE);
      wrap.classList.toggle("is-at-end", x >= m - EDGE);
    }

    var ticking = false;

    function onScroll() {
      if (ticking) {
        return;
      }
      ticking = true;
      window.requestAnimationFrame(function () {
        ticking = false;
        sync();
      });
    }

    rail.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    /* 鼠标拖动（触屏用原生横滑） */
    var dragging = false;
    var dragged = false;
    var startX = 0;
    var startLeft = 0;

    function endDrag() {
      if (!dragging) {
        return;
      }
      dragging = false;
      rail.classList.remove("is-dragging");
    }

    rail.addEventListener("pointerdown", function (event) {
      if (event.pointerType === "touch" || event.button !== 0 || maxScroll() <= 0) {
        return;
      }
      dragging = true;
      dragged = false;
      startX = event.clientX;
      startLeft = rail.scrollLeft;
      rail.classList.add("is-dragging");
    });

    window.addEventListener("pointermove", function (event) {
      if (!dragging) {
        return;
      }
      var dx = event.clientX - startX;
      if (Math.abs(dx) > 3) {
        dragged = true;
      }
      rail.scrollLeft = startLeft - dx;
    });

    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);

    /* 拖动结束的那一次 click 只算「松手」，不该翻面（捕获阶段拦下） */
    rail.addEventListener("click", function (event) {
      if (!dragged) {
        return;
      }
      dragged = false;
      event.preventDefault();
      event.stopPropagation();
    }, true);

    /* 左右按钮：一次一张卡 */
    var step = 0;

    function measure() {
      var card = rail.querySelector(".lcard");
      if (!card) {
        return;
      }
      var gap = parseFloat(window.getComputedStyle(rail).columnGap) || 0;
      step = card.getBoundingClientRect().width + gap;
    }

    function nudge(dir) {
      if (!step) {
        measure();
      }
      var target = rail.scrollLeft + dir * step;
      if (rail.scrollTo) {
        rail.scrollTo({ left: target, behavior: reduceMotion ? "auto" : "smooth" });
      } else {
        rail.scrollLeft = target;
      }
    }

    var prev = wrap.querySelector(".lrail__nav--prev");
    var next = wrap.querySelector(".lrail__nav--next");
    if (prev) {
      prev.addEventListener("click", function () {
        nudge(-1);
      });
    }
    if (next) {
      next.addEventListener("click", function () {
        nudge(1);
      });
    }

    /* 键盘聚焦：把卡带进视野（只动轨道横向位置，避免整页跳） */
    rail.addEventListener("focusin", function (event) {
      var card = event.target && event.target.closest ? event.target.closest(".lcard") : null;
      if (!card) {
        return;
      }
      var left = card.offsetLeft;
      var right = left + card.offsetWidth;
      if (left < rail.scrollLeft) {
        rail.scrollLeft = Math.max(0, left - 8);
      } else if (right > rail.scrollLeft + rail.clientWidth) {
        rail.scrollLeft = right - rail.clientWidth + 8;
      }
    });

    function onResize() {
      measure();
      sync();
    }

    measure();
    sync();
    /* 字体 / 图片落位后宽度会变，稍后再校一次（避免初帧误判「没有溢出」） */
    window.setTimeout(onResize, 300);
  })();
})();
