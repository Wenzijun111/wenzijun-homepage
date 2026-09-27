/* ============================================================
   「我的会客厅」留言板 · 云端配置（轮20 · USR-31）
   ------------------------------------------------------------
   本站是纯静态页面（零依赖、零构建、免登录）。访客留言若要「所有访客互相看得到」，
   就必须有一个云端后端——本项目指定的后端是 Supabase（V3 计划）。

   填好下面两项 → 自动切换为「云端共享」模式；
   留空 → 自动回退为「本机留言」模式（留言只存在当前浏览器的 localStorage 里，
   页面与交互完全可用，只是别人看不到）。

   怎么填（约 3 分钟）：
     ① 打开 https://supabase.com 注册并新建一个免费项目（New project）；
     ② 在项目左侧打开 SQL Editor → New query，粘贴并 Run 建表 SQL
        （见 docs/指引：会客厅留言板-云端接入四步走.md 里的「第 2 步」）；
     ③ 打开 Project Settings → API，复制 Project URL 与 Project API keys 里的
        anon public 两项，填到下面两个引号里；
     ④ 保存本文件 → 刷新页面：留言墙下方会显示「云端留言板」，
        此后任何访客写下的留言，所有人都能看到。

   安全说明：anon key 是「匿名公钥」，设计上就是放在前端公开的（写在静态页面里不会
   泄露隐私）；真正的保护来自 Supabase 的行级安全策略（RLS）——本留言板只开放
   「读取全部 + 插入」两种操作，不允许修改与删除。
   ============================================================ */
window.LIVING_ROOM_CONFIG = {
  // 例：https://abcdefghijklmn.supabase.co （末尾不要带斜杠）
  supabaseUrl: "",

  // Supabase 控制台 → Project Settings → API → Project API keys → anon public
  supabaseAnonKey: "",

  // 数据表名（与建表 SQL 保持一致，通常无需修改）
  table: "messages"
};
