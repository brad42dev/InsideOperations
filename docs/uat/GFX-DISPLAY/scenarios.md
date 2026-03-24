# UAT Scenarios — GFX-DISPLAY

## Page Load
Scenario 1: [GFX-DISPLAY-007] Designer page renders without error — navigate to /designer → page loads, no error boundary text

## CSS Keyframes — Alarm Flash Text
Scenario 2: [GFX-DISPLAY-007] io-alarm-flash-high-text keyframe exists — evaluate document.styleSheets → @keyframes io-alarm-flash-high-text found with fill #F97316 and fill #808080 transitions
Scenario 3: [GFX-DISPLAY-007] io-alarm-flash-medium-text keyframe exists — evaluate document.styleSheets → @keyframes io-alarm-flash-medium-text found with fill #EAB308 and fill #808080 transitions
Scenario 4: [GFX-DISPLAY-007] io-alarm-flash-advisory-text keyframe exists — evaluate document.styleSheets → @keyframes io-alarm-flash-advisory-text found with fill #06B6D4 and fill #808080 transitions
Scenario 5: [GFX-DISPLAY-007] io-alarm-flash-custom-text keyframe exists — evaluate document.styleSheets → @keyframes io-alarm-flash-custom-text found with fill #7C3AED and fill #808080 transitions

## CSS Classes — Priority Flash Rules
Scenario 6: [GFX-DISPLAY-007] io-alarm-flash-high class has stroke and text-fill rules — evaluate document.styleSheets → .io-alarm-flash-high found with > * stroke animation and text fill animation using io-alarm-flash-high-text
Scenario 7: [GFX-DISPLAY-007] io-alarm-flash-medium class has stroke and text-fill rules — evaluate document.styleSheets → .io-alarm-flash-medium found with > * stroke animation and text fill animation using io-alarm-flash-medium-text
Scenario 8: [GFX-DISPLAY-007] io-alarm-flash-advisory class has stroke and text-fill rules — evaluate document.styleSheets → .io-alarm-flash-advisory found with > * stroke animation and text fill animation using io-alarm-flash-advisory-text
Scenario 9: [GFX-DISPLAY-007] io-alarm-flash-custom class has stroke and text-fill rules — evaluate document.styleSheets → .io-alarm-flash-custom found with > * stroke animation and text fill animation using io-alarm-flash-custom-text
