/* ============================================================
   副页面脚本 · 我的计科四年探索之旅（轮19 / USR-30）
   ------------------------------------------------------------
   职责（全部为渐进增强，任何一步失败都不影响内容可读）：
     ① 标记「JS 可用」→ 滚动渐显样式只在 .js 下生效，脚本挂掉时内容照常全显；
     ② 滚动渐显：IntersectionObserver 优先，缺失则直接全显；另有 1.5s 兜底；
     ③ 顶部「穿越进度」光带：把滚动进度映射为 scaleX（只改 transform，不触发重排）；
     ④ 视频播放态：播放中给「时间舱」外框加 .is-playing（描边转为强调色）。
   不做的事：不写 localStorage（主题跟随主线，已在 <head> 首帧应用）、
             不引入任何第三方库、不自动播放（播放完全由用户点击决定）。
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

  if (reduceMotion) {
    /* 用户要求降低动态效果：不做渐显，内容直接可见 */
    showAll();
  } else if (!window.IntersectionObserver) {
    showAll();
  } else {
    /* threshold 取 0（而非比例值）：只要元素的任意一部分越过「视口下沿上方 10%」
       这条线就渐显。原因：页面最底部的短元素（结尾区「返回主线」按钮，页面已无页脚，
       它正好停在底部）滚到底时可进入视口的比例极小，按比例判定会永远不达标而不显示。*/
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          entries[i].target.classList.add("is-in");
          io.unobserve(entries[i].target);          /* 只渐显一次 */
        }
      }
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0 });

    for (var j = 0; j < items.length; j++) {
      io.observe(items[j]);
    }

    /* 兜底：1.5s 后仍处于首屏范围的元素一律显示（宁可无动画，不可看不到内容） */
    window.setTimeout(function () {
      var limit = window.innerHeight * 1.2;
      for (var k = 0; k < items.length; k++) {
        if (items[k].getBoundingClientRect().top < limit) {
          items[k].classList.add("is-in");
        }
      }
    }, 1500);
  }

  /* ③ 顶部「穿越进度」光带 */
  var bar = doc.getElementById("jProgress");

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

  /* ④ 视频播放态 */
  var video = doc.querySelector(".jvideo__el");
  var frame = doc.querySelector(".jvideo__frame");

  if (video && frame) {
    var setPlaying = function (on) {
      if (on) {
        frame.classList.add("is-playing");
      } else {
        frame.classList.remove("is-playing");
      }
    };
    video.addEventListener("play", function () { setPlaying(true); });
    video.addEventListener("pause", function () { setPlaying(false); });
    video.addEventListener("ended", function () { setPlaying(false); });
  }
})();
