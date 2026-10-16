import { useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";
import mapStorageError from "../../lib/storageHelpers";
import "./FamilyTree.css";

function year(value) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.getFullYear();
}

function date(value) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
}

export default function FamilyTree({
  people = [],
  relationships = [],
  currentUserId,
  onRefresh,
}) {
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [zoom, setZoom] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    relationship: "root",
    connectedTo: "",
    role: "",
    birth: "",
    bio: "",
    photo: null,
  });

  const generations = useMemo(() => {
    const groups = new Map();
    people.forEach((person) => {
      const generation = Number.isFinite(Number(person.generation))
        ? Number(person.generation)
        : 0;
      if (!groups.has(generation)) groups.set(generation, []);
      groups.get(generation).push(person);
    });

    return [...groups.entries()]
      .sort(([a], [b]) => a - b)
      .map(([generation, members]) => ({
        generation,
        members: members.sort((a, b) =>
          (a.full_name || "").localeCompare(b.full_name || ""),
        ),
      }));
  }, [people]);

  const filteredGenerations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return generations;

    return generations
      .map((generation) => ({
        ...generation,
        members: generation.members.filter((person) =>
          `${person.full_name || ""} ${person.relationship || ""} ${person.location || ""}`
            .toLowerCase()
            .includes(query),
        ),
      }))
      .filter((generation) => generation.members.length);
  }, [generations, search]);

  const selectedParents = selected
    ? people.filter((person) => person.id === selected.parent_id)
    : [];
  const selectedChildren = selected
    ? people.filter((person) => person.parent_id === selected.id)
    : [];
  const selectedSpouse = selected?.spouse_id
    ? people.find((person) => person.id === selected.spouse_id)
    : null;
  const selectedRelated = selected
    ? relationships
        .filter(
          (relationship) =>
            relationship.person_id === selected.id ||
            relationship.related_person_id === selected.id,
        )
        .map((relationship) => {
          const id =
            relationship.person_id === selected.id
              ? relationship.related_person_id
              : relationship.person_id;
          return {
            ...relationship,
            person: people.find((person) => person.id === id),
          };
        })
        .filter((item) => item.person)
    : [];

  function openAdd(connectedTo = "") {
    setError("");
    setForm((current) => ({
      ...current,
      connectedTo,
      relationship: people.length ? "child" : "root",
    }));
    setShowAdd(true);
  }

  async function uploadPhoto(file, personId) {
    if (!file) return null;
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `family-tree/${currentUserId}/${personId}-${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("family-media")
      .upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });
    if (uploadError) throw new Error(mapStorageError(uploadError));
    return path;
  }

  async function addPerson(event) {
    event.preventDefault();
    if (!form.name.trim()) return;
    if (people.length && !form.connectedTo) {
      setError("Choose the family member this person is connected to.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const connected = people.find((person) => person.id === form.connectedTo);
      let generation = 0;
      let parentId = null;
      let spouseId = null;

      if (connected) {
        generation = Number(connected.generation || 0);
        if (form.relationship === "child") {
          generation += 1;
          parentId = connected.id;
        } else if (form.relationship === "parent") {
          generation = Math.max(0, generation - 1);
          parentId = connected.parent_id || null;
        } else if (form.relationship === "sibling") {
          parentId = connected.parent_id || null;
        } else if (form.relationship === "spouse") {
          spouseId = connected.id;
        }
      }

      const { data: person, error: insertError } = await supabase
        .from("family_people")
        .insert({
          full_name: form.name.trim(),
          relationship: form.role.trim() || form.relationship,
          birth_date: form.birth || null,
          bio: form.bio.trim() || null,
          generation,
          parent_id: parentId,
          spouse_id: spouseId,
          created_by: currentUserId,
        })
        .select("*")
        .single();

      if (insertError) throw insertError;

      if (form.photo) {
        const photoPath = await uploadPhoto(form.photo, person.id);
        const { error: photoError } = await supabase
          .from("family_people")
          .update({ photo_path: photoPath })
          .eq("id", person.id);
        if (photoError) throw photoError;
      }

      if (connected) {
        const relationshipRows = [];
        if (form.relationship === "child" || form.relationship === "parent") {
          relationshipRows.push({
            person_id: person.id,
            related_person_id: connected.id,
            relationship_type:
              form.relationship === "child" ? "child" : "parent",
            created_by: currentUserId,
          });
        } else if (form.relationship === "spouse") {
          relationshipRows.push(
            {
              person_id: person.id,
              related_person_id: connected.id,
              relationship_type: "spouse",
              created_by: currentUserId,
            },
            {
              person_id: connected.id,
              related_person_id: person.id,
              relationship_type: "spouse",
              created_by: currentUserId,
            },
          );
        } else if (form.relationship === "sibling") {
          relationshipRows.push({
            person_id: person.id,
            related_person_id: connected.id,
            relationship_type: "sibling",
            created_by: currentUserId,
          });
        }

        if (relationshipRows.length) {
          const { error: relationshipError } = await supabase
            .from("family_relationships")
            .insert(relationshipRows);
          if (relationshipError) throw relationshipError;
        }
      }

      setShowAdd(false);
      setForm({
        name: "",
        relationship: "child",
        connectedTo: "",
        role: "",
        birth: "",
        bio: "",
        photo: null,
      });
      await onRefresh?.();
    } catch (caughtError) {
      console.error("Could not add family-tree person", caughtError);
      setError(caughtError?.message || "Could not add this family member.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page family-tree-page">
      <header className="family-tree-header">
        <div className="family-tree-heading">
          <span className="eyebrow">THE FAMILY ARCHIVE</span>
          <h1>Our family, through generations</h1>
          <p>
            A living family structure built from the people and relationships
            you add to the archive.
          </p>
        </div>
        <button className="add-member-button" onClick={() => openAdd()}>
          <span>+</span> Add family member
        </button>
      </header>

      <div className="family-tree-toolbar">
        <label className="tree-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search family members"
            aria-label="Search family members"
          />
        </label>
        <div className="tree-controls" aria-label="Tree zoom controls">
          <button type="button" onClick={() => setZoom((value) => Math.min(1.35, value + 0.1))}>
            +
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((value) => Math.max(0.7, value - 0.1))}>
            −
          </button>
          <button type="button" className="reset-zoom" onClick={() => setZoom(1)}>
            Reset
          </button>
        </div>
      </div>

      <div className="family-tree-layout">
        <main className="family-tree-canvas">
          {!people.length ? (
            <div className="tree-empty">
              <span className="eyebrow">A CLEAN BEGINNING</span>
              <h2>Your family tree starts here.</h2>
              <p>
                There are no genealogy people yet. Add your first real family
                member and the structure will grow from their relationships.
              </p>
              <button type="button" onClick={() => openAdd()}>
                + Add the first family member
              </button>
            </div>
          ) : !filteredGenerations.length ? (
            <div className="tree-empty compact">
              <h2>No family member matches that search.</h2>
              <button type="button" onClick={() => setSearch("")}>Clear search</button>
            </div>
          ) : (
            <div className="tree-stage" style={{ transform: `scale(${zoom})` }}>
              {filteredGenerations.map((generation, index) => (
                <section className="tree-generation" key={generation.generation}>
                  <div className="generation-label">
                    <span>
                      {index === 0
                        ? "EARLIEST GENERATION"
                        : `GENERATION ${index + 1}`}
                    </span>
                    <small>
                      {generation.members.length} {generation.members.length === 1 ? "person" : "people"}
                    </small>
                  </div>
                  <div className="people-row">
                    {generation.members.map((person) => (
                      <button
                        type="button"
                        className={`tree-person-card ${selected?.id === person.id ? "selected" : ""}`}
                        key={person.id}
                        onClick={() => setSelected(person)}
                      >
                        <div className="person-photo-frame">
                          {person.photo_url ? (
                            <img src={person.photo_url} alt={person.full_name || "Family member"} />
                          ) : (
                            <span className="empty-person-frame" aria-hidden="true" />
                          )}
                        </div>
                        <div className="person-card-info">
                          <strong>{person.full_name || "Unnamed family member"}</strong>
                          {person.relationship && <span>{person.relationship}</span>}
                          {person.birth_date && <em>{year(person.birth_date)}</em>}
                        </div>
                      </button>
                    ))}
                  </div>
                  {index < filteredGenerations.length - 1 && (
                    <div className="generation-connector" aria-hidden="true">
                      <span />
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}
        </main>

        {selected && (
          <aside className="member-profile-panel">
            <button
              type="button"
              className="close-profile"
              onClick={() => setSelected(null)}
              aria-label="Close family member profile"
            >
              ×
            </button>
            {selected.photo_url && (
              <div className="profile-image">
                <img src={selected.photo_url} alt={selected.full_name || "Family member"} />
              </div>
            )}
            <div className="profile-heading">
              <span className="profile-kicker">{selected.relationship || "Family member"}</span>
              <h2>{selected.full_name || "Family member"}</h2>
              {selected.birth_date && <span>Born {date(selected.birth_date)}</span>}
            </div>
            <div className="profile-actions">
              <button type="button" onClick={() => openAdd(selected.id)}>＋ Add relative</button>
            </div>
            {(selected.location || selected.death_date) && (
              <div className="profile-details">
                {selected.location && <div><span>From</span><strong>{selected.location}</strong></div>}
                {selected.death_date && <div><span>Died</span><strong>{date(selected.death_date)}</strong></div>}
              </div>
            )}
            <section className="profile-section">
              <h3>About</h3>
              <p>{selected.bio || "No biography has been added yet."}</p>
            </section>
            <section className="profile-section">
              <h3>Family</h3>
              <div className="related-list">
                {selectedParents.map((person) => (
                  <button type="button" key={person.id} onClick={() => setSelected(person)}>Parent · {person.full_name}</button>
                ))}
                {selectedSpouse && (
                  <button type="button" onClick={() => setSelected(selectedSpouse)}>Partner · {selectedSpouse.full_name}</button>
                )}
                {selectedChildren.map((person) => (
                  <button type="button" key={person.id} onClick={() => setSelected(person)}>Child · {person.full_name}</button>
                ))}
                {selectedRelated.map(({ person, relationship_type: type }) => (
                  <button type="button" key={`${type}-${person.id}`} onClick={() => setSelected(person)}>{type} · {person.full_name}</button>
                ))}
                {!selectedParents.length && !selectedSpouse && !selectedChildren.length && !selectedRelated.length && (
                  <span className="no-related">No relationships added yet.</span>
                )}
              </div>
            </section>
          </aside>
        )}
      </div>

      {showAdd && (
        <div className="tree-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowAdd(false)}>
          <form className="tree-add-modal" onSubmit={addPerson}>
            <button type="button" className="close-profile" onClick={() => setShowAdd(false)} aria-label="Close">×</button>
            <span className="eyebrow">GROW THE FAMILY TREE</span>
            <h2>Add a real family member</h2>
            <p className="modal-subtitle">
              Start with one person, then connect parents, children, siblings or partners as your family grows.
            </p>

            <label>
              Full name
              <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>

            {people.length > 0 && (
              <div className="form-two">
                <label>
                  Relationship
                  <select value={form.relationship} onChange={(event) => setForm({ ...form, relationship: event.target.value })}>
                    <option value="child">Child</option>
                    <option value="parent">Parent</option>
                    <option value="sibling">Sibling</option>
                    <option value="spouse">Spouse / partner</option>
                  </select>
                </label>
                <label>
                  Connect to
                  <select required value={form.connectedTo} onChange={(event) => setForm({ ...form, connectedTo: event.target.value })}>
                    <option value="">Choose a person</option>
                    {people.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
                  </select>
                </label>
              </div>
            )}

            <div className="form-two">
              <label>
                Display relationship
                <input value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} placeholder="e.g. Daughter" />
              </label>
              <label>
                Birth date
                <input type="date" value={form.birth} onChange={(event) => setForm({ ...form, birth: event.target.value })} />
              </label>
            </div>

            <label>
              Photo
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setForm({ ...form, photo: event.target.files?.[0] || null })} />
            </label>

            <label>
              Short description
              <textarea value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} rows={4} />
            </label>

            {error && <p className="tree-form-error">{error}</p>}
            <div className="modal-actions">
              <button type="button" onClick={() => setShowAdd(false)} disabled={saving}>Cancel</button>
              <button className="primary" type="submit" disabled={saving}>{saving ? "Adding…" : "Add to the tree"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
