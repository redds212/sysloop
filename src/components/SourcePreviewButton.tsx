import { useEffect, useState } from 'react'
import type { LearningRepository } from '../lib/learningRepository'
import type { SourceFragment, SourcePreview } from '../lib/sourcePreview'
import { Modal } from './Modal'

function Fragment({fragment}:{fragment:SourceFragment}) {
  const [full,setFull]=useState(false),[zoom,setZoom]=useState(false),[dimensions,setDimensions]=useState<{width:number;height:number}|null>(null),[failed,setFailed]=useState(false)
  const top=Math.min(fragment.top??0,dimensions?.height??Infinity)
  const bottom=Math.min(fragment.bottom??Infinity,dimensions?.height??Infinity)
  const cropped=!full&&dimensions&&fragment.top!==null&&bottom>top
  return <section className="source-fragment"><div className="source-toolbar"><h3>Strona {fragment.page}</h3>{fragment.top!==null&&<button className="text-button" aria-pressed={full} onClick={()=>setFull(v=>!v)}>{full?'Pokaż fragment':'Cała strona'}</button>}<button className="text-button" aria-pressed={zoom} onClick={()=>setZoom(v=>!v)}>{zoom?'Dopasuj':'Powiększ'}</button></div>
    {fragment.top===null&&<p className="muted">Dalszy ciąg lub brak pewnych granic fragmentu — pokazujemy całą stronę.</p>}
    {zoom&&<p className="muted">Przesuwaj obraz, aby przeczytać pozostałą część.</p>}
    {failed?<p role="alert">Obraz wygasł lub nie został pobrany. Zamknij podgląd i otwórz go ponownie.</p>:<div className="source-viewport"><div className="source-image" style={{...(zoom?{minWidth:dimensions?.width??800}:{}),...(cropped?{aspectRatio:`${dimensions.width} / ${bottom-top}`,position:'relative',overflow:'hidden'}:{})}}>
      <img src={fragment.url} alt={`Oryginał, strona ${fragment.page}${cropped?' — fragment karty':''}`} onError={()=>setFailed(true)} onLoad={e=>setDimensions({width:e.currentTarget.naturalWidth,height:e.currentTarget.naturalHeight})} style={cropped?{position:'absolute',width:'100%',maxWidth:'none',top:0,left:0,transform:`translateY(-${100*top/dimensions.height}%)`}:{width:'100%'}}/>
    </div></div>}
  </section>
}
function SourceContent({cardId,repository}:{cardId:string;repository:LearningRepository}) {
  const [source,setSource]=useState<SourcePreview|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0)
  useEffect(()=>{let active=true;void repository.sourcePreview!(cardId).then(value=>{if(active)setSource(value)}).catch(()=>{if(active)setError('Nie udało się pobrać oryginału. Sprawdź połączenie; podgląd wymaga aktualizacji bazy przez administratora.')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[cardId,repository,retry])
  if(loading)return <p role="status">Wczytywanie oryginału…</p>
  if(error)return <div><p role="alert">{error}</p><button className="text-button" onClick={()=>{setError('');setLoading(true);setRetry(n=>n+1)}}>Spróbuj ponownie</button></div>
  if(!source?.fragments.length)return <p>Brak zapisanego obrazu dla tej wersji karty. Administrator musi dołączyć strony podczas importu.</p>
  return <><p className="muted">{source.sourceFile} · {source.revision}</p><p className="muted">Oryginał może różnić się od późniejszych korekt w aplikacji.</p>{source.fragments.map(fragment=><Fragment key={`${retry}:${fragment.page}`} fragment={fragment}/>)}</>
}
export function SourcePreviewButton({cardId,repository}:{cardId:string;repository:LearningRepository}) {
  const [open,setOpen]=useState(false)
  if(!repository.sourcePreview)return null
  return <><button className="text-button" onClick={()=>setOpen(true)}>Oryginalny fragment</button>{open&&<Modal title="Oryginał systemu" onClose={()=>setOpen(false)}><SourceContent cardId={cardId} repository={repository}/></Modal>}</>
}
