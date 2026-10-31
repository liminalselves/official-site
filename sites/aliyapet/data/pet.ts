// Copy, link and navigation data for the Aliya Pet site (single source for this site).

import { site } from '../../../src/data/site';

export const pet = {
  url: 'https://aliyapet.liminalselves.top',
  title: 'Aliya Pet 桌面宠物',
  description:
    'Aliya Pet 官方网站：基于 Live2D 的 Windows 与 Android 桌面宠物。查看功能介绍，下载安装包，了解更新日志与常见问题。',
  intro:
    '基于 Live2D 的桌面宠物，支持 Windows 与 Android：抚摸与点击互动、对话气泡与按时段问候，接入阈界人格社区智能体聊天。',
  repo: 'https://github.com/liminalselves/Aliya_pet',
  disclaimer: '本项目为非官方二次创作，人物出自游戏《彼方的她》，与原作版权方无关。',
};

export type AssetKey = 'windows' | 'android' | 'windows-msi';

export interface Platform {
  key: AssetKey;
  /** Card title on the download page. */
  title: string;
  /** Checksum row label. */
  short: string;
  /** Platform requirements shown under the title. */
  note: string;
  /** Button text, also used as the size-label prefix at runtime. */
  label: string;
  /** Inline install tip shown on the card. */
  tip?: string;
  recommended?: boolean;
}

export const platforms: Platform[] = [
  {
    key: 'windows',
    title: 'Windows 安装程序',
    short: 'Windows',
    note: 'Windows 10 及以上 · x64 · EXE',
    label: '下载 Windows 版',
    tip: '首次运行时 SmartScreen 可能提示「未知发布者」：点「更多信息」，再点「仍要运行」即可继续。',
    recommended: true,
  },
  {
    key: 'windows-msi',
    title: 'Windows MSI',
    short: 'MSI',
    note: 'Windows 10 及以上 · x64 · MSI',
    label: '下载 MSI 安装包',
    tip: '适合批量部署等场景，一般用户选择安装程序即可。',
  },
  {
    key: 'android',
    title: 'Android APK',
    short: 'Android',
    note: 'Android 8.0 及以上 · APK',
    label: '下载 Android 版',
    tip: '安装前请在系统设置中允许该来源安装未知应用。',
  },
];

export const navLinks = [
  { label: '首页', href: '/' },
  { label: '功能', href: '/features/' },
  { label: '下载', href: '/download/' },
  { label: '更新日志', href: '/changelog/' },
  { label: '常见问题', href: '/faq/' },
];

const norm = (p: string) => p.replace(/\/+$/, '') || '/';

/** Whether a nav link points at the current page (trailing slash ignored). */
export const isActiveNav = (href: string, pathname: string) => norm(href) === norm(pathname);

export const features = [
  { name: '互动', en: 'Interaction', desc: '摸头、戳脸、碰耳朵，不同的触碰方式有不同的反应和台词。' },
  { name: '对话', en: 'Dialogue', desc: '按早晚时段问候，配合对话气泡，偶尔自言自语。' },
  { name: '表情与情绪', en: 'Emotions', desc: '内置 12 种表情，心情随互动变化。' },
  { name: '聊天', en: 'Chat', desc: '登录阈界人格社区账号，与 Aliya 智能体对话，可保留多个会话。' },
  { name: 'Windows 桌面常驻', en: 'Windows Presence', desc: '透明置顶窗口、托盘菜单、贴边吸附，支持开机自启。' },
  { name: 'Android 悬浮窗', en: 'Android Overlay', desc: '退到后台后转为悬浮窗，可贴边停靠，支持省电模式。' },
  { name: '自动更新', en: 'Auto Update', desc: '每次启动自动检查更新，Windows 版可在应用内一键更新。' },
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
    a: '在 PowerShell 中运行 Get-FileHash 加安装包文件名，把输出结果与下载页上的 SHA-256 校验值核对。',
  },
  {
    q: '聊天需要什么账号？',
    a: '需要阈界人格社区账号。在社区官网注册后，用同一账号在 Aliya Pet 中登录即可使用聊天。',
  },
  {
    q: '数据保存在哪里？',
    a: '应用的设置保存在本机，下次启动继续沿用；聊天功能登录阈界人格社区账号后使用。',
  },
  {
    q: '如何卸载？',
    a: 'Windows 在系统「设置 › 应用」中找到 Aliya Pet 并卸载；Android 长按应用图标，选择「卸载」。',
  },
  {
    q: '遇到问题如何反馈？',
    a: `加入 Q 群 ${site.qqGroup}，或发送邮件到 ${site.email}。`,
  },
];
