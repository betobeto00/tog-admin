; packaging/installer.nsh
; NSIS custom script for TOG Admin
; Shows a language selection dialog before installation begins.
; Writes the chosen language to $INSTDIR\.lang for first-launch detection.

!macro customHeader
  Var /GLOBAL TOG_LANG
  StrCpy $TOG_LANG "en"

  ${IfNot} ${Silent}
    Page custom togLanguagePageCreate togLanguagePageLeave
  ${EndIf}
!macroend

!macro customInstall
  FileOpen $0 "$INSTDIR\.lang" w
  FileWrite $0 "$TOG_LANG"
  FileClose $0
!macroend

Function togLanguagePageCreate
  nsDialogs::Create 1018
  Pop $1

  ${If} $1 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 18u "Language / Idioma"
  Pop $0
  CreateFont $0 "Segoe UI" "12" "700"
  SendMessage $0 ${WM_SETFONT} $0 0

  ${NSD_CreateLabel} 0 22u 100% 14u "Choose the installation language / Elija el idioma de instalación:"
  Pop $0

  ${NSD_CreateRadioButton} 20u 50u 100% 14u "1. English"
  Pop $R0

  ${NSD_CreateRadioButton} 20u 72u 100% 14u "2. Español"
  Pop $R1

  ${If} $TOG_LANG == "es"
    SendMessage $R1 ${BM_SETCHECK} ${BST_CHECKED} 0
  ${Else}
    SendMessage $R0 ${BM_SETCHECK} ${BST_CHECKED} 0
  ${EndIf}

  nsDialogs::Show
FunctionEnd

Function togLanguagePageLeave
  ${NSD_GetState} $R0 $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $TOG_LANG "en"
  ${Else}
    StrCpy $TOG_LANG "es"
  ${EndIf}
FunctionEnd
