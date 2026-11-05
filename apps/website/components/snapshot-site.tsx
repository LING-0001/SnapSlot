'use client';
import LanguageMenu from '@linglinglab/web-ui/language-menu';
import BackToTop from '@linglinglab/web-ui/back-to-top';
import {Apple} from '@linglinglab/web-ui/showcase-icons';
import type {Locale} from '@/lib/locales';
import {downloads} from '@/lib/releases';
import {Home,GitHubMark} from './home';
import {type MouseEvent,type KeyboardEvent} from 'react';
import {useDesktopPlatform} from '@/lib/client-platform';
import {snapshotCopy,snapshotDeviceCopy} from '@/lib/snapshot-copy';
import {landingDemoCopy} from '@/lib/landing-demo-copy';
import {referenceCopy} from '@/lib/reference-copy';
function Windows(){return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m3 5 8-1v8H3zm10-1.3L22 2v10h-9zM3 14h8v8l-8-1zm10 0h9v10l-9-1.7z"/></svg>}
function Symbol({kind}:{kind:number}){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind===0?<><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.4"/><path d="m4 18 5-6 4 4 3-3 4 5"/></>:kind===1?<><path d="M9 18h6m-6 3h6M8 14a7 7 0 1 1 8 0c-1 1-1 2-1 3H9c0-1 0-2-1-3Z"/></>:<><rect x="5" y="2" width="15" height="20" rx="3"/><path d="M9 7h7M9 12h7M9 17h4"/></>}</svg>}
function Chevron(){return <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m4 7 6 6 6-6"/></svg>}
function DownloadIcon(){return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></svg>}
export default function SnapshotSite({locale}:{locale:Locale}){
 const [platform,setDownloadPlatform]=useDesktopPlatform();
 const downloadPlatform=platform??'win';
 const r=referenceCopy[locale];
 const t=snapshotCopy[locale],d=snapshotDeviceCopy[locale],info=landingDemoCopy[locale],home=`${process.env.NEXT_PUBLIC_HOME_URL||'https://linglinglab.top'}/${locale}/`;
 const onDownloadKey=(event:KeyboardEvent<HTMLButtonElement>,platform:'mac'|'win')=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();const next=event.key==='Home'?'mac':event.key==='End'?'win':platform==='mac'?'win':'mac';
  setDownloadPlatform(next);document.getElementById(`download-tab-${next}`)?.focus();
 };
 const scrollSection=(event:MouseEvent<HTMLDivElement>)=>{
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const link=(event.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
  const target=link&&document.getElementById(link.hash.slice(1));
  if(!target)return;
  event.preventDefault();
  target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  if(link.classList.contains('ll-skip'))target.focus({preventScroll:true});
 };
 return <div className="ll-page ss-site" onClick={scrollSection}>
  <a className="ll-skip" href="#desktop">{d.experience}</a>
  <header className="ll-nav"><div className="ll-shell">
   <a id="snapshot-brand" className="ll-brand ll-product-brand" href={`/${locale}/`}><img src="/brand/current/snapslot.png" width="56" height="56" alt=""/><span>{t.name}{locale.startsWith('zh')&&<small>Snapshot Pin</small>}</span></a>
   <nav aria-label={t.scenes}><a className="ss-nav-scenes" href="#features">{t.scenes}</a><a className="ss-nav-download" href="#downloads">{r.navDownload}</a><a className="ss-github" href="https://github.com/LING-0001/SnapSlot" target="_blank" rel="noopener noreferrer" aria-label="GitHub"><GitHubMark size={21}/></a><LanguageMenu locale={locale} ariaLabel={t.language}/></nav>
  </div></header>
  <main>
   <section className="ll-shell ss-intro" aria-labelledby="snapshot-title">
    <span className="ss-platform-badge">{r.badge}</span><h1 id="snapshot-title">{t.headline.map(line=><span key={line}>{line}</span>)}</h1><p>{t.description}</p><a className="ss-try-link" href="#desktop">{r.try}<span aria-hidden="true">↓</span></a>
   </section>
   <section className="ss-fullscreen" id="desktop" aria-label={info.label} tabIndex={-1}><Home locale={locale} embedded/></section>
   <section className="ll-shell ss-use-cases" id="features" aria-labelledby="use-title"><div className="ll-section-heading"><h2 id="use-title">{t.section}</h2><p>{t.sub}</p></div><div className="ss-use-grid">{t.features.map(([title,description],i)=><article className="ss-use-card" key={title}><span className="ss-feature-icon"><Symbol kind={i}/></span><h3>{title}</h3><p>{description}</p></article>)}</div><div className="ss-product-information"><article><h3>{info.rules}</h3><p>{info.appRules}</p></article><article><h3>{info.privacy}</h3><p>{info.privacyText}</p></article></div></section>
   <section className="ll-shell ss-downloads" id="downloads" aria-labelledby="download-title">
    <img className="ss-download-icon" src="/brand/current/snapslot.png" width="88" height="88" alt="" loading="lazy"/><h2 id="download-title">{r.downloadTitle}</h2>
    <div className="ss-download-choice" style={{visibility:platform?undefined:'hidden'}}>
    <div className="ss-download-tabs" role="tablist" aria-label={r.navDownload}>{(['mac','win'] as const).map(platform=><button type="button" role="tab" key={platform} id={`download-tab-${platform}`} aria-selected={downloadPlatform===platform} tabIndex={downloadPlatform===platform?0:-1} onKeyDown={event=>onDownloadKey(event,platform)} aria-controls={`download-panel-${platform}`} onClick={()=>setDownloadPlatform(platform)}>{platform==='mac'?<Apple size={18}/>:<Windows/>}{platform==='mac'?'macOS':'Windows'}</button>)}</div>
    {(['mac','win'] as const).map(platform=><div key={platform} className="ss-download-panel" id={`download-panel-${platform}`} role="tabpanel" aria-labelledby={`download-tab-${platform}`} hidden={downloadPlatform!==platform} data-platform={platform}><p>{platform==='mac'?'macOS 13+ · Apple Silicon / Intel':info.windowsSystem}</p>{platform==='win'&&<p className="ss-runtime-requirement">{info.requirements}<a href="https://developer.microsoft.com/microsoft-edge/webview2/#download" target="_blank" rel="noopener noreferrer">{info.runtimeHelp}</a></p>}<a className="ll-button" href={downloads[platform].href} download={downloads[platform].filename} title={downloads[platform].title}><DownloadIcon/>{d[platform]}</a></div>)}
    </div>
    <noscript><style>{'.ss-download-choice{display:none}'}</style><p className="ss-no-script-download"><a href={downloads.mac.href} download={downloads.mac.filename}>{d.mac}</a> · macOS 13+ · Apple Silicon / Intel</p><p className="ss-no-script-download"><a href={downloads.win.href} download={downloads.win.filename}>{d.win}</a> · {info.windowsSystem} · {info.requirements}<a href="https://developer.microsoft.com/microsoft-edge/webview2/#download">{info.runtimeHelp}</a></p></noscript>
   </section>
  </main>
  <footer className="ll-shell ll-footer ss-footer"><div><a className="ll-brand" href={home}><img src="/brand/current/lingling.png" width="44" height="44" alt=""/><span>LingLing</span></a><p className="ss-copyright">© {new Date().getFullYear()} LingLing.</p></div><nav className="ll-footer-links" aria-label={t.support}><a href={home}>{t.back}</a><a href="mailto:e1347605313@gmail.com">{t.support}</a><a href="https://github.com/LING-0001/SnapSlot" target="_blank" rel="noopener noreferrer">GitHub</a></nav></footer>
  <BackToTop label={t.top} imageSrc="/brand/current/snapslot.png" focusTargetId="snapshot-brand"/>
 </div>
}
