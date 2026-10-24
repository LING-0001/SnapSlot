Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "WinVer.nsh"
!include "x64.nsh"

Name "SnapSlot"
OutFile "${OUTPUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\SnapSlot"
InstallDirRegKey HKCU "Software\SnapSlot" "InstallLocation"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 64
CRCCheck force
ManifestDPIAware true
BrandingText "SnapSlot ${VERSION}"
VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "SnapSlot"
VIAddVersionKey "FileDescription" "SnapSlot Installer"
VIAddVersionKey "FileVersion" "${VERSION}.0"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "SnapSlot contributors"
!define MUI_ICON "${APP_ICON}"
!define MUI_UNICON "${APP_ICON}"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TEXT "$(WelcomeText)"
!define MUI_FINISHPAGE_RUN "$INSTDIR\SnapSlot.exe"
!define MUI_FINISHPAGE_RUN_TEXT "$(LaunchText)"
!define MUI_FINISHPAGE_REBOOTLATER_DEFAULT
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "TradChinese"
!insertmacro MUI_LANGUAGE "Japanese"
!insertmacro MUI_LANGUAGE "Korean"
!insertmacro MUI_LANGUAGE "Spanish"

!macro COPY Language Welcome Launch Running Runtime RuntimeError Unsupported
LangString WelcomeText ${Language} "${Welcome}"
LangString LaunchText ${Language} "${Launch}"
LangString RunningText ${Language} "${Running}"
LangString RuntimeText ${Language} "${Runtime}"
LangString RuntimeErrorText ${Language} "${RuntimeError}"
LangString UnsupportedText ${Language} "${Unsupported}"
!macroend
!insertmacro COPY ${LANG_ENGLISH} "Install SnapSlot for your Windows account.$\r$\n$\r$\nShortcuts will be added to your desktop and Start menu. If a required display component is missing, Setup will download it automatically; please stay connected to the internet.$\r$\n$\r$\nYour existing preferences will be kept." "Open SnapSlot" "Please quit SnapSlot from its tray menu before continuing, then click Retry. Your open notes will be lost when SnapSlot exits." "Preparing the display component. Please stay connected to the internet…" "The required display component could not be installed. Check your connection, then click Retry. Error: $0" "SnapSlot requires Windows 10 or 11 (64-bit)."
!insertmacro COPY ${LANG_SIMPCHINESE} "为当前 Windows 用户安装 SnapSlot。$\r$\n$\r$\n安装后会在桌面和开始菜单创建快捷方式。如果缺少必要的显示组件，安装程序会自动下载，请保持联网。$\r$\n$\r$\n已有的偏好设置会保留。" "打开 SnapSlot" "请先从托盘菜单退出 SnapSlot，再点击“重试”继续。退出会清空当前便签，请先保存需要的内容。" "正在准备显示组件，请保持联网…" "必要的显示组件安装失败。请检查网络后点击“重试”。错误码：$0" "SnapSlot 需要 Windows 10 或 11（64 位）。"
!insertmacro COPY ${LANG_TRADCHINESE} "為目前的 Windows 使用者安裝 SnapSlot。$\r$\n$\r$\n安裝後會在桌面及開始功能表建立捷徑。若缺少必要的顯示元件，安裝程式會自動下載，請保持連線。$\r$\n$\r$\n既有偏好設定會保留。" "開啟 SnapSlot" "請先從系統匣選單結束 SnapSlot，再按「重試」繼續。結束會清空目前便箋，請先儲存需要的內容。" "正在準備顯示元件，請保持連線…" "必要的顯示元件安裝失敗。請檢查網路後按「重試」。錯誤碼：$0" "SnapSlot 需要 Windows 10 或 11（64 位元）。"
!insertmacro COPY ${LANG_JAPANESE} "現在の Windows ユーザーに SnapSlot をインストールします。$\r$\n$\r$\nデスクトップとスタートメニューにショートカットを作成します。必要な表示コンポーネントがない場合は自動でダウンロードします。インターネット接続を維持してください。$\r$\n$\r$\n既存の設定は保持されます。" "SnapSlot を開く" "トレイメニューから SnapSlot を終了してから「再試行」を押してください。終了すると現在のメモは消えるため、必要な内容を先に保存してください。" "表示コンポーネントを準備しています。接続を維持してください…" "必要な表示コンポーネントをインストールできません。接続を確認して再試行してください。エラー: $0" "SnapSlot には Windows 10 または 11（64 ビット）が必要です。"
!insertmacro COPY ${LANG_KOREAN} "현재 Windows 사용자에게 SnapSlot을 설치합니다.$\r$\n$\r$\n바탕 화면과 시작 메뉴에 바로 가기를 만듭니다. 필요한 화면 구성 요소가 없으면 자동으로 다운로드하므로 인터넷 연결을 유지하세요.$\r$\n$\r$\n기존 설정은 유지됩니다." "SnapSlot 열기" "트레이 메뉴에서 SnapSlot을 종료한 뒤 다시 시도를 누르세요. 종료하면 현재 메모가 사라지므로 필요한 내용은 먼저 저장하세요." "화면 구성 요소를 준비하는 중입니다. 인터넷 연결을 유지하세요…" "필요한 화면 구성 요소를 설치할 수 없습니다. 인터넷 연결을 확인하고 다시 시도하세요. 오류: $0" "SnapSlot에는 Windows 10 또는 11(64비트)이 필요합니다."
!insertmacro COPY ${LANG_SPANISH} "Instala SnapSlot para tu cuenta de Windows.$\r$\n$\r$\nSe crearán accesos directos en el escritorio y el menú Inicio. Si falta un componente de visualización, se descargará automáticamente. Mantén la conexión a Internet.$\r$\n$\r$\nSe conservarán tus preferencias." "Abrir SnapSlot" "Cierra SnapSlot desde su menú de la bandeja y pulsa Reintentar. Al cerrar se borrarán las notas abiertas; guarda primero lo que necesites." "Preparando el componente de visualización. Mantén la conexión a Internet…" "No se pudo instalar el componente necesario. Revisa la conexión y pulsa Reintentar. Error: $0" "SnapSlot requiere Windows 10 u 11 (64 bits)."
LangString LocationError ${LANG_ENGLISH} "Please uninstall SnapSlot through Windows Settings > Installed apps."
LangString LocationError ${LANG_SIMPCHINESE} "请从 Windows 设置的“已安装的应用”中卸载 SnapSlot。"
LangString LocationError ${LANG_TRADCHINESE} "請從 Windows 設定的「已安裝的應用程式」解除安裝 SnapSlot。"
LangString LocationError ${LANG_JAPANESE} "Windows の設定の「インストールされているアプリ」から SnapSlot をアンインストールしてください。"
LangString LocationError ${LANG_KOREAN} "Windows 설정의 설치된 앱에서 SnapSlot을 제거하세요."
LangString LocationError ${LANG_SPANISH} "Desinstala SnapSlot desde Configuración de Windows > Aplicaciones instaladas."

!macro CHECK_RUNNING Prefix
Function ${Prefix}CheckRunning
  check:
    System::Call 'kernel32::OpenMutexW(i 0x00100000, i 0, w "Local\SnapSlot") p.r0'
    ${If} $0 != 0
      System::Call 'kernel32::CloseHandle(p r0)'
      MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(RunningText)" /SD IDCANCEL IDRETRY check
      SetErrorLevel 2
      Abort
    ${EndIf}
FunctionEnd
!macroend
!insertmacro CHECK_RUNNING ""
!insertmacro CHECK_RUNNING "un."

Function .onInit
  ${IfNot} ${AtLeastWin10}
  ${OrIfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "$(UnsupportedText)" /SD IDOK
    SetErrorLevel 3
    Quit
  ${EndIf}
  SetShellVarContext current
  SetRegView 64
  Call CheckRunning
FunctionEnd

Function un.onInit
  SetShellVarContext current
  SetRegView 64
  ReadRegStr $0 HKCU "Software\SnapSlot" "InstallLocation"
  ${If} $0 != $INSTDIR
    MessageBox MB_OK|MB_ICONSTOP "$(LocationError)" /SD IDOK
    SetErrorLevel 4
    Abort
  ${EndIf}
  Call un.CheckRunning
FunctionEnd

Function DetectWebView
  StrCpy $1 ""
  SetRegView 32
  ReadRegStr $1 HKLM "Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  ${If} $1 == ""
  ${OrIf} $1 == "0.0.0.0"
    ReadRegStr $1 HKCU "Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  ${EndIf}
  SetRegView 64
  ${If} $1 == ""
  ${OrIf} $1 == "0.0.0.0"
    ReadRegStr $1 HKCU "Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  ${EndIf}
FunctionEnd

Section "SnapSlot"
  Call CheckRunning
  Call DetectWebView
  ${If} $1 == ""
  ${OrIf} $1 == "0.0.0.0"
    InitPluginsDir
    SetOutPath "$PLUGINSDIR"
    File /oname=MicrosoftEdgeWebview2Setup.exe "${WEBVIEW_BOOTSTRAPPER}"
    runtime_retry:
      DetailPrint "$(RuntimeText)"
      StrCpy $0 -1
      ExecWait '"$PLUGINSDIR\MicrosoftEdgeWebview2Setup.exe" /silent /install' $0
      ${If} $0 == 3010
        SetRebootFlag true
      ${EndIf}
      Call DetectWebView
      ${If} $1 == ""
      ${OrIf} $1 == "0.0.0.0"
        MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(RuntimeErrorText)" /SD IDCANCEL IDRETRY runtime_retry
        SetErrorLevel 10
        Abort
      ${EndIf}
  ${EndIf}
  SetOutPath "$INSTDIR"
  File /r "${PAYLOAD_DIR}/*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\SnapSlot.lnk" "$INSTDIR\SnapSlot.exe"
  CreateShortcut "$SMPROGRAMS\SnapSlot.lnk" "$INSTDIR\SnapSlot.exe"
  WriteRegStr HKCU "Software\SnapSlot" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\SnapSlot" "Version" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\App Paths\SnapSlot.exe" "" "$INSTDIR\SnapSlot.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SnapSlot" "DisplayName" "SnapSlot"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SnapSlot" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SnapSlot" "Publisher" "SnapSlot contributors"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SnapSlot" "DisplayIcon" "$INSTDIR\SnapSlot.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SnapSlot" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SnapSlot" "UninstallString" '$\"$INSTDIR\Uninstall.exe$\"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SnapSlot" "QuietUninstallString" '$\"$INSTDIR\Uninstall.exe$\" /S'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SnapSlot" "URLInfoAbout" "http://101.200.239.135/"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SnapSlot" "EstimatedSize" ${INSTALLED_KB}
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SnapSlot" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SnapSlot" "NoRepair" 1
SectionEnd

Section "Uninstall"
  Call un.CheckRunning
  !include "${UNINSTALL_FILES}"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  Delete "$DESKTOP\SnapSlot.lnk"
  Delete "$SMPROGRAMS\SnapSlot.lnk"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\SnapSlot"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\App Paths\SnapSlot.exe"
  DeleteRegKey HKCU "Software\SnapSlot"
SectionEnd
