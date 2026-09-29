import type { CalendarEvent, InboxItem, LibraryResource, Note, Project, Task } from '../domain/models';

// Static presentation data. Dates intentionally fixed so the preview is reproducible.
export const tasks: Task[] = [
  { id: 'task-1', kind: 'task', title: 'Workspace 구조 초안 정리', status: 'in_progress', dueAt: '2026-09-28', projectId: 'project-1', priority: 'high', createdAt: '2026-09-25', updatedAt: '2026-09-28' },
  { id: 'task-2', kind: 'task', title: '전공 스터디 자료 검토', status: 'todo', dueAt: '2026-09-29', projectId: 'project-2', priority: 'medium', createdAt: '2026-09-26', updatedAt: '2026-09-26' },
  { id: 'task-3', kind: 'task', title: 'GitHub 이슈 정리하기', status: 'todo', dueAt: '2026-09-30', projectId: 'project-1', priority: 'medium', createdAt: '2026-09-27', updatedAt: '2026-09-27' },
  { id: 'task-4', kind: 'task', title: '독서 기록 작성', status: 'done', dueAt: '2026-09-27', priority: 'low', createdAt: '2026-09-24', updatedAt: '2026-09-27' },
];

export const projects: Project[] = [
  { id: 'project-1', kind: 'project', title: 'Workspace', description: '생각과 작업을 하나의 공간에서 연결하기', progress: 18, color: '#6b77dc', createdAt: '2026-09-24', updatedAt: '2026-09-28' },
  { id: 'project-2', kind: 'project', title: '스마트팩토리 학습', description: '학습 내용과 실습 기록 모아두기', progress: 44, color: '#d09b5d', createdAt: '2026-09-18', updatedAt: '2026-09-26' },
  { id: 'project-3', kind: 'project', title: '개인 포트폴리오', description: '프로젝트 결과와 배운 점 정리', progress: 12, color: '#6bab9a', createdAt: '2026-09-21', updatedAt: '2026-09-25' },
];

export const notes: Note[] = [
  { id: 'note-1', kind: 'note', title: '앱의 핵심 원칙', excerpt: '할 일, 기록, 프로젝트가 서로 자연스럽게 연결되는 작업 공간.', category: '아이디어', createdAt: '2026-09-25', updatedAt: '2026-09-28' },
  { id: 'note-2', kind: 'note', title: '이번 주 회고', excerpt: '해야 할 일을 줄이고 지금 가장 중요한 것부터 시작하기.', category: '일상', createdAt: '2026-09-24', updatedAt: '2026-09-27' },
  { id: 'note-3', kind: 'note', title: '프로젝트 참고 메모', excerpt: '데이터 구조와 화면 구성을 먼저 명확하게 정리해 두자.', category: '개발', createdAt: '2026-09-22', updatedAt: '2026-09-26' },
];

export const inbox: InboxItem[] = [
  { id: 'inbox-1', content: '빠르게 떠오른 기능 아이디어 적어두기', capturedAt: '2026-09-28T09:40:00', processed: false },
  { id: 'inbox-2', content: '주말에 읽을 자료 확인하기', capturedAt: '2026-09-27T15:20:00', processed: false },
  { id: 'inbox-3', content: '캘린더 화면 구성 다시 생각해 보기', capturedAt: '2026-09-26T22:10:00', processed: false },
];

export const events: CalendarEvent[] = [
  { id: 'event-1', kind: 'event', title: '전공 스터디', startsAt: '2026-09-28T16:00:00', endsAt: '2026-09-28T17:00:00', projectId: 'project-2', createdAt: '2026-09-20', updatedAt: '2026-09-20' },
  { id: 'event-2', kind: 'event', title: '프로젝트 점검', startsAt: '2026-09-30T19:00:00', endsAt: '2026-09-30T20:00:00', projectId: 'project-1', createdAt: '2026-09-24', updatedAt: '2026-09-24' },
];

export const resources: LibraryResource[] = [
  { id: 'resource-1', kind: 'resource', title: 'Workspace 설계 문서', resourceType: 'document', description: '기본 구조와 제품 방향 정리', createdAt: '2026-09-25', updatedAt: '2026-09-28' },
  { id: 'resource-2', kind: 'resource', title: 'UI 참고 링크', resourceType: 'link', description: '레이아웃과 탐색 구조 아이디어', createdAt: '2026-09-24', updatedAt: '2026-09-26' },
  { id: 'resource-3', kind: 'resource', title: '학습 자료 모음', resourceType: 'file', description: '프로젝트와 학습에 참고할 자료', createdAt: '2026-09-20', updatedAt: '2026-09-22' },
];
