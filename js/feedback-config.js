/* ============================================================
   V3 私密反馈 · 云端配置（课程需求 CRS-5）
   ------------------------------------------------------------
   这里是「意见反馈」表所连的 Supabase 项目。填好两项即接通云端；
   留空则脚本进入「未接通」状态：不会假装发送成功，而是改为提示
   可以直接邮件联系（页面其余部分完全不受影响）。

   关于这两项能不能公开：
     supabasePublishableKey 是可以公开的密钥（旧称 anon key），
     它本身不带任何权限——能力完全由数据库的行级安全（RLS）决定。
     本项目对 feedback 表只开了一条 INSERT 策略，所以这把钥匙即使
     被人看到，也读不到、改不了、删不掉任何一条反馈内容。
     这正是课程要求的「前端不暴露 secret key」的落地方式。

   ⚠️ 绝对不要写进这个文件的两类东西：
     1) secret key / service_role key（能绕过 RLS 读全表的钥匙）；
     2) 数据库密码。
     它们是「服务端专用」的，一旦放进前端文件就等于公开发布。

   配置文件与脚本的分工：本文件只放「值」，逻辑全在 js/feedback.js。
   改动记录：轮32（V3）新建；轮37（V4）版本标记随页面升为 V4（与页脚「页面版本」保持同步）。
   ============================================================ */
window.FEEDBACK_CONFIG = {
  // Supabase 项目地址（Project Settings → API → Project URL），末尾不带斜杠
  supabaseUrl: "https://nsrbxqubwhoemeyzdxtw.supabase.co",

  // 可公开密钥（Project Settings → API Keys → publishable key，旧称 anon public）
  supabasePublishableKey: "sb_publishable_nOBwBKZtpKG10gkrKEzOTw_GO8qN47R",

  // 反馈表名（需与 Supabase 里建的表名一致）
  table: "feedback",

  // 当前页面版本：随每条反馈自动附带，便于日后按版本归类反馈（V4 改进的依据）
  // 轮37 起随页面可见的版本标记同步升为 V4 —— 两者必须一致，
  // 否则记录里的版本号会和访客当时看到的页脚文案对不上。
  version: "V4",

  // 云端写入失败时的兜底联系方式（页面上会显示成可点击的邮件链接）
  ownerEmail: "wenzijun@tju.edu.cn"
};
