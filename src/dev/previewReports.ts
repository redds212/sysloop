import type { ReportRow } from '../lib/database.types'

const key='sysloop:preview:reports'
export function readPreviewReports(storage?:Storage):ReportRow[] {
  return JSON.parse(storage?.getItem(key)??'[]')
}
export function writePreviewReports(storage:Storage|undefined,reports:ReportRow[]) {
  storage?.setItem(key,JSON.stringify(reports))
}
