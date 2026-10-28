export const site = {
  url: 'https://www.liminalselves.top',
  name: '阈界人格',
  nameEn: 'Liminal Selves',
  title: '阈界人格 Liminal Selves · 官方网站',
  description:
    '阈界人格（Liminal Selves）项目组官方网站。我们运营基于 Misskey 的阈界人格社区，提供智能体角色聊天与角色创作，并开发 Aliya Web 聊天终端与官方 Android App。',
  keywords: '阈界人格,Liminal Selves,阈界人格社区,Misskey,智能体,AI 角色,角色创作,Aliya Web,Aliya',
  tagline: '跨过阈限，遇见更多可能的自我。',
  email: 'help@liminalselves.top',
  icp: '闽ICP备2025116989号-1',
  qqGroup: '519308434',
  // Fill in when the search consoles issue verification codes.
  verification: {
    baidu: '',
    google: '',
    bing: '',
  },
};

export const links = {
  community: 'https://misskey.liminalselves.top/',
  aliya: 'https://aliya.liminalselves.top',
  app: 'https://misskey.liminalselves.top/app',
  docs: 'https://docs.liminalselves.top',
  rules: 'https://docs.liminalselves.top/guide/rules',
  faq: 'https://docs.liminalselves.top/guide/faq',
};

export type Project = {
  id: string;
  index: string;
  name: string;
  en: string;
  summary: string;
  note?: string;
  href: string;
  cta: string;
  docs: string;
  shape: 'timeline' | 'console' | 'device';
};

export const projects: Project[] = [
  {
    id: 'community',
    index: '01',
    name: '阈界人格社区',
    en: 'Community',
    summary: '项目组的核心项目，基于 Misskey 搭建。发帖、私信、逛频道，也可以和智能体角色聊天，发布自己创作的角色。',
    href: links.community,
    cta: '进入社区',
    docs: `${links.docs}/guide/features`,
    shape: 'timeline',
  },
  {
    id: 'aliya',
    index: '02',
    name: 'Aliya Web',
    en: 'Chat Terminal',
    summary: '专为与 Aliya 对话而设计，界面延续原作风格。使用社区账号登录，电脑与手机均可访问。',
    note: '本项目为非官方二次创作，与原作版权方无关',
    href: links.aliya,
    cta: '打开 Aliya Web',
    docs: `${links.docs}/guide/aliya-web`,
    shape: 'console',
  },
  {
    id: 'app',
    index: '03',
    name: '官方 App',
    en: 'Android Client',
    summary: '阈界人格社区的官方 Android 客户端，享受最原生的交互体验。',
    href: links.app,
    cta: '下载 App',
    docs: `${links.docs}/guide/clients/official`,
    shape: 'device',
  },
];

export const capabilities = [
  { name: '会话', en: 'Sessions', desc: '多会话管理，随时切换与续写' },
  { name: '模型', en: 'Models', desc: '按需选择对话模型' },
  { name: '生图', en: 'Images', desc: '聊着天就能生成专属图片' },
  { name: '记忆', en: 'Memory', desc: '角色记住你们之间的故事' },
  { name: '主动消息', en: 'Proactive', desc: '角色会主动来找你说话' },
  { name: '世界书', en: 'Worldbook', desc: '为角色构建完整的世界设定' },
];

export const pillars = [
  { title: '社区', en: 'Community', desc: '一个可以发帖、交流、互相回应的社区。' },
  { title: '智能体', en: 'Agents', desc: '在社区挑选角色开始聊天。' },
  { title: '创作', en: 'Creation', desc: '每位用户都可以创作自己的角色，让更多人体验。' },
];
