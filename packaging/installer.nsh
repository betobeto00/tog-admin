; packaging/installer.nsh
; NSIS custom script for TOG Admin
; Auto-detects system language and writes it to $INSTDIR\.lang

!macro customInit
  ; Auto-detect language from Windows system locale
  ; $0 and $1 are temporary registers, no Var declaration needed
  System::Call 'kernel32::GetUserDefaultUILanguage() i .r0'
  ; Spanish LCIDs have primary language ID 0x0A (10)
  IntOp $1 $0 & 0x3FF
  ${If} $1 == 0x0A
    FileOpen $0 "$INSTDIR\.lang" w
    FileWrite $0 "es"
    FileClose $0
  ${Else}
    FileOpen $0 "$INSTDIR\.lang" w
    FileWrite $0 "en"
    FileClose $0
  ${EndIf}
!macroend
