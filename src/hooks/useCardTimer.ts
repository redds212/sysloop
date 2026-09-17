import { useEffect, useState } from 'react'
// Mount one hook per card load. Deadlines also expire while the tab is asleep.
export function useCardTimer(enabled: boolean, limitSeconds: number, stopped: boolean, onExpire: () => void) {
  const [deadline] = useState(()=>Date.now()+limitSeconds*1000)
  const [remaining,setRemaining] = useState(limitSeconds)
  useEffect(()=>{
    if(!enabled||stopped)return
    const tick=()=>{const left=Math.max(0,Math.ceil((deadline-Date.now())/1000));setRemaining(left);if(left===0)onExpire()}
    const interval=window.setInterval(tick,200)
    window.addEventListener('focus',tick);document.addEventListener('visibilitychange',tick)
    return()=>{window.clearInterval(interval);window.removeEventListener('focus',tick);document.removeEventListener('visibilitychange',tick)}
  },[deadline,enabled,stopped,onExpire])
  return {remaining, expiredNow:()=>enabled&&Date.now()>=deadline}
}
