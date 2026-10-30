// Copy and link data for the Aliya Pet download page (single source for this site).

export const pet = {
  url: 'https://aliyapet.liminalselves.top',
  title: 'Aliya Pet 桌面宠物 · 下载',
  description:
    'Aliya Pet 官方下载页：基于 Live2D 的 Windows 与 Android 桌面宠物，提供安装包下载、更新日志、系统要求与常见问题。',
  intro:
    '基于 Live2D 的桌面宠物，支持 Windows 与 Android：抚摸与点击互动、对话气泡与按时段问候，接入阈界人格社区智能体聊天。',
  repo: 'https://github.com/liminalselves/Aliya_pet',
  disclaimer: '本项目为非官方二次创作，人物出自游戏《彼方的她》，与原作版权方无关。',
};

export type AssetKey = 'windows' | 'android' | 'windows-msi';

export const platforms: { key: AssetKey; label: string; short: string; note: string }[] = [
  { key: 'windows', label: '下载 Windows 版', short: 'Windows', note: 'Windows 10 及以上 · x64 · 安装程序' },
  { key: 'android', label: '下载 Android 版', short: 'Android', note: 'Android 8.0 及以上 · APK' },
  { key: 'windows-msi', label: 'MSI 安装包', short: 'MSI', note: 'Windows 10 及以上 · x64 · MSI' },
];

export const features = [
  { name: '互动', en: 'Interaction', desc: '抚摸与点击互动，不同区域有不同反应。' },
  { name: '对话', en: 'Chat', desc: '对话气泡与按时段问候；聊天接入阈界人格社区 Misskey 智能体，使用社区账号登录。' },
  { name: '情绪', en: 'Emotion', desc: '带有表情与情绪，随互动变化。' },
  { name: '常驻', en: 'Presence', desc: 'Windows 透明置顶窗口、托盘、贴边、开机自启；Android 退到后台转为悬浮窗。' },
];

export const requirements = [
  { platform: 'Windows', items: ['Windows 10 及以上（x64）', '需要 WebView2 运行时，安装程序会自动安装'] },
  { platform: 'Android', items: ['Android 8.0 及以上'] },
];

export const faqs = [
  {
    q: '安装 Windows 版时提示「未知发布者」，怎么办？',
    a: '安装包未做代码签名，SmartScreen 会弹出提示。点「更多信息」，再点「仍要运行」，即可继续安装。',
  },
  {
    q: 'Android 版无法安装，怎么办？',
    a: '系统默认禁止安装未知来源应用。到系统设置中允许相应来源安装未知应用后，重新打开安装包。',
  },
  {
    q: '如何更新到新版本？',
    a: '应用每次启动时会自动检查更新，有新版本时 Windows 版可在应用内一键更新。',
  },
  {
    q: '如何校验安装包？',
    a: '在 PowerShell 中运行 Get-FileHash 文件名，把输出与页面底部的 SHA-256 列表核对。',
  },
];
