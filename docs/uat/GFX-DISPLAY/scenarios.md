# UAT Scenarios — GFX-DISPLAY

## Module Load
Scenario 1: [GFX-DISPLAY-003] Designer route renders without error — navigate to /designer → page loads with no error boundary, no "Something went wrong" text

## Alarm Flash CSS Keyframes
Scenario 2: [GFX-DISPLAY-004] High alarm flash text keyframe exists — browser_evaluate check for io-alarm-flash-high-text keyframe in stylesheets → keyframe rules present in document stylesheets
Scenario 3: [GFX-DISPLAY-004] Medium alarm flash text keyframe exists — browser_evaluate check for io-alarm-flash-medium-text keyframe → keyframe rules present
Scenario 4: [GFX-DISPLAY-004] Advisory alarm flash text keyframe exists — browser_evaluate check for io-alarm-flash-advisory-text keyframe → keyframe rules present
Scenario 5: [GFX-DISPLAY-004] Custom alarm flash text keyframe exists — browser_evaluate check for io-alarm-flash-custom-text keyframe → keyframe rules present

## CSS Token Usage
Scenario 6: [GFX-DISPLAY-006] CSS custom properties defined on root — browser_evaluate check that --io-surface-elevated CSS variable is defined → variable value is non-empty string

## Designer Canvas
Scenario 7: [GFX-DISPLAY-005] Designer canvas loads with toolbox/palette — navigate to /designer → a panel or sidebar with display element tools is visible, no stub/Phase-7 placeholder
Scenario 8: [GFX-DISPLAY-003] No JS errors on designer page load — navigate to /designer, check browser console messages → no uncaught errors related to applyPointValue or display elements
