import { useState } from 'react';
import type { Task } from '../domain/models';
import { groupLabels, taskGroup } from '../domain/task-groups';
import type { TaskGroup } from '../domain/task-groups';
import { TaskList } from './rows';
import type { OpenEditor } from './rows';
import { Empty } from './components';
export function TaskGroups({ tasks, today, owner, open }: { tasks: Task[]; today: string; owner: string; open: OpenEditor }) {
  const key = `timora.task-groups.${owner}`;
  const [closed, setClosed] = useState<string[]>(() => { try { const saved: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(saved) ? saved.filter(value => typeof value === 'string') : []; } catch { return []; } });
  function toggle(group: TaskGroup) {
    const next = closed.includes(group) ? closed.filter(value => value !== group) : [...closed, group];
    setClosed(next); try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* In-memory preference still works. */ }
  }
  if (!tasks.length) return <div className="card"><Empty /></div>;
  return <div className="task-groups">{(Object.keys(groupLabels) as TaskGroup[]).map(group => {
    const rows = tasks.filter(task => taskGroup(task, today) === group);
    if (!rows.length) return null;
    return <section className="card" key={group}><button type="button" className="group-heading" aria-expanded={!closed.includes(group)} aria-controls={`group-${group}`} onClick={() => toggle(group)}><span aria-hidden="true">{closed.includes(group) ? '›' : '⌄'}</span><strong>{groupLabels[group]}</strong><span className="count-badge">{rows.length}</span></button><div id={`group-${group}`} hidden={closed.includes(group)}><TaskList tasks={rows} open={open} /></div></section>;
  })}</div>;
}
