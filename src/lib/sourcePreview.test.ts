import { describe, expect, it } from 'vitest'
import { sourceBounds, type SourceMetadata, type SourceRow } from './sourcePreview'
const row=(id:string,kind:string,y:number,page=1):SourceRow=>({row:id,kind,page,bounds:[20,y,300,y+15]})
const source:SourceMetadata={sourceFile:'invented.pdf',revision:'test',cardOrder:1,renderScale:1.5,pages:[{page:1,path:'test/p001.png'}],
  rows:[row('a','call_line',30),row('b','header',100),row('c','stub',130),row('d','stub',150),row('e','call_line',190),row('f','meaning_continuation',210),row('g','call_line',240),row('h','card_note',265),row('i','stub',330),row('j','call_line',360)],
  lineReferences:[{row:'a',cardOrder:0},{row:'e',cardOrder:1},{row:'g',cardOrder:1},{row:'j',cardOrder:2}]}
describe('fragment dokumentu źródłowego',()=>{
  it('obejmuje nagłówek, wielowierszową sekwencję, kontynuacje znaczeń i uwagi, bez następnej karty',()=>{
    expect(sourceBounds(source,1)).toEqual({top:142.5,bottom:427.5})
  })
  it('nie przekracza granicy innej karty nawet bez nagłówka',()=>{
    const withoutStub={...source,rows:source.rows.filter(r=>r.row!=='i')}
    expect(sourceBounds(withoutStub,1)).toEqual({top:142.5,bottom:427.5})
  })
  it('nie bierze kontynuacji poprzedniej karty za nagłówek bieżącej',()=>{
    const other={...source,rows:[row('a','call_line',30),row('b','meaning_continuation',100),...source.rows.slice(4)]}
    expect(sourceBounds(other,1)?.top).toBe(277.5)
  })
  it('obsługuje kolejną stronę, nie dołącza notatki kategorii',()=>{
    const multi={...source,rows:[...source.rows,row('k','call_line',10,2),row('l','meaning_continuation',30,2),row('m','category_note',70,2)],lineReferences:[...source.lineReferences,{row:'k',cardOrder:1}]}
    expect(sourceBounds(multi,2)).toEqual({top:7.5,bottom:75})
  })
  it('bez pewnego powiązania odzywek pokazuje pełną stronę',()=>{
    expect(sourceBounds({...source,cardOrder:-1},1)).toBeNull()
    expect(sourceBounds(source,2)).toBeNull()
  })
})
