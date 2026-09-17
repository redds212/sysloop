import type { Category } from '../types'
export function NotesView({ category }: { category: Category }) {
  return <div className="notes-view"><p className="eyebrow">{category.name}</p><h1>Notatki</h1>
    {!category.notes.length&&<p className="muted">W tej kategorii nie ma osobnych notatek.</p>}
    {category.notes.map((note,i)=><section className="panel" key={i}><h2 className="section-title">{note.title}</h2><p className="verbatim">{note.body}</p></section>)}
  </div>
}
