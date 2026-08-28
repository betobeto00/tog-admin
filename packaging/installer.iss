; installer.iss — Instalador Inno Setup de TOG Admin.
;
; Empaqueta la app Electron (dist-win\TOG Admin\) en un setup.exe
; que instala en Archivos de programa, crea acceso directo y lanza al terminar.
;
; Compilar:
;   1. npm run build:win      (empaqueta Electron en dist-win\)
;   2. iscc packaging\installer.iss   (genera TOG-Admin-Setup.exe)
;
; O ejecutar: build.bat (hace todo)

[Setup]
AppId={{A3F7B2C1-8E4D-4F6A-9B0C-2D5E8F1A3C7B}
AppName=TOG Admin
AppVersion=1.0.0
AppPublisher=Bet00 Nardieu
DefaultDirName={autopf}\TOG Admin
DefaultGroupName=TOG Admin
DisableProgramGroupPage=yes
OutputDir=..\release
OutputBaseFilename=TOG-Admin-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\TOG Admin.exe
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
; SetupIconFile=..\resources\icon.ico  ; Descomentar cuando tengas el .ico

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"
Name: "english"; MessagesFile: "compiler:Languages\Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Crear acceso directo en el escritorio"; GroupDescription: "Accesos directos:"

[Files]
; App Electron empaquetada por electron-builder (directorio dist-win)
Source: "..\dist-win\**"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\TOG Admin"; Filename: "{app}\TOG Admin.exe"
Name: "{userdesktop}\TOG Admin"; Filename: "{app}\TOG Admin.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\TOG Admin.exe"; Description: "Abrir TOG Admin"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Borrar datos residuales de la carpeta de instalación
Type: filesandordirs; Name: "{app}\resources"
; Borrar caché y datos de usuario
Type: filesandordirs; Name: "{localappdata}\TOG Admin"

[Code]
procedure KillTOGAdmin;
var
  Res: Integer;
begin
  Exec('taskkill.exe', '/F /IM "TOG Admin.exe" /T', '', SW_HIDE, ewWaitUntilTerminated, Res);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssInstall then
    KillTOGAdmin;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then
    KillTOGAdmin;
end;
