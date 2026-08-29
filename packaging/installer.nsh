; packaging/installer.nsh
; NSIS custom script for TOG Admin
; Shows a language selection dialog before installation begins.
; Writes the chosen language to $INSTDIR\.lang for first-launch detection.
;
; electron-builder macros available:
;   - customHeader:  add Pages
;   - customInit:    extend .onInit
;   - customInstall: extend .onInstSuccess (after install completes)

!include nsDialogs.nsh
!include LogicLib.nsh

; File-scope variable
Var TOG_LANG

!macro customHeader
  Page custom togLanguagePageCreate togLanguagePageLeave
!macroend

!macro customInit
  StrCpy $TOG_LANG "en"
!macroend

!macro customInstall
  FileOpen $0 "$INSTDIR\.lang" w
  FileWrite $0 "$TOG_LANG"
  FileClose $0
!macroend

Function togLanguagePageCreate
  nsDialogs::Create 1018
  Pop $1
  StrCmp $1 "error" 0 +2
  Abort

  ${NSD_CreateLabel} 0 0 100% 18u "Language / Idioma"
  Pop $0
  CreateFont $0 "Segoe UI" "12" "700"
  SendMessage $0 ${WM_SETFONT} $0 0

  ${NSD_CreateLabel} 0 22u 100% 14u "Choose the installation language / Elija el idioma de instalacion:"
  Pop $0

  ${NSD_CreateRadioButton} 20u 50u 100% 14u "1. English"
  Pop $R0

  ${NSD_CreateRadioButton} 20u 72u 100% 14u "2. Espanol"
  Pop $R1

  StrCmp $TOG_LANG "es" 0 +3
  SendMessage $R1 ${BM_SETCHECK} ${BST_CHECKED} 0
  Goto +2
  SendMessage $R0 ${BM_SETCHECK} ${BST_CHECKED} 0

  nsDialogs::Show
FunctionEnd

Function togLanguagePageLeave
  ${NSD_GetState} $R0 $0
  StrCmp $0 ${BST_CHECKED} 0 +3
  StrCpy $TOG_LANG "en"
  Goto +2
  StrCpy $TOG_LANG "es"
FunctionEnd
