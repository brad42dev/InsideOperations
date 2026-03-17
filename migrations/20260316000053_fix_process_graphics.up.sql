-- UP MIGRATION: 20260316000053_fix_process_graphics
-- Fixes viewBox and SVG content for all 13 process graphics.
-- Unit 24 (2560→1920) and HCU Unit 25 (3840→1920) use scale-wrap.
-- All others are complete rewrites at 1920x1080.

-- ============================================================
-- 1. UNIT 24 — HYDROGEN PLANT (SMR) — PROCESS OVERVIEW
--    Wrap existing 2560x1440 content in scale(0.75) → 1920x1080
-- ============================================================
UPDATE design_objects
SET
  svg_data = replace(
               replace(
                 svg_data,
                 '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2560 1440">',
                 '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><g transform="scale(0.75)">'
               ),
               '</svg>',
               '</g></svg>'
             ),
  metadata = '{"width": 1920, "height": 1080}'::jsonb
WHERE id = '401ed010-2a20-4bf0-afe0-9324afbc19a2';

-- ============================================================
-- 12. HCU Unit 25 Process
--     Wrap existing 3840x2160 content in scale(0.5) → 1920x1080
-- ============================================================
UPDATE design_objects
SET
  svg_data = replace(
               replace(
                 svg_data,
                 '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3840 2160">',
                 '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><g transform="scale(0.5)">'
               ),
               '</svg>',
               '</g></svg>'
             ),
  bindings = '{}'::jsonb,
  metadata = '{"width": 1920, "height": 1080}'::jsonb
WHERE id = '4a9773e5-3d29-4778-a312-134cc81e5f98';

-- ============================================================
-- 2. H2 Plant Overview — Reformer & Shift
-- ============================================================
UPDATE design_objects
SET svg_data = $svg$<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080">
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#71717A"/></marker>
    <marker id="arr-g" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#34D399"/></marker>
    <marker id="arr-b" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#60A5FA"/></marker>
    <marker id="arr-o" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#F97316"/></marker>
    <marker id="arr-r" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#EF4444"/></marker>
  </defs>
  <rect width="100%" height="100%" fill="#09090B"/>
  <!-- Title -->
  <text x="960" y="36" text-anchor="middle" font-family="monospace" font-size="18" font-weight="bold" fill="#E4E4E7">UNIT 24 — H2 PLANT: REFORMER / SHIFT REACTORS / PSA</text>
  <!-- Zone dividers -->
  <line x1="160" y1="60" x2="160" y2="1020" stroke="#27272A" stroke-width="1" stroke-dasharray="3,5"/>
  <line x1="330" y1="60" x2="330" y2="1020" stroke="#27272A" stroke-width="1" stroke-dasharray="3,5"/>
  <line x1="650" y1="60" x2="650" y2="1020" stroke="#27272A" stroke-width="1" stroke-dasharray="3,5"/>
  <line x1="830" y1="60" x2="830" y2="1020" stroke="#27272A" stroke-width="1" stroke-dasharray="3,5"/>
  <line x1="1080" y1="60" x2="1080" y2="1020" stroke="#27272A" stroke-width="1" stroke-dasharray="3,5"/>
  <line x1="1390" y1="60" x2="1390" y2="1020" stroke="#27272A" stroke-width="1" stroke-dasharray="3,5"/>
  <line x1="1640" y1="60" x2="1640" y2="1020" stroke="#27272A" stroke-width="1" stroke-dasharray="3,5"/>
  <!-- Zone labels -->
  <text x="82" y="72" text-anchor="middle" font-family="monospace" font-size="10" fill="#52525B">DESULF</text>
  <text x="243" y="72" text-anchor="middle" font-family="monospace" font-size="10" fill="#52525B">PREHEAT</text>
  <text x="490" y="72" text-anchor="middle" font-family="monospace" font-size="10" fill="#52525B">REFORMING</text>
  <text x="740" y="72" text-anchor="middle" font-family="monospace" font-size="10" fill="#52525B">WHB</text>
  <text x="955" y="72" text-anchor="middle" font-family="monospace" font-size="10" fill="#52525B">SHIFT CONV</text>
  <text x="1235" y="72" text-anchor="middle" font-family="monospace" font-size="10" fill="#52525B">LTS / COOL</text>
  <text x="1516" y="72" text-anchor="middle" font-family="monospace" font-size="10" fill="#52525B">PSA</text>
  <text x="1780" y="72" text-anchor="middle" font-family="monospace" font-size="10" fill="#52525B">PRODUCT</text>
  <!-- Steam system header -->
  <text x="18" y="165" font-family="monospace" font-size="11" fill="#60A5FA">— STEAM —</text>
  <path d="M 18 195 L 82 195" stroke="#60A5FA" stroke-width="1.5" fill="none" marker-end="url(#arr-b)"/>
  <text x="18" y="185" font-family="monospace" font-size="9" fill="#60A5FA">BFW IN</text>
  <!-- Steam drum -->
  <g id="vessel-steam-drum" transform="translate(82,175)">
    <rect width="90" height="40" rx="20" fill="#18181B" stroke="#3B82F6" stroke-width="1.5"/>
    <text x="45" y="15" text-anchor="middle" font-family="monospace" font-size="8" fill="#60A5FA">STM DRUM</text>
    <text x="45" y="28" text-anchor="middle" font-family="monospace" font-size="8" fill="#3B82F6">V-2401D</text>
  </g>
  <!-- BFW preheat HX -->
  <g id="hx-bfw-preheat" transform="translate(82,235)">
    <rect width="90" height="45" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <ellipse cx="22" cy="22" rx="11" ry="18" fill="none" stroke="#3F3F46" stroke-width="1"/>
    <line x1="33" y1="22" x2="57" y2="22" stroke="#3F3F46" stroke-width="1"/>
    <ellipse cx="68" cy="22" rx="11" ry="18" fill="none" stroke="#3F3F46" stroke-width="1"/>
    <text x="45" y="42" text-anchor="middle" font-family="monospace" font-size="8" fill="#A1A1AA">BFW-PH</text>
  </g>
  <!-- Steam line to superheater and onwards -->
  <path d="M 172 195 L 480 195" stroke="#60A5FA" stroke-width="1.5" fill="none"/>
  <!-- Superheater inside firebox -->
  <!-- Process steam line down -->
  <path d="M 172 215 L 172 570" stroke="#60A5FA" stroke-width="1.5" fill="none" stroke-dasharray="5,3"/>
  <text x="178" y="420" font-family="monospace" font-size="9" fill="#60A5FA">PROCESS</text>
  <text x="178" y="432" font-family="monospace" font-size="9" fill="#60A5FA">STEAM</text>
  <circle cx="172" cy="570" r="4" fill="#60A5FA"/>
  <!-- Export steam -->
  <path d="M 480 195 L 650 195" stroke="#60A5FA" stroke-width="1.5" fill="none" marker-end="url(#arr-b)"/>
  <text x="565" y="185" text-anchor="middle" font-family="monospace" font-size="9" fill="#60A5FA">EXPORT STM</text>

  <!-- Stack -->
  <g id="stack" transform="translate(495,90)">
    <rect width="18" height="80" fill="#27272A" stroke="#52525B" stroke-width="1.5"/>
    <rect x="-10" y="73" width="38" height="10" rx="2" fill="#27272A" stroke="#52525B" stroke-width="1"/>
    <text x="9" y="70" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">CEMS</text>
  </g>
  <text x="504" y="183" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">STACK</text>
  <!-- Flue gas to stack -->
  <path d="M 504 175 L 504 170" stroke="#EF4444" stroke-width="1.5" fill="none" marker-end="url(#arr-r)"/>

  <!-- NG Feed in -->
  <path id="pipe-ng-in" d="M 18 540 L 80 540" stroke="#71717A" stroke-width="2" fill="none" marker-end="url(#arr)"/>
  <text x="18" y="530" font-family="monospace" font-size="10" fill="#E4E4E7">NG FEED</text>

  <!-- V-2401 Desulfurizer -->
  <g id="vessel-v2401" transform="translate(80,470)">
    <rect width="52" height="120" rx="18" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <text x="26" y="52" text-anchor="middle" font-family="monospace" font-size="8" fill="#A1A1AA">DSUF</text>
    <text x="26" y="65" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">ZnO</text>
  </g>
  <text x="106" y="606" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">V-2401</text>
  <text x="106" y="618" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">DESULFURIZER</text>

  <!-- pipe-desulf-preheat -->
  <path id="pipe-desulf-preheat" d="M 132 540 L 200 540" stroke="#71717A" stroke-width="2" fill="none"/>

  <!-- E-2401 Preheat HX -->
  <g id="hx-e2401" transform="translate(200,512)">
    <rect width="100" height="55" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <ellipse cx="24" cy="27" rx="12" ry="20" fill="none" stroke="#3F3F46" stroke-width="1"/>
    <line x1="36" y1="27" x2="64" y2="27" stroke="#3F3F46" stroke-width="1"/>
    <ellipse cx="76" cy="27" rx="12" ry="20" fill="none" stroke="#3F3F46" stroke-width="1"/>
  </g>
  <text x="250" y="582" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">E-2401</text>
  <text x="250" y="594" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">PREHEAT HX</text>

  <!-- pipe-preheat-reformer -->
  <path id="pipe-preheat-reformer" d="M 300 540 L 390 540" stroke="#71717A" stroke-width="2" fill="none"/>
  <!-- steam joins feed -->
  <path d="M 172 570 L 172 580 L 390 580 L 390 560 L 390 540" stroke="#60A5FA" stroke-width="1.5" fill="none"/>

  <!-- H-2401 Reformer firebox -->
  <g id="heater-h2401" transform="translate(390,370)">
    <!-- Conv section -->
    <rect width="150" height="55" fill="#1C1917" stroke="#78350F" stroke-width="1.5"/>
    <text x="75" y="20" text-anchor="middle" font-family="monospace" font-size="8" fill="#D97706">CONVECTION</text>
    <text x="75" y="33" text-anchor="middle" font-family="monospace" font-size="8" fill="#D97706">SECTION</text>
    <!-- Firebox -->
    <rect y="55" width="150" height="190" fill="#1C1917" stroke="#B45309" stroke-width="2"/>
    <text x="75" y="80" text-anchor="middle" font-family="monospace" font-size="11" fill="#F59E0B">H-2401</text>
    <text x="75" y="95" text-anchor="middle" font-family="monospace" font-size="10" fill="#D97706">REFORMER</text>
    <!-- Tubes -->
    <line x1="30" y1="108" x2="30" y2="230" stroke="#78350F" stroke-width="1.5" stroke-dasharray="3,3"/>
    <line x1="55" y1="108" x2="55" y2="230" stroke="#78350F" stroke-width="1.5" stroke-dasharray="3,3"/>
    <line x1="80" y1="108" x2="80" y2="230" stroke="#78350F" stroke-width="1.5" stroke-dasharray="3,3"/>
    <line x1="105" y1="108" x2="105" y2="230" stroke="#78350F" stroke-width="1.5" stroke-dasharray="3,3"/>
    <line x1="130" y1="108" x2="130" y2="230" stroke="#78350F" stroke-width="1.5" stroke-dasharray="3,3"/>
    <!-- Flames -->
    <path d="M 28 238 Q 35 222 38 234 Q 41 220 45 234 Q 48 222 42 238 Z" fill="#F97316" opacity="0.75"/>
    <path d="M 62 238 Q 69 222 72 234 Q 75 220 79 234 Q 82 222 76 238 Z" fill="#F97316" opacity="0.75"/>
    <path d="M 96 238 Q 103 222 106 234 Q 109 220 113 234 Q 116 222 110 238 Z" fill="#F97316" opacity="0.75"/>
    <path d="M 128 238 Q 135 222 138 234 Q 141 220 145 234 Q 148 222 142 238 Z" fill="#F97316" opacity="0.75"/>
  </g>
  <text x="465" y="632" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">H-2401 REFORMER</text>

  <!-- Flue gas from firebox to stack -->
  <path id="pipe-flue-stack" d="M 465 370 L 465 330 L 504 330 L 504 170" stroke="#EF4444" stroke-width="1.5" fill="none" stroke-dasharray="7,3" marker-end="url(#arr-r)"/>
  <text x="488" y="310" font-family="monospace" font-size="9" fill="#EF4444">FLUE GAS</text>

  <!-- pipe-reformer-whb (hot reformed gas 850°C) -->
  <path id="pipe-reformer-whb" d="M 540 540 L 660 540" stroke="#EF4444" stroke-width="2.5" fill="none"/>
  <text x="598" y="530" text-anchor="middle" font-family="monospace" font-size="9" fill="#EF4444">~850°C</text>

  <!-- E-WHB Waste Heat Boiler -->
  <g id="hx-whb" transform="translate(660,510)">
    <rect width="100" height="55" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <ellipse cx="24" cy="27" rx="12" ry="20" fill="none" stroke="#3F3F46" stroke-width="1"/>
    <line x1="36" y1="27" x2="64" y2="27" stroke="#3F3F46" stroke-width="1"/>
    <ellipse cx="76" cy="27" rx="12" ry="20" fill="none" stroke="#3F3F46" stroke-width="1"/>
  </g>
  <text x="710" y="580" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">E-WHB</text>
  <text x="710" y="592" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">WASTE HEAT BOILER</text>
  <!-- WHB steam circuit back to drum -->
  <path d="M 660 520 L 650 520 L 650 210 L 172 210" stroke="#60A5FA" stroke-width="1.5" fill="none" stroke-dasharray="4,3" opacity="0.6"/>

  <!-- pipe-whb-hts -->
  <path d="M 760 540 L 840 540" stroke="#71717A" stroke-width="2" fill="none"/>

  <!-- R-2401 HTS Reactor -->
  <g id="vessel-hts" transform="translate(840,460)">
    <rect width="62" height="160" rx="10" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <rect x="7" y="55" width="48" height="62" rx="3" fill="#27272A" opacity="0.5"/>
    <text x="31" y="70" text-anchor="middle" font-family="monospace" font-size="8" fill="#A1A1AA">HTS</text>
    <text x="31" y="83" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">CAT</text>
    <line x1="0" y1="80" x2="7" y2="80" stroke="#71717A" stroke-width="1.5"/>
    <line x1="55" y1="80" x2="62" y2="80" stroke="#71717A" stroke-width="1.5"/>
  </g>
  <text x="871" y="635" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">R-2401</text>
  <text x="871" y="647" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">HTS REACTOR</text>
  <text x="871" y="659" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">350→420°C</text>

  <!-- pipe-hts-lts intercooler -->
  <path d="M 902 540 L 960 540" stroke="#71717A" stroke-width="2" fill="none"/>
  <!-- Intercooler -->
  <g id="hx-intercooler" transform="translate(960,513)">
    <rect width="80" height="52" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <ellipse cx="18" cy="26" rx="10" ry="18" fill="none" stroke="#3F3F46" stroke-width="1"/>
    <line x1="28" y1="26" x2="52" y2="26" stroke="#3F3F46" stroke-width="1"/>
    <ellipse cx="62" cy="26" rx="10" ry="18" fill="none" stroke="#3F3F46" stroke-width="1"/>
  </g>
  <text x="1000" y="580" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">E-INTCL</text>

  <!-- pipe-hts-lts to LTS -->
  <path id="pipe-hts-lts" d="M 1040 540 L 1100 540" stroke="#71717A" stroke-width="2" fill="none"/>

  <!-- R-2402 LTS Reactor -->
  <g id="vessel-lts" transform="translate(1100,460)">
    <rect width="62" height="160" rx="10" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <rect x="7" y="55" width="48" height="62" rx="3" fill="#27272A" opacity="0.5"/>
    <text x="31" y="70" text-anchor="middle" font-family="monospace" font-size="8" fill="#A1A1AA">LTS</text>
    <text x="31" y="83" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">CAT</text>
    <line x1="0" y1="80" x2="7" y2="80" stroke="#71717A" stroke-width="1.5"/>
    <line x1="55" y1="80" x2="62" y2="80" stroke="#71717A" stroke-width="1.5"/>
  </g>
  <text x="1131" y="635" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">R-2402</text>
  <text x="1131" y="647" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">LTS REACTOR</text>
  <text x="1131" y="659" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">200→260°C</text>

  <!-- pipe-lts-psa -->
  <path id="pipe-lts-psa" d="M 1162 540 L 1310 540" stroke="#71717A" stroke-width="2" fill="none"/>
  <text x="1235" y="530" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">SYNGAS</text>

  <!-- PSA feed header -->
  <path d="M 1310 380 L 1310 870" stroke="#71717A" stroke-width="2.5" fill="none"/>
  <text x="1298" y="376" text-anchor="end" font-family="monospace" font-size="9" fill="#A1A1AA">FEED HDR</text>

  <!-- PSA tail gas collect header -->
  <path d="M 1390 420 L 1390 900" stroke="#A1A1AA" stroke-width="1.5" fill="none" stroke-dasharray="5,3"/>

  <!-- PSA Bed A -->
  <g id="cv-fv0401" transform="translate(1320,390)">
    <rect width="68" height="100" rx="10" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <rect x="8" y="30" width="52" height="52" rx="3" fill="#27272A" opacity="0.6"/>
    <text x="34" y="22" text-anchor="middle" font-family="monospace" font-size="8" fill="#A1A1AA">PSA</text>
    <text x="34" y="62" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">BED A</text>
  </g>
  <text x="1354" y="503" text-anchor="middle" font-family="monospace" font-size="9" fill="#E4E4E7">A-2401A</text>
  <path d="M 1310 440 L 1320 440" stroke="#71717A" stroke-width="1.5" fill="none"/>
  <path id="pipe-psa-product" d="M 1388 440 L 1460 440" stroke="#34D399" stroke-width="2" fill="none"/>

  <!-- PSA Bed B -->
  <g id="valve-xv0401" transform="translate(1320,590)">
    <rect width="68" height="100" rx="10" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <rect x="8" y="30" width="52" height="52" rx="3" fill="#27272A" opacity="0.6"/>
    <text x="34" y="22" text-anchor="middle" font-family="monospace" font-size="8" fill="#A1A1AA">PSA</text>
    <text x="34" y="62" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">BED B</text>
  </g>
  <text x="1354" y="703" text-anchor="middle" font-family="monospace" font-size="9" fill="#E4E4E7">A-2401B</text>
  <path d="M 1310 640 L 1320 640" stroke="#71717A" stroke-width="1.5" fill="none"/>
  <path d="M 1388 640 L 1460 640" stroke="#34D399" stroke-width="2" fill="none"/>

  <!-- PSA Bed C -->
  <g id="pipe-psa-product-3" transform="translate(1320,790)">
    <rect width="68" height="100" rx="10" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <rect x="8" y="30" width="52" height="52" rx="3" fill="#27272A" opacity="0.6"/>
    <text x="34" y="22" text-anchor="middle" font-family="monospace" font-size="8" fill="#A1A1AA">PSA</text>
    <text x="34" y="62" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">BED C</text>
  </g>
  <text x="1354" y="903" text-anchor="middle" font-family="monospace" font-size="9" fill="#E4E4E7">A-2401C</text>
  <path d="M 1310 840 L 1320 840" stroke="#71717A" stroke-width="1.5" fill="none"/>
  <path d="M 1388 840 L 1460 840" stroke="#34D399" stroke-width="2" fill="none"/>

  <!-- H2 product header -->
  <path d="M 1460 420 L 1460 860" stroke="#34D399" stroke-width="2.5" fill="none"/>
  <text x="1468" y="418" font-family="monospace" font-size="9" fill="#34D399">H2 HDR</text>

  <!-- pipe-tailgas-fuel tail gas header back to fuel -->
  <path id="pipe-tailgas-fuel" d="M 1390 880 L 540 880" stroke="#A1A1AA" stroke-width="1.5" fill="none" stroke-dasharray="5,3" marker-end="url(#arr)"/>
  <text x="965" y="896" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">PSA TAIL GAS → FUEL HEADER</text>

  <!-- pipe-steam-reformer (steam to reformer) -->
  <path id="pipe-steam-reformer" d="M 172 570 L 390 570" stroke="#60A5FA" stroke-width="1.5" fill="none" stroke-dasharray="5,3"/>

  <!-- Fuel system at bottom -->
  <text x="18" y="952" font-family="monospace" font-size="11" fill="#F97316">— FUEL GAS —</text>
  <path d="M 18 975 L 100 975" stroke="#F97316" stroke-width="2" fill="none" marker-end="url(#arr-o)"/>
  <text x="18" y="965" font-family="monospace" font-size="9" fill="#F97316">FUEL GAS IN</text>
  <!-- Fuel header -->
  <path d="M 100 975 L 540 975" stroke="#F97316" stroke-width="2" fill="none"/>
  <circle cx="540" cy="975" r="4" fill="#F97316"/>

  <!-- XV-0401 block valve -->
  <g id="valve-xv0401-v" transform="translate(520,940)">
    <polygon points="0,0 16,8 0,16" fill="none" stroke="#F97316" stroke-width="1.5"/>
    <polygon points="32,0 16,8 32,16" fill="none" stroke="#F97316" stroke-width="1.5"/>
    <line x1="16" y1="0" x2="16" y2="-8" stroke="#F97316" stroke-width="1.5"/>
    <rect x="8" y="-14" width="16" height="6" rx="1" fill="none" stroke="#F97316" stroke-width="1"/>
    <text x="16" y="-16" text-anchor="middle" font-family="monospace" font-size="8" fill="#F97316">XV-0401</text>
  </g>

  <!-- FV-0401 control valve -->
  <g id="cv-fv0401-v" transform="translate(548,940)">
    <polygon points="0,0 16,8 0,16" fill="none" stroke="#F97316" stroke-width="1.5"/>
    <polygon points="32,0 16,8 32,16" fill="none" stroke="#F97316" stroke-width="1.5"/>
    <line x1="16" y1="0" x2="16" y2="-8" stroke="#F97316" stroke-width="1.5"/>
    <path d="M 6,-8 A 10,10 0 0,1 26,-8 Z" fill="none" stroke="#F97316" stroke-width="1.5"/>
    <text x="16" y="-16" text-anchor="middle" font-family="monospace" font-size="8" fill="#F97316">FV-0401</text>
  </g>

  <!-- pipe-fuelgas-burner -->
  <path id="pipe-fuelgas-burner" d="M 540 975 L 540 615" stroke="#F97316" stroke-width="2" fill="none" marker-end="url(#arr-o)"/>
  <text x="552" y="800" font-family="monospace" font-size="9" fill="#F97316">FUEL TO</text>
  <text x="552" y="812" font-family="monospace" font-size="9" fill="#F97316">BURNERS</text>

  <!-- pipe-fuelgas-heater supplemental -->
  <path id="pipe-fuelgas-heater" d="M 540 975 L 465 975 L 465 615" stroke="#F97316" stroke-width="1.5" fill="none" stroke-dasharray="4,3"/>

  <!-- H2 from PSA to compression -->
  <path d="M 1460 640 L 1640 640" stroke="#34D399" stroke-width="2" fill="none" marker-end="url(#arr-g)"/>
  <text x="1548" y="630" text-anchor="middle" font-family="monospace" font-size="9" fill="#34D399">H2 → K-2401</text>
  <text x="1548" y="656" text-anchor="middle" font-family="monospace" font-size="9" fill="#6EE7B7">99.9%+ H2</text>

  <!-- Legend -->
  <rect x="1680" y="490" width="230" height="210" rx="3" fill="#0F0F11" stroke="#27272A" stroke-width="1"/>
  <text x="1795" y="510" text-anchor="middle" font-family="monospace" font-size="10" fill="#71717A">LEGEND</text>
  <line x1="1698" y1="526" x2="1740" y2="526" stroke="#71717A" stroke-width="2"/><text x="1750" y="530" font-family="monospace" font-size="9" fill="#A1A1AA">Process Gas</text>
  <line x1="1698" y1="546" x2="1740" y2="546" stroke="#34D399" stroke-width="2"/><text x="1750" y="550" font-family="monospace" font-size="9" fill="#A1A1AA">Hydrogen Product</text>
  <line x1="1698" y1="566" x2="1740" y2="566" stroke="#60A5FA" stroke-width="1.5" stroke-dasharray="5,3"/><text x="1750" y="570" font-family="monospace" font-size="9" fill="#A1A1AA">Steam / BFW</text>
  <line x1="1698" y1="586" x2="1740" y2="586" stroke="#F97316" stroke-width="2"/><text x="1750" y="590" font-family="monospace" font-size="9" fill="#A1A1AA">Fuel Gas</text>
  <line x1="1698" y1="606" x2="1740" y2="606" stroke="#EF4444" stroke-width="1.5" stroke-dasharray="7,3"/><text x="1750" y="610" font-family="monospace" font-size="9" fill="#A1A1AA">Flue Gas</text>
  <line x1="1698" y1="626" x2="1740" y2="626" stroke="#A1A1AA" stroke-width="1.5" stroke-dasharray="5,3"/><text x="1750" y="630" font-family="monospace" font-size="9" fill="#A1A1AA">PSA Tail Gas</text>
  <line x1="1698" y1="646" x2="1740" y2="646" stroke="#EF4444" stroke-width="2.5"/><text x="1750" y="650" font-family="monospace" font-size="9" fill="#A1A1AA">Hot Reformed Gas</text>
  <text x="1795" y="690" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">U24 SMR REV.1</text>
</svg>$svg$,
  metadata = '{"width": 1920, "height": 1080}'::jsonb
WHERE id = 'b165e49d-13ca-47cc-a86d-36aad91ed2a8';

-- ============================================================
-- 3. H2 Plant — Steam System / Compression / Utilities
-- ============================================================
UPDATE design_objects
SET svg_data = $svg$<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080">
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#71717A"/></marker>
    <marker id="arr-g" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#34D399"/></marker>
    <marker id="arr-b" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#60A5FA"/></marker>
  </defs>
  <rect width="100%" height="100%" fill="#09090B"/>
  <text x="960" y="36" text-anchor="middle" font-family="monospace" font-size="18" font-weight="bold" fill="#E4E4E7">UNIT 24 — H2 PLANT: STEAM SYSTEM / H2 COMPRESSION / UTILITIES</text>

  <!-- Zone dividers -->
  <line x1="620" y1="60" x2="620" y2="1040" stroke="#27272A" stroke-width="1" stroke-dasharray="3,5"/>
  <line x1="1050" y1="60" x2="1050" y2="1040" stroke="#27272A" stroke-width="1" stroke-dasharray="3,5"/>
  <line x1="1380" y1="60" x2="1380" y2="1040" stroke="#27272A" stroke-width="1" stroke-dasharray="3,5"/>
  <text x="310" y="72" text-anchor="middle" font-family="monospace" font-size="10" fill="#52525B">STEAM SYSTEM</text>
  <text x="835" y="72" text-anchor="middle" font-family="monospace" font-size="10" fill="#52525B">H2 COMPRESSION</text>
  <text x="1215" y="72" text-anchor="middle" font-family="monospace" font-size="10" fill="#52525B">CW / UTILITIES</text>
  <text x="1650" y="72" text-anchor="middle" font-family="monospace" font-size="10" fill="#52525B">EMISSIONS / MISC</text>

  <!-- BFW IN -->
  <path id="pipe-bfw-in" d="M 20 280 L 110 280" stroke="#60A5FA" stroke-width="2" fill="none" marker-end="url(#arr-b)"/>
  <text x="20" y="270" font-family="monospace" font-size="10" fill="#60A5FA">BFW IN</text>
  <text x="20" y="294" font-family="monospace" font-size="9" fill="#A1A1AA">40 bar</text>

  <!-- hx-bfw-preheat -->
  <g id="hx-bfw-preheat" transform="translate(110,255)">
    <rect width="100" height="50" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <ellipse cx="24" cy="25" rx="12" ry="18" fill="none" stroke="#3F3F46" stroke-width="1"/>
    <line x1="36" y1="25" x2="64" y2="25" stroke="#3F3F46" stroke-width="1"/>
    <ellipse cx="76" cy="25" rx="12" ry="18" fill="none" stroke="#3F3F46" stroke-width="1"/>
  </g>
  <text x="160" y="320" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">E-BFW-PH</text>

  <!-- pipe-bfw-drum -->
  <path id="pipe-bfw-drum" d="M 210 280 L 280 280" stroke="#60A5FA" stroke-width="2" fill="none"/>

  <!-- vessel-steam-drum (horizontal) -->
  <g id="vessel-steam-drum" transform="translate(280,250)">
    <rect width="160" height="60" rx="30" fill="#18181B" stroke="#3B82F6" stroke-width="2"/>
    <text x="80" y="22" text-anchor="middle" font-family="monospace" font-size="9" fill="#60A5FA">STEAM DRUM</text>
    <text x="80" y="36" text-anchor="middle" font-family="monospace" font-size="9" fill="#3B82F6">V-2401D</text>
    <text x="80" y="50" text-anchor="middle" font-family="monospace" font-size="9" fill="#52525B">40 bar / 250°C</text>
    <!-- level indicator -->
    <rect x="140" y="8" width="14" height="44" rx="2" fill="#09090B" stroke="#3B82F6" stroke-width="1"/>
    <rect x="141" y="30" width="12" height="22" rx="1" fill="#3B82F6" opacity="0.5"/>
  </g>
  <text x="360" y="325" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">V-2401D</text>

  <!-- Steam from drum upward to superheater -->
  <path d="M 360 250 L 360 180" stroke="#60A5FA" stroke-width="2" fill="none" marker-end="url(#arr-b)"/>

  <!-- Superheater (inside reformer conv section schematic) -->
  <g id="hx-superheater" transform="translate(310,130)">
    <rect width="100" height="45" fill="#1C1917" stroke="#78350F" stroke-width="1.5"/>
    <line x1="25" y1="0" x2="25" y2="45" stroke="#92400E" stroke-width="1" stroke-dasharray="2,2"/>
    <line x1="50" y1="0" x2="50" y2="45" stroke="#92400E" stroke-width="1" stroke-dasharray="2,2"/>
    <line x1="75" y1="0" x2="75" y2="45" stroke="#92400E" stroke-width="1" stroke-dasharray="2,2"/>
    <text x="50" y="28" text-anchor="middle" font-family="monospace" font-size="9" fill="#F59E0B">E-SH</text>
  </g>
  <text x="360" y="122" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">SUPERHEATER</text>
  <text x="360" y="188" text-anchor="middle" font-family="monospace" font-size="9" fill="#D97706">(in H-2401 conv)</text>

  <!-- pipe-steam-super — superheated steam exits right -->
  <path id="pipe-steam-super" d="M 410 152 L 620 152" stroke="#60A5FA" stroke-width="2" fill="none"/>

  <!-- pipe-export-steam exits top-right -->
  <path id="pipe-export-steam" d="M 514 152 L 514 100 L 620 100" stroke="#60A5FA" stroke-width="2" fill="none" marker-end="url(#arr-b)"/>
  <text x="567" y="92" text-anchor="middle" font-family="monospace" font-size="9" fill="#60A5FA">EXPORT STEAM</text>
  <text x="567" y="104" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">42 bar / 400°C</text>

  <!-- pipe-process-steam to reformer (exits left/down) -->
  <path id="pipe-process-steam" d="M 310 152 L 200 152 L 200 960 L 20 960" stroke="#60A5FA" stroke-width="2" fill="none" stroke-dasharray="6,3" marker-end="url(#arr-b)"/>
  <text x="110" y="952" font-family="monospace" font-size="9" fill="#60A5FA">PROC STM → REFORMER</text>

  <!-- Condensate system -->
  <g id="vessel-cond-drum" transform="translate(280,560)">
    <rect width="130" height="50" rx="25" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <text x="65" y="20" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">COND DRUM</text>
    <text x="65" y="34" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">V-2401E</text>
  </g>
  <text x="345" y="625" text-anchor="middle" font-family="monospace" font-size="9" fill="#E4E4E7">V-2401E</text>
  <!-- Condensate return line -->
  <path id="pipe-cond-return" d="M 280 585 L 200 585 L 200 280 L 210 280" stroke="#60A5FA" stroke-width="1.5" fill="none" stroke-dasharray="4,3" marker-end="url(#arr-b)"/>
  <text x="90" y="470" font-family="monospace" font-size="9" fill="#60A5FA">CONDENSATE</text>
  <text x="90" y="482" font-family="monospace" font-size="9" fill="#60A5FA">RETURN</text>

  <!-- ============ COMPRESSION SECTION ============ -->
  <text x="835" y="105" text-anchor="middle" font-family="monospace" font-size="12" fill="#34D399">— H2 COMPRESSION —</text>

  <!-- H2 from PSA enters -->
  <path id="pipe-h2-to-k2401" d="M 620 440 L 730 440" stroke="#34D399" stroke-width="2" fill="none" marker-end="url(#arr-g)"/>
  <text x="620" y="430" font-family="monospace" font-size="9" fill="#34D399">H2 FROM PSA</text>
  <text x="620" y="456" font-family="monospace" font-size="9" fill="#A1A1AA">99.9%+ / 5 bar</text>

  <!-- XV-0801 block valve -->
  <g id="valve-xv0801" transform="translate(730,424)">
    <polygon points="0,0 18,8 0,16" fill="none" stroke="#34D399" stroke-width="1.5"/>
    <polygon points="36,0 18,8 36,16" fill="none" stroke="#34D399" stroke-width="1.5"/>
    <line x1="18" y1="0" x2="18" y2="-10" stroke="#34D399" stroke-width="1.5"/>
    <rect x="10" y="-18" width="16" height="6" rx="1" fill="none" stroke="#34D399" stroke-width="1"/>
    <text x="18" y="-20" text-anchor="middle" font-family="monospace" font-size="8" fill="#34D399">XV-0801</text>
  </g>

  <!-- K-2401 H2 Compressor (large circle) -->
  <g id="compressor-k2401" transform="translate(800,360)">
    <circle cx="90" cy="90" r="90" fill="#18181B" stroke="#52525B" stroke-width="2"/>
    <!-- spokes -->
    <line x1="90" y1="90" x2="90" y2="18" stroke="#3F3F46" stroke-width="2" stroke-linecap="round"/>
    <line x1="90" y1="90" x2="152" y2="52" stroke="#3F3F46" stroke-width="2" stroke-linecap="round"/>
    <line x1="90" y1="90" x2="162" y2="115" stroke="#3F3F46" stroke-width="2" stroke-linecap="round"/>
    <line x1="90" y1="90" x2="90" y2="162" stroke="#3F3F46" stroke-width="2" stroke-linecap="round"/>
    <line x1="90" y1="90" x2="28" y2="128" stroke="#3F3F46" stroke-width="2" stroke-linecap="round"/>
    <line x1="90" y1="90" x2="18" y2="65" stroke="#3F3F46" stroke-width="2" stroke-linecap="round"/>
    <circle cx="90" cy="90" r="8" fill="#52525B"/>
    <text x="90" y="95" text-anchor="middle" font-family="monospace" font-size="11" fill="#E4E4E7">K-2401</text>
  </g>
  <text x="890" y="470" text-anchor="middle" font-family="monospace" font-size="11" fill="#E4E4E7">K-2401</text>
  <text x="890" y="484" text-anchor="middle" font-family="monospace" font-size="10" fill="#A1A1AA">H2 COMPRESSOR</text>
  <text x="890" y="498" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">3-STAGE RECIP</text>
  <!-- suction line -->
  <path d="M 766 440 L 800 440" stroke="#34D399" stroke-width="2" fill="none"/>
  <!-- discharge line -->
  <path id="pipe-k2401-out" d="M 980 450 L 1050 450" stroke="#34D399" stroke-width="2.5" fill="none"/>

  <!-- pipe-k2401-delivery export -->
  <path id="pipe-k2401-delivery" d="M 1050 450 L 1380 450" stroke="#34D399" stroke-width="2.5" fill="none" marker-end="url(#arr-g)"/>
  <text x="1215" y="440" text-anchor="middle" font-family="monospace" font-size="10" fill="#34D399">H2 EXPORT TO HCU</text>
  <text x="1215" y="466" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">150 bar / 38°C</text>
  <!-- Vibration sensor on compressor -->
  <text x="988" y="395" font-family="monospace" font-size="8" fill="#71717A">VIB-0801</text>
  <text x="988" y="407" font-family="monospace" font-size="8" fill="#71717A">VIB-0802</text>

  <!-- Interstage coolers (schematic) -->
  <rect x="820" y="510" width="140" height="40" rx="4" fill="#18181B" stroke="#52525B" stroke-width="1"/>
  <text x="890" y="527" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">INTERSTAGE COOLERS</text>
  <text x="890" y="541" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">E-K2401A/B/C (air)</text>

  <!-- ============ CW / UTILITIES ============ -->
  <text x="1215" y="105" text-anchor="middle" font-family="monospace" font-size="11" fill="#52525B">COOLING WATER</text>
  <!-- CW supply -->
  <path id="pipe-cw-supply" d="M 1050 160 L 1380 160" stroke="#3B82F6" stroke-width="2" fill="none" marker-end="url(#arr-b)"/>
  <text x="1215" y="152" text-anchor="middle" font-family="monospace" font-size="9" fill="#3B82F6">CW SUPPLY  32°C</text>
  <!-- CW return -->
  <path id="pipe-cw-return" d="M 1380 200 L 1050 200" stroke="#60A5FA" stroke-width="2" fill="none" marker-end="url(#arr-b)"/>
  <text x="1215" y="218" text-anchor="middle" font-family="monospace" font-size="9" fill="#60A5FA">CW RETURN  45°C</text>
  <!-- Cooling tower box -->
  <rect x="1100" y="250" width="230" height="120" rx="4" fill="#0F1629" stroke="#3B82F6" stroke-width="1.5"/>
  <text x="1215" y="275" text-anchor="middle" font-family="monospace" font-size="10" fill="#60A5FA">COOLING TOWER</text>
  <text x="1215" y="293" text-anchor="middle" font-family="monospace" font-size="9" fill="#3B82F6">CT-2401</text>
  <text x="1215" y="312" text-anchor="middle" font-family="monospace" font-size="9" fill="#52525B">INDUCED DRAFT</text>
  <text x="1215" y="327" text-anchor="middle" font-family="monospace" font-size="9" fill="#52525B">4 CELLS</text>
  <text x="1215" y="358" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">FLOW: 1200 m³/h</text>
  <line x1="1215" y1="250" x2="1215" y2="200" stroke="#3B82F6" stroke-width="1.5" fill="none"/>
  <line x1="1215" y1="370" x2="1215" y2="160" stroke="#3B82F6" stroke-width="1.5" fill="none" stroke-dasharray="4,3"/>

  <!-- Plant air / Instrument air -->
  <text x="1215" y="445" text-anchor="middle" font-family="monospace" font-size="11" fill="#52525B">INSTRUMENT AIR</text>
  <rect x="1100" y="460" width="230" height="80" rx="4" fill="#111113" stroke="#52525B" stroke-width="1"/>
  <text x="1215" y="484" text-anchor="middle" font-family="monospace" font-size="10" fill="#A1A1AA">IA / PA SYSTEM</text>
  <text x="1215" y="500" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">100 psig / -40°F DP</text>
  <text x="1215" y="516" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">DRYERS: DR-2401A/B</text>
  <!-- IA header -->
  <path d="M 1215 540 L 1215 580 L 1050 580" stroke="#A1A1AA" stroke-width="1.5" fill="none" stroke-dasharray="3,3"/>
  <text x="1130" y="572" font-family="monospace" font-size="8" fill="#71717A">IA HDR</text>

  <!-- Fuel gas / Flare -->
  <text x="1215" y="645" text-anchor="middle" font-family="monospace" font-size="11" fill="#52525B">FUEL GAS / FLARE</text>
  <rect x="1100" y="660" width="230" height="80" rx="4" fill="#111113" stroke="#52525B" stroke-width="1"/>
  <text x="1215" y="684" text-anchor="middle" font-family="monospace" font-size="10" fill="#A1A1AA">FUEL GAS HDR</text>
  <text x="1215" y="700" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">1.5 bar  /  38°C</text>
  <text x="1215" y="718" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">FLARE: FL-2401</text>
  <path d="M 1215 740 L 1215 770 L 1380 770" stroke="#F97316" stroke-width="1.5" fill="none" stroke-dasharray="4,3"/>
  <text x="1298" y="762" font-family="monospace" font-size="8" fill="#F97316">FLARE HDR</text>

  <!-- ============ EMISSIONS ============ -->
  <text x="1650" y="105" text-anchor="middle" font-family="monospace" font-size="11" fill="#52525B">EMISSIONS MONITOR</text>
  <rect x="1450" y="120" width="430" height="360" rx="4" fill="#0D0D0F" stroke="#27272A" stroke-width="1"/>
  <text x="1665" y="148" text-anchor="middle" font-family="monospace" font-size="11" fill="#E4E4E7">CEMS — CONTINUOUS EMISSIONS</text>
  <text x="1665" y="164" text-anchor="middle" font-family="monospace" font-size="11" fill="#E4E4E7">MONITORING SYSTEM</text>
  <text x="1665" y="186" text-anchor="middle" font-family="monospace" font-size="9" fill="#52525B">AI-0952 ANALYSER TRAIN</text>
  <!-- Emission data boxes -->
  <rect x="1470" y="200" width="90" height="60" rx="3" fill="#111113" stroke="#52525B" stroke-width="1"/>
  <text x="1515" y="218" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">NOx</text>
  <text x="1515" y="236" text-anchor="middle" font-family="monospace" font-size="12" fill="#E4E4E7">42</text>
  <text x="1515" y="252" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">mg/Nm³</text>
  <rect x="1575" y="200" width="90" height="60" rx="3" fill="#111113" stroke="#52525B" stroke-width="1"/>
  <text x="1620" y="218" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">SO₂</text>
  <text x="1620" y="236" text-anchor="middle" font-family="monospace" font-size="12" fill="#E4E4E7">8</text>
  <text x="1620" y="252" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">mg/Nm³</text>
  <rect x="1680" y="200" width="90" height="60" rx="3" fill="#111113" stroke="#52525B" stroke-width="1"/>
  <text x="1725" y="218" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">CO</text>
  <text x="1725" y="236" text-anchor="middle" font-family="monospace" font-size="12" fill="#E4E4E7">18</text>
  <text x="1725" y="252" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">mg/Nm³</text>
  <rect x="1785" y="200" width="90" height="60" rx="3" fill="#111113" stroke="#52525B" stroke-width="1"/>
  <text x="1830" y="218" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">OPACITY</text>
  <text x="1830" y="236" text-anchor="middle" font-family="monospace" font-size="12" fill="#E4E4E7">3</text>
  <text x="1830" y="252" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">%</text>
  <!-- Stack temp / O2 -->
  <rect x="1470" y="275" width="180" height="60" rx="3" fill="#111113" stroke="#52525B" stroke-width="1"/>
  <text x="1560" y="293" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">STACK TEMP</text>
  <text x="1560" y="311" text-anchor="middle" font-family="monospace" font-size="12" fill="#E4E4E7">185</text>
  <text x="1560" y="327" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">°C</text>
  <rect x="1665" y="275" width="180" height="60" rx="3" fill="#111113" stroke="#52525B" stroke-width="1"/>
  <text x="1755" y="293" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">EXCESS O₂</text>
  <text x="1755" y="311" text-anchor="middle" font-family="monospace" font-size="12" fill="#E4E4E7">3.2</text>
  <text x="1755" y="327" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">% vol</text>
  <!-- Limits -->
  <text x="1665" y="360" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">PERMIT LIMITS: NOx &lt;75  SO₂ &lt;50  CO &lt;100  OPACITY &lt;20%</text>
  <text x="1665" y="374" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">DATA LOGGER: DL-2401  REPORT: HOURLY / DAILY AVERAGE</text>
  <text x="1665" y="390" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">REFERENCE: EPA METHOD 19 / 40 CFR PART 75</text>
  <text x="1665" y="470" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">U24 STEAM/COMPRESSION REV.1</text>
</svg>$svg$,
  metadata = '{"width": 1920, "height": 1080}'::jsonb
WHERE id = '5a8987cc-22a8-46f9-a100-fb29c534f181';

-- ============================================================
-- 4. HCU Feed Preheat & Charge Heater
-- ============================================================
UPDATE design_objects
SET svg_data = $svg$<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080">
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#71717A"/></marker>
    <marker id="arr-g" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#34D399"/></marker>
    <marker id="arr-r" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#EF4444"/></marker>
    <marker id="arr-o" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#F97316"/></marker>
  </defs>
  <rect width="100%" height="100%" fill="#09090B"/>
  <text x="960" y="36" text-anchor="middle" font-family="monospace" font-size="18" font-weight="bold" fill="#E4E4E7">UNIT 25 HCU — FEED PREHEAT &amp; CHARGE HEATER</text>

  <!-- Zone dividers -->
  <line x1="230" y1="60" x2="230" y2="1020" stroke="#27272A" stroke-width="1" stroke-dasharray="3,5"/>
  <line x1="420" y1="60" x2="420" y2="1020" stroke="#27272A" stroke-width="1" stroke-dasharray="3,5"/>
  <line x1="980" y1="60" x2="980" y2="1020" stroke="#27272A" stroke-width="1" stroke-dasharray="3,5"/>
  <line x1="1280" y1="60" x2="1280" y2="1020" stroke="#27272A" stroke-width="1" stroke-dasharray="3,5"/>
  <text x="115" y="72" text-anchor="middle" font-family="monospace" font-size="10" fill="#52525B">FEED DRUM</text>
  <text x="325" y="72" text-anchor="middle" font-family="monospace" font-size="10" fill="#52525B">CHARGE PUMP</text>
  <text x="700" y="72" text-anchor="middle" font-family="monospace" font-size="10" fill="#52525B">FEED / EFFLUENT EXCHANGERS</text>
  <text x="1130" y="72" text-anchor="middle" font-family="monospace" font-size="10" fill="#52525B">CHARGE HEATER</text>
  <text x="1600" y="72" text-anchor="middle" font-family="monospace" font-size="10" fill="#52525B">REACTOR FEED</text>

  <!-- VGO Feed in -->
  <path id="pipe-feed-in" d="M 20 540 L 90 540" stroke="#71717A" stroke-width="2" fill="none" marker-end="url(#arr)"/>
  <text x="20" y="530" font-family="monospace" font-size="10" fill="#E4E4E7">VGO FEED</text>
  <text x="20" y="556" font-family="monospace" font-size="9" fill="#A1A1AA">370-520°C TBP</text>

  <!-- V-2501 Feed Drum -->
  <g id="vessel-v2501" transform="translate(90,430)">
    <rect width="80" height="220" rx="20" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <text x="40" y="90" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">FEED</text>
    <text x="40" y="104" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">DRUM</text>
    <!-- level gauge -->
    <rect x="62" y="20" width="12" height="180" rx="2" fill="#09090B" stroke="#52525B" stroke-width="1"/>
    <rect x="63" y="100" width="10" height="100" rx="1" fill="#3B82F6" opacity="0.5"/>
    <text x="74" y="218" font-family="monospace" font-size="7" fill="#52525B">LG</text>
  </g>
  <text x="130" y="666" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">V-2501</text>
  <text x="130" y="678" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">FEED SURGE DRUM</text>
  <text x="130" y="690" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">10 bar / 150°C</text>

  <!-- pipe-vgo-to-pump bottom of drum to pump -->
  <path id="pipe-vgo-to-pump" d="M 170 650 L 230 650 L 280 650" stroke="#71717A" stroke-width="2" fill="none"/>

  <!-- P-2501A Charge Pump -->
  <g id="pump-p2501a" transform="translate(280,620)">
    <circle cx="35" cy="35" r="35" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <line x1="35" y1="35" x2="35" y2="8" stroke="#3F3F46" stroke-width="1.5"/>
    <line x1="35" y1="35" x2="58" y2="22" stroke="#3F3F46" stroke-width="1.5"/>
    <line x1="35" y1="35" x2="58" y2="48" stroke="#3F3F46" stroke-width="1.5"/>
    <line x1="35" y1="35" x2="35" y2="62" stroke="#3F3F46" stroke-width="1.5"/>
    <line x1="35" y1="35" x2="12" y2="48" stroke="#3F3F46" stroke-width="1.5"/>
    <line x1="35" y1="35" x2="12" y2="22" stroke="#3F3F46" stroke-width="1.5"/>
    <circle cx="35" cy="35" r="5" fill="#52525B"/>
  </g>
  <text x="315" y="710" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">P-2501A</text>
  <text x="315" y="722" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">CHARGE PUMP</text>
  <text x="315" y="734" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">1800 psig / 150°C</text>

  <!-- pipe-pump-to-hx -->
  <path id="pipe-pump-to-hx" d="M 350 650 L 420 650" stroke="#71717A" stroke-width="2" fill="none"/>

  <!-- Hot effluent return line (top) at y=320 -->
  <text x="700" y="298" text-anchor="middle" font-family="monospace" font-size="9" fill="#EF4444">← HOT EFFLUENT RETURN  400°C</text>
  <path d="M 420 320 L 980 320" stroke="#EF4444" stroke-width="2" fill="none"/>

  <!-- E-2501 F/E HX 1 -->
  <g id="hx-e2501" transform="translate(420,620)">
    <rect width="100" height="55" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <ellipse cx="22" cy="27" rx="11" ry="19" fill="none" stroke="#3F3F46" stroke-width="1"/>
    <line x1="33" y1="27" x2="67" y2="27" stroke="#3F3F46" stroke-width="1"/>
    <ellipse cx="78" cy="27" rx="11" ry="19" fill="none" stroke="#3F3F46" stroke-width="1"/>
    <!-- hot/cold arrows -->
    <path d="M 22 0 L 22 -15" stroke="#EF4444" stroke-width="1.5" fill="none" marker-end="url(#arr-r)"/>
    <path d="M 78 55 L 78 70" stroke="#EF4444" stroke-width="1.5" fill="none" marker-end="url(#arr-r)"/>
  </g>
  <text x="470" y="693" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">E-2501</text>
  <text x="470" y="705" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">F/E HX  1</text>
  <!-- connect hot return to HX top -->
  <line x1="470" y1="320" x2="470" y2="620" stroke="#EF4444" stroke-width="1.5" stroke-dasharray="4,3"/>
  <!-- cold feed through -->
  <path d="M 520 648 L 580 648" stroke="#71717A" stroke-width="2" fill="none"/>

  <!-- E-2503 F/E HX 2 -->
  <g id="hx-e2503" transform="translate(580,620)">
    <rect width="100" height="55" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <ellipse cx="22" cy="27" rx="11" ry="19" fill="none" stroke="#3F3F46" stroke-width="1"/>
    <line x1="33" y1="27" x2="67" y2="27" stroke="#3F3F46" stroke-width="1"/>
    <ellipse cx="78" cy="27" rx="11" ry="19" fill="none" stroke="#3F3F46" stroke-width="1"/>
    <path d="M 22 0 L 22 -15" stroke="#EF4444" stroke-width="1.5" fill="none" marker-end="url(#arr-r)"/>
    <path d="M 78 55 L 78 70" stroke="#EF4444" stroke-width="1.5" fill="none" marker-end="url(#arr-r)"/>
  </g>
  <text x="630" y="693" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">E-2503</text>
  <text x="630" y="705" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">F/E HX  2</text>
  <line x1="630" y1="320" x2="630" y2="620" stroke="#EF4444" stroke-width="1.5" stroke-dasharray="4,3"/>
  <path d="M 680 648 L 740 648" stroke="#71717A" stroke-width="2" fill="none"/>

  <!-- E-2504 F/E HX 3 -->
  <g id="hx-e2504" transform="translate(740,620)">
    <rect width="100" height="55" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <ellipse cx="22" cy="27" rx="11" ry="19" fill="none" stroke="#3F3F46" stroke-width="1"/>
    <line x1="33" y1="27" x2="67" y2="27" stroke="#3F3F46" stroke-width="1"/>
    <ellipse cx="78" cy="27" rx="11" ry="19" fill="none" stroke="#3F3F46" stroke-width="1"/>
    <path d="M 22 0 L 22 -15" stroke="#EF4444" stroke-width="1.5" fill="none" marker-end="url(#arr-r)"/>
    <path d="M 78 55 L 78 70" stroke="#EF4444" stroke-width="1.5" fill="none" marker-end="url(#arr-r)"/>
  </g>
  <text x="790" y="693" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">E-2504</text>
  <text x="790" y="705" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">F/E HX  3</text>
  <line x1="790" y1="320" x2="790" y2="620" stroke="#EF4444" stroke-width="1.5" stroke-dasharray="4,3"/>
  <path d="M 840 648 L 900 648" stroke="#71717A" stroke-width="2" fill="none"/>

  <!-- E-2505 F/E HX 4 -->
  <g id="hx-e2505" transform="translate(900,620)">
    <rect width="100" height="55" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <ellipse cx="22" cy="27" rx="11" ry="19" fill="none" stroke="#3F3F46" stroke-width="1"/>
    <line x1="33" y1="27" x2="67" y2="27" stroke="#3F3F46" stroke-width="1"/>
    <ellipse cx="78" cy="27" rx="11" ry="19" fill="none" stroke="#3F3F46" stroke-width="1"/>
    <path d="M 22 0 L 22 -15" stroke="#EF4444" stroke-width="1.5" fill="none" marker-end="url(#arr-r)"/>
    <path d="M 78 55 L 78 70" stroke="#EF4444" stroke-width="1.5" fill="none" marker-end="url(#arr-r)"/>
  </g>
  <text x="950" y="693" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">E-2505</text>
  <text x="950" y="705" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">F/E HX  4</text>
  <line x1="950" y1="320" x2="950" y2="620" stroke="#EF4444" stroke-width="1.5" stroke-dasharray="4,3"/>
  <path d="M 1000 648 L 1050 648" stroke="#71717A" stroke-width="2" fill="none"/>
  <!-- temp label after last HX -->
  <text x="1000" y="638" font-family="monospace" font-size="9" fill="#71717A">~320°C</text>

  <!-- Recycle H2 mixes with feed before heater -->
  <path id="pipe-recycle-h2-in" d="M 1920 450 L 1300 450 L 1300 648 L 1050 648" stroke="#34D399" stroke-width="2" fill="none" marker-end="url(#arr-g)"/>
  <text x="1600" y="440" text-anchor="middle" font-family="monospace" font-size="10" fill="#34D399">RECYCLE H2 IN</text>
  <text x="1600" y="456" text-anchor="middle" font-family="monospace" font-size="9" fill="#6EE7B7">150 bar / 38°C</text>
  <!-- Mix point -->
  <circle cx="1050" cy="648" r="6" fill="#27272A" stroke="#34D399" stroke-width="1.5"/>
  <text x="1050" y="668" text-anchor="middle" font-family="monospace" font-size="8" fill="#A1A1AA">MIX</text>

  <!-- pipe-hx-to-heater -->
  <path id="pipe-hx-to-heater" d="M 1056 648 L 1100 648" stroke="#71717A" stroke-width="2" fill="none"/>
  <!-- Temp label -->
  <text x="1075" y="638" font-family="monospace" font-size="9" fill="#A1A1AA">~330°C</text>

  <!-- H-2501 Charge Heater -->
  <g id="heater-h2501" transform="translate(1100,420)">
    <!-- Conv section -->
    <rect width="180" height="60" fill="#1C1917" stroke="#78350F" stroke-width="1.5"/>
    <text x="90" y="22" text-anchor="middle" font-family="monospace" font-size="9" fill="#D97706">CONVECTION</text>
    <text x="90" y="38" text-anchor="middle" font-family="monospace" font-size="9" fill="#D97706">SECTION</text>
    <!-- Firebox -->
    <rect y="60" width="180" height="270" fill="#1C1917" stroke="#B45309" stroke-width="2"/>
    <text x="90" y="90" text-anchor="middle" font-family="monospace" font-size="14" fill="#F59E0B">H-2501</text>
    <text x="90" y="108" text-anchor="middle" font-family="monospace" font-size="10" fill="#D97706">CHARGE HEATER</text>
    <text x="90" y="124" text-anchor="middle" font-family="monospace" font-size="9" fill="#92400E">40 MMBTU/hr</text>
    <!-- Tubes -->
    <line x1="35" y1="138" x2="35" y2="310" stroke="#78350F" stroke-width="2" stroke-dasharray="4,3"/>
    <line x1="65" y1="138" x2="65" y2="310" stroke="#78350F" stroke-width="2" stroke-dasharray="4,3"/>
    <line x1="95" y1="138" x2="95" y2="310" stroke="#78350F" stroke-width="2" stroke-dasharray="4,3"/>
    <line x1="125" y1="138" x2="125" y2="310" stroke="#78350F" stroke-width="2" stroke-dasharray="4,3"/>
    <line x1="155" y1="138" x2="155" y2="310" stroke="#78350F" stroke-width="2" stroke-dasharray="4,3"/>
    <!-- Flames -->
    <path d="M 30 320 Q 38 302 42 316 Q 46 300 50 316 Q 54 302 47 320 Z" fill="#F97316" opacity="0.8"/>
    <path d="M 58 320 Q 66 302 70 316 Q 74 300 78 316 Q 82 302 75 320 Z" fill="#F97316" opacity="0.8"/>
    <path d="M 86 320 Q 94 302 98 316 Q 102 300 106 316 Q 110 302 103 320 Z" fill="#F97316" opacity="0.8"/>
    <path d="M 114 320 Q 122 302 126 316 Q 130 300 134 316 Q 138 302 131 320 Z" fill="#F97316" opacity="0.8"/>
    <path d="M 142 320 Q 150 302 154 316 Q 158 300 162 316 Q 166 302 159 320 Z" fill="#F97316" opacity="0.8"/>
    <!-- Outlet temp label -->
    <text x="90" y="350" text-anchor="middle" font-family="monospace" font-size="9" fill="#F59E0B">OUTLET: ~390°C</text>
    <text x="90" y="364" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">TI-H2501-OUT</text>
  </g>
  <text x="1190" y="790" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">H-2501 CHARGE HEATER</text>

  <!-- Flue gas / Stack -->
  <rect x="1180" y="100" width="20" height="310" fill="#27272A" stroke="#52525B" stroke-width="1.5"/>
  <rect x="1168" y="398" width="44" height="14" rx="2" fill="#27272A" stroke="#52525B" stroke-width="1"/>
  <text x="1190" y="95" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">STACK</text>
  <path d="M 1190 410 L 1190 480 L 1280 480 L 1280 648" stroke="#EF4444" stroke-width="1.5" fill="none" stroke-dasharray="6,3"/>
  <text x="1238" y="472" text-anchor="middle" font-family="monospace" font-size="8" fill="#EF4444">FLUE GAS</text>

  <!-- Fuel to burners -->
  <path d="M 1190 800 L 1190 870 L 1060 870 L 1060 800" stroke="#F97316" stroke-width="1.5" fill="none" marker-end="url(#arr-o)"/>
  <text x="1190" y="890" text-anchor="middle" font-family="monospace" font-size="9" fill="#F97316">FUEL GAS TO BURNERS</text>
  <path d="M 1060 870 L 980 870 L 980 940 L 20 940" stroke="#F97316" stroke-width="1.5" fill="none" marker-end="url(#arr-o)"/>
  <text x="500" y="932" font-family="monospace" font-size="9" fill="#F97316">FUEL GAS HEADER</text>

  <!-- pipe-heater-to-r2501 -->
  <path id="pipe-heater-to-r2501" d="M 1280 648 L 1920 648" stroke="#EF4444" stroke-width="2.5" fill="none" marker-end="url(#arr-r)"/>
  <text x="1600" y="638" text-anchor="middle" font-family="monospace" font-size="10" fill="#EF4444">TO R-2501 REACTOR</text>
  <text x="1600" y="664" text-anchor="middle" font-family="monospace" font-size="9" fill="#F87171">390°C  /  150 bar</text>

  <!-- Temp / pressure indicators -->
  <rect x="1310" y="600" width="60" height="30" rx="2" fill="#111113" stroke="#52525B" stroke-width="1"/>
  <text x="1340" y="613" text-anchor="middle" font-family="monospace" font-size="7" fill="#71717A">TI-H2501</text>
  <text x="1340" y="624" text-anchor="middle" font-family="monospace" font-size="9" fill="#E4E4E7">390°C</text>
  <rect x="1400" y="600" width="60" height="30" rx="2" fill="#111113" stroke="#52525B" stroke-width="1"/>
  <text x="1430" y="613" text-anchor="middle" font-family="monospace" font-size="7" fill="#71717A">PI-H2501</text>
  <text x="1430" y="624" text-anchor="middle" font-family="monospace" font-size="9" fill="#E4E4E7">148 bar</text>

  <!-- Legend -->
  <rect x="20" y="790" width="200" height="130" rx="3" fill="#0F0F11" stroke="#27272A" stroke-width="1"/>
  <text x="120" y="810" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">LEGEND</text>
  <line x1="32" y1="826" x2="68" y2="826" stroke="#71717A" stroke-width="2"/><text x="78" y="830" font-family="monospace" font-size="8" fill="#A1A1AA">Feed / Process</text>
  <line x1="32" y1="844" x2="68" y2="844" stroke="#EF4444" stroke-width="2"/><text x="78" y="848" font-family="monospace" font-size="8" fill="#A1A1AA">Hot Effluent</text>
  <line x1="32" y1="862" x2="68" y2="862" stroke="#34D399" stroke-width="2"/><text x="78" y="866" font-family="monospace" font-size="8" fill="#A1A1AA">Recycle H2</text>
  <line x1="32" y1="880" x2="68" y2="880" stroke="#F97316" stroke-width="2"/><text x="78" y="884" font-family="monospace" font-size="8" fill="#A1A1AA">Fuel Gas</text>
  <text x="120" y="910" text-anchor="middle" font-family="monospace" font-size="7" fill="#52525B">U25 FEED PREHEAT REV.1</text>
</svg>$svg$,
  bindings = '{}'::jsonb,
  metadata = '{"width": 1920, "height": 1080}'::jsonb
WHERE id = 'b665f179-a8ca-459d-9fc0-4200572e8298';

-- ============================================================
-- 5. HCU Fractionator
-- ============================================================
UPDATE design_objects
SET svg_data = $svg$<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080">
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#71717A"/></marker>
    <marker id="arr-g" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#34D399"/></marker>
    <marker id="arr-b" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#60A5FA"/></marker>
  </defs>
  <rect width="100%" height="100%" fill="#09090B"/>
  <text x="960" y="36" text-anchor="middle" font-family="monospace" font-size="18" font-weight="bold" fill="#E4E4E7">UNIT 25 HCU — FRACTIONATOR C-2502</text>

  <!-- Feed from HP Sep -->
  <path id="pipe-feed-c2502" d="M 20 560 L 200 560" stroke="#71717A" stroke-width="2" fill="none" marker-end="url(#arr)"/>
  <text x="20" y="550" font-family="monospace" font-size="10" fill="#E4E4E7">FEED FROM HP SEP</text>
  <text x="20" y="574" font-family="monospace" font-size="9" fill="#A1A1AA">~280°C / 4 bar</text>

  <!-- C-2502 Main Fractionator column -->
  <g id="column-c2502" transform="translate(200,100)">
    <!-- Column shell -->
    <rect width="120" height="880" rx="10" fill="#18181B" stroke="#52525B" stroke-width="2"/>
    <!-- Column title -->
    <text x="60" y="30" text-anchor="middle" font-family="monospace" font-size="12" fill="#E4E4E7">C-2502</text>
    <text x="60" y="46" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">FRACTIONATOR</text>
    <!-- Trays schematic lines -->
    <line x1="0" y1="130" x2="120" y2="130" stroke="#27272A" stroke-width="1"/>
    <line x1="0" y1="210" x2="120" y2="210" stroke="#27272A" stroke-width="1"/>
    <line x1="0" y1="310" x2="120" y2="310" stroke="#27272A" stroke-width="1"/>
    <line x1="0" y1="430" x2="120" y2="430" stroke="#27272A" stroke-width="1"/>
    <line x1="0" y1="550" x2="120" y2="550" stroke="#27272A" stroke-width="1"/>
    <line x1="0" y1="650" x2="120" y2="650" stroke="#27272A" stroke-width="1"/>
    <line x1="0" y1="750" x2="120" y2="750" stroke="#27272A" stroke-width="1"/>
    <!-- Tray counts -->
    <text x="60" y="175" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">Trays 60-70</text>
    <text x="60" y="265" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">Trays 45-59</text>
    <text x="60" y="375" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">Trays 28-44</text>
    <text x="60" y="495" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">Trays 16-27</text>
    <text x="60" y="605" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">Trays 6-15</text>
    <text x="60" y="705" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">Trays 1-5</text>
    <!-- Feed nozzle (tray 14 area ~ y=560) -->
    <line x1="-20" y1="455" x2="0" y2="455" stroke="#71717A" stroke-width="2"/>
    <!-- Bottom -->
    <rect x="10" y="830" width="100" height="40" rx="5" fill="#27272A" opacity="0.4"/>
    <text x="60" y="855" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">BOTTOMS</text>
  </g>

  <!-- ── OVERHEAD SYSTEM (top) ── -->
  <!-- pipe-overhead: overhead vapor from top of column -->
  <path id="pipe-overhead" d="M 260 100 L 260 60 L 520 60" stroke="#71717A" stroke-width="2" fill="none"/>
  <!-- Condenser E-2509 -->
  <g transform="translate(520,38)">
    <rect width="90" height="45" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <ellipse cx="20" cy="22" rx="10" ry="16" fill="none" stroke="#3F3F46" stroke-width="1"/>
    <line x1="30" y1="22" x2="60" y2="22" stroke="#3F3F46" stroke-width="1"/>
    <ellipse cx="70" cy="22" rx="10" ry="16" fill="none" stroke="#3F3F46" stroke-width="1"/>
  </g>
  <text x="565" y="98" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">E-2509 COND</text>
  <path d="M 610 60 L 700 60" stroke="#71717A" stroke-width="2" fill="none"/>
  <!-- V-2504 Reflux Drum -->
  <g id="vessel-v2504" transform="translate(700,40)">
    <rect width="130" height="45" rx="22" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <text x="65" y="18" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">V-2504</text>
    <text x="65" y="32" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">REFL DRUM</text>
  </g>
  <text x="765" y="100" text-anchor="middle" font-family="monospace" font-size="9" fill="#E4E4E7">V-2504</text>
  <!-- pipe-lpg-out from reflux drum top -->
  <path id="pipe-lpg-out" d="M 765 40 L 765 20 L 920 20" stroke="#71717A" stroke-width="2" fill="none" marker-end="url(#arr)"/>
  <text x="840" y="14" font-family="monospace" font-size="10" fill="#E4E4E7">LPG / OFF-GAS</text>
  <!-- P-2503 reflux pump -->
  <g id="pump-p2503" transform="translate(740,105)">
    <circle cx="22" cy="22" r="22" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <line x1="22" y1="22" x2="22" y2="5" stroke="#3F3F46" stroke-width="1.5"/>
    <line x1="22" y1="22" x2="37" y2="13" stroke="#3F3F46" stroke-width="1.5"/>
    <line x1="22" y1="22" x2="37" y2="31" stroke="#3F3F46" stroke-width="1.5"/>
    <line x1="22" y1="22" x2="22" y2="39" stroke="#3F3F46" stroke-width="1.5"/>
    <line x1="22" y1="22" x2="7" y2="31" stroke="#3F3F46" stroke-width="1.5"/>
    <line x1="22" y1="22" x2="7" y2="13" stroke="#3F3F46" stroke-width="1.5"/>
    <circle cx="22" cy="22" r="4" fill="#52525B"/>
  </g>
  <text x="762" y="145" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">P-2503</text>
  <!-- pipe-reflux back to column -->
  <path id="pipe-reflux" d="M 740 127 L 320 127 L 320 200" stroke="#71717A" stroke-width="1.5" fill="none" stroke-dasharray="4,3" marker-end="url(#arr)"/>
  <text x="530" y="120" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">REFLUX</text>

  <!-- ── PRODUCT DRAWS (right side) ── -->
  <!-- Light Naphtha draw tray ~55 → y~230 -->
  <path id="pipe-ln-out" d="M 320 230 L 920 230" stroke="#71717A" stroke-width="2" fill="none" marker-end="url(#arr)"/>
  <text x="550" y="220" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">LIGHT NAPHTHA</text>
  <text x="550" y="244" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">IBP-90°C  LN-2502</text>

  <!-- Heavy Naphtha draw tray ~40 → y~340 -->
  <path id="pipe-hn-out" d="M 320 340 L 920 340" stroke="#71717A" stroke-width="2" fill="none" marker-end="url(#arr)"/>
  <text x="550" y="330" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">HEAVY NAPHTHA</text>
  <text x="550" y="354" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">90-165°C  P-2504A</text>
  <!-- HN pumparound -->
  <path d="M 920 340 L 980 340 L 980 280 L 320 280 L 320 310" stroke="#A1A1AA" stroke-width="1" fill="none" stroke-dasharray="3,3"/>
  <text x="650" y="274" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">HN PUMPAROUND (E-2510)</text>

  <!-- Kerosene draw tray ~25 → y~465 -->
  <path id="pipe-kero-out" d="M 320 465 L 920 465" stroke="#71717A" stroke-width="2" fill="none" marker-end="url(#arr)"/>
  <text x="550" y="455" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">KEROSENE / JET</text>
  <text x="550" y="479" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">165-260°C  P-2505A</text>
  <!-- Kero pumparound -->
  <path d="M 920 465 L 980 465 L 980 395 L 320 395 L 320 435" stroke="#A1A1AA" stroke-width="1" fill="none" stroke-dasharray="3,3"/>
  <text x="650" y="389" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">KERO PUMPAROUND (E-2511)</text>

  <!-- Diesel draw tray ~12 → y~590 -->
  <path id="pipe-diesel-out" d="M 320 590 L 920 590" stroke="#71717A" stroke-width="2" fill="none" marker-end="url(#arr)"/>
  <text x="550" y="580" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">DIESEL</text>
  <text x="550" y="604" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">260-360°C  P-2505B</text>
  <!-- Diesel pumparound -->
  <path d="M 920 590 L 980 590 L 980 520 L 320 520 L 320 560" stroke="#A1A1AA" stroke-width="1" fill="none" stroke-dasharray="3,3"/>
  <text x="650" y="514" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">DIESEL PUMPAROUND (E-2512)</text>

  <!-- UCO bottom → P-2506 -->
  <path id="pipe-uco-out" d="M 320 990 L 920 990" stroke="#71717A" stroke-width="2" fill="none" marker-end="url(#arr)"/>
  <text x="550" y="980" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">UCO (UNCONVERTED OIL)</text>
  <text x="550" y="1004" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">360+°C  → RECYCLE OR EXPORT</text>
  <!-- P-2506 UCO pump -->
  <g id="pump-p2506" transform="translate(395,1010)">
    <circle cx="22" cy="22" r="22" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <line x1="22" y1="22" x2="22" y2="5" stroke="#3F3F46" stroke-width="1.5"/>
    <line x1="22" y1="22" x2="37" y2="13" stroke="#3F3F46" stroke-width="1.5"/>
    <line x1="22" y1="22" x2="37" y2="31" stroke="#3F3F46" stroke-width="1.5"/>
    <line x1="22" y1="22" x2="22" y2="39" stroke="#3F3F46" stroke-width="1.5"/>
    <line x1="22" y1="22" x2="7" y2="31" stroke="#3F3F46" stroke-width="1.5"/>
    <line x1="22" y1="22" x2="7" y2="13" stroke="#3F3F46" stroke-width="1.5"/>
    <circle cx="22" cy="22" r="4" fill="#52525B"/>
  </g>
  <text x="417" y="1052" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">P-2506</text>

  <!-- Stripping steam at bottom -->
  <path d="M 200 900 L 200 940 L 200 980" stroke="#60A5FA" stroke-width="1.5" fill="none" stroke-dasharray="5,3" marker-end="url(#arr-b)"/>
  <text x="165" y="940" font-family="monospace" font-size="8" fill="#60A5FA">LP STM</text>
  <text x="165" y="954" font-family="monospace" font-size="8" fill="#60A5FA">STRIP</text>

  <!-- Reboiler circuit -->
  <path d="M 200 850 L 130 850 L 130 950 L 200 950" stroke="#EF4444" stroke-width="1.5" fill="none" stroke-dasharray="4,3"/>
  <rect x="80" y="870" width="50" height="60" rx="3" fill="#18181B" stroke="#78350F" stroke-width="1"/>
  <text x="105" y="903" text-anchor="middle" font-family="monospace" font-size="7" fill="#D97706">E-REB</text>
  <text x="105" y="915" text-anchor="middle" font-family="monospace" font-size="7" fill="#71717A">REBOILER</text>

  <!-- Product summary panel -->
  <rect x="960" y="90" width="940" height="890" rx="4" fill="#0D0D0F" stroke="#27272A" stroke-width="1"/>
  <text x="1430" y="115" text-anchor="middle" font-family="monospace" font-size="13" fill="#E4E4E7">PRODUCT SUMMARY</text>
  <line x1="980" y1="125" x2="1880" y2="125" stroke="#27272A" stroke-width="1"/>
  <!-- Headers -->
  <text x="1060" y="148" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">PRODUCT</text>
  <text x="1200" y="148" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">FLOW</text>
  <text x="1320" y="148" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">TEMP</text>
  <text x="1440" y="148" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">SPEC</text>
  <text x="1620" y="148" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">DEST</text>
  <line x1="980" y1="155" x2="1880" y2="155" stroke="#27272A" stroke-width="1"/>
  <!-- LPG row -->
  <text x="1060" y="178" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">LPG</text>
  <text x="1200" y="178" text-anchor="middle" font-family="monospace" font-size="10" fill="#A1A1AA">12 m³/h</text>
  <text x="1320" y="178" text-anchor="middle" font-family="monospace" font-size="10" fill="#A1A1AA">45°C</text>
  <text x="1440" y="178" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">C3/C4 purity</text>
  <text x="1620" y="178" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">LPG BULLETS</text>
  <!-- LN row -->
  <text x="1060" y="208" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">LT NAPHTHA</text>
  <text x="1200" y="208" text-anchor="middle" font-family="monospace" font-size="10" fill="#A1A1AA">28 m³/h</text>
  <text x="1320" y="208" text-anchor="middle" font-family="monospace" font-size="10" fill="#A1A1AA">62°C</text>
  <text x="1440" y="208" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">IBP-90°C</text>
  <text x="1620" y="208" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">ISOMERIZATION</text>
  <!-- HN row -->
  <text x="1060" y="238" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">HVY NAPHTHA</text>
  <text x="1200" y="238" text-anchor="middle" font-family="monospace" font-size="10" fill="#A1A1AA">52 m³/h</text>
  <text x="1320" y="238" text-anchor="middle" font-family="monospace" font-size="10" fill="#A1A1AA">128°C</text>
  <text x="1440" y="238" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">90-165°C</text>
  <text x="1620" y="238" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">REFORMER FEED</text>
  <!-- Kero row -->
  <text x="1060" y="268" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">KEROSENE</text>
  <text x="1200" y="268" text-anchor="middle" font-family="monospace" font-size="10" fill="#A1A1AA">76 m³/h</text>
  <text x="1320" y="268" text-anchor="middle" font-family="monospace" font-size="10" fill="#A1A1AA">195°C</text>
  <text x="1440" y="268" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">Freeze &lt;-47°C</text>
  <text x="1620" y="268" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">BLEND / EXPORT</text>
  <!-- Diesel row -->
  <text x="1060" y="298" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">DIESEL</text>
  <text x="1200" y="298" text-anchor="middle" font-family="monospace" font-size="10" fill="#A1A1AA">142 m³/h</text>
  <text x="1320" y="298" text-anchor="middle" font-family="monospace" font-size="10" fill="#A1A1AA">298°C</text>
  <text x="1440" y="298" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">D-86 95% &lt;370°C</text>
  <text x="1620" y="298" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">ULTRA-LOW SULFUR</text>
  <!-- UCO row -->
  <text x="1060" y="328" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">UCO</text>
  <text x="1200" y="328" text-anchor="middle" font-family="monospace" font-size="10" fill="#A1A1AA">38 m³/h</text>
  <text x="1320" y="328" text-anchor="middle" font-family="monospace" font-size="10" fill="#A1A1AA">340°C</text>
  <text x="1440" y="328" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">360+°C</text>
  <text x="1620" y="328" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">2nd PASS / EXPORT</text>
  <line x1="980" y1="340" x2="1880" y2="340" stroke="#27272A" stroke-width="1"/>
  <!-- Column operating conditions -->
  <text x="1430" y="375" text-anchor="middle" font-family="monospace" font-size="11" fill="#71717A">COLUMN OPERATING CONDITIONS</text>
  <rect x="980" y="390" width="420" height="170" rx="3" fill="#111113" stroke="#27272A" stroke-width="1"/>
  <text x="1190" y="415" text-anchor="middle" font-family="monospace" font-size="10" fill="#A1A1AA">OVERHEAD</text>
  <text x="1190" y="435" text-anchor="middle" font-family="monospace" font-size="12" fill="#E4E4E7">118°C</text>
  <text x="1190" y="451" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">3.5 bar</text>
  <text x="1190" y="476" text-anchor="middle" font-family="monospace" font-size="10" fill="#A1A1AA">BOTTOMS</text>
  <text x="1190" y="496" text-anchor="middle" font-family="monospace" font-size="12" fill="#E4E4E7">368°C</text>
  <text x="1190" y="512" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">3.8 bar</text>
  <text x="1190" y="540" text-anchor="middle" font-family="monospace" font-size="9" fill="#52525B">70 trays total (valve trays)</text>
  <text x="1190" y="554" text-anchor="middle" font-family="monospace" font-size="9" fill="#52525B">Dia: 4.5m  Ht: 52m</text>
  <!-- Pumparound duties -->
  <rect x="1420" y="390" width="440" height="170" rx="3" fill="#111113" stroke="#27272A" stroke-width="1"/>
  <text x="1640" y="415" text-anchor="middle" font-family="monospace" font-size="10" fill="#A1A1AA">PUMPAROUND DUTIES</text>
  <text x="1520" y="440" font-family="monospace" font-size="9" fill="#71717A">HN PA (E-2510):</text>
  <text x="1730" y="440" text-anchor="end" font-family="monospace" font-size="9" fill="#E4E4E7">18 MMBTU/hr</text>
  <text x="1520" y="460" font-family="monospace" font-size="9" fill="#71717A">Kero PA (E-2511):</text>
  <text x="1730" y="460" text-anchor="end" font-family="monospace" font-size="9" fill="#E4E4E7">28 MMBTU/hr</text>
  <text x="1520" y="480" font-family="monospace" font-size="9" fill="#71717A">Diesel PA (E-2512):</text>
  <text x="1730" y="480" text-anchor="end" font-family="monospace" font-size="9" fill="#E4E4E7">42 MMBTU/hr</text>
  <text x="1520" y="510" font-family="monospace" font-size="9" fill="#71717A">Reboiler (E-REB):</text>
  <text x="1730" y="510" text-anchor="end" font-family="monospace" font-size="9" fill="#E4E4E7">14 MMBTU/hr</text>
  <text x="1640" y="550" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">Feed rate: 348 m³/h  Design: 420 m³/h</text>
  <text x="1430" y="620" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">U25 FRACTIONATOR REV.1</text>
</svg>$svg$,
  bindings = '{}'::jsonb,
  metadata = '{"width": 1920, "height": 1080}'::jsonb
WHERE id = '4abe4d89-2c19-4866-8391-156e79d0a0ae';

-- ============================================================
-- 6. HCU HP Separation
-- ============================================================
UPDATE design_objects
SET svg_data = $svg$<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080">
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#71717A"/></marker>
    <marker id="arr-g" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#34D399"/></marker>
    <marker id="arr-b" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#60A5FA"/></marker>
  </defs>
  <rect width="100%" height="100%" fill="#09090B"/>
  <text x="960" y="36" text-anchor="middle" font-family="monospace" font-size="18" font-weight="bold" fill="#E4E4E7">UNIT 25 HCU — HIGH PRESSURE SEPARATION</text>

  <!-- Zone dividers -->
  <line x1="300" y1="60" x2="300" y2="1040" stroke="#27272A" stroke-width="1" stroke-dasharray="3,5"/>
  <line x1="740" y1="60" x2="740" y2="1040" stroke="#27272A" stroke-width="1" stroke-dasharray="3,5"/>
  <line x1="1200" y1="60" x2="1200" y2="1040" stroke="#27272A" stroke-width="1" stroke-dasharray="3,5"/>
  <text x="150" y="72" text-anchor="middle" font-family="monospace" font-size="10" fill="#52525B">EFFLUENT COOLING</text>
  <text x="520" y="72" text-anchor="middle" font-family="monospace" font-size="10" fill="#52525B">HP SEPARATION</text>
  <text x="970" y="72" text-anchor="middle" font-family="monospace" font-size="10" fill="#52525B">RGC / AMINE</text>
  <text x="1560" y="72" text-anchor="middle" font-family="monospace" font-size="10" fill="#52525B">TO FRACTIONATION</text>

  <!-- Reactor effluent in -->
  <path id="pipe-reactor-eff" d="M 20 200 L 100 200" stroke="#EF4444" stroke-width="2.5" fill="none" marker-end="url(#arr)"/>
  <text x="20" y="190" font-family="monospace" font-size="10" fill="#EF4444">REACTOR EFFLUENT</text>
  <text x="20" y="214" font-family="monospace" font-size="9" fill="#F87171">410°C / 145 bar</text>

  <!-- Wash water injection -->
  <path d="M 120 140 L 120 200" stroke="#60A5FA" stroke-width="1.5" fill="none" stroke-dasharray="4,3" marker-end="url(#arr-b)"/>
  <text x="130" y="155" font-family="monospace" font-size="8" fill="#60A5FA">WASH WATER</text>
  <text x="130" y="167" font-family="monospace" font-size="8" fill="#60A5FA">INJECTION</text>

  <!-- E-2507 Air Cooler (wide flat rect at top) -->
  <g id="cooler-e2507" transform="translate(100,130)">
    <rect width="500" height="100" rx="4" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <text x="250" y="38" text-anchor="middle" font-family="monospace" font-size="11" fill="#E4E4E7">E-2507 AIR COOLER</text>
    <text x="250" y="56" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">EFLUENT COOLING: 410 → 55°C</text>
    <!-- Fan symbols -->
    <circle cx="90" cy="78" r="16" fill="none" stroke="#3F3F46" stroke-width="1"/>
    <line x1="90" y1="62" x2="90" y2="94" stroke="#3F3F46" stroke-width="1.5"/>
    <line x1="74" y1="78" x2="106" y2="78" stroke="#3F3F46" stroke-width="1.5"/>
    <circle cx="200" cy="78" r="16" fill="none" stroke="#3F3F46" stroke-width="1"/>
    <line x1="200" y1="62" x2="200" y2="94" stroke="#3F3F46" stroke-width="1.5"/>
    <line x1="184" y1="78" x2="216" y2="78" stroke="#3F3F46" stroke-width="1.5"/>
    <circle cx="310" cy="78" r="16" fill="none" stroke="#3F3F46" stroke-width="1"/>
    <line x1="310" y1="62" x2="310" y2="94" stroke="#3F3F46" stroke-width="1.5"/>
    <line x1="294" y1="78" x2="326" y2="78" stroke="#3F3F46" stroke-width="1.5"/>
    <circle cx="420" cy="78" r="16" fill="none" stroke="#3F3F46" stroke-width="1"/>
    <line x1="420" y1="62" x2="420" y2="94" stroke="#3F3F46" stroke-width="1.5"/>
    <line x1="404" y1="78" x2="436" y2="78" stroke="#3F3F46" stroke-width="1.5"/>
    <text x="250" y="100" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">6-FAN FORCED DRAFT  /  OUTLET: 55°C</text>
  </g>
  <!-- Cooled effluent pipe down -->
  <path id="pipe-cooled-eff" d="M 350 230 L 350 300" stroke="#71717A" stroke-width="2" fill="none"/>
  <text x="360" y="268" font-family="monospace" font-size="9" fill="#A1A1AA">55°C</text>

  <!-- V-2502 HHPS (Hot High Pressure Separator) - large horizontal drum -->
  <g id="vessel-v2502" transform="translate(130,300)">
    <rect width="450" height="120" rx="30" fill="#18181B" stroke="#52525B" stroke-width="2"/>
    <text x="225" y="45" text-anchor="middle" font-family="monospace" font-size="11" fill="#E4E4E7">V-2502</text>
    <text x="225" y="62" text-anchor="middle" font-family="monospace" font-size="10" fill="#A1A1AA">HHPS — HOT HIGH PRESSURE SEP.</text>
    <text x="225" y="79" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">135 bar / 55°C</text>
    <!-- Boot for water -->
    <rect x="185" y="120" width="50" height="50" rx="5" fill="#18181B" stroke="#52525B" stroke-width="1"/>
    <text x="210" y="147" text-anchor="middle" font-family="monospace" font-size="7" fill="#71717A">BOOT</text>
    <!-- Level indicator -->
    <rect x="410" y="10" width="16" height="100" rx="2" fill="#09090B" stroke="#52525B" stroke-width="1"/>
    <rect x="411" y="60" width="14" height="50" rx="1" fill="#3B82F6" opacity="0.5"/>
    <text x="427" y="108" font-family="monospace" font-size="7" fill="#52525B">LG</text>
  </g>
  <text x="355" y="444" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">V-2502 HHPS</text>

  <!-- pipe-hhps-gas: vapor from HHPS goes right to RGC loop -->
  <path id="pipe-hhps-gas" d="M 580 330 L 740 330" stroke="#71717A" stroke-width="2" fill="none" marker-end="url(#arr)"/>
  <text x="660" y="320" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">RECYCLE GAS</text>
  <text x="660" y="344" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">~85% H2</text>

  <!-- Sour water draw from HHPS boot -->
  <path d="M 210 415 L 210 480 L 100 480" stroke="#60A5FA" stroke-width="1.5" fill="none" stroke-dasharray="4,3" marker-end="url(#arr-b)"/>
  <text x="155" y="472" text-anchor="middle" font-family="monospace" font-size="8" fill="#60A5FA">SOUR WATER</text>
  <text x="155" y="484" text-anchor="middle" font-family="monospace" font-size="8" fill="#60A5FA">TO SWTU</text>

  <!-- pipe-hhps-liq: liquid from HHPS bottom down to V-2503 -->
  <path id="pipe-hhps-liq" d="M 355 420 L 355 500" stroke="#71717A" stroke-width="2" fill="none"/>

  <!-- V-2503 HPS (Hot Pressure Separator) - horizontal drum -->
  <g id="vessel-v2503" transform="translate(130,500)">
    <rect width="380" height="100" rx="25" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <text x="190" y="38" text-anchor="middle" font-family="monospace" font-size="11" fill="#E4E4E7">V-2503</text>
    <text x="190" y="55" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">HPS — HIGH PRESSURE SEP.</text>
    <text x="190" y="72" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">30 bar / 50°C</text>
    <rect x="350" y="8" width="14" height="84" rx="2" fill="#09090B" stroke="#52525B" stroke-width="1"/>
    <rect x="351" y="48" width="12" height="44" rx="1" fill="#3B82F6" opacity="0.4"/>
  </g>
  <text x="320" y="624" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">V-2503 HPS</text>

  <!-- HPS gas to amine / fuel -->
  <path id="pipe-hps-gas" d="M 510 530 L 740 530" stroke="#71717A" stroke-width="2" fill="none" marker-end="url(#arr)"/>
  <text x="625" y="520" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">LP GAS → AMINE / FUEL</text>

  <!-- pipe-hps-liq: liquid to fractionator -->
  <path id="pipe-hps-liq" d="M 320 600 L 320 660 L 1200 660" stroke="#71717A" stroke-width="2" fill="none" marker-end="url(#arr)"/>
  <text x="760" y="650" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">COMBINED LIQUID → FRACTIONATOR</text>
  <text x="760" y="672" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">~280°C / 4 bar</text>

  <!-- LPS (Low Pressure Separator) -->
  <g id="vessel-v2504-lps" transform="translate(130,700)">
    <rect width="300" height="90" rx="20" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <text x="150" y="35" text-anchor="middle" font-family="monospace" font-size="11" fill="#E4E4E7">V-2504</text>
    <text x="150" y="52" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">LPS — LOW PRESSURE SEP.</text>
    <text x="150" y="69" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">5 bar / 45°C</text>
  </g>
  <text x="280" y="814" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">V-2504 LPS</text>
  <!-- P-2507 pump -->
  <g id="pump-p2507" transform="translate(230,820)">
    <circle cx="22" cy="22" r="22" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <line x1="22" y1="22" x2="22" y2="5" stroke="#3F3F46" stroke-width="1.5"/>
    <line x1="22" y1="22" x2="37" y2="13" stroke="#3F3F46" stroke-width="1.5"/>
    <line x1="22" y1="22" x2="37" y2="31" stroke="#3F3F46" stroke-width="1.5"/>
    <line x1="22" y1="22" x2="22" y2="39" stroke="#3F3F46" stroke-width="1.5"/>
    <line x1="22" y1="22" x2="7" y2="31" stroke="#3F3F46" stroke-width="1.5"/>
    <line x1="22" y1="22" x2="7" y2="13" stroke="#3F3F46" stroke-width="1.5"/>
    <circle cx="22" cy="22" r="4" fill="#52525B"/>
  </g>
  <text x="252" y="864" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">P-2507</text>
  <path d="M 252 842 L 252 875 L 500 875 L 500 660" stroke="#71717A" stroke-width="1.5" fill="none"/>

  <!-- ═══ RGC / AMINE SECTION ═══ -->
  <!-- C-2501 Amine Absorber -->
  <g id="absorber-c2501" transform="translate(780,160)">
    <rect width="80" height="580" rx="8" fill="#18181B" stroke="#52525B" stroke-width="2"/>
    <text x="40" y="30" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">C-2501</text>
    <text x="40" y="46" text-anchor="middle" font-family="monospace" font-size="8" fill="#A1A1AA">AMINE</text>
    <text x="40" y="60" text-anchor="middle" font-family="monospace" font-size="8" fill="#A1A1AA">ABSORBER</text>
    <line x1="0" y1="150" x2="80" y2="150" stroke="#27272A" stroke-width="1"/>
    <line x1="0" y1="280" x2="80" y2="280" stroke="#27272A" stroke-width="1"/>
    <line x1="0" y1="420" x2="80" y2="420" stroke="#27272A" stroke-width="1"/>
    <text x="40" y="220" text-anchor="middle" font-family="monospace" font-size="7" fill="#52525B">MDEA</text>
    <text x="40" y="234" text-anchor="middle" font-family="monospace" font-size="7" fill="#52525B">PACKING</text>
    <text x="40" y="360" text-anchor="middle" font-family="monospace" font-size="7" fill="#52525B">H2S</text>
    <text x="40" y="374" text-anchor="middle" font-family="monospace" font-size="7" fill="#52525B">ABSORPTION</text>
  </g>
  <text x="820" y="755" text-anchor="middle" font-family="monospace" font-size="9" fill="#E4E4E7">C-2501</text>
  <text x="820" y="767" text-anchor="middle" font-family="monospace" font-size="8" fill="#A1A1AA">AMINE ABSORBER</text>

  <!-- Lean amine in top of absorber -->
  <path d="M 860 160 L 860 130 L 950 130" stroke="#71717A" stroke-width="1.5" fill="none" stroke-dasharray="3,3" marker-end="url(#arr)"/>
  <text x="905" y="120" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">LEAN AMINE IN</text>
  <!-- Rich amine out bottom -->
  <path d="M 860 740 L 860 790 L 950 790" stroke="#71717A" stroke-width="1.5" fill="none" stroke-dasharray="3,3" marker-end="url(#arr)"/>
  <text x="905" y="808" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">RICH AMINE → ARS</text>

  <!-- HHPS recycle gas to absorber bottom -->
  <path id="pipe-rg-to-comp" d="M 740 330 L 780 330" stroke="#71717A" stroke-width="2" fill="none"/>

  <!-- Treated gas from absorber top to suction drum / compressor -->
  <path d="M 860 160 L 1000 160 L 1000 130" stroke="#34D399" stroke-width="2" fill="none" marker-end="url(#arr-g)"/>
  <text x="930" y="150" text-anchor="middle" font-family="monospace" font-size="9" fill="#34D399">CLEAN RECYCLE GAS</text>

  <!-- RGC suction drum and compressor (schematic) -->
  <g id="vessel-suction-drum" transform="translate(960,85)">
    <rect width="80" height="45" rx="22" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <text x="40" y="18" text-anchor="middle" font-family="monospace" font-size="8" fill="#A1A1AA">V-SUCT</text>
    <text x="40" y="32" text-anchor="middle" font-family="monospace" font-size="7" fill="#71717A">SUCTION DRUM</text>
  </g>
  <path d="M 1040 107 L 1080 107" stroke="#34D399" stroke-width="2" fill="none"/>
  <!-- K-2502 RGC Compressor -->
  <g id="compressor-rgc" transform="translate(1080,60)">
    <circle cx="55" cy="55" r="55" fill="#18181B" stroke="#52525B" stroke-width="2"/>
    <line x1="55" y1="55" x2="55" y2="10" stroke="#3F3F46" stroke-width="2"/>
    <line x1="55" y1="55" x2="93" y2="30" stroke="#3F3F46" stroke-width="2"/>
    <line x1="55" y1="55" x2="100" y2="70" stroke="#3F3F46" stroke-width="2"/>
    <line x1="55" y1="55" x2="55" y2="100" stroke="#3F3F46" stroke-width="2"/>
    <line x1="55" y1="55" x2="17" y2="80" stroke="#3F3F46" stroke-width="2"/>
    <line x1="55" y1="55" x2="10" y2="40" stroke="#3F3F46" stroke-width="2"/>
    <circle cx="55" cy="55" r="7" fill="#52525B"/>
  </g>
  <text x="1135" y="135" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">K-2502</text>
  <text x="1135" y="149" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">RGC</text>
  <!-- Discharge back to reactors -->
  <path d="M 1135 60 L 1135 40 L 1200 40" stroke="#34D399" stroke-width="2" fill="none" marker-end="url(#arr-g)"/>
  <text x="1250" y="34" font-family="monospace" font-size="9" fill="#34D399">RECYCLE H2 → REACTORS</text>

  <!-- pipe-to-frac label -->
  <path id="pipe-to-frac" d="M 1200 660 L 1920 660" stroke="#71717A" stroke-width="2" fill="none" marker-end="url(#arr)"/>
  <text x="1560" y="650" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">TO FRACTIONATOR</text>

  <!-- HP Sep summary panel -->
  <rect x="1200" y="160" width="700" height="450" rx="3" fill="#0D0D0F" stroke="#27272A" stroke-width="1"/>
  <text x="1550" y="188" text-anchor="middle" font-family="monospace" font-size="12" fill="#E4E4E7">HP SEPARATION SUMMARY</text>
  <line x1="1215" y1="196" x2="1885" y2="196" stroke="#27272A" stroke-width="1"/>
  <text x="1300" y="222" font-family="monospace" font-size="9" fill="#71717A">VESSEL</text>
  <text x="1450" y="222" font-family="monospace" font-size="9" fill="#71717A">PRESSURE</text>
  <text x="1580" y="222" font-family="monospace" font-size="9" fill="#71717A">TEMP</text>
  <text x="1680" y="222" font-family="monospace" font-size="9" fill="#71717A">PURPOSE</text>
  <line x1="1215" y1="228" x2="1885" y2="228" stroke="#27272A" stroke-width="1"/>
  <text x="1300" y="252" font-family="monospace" font-size="10" fill="#E4E4E7">V-2502 HHPS</text>
  <text x="1450" y="252" font-family="monospace" font-size="10" fill="#A1A1AA">135 bar</text>
  <text x="1580" y="252" font-family="monospace" font-size="10" fill="#A1A1AA">55°C</text>
  <text x="1680" y="252" font-family="monospace" font-size="9" fill="#71717A">H2 recycle / hydrocarbon sep</text>
  <text x="1300" y="276" font-family="monospace" font-size="10" fill="#E4E4E7">V-2503 HPS</text>
  <text x="1450" y="276" font-family="monospace" font-size="10" fill="#A1A1AA">30 bar</text>
  <text x="1580" y="276" font-family="monospace" font-size="10" fill="#A1A1AA">50°C</text>
  <text x="1680" y="276" font-family="monospace" font-size="9" fill="#71717A">LP gas / liquid separation</text>
  <text x="1300" y="300" font-family="monospace" font-size="10" fill="#E4E4E7">V-2504 LPS</text>
  <text x="1450" y="300" font-family="monospace" font-size="10" fill="#A1A1AA">5 bar</text>
  <text x="1580" y="300" font-family="monospace" font-size="10" fill="#A1A1AA">45°C</text>
  <text x="1680" y="300" font-family="monospace" font-size="9" fill="#71717A">Flash gas / unstabilized HC</text>
  <text x="1300" y="324" font-family="monospace" font-size="10" fill="#E4E4E7">C-2501 ABSORBER</text>
  <text x="1450" y="324" font-family="monospace" font-size="10" fill="#A1A1AA">130 bar</text>
  <text x="1580" y="324" font-family="monospace" font-size="10" fill="#A1A1AA">40°C</text>
  <text x="1680" y="324" font-family="monospace" font-size="9" fill="#71717A">H2S removal MDEA</text>
  <text x="1300" y="348" font-family="monospace" font-size="10" fill="#E4E4E7">K-2502 RGC</text>
  <text x="1450" y="348" font-family="monospace" font-size="9" fill="#A1A1AA">135-155 bar</text>
  <text x="1580" y="348" font-family="monospace" font-size="10" fill="#A1A1AA">38°C</text>
  <text x="1680" y="348" font-family="monospace" font-size="9" fill="#71717A">Recycle gas compression</text>
  <text x="1550" y="420" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">U25 HP SEPARATION REV.1</text>
</svg>$svg$,
  bindings = '{}'::jsonb,
  metadata = '{"width": 1920, "height": 1080}'::jsonb
WHERE id = '55aecf35-c52b-44f6-aa2c-0369b957dea0';

-- ============================================================
-- 7. HCU Light Ends
-- ============================================================
UPDATE design_objects
SET svg_data = $svg$<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080">
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#71717A"/></marker>
    <marker id="arr-b" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#60A5FA"/></marker>
  </defs>
  <rect width="100%" height="100%" fill="#09090B"/>
  <text x="960" y="36" text-anchor="middle" font-family="monospace" font-size="18" font-weight="bold" fill="#E4E4E7">UNIT 25 HCU — LIGHT ENDS / NAPHTHA STABILIZER</text>

  <!-- Zone dividers -->
  <line x1="220" y1="60" x2="220" y2="1040" stroke="#27272A" stroke-width="1" stroke-dasharray="3,5"/>
  <line x1="680" y1="60" x2="680" y2="1040" stroke="#27272A" stroke-width="1" stroke-dasharray="3,5"/>
  <line x1="1100" y1="60" x2="1100" y2="1040" stroke="#27272A" stroke-width="1" stroke-dasharray="3,5"/>
  <text x="110" y="72" text-anchor="middle" font-family="monospace" font-size="10" fill="#52525B">FEED</text>
  <text x="450" y="72" text-anchor="middle" font-family="monospace" font-size="10" fill="#52525B">STABILIZER COLUMN</text>
  <text x="890" y="72" text-anchor="middle" font-family="monospace" font-size="10" fill="#52525B">OVERHEAD SYSTEM</text>
  <text x="1510" y="72" text-anchor="middle" font-family="monospace" font-size="10" fill="#52525B">PRODUCTS</text>

  <!-- Feed from fractionator light ends -->
  <path id="pipe-feed-light" d="M 20 480 L 220 480" stroke="#71717A" stroke-width="2" fill="none" marker-end="url(#arr)"/>
  <text x="20" y="470" font-family="monospace" font-size="10" fill="#E4E4E7">LIGHT NAPHTHA FEED</text>
  <text x="20" y="494" font-family="monospace" font-size="9" fill="#A1A1AA">FROM C-2502 DRAW</text>
  <text x="20" y="508" font-family="monospace" font-size="9" fill="#71717A">IBP-165°C / 3 bar</text>

  <!-- C-2503 Naphtha Stabilizer column -->
  <g id="column-c2503" transform="translate(280,120)">
    <rect width="110" height="780" rx="8" fill="#18181B" stroke="#52525B" stroke-width="2"/>
    <text x="55" y="30" text-anchor="middle" font-family="monospace" font-size="11" fill="#E4E4E7">C-2503</text>
    <text x="55" y="46" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">STABILIZER</text>
    <!-- Trays -->
    <line x1="0" y1="120" x2="110" y2="120" stroke="#27272A" stroke-width="1"/>
    <line x1="0" y1="240" x2="110" y2="240" stroke="#27272A" stroke-width="1"/>
    <line x1="0" y1="380" x2="110" y2="380" stroke="#27272A" stroke-width="1"/>
    <line x1="0" y1="520" x2="110" y2="520" stroke="#27272A" stroke-width="1"/>
    <line x1="0" y1="640" x2="110" y2="640" stroke="#27272A" stroke-width="1"/>
    <text x="55" y="185" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">Trays 25-30</text>
    <text x="55" y="315" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">Trays 15-24</text>
    <text x="55" y="455" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">Trays 8-14</text>
    <text x="55" y="585" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">Trays 2-7</text>
    <!-- Feed nozzle ~tray 10 -->
    <line x1="-20" y1="360" x2="0" y2="360" stroke="#71717A" stroke-width="2"/>
    <!-- Bottom section -->
    <rect x="5" y="730" width="100" height="40" rx="4" fill="#27272A" opacity="0.4"/>
    <text x="55" y="754" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">BOTTOMS</text>
  </g>
  <text x="335" y="920" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">C-2503</text>
  <text x="335" y="934" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">NAPHTHA STABILIZER</text>

  <!-- Connect feed to column -->
  <path d="M 220 480 L 280 480" stroke="#71717A" stroke-width="2" fill="none"/>

  <!-- Reboiler E-2508 (bottom loop) -->
  <g id="hx-e2508" transform="translate(170,800)">
    <rect width="80" height="50" fill="#1C1917" stroke="#78350F" stroke-width="1.5"/>
    <text x="40" y="22" text-anchor="middle" font-family="monospace" font-size="9" fill="#F59E0B">E-2508</text>
    <text x="40" y="36" text-anchor="middle" font-family="monospace" font-size="8" fill="#D97706">REBOILER</text>
  </g>
  <path d="M 280 860 L 250 860 L 250 825 L 250 850" stroke="#EF4444" stroke-width="1.5" fill="none" stroke-dasharray="4,3"/>
  <path d="M 280 900 L 250 900 L 250 875" stroke="#71717A" stroke-width="1.5" fill="none" stroke-dasharray="4,3"/>
  <text x="210" y="788" font-family="monospace" font-size="8" fill="#71717A">STEAM / FIRED</text>

  <!-- ── OVERHEAD SYSTEM ── -->
  <!-- pipe-overhead-c2503: overhead from top of column -->
  <path id="pipe-overhead-c2503" d="M 335 120 L 335 80 L 680 80" stroke="#71717A" stroke-width="2" fill="none"/>
  <!-- Condenser -->
  <g transform="translate(680,58)">
    <rect width="80" height="45" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <ellipse cx="18" cy="22" rx="10" ry="16" fill="none" stroke="#3F3F46" stroke-width="1"/>
    <line x1="28" y1="22" x2="52" y2="22" stroke="#3F3F46" stroke-width="1"/>
    <ellipse cx="62" cy="22" rx="10" ry="16" fill="none" stroke="#3F3F46" stroke-width="1"/>
  </g>
  <text x="720" y="118" text-anchor="middle" font-family="monospace" font-size="8" fill="#A1A1AA">E-COND</text>
  <!-- V-2505 Stabilizer Reflux Drum -->
  <g id="vessel-v2505" transform="translate(800,60)">
    <rect width="130" height="45" rx="22" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <text x="65" y="18" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">V-2505</text>
    <text x="65" y="32" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">REFLUX DRUM</text>
  </g>
  <text x="865" y="120" text-anchor="middle" font-family="monospace" font-size="9" fill="#E4E4E7">V-2505</text>
  <path d="M 760 80 L 800 80" stroke="#71717A" stroke-width="2" fill="none"/>

  <!-- LPG from reflux drum top -->
  <path id="pipe-lpg-out" d="M 865 60 L 865 30 L 1100 30" stroke="#71717A" stroke-width="2" fill="none" marker-end="url(#arr)"/>
  <text x="980" y="22" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">LPG PRODUCT</text>
  <text x="980" y="40" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">C3/C4  /  2.5 bar</text>

  <!-- P-2508 reflux pump -->
  <g id="pump-p2508" transform="translate(850,130)">
    <circle cx="22" cy="22" r="22" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <line x1="22" y1="22" x2="22" y2="5" stroke="#3F3F46" stroke-width="1.5"/>
    <line x1="22" y1="22" x2="37" y2="13" stroke="#3F3F46" stroke-width="1.5"/>
    <line x1="22" y1="22" x2="37" y2="31" stroke="#3F3F46" stroke-width="1.5"/>
    <line x1="22" y1="22" x2="22" y2="39" stroke="#3F3F46" stroke-width="1.5"/>
    <line x1="22" y1="22" x2="7" y2="31" stroke="#3F3F46" stroke-width="1.5"/>
    <line x1="22" y1="22" x2="7" y2="13" stroke="#3F3F46" stroke-width="1.5"/>
    <circle cx="22" cy="22" r="4" fill="#52525B"/>
  </g>
  <text x="872" y="172" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">P-2508</text>
  <!-- pipe-reflux-c2503 back to column -->
  <path id="pipe-reflux-c2503" d="M 850 152 L 390 152 L 390 240" stroke="#71717A" stroke-width="1.5" fill="none" stroke-dasharray="4,3" marker-end="url(#arr)"/>
  <text x="620" y="145" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">REFLUX</text>

  <!-- Stabilizer bottoms: LN product -->
  <path id="pipe-ln-stab" d="M 390 900 L 390 960 L 1100 960" stroke="#71717A" stroke-width="2" fill="none" marker-end="url(#arr)"/>
  <text x="745" y="952" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">STABILIZED LIGHT NAPHTHA</text>
  <text x="745" y="970" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">IBP-90°C  /  0.5 bar  /  85°C</text>

  <!-- Product summary panel -->
  <rect x="1120" y="100" width="780" height="860" rx="4" fill="#0D0D0F" stroke="#27272A" stroke-width="1"/>
  <text x="1510" y="130" text-anchor="middle" font-family="monospace" font-size="13" fill="#E4E4E7">LIGHT ENDS PRODUCT SUMMARY</text>
  <line x1="1135" y1="140" x2="1885" y2="140" stroke="#27272A" stroke-width="1"/>
  <!-- LPG detail -->
  <text x="1510" y="165" text-anchor="middle" font-family="monospace" font-size="11" fill="#A1A1AA">LPG OVERHEAD</text>
  <rect x="1135" y="175" width="740" height="140" rx="3" fill="#111113" stroke="#27272A" stroke-width="1"/>
  <text x="1200" y="198" font-family="monospace" font-size="9" fill="#71717A">Composition:</text>
  <text x="1380" y="198" font-family="monospace" font-size="9" fill="#A1A1AA">C3: 35%  C4: 55%  C5+: 8%  C2-: 2%</text>
  <text x="1200" y="218" font-family="monospace" font-size="9" fill="#71717A">Flow rate:</text>
  <text x="1380" y="218" font-family="monospace" font-size="9" fill="#E4E4E7">14.2 m³/h liquid equiv.</text>
  <text x="1200" y="238" font-family="monospace" font-size="9" fill="#71717A">Pressure:</text>
  <text x="1380" y="238" font-family="monospace" font-size="9" fill="#E4E4E7">2.5 barg (drum)</text>
  <text x="1200" y="258" font-family="monospace" font-size="9" fill="#71717A">Destination:</text>
  <text x="1380" y="258" font-family="monospace" font-size="9" fill="#E4E4E7">LPG treating / storage bullets</text>
  <text x="1200" y="298" font-family="monospace" font-size="8" fill="#52525B">Spec: C5+ in LPG &lt; 2 vol% (TVP control)</text>
  <!-- LN detail -->
  <text x="1510" y="350" text-anchor="middle" font-family="monospace" font-size="11" fill="#A1A1AA">STABILIZED LT. NAPHTHA</text>
  <rect x="1135" y="360" width="740" height="140" rx="3" fill="#111113" stroke="#27272A" stroke-width="1"/>
  <text x="1200" y="383" font-family="monospace" font-size="9" fill="#71717A">Boiling range:</text>
  <text x="1380" y="383" font-family="monospace" font-size="9" fill="#A1A1AA">IBP 38°C — FBP 90°C</text>
  <text x="1200" y="403" font-family="monospace" font-size="9" fill="#71717A">Flow rate:</text>
  <text x="1380" y="403" font-family="monospace" font-size="9" fill="#E4E4E7">28 m³/h</text>
  <text x="1200" y="423" font-family="monospace" font-size="9" fill="#71717A">RON (blended):</text>
  <text x="1380" y="423" font-family="monospace" font-size="9" fill="#E4E4E7">82–86 (as cut)</text>
  <text x="1200" y="443" font-family="monospace" font-size="9" fill="#71717A">Destination:</text>
  <text x="1380" y="443" font-family="monospace" font-size="9" fill="#E4E4E7">Gasoline pool blend / isomerization</text>
  <text x="1200" y="483" font-family="monospace" font-size="8" fill="#52525B">Spec: RVP &lt; 65 kPa (Stab column TVP control)</text>
  <!-- Column data -->
  <text x="1510" y="545" text-anchor="middle" font-family="monospace" font-size="11" fill="#A1A1AA">COLUMN C-2503 DATA</text>
  <rect x="1135" y="555" width="740" height="180" rx="3" fill="#111113" stroke="#27272A" stroke-width="1"/>
  <text x="1200" y="578" font-family="monospace" font-size="9" fill="#71717A">Trays:</text>
  <text x="1380" y="578" font-family="monospace" font-size="9" fill="#E4E4E7">30 valve trays</text>
  <text x="1200" y="598" font-family="monospace" font-size="9" fill="#71717A">Diameter:</text>
  <text x="1380" y="598" font-family="monospace" font-size="9" fill="#E4E4E7">2.2 m</text>
  <text x="1200" y="618" font-family="monospace" font-size="9" fill="#71717A">Overhead temp:</text>
  <text x="1380" y="618" font-family="monospace" font-size="9" fill="#E4E4E7">72°C (controlled)</text>
  <text x="1200" y="638" font-family="monospace" font-size="9" fill="#71717A">Bottoms temp:</text>
  <text x="1380" y="638" font-family="monospace" font-size="9" fill="#E4E4E7">165°C (reboiler duty)</text>
  <text x="1200" y="658" font-family="monospace" font-size="9" fill="#71717A">Reboiler duty:</text>
  <text x="1380" y="658" font-family="monospace" font-size="9" fill="#E4E4E7">6.8 MMBTU/hr</text>
  <text x="1200" y="678" font-family="monospace" font-size="9" fill="#71717A">Reflux ratio:</text>
  <text x="1380" y="678" font-family="monospace" font-size="9" fill="#E4E4E7">2.4</text>
  <text x="1200" y="718" font-family="monospace" font-size="8" fill="#52525B">Control: Bottoms TVP + overhead temperature</text>
  <text x="1510" y="840" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">U25 LIGHT ENDS REV.1</text>
</svg>$svg$,
  bindings = '{}'::jsonb,
  metadata = '{"width": 1920, "height": 1080}'::jsonb
WHERE id = '16f0faa3-6b9e-4a88-b643-7ee62a05b2ff';

-- ============================================================
-- 8. HCU Overview / Performance (block flow diagram)
-- ============================================================
UPDATE design_objects
SET svg_data = $svg$<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080">
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#71717A"/></marker>
    <marker id="arr-g" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#34D399"/></marker>
  </defs>
  <rect width="100%" height="100%" fill="#09090B"/>
  <text x="960" y="40" text-anchor="middle" font-family="monospace" font-size="20" font-weight="bold" fill="#E4E4E7">UNIT 25 HCU — OVERVIEW &amp; PERFORMANCE</text>
  <text x="960" y="60" text-anchor="middle" font-family="monospace" font-size="11" fill="#52525B">BLOCK FLOW DIAGRAM  /  KEY PERFORMANCE INDICATORS</text>

  <!-- ── BLOCK FLOW DIAGRAM (top half) ── -->
  <!-- Feed Prep block -->
  <g id="block-feed-prep" transform="translate(40,90)">
    <rect width="200" height="280" rx="6" fill="#0F1015" stroke="#52525B" stroke-width="1.5"/>
    <text x="100" y="26" text-anchor="middle" font-family="monospace" font-size="12" fill="#E4E4E7">FEED PREP</text>
    <line x1="0" y1="35" x2="200" y2="35" stroke="#27272A" stroke-width="1"/>
    <text x="100" y="60" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">V-2501 Feed Drum</text>
    <text x="100" y="78" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">P-2501A/B Charge Pumps</text>
    <text x="100" y="96" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">E-2501-2505 F/E HXs</text>
    <text x="100" y="114" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">H-2501 Charge Heater</text>
    <line x1="20" y1="125" x2="180" y2="125" stroke="#27272A" stroke-width="1" stroke-dasharray="2,3"/>
    <text x="100" y="148" text-anchor="middle" font-family="monospace" font-size="9" fill="#52525B">Feed temp to R-2501:</text>
    <text x="100" y="164" text-anchor="middle" font-family="monospace" font-size="12" fill="#E4E4E7">390 °C</text>
    <text x="100" y="186" text-anchor="middle" font-family="monospace" font-size="9" fill="#52525B">Feed pressure:</text>
    <text x="100" y="202" text-anchor="middle" font-family="monospace" font-size="12" fill="#E4E4E7">148 bar</text>
    <text x="100" y="224" text-anchor="middle" font-family="monospace" font-size="9" fill="#52525B">Heater duty:</text>
    <text x="100" y="240" text-anchor="middle" font-family="monospace" font-size="12" fill="#E4E4E7">40 MMBTU/hr</text>
    <text x="100" y="268" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">VGO: 370-520°C TBP range</text>
  </g>

  <!-- Arrow Feed → Reactors -->
  <path id="pipe-feed-in-overview" d="M 240 230 L 310 230" stroke="#71717A" stroke-width="2" fill="none" marker-end="url(#arr)"/>
  <text x="275" y="222" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">VGO+H2</text>

  <!-- Reactors block -->
  <g id="block-reactors" transform="translate(310,90)">
    <rect width="220" height="280" rx="6" fill="#0F1015" stroke="#52525B" stroke-width="1.5"/>
    <text x="110" y="26" text-anchor="middle" font-family="monospace" font-size="12" fill="#E4E4E7">REACTORS</text>
    <line x1="0" y1="35" x2="220" y2="35" stroke="#27272A" stroke-width="1"/>
    <text x="110" y="60" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">R-2501 Pretreater (NiMo)</text>
    <text x="110" y="78" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">R-2502 Cracker (NiW/zeolite)</text>
    <text x="110" y="96" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">Q-H2 quench between beds</text>
    <line x1="20" y1="108" x2="200" y2="108" stroke="#27272A" stroke-width="1" stroke-dasharray="2,3"/>
    <text x="110" y="132" text-anchor="middle" font-family="monospace" font-size="9" fill="#52525B">R-2501 WABT:</text>
    <text x="110" y="148" text-anchor="middle" font-family="monospace" font-size="12" fill="#E4E4E7" id="kpi-wabt">370 °C</text>
    <text x="110" y="170" text-anchor="middle" font-family="monospace" font-size="9" fill="#52525B">R-2502 WABT:</text>
    <text x="110" y="186" text-anchor="middle" font-family="monospace" font-size="12" fill="#E4E4E7">388 °C</text>
    <text x="110" y="208" text-anchor="middle" font-family="monospace" font-size="9" fill="#52525B">Conversion (single-pass):</text>
    <text x="110" y="224" text-anchor="middle" font-family="monospace" font-size="12" fill="#E4E4E7" id="kpi-conversion">68 %</text>
    <text x="110" y="268" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">dP R2501: 1.8 bar  R2502: 2.1 bar</text>
  </g>

  <!-- Arrow Reactors → HP Sep -->
  <path d="M 530 230 L 600 230" stroke="#EF4444" stroke-width="2" fill="none" marker-end="url(#arr)"/>
  <text x="565" y="222" text-anchor="middle" font-family="monospace" font-size="8" fill="#EF4444">410°C</text>

  <!-- HP Separation block -->
  <g id="block-hp-sep" transform="translate(600,90)">
    <rect width="220" height="280" rx="6" fill="#0F1015" stroke="#52525B" stroke-width="1.5"/>
    <text x="110" y="26" text-anchor="middle" font-family="monospace" font-size="12" fill="#E4E4E7">HP SEPARATION</text>
    <line x1="0" y1="35" x2="220" y2="35" stroke="#27272A" stroke-width="1"/>
    <text x="110" y="60" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">E-2507 Effluent Air Cooler</text>
    <text x="110" y="78" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">V-2502 HHPS (135 bar)</text>
    <text x="110" y="96" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">V-2503 HPS (30 bar)</text>
    <text x="110" y="114" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">V-2504 LPS (5 bar)</text>
    <text x="110" y="132" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">C-2501 Amine Absorber</text>
    <text x="110" y="150" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">K-2502 RGC Compressor</text>
    <line x1="20" y1="160" x2="200" y2="160" stroke="#27272A" stroke-width="1" stroke-dasharray="2,3"/>
    <text x="110" y="184" text-anchor="middle" font-family="monospace" font-size="9" fill="#52525B">Recycle gas purity:</text>
    <text x="110" y="200" text-anchor="middle" font-family="monospace" font-size="12" fill="#E4E4E7">88 % H2</text>
    <text x="110" y="222" text-anchor="middle" font-family="monospace" font-size="9" fill="#52525B">H2S in rec. gas:</text>
    <text x="110" y="238" text-anchor="middle" font-family="monospace" font-size="12" fill="#E4E4E7">&lt;20 ppm</text>
    <text x="110" y="268" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">Sour water: 2.4 m³/h to SWTU</text>
  </g>

  <!-- Arrow HP Sep → Fractionation -->
  <path id="pipe-products-out" d="M 820 230 L 890 230" stroke="#71717A" stroke-width="2" fill="none" marker-end="url(#arr)"/>
  <text x="855" y="222" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">liq</text>

  <!-- Fractionation block -->
  <g id="block-frac" transform="translate(890,90)">
    <rect width="220" height="280" rx="6" fill="#0F1015" stroke="#52525B" stroke-width="1.5"/>
    <text x="110" y="26" text-anchor="middle" font-family="monospace" font-size="12" fill="#E4E4E7">FRACTIONATION</text>
    <line x1="0" y1="35" x2="220" y2="35" stroke="#27272A" stroke-width="1"/>
    <text x="110" y="60" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">C-2502 Main Frac (70 trays)</text>
    <text x="110" y="78" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">C-2503 Stabilizer (30 trays)</text>
    <text x="110" y="96" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">3 pumparounds</text>
    <text x="110" y="114" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">V-2504 Reflux Drum</text>
    <line x1="20" y1="124" x2="200" y2="124" stroke="#27272A" stroke-width="1" stroke-dasharray="2,3"/>
    <text x="110" y="148" text-anchor="middle" font-family="monospace" font-size="9" fill="#52525B">Overhead temp:</text>
    <text x="110" y="164" text-anchor="middle" font-family="monospace" font-size="12" fill="#E4E4E7">118 °C</text>
    <text x="110" y="186" text-anchor="middle" font-family="monospace" font-size="9" fill="#52525B">Bottoms temp:</text>
    <text x="110" y="202" text-anchor="middle" font-family="monospace" font-size="12" fill="#E4E4E7">368 °C</text>
    <text x="110" y="268" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">Total PA duty: 88 MMBTU/hr</text>
  </g>

  <!-- Arrow Frac → Products -->
  <path d="M 1110 230 L 1180 230" stroke="#71717A" stroke-width="2" fill="none" marker-end="url(#arr)"/>

  <!-- Products block -->
  <g id="block-products" transform="translate(1180,90)">
    <rect width="220" height="280" rx="6" fill="#0F1015" stroke="#52525B" stroke-width="1.5"/>
    <text x="110" y="26" text-anchor="middle" font-family="monospace" font-size="12" fill="#E4E4E7">PRODUCTS</text>
    <line x1="0" y1="35" x2="220" y2="35" stroke="#27272A" stroke-width="1"/>
    <text x="40" y="58" font-family="monospace" font-size="9" fill="#71717A">LPG:</text>
    <text x="150" y="58" text-anchor="end" font-family="monospace" font-size="9" fill="#E4E4E7">12 m³/h</text>
    <text x="40" y="76" font-family="monospace" font-size="9" fill="#71717A">Lt Naphtha:</text>
    <text x="150" y="76" text-anchor="end" font-family="monospace" font-size="9" fill="#E4E4E7">28 m³/h</text>
    <text x="40" y="94" font-family="monospace" font-size="9" fill="#71717A">Hvy Naphtha:</text>
    <text x="150" y="94" text-anchor="end" font-family="monospace" font-size="9" fill="#E4E4E7">52 m³/h</text>
    <text x="40" y="112" font-family="monospace" font-size="9" fill="#71717A">Kerosene:</text>
    <text x="150" y="112" text-anchor="end" font-family="monospace" font-size="9" fill="#E4E4E7">76 m³/h</text>
    <text x="40" y="130" font-family="monospace" font-size="9" fill="#71717A">Diesel:</text>
    <text x="150" y="130" text-anchor="end" font-family="monospace" font-size="9" fill="#E4E4E7">142 m³/h</text>
    <text x="40" y="148" font-family="monospace" font-size="9" fill="#71717A">UCO:</text>
    <text x="150" y="148" text-anchor="end" font-family="monospace" font-size="9" fill="#E4E4E7">38 m³/h</text>
    <line x1="20" y1="160" x2="200" y2="160" stroke="#27272A" stroke-width="1" stroke-dasharray="2,3"/>
    <text x="110" y="182" text-anchor="middle" font-family="monospace" font-size="9" fill="#52525B">Total liquid yield:</text>
    <text x="110" y="198" text-anchor="middle" font-family="monospace" font-size="12" fill="#E4E4E7">348 m³/h</text>
    <text x="110" y="268" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">Design: 420 m³/h VGO</text>
  </g>

  <!-- H2 makeup and recycle arrows -->
  <path id="pipe-h2-makeup-in" d="M 1420 180 L 1920 180" stroke="#34D399" stroke-width="2" fill="none"/>
  <text x="1670" y="170" text-anchor="middle" font-family="monospace" font-size="10" fill="#34D399">MAKEUP H2 FROM U24</text>
  <path d="M 1420 180 L 1420 230 L 1400 230" stroke="#34D399" stroke-width="2" fill="none" marker-end="url(#arr-g)"/>

  <!-- Recycle H2 arrow (top loop) -->
  <path id="pipe-recycle-h2" d="M 810 100 L 810 80 L 440 80 L 440 90" stroke="#34D399" stroke-width="1.5" fill="none" stroke-dasharray="5,3" marker-end="url(#arr-g)"/>
  <text x="625" y="74" text-anchor="middle" font-family="monospace" font-size="9" fill="#34D399">RECYCLE H2 (K-2502)</text>

  <!-- ── KPI PANEL (bottom half) ── -->
  <line x1="20" y1="420" x2="1900" y2="420" stroke="#27272A" stroke-width="1"/>
  <text x="960" y="448" text-anchor="middle" font-family="monospace" font-size="14" fill="#71717A">KEY PERFORMANCE INDICATORS</text>

  <!-- KPI boxes row 1 -->
  <g id="kpi-wabt-box" transform="translate(30,460)">
    <rect width="200" height="130" rx="4" fill="#111113" stroke="#27272A" stroke-width="1"/>
    <text x="100" y="26" text-anchor="middle" font-family="monospace" font-size="10" fill="#71717A">WABT R-2501</text>
    <text x="100" y="65" text-anchor="middle" font-family="monospace" font-size="34" fill="#E4E4E7">370</text>
    <text x="100" y="88" text-anchor="middle" font-family="monospace" font-size="12" fill="#A1A1AA">°C</text>
    <text x="100" y="112" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">Limit: 420°C  |  Δ run: +2.1°C/mo</text>
  </g>
  <g transform="translate(250,460)">
    <rect width="200" height="130" rx="4" fill="#111113" stroke="#27272A" stroke-width="1"/>
    <text x="100" y="26" text-anchor="middle" font-family="monospace" font-size="10" fill="#71717A">WABT R-2502</text>
    <text x="100" y="65" text-anchor="middle" font-family="monospace" font-size="34" fill="#E4E4E7">388</text>
    <text x="100" y="88" text-anchor="middle" font-family="monospace" font-size="12" fill="#A1A1AA">°C</text>
    <text x="100" y="112" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">Limit: 425°C  |  Δ run: +2.6°C/mo</text>
  </g>
  <g id="kpi-conversion-box" transform="translate(470,460)">
    <rect width="200" height="130" rx="4" fill="#111113" stroke="#27272A" stroke-width="1"/>
    <text x="100" y="26" text-anchor="middle" font-family="monospace" font-size="10" fill="#71717A">CONVERSION</text>
    <text x="100" y="65" text-anchor="middle" font-family="monospace" font-size="34" fill="#E4E4E7">68</text>
    <text x="100" y="88" text-anchor="middle" font-family="monospace" font-size="12" fill="#A1A1AA">%</text>
    <text x="100" y="112" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">Target: 70%  |  Single pass 430-</text>
  </g>
  <g id="kpi-h2-consumption-box" transform="translate(690,460)">
    <rect width="200" height="130" rx="4" fill="#111113" stroke="#27272A" stroke-width="1"/>
    <text x="100" y="26" text-anchor="middle" font-family="monospace" font-size="10" fill="#71717A">H2 CONSUMPTION</text>
    <text x="100" y="65" text-anchor="middle" font-family="monospace" font-size="34" fill="#E4E4E7">1.82</text>
    <text x="100" y="88" text-anchor="middle" font-family="monospace" font-size="12" fill="#A1A1AA">wt%</text>
    <text x="100" y="112" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">Chemical H2: 0.9%  Solubility: 0.92%</text>
  </g>
  <g transform="translate(910,460)">
    <rect width="200" height="130" rx="4" fill="#111113" stroke="#27272A" stroke-width="1"/>
    <text x="100" y="26" text-anchor="middle" font-family="monospace" font-size="10" fill="#71717A">DIESEL YIELD</text>
    <text x="100" y="65" text-anchor="middle" font-family="monospace" font-size="34" fill="#E4E4E7">41</text>
    <text x="100" y="88" text-anchor="middle" font-family="monospace" font-size="12" fill="#A1A1AA">vol%</text>
    <text x="100" y="112" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">Target: 42%  |  ULSD &lt;15ppm S</text>
  </g>
  <g transform="translate(1130,460)">
    <rect width="200" height="130" rx="4" fill="#111113" stroke="#27272A" stroke-width="1"/>
    <text x="100" y="26" text-anchor="middle" font-family="monospace" font-size="10" fill="#71717A">REC. GAS PURITY</text>
    <text x="100" y="65" text-anchor="middle" font-family="monospace" font-size="34" fill="#34D399">88</text>
    <text x="100" y="88" text-anchor="middle" font-family="monospace" font-size="12" fill="#6EE7B7">% H2</text>
    <text x="100" y="112" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">Min: 80%  |  H2S: &lt;20 ppm</text>
  </g>
  <g transform="translate(1350,460)">
    <rect width="200" height="130" rx="4" fill="#111113" stroke="#27272A" stroke-width="1"/>
    <text x="100" y="26" text-anchor="middle" font-family="monospace" font-size="10" fill="#71717A">RGC SPEED</text>
    <text x="100" y="65" text-anchor="middle" font-family="monospace" font-size="34" fill="#E4E4E7">7840</text>
    <text x="100" y="88" text-anchor="middle" font-family="monospace" font-size="12" fill="#A1A1AA">RPM</text>
    <text x="100" y="112" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">Design: 8200 RPM  |  Vib: 28 µm</text>
  </g>
  <g transform="translate(1570,460)">
    <rect width="200" height="130" rx="4" fill="#111113" stroke="#27272A" stroke-width="1"/>
    <text x="100" y="26" text-anchor="middle" font-family="monospace" font-size="10" fill="#71717A">VGO FEED RATE</text>
    <text x="100" y="65" text-anchor="middle" font-family="monospace" font-size="34" fill="#E4E4E7">348</text>
    <text x="100" y="88" text-anchor="middle" font-family="monospace" font-size="12" fill="#A1A1AA">m³/h</text>
    <text x="100" y="112" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">Design: 420 m³/h  |  83% rate</text>
  </g>

  <!-- KPI boxes row 2 -->
  <g transform="translate(30,620)">
    <rect width="200" height="100" rx="4" fill="#111113" stroke="#27272A" stroke-width="1"/>
    <text x="100" y="22" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">H2501 DUTY</text>
    <text x="100" y="52" text-anchor="middle" font-family="monospace" font-size="28" fill="#F59E0B">39.2</text>
    <text x="100" y="70" text-anchor="middle" font-family="monospace" font-size="10" fill="#F59E0B">MMBTU/hr</text>
    <text x="100" y="90" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">Design: 40 MMBTU/hr</text>
  </g>
  <g transform="translate(250,620)">
    <rect width="200" height="100" rx="4" fill="#111113" stroke="#27272A" stroke-width="1"/>
    <text x="100" y="22" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">H2 MAKEUP RATE</text>
    <text x="100" y="52" text-anchor="middle" font-family="monospace" font-size="28" fill="#34D399">6340</text>
    <text x="100" y="70" text-anchor="middle" font-family="monospace" font-size="10" fill="#6EE7B7">Nm³/h</text>
    <text x="100" y="90" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">From U24 K-2401</text>
  </g>
  <g transform="translate(470,620)">
    <rect width="200" height="100" rx="4" fill="#111113" stroke="#27272A" stroke-width="1"/>
    <text x="100" y="22" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">CAT. AGE (R-2501)</text>
    <text x="100" y="52" text-anchor="middle" font-family="monospace" font-size="28" fill="#E4E4E7">14</text>
    <text x="100" y="70" text-anchor="middle" font-family="monospace" font-size="10" fill="#A1A1AA">months</text>
    <text x="100" y="90" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">EOC est.: +22 months</text>
  </g>
  <g transform="translate(690,620)">
    <rect width="200" height="100" rx="4" fill="#111113" stroke="#27272A" stroke-width="1"/>
    <text x="100" y="22" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">SULFUR REMOVAL</text>
    <text x="100" y="52" text-anchor="middle" font-family="monospace" font-size="28" fill="#E4E4E7">99.7</text>
    <text x="100" y="70" text-anchor="middle" font-family="monospace" font-size="10" fill="#A1A1AA">%</text>
    <text x="100" y="90" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">Diesel S: 8 ppm</text>
  </g>
  <g transform="translate(910,620)">
    <rect width="200" height="100" rx="4" fill="#111113" stroke="#27272A" stroke-width="1"/>
    <text x="100" y="22" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">CETANE INDEX</text>
    <text x="100" y="52" text-anchor="middle" font-family="monospace" font-size="28" fill="#E4E4E7">58</text>
    <text x="100" y="70" text-anchor="middle" font-family="monospace" font-size="10" fill="#A1A1AA">CI</text>
    <text x="100" y="90" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">Spec: &gt;55  |  ASTM D613</text>
  </g>
  <!-- Run length chart (bar) -->
  <rect x="1130" y="620" width="760" height="100" rx="4" fill="#111113" stroke="#27272A" stroke-width="1"/>
  <text x="1510" y="642" text-anchor="middle" font-family="monospace" font-size="10" fill="#71717A">CATALYST RUN LENGTH / TEMPERATURE PROFILE</text>
  <text x="1145" y="662" font-family="monospace" font-size="8" fill="#52525B">SOR</text>
  <rect x="1160" y="665" width="540" height="16" rx="2" fill="#27272A"/>
  <rect x="1160" y="665" width="320" height="16" rx="2" fill="#3B82F6" opacity="0.6"/>
  <text x="1160" y="696" font-family="monospace" font-size="8" fill="#52525B">SOR 350°C</text>
  <text x="1490" y="696" text-anchor="middle" font-family="monospace" font-size="8" fill="#3B82F6">CURRENT: 370°C</text>
  <text x="1700" y="696" font-family="monospace" font-size="8" fill="#52525B">EOR 420°C</text>
  <text x="1510" y="712" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">14 months run  /  ~22 months remaining  /  Changeout: Q2 next year</text>

  <text x="960" y="760" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">U25 HCU OVERVIEW REV.1  /  DATA REPRESENTS CURRENT SHIFT AVERAGE</text>
</svg>$svg$,
  bindings = '{}'::jsonb,
  metadata = '{"width": 1920, "height": 1080}'::jsonb
WHERE id = 'b2d452d5-764d-4eab-af45-b4d03b5b9dbf';

-- ============================================================
-- 9. HCU Reactor R-2501 (Pretreater)
-- ============================================================
UPDATE design_objects
SET svg_data = $svg$<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080">
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#71717A"/></marker>
    <marker id="arr-g" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#34D399"/></marker>
    <marker id="arr-r" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#EF4444"/></marker>
  </defs>
  <rect width="100%" height="100%" fill="#09090B"/>
  <text x="960" y="36" text-anchor="middle" font-family="monospace" font-size="18" font-weight="bold" fill="#E4E4E7">UNIT 25 HCU — REACTOR R-2501 (PRETREATER)</text>
  <text x="960" y="54" text-anchor="middle" font-family="monospace" font-size="11" fill="#52525B">NiMo CATALYST  /  DESULFURIZATION + MILD HYDROCRACKING  /  4 BEDS</text>

  <!-- Reactor vessel (tall, center) -->
  <g id="reactor-r2501" transform="translate(700,60)">
    <!-- Vessel shell -->
    <rect width="200" height="940" rx="12" fill="#18181B" stroke="#52525B" stroke-width="2"/>
    <!-- Head ellipse top -->
    <ellipse cx="100" cy="12" rx="100" ry="28" fill="#1A1A1F" stroke="#52525B" stroke-width="2"/>
    <!-- Head ellipse bottom -->
    <ellipse cx="100" cy="928" rx="100" ry="28" fill="#1A1A1F" stroke="#52525B" stroke-width="2"/>

    <!-- Bed 1 (NiMo HDS) -->
    <g id="bed-r2501-1" transform="translate(10,60)">
      <rect width="180" height="155" rx="4" fill="#1E2218" stroke="#3F5F28" stroke-width="1.5"/>
      <text x="90" y="22" text-anchor="middle" font-family="monospace" font-size="10" fill="#86EFAC">BED 1 — NiMo HDS</text>
      <text x="90" y="38" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">Catalyst: 18.4 t  CoMo+NiMo</text>
      <text x="90" y="54" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">dP design: 0.6 bar</text>
      <text x="90" y="72" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">TIN →</text>
      <text x="90" y="90" text-anchor="middle" font-family="monospace" font-size="13" fill="#E4E4E7">370</text>
      <text x="90" y="106" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">°C</text>
      <text x="90" y="128" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">TOUT →</text>
      <text x="90" y="146" text-anchor="middle" font-family="monospace" font-size="13" fill="#EF4444">392</text>
    </g>

    <!-- Quench 1 -->
    <rect x="0" y="220" width="200" height="22" fill="#0D1520" stroke="#3B82F6" stroke-width="1"/>
    <text x="100" y="235" text-anchor="middle" font-family="monospace" font-size="8" fill="#60A5FA">QUENCH H2  Q-1  |  TI: 378°C after mix</text>

    <!-- Bed 2 (NiMo HDA) -->
    <g id="bed-r2501-2" transform="translate(10,245)">
      <rect width="180" height="155" rx="4" fill="#1E2218" stroke="#3F5F28" stroke-width="1.5"/>
      <text x="90" y="22" text-anchor="middle" font-family="monospace" font-size="10" fill="#86EFAC">BED 2 — NiMo HDA</text>
      <text x="90" y="38" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">Catalyst: 22.1 t  NiMo alumina</text>
      <text x="90" y="54" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">dP design: 0.5 bar</text>
      <text x="90" y="72" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">TIN →</text>
      <text x="90" y="90" text-anchor="middle" font-family="monospace" font-size="13" fill="#E4E4E7">378</text>
      <text x="90" y="106" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">°C</text>
      <text x="90" y="128" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">TOUT →</text>
      <text x="90" y="146" text-anchor="middle" font-family="monospace" font-size="13" fill="#EF4444">398</text>
    </g>

    <!-- Quench 2 -->
    <rect x="0" y="405" width="200" height="22" fill="#0D1520" stroke="#3B82F6" stroke-width="1"/>
    <text x="100" y="420" text-anchor="middle" font-family="monospace" font-size="8" fill="#60A5FA">QUENCH H2  Q-2  |  TI: 383°C after mix</text>

    <!-- Bed 3 (NiMo mild HC) -->
    <g id="bed-r2501-3" transform="translate(10,430)">
      <rect width="180" height="155" rx="4" fill="#1E2218" stroke="#3F5F28" stroke-width="1.5"/>
      <text x="90" y="22" text-anchor="middle" font-family="monospace" font-size="10" fill="#86EFAC">BED 3 — NiMo MHC</text>
      <text x="90" y="38" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">Catalyst: 24.8 t  NiMo/P</text>
      <text x="90" y="54" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">dP design: 0.4 bar</text>
      <text x="90" y="72" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">TIN →</text>
      <text x="90" y="90" text-anchor="middle" font-family="monospace" font-size="13" fill="#E4E4E7">383</text>
      <text x="90" y="106" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">°C</text>
      <text x="90" y="128" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">TOUT →</text>
      <text x="90" y="146" text-anchor="middle" font-family="monospace" font-size="13" fill="#EF4444">405</text>
    </g>

    <!-- Quench 3 -->
    <rect x="0" y="590" width="200" height="22" fill="#0D1520" stroke="#3B82F6" stroke-width="1"/>
    <text x="100" y="605" text-anchor="middle" font-family="monospace" font-size="8" fill="#60A5FA">QUENCH H2  Q-3  |  TI: 390°C after mix</text>

    <!-- Bed 4 (CoMo) -->
    <g id="bed-r2501-4" transform="translate(10,615)">
      <rect width="180" height="155" rx="4" fill="#1E221A" stroke="#5F6F28" stroke-width="1.5"/>
      <text x="90" y="22" text-anchor="middle" font-family="monospace" font-size="10" fill="#D9F99D">BED 4 — CoMo HDN</text>
      <text x="90" y="38" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">Catalyst: 20.0 t  CoMo/Al</text>
      <text x="90" y="54" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">dP design: 0.3 bar</text>
      <text x="90" y="72" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">TIN →</text>
      <text x="90" y="90" text-anchor="middle" font-family="monospace" font-size="13" fill="#E4E4E7">390</text>
      <text x="90" y="106" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">°C</text>
      <text x="90" y="128" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">TOUT →</text>
      <text x="90" y="146" text-anchor="middle" font-family="monospace" font-size="13" fill="#EF4444">408</text>
    </g>

    <!-- Bottom inert/support -->
    <rect x="10" y="775" width="180" height="30" fill="#27272A" rx="2"/>
    <text x="100" y="793" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">INERT SUPPORT BALLS</text>
  </g>
  <text x="800" y="1016" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">R-2501  PRETREATER</text>
  <text x="800" y="1030" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">ID: 3.0m  H: 22m  Design: 155 bar / 425°C</text>

  <!-- Feed inlet top -->
  <path id="pipe-feed-r2501" d="M 540 90 L 700 90" stroke="#EF4444" stroke-width="2.5" fill="none" marker-end="url(#arr-r)"/>
  <text x="540" y="80" font-family="monospace" font-size="10" fill="#EF4444">FEED IN</text>
  <text x="540" y="104" font-family="monospace" font-size="9" fill="#F87171">390°C / 148 bar</text>
  <!-- PI at inlet -->
  <rect x="548" y="108" width="54" height="24" rx="2" fill="#111113" stroke="#52525B" stroke-width="1"/>
  <text x="575" y="120" text-anchor="middle" font-family="monospace" font-size="7" fill="#71717A">PI-2501T</text>
  <text x="575" y="129" text-anchor="middle" font-family="monospace" font-size="9" fill="#E4E4E7">148 bar</text>

  <!-- TI at top -->
  <g id="ti-r2501-top" transform="translate(548,140)">
    <rect width="54" height="24" rx="2" fill="#111113" stroke="#52525B" stroke-width="1"/>
    <text x="27" y="12" text-anchor="middle" font-family="monospace" font-size="7" fill="#71717A">TI-2501-01</text>
    <text x="27" y="21" text-anchor="middle" font-family="monospace" font-size="9" fill="#E4E4E7">370°C</text>
  </g>

  <!-- Quench lines from left (H2 supply) -->
  <path id="pipe-quench-1" d="M 460 280 L 700 280" stroke="#34D399" stroke-width="2" fill="none" marker-end="url(#arr-g)"/>
  <text x="460" y="270" font-family="monospace" font-size="9" fill="#34D399">Q-H2 BED1/2</text>
  <text x="460" y="294" font-family="monospace" font-size="8" fill="#A1A1AA">FIC-2501-Q1</text>
  <rect x="470" y="258" width="55" height="24" rx="2" fill="#111113" stroke="#52525B" stroke-width="1"/>
  <text x="497" y="267" text-anchor="middle" font-family="monospace" font-size="7" fill="#71717A">TI-2501-B1</text>
  <text x="497" y="279" text-anchor="middle" font-family="monospace" font-size="9" fill="#EF4444">392°C</text>

  <path id="pipe-quench-2" d="M 460 465 L 700 465" stroke="#34D399" stroke-width="2" fill="none" marker-end="url(#arr-g)"/>
  <text x="460" y="455" font-family="monospace" font-size="9" fill="#34D399">Q-H2 BED2/3</text>
  <text x="460" y="479" font-family="monospace" font-size="8" fill="#A1A1AA">FIC-2501-Q2</text>
  <rect x="470" y="443" width="55" height="24" rx="2" fill="#111113" stroke="#52525B" stroke-width="1"/>
  <text x="497" y="452" text-anchor="middle" font-family="monospace" font-size="7" fill="#71717A">TI-2501-B2</text>
  <text x="497" y="464" text-anchor="middle" font-family="monospace" font-size="9" fill="#EF4444">398°C</text>

  <path id="pipe-quench-3" d="M 460 650 L 700 650" stroke="#34D399" stroke-width="2" fill="none" marker-end="url(#arr-g)"/>
  <text x="460" y="640" font-family="monospace" font-size="9" fill="#34D399">Q-H2 BED3/4</text>
  <text x="460" y="664" font-family="monospace" font-size="8" fill="#A1A1AA">FIC-2501-Q3</text>
  <rect x="470" y="628" width="55" height="24" rx="2" fill="#111113" stroke="#52525B" stroke-width="1"/>
  <text x="497" y="637" text-anchor="middle" font-family="monospace" font-size="7" fill="#71717A">TI-2501-B3</text>
  <text x="497" y="649" text-anchor="middle" font-family="monospace" font-size="9" fill="#EF4444">405°C</text>

  <!-- TI at bed 4 outlet -->
  <g id="ti-r2501-bed1-out" transform="translate(548,785)">
    <rect width="54" height="24" rx="2" fill="#111113" stroke="#52525B" stroke-width="1"/>
    <text x="27" y="12" text-anchor="middle" font-family="monospace" font-size="7" fill="#71717A">TI-2501-B4</text>
    <text x="27" y="21" text-anchor="middle" font-family="monospace" font-size="9" fill="#EF4444">408°C</text>
  </g>

  <!-- TI/PI at bottom outlet -->
  <g id="ti-r2501-bot" transform="translate(548,910)">
    <rect width="54" height="24" rx="2" fill="#111113" stroke="#52525B" stroke-width="1"/>
    <text x="27" y="12" text-anchor="middle" font-family="monospace" font-size="7" fill="#71717A">TI-2501-OUT</text>
    <text x="27" y="21" text-anchor="middle" font-family="monospace" font-size="9" fill="#EF4444">408°C</text>
  </g>
  <rect x="548" y="938" width="54" height="24" rx="2" fill="#111113" stroke="#52525B" stroke-width="1"/>
  <text x="575" y="947" text-anchor="middle" font-family="monospace" font-size="7" fill="#71717A">PI-2501-OUT</text>
  <text x="575" y="958" text-anchor="middle" font-family="monospace" font-size="9" fill="#E4E4E7">146 bar</text>

  <!-- Effluent outlet bottom -->
  <path id="pipe-effluent-r2501" d="M 700 985 L 540 985" stroke="#EF4444" stroke-width="2.5" fill="none" marker-end="url(#arr-r)"/>
  <text x="540" y="975" font-family="monospace" font-size="10" fill="#EF4444">EFFLUENT OUT</text>
  <text x="540" y="1000" font-family="monospace" font-size="9" fill="#F87171">408°C / 146 bar → R-2502</text>

  <!-- Right side: instrument/TI profile panel -->
  <rect x="930" y="60" width="560" height="940" rx="4" fill="#0D0D0F" stroke="#27272A" stroke-width="1"/>
  <text x="1210" y="88" text-anchor="middle" font-family="monospace" font-size="12" fill="#E4E4E7">TEMPERATURE PROFILE</text>
  <text x="1210" y="104" text-anchor="middle" font-family="monospace" font-size="9" fill="#52525B">24 thermocouples (6 per bed, top/mid/bot + wall)</text>
  <line x1="945" y1="112" x2="1475" y2="112" stroke="#27272A" stroke-width="1"/>
  <!-- Column headers -->
  <text x="970" y="130" font-family="monospace" font-size="8" fill="#71717A">TAG</text>
  <text x="1080" y="130" font-family="monospace" font-size="8" fill="#71717A">LOCATION</text>
  <text x="1280" y="130" font-family="monospace" font-size="8" fill="#71717A">°C</text>
  <text x="1360" y="130" font-family="monospace" font-size="8" fill="#71717A">STATUS</text>
  <line x1="945" y1="136" x2="1475" y2="136" stroke="#27272A" stroke-width="1"/>
  <!-- TI rows (24 TIs, 6 per bed) -->
  <!-- Bed 1 -->
  <text x="945" y="154" font-family="monospace" font-size="8" fill="#86EFAC">— BED 1 —</text>
  <text x="970" y="172" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2501-101</text><text x="1080" y="172" font-family="monospace" font-size="9" fill="#71717A">Bed 1 inlet</text><text x="1280" y="172" font-family="monospace" font-size="9" fill="#E4E4E7">370</text><text x="1360" y="172" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <text x="970" y="190" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2501-102</text><text x="1080" y="190" font-family="monospace" font-size="9" fill="#71717A">Bed 1 T/3</text><text x="1280" y="190" font-family="monospace" font-size="9" fill="#E4E4E7">378</text><text x="1360" y="190" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <text x="970" y="208" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2501-103</text><text x="1080" y="208" font-family="monospace" font-size="9" fill="#71717A">Bed 1 2T/3</text><text x="1280" y="208" font-family="monospace" font-size="9" fill="#E4E4E7">385</text><text x="1360" y="208" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <text x="970" y="226" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2501-104</text><text x="1080" y="226" font-family="monospace" font-size="9" fill="#71717A">Bed 1 outlet</text><text x="1280" y="226" font-family="monospace" font-size="9" fill="#EF4444">392</text><text x="1360" y="226" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <text x="970" y="244" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2501-105</text><text x="1080" y="244" font-family="monospace" font-size="9" fill="#71717A">Bed 1 wall N</text><text x="1280" y="244" font-family="monospace" font-size="9" fill="#E4E4E7">389</text><text x="1360" y="244" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <text x="970" y="262" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2501-106</text><text x="1080" y="262" font-family="monospace" font-size="9" fill="#71717A">Bed 1 wall S</text><text x="1280" y="262" font-family="monospace" font-size="9" fill="#E4E4E7">390</text><text x="1360" y="262" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <!-- Bed 2 -->
  <text x="945" y="282" font-family="monospace" font-size="8" fill="#86EFAC">— BED 2 —</text>
  <text x="970" y="300" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2501-201</text><text x="1080" y="300" font-family="monospace" font-size="9" fill="#71717A">Bed 2 inlet</text><text x="1280" y="300" font-family="monospace" font-size="9" fill="#E4E4E7">378</text><text x="1360" y="300" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <text x="970" y="318" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2501-202</text><text x="1080" y="318" font-family="monospace" font-size="9" fill="#71717A">Bed 2 T/3</text><text x="1280" y="318" font-family="monospace" font-size="9" fill="#E4E4E7">385</text><text x="1360" y="318" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <text x="970" y="336" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2501-203</text><text x="1080" y="336" font-family="monospace" font-size="9" fill="#71717A">Bed 2 2T/3</text><text x="1280" y="336" font-family="monospace" font-size="9" fill="#E4E4E7">391</text><text x="1360" y="336" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <text x="970" y="354" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2501-204</text><text x="1080" y="354" font-family="monospace" font-size="9" fill="#71717A">Bed 2 outlet</text><text x="1280" y="354" font-family="monospace" font-size="9" fill="#EF4444">398</text><text x="1360" y="354" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <text x="970" y="372" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2501-205</text><text x="1080" y="372" font-family="monospace" font-size="9" fill="#71717A">Bed 2 wall N</text><text x="1280" y="372" font-family="monospace" font-size="9" fill="#E4E4E7">395</text><text x="1360" y="372" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <text x="970" y="390" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2501-206</text><text x="1080" y="390" font-family="monospace" font-size="9" fill="#71717A">Bed 2 wall S</text><text x="1280" y="390" font-family="monospace" font-size="9" fill="#E4E4E7">396</text><text x="1360" y="390" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <!-- Bed 3 -->
  <text x="945" y="410" font-family="monospace" font-size="8" fill="#86EFAC">— BED 3 —</text>
  <text x="970" y="428" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2501-301</text><text x="1080" y="428" font-family="monospace" font-size="9" fill="#71717A">Bed 3 inlet</text><text x="1280" y="428" font-family="monospace" font-size="9" fill="#E4E4E7">383</text><text x="1360" y="428" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <text x="970" y="446" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2501-302</text><text x="1080" y="446" font-family="monospace" font-size="9" fill="#71717A">Bed 3 T/3</text><text x="1280" y="446" font-family="monospace" font-size="9" fill="#E4E4E7">392</text><text x="1360" y="446" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <text x="970" y="464" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2501-303</text><text x="1080" y="464" font-family="monospace" font-size="9" fill="#71717A">Bed 3 2T/3</text><text x="1280" y="464" font-family="monospace" font-size="9" fill="#E4E4E7">400</text><text x="1360" y="464" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <text x="970" y="482" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2501-304</text><text x="1080" y="482" font-family="monospace" font-size="9" fill="#71717A">Bed 3 outlet</text><text x="1280" y="482" font-family="monospace" font-size="9" fill="#EF4444">405</text><text x="1360" y="482" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <text x="970" y="500" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2501-305</text><text x="1080" y="500" font-family="monospace" font-size="9" fill="#71717A">Bed 3 wall N</text><text x="1280" y="500" font-family="monospace" font-size="9" fill="#E4E4E7">402</text><text x="1360" y="500" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <text x="970" y="518" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2501-306</text><text x="1080" y="518" font-family="monospace" font-size="9" fill="#71717A">Bed 3 wall S</text><text x="1280" y="518" font-family="monospace" font-size="9" fill="#E4E4E7">403</text><text x="1360" y="518" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <!-- Bed 4 -->
  <text x="945" y="538" font-family="monospace" font-size="8" fill="#D9F99D">— BED 4 —</text>
  <text x="970" y="556" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2501-401</text><text x="1080" y="556" font-family="monospace" font-size="9" fill="#71717A">Bed 4 inlet</text><text x="1280" y="556" font-family="monospace" font-size="9" fill="#E4E4E7">390</text><text x="1360" y="556" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <text x="970" y="574" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2501-402</text><text x="1080" y="574" font-family="monospace" font-size="9" fill="#71717A">Bed 4 T/3</text><text x="1280" y="574" font-family="monospace" font-size="9" fill="#E4E4E7">396</text><text x="1360" y="574" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <text x="970" y="592" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2501-403</text><text x="1080" y="592" font-family="monospace" font-size="9" fill="#71717A">Bed 4 2T/3</text><text x="1280" y="592" font-family="monospace" font-size="9" fill="#E4E4E7">403</text><text x="1360" y="592" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <g id="ti-r2501-bed2-out" transform="translate(945,600)">
    <text x="25" y="12" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2501-404</text><text x="135" y="12" font-family="monospace" font-size="9" fill="#71717A">Bed 4 outlet</text><text x="335" y="12" font-family="monospace" font-size="9" fill="#EF4444">408</text><text x="415" y="12" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  </g>
  <text x="970" y="630" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2501-405</text><text x="1080" y="630" font-family="monospace" font-size="9" fill="#71717A">Bed 4 wall N</text><text x="1280" y="630" font-family="monospace" font-size="9" fill="#E4E4E7">405</text><text x="1360" y="630" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <text x="970" y="648" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2501-406</text><text x="1080" y="648" font-family="monospace" font-size="9" fill="#71717A">Bed 4 wall S</text><text x="1280" y="648" font-family="monospace" font-size="9" fill="#E4E4E7">406</text><text x="1360" y="648" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <line x1="945" y1="658" x2="1475" y2="658" stroke="#27272A" stroke-width="1"/>
  <!-- WABT -->
  <text x="970" y="678" font-family="monospace" font-size="9" fill="#71717A">WABT (calc):</text>
  <text x="1200" y="678" font-family="monospace" font-size="12" fill="#E4E4E7">370°C</text>
  <text x="1320" y="678" font-family="monospace" font-size="8" fill="#52525B">SOR: 350  EOR: 420</text>
  <text x="970" y="698" font-family="monospace" font-size="9" fill="#71717A">Max ΔT bed:</text>
  <text x="1200" y="698" font-family="monospace" font-size="12" fill="#E4E4E7">22°C</text>
  <text x="1320" y="698" font-family="monospace" font-size="8" fill="#52525B">Limit: 30°C (HAZ trip)</text>
  <text x="970" y="718" font-family="monospace" font-size="9" fill="#71717A">Total dP:</text>
  <text x="1200" y="718" font-family="monospace" font-size="12" fill="#E4E4E7">1.8 bar</text>
  <text x="1320" y="718" font-family="monospace" font-size="8" fill="#52525B">Design: 4 bar limit</text>
  <text x="1210" y="990" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">U25 R-2501 PRETREATER REV.1</text>
</svg>$svg$,
  bindings = '{}'::jsonb,
  metadata = '{"width": 1920, "height": 1080}'::jsonb
WHERE id = 'b02feff2-dec9-4c8e-a647-4baf102c2ae8';

-- ============================================================
-- 10. HCU Reactor R-2502 (Cracker)
-- ============================================================
UPDATE design_objects
SET svg_data = $svg$<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080">
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#71717A"/></marker>
    <marker id="arr-g" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#34D399"/></marker>
    <marker id="arr-r" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#EF4444"/></marker>
  </defs>
  <rect width="100%" height="100%" fill="#09090B"/>
  <text x="960" y="36" text-anchor="middle" font-family="monospace" font-size="18" font-weight="bold" fill="#E4E4E7">UNIT 25 HCU — REACTOR R-2502 (CRACKER)</text>
  <text x="960" y="54" text-anchor="middle" font-family="monospace" font-size="11" fill="#52525B">NiW / USY ZEOLITE CATALYST  /  HIGH-CONVERSION HYDROCRACKING  /  3 BEDS</text>

  <!-- R-2502 Reactor vessel (tall, center) -->
  <g id="reactor-r2502" transform="translate(700,60)">
    <rect width="200" height="880" rx="12" fill="#18181B" stroke="#52525B" stroke-width="2"/>
    <ellipse cx="100" cy="12" rx="100" ry="28" fill="#1A1A1F" stroke="#52525B" stroke-width="2"/>
    <ellipse cx="100" cy="868" rx="100" ry="28" fill="#1A1A1F" stroke="#52525B" stroke-width="2"/>

    <!-- Bed 1 (NiW/USY — primary cracking) -->
    <g id="bed-r2502-1" transform="translate(10,58)">
      <rect width="180" height="200" rx="4" fill="#1E1A28" stroke="#6B21A8" stroke-width="1.5"/>
      <text x="90" y="22" text-anchor="middle" font-family="monospace" font-size="10" fill="#C084FC">BED 1 — NiW / USY</text>
      <text x="90" y="38" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">Catalyst: 28.5 t  NiW-zeolite</text>
      <text x="90" y="54" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">Activity: HIGH  |  Selectivity: MID</text>
      <text x="90" y="72" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">TIN</text>
      <text x="90" y="92" text-anchor="middle" font-family="monospace" font-size="16" fill="#E4E4E7">355</text>
      <text x="90" y="110" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">°C</text>
      <text x="90" y="140" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">TOUT</text>
      <text x="90" y="162" text-anchor="middle" font-family="monospace" font-size="16" fill="#EF4444">392</text>
      <text x="90" y="180" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">°C  (ΔT = 37°C)</text>
    </g>

    <!-- Quench 1 -->
    <rect x="0" y="263" width="200" height="22" fill="#0D1520" stroke="#3B82F6" stroke-width="1"/>
    <text x="100" y="278" text-anchor="middle" font-family="monospace" font-size="8" fill="#60A5FA">QUENCH H2  Q-1  |  TI: 370°C after mix</text>

    <!-- Bed 2 (NiW/USY second) -->
    <g id="bed-r2502-2" transform="translate(10,288)">
      <rect width="180" height="200" rx="4" fill="#1E1A28" stroke="#6B21A8" stroke-width="1.5"/>
      <text x="90" y="22" text-anchor="middle" font-family="monospace" font-size="10" fill="#C084FC">BED 2 — NiW / USY</text>
      <text x="90" y="38" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">Catalyst: 32.0 t  NiW-zeolite/Al</text>
      <text x="90" y="54" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">Activity: HIGH  |  dP design: 0.7 bar</text>
      <text x="90" y="72" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">TIN</text>
      <text x="90" y="92" text-anchor="middle" font-family="monospace" font-size="16" fill="#E4E4E7">370</text>
      <text x="90" y="110" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">°C</text>
      <text x="90" y="140" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">TOUT</text>
      <text x="90" y="162" text-anchor="middle" font-family="monospace" font-size="16" fill="#EF4444">407</text>
      <text x="90" y="180" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">°C  (ΔT = 37°C)</text>
    </g>

    <!-- Quench 2 -->
    <rect x="0" y="493" width="200" height="22" fill="#0D1520" stroke="#3B82F6" stroke-width="1"/>
    <text x="100" y="508" text-anchor="middle" font-family="monospace" font-size="8" fill="#60A5FA">QUENCH H2  Q-2  |  TI: 388°C after mix</text>

    <!-- Bed 3 (NiW/USY third — finishing) -->
    <g id="bed-r2502-3" transform="translate(10,518)">
      <rect width="180" height="200" rx="4" fill="#1E1A28" stroke="#7C3AED" stroke-width="1.5"/>
      <text x="90" y="22" text-anchor="middle" font-family="monospace" font-size="10" fill="#A78BFA">BED 3 — NiW FINISHING</text>
      <text x="90" y="38" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">Catalyst: 26.2 t  NiW low-zeolite</text>
      <text x="90" y="54" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">Selectivity: HIGH diesel / kero</text>
      <text x="90" y="72" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">TIN</text>
      <text x="90" y="92" text-anchor="middle" font-family="monospace" font-size="16" fill="#E4E4E7">388</text>
      <text x="90" y="110" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">°C</text>
      <text x="90" y="140" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">TOUT</text>
      <text x="90" y="162" text-anchor="middle" font-family="monospace" font-size="16" fill="#EF4444">418</text>
      <text x="90" y="180" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">°C  (ΔT = 30°C)</text>
    </g>

    <!-- Inert support -->
    <rect x="10" y="723" width="180" height="30" fill="#27272A" rx="2"/>
    <text x="100" y="741" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">INERT SUPPORT BALLS</text>
  </g>
  <text x="800" y="966" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">R-2502  CRACKER</text>
  <text x="800" y="980" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">ID: 3.2m  H: 20m  Design: 155 bar / 430°C</text>

  <!-- Feed inlet top (from R-2501) -->
  <path id="pipe-feed-r2502" d="M 540 90 L 700 90" stroke="#EF4444" stroke-width="2.5" fill="none" marker-end="url(#arr-r)"/>
  <text x="540" y="80" font-family="monospace" font-size="10" fill="#EF4444">FEED IN (FROM R-2501)</text>
  <text x="540" y="104" font-family="monospace" font-size="9" fill="#F87171">408°C / 146 bar</text>
  <!-- PI and TI at inlet -->
  <rect x="548" y="108" width="54" height="24" rx="2" fill="#111113" stroke="#52525B" stroke-width="1"/>
  <text x="575" y="118" text-anchor="middle" font-family="monospace" font-size="7" fill="#71717A">PI-2502T</text>
  <text x="575" y="129" text-anchor="middle" font-family="monospace" font-size="9" fill="#E4E4E7">146 bar</text>
  <g id="ti-r2502-top" transform="translate(548,140)">
    <rect width="54" height="24" rx="2" fill="#111113" stroke="#52525B" stroke-width="1"/>
    <text x="27" y="12" text-anchor="middle" font-family="monospace" font-size="7" fill="#71717A">TI-2502-01</text>
    <text x="27" y="21" text-anchor="middle" font-family="monospace" font-size="9" fill="#EF4444">355°C</text>
  </g>
  <!-- Note: feed enters at 355°C after inter-reactor cooler -->
  <text x="548" y="180" font-family="monospace" font-size="8" fill="#52525B">(inter-reactor cooled)</text>

  <!-- Quench lines -->
  <path id="pipe-quench-r2502-1" d="M 460 323 L 700 323" stroke="#34D399" stroke-width="2" fill="none" marker-end="url(#arr-g)"/>
  <text x="460" y="313" font-family="monospace" font-size="9" fill="#34D399">Q-H2 B1/B2</text>
  <text x="460" y="337" font-family="monospace" font-size="8" fill="#A1A1AA">FIC-2502-Q1</text>
  <rect x="470" y="298" width="55" height="24" rx="2" fill="#111113" stroke="#52525B" stroke-width="1"/>
  <text x="497" y="307" text-anchor="middle" font-family="monospace" font-size="7" fill="#71717A">TI-2502-B1</text>
  <text x="497" y="319" text-anchor="middle" font-family="monospace" font-size="9" fill="#EF4444">392°C</text>

  <path id="pipe-quench-r2502-2" d="M 460 553 L 700 553" stroke="#34D399" stroke-width="2" fill="none" marker-end="url(#arr-g)"/>
  <text x="460" y="543" font-family="monospace" font-size="9" fill="#34D399">Q-H2 B2/B3</text>
  <text x="460" y="567" font-family="monospace" font-size="8" fill="#A1A1AA">FIC-2502-Q2</text>
  <rect x="470" y="528" width="55" height="24" rx="2" fill="#111113" stroke="#52525B" stroke-width="1"/>
  <text x="497" y="537" text-anchor="middle" font-family="monospace" font-size="7" fill="#71717A">TI-2502-B2</text>
  <text x="497" y="549" text-anchor="middle" font-family="monospace" font-size="9" fill="#EF4444">407°C</text>

  <!-- Bed 2 outlet TI -->
  <g id="ti-r2502-bed1-out" transform="translate(548,490)">
    <rect width="54" height="24" rx="2" fill="#111113" stroke="#52525B" stroke-width="1"/>
    <text x="27" y="12" text-anchor="middle" font-family="monospace" font-size="7" fill="#71717A">TI-2502-B2O</text>
    <text x="27" y="21" text-anchor="middle" font-family="monospace" font-size="9" fill="#EF4444">407°C</text>
  </g>

  <!-- Bed 3 outlet TI -->
  <g id="ti-r2502-bed2-out" transform="translate(548,720)">
    <rect width="54" height="24" rx="2" fill="#111113" stroke="#52525B" stroke-width="1"/>
    <text x="27" y="12" text-anchor="middle" font-family="monospace" font-size="7" fill="#71717A">TI-2502-B3O</text>
    <text x="27" y="21" text-anchor="middle" font-family="monospace" font-size="9" fill="#EF4444">418°C</text>
  </g>
  <!-- Bottom TI/PI -->
  <g id="ti-r2502-bot" transform="translate(548,850)">
    <rect width="54" height="24" rx="2" fill="#111113" stroke="#52525B" stroke-width="1"/>
    <text x="27" y="12" text-anchor="middle" font-family="monospace" font-size="7" fill="#71717A">TI-2502-OUT</text>
    <text x="27" y="21" text-anchor="middle" font-family="monospace" font-size="9" fill="#EF4444">418°C</text>
  </g>
  <rect x="548" y="878" width="54" height="24" rx="2" fill="#111113" stroke="#52525B" stroke-width="1"/>
  <text x="575" y="887" text-anchor="middle" font-family="monospace" font-size="7" fill="#71717A">PI-2502-OUT</text>
  <text x="575" y="898" text-anchor="middle" font-family="monospace" font-size="9" fill="#E4E4E7">144 bar</text>

  <!-- Effluent outlet -->
  <path id="pipe-effluent-r2502" d="M 700 940 L 540 940" stroke="#EF4444" stroke-width="2.5" fill="none" marker-end="url(#arr-r)"/>
  <text x="540" y="930" font-family="monospace" font-size="10" fill="#EF4444">EFFLUENT OUT</text>
  <text x="540" y="955" font-family="monospace" font-size="9" fill="#F87171">418°C / 144 bar → E-2507 COOLER</text>

  <!-- Right panel: temperature profile -->
  <rect x="930" y="60" width="560" height="900" rx="4" fill="#0D0D0F" stroke="#27272A" stroke-width="1"/>
  <text x="1210" y="88" text-anchor="middle" font-family="monospace" font-size="12" fill="#E4E4E7">TEMPERATURE PROFILE</text>
  <text x="1210" y="104" text-anchor="middle" font-family="monospace" font-size="9" fill="#52525B">18 thermocouples (6 per bed)</text>
  <line x1="945" y1="112" x2="1475" y2="112" stroke="#27272A" stroke-width="1"/>
  <text x="970" y="130" font-family="monospace" font-size="8" fill="#71717A">TAG</text>
  <text x="1080" y="130" font-family="monospace" font-size="8" fill="#71717A">LOCATION</text>
  <text x="1280" y="130" font-family="monospace" font-size="8" fill="#71717A">°C</text>
  <text x="1360" y="130" font-family="monospace" font-size="8" fill="#71717A">STATUS</text>
  <line x1="945" y1="136" x2="1475" y2="136" stroke="#27272A" stroke-width="1"/>
  <!-- Bed 1 TIs -->
  <text x="945" y="154" font-family="monospace" font-size="8" fill="#C084FC">— BED 1 —</text>
  <text x="970" y="172" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2502-101</text><text x="1080" y="172" font-family="monospace" font-size="9" fill="#71717A">Inlet</text><text x="1280" y="172" font-family="monospace" font-size="9" fill="#E4E4E7">355</text><text x="1360" y="172" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <text x="970" y="190" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2502-102</text><text x="1080" y="190" font-family="monospace" font-size="9" fill="#71717A">T/3</text><text x="1280" y="190" font-family="monospace" font-size="9" fill="#E4E4E7">365</text><text x="1360" y="190" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <text x="970" y="208" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2502-103</text><text x="1080" y="208" font-family="monospace" font-size="9" fill="#71717A">2T/3</text><text x="1280" y="208" font-family="monospace" font-size="9" fill="#E4E4E7">380</text><text x="1360" y="208" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <text x="970" y="226" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2502-104</text><text x="1080" y="226" font-family="monospace" font-size="9" fill="#71717A">Outlet</text><text x="1280" y="226" font-family="monospace" font-size="9" fill="#EF4444">392</text><text x="1360" y="226" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <text x="970" y="244" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2502-105</text><text x="1080" y="244" font-family="monospace" font-size="9" fill="#71717A">Wall N</text><text x="1280" y="244" font-family="monospace" font-size="9" fill="#E4E4E7">388</text><text x="1360" y="244" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <text x="970" y="262" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2502-106</text><text x="1080" y="262" font-family="monospace" font-size="9" fill="#71717A">Wall S</text><text x="1280" y="262" font-family="monospace" font-size="9" fill="#E4E4E7">390</text><text x="1360" y="262" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <!-- Bed 2 TIs -->
  <text x="945" y="282" font-family="monospace" font-size="8" fill="#C084FC">— BED 2 —</text>
  <text x="970" y="300" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2502-201</text><text x="1080" y="300" font-family="monospace" font-size="9" fill="#71717A">Inlet</text><text x="1280" y="300" font-family="monospace" font-size="9" fill="#E4E4E7">370</text><text x="1360" y="300" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <text x="970" y="318" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2502-202</text><text x="1080" y="318" font-family="monospace" font-size="9" fill="#71717A">T/3</text><text x="1280" y="318" font-family="monospace" font-size="9" fill="#E4E4E7">382</text><text x="1360" y="318" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <text x="970" y="336" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2502-203</text><text x="1080" y="336" font-family="monospace" font-size="9" fill="#71717A">2T/3</text><text x="1280" y="336" font-family="monospace" font-size="9" fill="#E4E4E7">396</text><text x="1360" y="336" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <text x="970" y="354" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2502-204</text><text x="1080" y="354" font-family="monospace" font-size="9" fill="#71717A">Outlet</text><text x="1280" y="354" font-family="monospace" font-size="9" fill="#EF4444">407</text><text x="1360" y="354" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <text x="970" y="372" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2502-205</text><text x="1080" y="372" font-family="monospace" font-size="9" fill="#71717A">Wall N</text><text x="1280" y="372" font-family="monospace" font-size="9" fill="#E4E4E7">404</text><text x="1360" y="372" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <text x="970" y="390" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2502-206</text><text x="1080" y="390" font-family="monospace" font-size="9" fill="#71717A">Wall S</text><text x="1280" y="390" font-family="monospace" font-size="9" fill="#E4E4E7">405</text><text x="1360" y="390" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <!-- Bed 3 TIs -->
  <text x="945" y="410" font-family="monospace" font-size="8" fill="#A78BFA">— BED 3 —</text>
  <text x="970" y="428" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2502-301</text><text x="1080" y="428" font-family="monospace" font-size="9" fill="#71717A">Inlet</text><text x="1280" y="428" font-family="monospace" font-size="9" fill="#E4E4E7">388</text><text x="1360" y="428" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <text x="970" y="446" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2502-302</text><text x="1080" y="446" font-family="monospace" font-size="9" fill="#71717A">T/3</text><text x="1280" y="446" font-family="monospace" font-size="9" fill="#E4E4E7">400</text><text x="1360" y="446" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <text x="970" y="464" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2502-303</text><text x="1080" y="464" font-family="monospace" font-size="9" fill="#71717A">2T/3</text><text x="1280" y="464" font-family="monospace" font-size="9" fill="#E4E4E7">411</text><text x="1360" y="464" font-family="monospace" font-size="9" fill="#FBBF24">HIGH</text>
  <text x="970" y="482" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2502-304</text><text x="1080" y="482" font-family="monospace" font-size="9" fill="#71717A">Outlet</text><text x="1280" y="482" font-family="monospace" font-size="9" fill="#EF4444">418</text><text x="1360" y="482" font-family="monospace" font-size="9" fill="#FBBF24">HIGH</text>
  <text x="970" y="500" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2502-305</text><text x="1080" y="500" font-family="monospace" font-size="9" fill="#71717A">Wall N</text><text x="1280" y="500" font-family="monospace" font-size="9" fill="#E4E4E7">415</text><text x="1360" y="500" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <text x="970" y="518" font-family="monospace" font-size="9" fill="#A1A1AA">TI-2502-306</text><text x="1080" y="518" font-family="monospace" font-size="9" fill="#71717A">Wall S</text><text x="1280" y="518" font-family="monospace" font-size="9" fill="#E4E4E7">416</text><text x="1360" y="518" font-family="monospace" font-size="9" fill="#34D399">NORMAL</text>
  <line x1="945" y1="530" x2="1475" y2="530" stroke="#27272A" stroke-width="1"/>
  <!-- WABT / Key data -->
  <text x="970" y="554" font-family="monospace" font-size="9" fill="#71717A">WABT (calc):</text>
  <text x="1200" y="554" font-family="monospace" font-size="12" fill="#E4E4E7">388°C</text>
  <text x="1320" y="554" font-family="monospace" font-size="8" fill="#52525B">SOR 355  EOR 425</text>
  <text x="970" y="574" font-family="monospace" font-size="9" fill="#71717A">Max ΔT bed:</text>
  <text x="1200" y="574" font-family="monospace" font-size="12" fill="#FBBF24">37°C</text>
  <text x="1320" y="574" font-family="monospace" font-size="8" fill="#FBBF24">Limit: 30°C — MONITOR</text>
  <text x="970" y="594" font-family="monospace" font-size="9" fill="#71717A">Total dP:</text>
  <text x="1200" y="594" font-family="monospace" font-size="12" fill="#E4E4E7">2.1 bar</text>
  <text x="1320" y="594" font-family="monospace" font-size="8" fill="#52525B">Design: 4.5 bar</text>
  <text x="970" y="614" font-family="monospace" font-size="9" fill="#71717A">Single-pass conv:</text>
  <text x="1200" y="614" font-family="monospace" font-size="12" fill="#E4E4E7">68%</text>
  <text x="1320" y="614" font-family="monospace" font-size="8" fill="#52525B">Target: 70%</text>
  <text x="970" y="634" font-family="monospace" font-size="9" fill="#71717A">Diesel selectivity:</text>
  <text x="1200" y="634" font-family="monospace" font-size="12" fill="#E4E4E7">48%</text>
  <text x="1320" y="634" font-family="monospace" font-size="8" fill="#52525B">Naphtha sel.: 32%  Kero: 20%</text>
  <!-- High alarm box -->
  <rect x="945" y="660" width="510" height="60" rx="3" fill="#1C1008" stroke="#B45309" stroke-width="1.5"/>
  <text x="1200" y="682" text-anchor="middle" font-family="monospace" font-size="10" fill="#F59E0B">TEMPERATURE CAUTION</text>
  <text x="1200" y="700" text-anchor="middle" font-family="monospace" font-size="9" fill="#FCD34D">Bed 3 outlet 418°C — WABT trending. Review quench Q-2 rate.</text>
  <text x="1210" y="920" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">U25 R-2502 CRACKER REV.1</text>
</svg>$svg$,
  bindings = '{}'::jsonb,
  metadata = '{"width": 1920, "height": 1080}'::jsonb
WHERE id = '88b9bbfb-3808-48f4-9b92-76dc75347156';

-- ============================================================
-- 11. HCU Recycle Gas Compressor
-- ============================================================
UPDATE design_objects
SET svg_data = $svg$<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080">
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#71717A"/></marker>
    <marker id="arr-g" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#34D399"/></marker>
  </defs>
  <rect width="100%" height="100%" fill="#09090B"/>
  <text x="960" y="36" text-anchor="middle" font-family="monospace" font-size="18" font-weight="bold" fill="#E4E4E7">UNIT 25 HCU — RECYCLE GAS COMPRESSOR</text>
  <text x="960" y="54" text-anchor="middle" font-family="monospace" font-size="11" fill="#52525B">K-2501 MAKEUP H2  /  K-2502 RGC  /  C-2501 AMINE ABSORBER</text>

  <!-- Zone dividers -->
  <line x1="380" y1="60" x2="380" y2="1040" stroke="#27272A" stroke-width="1" stroke-dasharray="3,5"/>
  <line x1="960" y1="60" x2="960" y2="1040" stroke="#27272A" stroke-width="1" stroke-dasharray="3,5"/>
  <line x1="1420" y1="60" x2="1420" y2="1040" stroke="#27272A" stroke-width="1" stroke-dasharray="3,5"/>
  <text x="190" y="72" text-anchor="middle" font-family="monospace" font-size="10" fill="#52525B">AMINE ABSORBER</text>
  <text x="670" y="72" text-anchor="middle" font-family="monospace" font-size="10" fill="#52525B">RGC SUCTION / K-2502</text>
  <text x="1190" y="72" text-anchor="middle" font-family="monospace" font-size="10" fill="#52525B">RGC DISCHARGE / MAKEUP</text>
  <text x="1670" y="72" text-anchor="middle" font-family="monospace" font-size="10" fill="#52525B">INSTRUMENTS / DATA</text>

  <!-- C-2501 Amine Absorber (tall column, left) -->
  <g id="absorber-c2501" transform="translate(80,90)">
    <rect width="100" height="700" rx="8" fill="#18181B" stroke="#52525B" stroke-width="2"/>
    <text x="50" y="28" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">C-2501</text>
    <text x="50" y="44" text-anchor="middle" font-family="monospace" font-size="8" fill="#A1A1AA">AMINE</text>
    <text x="50" y="58" text-anchor="middle" font-family="monospace" font-size="8" fill="#A1A1AA">ABSORBER</text>
    <line x1="0" y1="160" x2="100" y2="160" stroke="#27272A" stroke-width="1"/>
    <line x1="0" y1="320" x2="100" y2="320" stroke="#27272A" stroke-width="1"/>
    <line x1="0" y1="480" x2="100" y2="480" stroke="#27272A" stroke-width="1"/>
    <line x1="0" y1="580" x2="100" y2="580" stroke="#27272A" stroke-width="1"/>
    <text x="50" y="245" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">MDEA</text>
    <text x="50" y="260" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">PACKING</text>
    <text x="50" y="405" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">H2S</text>
    <text x="50" y="420" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">ABSORB</text>
    <text x="50" y="530" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">WASH</text>
    <text x="50" y="545" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">SECTION</text>
  </g>
  <text x="130" y="804" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">C-2501</text>
  <text x="130" y="818" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">AMINE ABSORBER</text>
  <text x="130" y="832" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">130 bar  /  40°C</text>
  <text x="130" y="846" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">20 m  /  1.6m ID</text>

  <!-- Lean amine feed to top -->
  <path d="M 180 90 L 180 50 L 20 50" stroke="#71717A" stroke-width="1.5" fill="none" stroke-dasharray="3,3" marker-end="url(#arr)"/>
  <text x="100" y="40" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">LEAN AMINE</text>
  <text x="20" y="60" font-family="monospace" font-size="8" fill="#71717A">FROM ARS</text>

  <!-- Rich amine out bottom -->
  <path d="M 180 790 L 180 870 L 20 870" stroke="#71717A" stroke-width="1.5" fill="none" stroke-dasharray="3,3" marker-end="url(#arr)"/>
  <text x="100" y="890" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">RICH AMINE → ARS</text>

  <!-- Gas in at absorber bottom from HP Sep -->
  <path id="pipe-rg-from-sep" d="M 380 640 L 180 640" stroke="#71717A" stroke-width="2" fill="none" marker-end="url(#arr)"/>
  <text x="280" y="630" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">RECYCLE GAS</text>
  <text x="280" y="658" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">FROM HHPS  /  88% H2</text>

  <!-- Gas out absorber top (clean) to suction drum -->
  <path id="pipe-rg-to-absorber" d="M 180 90 L 180 80 L 380 80" stroke="#34D399" stroke-width="2" fill="none" marker-end="url(#arr-g)"/>
  <text x="280" y="70" text-anchor="middle" font-family="monospace" font-size="9" fill="#34D399">CLEAN RECYCLE GAS</text>
  <text x="280" y="96" text-anchor="middle" font-family="monospace" font-size="8" fill="#6EE7B7">H2S &lt;20 ppm</text>

  <!-- V-2506 Suction Drum -->
  <g id="vessel-v2506" transform="translate(400,115)">
    <rect width="140" height="55" rx="27" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <text x="70" y="22" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">V-2506</text>
    <text x="70" y="36" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">SUCTION DRUM</text>
    <text x="70" y="50" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">130 bar / 40°C</text>
  </g>
  <text x="470" y="182" text-anchor="middle" font-family="monospace" font-size="9" fill="#E4E4E7">V-2506</text>
  <path d="M 380 142 L 400 142" stroke="#34D399" stroke-width="2" fill="none"/>

  <!-- K-2502 RGC Compressor (large circle, center) -->
  <g id="compressor-k2502" transform="translate(510,220)">
    <circle cx="110" cy="110" r="110" fill="#18181B" stroke="#52525B" stroke-width="2.5"/>
    <!-- Spokes -->
    <line x1="110" y1="110" x2="110" y2="22" stroke="#3F3F46" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="110" y1="110" x2="186" y2="54" stroke="#3F3F46" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="110" y1="110" x2="198" y2="143" stroke="#3F3F46" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="110" y1="110" x2="110" y2="198" stroke="#3F3F46" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="110" y1="110" x2="34" y2="166" stroke="#3F3F46" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="110" y1="110" x2="22" y2="77" stroke="#3F3F46" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="110" cy="110" r="12" fill="#52525B"/>
    <text x="110" y="104" text-anchor="middle" font-family="monospace" font-size="13" fill="#E4E4E7">K-2502</text>
    <text x="110" y="122" text-anchor="middle" font-family="monospace" font-size="10" fill="#A1A1AA">RGC</text>
  </g>
  <text x="620" y="452" text-anchor="middle" font-family="monospace" font-size="11" fill="#E4E4E7">K-2502</text>
  <text x="620" y="468" text-anchor="middle" font-family="monospace" font-size="10" fill="#A1A1AA">RECYCLE GAS COMPRESSOR</text>
  <text x="620" y="484" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">CENTRIFUGAL  /  STEAM TURBINE DRIVE</text>
  <text x="620" y="498" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">7840 RPM  /  4.2 MW  /  135-155 bar</text>

  <!-- Suction line from drum to compressor -->
  <path id="pipe-rg-to-comp" d="M 540 170 L 540 220" stroke="#34D399" stroke-width="2" fill="none" marker-end="url(#arr-g)"/>

  <!-- Discharge from compressor -->
  <path id="pipe-rg-discharge" d="M 730 330 L 960 330" stroke="#34D399" stroke-width="2.5" fill="none" marker-end="url(#arr-g)"/>
  <text x="845" y="320" text-anchor="middle" font-family="monospace" font-size="9" fill="#34D399">DISCHARGE</text>
  <text x="845" y="346" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">155 bar / 65°C</text>

  <!-- V-2507 Discharge Separator -->
  <g id="vessel-v2507" transform="translate(960,305)">
    <rect width="130" height="50" rx="25" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <text x="65" y="20" text-anchor="middle" font-family="monospace" font-size="8" fill="#A1A1AA">V-2507</text>
    <text x="65" y="34" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">DISC. SEP.</text>
  </g>
  <text x="1025" y="370" text-anchor="middle" font-family="monospace" font-size="9" fill="#E4E4E7">V-2507</text>

  <!-- pipe-feed-mix: discharge meets makeup H2 before reactors -->
  <path id="pipe-feed-mix" d="M 1090 330 L 1200 330" stroke="#34D399" stroke-width="2.5" fill="none"/>

  <!-- K-2501 Makeup H2 compressor (smaller, upper right) -->
  <g id="compressor-k2501" transform="translate(1040,100)">
    <circle cx="70" cy="70" r="70" fill="#18181B" stroke="#52525B" stroke-width="2"/>
    <line x1="70" y1="70" x2="70" y2="14" stroke="#3F3F46" stroke-width="2"/>
    <line x1="70" y1="70" x2="119" y2="40" stroke="#3F3F46" stroke-width="2"/>
    <line x1="70" y1="70" x2="126" y2="84" stroke="#3F3F46" stroke-width="2"/>
    <line x1="70" y1="70" x2="70" y2="126" stroke="#3F3F46" stroke-width="2"/>
    <line x1="70" y1="70" x2="21" y2="100" stroke="#3F3F46" stroke-width="2"/>
    <line x1="70" y1="70" x2="14" y2="56" stroke="#3F3F46" stroke-width="2"/>
    <circle cx="70" cy="70" r="8" fill="#52525B"/>
    <text x="70" y="68" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">K-2501</text>
    <text x="70" y="82" text-anchor="middle" font-family="monospace" font-size="8" fill="#A1A1AA">MU-H2</text>
  </g>
  <text x="1110" y="195" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">K-2501</text>
  <text x="1110" y="209" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">MAKEUP H2 COMPRESSOR</text>
  <text x="1110" y="223" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">RECIPROCATING  /  ELECTRIC  /  150 bar</text>

  <!-- Makeup H2 inlet (from U24) -->
  <path id="pipe-makeup-h2-in" d="M 1420 170 L 1180 170" stroke="#34D399" stroke-width="2" fill="none" marker-end="url(#arr-g)"/>
  <text x="1300" y="160" text-anchor="middle" font-family="monospace" font-size="10" fill="#34D399">MAKEUP H2 FROM U24</text>
  <text x="1300" y="184" text-anchor="middle" font-family="monospace" font-size="9" fill="#6EE7B7">150 bar  /  99.9% H2</text>
  <!-- K-2501 connects -->
  <path d="M 1110 170 L 1110 200" stroke="#34D399" stroke-width="1.5" fill="none"/>

  <!-- Makeup H2 into recycle header -->
  <path id="pipe-makeup-to-recycle" d="M 1200 170 L 1200 330" stroke="#34D399" stroke-width="2" fill="none" marker-end="url(#arr-g)"/>
  <circle cx="1200" cy="330" r="6" fill="#27272A" stroke="#34D399" stroke-width="1.5"/>
  <text x="1212" y="260" font-family="monospace" font-size="8" fill="#34D399">MU+RG</text>
  <text x="1212" y="272" font-family="monospace" font-size="8" fill="#34D399">MIX</text>

  <!-- Combined H2 to reactors -->
  <path d="M 1206 330 L 1420 330" stroke="#34D399" stroke-width="2.5" fill="none" marker-end="url(#arr-g)"/>
  <text x="1313" y="320" text-anchor="middle" font-family="monospace" font-size="10" fill="#34D399">COMBINED H2 → REACTORS</text>
  <text x="1313" y="348" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">155 bar  /  38°C  /  90+ % H2</text>

  <!-- Instruments panel -->
  <rect x="1440" y="80" width="460" height="880" rx="4" fill="#0D0D0F" stroke="#27272A" stroke-width="1"/>
  <text x="1670" y="110" text-anchor="middle" font-family="monospace" font-size="12" fill="#E4E4E7">COMPRESSOR INSTRUMENTS</text>
  <line x1="1455" y1="118" x2="1885" y2="118" stroke="#27272A" stroke-width="1"/>
  <!-- K-2502 data -->
  <text x="1670" y="142" text-anchor="middle" font-family="monospace" font-size="10" fill="#71717A">K-2502 RGC</text>
  <text x="1455" y="168" font-family="monospace" font-size="9" fill="#71717A">SIC-2502 (speed):</text>
  <text x="1750" y="168" text-anchor="end" font-family="monospace" font-size="12" fill="#E4E4E7">7840 RPM</text>
  <text x="1455" y="192" font-family="monospace" font-size="9" fill="#71717A">Suction pressure:</text>
  <text x="1750" y="192" text-anchor="end" font-family="monospace" font-size="12" fill="#E4E4E7">130 bar</text>
  <text x="1455" y="216" font-family="monospace" font-size="9" fill="#71717A">Discharge pressure:</text>
  <text x="1750" y="216" text-anchor="end" font-family="monospace" font-size="12" fill="#E4E4E7">155 bar</text>
  <text x="1455" y="240" font-family="monospace" font-size="9" fill="#71717A">Suction temperature:</text>
  <text x="1750" y="240" text-anchor="end" font-family="monospace" font-size="12" fill="#E4E4E7">38°C</text>
  <text x="1455" y="264" font-family="monospace" font-size="9" fill="#71717A">Discharge temp:</text>
  <text x="1750" y="264" text-anchor="end" font-family="monospace" font-size="12" fill="#E4E4E7">65°C</text>
  <text x="1455" y="288" font-family="monospace" font-size="9" fill="#71717A">Flow (actual):</text>
  <text x="1750" y="288" text-anchor="end" font-family="monospace" font-size="12" fill="#E4E4E7">48200 Nm³/h</text>
  <text x="1455" y="312" font-family="monospace" font-size="9" fill="#71717A">Power (shaft):</text>
  <text x="1750" y="312" text-anchor="end" font-family="monospace" font-size="12" fill="#E4E4E7">4.18 MW</text>
  <line x1="1455" y1="324" x2="1885" y2="324" stroke="#27272A" stroke-width="1"/>
  <!-- Vibration -->
  <text x="1670" y="348" text-anchor="middle" font-family="monospace" font-size="10" fill="#71717A">VIBRATION MONITORING</text>
  <text x="1455" y="372" font-family="monospace" font-size="9" fill="#71717A">VIB-2502-DE-X:</text>
  <text x="1750" y="372" text-anchor="end" font-family="monospace" font-size="12" fill="#E4E4E7">26 µm</text>
  <text x="1455" y="396" font-family="monospace" font-size="9" fill="#71717A">VIB-2502-DE-Y:</text>
  <text x="1750" y="396" text-anchor="end" font-family="monospace" font-size="12" fill="#E4E4E7">28 µm</text>
  <text x="1455" y="420" font-family="monospace" font-size="9" fill="#71717A">VIB-2502-NDE-X:</text>
  <text x="1750" y="420" text-anchor="end" font-family="monospace" font-size="12" fill="#E4E4E7">24 µm</text>
  <text x="1455" y="444" font-family="monospace" font-size="9" fill="#71717A">VIB-2502-NDE-Y:</text>
  <text x="1750" y="444" text-anchor="end" font-family="monospace" font-size="12" fill="#E4E4E7">25 µm</text>
  <text x="1670" y="464" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">ALARM: 50µm  TRIP: 75µm  (API 670)</text>
  <line x1="1455" y1="472" x2="1885" y2="472" stroke="#27272A" stroke-width="1"/>
  <!-- K-2501 data -->
  <text x="1670" y="498" text-anchor="middle" font-family="monospace" font-size="10" fill="#71717A">K-2501 MAKEUP H2</text>
  <text x="1455" y="522" font-family="monospace" font-size="9" fill="#71717A">Suction pressure:</text>
  <text x="1750" y="522" text-anchor="end" font-family="monospace" font-size="12" fill="#E4E4E7">150 bar</text>
  <text x="1455" y="546" font-family="monospace" font-size="9" fill="#71717A">Discharge pressure:</text>
  <text x="1750" y="546" text-anchor="end" font-family="monospace" font-size="12" fill="#E4E4E7">155 bar</text>
  <text x="1455" y="570" font-family="monospace" font-size="9" fill="#71717A">Flow (makeup):</text>
  <text x="1750" y="570" text-anchor="end" font-family="monospace" font-size="12" fill="#E4E4E7">6340 Nm³/h</text>
  <text x="1455" y="594" font-family="monospace" font-size="9" fill="#71717A">Power:</text>
  <text x="1750" y="594" text-anchor="end" font-family="monospace" font-size="12" fill="#E4E4E7">0.48 MW</text>
  <line x1="1455" y1="606" x2="1885" y2="606" stroke="#27272A" stroke-width="1"/>
  <!-- Amine data -->
  <text x="1670" y="630" text-anchor="middle" font-family="monospace" font-size="10" fill="#71717A">C-2501 AMINE ABSORBER</text>
  <text x="1455" y="654" font-family="monospace" font-size="9" fill="#71717A">MDEA concentration:</text>
  <text x="1750" y="654" text-anchor="end" font-family="monospace" font-size="12" fill="#E4E4E7">40 wt%</text>
  <text x="1455" y="678" font-family="monospace" font-size="9" fill="#71717A">H2S in outlet:</text>
  <text x="1750" y="678" text-anchor="end" font-family="monospace" font-size="12" fill="#E4E4E7">18 ppm</text>
  <text x="1455" y="702" font-family="monospace" font-size="9" fill="#71717A">Lean amine T:</text>
  <text x="1750" y="702" text-anchor="end" font-family="monospace" font-size="12" fill="#E4E4E7">40°C</text>
  <text x="1455" y="726" font-family="monospace" font-size="9" fill="#71717A">Rich amine T:</text>
  <text x="1750" y="726" text-anchor="end" font-family="monospace" font-size="12" fill="#E4E4E7">48°C</text>
  <text x="1670" y="900" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">U25 RGC REV.1</text>
</svg>$svg$,
  bindings = '{}'::jsonb,
  metadata = '{"width": 1920, "height": 1080}'::jsonb
WHERE id = 'ea78e79a-c6cb-4219-8c32-85e11707eae7';

-- ============================================================
-- 13. Combined Unit 24 + Unit 25 Process Overview
-- ============================================================
UPDATE design_objects
SET svg_data = $svg$<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080">
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#71717A"/></marker>
    <marker id="arr-g" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#34D399"/></marker>
    <marker id="arr-r" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#EF4444"/></marker>
    <marker id="arr-o" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#F97316"/></marker>
  </defs>
  <rect width="100%" height="100%" fill="#09090B"/>
  <text x="960" y="38" text-anchor="middle" font-family="monospace" font-size="20" font-weight="bold" fill="#E4E4E7">UNITS 24 + 25 — COMBINED PROCESS OVERVIEW</text>
  <text x="960" y="58" text-anchor="middle" font-family="monospace" font-size="11" fill="#52525B">SMR HYDROGEN PLANT + HYDROCRACKER  /  INTEGRATED BLOCK FLOW</text>

  <!-- Center divider -->
  <line x1="960" y1="70" x2="960" y2="1050" stroke="#27272A" stroke-width="2" stroke-dasharray="6,4"/>

  <!-- ═══════════════════════════════════════════════════ -->
  <!--            UNIT 24 — LEFT HALF                      -->
  <!-- ═══════════════════════════════════════════════════ -->
  <g id="block-u24" transform="translate(20,80)">
    <!-- Unit 24 outer boundary -->
    <rect width="900" height="940" rx="8" fill="#0A0A0D" stroke="#27272A" stroke-width="1.5"/>
    <text x="450" y="30" text-anchor="middle" font-family="monospace" font-size="16" font-weight="bold" fill="#E4E4E7">UNIT 24 — HYDROGEN PLANT (SMR)</text>
    <text x="450" y="48" text-anchor="middle" font-family="monospace" font-size="10" fill="#52525B">STEAM METHANE REFORMING  /  99.9%+ H2</text>
    <line x1="0" y1="56" x2="900" y2="56" stroke="#27272A" stroke-width="1"/>

    <!-- Sub-blocks -->
    <!-- Feed Prep -->
    <rect x="20" y="75" width="160" height="110" rx="5" fill="#111113" stroke="#52525B" stroke-width="1"/>
    <text x="100" y="96" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">DESULFURIZATION</text>
    <text x="100" y="112" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">V-2401 ZnO vessel</text>
    <text x="100" y="126" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">H2S + COS removal</text>
    <text x="100" y="140" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">E-2401 preheat HX</text>
    <text x="100" y="160" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">NG: 380°C / 30 bar</text>
    <!-- feed arrow in -->
    <path d="M 0 130 L 20 130" stroke="#71717A" stroke-width="2" fill="none" marker-end="url(#arr)"/>
    <text x="-60" y="122" font-family="monospace" font-size="9" fill="#E4E4E7">NATURAL</text>
    <text x="-60" y="136" font-family="monospace" font-size="9" fill="#E4E4E7">GAS IN</text>

    <!-- Arrow desulf → reformer -->
    <path d="M 180 130 L 220 130" stroke="#71717A" stroke-width="1.5" fill="none" marker-end="url(#arr)"/>

    <!-- Reformer -->
    <rect x="220" y="65" width="170" height="235" rx="5" fill="#1C1917" stroke="#B45309" stroke-width="2"/>
    <text x="305" y="88" text-anchor="middle" font-family="monospace" font-size="11" fill="#F59E0B">H-2401</text>
    <text x="305" y="104" text-anchor="middle" font-family="monospace" font-size="10" fill="#D97706">REFORMER</text>
    <line x1="240" y1="115" x2="240" y2="280" stroke="#78350F" stroke-width="1.5" stroke-dasharray="3,3"/>
    <line x1="265" y1="115" x2="265" y2="280" stroke="#78350F" stroke-width="1.5" stroke-dasharray="3,3"/>
    <line x1="290" y1="115" x2="290" y2="280" stroke="#78350F" stroke-width="1.5" stroke-dasharray="3,3"/>
    <line x1="315" y1="115" x2="315" y2="280" stroke="#78350F" stroke-width="1.5" stroke-dasharray="3,3"/>
    <line x1="340" y1="115" x2="340" y2="280" stroke="#78350F" stroke-width="1.5" stroke-dasharray="3,3"/>
    <path d="M 238 284 Q 245 270 248 280 Q 252 268 255 280 Q 258 268 253 284 Z" fill="#F97316" opacity="0.8"/>
    <path d="M 263 284 Q 270 270 273 280 Q 277 268 280 280 Q 283 268 278 284 Z" fill="#F97316" opacity="0.8"/>
    <path d="M 288 284 Q 295 270 298 280 Q 302 268 305 280 Q 308 268 303 284 Z" fill="#F97316" opacity="0.8"/>
    <text x="305" y="125" text-anchor="middle" font-family="monospace" font-size="8" fill="#92400E">CH4+H2O → CO+3H2</text>
    <text x="305" y="140" text-anchor="middle" font-family="monospace" font-size="8" fill="#92400E">850°C / 30 bar</text>
    <text x="305" y="278" text-anchor="middle" font-family="monospace" font-size="8" fill="#F59E0B">Ni catalyst tubes</text>
    <text x="305" y="292" text-anchor="middle" font-family="monospace" font-size="8" fill="#D97706">80 MMBTU/hr</text>
    <!-- Stack above -->
    <rect x="297" y="25" width="16" height="38" fill="#27272A" stroke="#52525B" stroke-width="1"/>
    <text x="305" y="20" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">STACK</text>
    <!-- Steam inlet to reformer -->
    <path d="M 300 65 L 300 55 L 100 55 L 100 186" stroke="#60A5FA" stroke-width="1.5" fill="none" stroke-dasharray="4,3"/>
    <text x="200" y="48" text-anchor="middle" font-family="monospace" font-size="8" fill="#60A5FA">STEAM</text>

    <!-- WHB + Shift -->
    <rect x="405" y="100" width="130" height="180" rx="5" fill="#111113" stroke="#52525B" stroke-width="1"/>
    <text x="470" y="120" text-anchor="middle" font-family="monospace" font-size="9" fill="#E4E4E7">WHB + SHIFT</text>
    <text x="470" y="138" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">E-WHB heat recovery</text>
    <text x="470" y="152" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">R-2401 HTS reactor</text>
    <text x="470" y="166" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">R-2402 LTS reactor</text>
    <text x="470" y="180" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">CO+H2O → CO2+H2</text>
    <text x="470" y="196" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">415°C → 220°C</text>
    <text x="470" y="266" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">~42% H2</text>
    <path d="M 390 130 L 405 130" stroke="#EF4444" stroke-width="2" fill="none" marker-end="url(#arr-r)"/>

    <!-- PSA -->
    <rect x="550" y="100" width="130" height="180" rx="5" fill="#111113" stroke="#52525B" stroke-width="1"/>
    <text x="615" y="120" text-anchor="middle" font-family="monospace" font-size="9" fill="#E4E4E7">PSA UNIT</text>
    <text x="615" y="138" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">A-2401 A/B/C</text>
    <text x="615" y="152" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">Pressure swing adsorption</text>
    <text x="615" y="166" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">Molecular sieve adsorbent</text>
    <text x="615" y="180" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">3-bed VPSA cycle</text>
    <text x="615" y="266" text-anchor="middle" font-family="monospace" font-size="9" fill="#34D399">99.9%+ H2</text>
    <path d="M 535 190 L 550 190" stroke="#71717A" stroke-width="1.5" fill="none" marker-end="url(#arr)"/>

    <!-- Compression -->
    <rect x="695" y="100" width="130" height="180" rx="5" fill="#111113" stroke="#52525B" stroke-width="1"/>
    <text x="760" y="120" text-anchor="middle" font-family="monospace" font-size="9" fill="#E4E4E7">COMPRESSION</text>
    <text x="760" y="138" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">K-2401 reciprocating</text>
    <text x="760" y="152" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">3-stage / inter-cooled</text>
    <text x="760" y="166" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">5 bar → 150 bar</text>
    <text x="760" y="266" text-anchor="middle" font-family="monospace" font-size="9" fill="#34D399">150 bar / 38°C</text>
    <path d="M 680 190 L 695 190" stroke="#34D399" stroke-width="1.5" fill="none" marker-end="url(#arr-g)"/>

    <!-- Steam system sub-block -->
    <rect x="20" y="340" width="250" height="130" rx="5" fill="#0F1629" stroke="#3B82F6" stroke-width="1.5"/>
    <text x="145" y="360" text-anchor="middle" font-family="monospace" font-size="10" fill="#60A5FA">STEAM SYSTEM</text>
    <text x="145" y="378" text-anchor="middle" font-family="monospace" font-size="8" fill="#3B82F6">V-2401D Steam Drum  /  40 bar</text>
    <text x="145" y="394" text-anchor="middle" font-family="monospace" font-size="8" fill="#3B82F6">BFW preheat + superheater</text>
    <text x="145" y="410" text-anchor="middle" font-family="monospace" font-size="8" fill="#3B82F6">Export steam: 42 bar / 400°C</text>
    <text x="145" y="426" text-anchor="middle" font-family="monospace" font-size="8" fill="#3B82F6">Process steam to reformer</text>
    <path d="M 0 400 L 20 400" stroke="#60A5FA" stroke-width="1.5" fill="none" stroke-dasharray="3,3"/>
    <text x="-60" y="393" font-family="monospace" font-size="8" fill="#60A5FA">BFW IN</text>
    <path d="M 270 380 L 900 380" stroke="#60A5FA" stroke-width="1.5" fill="none" stroke-dasharray="3,3" marker-end="url(#arr)"/>
    <text x="585" y="372" text-anchor="middle" font-family="monospace" font-size="8" fill="#60A5FA">EXPORT STEAM</text>

    <!-- Fuel system sub-block -->
    <rect x="20" y="500" width="250" height="110" rx="5" fill="#1A0F08" stroke="#B45309" stroke-width="1"/>
    <text x="145" y="520" text-anchor="middle" font-family="monospace" font-size="10" fill="#F97316">FUEL GAS SYSTEM</text>
    <text x="145" y="538" text-anchor="middle" font-family="monospace" font-size="8" fill="#D97706">Import fuel + PSA tail gas</text>
    <text x="145" y="554" text-anchor="middle" font-family="monospace" font-size="8" fill="#D97706">Fuel header: 1.5 bar</text>
    <text x="145" y="570" text-anchor="middle" font-family="monospace" font-size="8" fill="#D97706">XV-0401 / FV-0401 control</text>
    <text x="145" y="590" text-anchor="middle" font-family="monospace" font-size="8" fill="#92400E">Burners: 80 MMBTU/hr design</text>
    <path d="M 0 555 L 20 555" stroke="#F97316" stroke-width="1.5" fill="none" stroke-dasharray="3,3"/>
    <text x="-60" y="548" font-family="monospace" font-size="8" fill="#F97316">FUEL IN</text>

    <!-- Utilities summary -->
    <rect x="290" y="340" width="590" height="270" rx="5" fill="#0D0D0F" stroke="#27272A" stroke-width="1"/>
    <text x="585" y="365" text-anchor="middle" font-family="monospace" font-size="11" fill="#71717A">UNIT 24 — OPERATING SUMMARY</text>
    <line x1="305" y1="373" x2="865" y2="373" stroke="#27272A" stroke-width="1"/>
    <text x="370" y="396" font-family="monospace" font-size="9" fill="#71717A">NG Feed rate:</text>
    <text x="620" y="396" text-anchor="end" font-family="monospace" font-size="10" fill="#E4E4E7">42,000 Nm³/h</text>
    <text x="370" y="416" font-family="monospace" font-size="9" fill="#71717A">H2 production:</text>
    <text x="620" y="416" text-anchor="end" font-family="monospace" font-size="10" fill="#34D399">135,000 Nm³/h</text>
    <text x="370" y="436" font-family="monospace" font-size="9" fill="#71717A">Export steam:</text>
    <text x="620" y="436" text-anchor="end" font-family="monospace" font-size="10" fill="#60A5FA">42 bar / 120 t/h</text>
    <text x="370" y="456" font-family="monospace" font-size="9" fill="#71717A">Reformer outlet T:</text>
    <text x="620" y="456" text-anchor="end" font-family="monospace" font-size="10" fill="#EF4444">850°C</text>
    <text x="370" y="476" font-family="monospace" font-size="9" fill="#71717A">SMR efficiency:</text>
    <text x="620" y="476" text-anchor="end" font-family="monospace" font-size="10" fill="#E4E4E7">78%</text>
    <text x="370" y="496" font-family="monospace" font-size="9" fill="#71717A">Fuel consumed:</text>
    <text x="620" y="496" text-anchor="end" font-family="monospace" font-size="10" fill="#F97316">80 MMBTU/hr</text>
    <text x="370" y="516" font-family="monospace" font-size="9" fill="#71717A">CO2 emission:</text>
    <text x="620" y="516" text-anchor="end" font-family="monospace" font-size="10" fill="#E4E4E7">8.2 t/h</text>
    <text x="370" y="536" font-family="monospace" font-size="9" fill="#71717A">Stack NOx:</text>
    <text x="620" y="536" text-anchor="end" font-family="monospace" font-size="10" fill="#E4E4E7">42 mg/Nm³</text>
    <text x="370" y="568" font-family="monospace" font-size="9" fill="#52525B">H2 purity: 99.96%  |  Export pressure: 150 bar  |  Temp: 38°C</text>
    <text x="370" y="584" font-family="monospace" font-size="9" fill="#52525B">Catalyst age: 14 months  |  Last turnaround: 14 months ago</text>
  </g>

  <!-- ═══════════════════════════════════════════════════ -->
  <!--             UNIT 25 — RIGHT HALF                    -->
  <!-- ═══════════════════════════════════════════════════ -->
  <g id="block-u25" transform="translate(980,80)">
    <rect width="920" height="940" rx="8" fill="#0A0A0D" stroke="#27272A" stroke-width="1.5"/>
    <text x="460" y="30" text-anchor="middle" font-family="monospace" font-size="16" font-weight="bold" fill="#E4E4E7">UNIT 25 — HYDROCRACKER (HCU)</text>
    <text x="460" y="48" text-anchor="middle" font-family="monospace" font-size="10" fill="#52525B">VACUUM GAS OIL HYDROCRACKING  /  DISTILLATE MAXIMIZATION</text>
    <line x1="0" y1="56" x2="920" y2="56" stroke="#27272A" stroke-width="1"/>

    <!-- VGO Feed in -->
    <path d="M 0 200 L 20 200" stroke="#71717A" stroke-width="2" fill="none" marker-end="url(#arr)"/>
    <text x="-70" y="192" font-family="monospace" font-size="9" fill="#E4E4E7">VGO FEED</text>
    <text x="-70" y="208" font-family="monospace" font-size="9" fill="#71717A">12-14° API</text>

    <!-- Feed Prep block -->
    <rect x="20" y="100" width="155" height="200" rx="5" fill="#111113" stroke="#52525B" stroke-width="1"/>
    <text x="97" y="122" text-anchor="middle" font-family="monospace" font-size="9" fill="#E4E4E7">FEED PREP</text>
    <text x="97" y="140" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">V-2501 surge drum</text>
    <text x="97" y="154" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">P-2501A/B pumps</text>
    <text x="97" y="168" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">E-2501-E-2505</text>
    <text x="97" y="182" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">Feed/effluent HXs</text>
    <text x="97" y="196" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">H-2501 charge heater</text>
    <text x="97" y="276" text-anchor="middle" font-family="monospace" font-size="9" fill="#EF4444">390°C / 148 bar</text>
    <path d="M 175 200 L 200 200" stroke="#EF4444" stroke-width="1.5" fill="none" marker-end="url(#arr-r)"/>

    <!-- Reactors block -->
    <rect x="200" y="75" width="155" height="235" rx="5" fill="#1E1A28" stroke="#6B21A8" stroke-width="2"/>
    <text x="277" y="98" text-anchor="middle" font-family="monospace" font-size="10" fill="#C084FC">REACTORS</text>
    <text x="277" y="116" text-anchor="middle" font-family="monospace" font-size="8" fill="#A78BFA">R-2501 Pretreater</text>
    <text x="277" y="130" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">NiMo, 4 beds</text>
    <text x="277" y="144" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">350-420°C</text>
    <line x1="210" y1="158" x2="345" y2="158" stroke="#27272A" stroke-width="1" stroke-dasharray="2,3"/>
    <text x="277" y="176" text-anchor="middle" font-family="monospace" font-size="8" fill="#A78BFA">R-2502 Cracker</text>
    <text x="277" y="190" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">NiW / USY zeolite</text>
    <text x="277" y="204" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">3 beds</text>
    <text x="277" y="218" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">355-425°C</text>
    <text x="277" y="286" text-anchor="middle" font-family="monospace" font-size="9" fill="#EF4444">418°C / 144 bar</text>
    <path d="M 355 195 L 380 195" stroke="#EF4444" stroke-width="1.5" fill="none" marker-end="url(#arr-r)"/>

    <!-- HP Sep block -->
    <rect x="380" y="100" width="145" height="180" rx="5" fill="#111113" stroke="#52525B" stroke-width="1"/>
    <text x="452" y="122" text-anchor="middle" font-family="monospace" font-size="9" fill="#E4E4E7">HP SEPARATION</text>
    <text x="452" y="140" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">E-2507 air cooler</text>
    <text x="452" y="154" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">V-2502 HHPS</text>
    <text x="452" y="168" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">V-2503 HPS</text>
    <text x="452" y="182" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">C-2501 amine abs</text>
    <text x="452" y="196" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">K-2502 RGC</text>
    <text x="452" y="262" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">Liquid to frac</text>
    <path d="M 525 195 L 550 195" stroke="#71717A" stroke-width="1.5" fill="none" marker-end="url(#arr)"/>

    <!-- Fractionation block -->
    <rect x="550" y="100" width="145" height="180" rx="5" fill="#111113" stroke="#52525B" stroke-width="1"/>
    <text x="622" y="122" text-anchor="middle" font-family="monospace" font-size="9" fill="#E4E4E7">FRACTIONATION</text>
    <text x="622" y="140" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">C-2502 main frac</text>
    <text x="622" y="154" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">70 trays</text>
    <text x="622" y="168" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">3 pumparounds</text>
    <text x="622" y="182" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">C-2503 stabilizer</text>
    <text x="622" y="196" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">V-2504 reflux drum</text>
    <path d="M 695 195 L 730 195" stroke="#71717A" stroke-width="1.5" fill="none" marker-end="url(#arr)"/>

    <!-- Products column (right) -->
    <!-- LPG -->
    <path d="M 730 120 L 900 120" stroke="#71717A" stroke-width="1.5" fill="none" marker-end="url(#arr)"/>
    <text x="815" y="112" text-anchor="middle" font-family="monospace" font-size="9" fill="#E4E4E7">LPG</text>
    <text x="815" y="134" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">12 m³/h</text>
    <!-- Lt Naphtha -->
    <path d="M 730 160 L 900 160" stroke="#71717A" stroke-width="1.5" fill="none" marker-end="url(#arr)"/>
    <text x="815" y="152" text-anchor="middle" font-family="monospace" font-size="9" fill="#E4E4E7">LT NAPHTHA</text>
    <text x="815" y="174" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">28 m³/h</text>
    <!-- Hvy Naphtha -->
    <path d="M 730 200 L 900 200" stroke="#71717A" stroke-width="1.5" fill="none" marker-end="url(#arr)"/>
    <text x="815" y="192" text-anchor="middle" font-family="monospace" font-size="9" fill="#E4E4E7">HVY NAPHTHA</text>
    <text x="815" y="214" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">52 m³/h</text>
    <!-- Kerosene -->
    <path d="M 730 240" fill="none"/>
    <path d="M 730 240 L 900 240" stroke="#71717A" stroke-width="1.5" fill="none" marker-end="url(#arr)"/>
    <text x="815" y="232" text-anchor="middle" font-family="monospace" font-size="9" fill="#E4E4E7">KEROSENE</text>
    <text x="815" y="254" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">76 m³/h</text>
    <!-- Diesel -->
    <path d="M 730 280 L 900 280" stroke="#71717A" stroke-width="2" fill="none" marker-end="url(#arr)"/>
    <text x="815" y="272" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">DIESEL</text>
    <text x="815" y="294" text-anchor="middle" font-family="monospace" font-size="8" fill="#34D399">142 m³/h</text>
    <!-- UCO -->
    <path d="M 730 320 L 900 320" stroke="#71717A" stroke-width="1.5" fill="none" marker-end="url(#arr)"/>
    <text x="815" y="312" text-anchor="middle" font-family="monospace" font-size="9" fill="#E4E4E7">UCO</text>
    <text x="815" y="334" text-anchor="middle" font-family="monospace" font-size="8" fill="#71717A">38 m³/h</text>

    <!-- Recycle H2 loop arrow (from RGC back to reactors) -->
    <path d="M 452 100 L 452 80 L 280 80 L 280 75" stroke="#34D399" stroke-width="1.5" fill="none" stroke-dasharray="5,3" marker-end="url(#arr-g)"/>
    <text x="366" y="72" text-anchor="middle" font-family="monospace" font-size="8" fill="#34D399">RECYCLE H2  155 bar</text>

    <!-- Unit 25 Operating Summary -->
    <rect x="20" y="340" width="880" height="290" rx="5" fill="#0D0D0F" stroke="#27272A" stroke-width="1"/>
    <text x="460" y="365" text-anchor="middle" font-family="monospace" font-size="11" fill="#71717A">UNIT 25 — OPERATING SUMMARY</text>
    <line x1="35" y1="373" x2="885" y2="373" stroke="#27272A" stroke-width="1"/>
    <!-- 2-column layout -->
    <text x="100" y="396" font-family="monospace" font-size="9" fill="#71717A">VGO feed rate:</text>
    <text x="290" y="396" text-anchor="end" font-family="monospace" font-size="10" fill="#E4E4E7">348 m³/h</text>
    <text x="100" y="416" font-family="monospace" font-size="9" fill="#71717A">Design rate:</text>
    <text x="290" y="416" text-anchor="end" font-family="monospace" font-size="10" fill="#E4E4E7">420 m³/h</text>
    <text x="100" y="436" font-family="monospace" font-size="9" fill="#71717A">% utilization:</text>
    <text x="290" y="436" text-anchor="end" font-family="monospace" font-size="10" fill="#E4E4E7">82.9%</text>
    <text x="100" y="456" font-family="monospace" font-size="9" fill="#71717A">Conversion:</text>
    <text x="290" y="456" text-anchor="end" font-family="monospace" font-size="10" fill="#E4E4E7">68%</text>
    <text x="100" y="476" font-family="monospace" font-size="9" fill="#71717A">H2 makeup:</text>
    <text x="290" y="476" text-anchor="end" font-family="monospace" font-size="10" fill="#34D399">6340 Nm³/h</text>
    <text x="100" y="496" font-family="monospace" font-size="9" fill="#71717A">H2 consumption:</text>
    <text x="290" y="496" text-anchor="end" font-family="monospace" font-size="10" fill="#E4E4E7">1.82 wt%</text>
    <text x="100" y="516" font-family="monospace" font-size="9" fill="#71717A">RGC speed:</text>
    <text x="290" y="516" text-anchor="end" font-family="monospace" font-size="10" fill="#E4E4E7">7840 RPM</text>
    <text x="100" y="536" font-family="monospace" font-size="9" fill="#71717A">Heater duty:</text>
    <text x="290" y="536" text-anchor="end" font-family="monospace" font-size="10" fill="#F97316">39.2 MMBTU/hr</text>
    <!-- Second column -->
    <text x="480" y="396" font-family="monospace" font-size="9" fill="#71717A">Diesel yield:</text>
    <text x="860" y="396" text-anchor="end" font-family="monospace" font-size="10" fill="#E4E4E7">41 vol%</text>
    <text x="480" y="416" font-family="monospace" font-size="9" fill="#71717A">Diesel S:</text>
    <text x="860" y="416" text-anchor="end" font-family="monospace" font-size="10" fill="#34D399">8 ppm (ULSD)</text>
    <text x="480" y="436" font-family="monospace" font-size="9" fill="#71717A">Kero yield:</text>
    <text x="860" y="436" text-anchor="end" font-family="monospace" font-size="10" fill="#E4E4E7">22 vol%</text>
    <text x="480" y="456" font-family="monospace" font-size="9" fill="#71717A">Naphtha yield:</text>
    <text x="860" y="456" text-anchor="end" font-family="monospace" font-size="10" fill="#E4E4E7">23 vol%</text>
    <text x="480" y="476" font-family="monospace" font-size="9" fill="#71717A">UCO:</text>
    <text x="860" y="476" text-anchor="end" font-family="monospace" font-size="10" fill="#E4E4E7">11 vol%</text>
    <text x="480" y="496" font-family="monospace" font-size="9" fill="#71717A">R-2501 WABT:</text>
    <text x="860" y="496" text-anchor="end" font-family="monospace" font-size="10" fill="#E4E4E7">370°C</text>
    <text x="480" y="516" font-family="monospace" font-size="9" fill="#71717A">R-2502 WABT:</text>
    <text x="860" y="516" text-anchor="end" font-family="monospace" font-size="10" fill="#FBBF24">388°C (monitor)</text>
    <text x="480" y="536" font-family="monospace" font-size="9" fill="#71717A">Rec. gas purity:</text>
    <text x="860" y="536" text-anchor="end" font-family="monospace" font-size="10" fill="#34D399">88% H2</text>
    <line x1="35" y1="550" x2="885" y2="550" stroke="#27272A" stroke-width="1"/>
    <text x="460" y="572" text-anchor="middle" font-family="monospace" font-size="9" fill="#52525B">PRODUCT RATES:  LPG 12  |  Lt.Naphtha 28  |  Hvy.Naphtha 52  |  Kerosene 76  |  Diesel 142  |  UCO 38  (all m³/h)</text>
    <text x="460" y="592" text-anchor="middle" font-family="monospace" font-size="9" fill="#52525B">ALL PRODUCTS MEET CURRENT SPECIFICATIONS  |  NEXT CATALYST CHANGEOUT: Q2 NEXT YEAR</text>
    <text x="460" y="612" text-anchor="middle" font-family="monospace" font-size="8" fill="#52525B">Catalyst age R-2501: 14 months  |  R-2502: 11 months  |  Run length remaining: ~22 months</text>
  </g>

  <!-- H2 Transfer Line (CENTER — between the two units) -->
  <g id="pipe-h2-transfer" transform="translate(900,240)">
    <!-- Transfer pipe -->
    <path d="M 20 0 L 100 0" stroke="#34D399" stroke-width="4" fill="none" marker-end="url(#arr-g)"/>
    <!-- H2 label box -->
    <rect x="18" y="-28" width="84" height="22" rx="3" fill="#0A1A12" stroke="#34D399" stroke-width="1.5"/>
    <text x="60" y="-13" text-anchor="middle" font-family="monospace" font-size="10" fill="#34D399">H₂ EXPORT</text>
    <!-- Flow data below pipe -->
    <text x="60" y="16" text-anchor="middle" font-family="monospace" font-size="9" fill="#6EE7B7">135,000 Nm³/h</text>
    <text x="60" y="30" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">150 bar / 38°C</text>
    <text x="60" y="44" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">99.96% purity</text>
  </g>

  <!-- Footer -->
  <text x="960" y="1068" text-anchor="middle" font-family="monospace" font-size="9" fill="#52525B">UNITS 24+25 COMBINED OVERVIEW REV.1  /  ALL VALUES CURRENT SHIFT AVERAGE</text>
</svg>$svg$,
  bindings = '{}'::jsonb,
  metadata = '{"width": 1920, "height": 1080}'::jsonb
WHERE id = '7870402e-22cd-4c32-a873-a6d659e7d3da';
