# UAT Scenarios — GFX-DISPLAY

## Page Load
Scenario 1: [GFX-DISPLAY-008] Designer renders without error — navigate to /designer → page loads, no error boundary ("Something went wrong") visible

## Alarm Flash CSS Keyframes
Scenario 2: [GFX-DISPLAY-008] All 4 alarm flash text keyframes present — evaluate document.styleSheets for @keyframes names → io-alarm-flash-high-text, io-alarm-flash-medium-text, io-alarm-flash-advisory-text, io-alarm-flash-custom-text all present
Scenario 3: [GFX-DISPLAY-008] High-priority text keyframe colors correct — evaluate io-alarm-flash-high-text keyframe rules → contains fill: #F97316 (orange) and fill: #808080 (gray) transitions
Scenario 4: [GFX-DISPLAY-008] Medium-priority text keyframe colors correct — evaluate io-alarm-flash-medium-text keyframe rules → contains fill: #EAB308 (yellow) and fill: #808080 transitions
Scenario 5: [GFX-DISPLAY-008] Advisory-priority text keyframe colors correct — evaluate io-alarm-flash-advisory-text keyframe rules → contains fill: #06B6D4 (cyan) and fill: #808080 transitions
Scenario 6: [GFX-DISPLAY-008] Custom-priority text keyframe colors correct — evaluate io-alarm-flash-custom-text keyframe rules → contains fill: #7C3AED (purple) and fill: #808080 transitions

## Alarm Flash Priority Classes
Scenario 7: [GFX-DISPLAY-008] Priority class .io-alarm-flash-high has text fill animation — evaluate CSS class rules → class has both a "> *" stroke animation rule and a "text" fill animation rule using io-alarm-flash-high-text
Scenario 8: [GFX-DISPLAY-008] Priority class .io-alarm-flash-medium has text fill animation — evaluate CSS class rules → class has both a "> *" stroke animation rule and a "text" fill animation rule using io-alarm-flash-medium-text
Scenario 9: [GFX-DISPLAY-008] Priority class .io-alarm-flash-advisory has text fill animation — evaluate CSS class rules → class has both a "> *" stroke animation rule and a "text" fill animation rule using io-alarm-flash-advisory-text
Scenario 10: [GFX-DISPLAY-008] Priority class .io-alarm-flash-custom has text fill animation — evaluate CSS class rules → class has both a "> *" stroke animation rule and a "text" fill animation rule using io-alarm-flash-custom-text
