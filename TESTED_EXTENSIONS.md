# Tested Extensions

The following Extensions are tested for installing and removing with Extensioon Manager:

* [Extension Manager](TESTED_EXTENSIONS.md#extension-manager--)  
* [AI.duino](TESTED_EXTENSIONS.md#aiduino)  
* [Arduino+](TESTED_EXTENSIONS.md#arduino)  

And for testing reasons:

* [Evil Extension](TESTED_EXTENSIONS.md#evil-extension)
  
### Extension Manager ;-)
  
* ℹ️ Extension Information
Name: extension-manager
Version: 1.0.0
Publisher: MonsterMaker
Description: Manage installed extensions in Arduino IDE 2.x  
Size: 36.0 KB

* ✅ Uninstaller: Available (complete uninstall)
  
* 🔒 Required Permissions  
Security levels: 🚨 Critical | ⚠️ High | ⚡ Medium | ℹ️ Low  

  - ⚡ MEDIUM
    - File deletion operations
      - ~/arduinoIDE
      - ~/extensionmanager
  
### AI.duino
  
* ℹ️ Extension Information
Name: aiduino  
Version: 2.5.0-Make  
Publisher: MonsterMaker  
Description: AI-powered assistance for Arduino with Claude, ChatGPT, and other AIs: improve code, explain errors, debug help  
Size: 580.7 KB  

* ✅ Uninstaller: Available (complete uninstall)
  
* 🔒 Required Permissions  
Security levels: 🚨 Critical | ⚠️ High | ⚡ Medium | ℹ️ Low  
  
  - ⚡ MEDIUM  
    - Network access to external servers  
    - File deletion operations  
      - ~/aiduino  
      - ~/arduino15  
      - ~/arduinoIDE  
      - ~/backup  
      - ~/cache  

### Arduino+

* ℹ️  Extension Information
Name: arduinoplus
Version: 1.0.0  
Publisher: MonsterMaker  
Description: Essential IDE helpers for Arduino development  
Size: 11.7 KB

* ✅ Uninstaller: Available (complete uninstall)
  
* 🔒 Required Permissions  
Security levels: 🚨 Critical | ⚠️ High | ⚡ Medium | ℹ️ Low

  - ⚡ MEDIUM  
    - File deletion operations  
      - ~/arduinoIDE  
      - ~/arduinoplus  

## Test Extesions

This extensions exist for testing reasons.  

### Evil Extension  

* ℹ️  Extension Information
Name: evil-extension  
Version: 6.6.6  
Publisher: EvilCorp  
Description: Test extension with intentional security issues  
Size: 1.8 KB  
  
* 🔒 Required Permissions  
Security levels: 🚨 Critical | ⚠️ High | ⚡ Medium | ℹ️ Low  
  - 🚨 CRITICAL
    - Dynamic code execution (eval)  
    - Dynamic function creation  

  - ⚠️ HIGH
    - Access to sensitive directories  
    - Obfuscated code
        
  - ⚡ MEDIUM  
    - Network access to external servers  
    - File deletion operations  
      - ~/aiduino  
      - ~/arduinoplus  
      - ~/backup  
      - ~/cache  
      - ~/gnupg  
    - Suspicious dependency (keytar)  

