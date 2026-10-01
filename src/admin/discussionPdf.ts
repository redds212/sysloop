import pdfMake from 'pdfmake/build/pdfmake'
import regularUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url'
import boldUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf?url'
import { discussionDocument, discussionFileName, type DiscussionExportData } from './discussionDocument'

let fontsReady:Promise<void>|undefined
async function fontData(url:string):Promise<string> {
  const response=await fetch(url,{signal:AbortSignal.timeout(30_000)})
  if(!response.ok)throw new Error('Nie udało się wczytać czcionki PDF.')
  const bytes=new Uint8Array(await response.arrayBuffer())
  let binary=''
  for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192))
  return btoa(binary)
}
async function prepareFonts() {
  const [regular,bold]=await Promise.all([fontData(regularUrl),fontData(boldUrl)])
  pdfMake.addVirtualFileSystem({'DejaVuSans.ttf':regular,'DejaVuSans-Bold.ttf':bold})
  pdfMake.addFonts({DejaVu:{normal:'DejaVuSans.ttf',bold:'DejaVuSans-Bold.ttf',italics:'DejaVuSans.ttf',bolditalics:'DejaVuSans-Bold.ttf'}})
}
export async function createDiscussionPdf(data:DiscussionExportData):Promise<{blob:Blob;name:string}> {
  fontsReady??=prepareFonts().catch(error=>{fontsReady=undefined;throw error})
  await fontsReady
  const blob=await pdfMake.createPdf(discussionDocument(data)).getBlob()
  return {blob,name:discussionFileName(data.exportedAt)}
}
