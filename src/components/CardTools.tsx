import type { Card, Category } from '../types'
import type { LearningRepository } from '../lib/learningRepository'
import { DifficultStarButton } from './DifficultStarButton'
import { ReportCardButton } from './ReportCardButton'

export function CardTools({card,category,repository,starred,busy,onStar}: {
  card:Card;category?:Category;repository:LearningRepository;
  starred:boolean;busy:boolean;onStar?:()=>Promise<void>
}) {
  return <div className="card-tools" role="group" aria-label="Akcje pozycji">
    {onStar&&<DifficultStarButton starred={starred} busy={busy} onToggle={onStar}/>}
    <ReportCardButton key={card.id} card={card} category={category} repository={repository}/>
    <ReportCardButton key={`${card.id}:discussion`} kind="discussion" card={card} category={category} repository={repository}/>
  </div>
}
