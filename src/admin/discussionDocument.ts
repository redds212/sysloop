import type { Content, ContentText, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces'
import type { CardRow, CategoryRow, ReportRow } from '../lib/database.types'
import { compactAuction } from '../lib/auction/display'
import { when, statusLabel } from './labels'

export interface DiscussionExportData {
  reports: ReportRow[]
  cards: CardRow[]
  categories: CategoryRow[]
  exportedAt: string
}
const labels={new:'Do omówienia',seen:'W toku',resolved:'Omówione'}
const colors:Record<string,string>={'♣':'#16803e','♦':'#a34d06','♥':'#bb3036','♠':'#254c99'}
const rich=(text:string):ContentText[]=>text.replace(/[\uFE0E\uFE0F]/g,'').split(/([♣♦♥♠])/).map(part=>({text:part,...(colors[part]?{color:colors[part]}:{})}))
const paragraph=(text:string,style='body'):Content=>({text:rich(text),style})

/** Current card content; selected lines are matched only by their saved keys. */
export function discussionDocument(data:DiscussionExportData):TDocumentDefinitions {
  if(!data.reports.length||data.reports.some(r=>r.kind!=='discussion'))throw new Error('Eksport wymaga tematów do dyskusji.')
  const cards=new Map(data.cards.map(c=>[c.id,c])),categories=new Map(data.categories.map(c=>[c.slug,c]))
  const content:Content[]=[]
  data.reports.forEach((r,index)=>{
    const card=cards.get(r.card_id),category=card?categories.get(card.category_slug):undefined
    const selected=r.selected_lines??[],keys=new Set(selected.map(l=>l.key))
    content.push(
      {text:`TEMAT #${r.id}  /  ${labels[r.status]}`,style:'eyebrow',...(index?{pageBreak:'before' as const}:{})},
      {text:rich(category?.name??r.card_label??'Pozycja niedostępna'),style:'title'},
      paragraph(`Zgłasza: ${r.reporter_label||'Usunięty użytkownik'}  |  ${when(r.created_at)}`,'meta'),
      {table:{widths:['*'],body:[[{stack:[{text:'KOMENTARZ DO DYSKUSJI',style:'commentLabel'},paragraph(r.message)],fillColor:'#fff6df',margin:[8,6,8,6]}]]},layout:'noBorders',margin:[0,8,0,12]},
      paragraph(selected.length?`Wskazane odzywki: ${selected.map(l=>l.label).join(', ')}`:'Zakres dyskusji: cała pozycja.','scope'),
    )
    if(!card){
      content.push(paragraph('Brak aktualnej karty. Poniżej zachowano oznaczenie pozycji z ticketa; nie odtwarzamy jej znaczeń.','warning'),paragraph(r.card_label||'Brak opisu pozycji.'))
      return
    }
    content.push(
      paragraph(`Aktualna karta · ${statusLabel[card.status]} · ${card.source_revision||'bez oznaczenia wersji'} · strona źródła ${card.source_page}`,'meta'),
      paragraph(`Stan karty zapisany: ${when(card.updated_at)}`,'meta'),
      ...(card.section?[paragraph(card.section,'section')]:[]),
      {text:rich(`${compactAuction(card.auction)} – ?`),style:'auction'},
      ...(card.context?[paragraph(`Kontekst: ${card.context}`,'scope')]:[]),
    )
    const missing=selected.filter(l=>!card.lines.some(line=>line.key===l.key))
    if(missing.length)content.push(paragraph(`Odzywki wskazane w tickecie, których nie ma już w aktualnej karcie: ${missing.map(l=>l.label).join(', ')}. Ich znaczenia nie są odtwarzane.`,'warning'))
    const rows:TableCell[][]=card.lines.map(line=>{
      const marked=!selected.length||keys.has(line.key)
      const fillColor=marked?'#fff6df':'#ffffff'
      return [
        {text:marked?'DO\nDYSKUSJI':'',fontSize:7,bold:true,color:'#835200',fillColor},
        {text:rich(line.label),bold:true,fillColor},
        {text:rich(line.meaning||'(Brak znaczenia w karcie)'),fillColor},
      ]
    })
    content.push({
      table:{headerRows:1,keepWithHeaderRows:1,widths:[47,57,'*'],body:[
        [{text:'Zakres',style:'tableHead'},{text:'Odzywka',style:'tableHead'},{text:'Aktualne znaczenie',style:'tableHead'}],...rows,
      ]},
      layout:{hLineWidth:()=>0.5,vLineWidth:()=>0,hLineColor:()=>'#d8dde3',paddingTop:()=>7,paddingBottom:()=>7,paddingLeft:()=>6,paddingRight:()=>6},
      margin:[0,8,0,12],
    })
    const notes=[card.auction_note,...card.notes].filter((note):note is string=>!!note)
    if(notes.length)content.push({text:'UWAGI DO AKTUALNEJ KARTY',style:'eyebrow'},...notes.map(note=>paragraph(note)))
  })
  return {
    pageSize:'A4',pageMargins:[40,58,40,48],
    info:{title:'SysLoop - tematy do dyskusji',author:'System RJ-WG',subject:'Aktualne karty i komentarze do ustaleń'},
    defaultStyle:{font:'DejaVu',fontSize:10,lineHeight:1.18,color:'#182433'},
    header:{columns:[{text:'SysLoop  /  SYSTEM RJ-WG',bold:true,color:'#16805f'},{text:'TEMATY DO DYSKUSJI',alignment:'right',color:'#596673'}],fontSize:9,margin:[40,24,40,0]},
    footer:(page,pages)=>({columns:[{text:`Eksport: ${when(data.exportedAt)} · Warszawa`},{text:`${page} / ${pages}`,alignment:'right'}],fontSize:8,color:'#596673',margin:[40,16,40,0]}),
    styles:{
      eyebrow:{fontSize:9,bold:true,color:'#596673',margin:[0,0,0,6]},
      title:{fontSize:18,bold:true,margin:[0,0,0,6]},
      meta:{fontSize:8,color:'#596673',margin:[0,0,0,4]},
      commentLabel:{fontSize:8,bold:true,color:'#835200',margin:[0,0,0,5]},
      body:{margin:[0,0,0,5]},scope:{bold:true,fontSize:9,margin:[0,0,0,7]},
      section:{fontSize:9,margin:[0,8,0,5]},auction:{fontSize:14,bold:true,margin:[0,5,0,9]},
      warning:{color:'#8a3b13',fontSize:9,margin:[0,6,0,8]},
      tableHead:{fontSize:8,bold:true,color:'#ffffff',fillColor:'#223b4a'},
    },
    content,
  }
}

export function discussionFileName(exportedAt:string):string {
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(exportedAt))
  return `SysLoop-dyskusje-${day}.pdf`
}
