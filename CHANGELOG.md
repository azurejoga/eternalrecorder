Lançou a nova versão do eternal recorder! o gravador de tela da eternal legend!

VERSÃO 1.8 (atual)
====

CORREÇÕES DE ERROS
---

Cenas travavam ao salvar e não persistiam entre abas
  Causa: os handlers IPC get-scenes e save-scenes nunca foram adicionados ao
  processo principal (electron/main.js) nem expostos pelo script de preload
  (electron/preload.cjs). Quando o usuário salvava uma cena, a chamada
  window.electronAPI.saveScenes() era ignorada silenciosamente pois o método
  não existia, armazenando as cenas apenas na memória do React. Ao trocar de
  aba, o componente era desmontado e as cenas se perdiam.

  Correção: adicionados os handlers ipcMain.handle('get-scenes') e
  ipcMain.handle('save-scenes') no processo principal, que leem e escrevem
  o arquivo scenes.json na pasta de configuração do app. Os métodos getScenes
  e saveScenes foram adicionados ao preload.cjs para expô-los ao renderer.

  Além disso, a função persistScenes no ScenesTab foi refatorada para ser
  síncrona do ponto de vista da UI: o estado React é atualizado imediatamente
  e a escrita em disco ocorre em segundo plano, eliminando o travamento visual
  ao adicionar, renomear ou excluir cenas.

REMOÇÃO DE RECURSO
---

Atualização automática removida
  O sistema de atualização automática foi completamente removido a pedido.
  Removidos: função checkForUpdates, fetchJSON, downloadFile, compareVersions,
  constantes GitHub, chamada de inicialização no startup, handlers IPC
  confirm-update / cancel-update, listeners onUpdateAvailable / onUpdateStatus
  no preload e no frontend, e o diálogo de atualização em App.jsx.
  A versão do app continua sendo exibida na aba Configurações.

---

The new version of the Eternal Recorder has been released!

VERSION 1.8 (current)
====

BUG FIXES
---

Scenes froze on save and did not persist between tabs
  Cause: The get-scenes and save-scenes IPC handlers were never added to the
  main process (electron/main.js) or exposed by the preload script
  (electron/preload.cjs). When the user saved a scene, the call to
  window.electronAPI.saveScenes() was silently skipped because the method
  did not exist, storing scenes only in React memory. When switching tabs,
  the component was unmounted and scenes were lost.

  Fix: Added ipcMain.handle('get-scenes') and ipcMain.handle('save-scenes')
  handlers to the main process, which read and write the scenes.json file in
  the app configuration folder. The getScenes and saveScenes methods were added
  to preload.cjs to expose them to the renderer.

  Additionally, the persistScenes function in ScenesTab was refactored to be
  synchronous from the UI perspective: React state is updated immediately and
  the disk write happens in the background, eliminating the visual freeze when
  adding, renaming or deleting scenes.

FEATURE REMOVAL
---

Auto-updater removed
  The automatic update system was completely removed by request.
  Removed: checkForUpdates function, fetchJSON, downloadFile, compareVersions,
  GitHub constants, startup call, confirm-update / cancel-update IPC handlers,
  onUpdateAvailable / onUpdateStatus listeners in preload and frontend,
  and the update dialog in App.jsx.
  The app version continues to be shown in the Settings tab.

---

VERSÃO 1.7
====
Agora no linux senas, e muito mais!
NOVOS RECURSOS
---

Aba de Cenas (Scenes Tab)
- Criada uma aba dedicada "Cenas" separada da aba de Gravação
- A aba Cenas permite listar, adicionar, editar e excluir cenas de forma completa
- Ao excluir uma cena, todos os dados associados (configurações de fonte, câmera, áudio e formato) são removidos permanentemente
- Suporte a renomear cenas com confirmação inline (tecla Enter salva, Escape cancela)
- Exclusão com etapa de confirmação para evitar remoções acidentais

- Antes de gravar: clique em uma cena na aba Cenas para aplicar todas as suas configurações ao gravador
- Durante a gravação: clique em uma cena na aba Cenas para alternar ao vivo entre cenas
- Cena ativa destacada visualmente durante a gravação com modo de canvas

Modo Cena (Scene Mode) na aba de Gravação
- Na aba Gravação foi mantido apenas o checkbox "Modo Cena" 
- Quando ativado, a gravação usa canvas com troca ao vivo de cenas
- Hint contextual indica o estado atual: inativo, ativo antes de gravar, e durante a gravação

Comunicação entre Abas por Eventos
- Implementado sistema de eventos personalizados (scenes:apply, scenes:switch, recorder:state, scenesUpdated) para comunicação entre RecorderTab e ScenesTab sem necessidade de contexto compartilhado
- RecorderTab expõe snapshot das configurações atuais (window.__recorderSnapshot) para que a aba Cenas possa salvar cenas com as configurações em vigor

INTERNACIONALIZAÇÃO
---
- Adicionadas traduções para a nova aba "Cenas" (tabs.scenes) em todos os 25 idiomas suportados
CORREÇÕES DE ERROS
---
- Adicionada dependência opcional @ffmpeg-installer/win32-x64 para suporte completo ao FFmpeg no Windows
- Movido dependências de plataforma específicas do FFmpeg para optionalDependencies para evitar erros de instalação em diferentes sistemas operacionais
- Adicionado suporte a linting e formatação de código com ESLint e Prettier
- Combinadas chamadas duplicadas a app.commandLine.appendSwitch('disable-features') para evitar comportamentos imprevisíveis
- Melhorado handler 'save-recording' para usar currentVideoFormat como padrão quando formato não é fornecido
- Tornadas chamadas explícitas à função convertVideo para maior clareza e manutenibilidade

NOVOS RECURSOS
---

Modo Somente Câmera (Camera Only)
  Novo modo de gravação que captura apenas a webcam em tela cheia, sem captura
  de tela. Ideal para introduções e encerramentos de tutoriais onde o criador
  quer aparecer em tela cheia.

  Como usar: marque a checkbox "Somente Câmera" na aba Gravação. Selecione a
  câmera e o microfone desejados e clique REC. O vídeo gravado conterá apenas
  a câmera em alta resolução (1920×1080 ideal) com o áudio do microfone.

  Os modos "Somente Áudio" e "Somente Câmera" são mutuamente exclusivos —
  ativar um desativa o outro automaticamente. Multi-Áudio também funciona
  neste modo (salva microphone.wav separado).

  Chaves de tradução adicionadas nos 25 idiomas:
    recorder.cameraOnlyMode  — "Somente Câmera"
    recorder.cameraOnlyDesc  — descrição do modo


Suporte a Linux (Build AppImage + DEB)
  O Eternal Recorder agora pode ser compilado para Linux com os mesmos
  recursos da versão Windows. A detecção do FFmpeg foi atualizada para
  suportar caminhos do Linux (linux-x64, /usr/bin/ffmpeg, /usr/local/bin/ffmpeg).

  Formatos de saída: AppImage (portátil) e DEB (instalador Debian/Ubuntu).

  Nota: os flags de feature do Windows (WinRTScreenCapturer, WGCDesktopCapturer)
  são aplicados apenas no Windows. No Linux, o Chromium usa captura X11/PipeWire
  nativamente.


CORREÇÕES DE ERROS
---

Múltiplas instâncias / processos zumbis no Gerenciador de Tarefas
  Causa: o app não possuía bloqueio de instância única. Como a janela minimiza
  para a bandeja do sistema, o usuário lançava o executável novamente achando
  que o app não estava aberto, criando 5 ou mais instâncias simultâneas.

  Correção: adicionado app.requestSingleInstanceLock(). Se uma segunda
  instância for lançada, ela detecta a instância já existente, envia o foco
  para a janela principal e encerra imediatamente (process.exit(0)).
  O evento second-instance mostra e foca a janela principal automaticamente.


Processos FFmpeg (RTMP) não encerrados ao fechar o app
  Causa: os processos filhos do FFmpeg usados para transmissão RTMP não eram
  encerrados ao fechar o app, permanecendo como processos órfãos no sistema.

  Correção: adicionado handler app.on('before-quit') que encerra todos os
  streams RTMP ativos (stdin.end() + SIGTERM em cada processo FFmpeg filho)
  antes que as janelas sejam fechadas.


App não fechava pelo menu da bandeja ("Sair") em alguns cenários
  Causa: app.isQuitting era definido apenas no clique do botão "Sair".
  Se o encerramento fosse iniciado por outro caminho, o handler close da
  controlWindow chamava e.preventDefault() impedindo o fechamento.

  Correção: app.isQuitting = true movido para before-quit, que sempre dispara
  antes do fechamento das janelas independente de como o quit foi iniciado.


log.txt criado na pasta temporária em vez da pasta do executável
  Causa: getLogPath() usava path.dirname(process.execPath) que em builds
  portáteis aponta para o diretório temporário de extração do electron-builder
  (ex: C:\Users\...\AppData\Local\Temp\...) e não para a pasta do .exe.

  Correção: getLogPath() agora usa PORTABLE_EXECUTABLE_DIR (definido pelo
  electron-builder em builds portáteis) com fallback para app.getPath('exe').
  O log.txt é criado ao lado do .exe, junto com config.ini e version.txt.


Além disso: foi adicionado nas configurações o comportamento do botão sair.
1. aperte alt e va até (EXIT)
o botão de sair vai fazer o comportamento que você definiu nas configurações!

Baixe para windows no Site oficial:

https://eternal-legend.com.br/eternalrecorder/

Baixe para linux no github:

https://github.com/azurejoga/eternallegend.github.io/releases

Esperamos que gostem!
The new version of the eternal recorder has been released! The Eternal Legend Screen Recorder!

VERSION 1.7 (current)
====
Now on Linux Senas, and much more!
NEW FEATURES
---

Scenes Tab
- Created a dedicated "Scenes" tab separate from the Recording tab
- The Scenes tab allows you to list, add, edit and delete scenes completely
- When deleting a scene, all associated data (source, camera, audio and format settings) is permanently removed
- Support renaming scenes with inline confirmation (Enter key saved, Escape cancels)
- Deletion with confirmation step to avoid accidental removals

- Before recording: click on a scene in the Scenes tab to apply all its settings to the recorder
- During recording: click on a scene in the Scenes tab to switch live between scenes
- Active scene visually highlighted during recording with canvas mode

Scene Mode in the Recording tab
- Only the "Scene Mode" checkbox was kept in the Recording tab 
- When activated, recording uses canvas with live scene switching
- Contextual Hint indicates the current state: inactive, active before recording, and during recording

Communication between Tabs by Events
- Implemented custom event system (scenes:apply, scenes:switch, recorder:state, scenesUpdated) for communication between RecorderTab and ScenesTab without the need for shared context
- RecorderTab exposes snapshot of current settings (window.__recorderSnapshot) so that the Scenes tab can save scenes with the current settings

INTERNATIONALIZATION
---
- Added translations for the new "Scenes" tab (tabs.scenes) in all 25 supported languages
BUG FIXES
---
- Added optional @ffmpeg-installer/win32-x64 dependency for full FFmpeg support on Windows
- Moved FFmpeg platform-specific dependencies to optionalDependencies to avoid installation errors on different operating systems
- Added support for linting and code formatting with ESLint and Prettier
- Combined duplicate calls to app.commandLine.appendSwitch('disable-features') to avoid unpredictable behavior
- Improved 'save-recording' handler to use currentVideoFormat as default when format is not provided
- Made explicit calls to the convertVideo function for greater clarity and maintainability

NEW FEATURES
---

Camera Only Mode
  New recording mode that only captures the webcam in full screen, without capture
  of screen. Ideal for introductions and closings of tutorials where the creator
  wants to appear full screen.

  How to use: check the "Camera Only" box in the Recording tab. Select the
  desired camera and microphone and click REC. The recorded video will only contain
  the camera in high resolution (1920×1080 ideal) with audio from the microphone.

  "Audio Only" and "Camera Only" modes are mutually exclusive —
  activating one automatically disables the other. Multi-Audio also works
  in this mode (save microphone.wav file separately).

  Translation keys added in all 25 languages:
    recorder.cameraOnlyMode — "Camera Only"
    recorder.cameraOnlyDesc — mode description


Linux support (Build AppImage + DEB)
  Eternal Recorder can now be compiled for Linux with the same
  Windows version features. FFmpeg detection has been updated to
  support Linux paths (linux-x64, /usr/bin/ffmpeg, /usr/local/bin/ffmpeg).

  Output formats: AppImage (portable) and DEB (Debian/Ubuntu installer).

  Note: Windows feature flags (WinRTScreenCapturer, WGCDesktopCapturer)
  are applied only on Windows. On Linux, Chromium uses X11/PipeWire capture
  natively.


BUG FIXES
---

Multiple zombie instances/processes in Task Manager
  Cause: The app did not have single-instance blocking. How the window minimizes
  to the system tray, the user launched the executable again finding
  that the app was not open, creating 5 or more simultaneous instances.

  Fix: Added app.requestSingleInstanceLock(). If a second
  instance is launched, it detects the already existing instance, sends the focus
  to the main window and exits immediately (process.exit(0)).
  The second-instance event automatically shows and focuses the main window.


FFmpeg (RTMP) processes not terminated when closing the app
  Cause: FFmpeg child processes used for RTMP transmission were not
  terminated when closing the app, remaining as orphaned processes in the system.

  Fix: added handler app.on('before-quit') which terminates all
  active RTMP streams (stdin.end() + SIGTERM in each child FFmpeg process)
  before the windows are closed.


App did not close via the tray menu ("Exit") in some scenarios
  Cause: app.isQuitting was only set on click of the "Quit" button.
  If the closure were initiated by another path, the close handler of the
  controlWindow called e.preventDefault() preventing closing.

  Fix: moved app.isQuitting = true to before-quit which always fires
  before closing the windows regardless of how the quit was initiated.


log.txt created in temp folder instead of executable folder
  Cause: getLogPath() used path.dirname(process.execPath) which in builds
  portable points to electron-builder's temporary extraction directory
  (ex: C:\Users\...\AppData\Local\Temp\...) and not to the .exe folder.

  Fix: getLogPath() now uses PORTABLE_EXECUTABLE_DIR (defined by
  electron-builder in portable builds) with fallback to app.getPath('exe').
  The log.txt is created alongside the .exe, along with config.ini and version.txt.


Additionally: the behavior of the exit button was added to the settings.
1. press alt and go to (EXIT)
The exit button will do the behavior you defined in the settings!

Download for Windows from the Official Website:

https://eternal-legend.com.br/eternalrecorder/

Download for Linux on github:

https://github.com/azurejoga/eternallegend.github.io/releases

We hope you like it!