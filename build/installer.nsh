; Custom uninstaller - clean up saved domain configuration
!macro customUnInstall
  ; Clean up saved domain configuration from userData directory
  ; The config file is stored in: %APPDATA%\SpitikoExe\app-config.json
  ; We'll try to delete it, but it may require user permissions
  
  ; Get AppData path
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders" "AppData"
  
  ; Delete the config file if it exists
  Delete "$0\SpitikoExe\app-config.json"
  
  ; Try to remove the app directory if empty (optional)
  ; RMDir "$0\SpitikoExe"
!macroend
