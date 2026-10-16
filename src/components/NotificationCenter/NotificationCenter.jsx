import { useMemo, useState } from 'react';
import './NotificationCenter.css';
export default function NotificationCenter({ reminders = [], comments = [], contributions = [], onOpenMilestone }) {
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState(() => { try { return JSON.parse(localStorage.getItem('familyArchiveNotificationsRead') || '[]'); } catch { return []; } });
  const items = useMemo(() => {
    const a = reminders.map(r=>({id:`reminder-${r.id}`,kind:'Reminder',icon:'⏰',title:r.title||'Milestone reminder',body:r.note||'A family plan needs your attention.',date:r.remind_at||r.due_at,milestoneId:r.milestone_id}));
    const b = comments.slice(-8).map(c=>({id:`comment-${c.id}`,kind:'Family voice',icon:'💬',title:'Someone added to a milestone conversation',body:c.body||c.content||'New comment on a family goal.',date:c.created_at,milestoneId:c.milestone_id}));
    const d = contributions.slice(-8).map(c=>({id:`contribution-${c.id}`,kind:'Contribution',icon:'🤝',title:'A family member offered to help',body:c.note||'A new contribution was added.',date:c.created_at,milestoneId:c.milestone_id}));
    return [...a,...b,...d].sort((x,y)=>new Date(y.date||0)-new Date(x.date||0)).slice(0,14);
  },[reminders,comments,contributions]);
  const unread=items.filter(i=>!read.includes(i.id)).length;
  const markRead=(id)=>setRead(prev=>{const next=[...new Set([...prev,id])];localStorage.setItem('familyArchiveNotificationsRead',JSON.stringify(next));return next});
  const markAll=()=>{const ids=items.map(i=>i.id);setRead(ids);localStorage.setItem('familyArchiveNotificationsRead',JSON.stringify(ids));};
  return <div className="notification-center"><button className="notification-trigger" onClick={()=>setOpen(v=>!v)} aria-label="Notifications">♧{unread>0&&<b>{unread>9?'9+':unread}</b>}</button>{open&&<div className="notification-panel"><div className="notification-panel-head"><div><span className="eyebrow">FAMILY ACTIVITY</span><h3>Notifications</h3></div><button onClick={markAll}>Mark all read</button></div>{!items.length?<div className="notification-empty"><span>✦</span><strong>You're all caught up.</strong><p>New family activity and reminders will appear here.</p></div>:<div className="notification-list">{items.map(item=><button key={item.id} className={`notification-item ${read.includes(item.id)?'read':''}`} onClick={()=>{markRead(item.id);if(item.milestoneId&&onOpenMilestone)onOpenMilestone(item.milestoneId);setOpen(false)}}><span className="notification-icon">{item.icon}</span><span><strong>{item.title}</strong><small>{item.body}</small><em>{item.kind} · {item.date?new Date(item.date).toLocaleDateString():'Recently'}</em></span></button>)}</div>}</div>}</div>;
}
