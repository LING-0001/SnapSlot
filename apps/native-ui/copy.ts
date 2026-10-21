import type { Locale } from "../website/lib/messages";
const values = {
  importImages: ["Add images", "添加图片", "新增圖片", "画像を追加", "이미지 추가", "Añadir imágenes"],
  paste: ["Paste once", "粘贴一次", "貼上一次", "一度だけ貼り付け", "한 번 붙여넣기", "Pegar una vez"],
  folder: ["Open skin folder", "打开皮肤文件夹", "開啟外觀資料夾", "スキンフォルダを開く", "스킨 폴더 열기", "Abrir carpeta de temas"],
  save: ["Pin text", "贴上文字", "貼上文字", "テキストを留める", "텍스트 붙이기", "Fijar texto"],
  cancel: ["Cancel", "取消", "取消", "キャンセル", "취소", "Cancelar"],
  tooLarge: ["Text limit: 64 KB.", "文字最多 64 KB。", "文字最多 64 KB。", "テキスト上限: 64 KB。", "텍스트 한도: 64 KB.", "Límite de texto: 64 KB."],
  skinError: ["Skin unchanged: ", "外观保持不变：", "外觀保持不變：", "スキンは変更されません：", "스킨 유지: ", "Tema sin cambios: "],
  skinHint: ["Edit active.json in this folder to apply changes live.", "编辑文件夹中的 active.json，保存后自动应用。", "編輯資料夾中的 active.json，儲存後自動套用。", "active.json を保存すると自動で反映されます。", "active.json을 저장하면 자동 적용됩니다.", "Edita active.json: se aplica al guardar."],
  autoHide: ["Hides when you leave", "移开后收起", "移開後收起", "離れると閉じる", "떠나면 접기", "Se oculta al alejarte"],
  pinned: ["Kept open", "已固定显示", "已固定顯示", "固定表示中", "열어 둠", "Se mantiene abierto"],
  pin: ["Pin notes", "固定便签", "固定便箋", "メモを固定", "메모 고정", "Fijar notas"],
  unpin: ["Unpin notes", "取消固定", "取消固定", "固定を解除", "고정 해제", "Dejar de fijar"],
} as const;
const locales = ["en", "zh-Hans", "zh-Hant", "ja", "ko", "es"];
export function nativeCopy(locale: Locale) {
  const index = Math.max(0, locales.indexOf(locale));
  return Object.fromEntries(Object.entries(values).map(([key, translations]) => [key, translations[index]])) as Record<keyof typeof values, string>;
}
