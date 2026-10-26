import type { Locale } from "../website/lib/locales";

type Copy = { change: string; record: string; hint: string; invalid: string; copyReserved: string; conflict: string; minimize: string };
export const shortcutCopy: Record<Locale, Copy> = {
  "zh-Hans": { change: "更改快捷键", record: "按下新组合键", hint: "按下组合键设置，Esc 取消", invalid: "请使用 Control、Option 或 Command 搭配字母、数字、空格或 F1–F11", copyReserved: "请保留常用的复制快捷键，换一个组合", conflict: "{old} 被占用，已修改为 {new}。可点击右侧重新设置。", minimize: "最小化设置" },
  "zh-Hant": { change: "更改快速鍵", record: "按下新組合鍵", hint: "按下組合鍵設定，Esc 取消", invalid: "請使用 Control、Option 或 Command 搭配字母、數字、空白鍵或 F1–F11", copyReserved: "請保留常用的複製快速鍵，改用其他組合", conflict: "{old} 已被佔用，已改為 {new}。可按右側重新設定。", minimize: "最小化設定" },
  en: { change: "Change shortcut", record: "Press a shortcut", hint: "Press a key combination; Esc cancels", invalid: "Use Control, Option or Command with a letter, number, Space or F1–F11", copyReserved: "Keep the standard Copy shortcut available; choose another combination", conflict: "{old} was in use. Changed to {new}. Click the keys to change it again.", minimize: "Minimize settings" },
  ja: { change: "ショートカットを変更", record: "新しいキーを押す", hint: "キーの組み合わせを押す。Esc でキャンセル", invalid: "Control、Option または Command と文字、数字、Space、F1–F11 を組み合わせてください", copyReserved: "通常のコピー操作を使えるよう、別の組み合わせを選んでください", conflict: "{old} は使用中のため、{new} に変更しました。右側のキーから再設定できます。", minimize: "設定を最小化" },
  ko: { change: "단축키 변경", record: "새 조합 누르기", hint: "키 조합을 누르세요. Esc로 취소", invalid: "Control, Option 또는 Command와 문자, 숫자, Space, F1–F11을 조합하세요", copyReserved: "기본 복사 단축키는 유지하고 다른 조합을 선택하세요", conflict: "{old}이(가) 사용 중이어서 {new}(으)로 변경했어요. 오른쪽 키를 눌러 다시 설정하세요.", minimize: "설정 최소화" },
  es: { change: "Cambiar atajo", record: "Pulsa una combinación", hint: "Pulsa una combinación; Esc cancela", invalid: "Usa Control, Option o Command con una letra, número, Espacio o F1–F11", copyReserved: "Conserva el atajo habitual de copiar y elige otra combinación", conflict: "{old} estaba en uso. Se cambió a {new}. Pulsa las teclas para volver a cambiarlo.", minimize: "Minimizar ajustes" },
};
