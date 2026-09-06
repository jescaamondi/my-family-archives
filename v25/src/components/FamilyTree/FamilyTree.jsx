import { useMemo, useState } from "react";
import "./FamilyTree.css";

const DEMO = [
  { id:"a1", full_name:"Alexander", relationship:"Great Grandfather", birth_date:"1931-01-01", generation:0, photo_url:"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=500&q=80", parent_id:null },
  { id:"a2", full_name:"Nina", relationship:"Great Grandmother", birth_date:"1934-01-01", generation:0, photo_url:"https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=500&q=80", parent_id:null },
  { id:"b1", full_name:"Michael", relationship:"Grandfather", birth_date:"1957-01-01", generation:1, photo_url:"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=500&q=80", parent_id:"a1" },
  { id:"b2", full_name:"Tamara", relationship:"Grandmother", birth_date:"1960-01-01", generation:1, photo_url:"https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=500&q=80", parent_id:"a1" },
  { id:"c1", full_name:"Dmitry", relationship:"Dad", birth_date:"1983-01-01", generation:2, photo_url:"https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=500&q=80", parent_id:"b1" },
  { id:"c2", full_name:"Anna", relationship:"Mum", birth_date:"1986-01-01", generation:2, photo_url:"https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=500&q=80", parent_id:"b1" },
  { id:"d1", full_name:"Jessy", relationship:"You", birth_date:"2009-01-01", generation:3, photo_url:"https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=500&q=80", parent_id:"c1" },
];

function initials(name="") { return name.split(" ").filter(Boolean).map(x=>x[0]).join("").slice(0,2).toUpperCase() || "?"; }
function year(value) { if (!value) return ""; const d=new Date(value); return Number.isNaN(d.getTime()) ? "" : d.getFullYear(); }
function date(value) { if (!value) return ""; const d=new Date(value); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", {day:"numeric", month:"long", year:"numeric"}); }

export default function FamilyTree({ members = [], onAddMember }) {
  const [people, setPeople] = useState(members.length ? members : DEMO);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [zoom, setZoom] = useState(1);
  const [mode, setMode] = useState("story");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({name:"", role:"", birth:"", relationship:"child", connectedTo:"d1", photo:"", bio:""});
  const [branch, setBranch] = useState(null);

  const generations = useMemo(() => {
    const groups = new Map();
    people.forEach(person => {
      const g = Number(person.generation ?? 0);
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(person);
    });
    return [...groups.entries()].sort((a,b)=>a[0]-b[0]).map(([generation, list]) => ({generation, people:list}));
  }, [people]);

  const maxGeneration = generations.length ? generations[generations.length - 1].generation : 0;
  const filtered = useMemo(() => {
    const q=search.trim().toLowerCase();
    return generations.map(g => ({...g, people:g.people.filter(p => {
      if (branch && mode === "explore") {
        const related = p.id === branch || p.parent_id === branch || people.some(x => x.id === branch && x.parent_id === p.id);
        if (!related) return false;
      }
      return !q || `${p.full_name||""} ${p.relationship||""} ${p.location||""}`.toLowerCase().includes(q);
    })})).filter(g=>g.people.length);
  }, [generations, search, branch, mode, people]);

  const parents = selected ? people.filter(p => p.id === selected.parent_id) : [];
  const children = selected ? people.filter(p => p.parent_id === selected.id) : [];
  const siblings = selected?.parent_id ? people.filter(p => p.parent_id === selected.parent_id && p.id !== selected.id) : [];
  const spouse = selected?.spouse_id ? people.find(p => p.id === selected.spouse_id) : null;

  function openPerson(person) {
    setSelected(person);
    if (mode === "explore") setBranch(person.id);
  }

  function addPerson(event) {
    event.preventDefault();
    const connected = people.find(p => p.id === form.connectedTo);
    if (!form.name.trim() || !connected) return;
    let generation = Number(connected.generation ?? 0);
    if (form.relationship === "child") generation += 1;
    if (form.relationship === "parent") generation = Math.max(0, generation - 1);
    if (form.relationship === "sibling") generation = generation;
    if (form.relationship === "spouse") generation = generation;
    const person = {
      id:`local-${Date.now()}`,
      full_name:form.name.trim(), relationship:form.role.trim() || form.relationship,
      birth_date:form.birth || null, photo_url:form.photo.trim() || null, bio:form.bio.trim() || null,
      generation, parent_id:form.relationship === "child" ? connected.id : connected.parent_id || null,
      spouse_id:form.relationship === "spouse" ? connected.id : null
    };
    setPeople(prev => [...prev, person]);
    setSelected(person);
    setShowAdd(false);
    setForm({name:"", role:"", birth:"", relationship:"child", connectedTo:person.id, photo:"", bio:""});
    onAddMember?.(person);
  }

  return <div className="family-tree-page">
    <header className="family-tree-header">
      <div className="family-tree-heading">
        <span className="eyebrow">THE FAMILY ARCHIVE</span>
        <h1>Our ancestry, growing through generations <span className="heading-leaf">❧</span></h1>
        <p>Ancestors begin at the top. Each generation grows downward until the youngest family members take root.</p>
      </div>
      <div className="tree-header-actions">
        <div className="tree-mode-toggle">
          <button className={mode === "story" ? "active" : ""} onClick={()=>{setMode("story");setBranch(null)}}>Story mode</button>
          <button className={mode === "explore" ? "active" : ""} onClick={()=>setMode("explore")}>Explore mode</button>
        </div>
        <button className="add-member-button" onClick={()=>setShowAdd(true)}><span>+</span>Add family member</button>
      </div>
    </header>

    <div className="tree-intro-note">
      <span>🌿</span><div><strong>{mode === "story" ? "Journey from ancestors to roots" : "Follow a family branch"}</strong><small>{mode === "story" ? "The layout automatically makes room as new generations are added." : "Select a person to focus on their connected branch."}</small></div>
    </div>

    <div className="family-tree-toolbar">
      <div className="tree-search"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search family members..." /></div>
      <div className="tree-controls"><button onClick={()=>setZoom(z=>Math.min(1.4,z+.1))}>+</button><span>{Math.round(zoom*100)}%</span><button onClick={()=>setZoom(z=>Math.max(.65,z-.1))}>−</button><button className="reset-zoom" onClick={()=>setZoom(1)}>Reset</button></div>
    </div>

    <div className="family-tree-layout">
      <main className="family-tree-canvas">
        <div className="tree-stage" style={{transform:`scale(${zoom})`}}>
          <div className="tree-canopy-label">✦ &nbsp; OLDEST KNOWN ANCESTORS &nbsp; ✦</div>
          <div className="tree-lines">
            {filtered.map((generation, index) => <section className="tree-generation" key={generation.generation}>
              <div className="generation-label"><span>{index === 0 ? "ANCESTORS" : index === filtered.length-1 ? "ROOTS · YOUNGEST" : `GENERATION ${index+1}`}</span><small>{generation.people.length} {generation.people.length===1?"member":"members"}</small></div>
              <div className="people-row">
                {generation.people.map(person => <button className={`tree-person-card ${selected?.id===person.id?"selected":""}`} key={person.id} onClick={()=>openPerson(person)}>
                  <div className="person-photo-frame">{person.photo_url || person.avatar_url ? <img src={person.photo_url || person.avatar_url} alt={person.full_name||"Family member"}/> : <div className="person-photo-placeholder">{initials(person.full_name)}</div>}</div>
                  <div className="person-card-info"><strong>{person.full_name||"Family member"}</strong><span>{person.relationship || (index===0?"Ancestor":index===filtered.length-1?"Youngest generation":"Family member")}</span>{person.birth_date && <em>{year(person.birth_date)}</em>}</div>
                </button>)}
              </div>
              {index < filtered.length-1 && <div className="branch-connector"><span></span><i></i><span></span></div>}
            </section>)}
          </div>
          <div className="living-trunk"><div className="trunk-stem"></div><div className="trunk-left"></div><div className="trunk-right"></div><div className="root-root root-one"></div><div className="root-root root-two"></div><div className="root-root root-three"></div></div>
          <div className="root-caption">🌱 &nbsp; THE ROOTS OF THE YOUNGEST GENERATION</div>
        </div>
      </main>

      {selected && <aside className="member-profile-panel">
        <button className="close-profile" onClick={()=>setSelected(null)}>×</button>
        <div className="profile-image">{selected.photo_url || selected.avatar_url ? <img src={selected.photo_url || selected.avatar_url} alt={selected.full_name}/> : <div className="profile-placeholder">{initials(selected.full_name)}</div>}</div>
        <div className="profile-heading"><span className="profile-kicker">{selected.relationship || "Family member"}</span><h2>{selected.full_name || "Family member"}</h2>{selected.birth_date && <span>Born {date(selected.birth_date)}</span>}</div>
        <div className="profile-actions"><button onClick={()=>setShowAdd(true)}>＋ Add relative</button><button onClick={()=>setMode("explore")}>⌘ Explore branch</button></div>
        <div className="profile-details">{selected.location && <div><span>From</span><strong>{selected.location}</strong></div>}{selected.death_date && <div><span>Died</span><strong>{date(selected.death_date)}</strong></div>}</div>
        <section className="profile-section"><h3>About</h3><p>{selected.bio || "Their story can live here — alongside photographs, family stories, audio memories and milestones."}</p></section>
        <section className="profile-section"><h3>Family</h3><div className="related-list">{parents.map(p=><button key={p.id} onClick={()=>setSelected(p)}>Parent · {p.full_name}</button>)}{spouse && <button onClick={()=>setSelected(spouse)}>Partner · {spouse.full_name}</button>}{siblings.map(p=><button key={p.id} onClick={()=>setSelected(p)}>Sibling · {p.full_name}</button>)}{children.map(p=><button key={p.id} onClick={()=>setSelected(p)}>Child · {p.full_name}</button>)}</div></section>
        <div className="profile-links"><button>📸 Memories</button><button>📖 Stories</button><button>🎙️ Audio</button><button>✦ Milestones</button></div>
      </aside>}
    </div>

    {showAdd && <div className="tree-modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setShowAdd(false)}>
      <form className="tree-add-modal" onSubmit={addPerson}>
        <button type="button" className="close-profile" onClick={()=>setShowAdd(false)}>×</button>
        <span className="eyebrow">GROW THE FAMILY TREE</span><h2>Add a family member</h2><p className="modal-subtitle">Choose the relationship. The tree calculates the generation and makes room automatically.</p>
        <label>Name<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Full name"/></label>
        <div className="form-two"><label>Relationship<select value={form.relationship} onChange={e=>setForm({...form,relationship:e.target.value})}><option value="child">Child</option><option value="parent">Parent</option><option value="sibling">Sibling</option><option value="spouse">Spouse / partner</option></select></label><label>Connected to<select value={form.connectedTo} onChange={e=>setForm({...form,connectedTo:e.target.value})}>{people.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select></label></div>
        <div className="form-two"><label>Display role<input value={form.role} onChange={e=>setForm({...form,role:e.target.value})} placeholder="e.g. Daughter"/></label><label>Birth date<input type="date" value={form.birth} onChange={e=>setForm({...form,birth:e.target.value})}/></label></div>
        <label>Photo URL<input value={form.photo} onChange={e=>setForm({...form,photo:e.target.value})} placeholder="Paste a photo URL for now"/></label>
        <label>Short description<textarea value={form.bio} onChange={e=>setForm({...form,bio:e.target.value})} placeholder="A few words about them..."/></label>
        <div className="modal-actions"><button type="button" onClick={()=>setShowAdd(false)}>Cancel</button><button className="primary" type="submit">Add to the tree</button></div>
      </form>
    </div>}
  </div>;
}
