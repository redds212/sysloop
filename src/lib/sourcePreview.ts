export interface SourceRow { row: string; kind: string; page: number; bounds: [number,number,number,number] }
export interface SourceMetadata {
  sourceFile: string; revision: string; cardOrder: number; renderScale: number;
  pages: {page:number;path:string}[];
  rows: SourceRow[];
  lineReferences: {row:string;cardOrder:number}[];
}
export interface SourceFragment { page:number;url:string;top:number|null;bottom:number|null }
export interface SourcePreview { sourceFile:string;revision:string;fragments:SourceFragment[] }

/** Geometry only: meanings and parsed text are never needed to crop the source. */
export function sourceBounds(source:SourceMetadata, page:number): {top:number;bottom:number}|null {
  const rows=source.rows.filter(row=>row.page===page).sort((a,b)=>a.bounds[1]-b.bounds[1])
  const owners=new Map(source.lineReferences.map(ref=>[ref.row,ref.cardOrder]))
  const indices=rows.flatMap((row,index)=>owners.get(row.row)===source.cardOrder?[index]:[])
  if(!indices.length)return null // A continuation-only page needs its full context.
  let start=indices[0],end=indices[indices.length-1]
  while(start>0&&['stub','header','qualifier'].includes(rows[start-1].kind))start--
  while(end+1<rows.length) {
    const next=rows[end+1],owner=owners.get(next.row)
    if(['stub','header','category_note'].includes(next.kind)||(owner!==undefined&&owner!==source.cardOrder))break
    end++
  }
  const top=Math.max(0,rows[start].bounds[1]-5)*source.renderScale
  const bottom=(Math.max(...rows.slice(start,end+1).map(row=>row.bounds[3]))+5)*source.renderScale
  return Number.isFinite(top)&&Number.isFinite(bottom)&&bottom>top?{top,bottom}:null
}
