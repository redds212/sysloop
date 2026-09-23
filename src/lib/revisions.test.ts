import { expect, it } from 'vitest'
import { previewData } from '../dev/fixtures'
import { revisionFixtures } from '../dev/revisionFixtures'
import { grade } from './grading'
import { newLineKeys, previousLine, revisionLines } from './revisions'

it('rozróżnia zmienioną, nową i usuniętą odzywkę, pomijając niezmienione',()=>{
  const data=previewData(),revision=revisionFixtures(data.cards)[0]
  const diff=revisionLines(revision)
  expect(diff).toHaveLength(2)
  expect(diff[0].before).not.toBeNull()
  expect(diff[1].before).toBeNull()
  const removed=structuredClone(revision)
  removed.after_snapshot.lines=[]
  expect(revisionLines(removed).every(d=>d.after===null)).toBe(true)
  expect(revisionLines(revisionFixtures(data.cards)[1]).every(d=>d.before===null)).toBe(true)
})
it('NEW znika po pierwszej zapisanej ocenie wersji, również błędnej i częściowej',()=>{
  const card=previewData().cards[0],keys=card.lines.slice(0,2).map(l=>l.key)
  expect(newLineKeys(card,[])).toEqual(keys)
  const attempt=grade(card,[keys[0]],false,'hard')
  expect(newLineKeys(card,[attempt])).toEqual([])
  const partial=grade({...card,lines:[card.lines[0]]},[keys[0]],false,'buffer')
  expect(newLineKeys(card,[{...partial,scope:'partial'}])).toEqual([keys[1]])
  expect(newLineKeys(card,[{...attempt,lineVersions:undefined}])).toEqual(keys)
  const newer={...card,lines:card.lines.map(l=>({...l,changeId:'next-version'}))}
  expect(newLineKeys(newer,[attempt])).toHaveLength(card.lines.length)
})
it('poprzednie znaczenie pochodzi z właściwej wersji i nowa odzywka ma pusty przed',()=>{
  const card=previewData().cards[0],rows=revisionFixtures([card])
  expect(previousLine(rows,card,card.lines[0].key)?.before?.meaning).toContain('poprzednie ustalenie')
  expect(previousLine(rows,card,card.lines[1].key)?.before).toBeNull()
  expect(previousLine(rows,{...card,lines:card.lines.map(l=>({...l,changeId:'unrelated'}))},card.lines[0].key)).toBeUndefined()
  expect(previousLine(rows,card,card.lines[2].key)).toBeUndefined()
})
