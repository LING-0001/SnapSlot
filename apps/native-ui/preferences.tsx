import React, { useEffect, useState } from "react";
import type { Locale } from "../website/lib/messages";
import type { Skin } from "../website/lib/skin";
import type { AppPreferences, Shortcut } from "./protocol";

const translations = {
  en: ["Settings", "Capture", "Receive screenshots from other apps", "Automatically pin new screenshots and clipboard images. Original files stay where they are.", "Shortcuts", "Take a screenshot", "Pin selected text", "Select part or all of your text, then press this shortcut.", "Click to record", "Press a combination…", "Use Control, Alt/Option or Command/Win with a letter, number, Space or F1–F11.", "Choose different shortcuts. Control+Alt/Option+Space opens notes.", "Restore defaults", "Save changes", "Saved", "Done", "Loading settings…", "On Mac, selected-text capture needs Accessibility permission on first use."],
  "zh-Hans": ["设置", "截图与剪贴板", "自动收取剪贴板图片", "开启后，复制图片或截图会自动加入便签栏；不会读取普通文字。", "快捷键", "截取屏幕", "收取选中文字", "先全选或选中需要的文字，再按快捷键贴成便签。", "点击录制", "请按下快捷键…", "请使用 Control、Option/Alt 或 Command/Win，搭配字母、数字、空格或 F1–F11。", "冲突时会自动换成可用快捷键；Control + Option/Alt + Space 用于展开便签。", "恢复默认", "保存更改", "已保存", "完成", "正在读取设置…", "Mac 首次收取选中文字时，需要允许“辅助功能”权限。"],
  "zh-Hant": ["設定", "截圖收取", "接收其他軟體的截圖", "新截圖和剪貼簿圖片會自動貼上，原始檔保留在原處。", "快速鍵", "截一張圖", "收取選取文字", "先全選或選取需要的文字，再按快速鍵貼成便箋。", "點擊錄製", "請按下快速鍵…", "請使用 Control、Option/Alt 或 Command/Win，搭配字母、數字、空白或 F1–F11。", "快速鍵不能相同，也不能使用展開便箋的 Control + Option/Alt + Space。", "恢復預設", "儲存變更", "已儲存", "完成", "正在讀取設定…", "Mac 首次收取選取文字時，需要允許「輔助使用」權限。"],
  ja: ["設定", "スクリーンショット", "ほかのアプリの画像を受け取る", "新しいスクリーンショットとクリップボード画像を自動で留めます。元のファイルは残ります。", "ショートカット", "スクリーンショット", "選択したテキストを留める", "必要なテキストを選択してからショートカットを押します。", "クリックして記録", "キーを押してください…", "Control、Alt/Option、Command/Win と文字、数字、Space、F1–F11 を使用してください。", "異なるキーを指定してください。Control+Alt/Option+Space はメモ表示用です。", "初期設定に戻す", "変更を保存", "保存しました", "完了", "設定を読み込み中…", "Mac では初回にアクセシビリティの許可が必要です。"],
  ko: ["설정", "스크린샷 수집", "다른 앱의 스크린샷 받기", "새 스크린샷과 클립보드 이미지를 자동으로 붙입니다. 원본 파일은 유지됩니다.", "단축키", "스크린샷 찍기", "선택한 텍스트 붙이기", "필요한 텍스트를 선택한 다음 단축키를 누르세요.", "클릭하여 기록", "키 조합을 누르세요…", "Control, Alt/Option, Command/Win과 문자, 숫자, Space 또는 F1–F11을 사용하세요.", "서로 다른 단축키를 사용하세요. Control+Alt/Option+Space는 메모 열기용입니다.", "기본값 복원", "변경 저장", "저장됨", "완료", "설정 불러오는 중…", "Mac에서는 처음 사용 시 손쉬운 사용 권한이 필요합니다."],
  es: ["Ajustes", "Capturas", "Recibir capturas de otras aplicaciones", "Fija automáticamente capturas e imágenes nuevas del portapapeles. Conserva los originales.", "Atajos", "Hacer captura", "Fijar texto seleccionado", "Selecciona parte o todo el texto y pulsa el atajo.", "Haz clic para grabar", "Pulsa una combinación…", "Usa Control, Alt/Option o Command/Win con una letra, número, Space o F1–F11.", "Usa atajos distintos. Control+Alt/Option+Space abre las notas.", "Restablecer", "Guardar cambios", "Guardado", "Listo", "Cargando ajustes…", "En Mac, la primera captura de texto requiere permiso de Accesibilidad."],
} satisfies Record<Locale, string[]>;
const extras:Record<Locale,{appearance:string;appearanceHint:string;behavior:string;pinned:string;pinnedHint:string;collection:string;shortcuts:string;rail:string;railHint:string;conflict:string;copy:string}> = {
  en:{appearance:"Appearance",appearanceHint:"Expand to edit note color and corner radius.",behavior:"Note rail",pinned:"Keep notes open",pinnedHint:"When pinned, the rail stays open after the pointer leaves.",collection:"Clipboard",shortcuts:"Capture & shortcuts",rail:"Show note rail",railHint:"Show or hide the note rail.",conflict:"Conflicts with another shortcut.",copy:"Keep Command+C / Ctrl+C for Copy."},
  "zh-Hans":{appearance:"外观",appearanceHint:"展开后直接调整便签颜色与圆角。",behavior:"便签栏",pinned:"固定便签栏",pinnedHint:"固定后，鼠标移开不会收起。",collection:"剪贴板",shortcuts:"截图与快捷键",rail:"展开便签栏",railHint:"显示或收起便签栏。",conflict:"与另一个快捷键冲突。",copy:"请保留 Command + C / Ctrl + C 用于复制。"},
  "zh-Hant":{appearance:"外觀",appearanceHint:"展開後可直接調整便箋顏色與圓角。",behavior:"便箋列",pinned:"固定便箋列",pinnedHint:"固定後，游標移開不會收起。",collection:"剪貼簿",shortcuts:"截圖與快速鍵",rail:"展開便箋列",railHint:"顯示或收起便箋列。",conflict:"與另一個快速鍵衝突。",copy:"請保留 Command + C / Ctrl + C 用於複製。"},
  ja:{appearance:"外観",appearanceHint:"展開してメモの色と角丸を調整します。",behavior:"メモバー",pinned:"メモを固定",pinnedHint:"固定するとポインターを離しても閉じません。",collection:"クリップボード",shortcuts:"スクリーンショットとショートカット",rail:"メモバーを開く",railHint:"メモバーを表示または閉じます。",conflict:"別のショートカットと重複しています。",copy:"Command+C / Ctrl+C はコピー用に残してください。"},
  ko:{appearance:"모양",appearanceHint:"펼쳐서 메모 색상과 모서리를 조정합니다.",behavior:"메모 바",pinned:"메모 고정",pinnedHint:"고정하면 포인터를 옮겨도 닫히지 않습니다.",collection:"클립보드",shortcuts:"스크린샷 및 단축키",rail:"메모 바 열기",railHint:"메모 바를 표시하거나 닫습니다.",conflict:"다른 단축키와 충돌합니다.",copy:"Command+C / Ctrl+C는 복사용으로 남겨 두세요."},
  es:{appearance:"Apariencia",appearanceHint:"Despliega para ajustar el color y radio de las notas.",behavior:"Barra de notas",pinned:"Mantener notas abiertas",pinnedHint:"Al fijarla, la barra no se cierra al salir con el puntero.",collection:"Portapapeles",shortcuts:"Captura y atajos",rail:"Abrir barra de notas",railHint:"Muestra u oculta la barra de notas.",conflict:"Entra en conflicto con otro atajo.",copy:"Mantén Command+C / Ctrl+C para copiar."},
};
const shortcut = (key: string): Shortcut => ({ key, control:true, alt:true, shift:false, meta:false });
export const defaultPreferences: AppPreferences = { collectScreenshots:true, captureShortcut:{key:"KeyS",control:true,alt:false,shift:true,meta:false}, textShortcut:shortcut("KeyT") };
const shortcutKey=(value:Shortcut)=>[value.key,value.control,value.alt,value.shift,value.meta].join("|");
export function shortcutLabel(value: Shortcut, mac: boolean) {
  const key=value.key==="Space"?"Space":value.key.replace(/^Key|^Digit/,"");
  return [value.control?(mac?"⌃":"Ctrl"):"",value.alt?(mac?"⌥":"Alt"):"",value.shift?(mac?"⇧":"Shift"):"",value.meta?(mac?"⌘":"Win"):"",key].filter(Boolean).join(mac?"":" + ");
}
export function PreferencesPanel({ value, platform, locale, revision, notice, pinned, skin, shortcutError, onSave, onPinnedChange, onSkinChange, onClose }: { value: AppPreferences | null; platform: "macos" | "windows"; locale: Locale; revision: number; notice: string; pinned:boolean; skin:Skin; shortcutError: {field:"captureShortcut"|"textShortcut";message:string}|null; onSave: (value: AppPreferences) => void; onPinnedChange: (value:boolean) => void; onSkinChange: (value:Skin) => void; onClose: () => void }) {
  type Field="captureShortcut"|"textShortcut";
  const [draft,setDraft]=useState(value || defaultPreferences),[recording,setRecording]=useState<Field|null>(null),[errors,setErrors]=useState<Partial<Record<Field,string>>>({}),[adjusted,setAdjusted]=useState<Partial<Record<Field,string>>>({}),[appearanceOpen,setAppearanceOpen]=useState(false);
  const t=translations[locale],x=extras[locale],mac=platform==="macos";
  useEffect(()=>{if(value)setDraft(value);setRecording(null);},[value]);
  useEffect(()=>{void revision;},[revision]);
  useEffect(()=>{if(shortcutError)setErrors({[shortcutError.field]:shortcutError.message});},[shortcutError]);
  function update(next:AppPreferences,change:Partial<Record<Field,string>>={}){setDraft(next);setErrors({});setAdjusted(change);onSave(next);}
  function record(event:React.KeyboardEvent<HTMLButtonElement>,field:Field) {
    if(recording!==field)return;
    event.preventDefault();event.stopPropagation();
    if(event.key==="Escape"){setRecording(null);return;}
    if(["Control","Alt","Shift","Meta"].includes(event.key))return;
    if(!/^(Key[A-Z]|Digit[0-9]|F([1-9]|10|11)|Space)$/.test(event.code)||!(event.ctrlKey||event.altKey||event.metaKey)){setErrors({[field]:t[10]});return;}
    let next={...draft,[field]:{key:event.code,control:event.ctrlKey,alt:event.altKey,shift:event.shiftKey,meta:event.metaKey}};
    const value=next[field],other=next[field==="captureShortcut"?"textShortcut":"captureShortcut"],reserved=value.key==="Space"&&value.control&&value.alt&&!value.shift&&!value.meta;
    if(shortcutKey(value)===shortcutKey(other)||reserved){const replacement=value.shift?{...value,key:field==="captureShortcut"?"KeyS":"KeyT"}:{...value,shift:true};next={...next,[field]:replacement};update(next,{[field]:`${x.conflict} 已自动改为 ${shortcutLabel(replacement,mac)}。`});}else update(next);
    setRecording(null);
  }
  function validation(next:AppPreferences):Partial<Record<Field,string>> {
    if(shortcutKey(next.captureShortcut)===shortcutKey(next.textShortcut)||[next.captureShortcut,next.textShortcut].some(key=>key.key==="Space"&&key.control&&key.alt&&!key.shift&&!key.meta))return {captureShortcut:x.conflict,textShortcut:x.conflict};
    const found:Partial<Record<Field,string>>={};(["captureShortcut","textShortcut"] as const).forEach(field=>{const key=next[field];if(key.key==="KeyC"&&!key.alt&&!key.shift&&key.control!==key.meta)found[field]=x.copy;});return found;
  }
  if(!value)return <main className="native-preferences"><p role="status">{t[16]}</p></main>;
  return <main className="native-preferences" onKeyDown={event=>{if(event.key==="Escape"&&!recording)onClose();}}>
    <header className="preferences-shell-header"><h1>{t[0]}</h1><button type="button" aria-label={t[15]} onClick={onClose}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header>
    <div className="preferences-body">
    <section aria-labelledby="behavior-title"><h2 id="behavior-title">{x.behavior}</h2><div className="preferences-card">
      <label className="preferences-toggle-row"><span><strong>{x.pinned}</strong><small>{x.pinnedHint}</small></span><input aria-label={x.pinned} type="checkbox" role="switch" checked={pinned} onChange={event=>onPinnedChange(event.target.checked)}/></label>
    </div></section>
    <section aria-labelledby="shortcut-title"><h2 id="shortcut-title">{x.shortcuts}</h2>
      {(["captureShortcut","textShortcut"] as const).map((field,index)=><div className="preferences-shortcut-row" key={field}>
        <span><strong id={`${field}-label`}>{t[index===0?5:6]}</strong><small>{index===0?(locale==="zh-Hans"?"截取后会作为新便签加入。":"Add the capture as a new note."):t[7]}</small></span><button className={`shortcut-recorder ${recording===field?"recording":""}`} aria-labelledby={`${field}-label`} aria-pressed={recording===field} title={t[8]} onClick={()=>{setRecording(field);setErrors({});setAdjusted({});}} onBlur={()=>setRecording(null)} onKeyDown={event=>record(event,field)}>{recording===field?t[9]:<kbd>{shortcutLabel(draft[field],mac)}</kbd>}</button>{(errors[field]||adjusted[field])&&<p className={`shortcut-error ${adjusted[field]?"shortcut-adjusted":""}`} role={errors[field]?"alert":undefined}>{errors[field]||adjusted[field]}</p>}
      </div>)}
      <div className="preferences-shortcut-row preferences-static-key"><span><strong>{x.rail}</strong><small>{x.railHint}</small></span><kbd>{shortcutLabel({key:"Space",control:true,alt:true,shift:false,meta:false},mac)}</kbd></div>
    </section>
    <section aria-labelledby="intake-title"><h2 id="intake-title">{x.collection}</h2><div className="preferences-card"><label className="preferences-toggle-row"><span><strong>{t[2]}</strong><small>{t[3]}</small></span><input type="checkbox" role="switch" checked={draft.collectScreenshots} onChange={event=>update({...draft,collectScreenshots:event.target.checked})}/></label></div></section>
    <section aria-labelledby="appearance-title"><h2 id="appearance-title">{x.appearance}</h2><div className="preferences-card"><button className="preferences-action-row" aria-label={x.appearance} aria-expanded={appearanceOpen} onClick={()=>setAppearanceOpen(open=>!open)}><span><strong>{x.appearance}</strong><small>{x.appearanceHint}</small></span><b aria-hidden="true">⌄</b></button>{appearanceOpen&&<div className="preferences-appearance-editor"><div className="appearance-mini-preview" style={{background:skin.card.textBackground,borderRadius:skin.card.radius}}><i/><strong>{locale==="zh-Hans"?"灵感便签":"Preview note"}</strong><small>{locale==="zh-Hans"?"实时预览":"Live preview"}</small></div><div className="appearance-editor-controls"><span>{locale==="zh-Hans"?"便签底色":"Note color"}</span><div role="group" className="appearance-swatches">{["#FFFCEB","#EBF3FF","#EEF5EF","#FBEFF0","#FFFFFF"].map(color=><button key={color} type="button" aria-label={color} aria-pressed={skin.card.textBackground.toUpperCase()===color} style={{background:color}} onClick={()=>onSkinChange({...skin,card:{...skin.card,textBackground:color}})}/>)}</div><label className="appearance-radius"><span>{locale==="zh-Hans"?"圆角":"Radius"}</span><input type="range" min="0" max="48" value={skin.card.radius} onChange={event=>onSkinChange({...skin,card:{...skin.card,radius:Number(event.target.value)}})}/><output>{skin.card.radius} px</output></label></div></div>}</div></section>
    {(notice||mac)&&<p className="preferences-feedback" role={notice?"alert":undefined}>{notice}{mac&&<><br/>{t[17]}</>}</p>}
    </div>
  </main>;
}
