import { useEffect, useRef, type ReactNode } from 'react'
export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref=useRef<HTMLDialogElement>(null)
  useEffect(()=>{ const dialog=ref.current; dialog?.showModal(); return()=>dialog?.close() },[])
  return <dialog ref={ref} className="sheet" aria-label={title} onCancel={e=>{e.preventDefault();onClose()}}>
    <header className="sheet-head"><h2>{title}</h2><button onClick={onClose} aria-label="Zamknij" className="icon-button">×</button></header>{children}
  </dialog>
}
