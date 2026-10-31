// Build-time fallback so /changelog/ and the home entry block are never empty
// when /api/releases is unavailable at runtime. Keep in sync with the newest
// published release; older versions come from the API only.

import { pet } from './pet';

export interface Release {
  version: string;
  name: string;
  publishedAt: string;
  notes: string;
  minVersion: string | null;
  releaseUrl: string | null;
  latest?: boolean;
}

const notesV010 = [
  '首个公开测试版，Windows 与 Android 同时发布。',
  '',
  '### 新增',
  '- 桌面上的 Aliya：基于 Live2D 渲染，会呼吸、眨眼，视线跟随鼠标。',
  '- 抚摸与点击：摸头、戳脸、碰耳朵，各有不同的反应和台词。',
  '- 对话气泡：按早晚时段问候，偶尔自言自语。',
  '- 表情与情绪：12 种表情，心情随互动变化。',
  '- 聊天：登录阈界人格社区账号，与 Aliya 智能体对话，可保留多个会话。',
  '- Windows：透明置顶窗口、托盘菜单、贴边吸附、开机自启。',
  '- Android：退到后台后转为悬浮窗，可贴边停靠；支持省电模式与开机自启。',
  '- 设置保存在本机，下次启动继续沿用。',
].join('\n');

export const fallbackReleases: Release[] = [
  {
    version: '0.1.0',
    name: 'Aliya Pet 0.1.0',
    publishedAt: '2026-10-25T03:36:09Z',
    notes: notesV010,
    minVersion: null,
    releaseUrl: `${pet.repo}/releases`,
    latest: true,
  },
];
