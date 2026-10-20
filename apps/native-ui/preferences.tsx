import React, { useEffect, useState } from "react";
import type { Locale } from "../website/lib/messages";
import type { AppPreferences, Shortcut } from "./protocol";

const translations = {
  en: ["Settings", "Capture", "Receive screenshots from other apps", "Automatically pin new screenshots and clipboard images. Original files stay where they are.", "Shortcuts", "Take a screenshot", "Pin selected text", "Select part or all of your text, then press this shortcut.", "Click to record", "Press a combination…", "Use Control, Alt/Option or Command/Win with a letter, number, Space or F1–F11.", "Choose different shortcuts. Control+Alt/Option+Space opens notes.", "Restore defaults", "Save changes", "Saved", "Done", "Loading settings…", "On Mac, selected-text capture needs Accessibility permission on first use."],
  "zh-Hans": ["设置", "截图收取", "接收其他软件的截图", "新截图和剪贴板图片会自动贴上，原文件保留在原处。", "快捷键", "截一张图", "收取选中文字", "先全选或选中需要的文字，再按快捷键贴成便签。", "点击录制", "请按下快捷键…", "请使用 Control、Option/Alt 或 Command/Win，搭配字母、数字、空格或 F1–F11。", "两个快捷键不能相同，也不能使用展开便签的 Control + Option/Alt + Space。", "恢复默认", "保存更改", "已保存", "完成", "正在读取设置…", "Mac 首次收取选中文字时，需要允许“辅助功能”权限。"],
  "zh-Hant": ["設定", "截圖收取", "接收其他軟體的截圖", "新截圖和剪貼簿圖片會自動貼上，原始檔保留在原處。", "快速鍵", "截一張圖", "收取選取文字", "先全選或選取需要的文字，再按快速鍵貼成便箋。", "點擊錄製", "請按下快速鍵…", "請使用 Control、Option/Alt 或 Command/Win，搭配字母、數字、空白或 F1–F11。", "快速鍵不能相同，也不能使用展開便箋的 Control + Option/Alt + Space。", "恢復預設", "儲存變更", "已儲存", "完成", "正在讀取設定…", "Mac 首次收取選取文字時，需要允許「輔助使用」權限。"],
  ja: ["設定", "スクリーンショット", "ほかのアプリの画像を受け取る", "新しいスクリーンショットとクリップボード画像を自動で留めます。元のファイルは残ります。", "ショートカット", "スクリーンショット", "選択したテキストを留める", "必要なテキストを選択してからショートカットを押します。", "クリックして記録", "キーを押してください…", "Control、Alt/Option、Command/Win と文字、数字、Space、F1–F11 を使用してください。", "異なるキーを指定してください。Control+Alt/Option+Space はメモ表示用です。", "初期設定に戻す", "変更を保存", "保存しました", "完了", "設定を読み込み中…", "Mac では初回にアクセシビリティの許可が必要です。"],
  ko: ["설정", "스크린샷 수집", "다른 앱의 스크린샷 받기", "새 스크린샷과 클립보드 이미지를 자동으로 붙입니다. 원본 파일은 유지됩니다.", "단축키", "스크린샷 찍기", "선택한 텍스트 붙이기", "필요한 텍스트를 선택한 다음 단축키를 누르세요.", "클릭하여 기록", "키 조합을 누르세요…", "Control, Alt/Option, Command/Win과 문자, 숫자, Space 또는 F1–F11을 사용하세요.", "서로 다른 단축키를 사용하세요. Control+Alt/Option+Space는 메모 열기용입니다.", "기본값 복원", "변경 저장", "저장됨", "완료", "설정 불러오는 중…", "Mac에서는 처음 사용 시 손쉬운 사용 권한이 필요합니다."],
  es: ["Ajustes", "Capturas", "Recibir capturas de otras aplicaciones", "Fija automáticamente capturas e imágenes nuevas del portapapeles. Conserva los originales.", "Atajos", "Hacer captura", "Fijar texto seleccionado", "Selecciona parte o todo el texto y pulsa el atajo.", "Haz clic para grabar", "Pulsa una combinación…", "Usa Control, Alt/Option o Command/Win con una letra, número, Space o F1–F11.", "Usa atajos distintos. Control+Alt/Option+Space abre las notas.", "Restablecer", "Guardar cambios", "Guardado", "Listo", "Cargando ajustes…", "En Mac, la primera captura de texto requiere permiso de Accesibilidad."],
} satisfies Record<Locale, string[]>;
const shortcut = (key: string): Shortcut => ({ key, control:true, alt:true, shift:false, meta:false });
export const defaultPreferences: AppPreferences = { collectScreenshots:true, captureShortcut:shortcut("KeyS"), textShortcut:shortcut("KeyT") };
const shortcutKey=(value:Shortcut)=>[value.key,value.control,value.alt,value.shift,value.meta].join("|");
export function shortcutLabel(value: Shortcut, mac: boolean) {
  const key=value.key==="Space"?"Space":value.key.replace(/^Key|^Digit/,"");
  return [value.control?(mac?"⌃":"Ctrl"):"",value.alt?(mac?"⌥":"Alt"):"",value.shift?(mac?"⇧":"Shift"):"",value.meta?(mac?"⌘":"Win"):"",key].filter(Boolean).join(mac?"":" + ");
}
export function PreferencesPanel({ value, platform, locale, revision, notice, onSave, onClose }: { value: AppPreferences | null; platform: "macos" | "windows"; locale: Locale; revision: number; notice: string; onSave: (value: AppPreferences) => void; onClose: () => void }) {
  const [draft,setDraft]=useState(value || defaultPreferences),[recording,setRecording]=useState<"captureShortcut"|"textShortcut"|null>(null),[error,setError]=useState(""),[saving,setSaving]=useState(false),[saved,setSaved]=useState(false);
  const t=translations[locale],mac=platform==="macos";
  useEffect(()=>{if(value)setDraft(value);setRecording(null);setSaving(false);},[value]);
  useEffect(()=>{setSaving(false);},[revision]);
  const dirty=!!value&&(draft.collectScreenshots!==value.collectScreenshots||shortcutKey(draft.captureShortcut)!==shortcutKey(value.captureShortcut)||shortcutKey(draft.textShortcut)!==shortcutKey(value.textShortcut));
  function update(next:AppPreferences){setDraft(next);setError("");setSaved(false);}
  function record(event:React.KeyboardEvent<HTMLButtonElement>,field:"captureShortcut"|"textShortcut") {
    if(recording!==field)return;
    event.preventDefault();event.stopPropagation();
    if(event.key==="Escape"){setRecording(null);return;}
    if(["Control","Alt","Shift","Meta"].includes(event.key))return;
    if(!/^(Key[A-Z]|Digit[0-9]|F([1-9]|10|11)|Space)$/.test(event.code)||!(event.ctrlKey||event.altKey||event.metaKey)){setError(t[10]);return;}
    const next={...draft,[field]:{key:event.code,control:event.ctrlKey,alt:event.altKey,shift:event.shiftKey,meta:event.metaKey}};
    update(next);setRecording(null);
  }
  function save(){
    if(shortcutKey(draft.captureShortcut)===shortcutKey(draft.textShortcut)||[draft.captureShortcut,draft.textShortcut].some(key=>key.key==="Space"&&key.control&&key.alt&&!key.shift&&!key.meta)){setError(t[11]);return;}
    if([draft.captureShortcut,draft.textShortcut].some(key=>key.key==="KeyC"&&!key.alt&&!key.shift&&key.control!==key.meta)){setError(locale.startsWith("zh")?"请保留 Command + C / Ctrl + C 用于普通复制，选择其他快捷键。":"Keep Command+C / Ctrl+C available for Copy. Choose another shortcut.");return;}
    setSaving(true);setSaved(true);onSave(draft);
  }
  if(!value)return <main className="native-preferences"><p role="status">{t[16]}</p></main>;
  return <main className="native-preferences" onKeyDown={event=>{if(event.key==="Escape"&&!recording)onClose();}}>
    <header><span className="preferences-brand">SnapSlot</span><h1>{t[0]}</h1></header>
    <section aria-labelledby="intake-title"><h2 id="intake-title">{t[1]}</h2>
      <label className="preferences-toggle-row"><span><strong>{t[2]}</strong><small>{t[3]}</small></span><input type="checkbox" role="switch" checked={draft.collectScreenshots} onChange={event=>update({...draft,collectScreenshots:event.target.checked})}/></label>
    </section>
    <section aria-labelledby="shortcut-title"><h2 id="shortcut-title">{t[4]}</h2>
      {(["captureShortcut","textShortcut"] as const).map((field,index)=><div className="preferences-shortcut-row" key={field}>
        <label id={`${field}-label`}>{t[index===0?5:6]}</label><button className={`shortcut-recorder ${recording===field?"recording":""}`} aria-labelledby={`${field}-label`} aria-pressed={recording===field} title={t[8]} onClick={()=>{setRecording(field);setError("");}} onBlur={()=>setRecording(null)} onKeyDown={event=>record(event,field)}>{recording===field?t[9]:<kbd>{shortcutLabel(draft[field],mac)}</kbd>}</button>
      </div>)}
      <p className="preferences-hint">{t[7]}{mac&&<><br/>{t[17]}</>}</p>
    </section>
    <div className="preferences-feedback" role={error||notice?"alert":"status"}>{error||notice||(!dirty&&saved?t[14]:"\u00a0")}</div>
    <footer><button className="preferences-reset" onClick={()=>update(defaultPreferences)}>{t[12]}</button><button className="preferences-save" disabled={!dirty||saving||recording!==null} onClick={save}>{t[13]}</button><button className="preferences-done" onClick={onClose}>{t[15]}</button></footer>
  </main>;
}
