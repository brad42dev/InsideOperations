-- Seed: Process Graphics (13 SVG graphics with OPC bindings)
-- Generated: 2026-03-16
-- This migration inserts/updates all 13 process graphics with their OPC point bindings.

-- Combined Unit 24 + Unit 25 Process
INSERT INTO design_objects (id, name, type, svg_data, bindings, metadata, created_by)
VALUES (
  '7870402e-22cd-4c32-a873-a6d659e7d3da',
  'Combined Unit 24 + Unit 25 Process',
  'graphic',
  $svg$<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5120 2880"><rect width="100%" height="100%" fill="#09090B"/>
<path id="pipe-u24-ng-feed" d="M 50 1100 L 220 1100" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-u24-desulf-to-preheat" d="M 220 1100 L 370 1100" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-u24-preheat-to-reformer" d="M 370 1100 L 500 1100 L 500 800 L 570 800" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-u24-reformer-outlet" d="M 570 900 L 690 900 L 900 900 L 900 990 L 1070 990" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-u24-whb-to-hts" d="M 1070 990 L 1150 820 L 1200 820" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-u24-hts-to-intercooler" d="M 1200 1000 L 1290 990" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-u24-intercooler-to-lts" d="M 1290 990 L 1310 820 L 1360 820" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-u24-lts-to-psa" d="M 1360 1000 L 1450 990 L 1480 990" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-u24-psa-to-compressor" d="M 1680 990 L 1690 990" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-u24-tail-gas" d="M 1550 1300 L 700 1300 L 700 1480" stroke="#FBBF24" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Tail Gas</text>
<path id="pipe-u24-steam-drum-to-reformer" d="M 600 380 L 600 600" stroke="#E4E4E7" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-u24-bfw-to-steam-drum" d="M 530 380 L 600 380" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">BFW</text>
<path id="pipe-u24-export-steam" d="M 600 280 L 700 280 L 740 280" stroke="#E4E4E7" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Export Steam</text>
<path id="pipe-u24-fuel-gas-in" d="M 680 1560 L 570 1560" stroke="#FBBF24" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-u24-flue-gas" d="M 570 200 L 1000 200 L 1000 80" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Flue Gas</text>
<path id="pipe-interconnect-h2-delivery" d="M 1690 990 L 1740 990 L 2050 990 L 2050 780" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">H₂ Delivery</text>
<path id="pipe-interconnect-makeup-to-hcu" d="M 2050 680 L 2050 350 L 2820 350" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Makeup H₂</text>
<path id="pipe-u25-feed-to-v2501" d="M 2150 1100 L 2220 1100" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-u25-v2501-to-hx" d="M 2220 1100 L 2340 1100" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-u25-hx-train" d="M 2340 1100 L 2460 1100 L 2580 1100" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-u25-pump-to-heater" d="M 2670 1100 L 2700 1100 L 2820 1100" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-u25-heater-to-r2501" d="M 2820 600 L 3100 600" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-u25-r2501-to-r2502" d="M 3100 1380 L 3250 1380 L 3250 600 L 3410 600" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-u25-r2502-effluent" d="M 3410 1380 L 3560 1380 L 3560 650 L 3670 650" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-u25-aircooler-to-hhps" d="M 3670 650 L 3830 650" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-u25-recycle-gas-arc" d="M 4330 350 L 2820 350" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">RECYCLE H₂</text>
<path id="pipe-u25-frac-feed" d="M 4050 1100 L 4600 1100" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-u25-lpg-product" d="M 4870 550 L 5070 550" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">LPG</text>
<path id="pipe-u25-ln-product" d="M 4900 610 L 5070 610" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">LN</text>
<path id="pipe-u25-hn-product" d="M 4960 670 L 5070 670" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">HN</text>
<path id="pipe-u25-kero-product" d="M 4700 780 L 5070 780" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Kero</text>
<path id="pipe-u25-diesel-product" d="M 4720 680 L 5070 680" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Diesel</text>
<path id="pipe-u25-uco-product" d="M 4700 1800 L 5070 1800" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">UCO</text>
<path id="pipe-u25-amine-circuit" d="M 4130 400 L 4050 400" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Amine</text>
<text x="50" y="42" font-family="monospace" font-size="14" fill="#A1A1AA">UNIT 24 + UNIT 25 — INTEGRATED H₂ PRODUCTION & HYDROCRACKING</text>
<text x="5000" y="42" font-family="monospace" font-size="14" fill="#71717A">[live timestamp]</text>
<text x="880" y="230" font-family="monospace" font-size="14" fill="#E5E5E5">UNIT 24 — H₂ PLANT</text>
<text x="3580" y="230" font-family="monospace" font-size="14" fill="#E5E5E5">UNIT 25 — HYDROCRACKER</text>
<text x="1900" y="100" font-family="monospace" font-size="14" fill="#71717A rotate 90°">UNIT 24 | UNIT 25</text>
<text x="1860" y="850" font-family="monospace" font-size="14" fill="#A1A1AA">H₂ DELIVERY</text>
<text x="1860" y="870" font-family="monospace" font-size="14" fill="#71717A">Unit 24 → Unit 25</text>
<text x="3600" y="310" font-family="monospace" font-size="14" fill="#71717A">RECYCLE H₂</text>
<text x="220" y="1190" font-family="monospace" font-size="14" fill="#A1A1AA">V-2401</text>
<text x="370" y="1190" font-family="monospace" font-size="14" fill="#A1A1AA">E-2401</text>
<text x="570" y="1530" font-family="monospace" font-size="14" fill="#A1A1AA">H-2401</text>
<text x="600" y="420" font-family="monospace" font-size="14" fill="#A1A1AA">Steam Drum</text>
<text x="1070" y="1080" font-family="monospace" font-size="14" fill="#A1A1AA">E-2402</text>
<text x="1200" y="1250" font-family="monospace" font-size="14" fill="#A1A1AA">HTS</text>
<text x="1360" y="1250" font-family="monospace" font-size="14" fill="#A1A1AA">LTS</text>
<text x="1560" y="1270" font-family="monospace" font-size="14" fill="#A1A1AA">PSA Unit</text>
<text x="1690" y="1130" font-family="monospace" font-size="14" fill="#A1A1AA">K-2401</text>
<text x="2050" y="870" font-family="monospace" font-size="14" fill="#A1A1AA">K-2502</text>
<text x="2220" y="1190" font-family="monospace" font-size="14" fill="#A1A1AA">V-2501</text>
<text x="2820" y="1080" font-family="monospace" font-size="14" fill="#A1A1AA">H-2501</text>
<text x="3100" y="1480" font-family="monospace" font-size="14" fill="#A1A1AA">R-2501</text>
<text x="3410" y="1500" font-family="monospace" font-size="14" fill="#A1A1AA">R-2502</text>
<text x="3670" y="700" font-family="monospace" font-size="14" fill="#A1A1AA">A-2501</text>
<text x="3830" y="1010" font-family="monospace" font-size="14" fill="#A1A1AA">V-2502 (HHPS)</text>
<text x="3830" y="1380" font-family="monospace" font-size="14" fill="#A1A1AA">V-2503 (CHPS)</text>
<text x="4000" y="1100" font-family="monospace" font-size="14" fill="#A1A1AA">V-2504 (HLPS)</text>
<text x="4000" y="1360" font-family="monospace" font-size="14" fill="#A1A1AA">V-2505 (CLPS)</text>
<text x="4130" y="870" font-family="monospace" font-size="14" fill="#A1A1AA">C-2507</text>
<text x="4330" y="1080" font-family="monospace" font-size="14" fill="#A1A1AA">K-2501</text>
<text x="4490" y="1500" font-family="monospace" font-size="14" fill="#A1A1AA">C-2501</text>
<text x="4600" y="1950" font-family="monospace" font-size="14" fill="#A1A1AA">C-2502</text>
<text x="4820" y="1280" font-family="monospace" font-size="14" fill="#A1A1AA">C-2503</text>
<text x="4940" y="1280" font-family="monospace" font-size="14" fill="#A1A1AA">C-2504</text>
<text x="5000" y="545" font-family="monospace" font-size="14" fill="#71717A">LPG →</text>
<text x="5000" y="605" font-family="monospace" font-size="14" fill="#71717A">LN →</text>
<text x="5000" y="665" font-family="monospace" font-size="14" fill="#71717A">HN →</text>
<text x="5000" y="775" font-family="monospace" font-size="14" fill="#71717A">Kero →</text>
<text x="5000" y="675" font-family="monospace" font-size="14" fill="#71717A">Diesel →</text>
<text x="5000" y="1795" font-family="monospace" font-size="14" fill="#71717A">UCO →</text>
<text x="200" y="950" font-family="monospace" font-size="14" fill="#71717A">NG Feed & Desulf</text>
<text x="570" y="450" font-family="monospace" font-size="14" fill="#71717A">Reformer Section</text>
<text x="1200" y="740" font-family="monospace" font-size="14" fill="#71717A">WHB + Shift</text>
<text x="1560" y="640" font-family="monospace" font-size="14" fill="#71717A">PSA Unit</text>
<text x="2370" y="950" font-family="monospace" font-size="14" fill="#71717A">Feed Preheat</text>
<text x="2820" y="460" font-family="monospace" font-size="14" fill="#71717A">Charge Heater</text>
<text x="3250" y="320" font-family="monospace" font-size="14" fill="#71717A">Reactor Section</text>
<text x="3800" y="480" font-family="monospace" font-size="14" fill="#71717A">HP Separation</text>
<text x="4200" y="260" font-family="monospace" font-size="14" fill="#71717A">RGC Loop</text>
<text x="4700" y="160" font-family="monospace" font-size="14" fill="#71717A">Fractionation</text>
<text x="50" y="2820" font-family="monospace" font-size="14" fill="#71717A">ESD / RUNNING STATUS</text>
<g id="u24-vessel-2401" transform="translate(220.0,1100.0) scale(1.4400,1.4400)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u24-hx-2401" transform="translate(370.0,1100.0) scale(0.7000,0.7000)"><rect width="64" height="64" fill="#27272A" stroke="#52525B" stroke-width="1"/><text x="32" y="36" font-size="8" fill="#71717A" text-anchor="middle">heat-exchanger-shell-tube</text></g>
<g id="u24-heater-2401" transform="translate(570.0,1000.0) scale(3.7333,3.7333)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M 15,2 L 29,2 L 29,18 L 37,28 L 37,58 L 7,58 L 7,28 L 15,18 Z"
          fill="none" stroke="#808080" stroke-width="1.5"
          stroke-linejoin="miter"/>
    <polyline points="37,55 20,55 33,44 20,31 37,31"
             fill="none" stroke="#808080" stroke-width="1.5"
             stroke-linejoin="miter"/>
    <line x1="25.5" y1="58" x2="25.5" y2="55"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="33.5" y1="58" x2="33.5" y2="55"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u24-steam-drum" transform="translate(600.0,320.0) scale(0.8800,0.8800)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M12,10 A5,10 0 0,0 12,30"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="10" x2="68" y2="10"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="30" x2="68" y2="30"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M68,10 A5,10 0 0,1 68,30"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u24-hx-2402" transform="translate(1070.0,990.0) scale(1.1000,1.1000)"><rect width="64" height="64" fill="#27272A" stroke="#52525B" stroke-width="1"/><text x="32" y="36" font-size="8" fill="#71717A" text-anchor="middle">heat-exchanger-shell-tube</text></g>
<g id="u24-vessel-hts" transform="translate(1200.0,1000.0) scale(1.9200,1.9200)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="68" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u24-vessel-lts" transform="translate(1360.0,1000.0) scale(1.9200,1.9200)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="68" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u24-hx-intercooler" transform="translate(1290.0,990.0) scale(0.8000,0.8000)"><rect width="64" height="64" fill="#27272A" stroke="#52525B" stroke-width="1"/><text x="32" y="36" font-size="8" fill="#71717A" text-anchor="middle">heat-exchanger-shell-tube</text></g>
<g id="u24-psa-bed-1" transform="translate(1480.0,1000.0) scale(0.6400,1.6000)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u24-psa-bed-2" transform="translate(1520.0,1000.0) scale(0.6400,1.6000)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u24-psa-bed-3" transform="translate(1560.0,1000.0) scale(0.6400,1.6000)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u24-psa-bed-4" transform="translate(1600.0,1000.0) scale(0.6400,1.6000)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u24-psa-bed-5" transform="translate(1640.0,1000.0) scale(0.6400,1.6000)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u24-psa-bed-6" transform="translate(1680.0,1000.0) scale(0.6400,1.6000)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u24-compressor-2401" transform="translate(1690.0,990.0) scale(2.3040,2.3040)">
  <g class="io-shape-body">
    <circle class="io-stateful" cx="25" cy="25" r="20"
            fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="12.1" y1="9.7" x2="43.1" y2="16.5"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="12.1" y1="40.3" x2="43.1" y2="33.5"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u25-compressor-2502" transform="translate(2050.0,780.0) scale(2.0480,2.0480)">
  <g class="io-shape-body">
    <circle class="io-stateful" cx="25" cy="25" r="20"
            fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="12.1" y1="9.7" x2="43.1" y2="16.5"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="12.1" y1="40.3" x2="43.1" y2="33.5"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u25-vessel-2501" transform="translate(2220.0,1100.0) scale(1.2800,1.2800)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u25-hx-2501" transform="translate(2340.0,1100.0) scale(0.7000,0.7000)"><rect width="64" height="64" fill="#27272A" stroke="#52525B" stroke-width="1"/><text x="32" y="36" font-size="8" fill="#71717A" text-anchor="middle">heat-exchanger-shell-tube</text></g>
<g id="u25-hx-2502" transform="translate(2460.0,1100.0) scale(0.7000,0.7000)"><rect width="64" height="64" fill="#27272A" stroke="#52525B" stroke-width="1"/><text x="32" y="36" font-size="8" fill="#71717A" text-anchor="middle">heat-exchanger-shell-tube</text></g>
<g id="u25-hx-2503" transform="translate(2580.0,1100.0) scale(0.7000,0.7000)"><rect width="64" height="64" fill="#27272A" stroke="#52525B" stroke-width="1"/><text x="32" y="36" font-size="8" fill="#71717A" text-anchor="middle">heat-exchanger-shell-tube</text></g>
<g id="u25-pump-2501a" transform="translate(2670.0,1250.0) scale(0.9333,0.9333)">
  <g class="io-shape-body">
    <circle class="io-stateful" cx="24" cy="24" r="20"
            fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="4" y1="24" x2="44" y2="24"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="4" x2="44" y2="24"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="44" x2="44" y2="24"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u25-heater-2501" transform="translate(2820.0,820.0) scale(2.6667,2.6667)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M 15,2 L 29,2 L 29,18 L 37,28 L 37,58 L 7,58 L 7,28 L 15,18 Z"
          fill="none" stroke="#808080" stroke-width="1.5"
          stroke-linejoin="miter"/>
    <polyline points="37,55 20,55 33,44 20,31 37,31"
             fill="none" stroke="#808080" stroke-width="1.5"
             stroke-linejoin="miter"/>
    <line x1="25.5" y1="58" x2="25.5" y2="55"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="33.5" y1="58" x2="33.5" y2="55"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u25-cv-fic1012" transform="translate(2760.0,1140.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u25-reactor-2501" transform="translate(3100.0,860.0) scale(1.6000,2.4000)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="68" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u25-cv-fic1120" transform="translate(2960.0,620.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u25-cv-fic1122" transform="translate(2960.0,800.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u25-cv-fic1124" transform="translate(2960.0,980.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u25-reactor-2502" transform="translate(3410.0,900.0) scale(1.6000,2.4000)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="68" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u25-cv-fic1220" transform="translate(3290.0,720.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u25-cv-fic1222" transform="translate(3290.0,900.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u25-air-cooler-2501" transform="translate(3670.0,605.0) scale(2.1053,0.8421)">
  <g class="io-shape-body">
    <line x1="5" y1="5" x2="55" y2="5" stroke="#808080" stroke-width="0.75"/>
    <line x1="5" y1="5" x2="5" y2="27" stroke="#808080" stroke-width="0.75"/>
    <line x1="55" y1="5" x2="55" y2="27" stroke="#808080" stroke-width="0.75"/>
    <polyline points="-4,11 5,11 9,14 14,8 19,14 24,8 29,14 34,8 39,14 44,8 49,14 52,11 55,11 63,11"
              fill="none" stroke="#808080" stroke-width="0.75"/>
    <polyline points="59,8 63,11 59,14"
              fill="none" stroke="#808080" stroke-width="0.75"/>
    <path class="io-stateful"
          d="M30,22 C30,21 8,18 8,22 C8,26 30,23 30,22 Z"
          fill="none" stroke="#808080" stroke-width="0.75"/>
    <path class="io-stateful"
          d="M30,22 C30,21 52,18 52,22 C52,26 30,23 30,22 Z"
          fill="none" stroke="#808080" stroke-width="0.75"/>
    <line x1="30" y1="22" x2="30" y2="30" stroke="#808080" stroke-width="0.75"/>
  </g>
</g>
<g id="u25-vessel-2502" transform="translate(3830.0,830.0) scale(2.5600,2.5600)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u25-vessel-2503" transform="translate(3830.0,1220.0) scale(2.2400,2.2400)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u25-vessel-2504" transform="translate(4000.0,970.0) scale(2.2400,2.2400)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u25-vessel-2505" transform="translate(4000.0,1260.0) scale(2.0800,2.0800)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u25-vessel-2506" transform="translate(4060.0,430.0) scale(1.4400,1.4400)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u25-column-2507" transform="translate(4130.0,680.0) scale(2.6182,2.6182)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,10 A12,5 0 0,1 34,10"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="10" x2="10" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="34" y1="10" x2="34" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,110 A12,5 0 0,0 34,110"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u25-compressor-2501" transform="translate(4330.0,880.0) scale(2.5600,2.5600)">
  <g class="io-shape-body">
    <circle class="io-stateful" cx="25" cy="25" r="20"
            fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="12.1" y1="9.7" x2="43.1" y2="16.5"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="12.1" y1="40.3" x2="43.1" y2="33.5"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u25-column-2501" transform="translate(4490.0,1200.0) scale(3.2000,3.2000)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,10 A12,5 0 0,1 34,10"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="10" x2="10" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="34" y1="10" x2="34" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,110 A12,5 0 0,0 34,110"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u25-hx-2509" transform="translate(4490.0,1890.0) rotate(90.0,32.0,32.0) scale(0.8000,0.8000)"><rect width="64" height="64" fill="#27272A" stroke="#52525B" stroke-width="1"/><text x="32" y="36" font-size="8" fill="#71717A" text-anchor="middle">heat-exchanger-shell-tube</text></g>
<g id="u25-column-2502" transform="translate(4600.0,800.0) scale(4.3636,4.3636)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,10 A12,5 0 0,1 34,10"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="10" x2="10" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="34" y1="10" x2="34" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,110 A12,5 0 0,0 34,110"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u25-vessel-reflux-drum" transform="translate(4750.0,280.0) scale(0.7200,0.7200)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M12,10 A5,10 0 0,0 12,30"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="10" x2="68" y2="10"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="30" x2="68" y2="30"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M68,10 A5,10 0 0,1 68,30"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u25-column-2503" transform="translate(4820.0,1050.0) scale(2.7636,2.7636)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,10 A12,5 0 0,1 34,10"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="10" x2="10" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="34" y1="10" x2="34" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,110 A12,5 0 0,0 34,110"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="u25-column-2504" transform="translate(4940.0,1050.0) scale(2.7636,2.7636)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,10 A12,5 0 0,1 34,10"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="10" x2="10" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="34" y1="10" x2="34" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,110 A12,5 0 0,0 34,110"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g></svg>$svg$,
  '{"name": "Combined Unit 24 + Unit 25 — Integrated H₂ Production & Hydrocracking", "type": "graphic", "pipes": [{"id": "pipe-u24-ng-feed", "service": "process", "path_data": "M 50 1100 L 220 1100", "waypoints": [{"x": 50, "y": 1100}, {"x": 220, "y": 1100}], "stroke_width": 2.0}, {"id": "pipe-u24-desulf-to-preheat", "service": "process", "path_data": "M 220 1100 L 370 1100", "waypoints": [{"x": 220, "y": 1100}, {"x": 370, "y": 1100}], "stroke_width": 2.0}, {"id": "pipe-u24-preheat-to-reformer", "service": "process", "path_data": "M 370 1100 L 500 1100 L 500 800 L 570 800", "waypoints": [{"x": 370, "y": 1100}, {"x": 500, "y": 1100}, {"x": 500, "y": 800}, {"x": 570, "y": 800}], "stroke_width": 2.0}, {"id": "pipe-u24-reformer-outlet", "service": "gas_vapor", "path_data": "M 570 900 L 690 900 L 900 900 L 900 990 L 1070 990", "waypoints": [{"x": 570, "y": 900}, {"x": 690, "y": 900}, {"x": 900, "y": 900}, {"x": 900, "y": 990}, {"x": 1070, "y": 990}], "stroke_width": 2.0}, {"id": "pipe-u24-whb-to-hts", "service": "gas_vapor", "path_data": "M 1070 990 L 1150 820 L 1200 820", "waypoints": [{"x": 1070, "y": 990}, {"x": 1150, "y": 820}, {"x": 1200, "y": 820}], "stroke_width": 2.0}, {"id": "pipe-u24-hts-to-intercooler", "service": "gas_vapor", "path_data": "M 1200 1000 L 1290 990", "waypoints": [{"x": 1200, "y": 1000}, {"x": 1290, "y": 990}], "stroke_width": 2.0}, {"id": "pipe-u24-intercooler-to-lts", "service": "gas_vapor", "path_data": "M 1290 990 L 1310 820 L 1360 820", "waypoints": [{"x": 1290, "y": 990}, {"x": 1310, "y": 820}, {"x": 1360, "y": 820}], "stroke_width": 2.0}, {"id": "pipe-u24-lts-to-psa", "service": "gas_vapor", "path_data": "M 1360 1000 L 1450 990 L 1480 990", "waypoints": [{"x": 1360, "y": 1000}, {"x": 1450, "y": 990}, {"x": 1480, "y": 990}], "stroke_width": 2.0}, {"id": "pipe-u24-psa-to-compressor", "service": "gas_vapor", "path_data": "M 1680 990 L 1690 990", "waypoints": [{"x": 1680, "y": 990}, {"x": 1690, "y": 990}], "stroke_width": 2.0}, {"id": "pipe-u24-tail-gas", "label": "Tail Gas", "service": "fuel_gas", "path_data": "M 1550 1300 L 700 1300 L 700 1480", "waypoints": [{"x": 1550, "y": 1300}, {"x": 700, "y": 1300}, {"x": 700, "y": 1480}], "stroke_width": 1.5}, {"id": "pipe-u24-steam-drum-to-reformer", "service": "steam", "path_data": "M 600 380 L 600 600", "waypoints": [{"x": 600, "y": 380}, {"x": 600, "y": 600}], "stroke_width": 1.5}, {"id": "pipe-u24-bfw-to-steam-drum", "label": "BFW", "service": "water", "path_data": "M 530 380 L 600 380", "waypoints": [{"x": 530, "y": 380}, {"x": 600, "y": 380}], "stroke_width": 1.5}, {"id": "pipe-u24-export-steam", "label": "Export Steam", "service": "steam", "path_data": "M 600 280 L 700 280 L 740 280", "waypoints": [{"x": 600, "y": 280}, {"x": 700, "y": 280}, {"x": 740, "y": 280}], "stroke_width": 1.5}, {"id": "pipe-u24-fuel-gas-in", "service": "fuel_gas", "path_data": "M 680 1560 L 570 1560", "waypoints": [{"x": 680, "y": 1560}, {"x": 570, "y": 1560}], "stroke_width": 1.5}, {"id": "pipe-u24-flue-gas", "label": "Flue Gas", "service": "gas_vapor", "path_data": "M 570 200 L 1000 200 L 1000 80", "waypoints": [{"x": 570, "y": 200}, {"x": 1000, "y": 200}, {"x": 1000, "y": 80}], "stroke_width": 2.0}, {"id": "pipe-interconnect-h2-delivery", "label": "H₂ Delivery", "service": "gas_vapor", "path_data": "M 1690 990 L 1740 990 L 2050 990 L 2050 780", "waypoints": [{"x": 1690, "y": 990}, {"x": 1740, "y": 990}, {"x": 2050, "y": 990}, {"x": 2050, "y": 780}], "stroke_width": 2.0}, {"id": "pipe-interconnect-makeup-to-hcu", "label": "Makeup H₂", "service": "gas_vapor", "path_data": "M 2050 680 L 2050 350 L 2820 350", "waypoints": [{"x": 2050, "y": 680}, {"x": 2050, "y": 350}, {"x": 2820, "y": 350}], "stroke_width": 2.0}, {"id": "pipe-u25-feed-to-v2501", "service": "process", "path_data": "M 2150 1100 L 2220 1100", "waypoints": [{"x": 2150, "y": 1100}, {"x": 2220, "y": 1100}], "stroke_width": 2.0}, {"id": "pipe-u25-v2501-to-hx", "service": "process", "path_data": "M 2220 1100 L 2340 1100", "waypoints": [{"x": 2220, "y": 1100}, {"x": 2340, "y": 1100}], "stroke_width": 2.0}, {"id": "pipe-u25-hx-train", "service": "process", "path_data": "M 2340 1100 L 2460 1100 L 2580 1100", "waypoints": [{"x": 2340, "y": 1100}, {"x": 2460, "y": 1100}, {"x": 2580, "y": 1100}], "stroke_width": 2.0}, {"id": "pipe-u25-pump-to-heater", "service": "process", "path_data": "M 2670 1100 L 2700 1100 L 2820 1100", "waypoints": [{"x": 2670, "y": 1100}, {"x": 2700, "y": 1100}, {"x": 2820, "y": 1100}], "stroke_width": 2.0}, {"id": "pipe-u25-heater-to-r2501", "service": "process", "path_data": "M 2820 600 L 3100 600", "waypoints": [{"x": 2820, "y": 600}, {"x": 3100, "y": 600}], "stroke_width": 2.0}, {"id": "pipe-u25-r2501-to-r2502", "service": "process", "path_data": "M 3100 1380 L 3250 1380 L 3250 600 L 3410 600", "waypoints": [{"x": 3100, "y": 1380}, {"x": 3250, "y": 1380}, {"x": 3250, "y": 600}, {"x": 3410, "y": 600}], "stroke_width": 2.0}, {"id": "pipe-u25-r2502-effluent", "service": "gas_vapor", "path_data": "M 3410 1380 L 3560 1380 L 3560 650 L 3670 650", "waypoints": [{"x": 3410, "y": 1380}, {"x": 3560, "y": 1380}, {"x": 3560, "y": 650}, {"x": 3670, "y": 650}], "stroke_width": 2.0}, {"id": "pipe-u25-aircooler-to-hhps", "service": "gas_vapor", "path_data": "M 3670 650 L 3830 650", "waypoints": [{"x": 3670, "y": 650}, {"x": 3830, "y": 650}], "stroke_width": 2.0}, {"id": "pipe-u25-recycle-gas-arc", "label": "RECYCLE H₂", "service": "gas_vapor", "path_data": "M 4330 350 L 2820 350", "waypoints": [{"x": 4330, "y": 350}, {"x": 2820, "y": 350}], "stroke_width": 2.0}, {"id": "pipe-u25-frac-feed", "service": "process", "path_data": "M 4050 1100 L 4600 1100", "waypoints": [{"x": 4050, "y": 1100}, {"x": 4600, "y": 1100}], "stroke_width": 2.0}, {"id": "pipe-u25-lpg-product", "label": "LPG", "service": "gas_vapor", "path_data": "M 4870 550 L 5070 550", "waypoints": [{"x": 4870, "y": 550}, {"x": 5070, "y": 550}], "stroke_width": 2.0}, {"id": "pipe-u25-ln-product", "label": "LN", "service": "process", "path_data": "M 4900 610 L 5070 610", "waypoints": [{"x": 4900, "y": 610}, {"x": 5070, "y": 610}], "stroke_width": 2.0}, {"id": "pipe-u25-hn-product", "label": "HN", "service": "process", "path_data": "M 4960 670 L 5070 670", "waypoints": [{"x": 4960, "y": 670}, {"x": 5070, "y": 670}], "stroke_width": 2.0}, {"id": "pipe-u25-kero-product", "label": "Kero", "service": "process", "path_data": "M 4700 780 L 5070 780", "waypoints": [{"x": 4700, "y": 780}, {"x": 5070, "y": 780}], "stroke_width": 2.0}, {"id": "pipe-u25-diesel-product", "label": "Diesel", "service": "process", "path_data": "M 4720 680 L 5070 680", "waypoints": [{"x": 4720, "y": 680}, {"x": 5070, "y": 680}], "stroke_width": 2.0}, {"id": "pipe-u25-uco-product", "label": "UCO", "service": "process", "path_data": "M 4700 1800 L 5070 1800", "waypoints": [{"x": 4700, "y": 1800}, {"x": 5070, "y": 1800}], "stroke_width": 2.0}, {"id": "pipe-u25-amine-circuit", "label": "Amine", "service": "chemical", "path_data": "M 4130 400 L 4050 400", "waypoints": [{"x": 4130, "y": 400}, {"x": 4050, "y": 400}], "stroke_width": 1.5}], "layers": [{"name": "Background", "locked": true, "visible": true, "elements": ["pipe-u24-ng-feed", "pipe-u24-desulf-to-preheat", "pipe-u24-preheat-to-reformer", "pipe-u24-reformer-outlet", "pipe-u24-whb-to-hts", "pipe-u24-hts-to-intercooler", "pipe-u24-intercooler-to-lts", "pipe-u24-lts-to-psa", "pipe-u24-psa-to-compressor", "pipe-u24-tail-gas", "pipe-u24-steam-drum-to-reformer", "pipe-u24-bfw-to-steam-drum", "pipe-u24-export-steam", "pipe-u24-fuel-gas-in", "pipe-u24-flue-gas", "pipe-interconnect-h2-delivery", "pipe-interconnect-makeup-to-hcu", "pipe-u25-feed-to-v2501", "pipe-u25-v2501-to-hx", "pipe-u25-hx-train", "pipe-u25-pump-to-heater", "pipe-u25-heater-to-r2501", "pipe-u25-r2501-to-r2502", "pipe-u25-r2502-effluent", "pipe-u25-aircooler-to-hhps", "pipe-u25-recycle-gas-arc", "pipe-u25-frac-feed", "pipe-u25-lpg-product", "pipe-u25-ln-product", "pipe-u25-hn-product", "pipe-u25-kero-product", "pipe-u25-diesel-product", "pipe-u25-uco-product", "pipe-u25-amine-circuit", "rect-h2delivery-bg", "label-interconnect-divider", "label-kpi-divider", "label-esd-divider"]}, {"name": "Equipment", "locked": false, "visible": true, "elements": ["u24-vessel-2401", "u24-hx-2401", "u24-heater-2401", "u24-steam-drum", "u24-hx-2402", "u24-vessel-hts", "u24-vessel-lts", "u24-hx-intercooler", "u24-psa-bed-1", "u24-psa-bed-2", "u24-psa-bed-3", "u24-psa-bed-4", "u24-psa-bed-5", "u24-psa-bed-6", "u24-compressor-2401", "u25-compressor-2502", "u25-vessel-2501", "u25-hx-2501", "u25-hx-2502", "u25-hx-2503", "u25-pump-2501a", "u25-heater-2501", "u25-cv-fic1012", "u25-reactor-2501", "u25-cv-fic1120", "u25-cv-fic1122", "u25-cv-fic1124", "u25-reactor-2502", "u25-cv-fic1220", "u25-cv-fic1222", "u25-air-cooler-2501", "u25-vessel-2502", "u25-vessel-2503", "u25-vessel-2504", "u25-vessel-2505", "u25-vessel-2506", "u25-column-2507", "u25-compressor-2501", "u25-column-2501", "u25-hx-2509", "u25-column-2502", "u25-vessel-reflux-drum", "u25-column-2503", "u25-column-2504"]}, {"name": "Instruments", "locked": false, "visible": true, "elements": ["kpi-u24-h2-purity", "kpi-u24-h2-purity-spark", "kpi-u24-h2-export", "kpi-u24-h2-export-spark", "kpi-u24-reformer-t", "kpi-u24-reformer-t-spark", "kpi-u24-scr", "kpi-u24-scr-spark", "kpi-u24-outlet-ch4", "kpi-u24-outlet-ch4-spark", "kpi-u24-flue-o2", "kpi-u24-flue-o2-spark", "kpi-u25-conversion", "kpi-u25-conversion-spark", "kpi-u25-wabt", "kpi-u25-wabt-spark", "kpi-u25-h2hc-ratio", "kpi-u25-h2hc-ratio-spark", "kpi-u25-h2-consumption", "kpi-u25-h2-consumption-spark", "kpi-u25-diesel-sulfur", "kpi-u25-diesel-sulfur-spark", "kpi-u25-specific-energy", "kpi-u25-specific-energy-spark", "readout-u24-fic0101-pv", "readout-u24-ti0101", "readout-u24-ai0101", "readout-u24-pdi0101", "alarm-u24-vessel-2401", "readout-u24-tic0401-pv", "readout-u24-tic0401-sp", "bar-u24-tic0401-out", "status-u24-tic0401-mode", "readout-u24-ti0413", "readout-u24-ti0414", "readout-u24-fic0401-pv", "readout-u24-fic0402-pv", "readout-u24-ai0401", "readout-u24-ai0403", "readout-u24-ai0404", "readout-u24-pic0401-pv", "alarm-u24-heater-2401", "readout-u24-skin-max", "readout-u24-0402", "readout-u24-0403", "readout-u24-0404", "readout-u24-0405", "readout-u24-0406", "readout-u24-0407", "readout-u24-0408", "readout-u24-0409", "readout-u24-0410", "readout-u24-0411", "readout-u24-0412", "readout-u24-0418", "readout-u24-0419", "readout-u24-0420", "readout-u24-0421", "readout-u24-0422", "readout-u24-0423", "readout-u24-0425", "readout-u24-0426", "readout-u24-0427", "readout-u24-0428", "readout-u24-lic0701-pv", "gauge-u24-lic0701", "readout-u24-pi0701", "readout-u24-tic0701-pv", "alarm-u24-steam-drum", "readout-u24-ti0501", "readout-u24-ti0502", "readout-u24-ai0502", "readout-u24-ti0507", "readout-u24-ti0508", "readout-u24-ai0503", "alarm-u24-vessel-hts", "alarm-u24-vessel-lts", "readout-u24-ai0601", "readout-u24-fi0601", "readout-u24-pi0601", "readout-u24-ai0603", "readout-u24-fi0602", "status-u24-zi0601", "status-u24-zi0602", "status-u24-zi0603", "status-u24-zi0604", "status-u24-zi0605", "status-u24-zi0606", "readout-u24-sic0801-pv", "bar-u24-sic0801-out", "status-u24-sic0801-mode", "readout-u24-pi0801", "readout-u24-pi0803", "readout-u24-ii0801", "readout-u24-vt0801-1x", "status-u24-vshh0801", "alarm-u24-compressor-2401", "readout-interconnect-fi0801", "readout-interconnect-pi0803", "readout-interconnect-fic1501", "readout-u25-pi2030", "readout-u25-pi2031", "status-u25-k2502-run", "readout-u25-fic1001-pv", "bar-u25-fic1001-out", "status-u25-fic1001-mode", "readout-u25-fi0001", "readout-u25-ti1004", "readout-u25-li1001-pv", "gauge-u25-li1001", "readout-u25-tic1010-pv", "readout-u25-tic1010-sp", "bar-u25-tic1010-out", "status-u25-tic1010-mode", "readout-u25-tic1011-pv", "readout-u25-ti1016", "readout-u25-fic1012-pv", "readout-u25-ai1010", "alarm-u25-heater-2501", "readout-u25-skin-max", "readout-u25-1020", "readout-u25-1021", "readout-u25-1022", "readout-u25-1023", "readout-u25-1024", "readout-u25-1025", "readout-u25-1026", "readout-u25-1027", "readout-u25-1028", "readout-u25-1029", "readout-u25-1030", "readout-u25-1031", "readout-u25-tic1101-pv", "readout-u25-tic1101-sp", "bar-u25-tic1101-out", "status-u25-tic1101-mode", "readout-u25-wabt1101", "readout-u25-pi1101", "readout-u25-fic1120-pv", "readout-u25-fic1122-pv", "readout-u25-fic1124-pv", "readout-u25-ti1160", "alarm-u25-reactor-2501", "readout-u25-tic1201-pv", "readout-u25-tic1201-sp", "bar-u25-tic1201-out", "status-u25-tic1201-mode", "readout-u25-wabt1201", "readout-u25-conv2501", "readout-u25-fic1220-pv", "readout-u25-fic1222-pv", "readout-u25-ti1250", "alarm-u25-reactor-2502", "readout-u25-tic1305-pv", "readout-u25-pi1321", "readout-u25-lic1320-pv", "gauge-u25-lic1320", "readout-u25-pic1301-pv", "readout-u25-lic1330-pv", "readout-u25-lic1340-pv", "readout-u25-ai1301", "alarm-u25-vessel-2502", "readout-u25-ai1402", "readout-u25-sic2001-pv", "bar-u25-sic2001-out", "status-u25-sic2001-mode", "readout-u25-pi2001", "readout-u25-pi2002", "readout-u25-calc2003", "status-u25-vshh2001", "status-u25-k2501-run", "alarm-u25-compressor-2501", "readout-u25-pic2201-pv", "readout-u25-ti2204", "readout-u25-lic2211-pv", "gauge-u25-lic2211", "readout-u25-fic2231-pv", "readout-u25-fic2230-pv", "readout-u25-tic2260-pv", "readout-u25-conv1001", "alarm-u25-column-2502", "readout-u25-2201", "readout-u25-2202", "readout-u25-2203", "readout-u25-ti2204-col", "readout-u25-2205", "readout-u25-2206", "readout-u25-2207", "readout-u25-2208", "readout-u25-fi2313", "readout-u25-ai2301", "readout-u25-fic2332-pv", "readout-u25-ai2320", "readout-u25-fi2212", "status-esd-xv0401", "status-esd-fsll0402", "status-esd-pshh0701", "status-esd-lsll0701", "status-esd-vshh0801", "status-esd-p2501a-run", "status-esd-k2501-run", "status-esd-k2502-run", "status-esd-xv2501", "status-esd-xv2502", "status-esd-xv2503", "status-esd-pshh1101", "status-esd-pshh1201", "status-esd-vshh2001", "readout-esd-fi9001"]}, {"name": "Labels", "locked": false, "visible": true, "elements": ["label-title-bar", "label-title-timestamp", "label-unit24-area", "label-unit25-area", "label-kpi-divider", "label-esd-divider", "label-interconnect-divider", "label-interconnect-unit", "label-h2delivery-title", "label-h2delivery-subtitle", "rect-h2delivery-bg", "label-recycle-h2", "label-equip-v2401", "label-equip-e2401", "label-equip-h2401", "label-equip-steam-drum", "label-equip-e2402", "label-equip-hts", "label-equip-lts", "label-equip-psa", "label-equip-k2401", "label-equip-k2502", "label-equip-v2501", "label-equip-h2501", "label-equip-r2501", "label-equip-r2502", "label-equip-a2501", "label-equip-v2502", "label-equip-v2503", "label-equip-v2504", "label-equip-v2505", "label-equip-c2507", "label-equip-k2501", "label-equip-c2501", "label-equip-c2502", "label-equip-c2503", "label-equip-c2504", "label-product-lpg", "label-product-ln", "label-product-hn", "label-product-kero", "label-product-diesel", "label-product-uco", "label-section-feed-desulf", "label-section-reformer", "label-section-whb-shift", "label-section-psa", "label-section-feed-preheat", "label-section-heater", "label-section-reactors", "label-section-hp-sep", "label-section-rgc", "label-section-frac", "label-esd-bar-title"]}], "shapes": [{"id": "u24-vessel-2401", "tag": "V-2401", "parts": [], "scale": {"x": 0.9, "y": 0.9}, "config": "plain", "mirror": "none", "variant": "opt1", "position": {"x": 220, "y": 1100}, "rotation": 0, "shape_id": "vessel-vertical"}, {"id": "u24-hx-2401", "tag": "E-2401", "parts": [], "scale": {"x": 0.7, "y": 0.7}, "config": null, "mirror": "none", "variant": "opt1", "position": {"x": 370, "y": 1100}, "rotation": 0, "shape_id": "heat-exchanger-shell-tube"}, {"id": "u24-heater-2401", "tag": "H-2401", "parts": [], "scale": {"x": 2.8, "y": 2.8}, "config": null, "mirror": "none", "variant": "opt1", "position": {"x": 570, "y": 1000}, "rotation": 0, "shape_id": "heater-fired"}, {"id": "u24-steam-drum", "tag": "V-SD", "parts": [{"part_id": "part-support-saddle", "attach_point": "bottom"}], "scale": {"x": 1.1, "y": 1.1}, "config": "plain", "mirror": "none", "variant": "opt1", "position": {"x": 600, "y": 320}, "rotation": 0, "shape_id": "vessel-horizontal"}, {"id": "u24-hx-2402", "tag": "E-2402", "parts": [], "scale": {"x": 1.1, "y": 1.1}, "config": null, "mirror": "none", "variant": "opt1", "position": {"x": 1070, "y": 990}, "rotation": 0, "shape_id": "heat-exchanger-shell-tube"}, {"id": "u24-vessel-hts", "tag": "R-2401", "parts": [], "scale": {"x": 1.2, "y": 1.2}, "config": "closed", "mirror": "none", "variant": "opt1", "position": {"x": 1200, "y": 1000}, "rotation": 0, "shape_id": "reactor"}, {"id": "u24-vessel-lts", "tag": "R-2402", "parts": [], "scale": {"x": 1.2, "y": 1.2}, "config": "closed", "mirror": "none", "variant": "opt1", "position": {"x": 1360, "y": 1000}, "rotation": 0, "shape_id": "reactor"}, {"id": "u24-hx-intercooler", "tag": "E-INTCL", "parts": [], "scale": {"x": 0.8, "y": 0.8}, "config": null, "mirror": "none", "variant": "opt1", "position": {"x": 1290, "y": 990}, "rotation": 0, "shape_id": "heat-exchanger-shell-tube"}, {"id": "u24-psa-bed-1", "tag": "PSA-1", "parts": [], "scale": {"x": 0.4, "y": 1.0}, "config": "plain", "mirror": "none", "variant": "opt1", "position": {"x": 1480, "y": 1000}, "rotation": 0, "shape_id": "vessel-vertical"}, {"id": "u24-psa-bed-2", "tag": "PSA-2", "parts": [], "scale": {"x": 0.4, "y": 1.0}, "config": "plain", "mirror": "none", "variant": "opt1", "position": {"x": 1520, "y": 1000}, "rotation": 0, "shape_id": "vessel-vertical"}, {"id": "u24-psa-bed-3", "tag": "PSA-3", "parts": [], "scale": {"x": 0.4, "y": 1.0}, "config": "plain", "mirror": "none", "variant": "opt1", "position": {"x": 1560, "y": 1000}, "rotation": 0, "shape_id": "vessel-vertical"}, {"id": "u24-psa-bed-4", "tag": "PSA-4", "parts": [], "scale": {"x": 0.4, "y": 1.0}, "config": "plain", "mirror": "none", "variant": "opt1", "position": {"x": 1600, "y": 1000}, "rotation": 0, "shape_id": "vessel-vertical"}, {"id": "u24-psa-bed-5", "tag": "PSA-5", "parts": [], "scale": {"x": 0.4, "y": 1.0}, "config": "plain", "mirror": "none", "variant": "opt1", "position": {"x": 1640, "y": 1000}, "rotation": 0, "shape_id": "vessel-vertical"}, {"id": "u24-psa-bed-6", "tag": "PSA-6", "parts": [], "scale": {"x": 0.4, "y": 1.0}, "config": "plain", "mirror": "none", "variant": "opt1", "position": {"x": 1680, "y": 1000}, "rotation": 0, "shape_id": "vessel-vertical"}, {"id": "u24-compressor-2401", "tag": "K-2401", "parts": [], "scale": {"x": 1.8, "y": 1.8}, "config": null, "mirror": "none", "variant": "opt1", "position": {"x": 1690, "y": 990}, "rotation": 0, "shape_id": "compressor"}, {"id": "u25-compressor-2502", "tag": "K-2502", "parts": [], "scale": {"x": 1.6, "y": 1.6}, "config": null, "mirror": "none", "variant": "opt1", "position": {"x": 2050, "y": 780}, "rotation": 0, "shape_id": "compressor"}, {"id": "u25-vessel-2501", "tag": "V-2501", "parts": [], "scale": {"x": 0.8, "y": 0.8}, "config": "plain", "mirror": "none", "variant": "opt1", "position": {"x": 2220, "y": 1100}, "rotation": 0, "shape_id": "vessel-vertical"}, {"id": "u25-hx-2501", "tag": "E-2501", "parts": [], "scale": {"x": 0.7, "y": 0.7}, "config": null, "mirror": "none", "variant": "opt1", "position": {"x": 2340, "y": 1100}, "rotation": 0, "shape_id": "heat-exchanger-shell-tube"}, {"id": "u25-hx-2502", "tag": "E-2502", "parts": [], "scale": {"x": 0.7, "y": 0.7}, "config": null, "mirror": "none", "variant": "opt1", "position": {"x": 2460, "y": 1100}, "rotation": 0, "shape_id": "heat-exchanger-shell-tube"}, {"id": "u25-hx-2503", "tag": "E-2503", "parts": [], "scale": {"x": 0.7, "y": 0.7}, "config": null, "mirror": "none", "variant": "opt1", "position": {"x": 2580, "y": 1100}, "rotation": 0, "shape_id": "heat-exchanger-shell-tube"}, {"id": "u25-pump-2501a", "tag": "P-2501A", "parts": [], "scale": {"x": 0.7, "y": 0.7}, "config": null, "mirror": "none", "variant": "opt1", "position": {"x": 2670, "y": 1250}, "rotation": 0, "shape_id": "pump-centrifugal"}, {"id": "u25-heater-2501", "tag": "H-2501", "parts": [], "scale": {"x": 2.0, "y": 2.0}, "config": null, "mirror": "none", "variant": "opt1", "position": {"x": 2820, "y": 820}, "rotation": 0, "shape_id": "heater-fired"}, {"id": "u25-cv-fic1012", "tag": "FV-1012", "parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}], "scale": {"x": 1.0, "y": 1.0}, "config": null, "mirror": "none", "variant": "opt1", "position": {"x": 2760, "y": 1140}, "rotation": 0, "shape_id": "valve-control"}, {"id": "u25-reactor-2501", "tag": "R-2501", "parts": [], "scale": {"x": 1.0, "y": 1.5}, "config": "base", "mirror": "none", "variant": "opt1", "position": {"x": 3100, "y": 860}, "rotation": 0, "shape_id": "reactor"}, {"id": "u25-cv-fic1120", "tag": "FV-1120", "parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}], "scale": {"x": 1.0, "y": 1.0}, "config": null, "mirror": "none", "variant": "opt1", "position": {"x": 2960, "y": 620}, "rotation": 0, "shape_id": "valve-control"}, {"id": "u25-cv-fic1122", "tag": "FV-1122", "parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}], "scale": {"x": 1.0, "y": 1.0}, "config": null, "mirror": "none", "variant": "opt1", "position": {"x": 2960, "y": 800}, "rotation": 0, "shape_id": "valve-control"}, {"id": "u25-cv-fic1124", "tag": "FV-1124", "parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}], "scale": {"x": 1.0, "y": 1.0}, "config": null, "mirror": "none", "variant": "opt1", "position": {"x": 2960, "y": 980}, "rotation": 0, "shape_id": "valve-control"}, {"id": "u25-reactor-2502", "tag": "R-2502", "parts": [], "scale": {"x": 1.0, "y": 1.5}, "config": "base", "mirror": "none", "variant": "opt1", "position": {"x": 3410, "y": 900}, "rotation": 0, "shape_id": "reactor"}, {"id": "u25-cv-fic1220", "tag": "FV-1220", "parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}], "scale": {"x": 1.0, "y": 1.0}, "config": null, "mirror": "none", "variant": "opt1", "position": {"x": 3290, "y": 720}, "rotation": 0, "shape_id": "valve-control"}, {"id": "u25-cv-fic1222", "tag": "FV-1222", "parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}], "scale": {"x": 1.0, "y": 1.0}, "config": null, "mirror": "none", "variant": "opt1", "position": {"x": 3290, "y": 900}, "rotation": 0, "shape_id": "valve-control"}, {"id": "u25-air-cooler-2501", "tag": "A-2501", "parts": [], "scale": {"x": 2.5, "y": 1.0}, "config": null, "mirror": "none", "variant": "opt1", "position": {"x": 3670, "y": 605}, "rotation": 0, "shape_id": "air-cooler"}, {"id": "u25-vessel-2502", "tag": "V-2502", "parts": [], "scale": {"x": 1.6, "y": 1.6}, "config": "plain", "mirror": "none", "variant": "opt1", "position": {"x": 3830, "y": 830}, "rotation": 0, "shape_id": "vessel-vertical"}, {"id": "u25-vessel-2503", "tag": "V-2503", "parts": [], "scale": {"x": 1.4, "y": 1.4}, "config": "plain", "mirror": "none", "variant": "opt1", "position": {"x": 3830, "y": 1220}, "rotation": 0, "shape_id": "vessel-vertical"}, {"id": "u25-vessel-2504", "tag": "V-2504", "parts": [], "scale": {"x": 1.4, "y": 1.4}, "config": "plain", "mirror": "none", "variant": "opt1", "position": {"x": 4000, "y": 970}, "rotation": 0, "shape_id": "vessel-vertical"}, {"id": "u25-vessel-2505", "tag": "V-2505", "parts": [], "scale": {"x": 1.3, "y": 1.3}, "config": "plain", "mirror": "none", "variant": "opt1", "position": {"x": 4000, "y": 1260}, "rotation": 0, "shape_id": "vessel-vertical"}, {"id": "u25-vessel-2506", "tag": "V-2506", "parts": [], "scale": {"x": 0.9, "y": 0.9}, "config": "plain", "mirror": "none", "variant": "opt1", "position": {"x": 4060, "y": 430}, "rotation": 0, "shape_id": "vessel-vertical"}, {"id": "u25-column-2507", "tag": "C-2507", "parts": [], "scale": {"x": 1.8, "y": 1.8}, "config": "trayed-10", "mirror": "none", "variant": "opt1", "position": {"x": 4130, "y": 680}, "rotation": 0, "shape_id": "column-distillation"}, {"id": "u25-compressor-2501", "tag": "K-2501", "parts": [], "scale": {"x": 2.0, "y": 2.0}, "config": null, "mirror": "none", "variant": "opt1", "position": {"x": 4330, "y": 880}, "rotation": 0, "shape_id": "compressor"}, {"id": "u25-column-2501", "tag": "C-2501", "parts": [], "scale": {"x": 2.2, "y": 2.2}, "config": "trayed-10", "mirror": "none", "variant": "opt1", "position": {"x": 4490, "y": 1200}, "rotation": 0, "shape_id": "column-distillation"}, {"id": "u25-hx-2509", "tag": "E-2509", "parts": [], "scale": {"x": 0.8, "y": 0.8}, "config": null, "mirror": "none", "variant": "opt1", "position": {"x": 4490, "y": 1890}, "rotation": 90, "shape_id": "heat-exchanger-shell-tube"}, {"id": "u25-column-2502", "tag": "C-2502", "parts": [], "scale": {"x": 3.0, "y": 3.0}, "config": "trayed-10", "mirror": "none", "variant": "opt1", "position": {"x": 4600, "y": 800}, "rotation": 0, "shape_id": "column-distillation"}, {"id": "u25-vessel-reflux-drum", "tag": "V-2508", "parts": [{"part_id": "part-support-saddle", "attach_point": "bottom"}], "scale": {"x": 0.9, "y": 0.9}, "config": "plain", "mirror": "none", "variant": "opt1", "position": {"x": 4750, "y": 280}, "rotation": 0, "shape_id": "vessel-horizontal"}, {"id": "u25-column-2503", "tag": "C-2503", "parts": [], "scale": {"x": 1.9, "y": 1.9}, "config": "trayed-10", "mirror": "none", "variant": "opt1", "position": {"x": 4820, "y": 1050}, "rotation": 0, "shape_id": "column-distillation"}, {"id": "u25-column-2504", "tag": "C-2504", "parts": [], "scale": {"x": 1.9, "y": 1.9}, "config": "trayed-10", "mirror": "none", "variant": "opt1", "position": {"x": 4940, "y": 1050}, "rotation": 0, "shape_id": "column-distillation"}], "bindings": {"kpi-u24-scr": {"id": "kpi-u24-scr", "mapping": {"type": "text", "format": "%.2f", "suffix": ""}, "position": {"x": 810, "y": 110}, "attribute": "text", "point_tag": "24-AI-0404", "description": "Steam/Carbon Ratio", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "kpi-u25-wabt": {"id": "kpi-u25-wabt", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 2950, "y": 110}, "attribute": "text", "point_tag": "25-WABT-COMB", "description": "Combined WABT", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "kpi-u24-flue-o2": {"id": "kpi-u24-flue-o2", "mapping": {"type": "text", "format": "%.2f", "suffix": "%"}, "position": {"x": 1270, "y": 110}, "attribute": "text", "point_tag": "24-AI-0401", "description": "Flue O2 %", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "gauge-u25-li1001": {"id": "gauge-u25-li1001", "parent": "u25-vessel-2501", "mapping": {"type": "fill_gauge", "range_hi": 100, "range_lo": 0, "placement": "vessel_overlay", "clip_to_shape": "u25-vessel-2501", "fill_direction": "up"}, "position": {"x": 2210, "y": 1195}, "attribute": "fill", "point_tag": "25-LI-1001", "source_hint": "SimBLAH-OPC", "element_type": "fill_gauge"}, "readout-u24-0402": {"id": "readout-u24-0402", "parent": "u24-heater-2401", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 460, "y": 624}, "attribute": "text", "point_tag": "24-TI-0402", "description": "Tube skin 0402", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-0403": {"id": "readout-u24-0403", "parent": "u24-heater-2401", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 460, "y": 668}, "attribute": "text", "point_tag": "24-TI-0403", "description": "Tube skin 0403", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-0404": {"id": "readout-u24-0404", "parent": "u24-heater-2401", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 460, "y": 712}, "attribute": "text", "point_tag": "24-TI-0404", "description": "Tube skin 0404", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-0405": {"id": "readout-u24-0405", "parent": "u24-heater-2401", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 460, "y": 756}, "attribute": "text", "point_tag": "24-TI-0405", "description": "Tube skin 0405", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-0406": {"id": "readout-u24-0406", "parent": "u24-heater-2401", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 460, "y": 800}, "attribute": "text", "point_tag": "24-TI-0406", "description": "Tube skin 0406", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-0407": {"id": "readout-u24-0407", "parent": "u24-heater-2401", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 460, "y": 844}, "attribute": "text", "point_tag": "24-TI-0407", "description": "Tube skin 0407", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-0408": {"id": "readout-u24-0408", "parent": "u24-heater-2401", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 460, "y": 888}, "attribute": "text", "point_tag": "24-TI-0408", "description": "Tube skin 0408", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-0409": {"id": "readout-u24-0409", "parent": "u24-heater-2401", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 460, "y": 932}, "attribute": "text", "point_tag": "24-TI-0409", "description": "Tube skin 0409", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-0410": {"id": "readout-u24-0410", "parent": "u24-heater-2401", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 460, "y": 976}, "attribute": "text", "point_tag": "24-TI-0410", "description": "Tube skin 0410", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-0411": {"id": "readout-u24-0411", "parent": "u24-heater-2401", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 460, "y": 1020}, "attribute": "text", "point_tag": "24-TI-0411", "description": "Tube skin 0411", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-0412": {"id": "readout-u24-0412", "parent": "u24-heater-2401", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 460, "y": 1064}, "attribute": "text", "point_tag": "24-TI-0412", "description": "Tube skin 0412", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-0418": {"id": "readout-u24-0418", "parent": "u24-heater-2401", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 460, "y": 1108}, "attribute": "text", "point_tag": "24-TI-0418", "description": "Tube skin 0418", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-0419": {"id": "readout-u24-0419", "parent": "u24-heater-2401", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 460, "y": 1152}, "attribute": "text", "point_tag": "24-TI-0419", "description": "Tube skin 0419", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-0420": {"id": "readout-u24-0420", "parent": "u24-heater-2401", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 460, "y": 1196}, "attribute": "text", "point_tag": "24-TI-0420", "description": "Tube skin 0420", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-0421": {"id": "readout-u24-0421", "parent": "u24-heater-2401", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 460, "y": 1240}, "attribute": "text", "point_tag": "24-TI-0421", "description": "Tube skin 0421", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-0422": {"id": "readout-u24-0422", "parent": "u24-heater-2401", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 460, "y": 1284}, "attribute": "text", "point_tag": "24-TI-0422", "description": "Tube skin 0422", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-0423": {"id": "readout-u24-0423", "parent": "u24-heater-2401", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 460, "y": 1328}, "attribute": "text", "point_tag": "24-TI-0423", "description": "Tube skin 0423", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-0425": {"id": "readout-u24-0425", "parent": "u24-heater-2401", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 480, "y": 1450}, "attribute": "text", "point_tag": "24-TI-0425", "description": "Pyrometer Zone", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-0426": {"id": "readout-u24-0426", "parent": "u24-heater-2401", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 560, "y": 1450}, "attribute": "text", "point_tag": "24-TI-0426", "description": "Pyrometer Zone", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-0427": {"id": "readout-u24-0427", "parent": "u24-heater-2401", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 640, "y": 1450}, "attribute": "text", "point_tag": "24-TI-0427", "description": "Pyrometer Zone", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-0428": {"id": "readout-u24-0428", "parent": "u24-heater-2401", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 720, "y": 1450}, "attribute": "text", "point_tag": "24-TI-0428", "description": "Pyrometer Zone", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-1020": {"id": "readout-u25-1020", "parent": "u25-heater-2501", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 2710, "y": 624}, "attribute": "text", "point_tag": "25-TI-1020", "description": "Tube skin 1020", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-1021": {"id": "readout-u25-1021", "parent": "u25-heater-2501", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 2710, "y": 659}, "attribute": "text", "point_tag": "25-TI-1021", "description": "Tube skin 1021", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-1022": {"id": "readout-u25-1022", "parent": "u25-heater-2501", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 2710, "y": 694}, "attribute": "text", "point_tag": "25-TI-1022", "description": "Tube skin 1022", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-1023": {"id": "readout-u25-1023", "parent": "u25-heater-2501", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 2710, "y": 729}, "attribute": "text", "point_tag": "25-TI-1023", "description": "Tube skin 1023", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-1024": {"id": "readout-u25-1024", "parent": "u25-heater-2501", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 2710, "y": 764}, "attribute": "text", "point_tag": "25-TI-1024", "description": "Tube skin 1024", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-1025": {"id": "readout-u25-1025", "parent": "u25-heater-2501", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 2710, "y": 799}, "attribute": "text", "point_tag": "25-TI-1025", "description": "Tube skin 1025", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-1026": {"id": "readout-u25-1026", "parent": "u25-heater-2501", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 2710, "y": 834}, "attribute": "text", "point_tag": "25-TI-1026", "description": "Tube skin 1026", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-1027": {"id": "readout-u25-1027", "parent": "u25-heater-2501", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 2710, "y": 869}, "attribute": "text", "point_tag": "25-TI-1027", "description": "Tube skin 1027", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-1028": {"id": "readout-u25-1028", "parent": "u25-heater-2501", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 2710, "y": 904}, "attribute": "text", "point_tag": "25-TI-1028", "description": "Tube skin 1028", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-1029": {"id": "readout-u25-1029", "parent": "u25-heater-2501", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 2710, "y": 939}, "attribute": "text", "point_tag": "25-TI-1029", "description": "Tube skin 1029", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-1030": {"id": "readout-u25-1030", "parent": "u25-heater-2501", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 2710, "y": 974}, "attribute": "text", "point_tag": "25-TI-1030", "description": "Tube skin 1030", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-1031": {"id": "readout-u25-1031", "parent": "u25-heater-2501", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 2710, "y": 1009}, "attribute": "text", "point_tag": "25-TI-1031", "description": "Tube skin 1031", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-2201": {"id": "readout-u25-2201", "parent": "u25-column-2502", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 4560, "y": 1740}, "attribute": "text", "point_tag": "25-TI-2201", "description": "Tray T", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-2202": {"id": "readout-u25-2202", "parent": "u25-column-2502", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 4560, "y": 1555}, "attribute": "text", "point_tag": "25-TI-2202", "description": "Tray T", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-2203": {"id": "readout-u25-2203", "parent": "u25-column-2502", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 4560, "y": 1370}, "attribute": "text", "point_tag": "25-TI-2203", "description": "Tray T", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-2205": {"id": "readout-u25-2205", "parent": "u25-column-2502", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 4560, "y": 1000}, "attribute": "text", "point_tag": "25-TI-2205", "description": "Tray T", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-2206": {"id": "readout-u25-2206", "parent": "u25-column-2502", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 4560, "y": 815}, "attribute": "text", "point_tag": "25-TI-2206", "description": "Tray T", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-2207": {"id": "readout-u25-2207", "parent": "u25-column-2502", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 4560, "y": 630}, "attribute": "text", "point_tag": "25-TI-2207", "description": "Tray T", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-2208": {"id": "readout-u25-2208", "parent": "u25-column-2502", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 4560, "y": 320}, "attribute": "text", "point_tag": "25-TI-2208", "description": "Tray T", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "gauge-u24-lic0701": {"id": "gauge-u24-lic0701", "parent": "u24-steam-drum", "mapping": {"type": "fill_gauge", "range_hi": 100, "range_lo": 0, "placement": "vessel_overlay", "clip_to_shape": "u24-steam-drum", "fill_direction": "up"}, "position": {"x": 590, "y": 295}, "attribute": "fill", "point_tag": "24-LIC-0701.PV", "source_hint": "SimBLAH-OPC", "element_type": "fill_gauge"}, "gauge-u25-lic1320": {"id": "gauge-u25-lic1320", "parent": "u25-vessel-2502", "mapping": {"type": "fill_gauge", "range_hi": 100, "range_lo": 0, "placement": "vessel_overlay", "clip_to_shape": "u25-vessel-2502", "fill_direction": "up"}, "position": {"x": 3818, "y": 995}, "attribute": "fill", "point_tag": "25-LIC-1320.PV", "source_hint": "SimBLAH-OPC", "element_type": "fill_gauge"}, "gauge-u25-lic2211": {"id": "gauge-u25-lic2211", "parent": "u25-column-2502", "mapping": {"type": "fill_gauge", "range_hi": 100, "range_lo": 0, "placement": "vessel_overlay", "clip_to_shape": "u25-column-2502", "fill_direction": "up"}, "position": {"x": 4588, "y": 1815}, "attribute": "fill", "point_tag": "25-LIC-2211.PV", "source_hint": "SimBLAH-OPC", "element_type": "fill_gauge"}, "kpi-u24-h2-export": {"id": "kpi-u24-h2-export", "mapping": {"type": "text", "format": "%.2f", "suffix": "MMSCFD"}, "position": {"x": 350, "y": 110}, "attribute": "text", "point_tag": "24-FI-0801", "description": "H2 Export Flow", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "kpi-u24-h2-purity": {"id": "kpi-u24-h2-purity", "mapping": {"type": "text", "format": "%.2f", "suffix": "%"}, "position": {"x": 120, "y": 110}, "attribute": "text", "point_tag": "24-AI-0601", "description": "H2 Purity", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "kpi-u24-scr-spark": {"id": "kpi-u24-scr-spark", "mapping": {"type": "sparkline", "time_window_minutes": 60}, "position": {"x": 810, "y": 140}, "attribute": "text", "point_tag": "24-AI-0404", "source_hint": "SimBLAH-OPC", "element_type": "sparkline"}, "status-esd-xv0401": {"id": "status-esd-xv0401", "mapping": {"type": "state_class", "states": {"0": "OPEN", "1": "CLOSED"}}, "position": {"x": 120, "y": 2840}, "attribute": "class", "point_tag": "24-XV-0401", "source_hint": "SimBLAH-OPC", "element_type": "digital_status"}, "status-esd-xv2501": {"id": "status-esd-xv2501", "mapping": {"type": "state_class", "states": {"0": "OPEN", "1": "CLOSED"}}, "position": {"x": 1720, "y": 2840}, "attribute": "class", "point_tag": "25-XV-2501", "source_hint": "SimBLAH-OPC", "element_type": "digital_status"}, "status-esd-xv2502": {"id": "status-esd-xv2502", "mapping": {"type": "state_class", "states": {"0": "OPEN", "1": "CLOSED"}}, "position": {"x": 1880, "y": 2840}, "attribute": "class", "point_tag": "25-XV-2502", "source_hint": "SimBLAH-OPC", "element_type": "digital_status"}, "status-esd-xv2503": {"id": "status-esd-xv2503", "mapping": {"type": "state_class", "states": {"0": "OPEN", "1": "CLOSED"}}, "position": {"x": 2040, "y": 2840}, "attribute": "class", "point_tag": "25-XV-2503", "source_hint": "SimBLAH-OPC", "element_type": "digital_status"}, "status-u24-zi0601": {"id": "status-u24-zi0601", "mapping": {"type": "state_class", "states": {"0": "ADS", "1": "REG"}}, "position": {"x": 1470, "y": 680}, "attribute": "class", "point_tag": "24-ZI-0601", "source_hint": "SimBLAH-OPC", "element_type": "digital_status"}, "status-u24-zi0602": {"id": "status-u24-zi0602", "mapping": {"type": "state_class", "states": {"0": "ADS", "1": "REG"}}, "position": {"x": 1510, "y": 680}, "attribute": "class", "point_tag": "24-ZI-0602", "source_hint": "SimBLAH-OPC", "element_type": "digital_status"}, "status-u24-zi0603": {"id": "status-u24-zi0603", "mapping": {"type": "state_class", "states": {"0": "ADS", "1": "REG"}}, "position": {"x": 1550, "y": 680}, "attribute": "class", "point_tag": "24-ZI-0603", "source_hint": "SimBLAH-OPC", "element_type": "digital_status"}, "status-u24-zi0604": {"id": "status-u24-zi0604", "mapping": {"type": "state_class", "states": {"0": "ADS", "1": "REG"}}, "position": {"x": 1590, "y": 680}, "attribute": "class", "point_tag": "24-ZI-0604", "source_hint": "SimBLAH-OPC", "element_type": "digital_status"}, "status-u24-zi0605": {"id": "status-u24-zi0605", "mapping": {"type": "state_class", "states": {"0": "ADS", "1": "REG"}}, "position": {"x": 1630, "y": 680}, "attribute": "class", "point_tag": "24-ZI-0605", "source_hint": "SimBLAH-OPC", "element_type": "digital_status"}, "status-u24-zi0606": {"id": "status-u24-zi0606", "mapping": {"type": "state_class", "states": {"0": "ADS", "1": "REG"}}, "position": {"x": 1670, "y": 680}, "attribute": "class", "point_tag": "24-ZI-0606", "source_hint": "SimBLAH-OPC", "element_type": "digital_status"}, "kpi-u24-outlet-ch4": {"id": "kpi-u24-outlet-ch4", "mapping": {"type": "text", "format": "%.2f", "suffix": "%"}, "position": {"x": 1040, "y": 110}, "attribute": "text", "point_tag": "24-AI-0403", "description": "Outlet CH4 %", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "kpi-u24-reformer-t": {"id": "kpi-u24-reformer-t", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 580, "y": 110}, "attribute": "text", "point_tag": "24-TIC-0401.PV", "description": "Reformer Outlet T", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "kpi-u25-conversion": {"id": "kpi-u25-conversion", "mapping": {"type": "text", "format": "%.1f", "suffix": "%"}, "position": {"x": 2700, "y": 110}, "attribute": "text", "point_tag": "25-CONV-1001", "description": "HCU Conversion %", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "kpi-u25-h2hc-ratio": {"id": "kpi-u25-h2hc-ratio", "mapping": {"type": "text", "format": "%.2f", "suffix": ""}, "position": {"x": 3200, "y": 110}, "attribute": "text", "point_tag": "25-CALC-3104", "description": "H2/HC Ratio", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "kpi-u25-wabt-spark": {"id": "kpi-u25-wabt-spark", "mapping": {"type": "sparkline", "time_window_minutes": 60}, "position": {"x": 2950, "y": 140}, "attribute": "text", "point_tag": "25-WABT-COMB", "source_hint": "SimBLAH-OPC", "element_type": "sparkline"}, "readout-esd-fi9001": {"id": "readout-esd-fi9001", "mapping": {"type": "text", "format": "%.2f", "suffix": "MSCFH"}, "position": {"x": 2800, "y": 2840}, "attribute": "text", "point_tag": "25-FI-9001", "description": "Flare Flow", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-ai0101": {"id": "readout-u24-ai0101", "parent": "u24-vessel-2401", "mapping": {"type": "text", "format": "%.2f", "suffix": "ppm"}, "position": {"x": 260, "y": 1150}, "attribute": "text", "point_tag": "24-AI-0101", "description": "Desulf Outlet H2S", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-ai0401": {"id": "readout-u24-ai0401", "parent": "u24-heater-2401", "mapping": {"type": "text", "format": "%.2f", "suffix": "%"}, "position": {"x": 750, "y": 1440}, "attribute": "text", "point_tag": "24-AI-0401", "description": "Flue Gas O2", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-ai0403": {"id": "readout-u24-ai0403", "parent": "u24-heater-2401", "mapping": {"type": "text", "format": "%.2f", "suffix": "%"}, "position": {"x": 730, "y": 880}, "attribute": "text", "point_tag": "24-AI-0403", "description": "Outlet CH4", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-ai0404": {"id": "readout-u24-ai0404", "parent": "u24-heater-2401", "mapping": {"type": "text", "format": "%.2f", "suffix": ""}, "position": {"x": 730, "y": 910}, "attribute": "text", "point_tag": "24-AI-0404", "description": "Steam/Carbon Ratio", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-ai0502": {"id": "readout-u24-ai0502", "parent": "u24-vessel-hts", "mapping": {"type": "text", "format": "%.3f", "suffix": "%"}, "position": {"x": 1260, "y": 1150}, "attribute": "text", "point_tag": "24-AI-0502", "description": "HTS Outlet CO", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-ai0503": {"id": "readout-u24-ai0503", "parent": "u24-vessel-lts", "mapping": {"type": "text", "format": "%.3f", "suffix": "%"}, "position": {"x": 1420, "y": 1150}, "attribute": "text", "point_tag": "24-AI-0503", "description": "LTS Outlet CO", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-ai0601": {"id": "readout-u24-ai0601", "mapping": {"type": "text", "format": "%.2f", "suffix": "%"}, "position": {"x": 1660, "y": 640}, "attribute": "text", "point_tag": "24-AI-0601", "description": "H2 Purity %", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-ai0603": {"id": "readout-u24-ai0603", "mapping": {"type": "text", "format": "%.1f", "suffix": "ppm"}, "position": {"x": 1660, "y": 760}, "attribute": "text", "point_tag": "24-AI-0603", "description": "Product CO ppm", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-fi0601": {"id": "readout-u24-fi0601", "mapping": {"type": "text", "format": "%.2f", "suffix": "MMSCFD"}, "position": {"x": 1660, "y": 680}, "attribute": "text", "point_tag": "24-FI-0601", "description": "Product H2 Flow", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-fi0602": {"id": "readout-u24-fi0602", "mapping": {"type": "text", "format": "%.2f", "suffix": "MSCFH"}, "position": {"x": 1540, "y": 1360}, "attribute": "text", "point_tag": "24-FI-0602", "description": "Tail Gas Flow", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-ii0801": {"id": "readout-u24-ii0801", "parent": "u24-compressor-2401", "mapping": {"type": "text", "format": "%.0f", "suffix": "A"}, "position": {"x": 1690, "y": 1080}, "attribute": "text", "point_tag": "24-II-0801", "description": "Motor Current", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-pi0601": {"id": "readout-u24-pi0601", "mapping": {"type": "text", "format": "%.0f", "suffix": "PSIG"}, "position": {"x": 1660, "y": 720}, "attribute": "text", "point_tag": "24-PI-0601", "description": "Product H2 P", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-pi0701": {"id": "readout-u24-pi0701", "parent": "u24-steam-drum", "mapping": {"type": "text", "format": "%.0f", "suffix": "PSIG"}, "position": {"x": 600, "y": 310}, "attribute": "text", "point_tag": "24-PI-0701", "description": "Steam Drum P", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-pi0801": {"id": "readout-u24-pi0801", "parent": "u24-compressor-2401", "mapping": {"type": "text", "format": "%.0f", "suffix": "PSIG"}, "position": {"x": 1620, "y": 970}, "attribute": "text", "point_tag": "24-PI-0801", "description": "Suction P", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-pi0803": {"id": "readout-u24-pi0803", "parent": "u24-compressor-2401", "mapping": {"type": "text", "format": "%.0f", "suffix": "PSIG"}, "position": {"x": 1760, "y": 970}, "attribute": "text", "point_tag": "24-PI-0803", "description": "Discharge P", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-ti0101": {"id": "readout-u24-ti0101", "parent": "u24-vessel-2401", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 120, "y": 1077}, "attribute": "text", "point_tag": "24-TI-0101", "description": "NG Temp", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-ti0413": {"id": "readout-u24-ti0413", "parent": "u24-heater-2401", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 570, "y": 820}, "attribute": "text", "point_tag": "24-TI-0413", "description": "Firebox T", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-ti0414": {"id": "readout-u24-ti0414", "parent": "u24-heater-2401", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 1000, "y": 170}, "attribute": "text", "point_tag": "24-TI-0414", "description": "Stack T", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-ti0501": {"id": "readout-u24-ti0501", "parent": "u24-vessel-hts", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 1150, "y": 830}, "attribute": "text", "point_tag": "24-TI-0501", "description": "HTS Inlet T", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-ti0502": {"id": "readout-u24-ti0502", "parent": "u24-vessel-hts", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 1250, "y": 1120}, "attribute": "text", "point_tag": "24-TI-0502", "description": "HTS Outlet T", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-ti0507": {"id": "readout-u24-ti0507", "parent": "u24-vessel-lts", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 1310, "y": 830}, "attribute": "text", "point_tag": "24-TI-0507", "description": "LTS Inlet T", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-ti0508": {"id": "readout-u24-ti0508", "parent": "u24-vessel-lts", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 1410, "y": 1120}, "attribute": "text", "point_tag": "24-TI-0508", "description": "LTS Outlet T", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-ai1010": {"id": "readout-u25-ai1010", "parent": "u25-heater-2501", "mapping": {"type": "text", "format": "%.2f", "suffix": "%"}, "position": {"x": 2870, "y": 1110}, "attribute": "text", "point_tag": "25-AI-1010", "description": "Flue Gas O2", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-ai1301": {"id": "readout-u25-ai1301", "parent": "u25-vessel-2502", "mapping": {"type": "text", "format": "%.2f", "suffix": "ppm"}, "position": {"x": 3920, "y": 660}, "attribute": "text", "point_tag": "25-AI-1301", "description": "RG H2S", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-ai1402": {"id": "readout-u25-ai1402", "mapping": {"type": "text", "format": "%.2f", "suffix": "ppm"}, "position": {"x": 4130, "y": 310}, "attribute": "text", "point_tag": "25-AI-1402", "description": "RG H2S After Amine", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-ai2301": {"id": "readout-u25-ai2301", "mapping": {"type": "text", "format": "%.1f", "suffix": "psi"}, "position": {"x": 4900, "y": 530}, "attribute": "text", "point_tag": "25-AI-2301", "description": "LN RVP", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-ai2320": {"id": "readout-u25-ai2320", "mapping": {"type": "text", "format": "%.2f", "suffix": "%"}, "position": {"x": 5060, "y": 500}, "attribute": "text", "point_tag": "25-AI-2320", "description": "LPG C5 %", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-fi0001": {"id": "readout-u25-fi0001", "parent": "u25-vessel-2501", "mapping": {"type": "text", "format": "%.1f", "suffix": "BPD"}, "position": {"x": 2170, "y": 1107}, "attribute": "text", "point_tag": "25-FI-0001", "description": "Custody Transfer", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-fi2212": {"id": "readout-u25-fi2212", "mapping": {"type": "text", "format": "%.1f", "suffix": "BPD"}, "position": {"x": 4700, "y": 1820}, "attribute": "text", "point_tag": "25-FI-2212", "description": "UCO Flow", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-fi2313": {"id": "readout-u25-fi2313", "mapping": {"type": "text", "format": "%.1f", "suffix": "BPD"}, "position": {"x": 4870, "y": 560}, "attribute": "text", "point_tag": "25-FI-2313", "description": "LN Flow", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-pi1101": {"id": "readout-u25-pi1101", "parent": "u25-reactor-2501", "mapping": {"type": "text", "format": "%.0f", "suffix": "PSIG"}, "position": {"x": 3210, "y": 440}, "attribute": "text", "point_tag": "25-PI-1101", "description": "Inlet P", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-pi1321": {"id": "readout-u25-pi1321", "parent": "u25-vessel-2502", "mapping": {"type": "text", "format": "%.0f", "suffix": "PSIG"}, "position": {"x": 3850, "y": 690}, "attribute": "text", "point_tag": "25-PI-1321", "description": "HHPS P", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-pi2001": {"id": "readout-u25-pi2001", "parent": "u25-compressor-2501", "mapping": {"type": "text", "format": "%.0f", "suffix": "PSIG"}, "position": {"x": 4220, "y": 880}, "attribute": "text", "point_tag": "25-PI-2001", "description": "Suction P", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-pi2002": {"id": "readout-u25-pi2002", "parent": "u25-compressor-2501", "mapping": {"type": "text", "format": "%.0f", "suffix": "PSIG"}, "position": {"x": 4440, "y": 880}, "attribute": "text", "point_tag": "25-PI-2002", "description": "Disch P", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-pi2030": {"id": "readout-u25-pi2030", "mapping": {"type": "text", "format": "%.0f", "suffix": "PSIG"}, "position": {"x": 2060, "y": 830}, "attribute": "text", "point_tag": "25-PI-2030", "description": "K-2502 Suction P", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-pi2031": {"id": "readout-u25-pi2031", "mapping": {"type": "text", "format": "%.0f", "suffix": "PSIG"}, "position": {"x": 2100, "y": 830}, "attribute": "text", "point_tag": "25-PI-2031", "description": "K-2502 Disch P", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-ti1004": {"id": "readout-u25-ti1004", "parent": "u25-vessel-2501", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 2560, "y": 1060}, "attribute": "text", "point_tag": "25-TI-1004", "description": "After Preheat T", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-ti1016": {"id": "readout-u25-ti1016", "parent": "u25-heater-2501", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 2780, "y": 800}, "attribute": "text", "point_tag": "25-TI-1016", "description": "Firebox T", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-ti1160": {"id": "readout-u25-ti1160", "parent": "u25-reactor-2501", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 3100, "y": 1340}, "attribute": "text", "point_tag": "25-TI-1160", "description": "Outlet T", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-ti1250": {"id": "readout-u25-ti1250", "parent": "u25-reactor-2502", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 3410, "y": 1360}, "attribute": "text", "point_tag": "25-TI-1250", "description": "Outlet T", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-ti2204": {"id": "readout-u25-ti2204", "parent": "u25-column-2502", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 4530, "y": 700}, "attribute": "text", "point_tag": "25-TI-2204", "description": "Column Mid T", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "bar-u24-sic0801-out": {"id": "bar-u24-sic0801-out", "parent": "u24-compressor-2401", "mapping": {"type": "analog_bar", "range_hi": 100, "range_lo": 0}, "position": {"x": 1690, "y": 897}, "attribute": "fill", "point_tag": "24-SIC-0801.OUT", "source_hint": "SimBLAH-OPC", "element_type": "analog_bar"}, "bar-u24-tic0401-out": {"id": "bar-u24-tic0401-out", "parent": "u24-heater-2401", "mapping": {"type": "analog_bar", "range_hi": 100, "range_lo": 0}, "position": {"x": 520, "y": 604}, "attribute": "fill", "point_tag": "24-TIC-0401.OUT", "source_hint": "SimBLAH-OPC", "element_type": "analog_bar"}, "bar-u25-fic1001-out": {"id": "bar-u25-fic1001-out", "parent": "u25-vessel-2501", "mapping": {"type": "analog_bar", "range_hi": 100, "range_lo": 0}, "position": {"x": 2160, "y": 1077}, "attribute": "fill", "point_tag": "25-FIC-1001.OUT", "source_hint": "SimBLAH-OPC", "element_type": "analog_bar"}, "bar-u25-sic2001-out": {"id": "bar-u25-sic2001-out", "parent": "u25-compressor-2501", "mapping": {"type": "analog_bar", "range_hi": 100, "range_lo": 0}, "position": {"x": 4330, "y": 777}, "attribute": "fill", "point_tag": "25-SIC-2001.OUT", "source_hint": "SimBLAH-OPC", "element_type": "analog_bar"}, "bar-u25-tic1010-out": {"id": "bar-u25-tic1010-out", "parent": "u25-heater-2501", "mapping": {"type": "analog_bar", "range_hi": 100, "range_lo": 0}, "position": {"x": 2740, "y": 604}, "attribute": "fill", "point_tag": "25-TIC-1010.OUT", "source_hint": "SimBLAH-OPC", "element_type": "analog_bar"}, "bar-u25-tic1101-out": {"id": "bar-u25-tic1101-out", "parent": "u25-reactor-2501", "mapping": {"type": "analog_bar", "range_hi": 100, "range_lo": 0}, "position": {"x": 2980, "y": 474}, "attribute": "fill", "point_tag": "25-TIC-1101.OUT", "source_hint": "SimBLAH-OPC", "element_type": "analog_bar"}, "bar-u25-tic1201-out": {"id": "bar-u25-tic1201-out", "parent": "u25-reactor-2502", "mapping": {"type": "analog_bar", "range_hi": 100, "range_lo": 0}, "position": {"x": 3300, "y": 554}, "attribute": "fill", "point_tag": "25-TIC-1201.OUT", "source_hint": "SimBLAH-OPC", "element_type": "analog_bar"}, "readout-u24-pdi0101": {"id": "readout-u24-pdi0101", "parent": "u24-vessel-2401", "mapping": {"type": "text", "format": "%.1f", "suffix": "PSI"}, "position": {"x": 220, "y": 1163}, "attribute": "text", "point_tag": "24-PDI-0101", "description": "Desulf dP", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "status-esd-fsll0402": {"id": "status-esd-fsll0402", "mapping": {"type": "state_class", "states": {"0": "OK", "1": "TRIPPED"}}, "position": {"x": 280, "y": 2840}, "attribute": "class", "point_tag": "24-FSLL-0402", "source_hint": "SimBLAH-OPC", "element_type": "digital_status"}, "status-esd-lsll0701": {"id": "status-esd-lsll0701", "mapping": {"type": "state_class", "states": {"0": "OK", "1": "TRIPPED"}}, "position": {"x": 600, "y": 2840}, "attribute": "class", "point_tag": "24-LSLL-0701", "source_hint": "SimBLAH-OPC", "element_type": "digital_status"}, "status-esd-pshh0701": {"id": "status-esd-pshh0701", "mapping": {"type": "state_class", "states": {"0": "OK", "1": "TRIPPED"}}, "position": {"x": 440, "y": 2840}, "attribute": "class", "point_tag": "24-PSHH-0701", "source_hint": "SimBLAH-OPC", "element_type": "digital_status"}, "status-esd-pshh1101": {"id": "status-esd-pshh1101", "mapping": {"type": "state_class", "states": {"0": "OK", "1": "TRIPPED"}}, "position": {"x": 2240, "y": 2840}, "attribute": "class", "point_tag": "25-PSHH-1101", "source_hint": "SimBLAH-OPC", "element_type": "digital_status"}, "status-esd-pshh1201": {"id": "status-esd-pshh1201", "mapping": {"type": "state_class", "states": {"0": "OK", "1": "TRIPPED"}}, "position": {"x": 2400, "y": 2840}, "attribute": "class", "point_tag": "25-PSHH-1201", "source_hint": "SimBLAH-OPC", "element_type": "digital_status"}, "status-esd-vshh0801": {"id": "status-esd-vshh0801", "mapping": {"type": "state_class", "states": {"0": "OK", "1": "TRIPPED"}}, "position": {"x": 800, "y": 2840}, "attribute": "class", "point_tag": "24-VSHH-0801", "source_hint": "SimBLAH-OPC", "element_type": "digital_status"}, "status-esd-vshh2001": {"id": "status-esd-vshh2001", "mapping": {"type": "state_class", "states": {"0": "OK", "1": "TRIPPED"}}, "position": {"x": 2600, "y": 2840}, "attribute": "class", "point_tag": "25-VSHH-2001", "source_hint": "SimBLAH-OPC", "element_type": "digital_status"}, "status-u24-vshh0801": {"id": "status-u24-vshh0801", "parent": "u24-compressor-2401", "mapping": {"type": "state_class", "states": {"0": "OK", "1": "TRIP"}}, "position": {"x": 1800, "y": 1050}, "attribute": "class", "point_tag": "24-VSHH-0801", "source_hint": "SimBLAH-OPC", "element_type": "digital_status"}, "status-u25-vshh2001": {"id": "status-u25-vshh2001", "parent": "u25-compressor-2501", "mapping": {"type": "state_class", "states": {"0": "OK", "1": "TRIP"}}, "position": {"x": 4450, "y": 920}, "attribute": "class", "point_tag": "25-VSHH-2001", "source_hint": "SimBLAH-OPC", "element_type": "digital_status"}, "alarm-u24-steam-drum": {"id": "alarm-u24-steam-drum", "parent": "u24-steam-drum", "mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["24-LIC-0701.PV", "24-PI-0701", "24-TIC-0701.PV"]}, "position": {"x": 645, "y": 230}, "attribute": "visibility", "source_hint": "SimBLAH-OPC", "element_type": "alarm_indicator"}, "alarm-u24-vessel-hts": {"id": "alarm-u24-vessel-hts", "parent": "u24-vessel-hts", "mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["24-TI-0501", "24-TI-0502", "24-AI-0502"]}, "position": {"x": 1255, "y": 730}, "attribute": "visibility", "source_hint": "SimBLAH-OPC", "element_type": "alarm_indicator"}, "alarm-u24-vessel-lts": {"id": "alarm-u24-vessel-lts", "parent": "u24-vessel-lts", "mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["24-TI-0507", "24-TI-0508", "24-AI-0503"]}, "position": {"x": 1415, "y": 730}, "attribute": "visibility", "source_hint": "SimBLAH-OPC", "element_type": "alarm_indicator"}, "readout-u24-skin-max": {"id": "readout-u24-skin-max", "parent": "u24-heater-2401", "mapping": {"type": "text", "format": "", "suffix": ""}, "position": {"x": 450, "y": 600}, "attribute": "text", "point_tag": "24-TI-0402", "description": "SKIN MAX summary", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-calc2003": {"id": "readout-u25-calc2003", "parent": "u25-compressor-2501", "mapping": {"type": "text", "format": "%.1f", "suffix": "%"}, "position": {"x": 4330, "y": 980}, "attribute": "text", "point_tag": "25-CALC-2003", "description": "Surge Margin", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-conv1001": {"id": "readout-u25-conv1001", "parent": "u25-column-2502", "mapping": {"type": "text", "format": "%.1f", "suffix": "%"}, "position": {"x": 4720, "y": 180}, "attribute": "text", "point_tag": "25-CONV-1001", "description": "Unit Conv %", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-conv2501": {"id": "readout-u25-conv2501", "parent": "u25-reactor-2502", "mapping": {"type": "text", "format": "%.1f", "suffix": "%"}, "position": {"x": 3540, "y": 520}, "attribute": "text", "point_tag": "25-CONV-2501", "description": "Unit Conv %", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-skin-max": {"id": "readout-u25-skin-max", "parent": "u25-heater-2501", "mapping": {"type": "text", "format": "", "suffix": ""}, "position": {"x": 2700, "y": 600}, "attribute": "text", "point_tag": "25-TI-1020", "description": "SKIN MAX summary", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-wabt1101": {"id": "readout-u25-wabt1101", "parent": "u25-reactor-2501", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 3100, "y": 440}, "attribute": "text", "point_tag": "25-WABT-1101", "description": "WABT", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-wabt1201": {"id": "readout-u25-wabt1201", "parent": "u25-reactor-2502", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 3410, "y": 520}, "attribute": "text", "point_tag": "25-WABT-1201", "description": "WABT", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "status-esd-k2501-run": {"id": "status-esd-k2501-run", "mapping": {"type": "state_class", "states": {"0": "STOPPED", "1": "RUNNING"}}, "position": {"x": 1360, "y": 2840}, "attribute": "class", "point_tag": "25-K-2501.RUN", "source_hint": "SimBLAH-OPC", "element_type": "digital_status"}, "status-esd-k2502-run": {"id": "status-esd-k2502-run", "mapping": {"type": "state_class", "states": {"0": "STOPPED", "1": "RUNNING"}}, "position": {"x": 1520, "y": 2840}, "attribute": "class", "point_tag": "25-K-2502.RUN", "source_hint": "SimBLAH-OPC", "element_type": "digital_status"}, "status-u25-k2501-run": {"id": "status-u25-k2501-run", "parent": "u25-compressor-2501", "mapping": {"type": "state_class", "states": {"0": "STOPPED", "1": "RUNNING"}}, "position": {"x": 4330, "y": 720}, "attribute": "class", "point_tag": "25-K-2501.RUN", "source_hint": "SimBLAH-OPC", "element_type": "digital_status"}, "status-u25-k2502-run": {"id": "status-u25-k2502-run", "mapping": {"type": "state_class", "states": {"0": "STOPPED", "1": "RUNNING"}}, "position": {"x": 2050, "y": 720}, "attribute": "class", "point_tag": "25-K-2502.RUN", "source_hint": "SimBLAH-OPC", "element_type": "digital_status"}, "alarm-u24-heater-2401": {"id": "alarm-u24-heater-2401", "parent": "u24-heater-2401", "mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["24-TIC-0401.PV", "24-TI-0413", "24-AI-0401", "24-AI-0403", "24-AI-0404"]}, "position": {"x": 705, "y": 580}, "attribute": "visibility", "source_hint": "SimBLAH-OPC", "element_type": "alarm_indicator"}, "alarm-u24-vessel-2401": {"id": "alarm-u24-vessel-2401", "parent": "u24-vessel-2401", "mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["24-AI-0101", "24-PDI-0101"]}, "position": {"x": 255, "y": 1080}, "attribute": "visibility", "source_hint": "SimBLAH-OPC", "element_type": "alarm_indicator"}, "alarm-u25-column-2502": {"id": "alarm-u25-column-2502", "parent": "u25-column-2502", "mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PIC-2201.PV", "25-TI-2204", "25-LIC-2211.PV", "25-TIC-2260.PV"]}, "position": {"x": 4645, "y": 280}, "attribute": "visibility", "source_hint": "SimBLAH-OPC", "element_type": "alarm_indicator"}, "alarm-u25-heater-2501": {"id": "alarm-u25-heater-2501", "parent": "u25-heater-2501", "mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-TIC-1010.PV", "25-TIC-1011.PV", "25-TI-1016", "25-AI-1010"]}, "position": {"x": 2905, "y": 580}, "attribute": "visibility", "source_hint": "SimBLAH-OPC", "element_type": "alarm_indicator"}, "alarm-u25-vessel-2502": {"id": "alarm-u25-vessel-2502", "parent": "u25-vessel-2502", "mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PI-1321", "25-LIC-1320.PV", "25-AI-1301"]}, "position": {"x": 3885, "y": 670}, "attribute": "visibility", "source_hint": "SimBLAH-OPC", "element_type": "alarm_indicator"}, "kpi-u24-flue-o2-spark": {"id": "kpi-u24-flue-o2-spark", "mapping": {"type": "sparkline", "time_window_minutes": 60}, "position": {"x": 1270, "y": 140}, "attribute": "text", "point_tag": "24-AI-0401", "source_hint": "SimBLAH-OPC", "element_type": "sparkline"}, "kpi-u25-diesel-sulfur": {"id": "kpi-u25-diesel-sulfur", "mapping": {"type": "text", "format": "%.0f", "suffix": "ppm"}, "position": {"x": 3700, "y": 110}, "attribute": "text", "point_tag": "25-AI-3001", "description": "Diesel Sulfur ppm", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-vt0801-1x": {"id": "readout-u24-vt0801-1x", "parent": "u24-compressor-2401", "mapping": {"type": "text", "format": "%.2f", "suffix": "mils"}, "position": {"x": 1780, "y": 1020}, "attribute": "text", "point_tag": "24-VT-0801-1X", "description": "Brg1 Vib X", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-li1001-pv": {"id": "readout-u25-li1001-pv", "parent": "u25-vessel-2501", "mapping": {"type": "text", "format": "%.1f", "suffix": "%"}, "position": {"x": 2220, "y": 1180}, "attribute": "text", "point_tag": "25-LI-1001", "description": "V-2501 Level", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "status-esd-p2501a-run": {"id": "status-esd-p2501a-run", "mapping": {"type": "state_class", "states": {"0": "STOPPED", "1": "RUNNING"}}, "position": {"x": 1200, "y": 2840}, "attribute": "class", "point_tag": "25-P-2501A.RUN", "source_hint": "SimBLAH-OPC", "element_type": "digital_status"}, "alarm-u25-reactor-2501": {"id": "alarm-u25-reactor-2501", "parent": "u25-reactor-2501", "mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-TIC-1101.PV", "25-WABT-1101", "25-PI-1101", "25-TI-1160"]}, "position": {"x": 3170, "y": 415}, "attribute": "visibility", "source_hint": "SimBLAH-OPC", "element_type": "alarm_indicator"}, "alarm-u25-reactor-2502": {"id": "alarm-u25-reactor-2502", "parent": "u25-reactor-2502", "mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-TIC-1201.PV", "25-WABT-1201", "25-PI-1201", "25-TI-1250"]}, "position": {"x": 3480, "y": 520}, "attribute": "visibility", "source_hint": "SimBLAH-OPC", "element_type": "alarm_indicator"}, "kpi-u25-h2-consumption": {"id": "kpi-u25-h2-consumption", "mapping": {"type": "text", "format": "%.1f", "suffix": "MMSCFD"}, "position": {"x": 3450, "y": 110}, "attribute": "text", "point_tag": "25-CALC-3105", "description": "H2 Consumption", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-fic0101-pv": {"id": "readout-u24-fic0101-pv", "parent": "u24-vessel-2401", "mapping": {"type": "text", "format": "%.1f", "suffix": "MMSCFD"}, "position": {"x": 120, "y": 1060}, "attribute": "text", "point_tag": "24-FIC-0101.PV", "description": "NG Feed Flow", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-fic0401-pv": {"id": "readout-u24-fic0401-pv", "parent": "u24-heater-2401", "mapping": {"type": "text", "format": "%.1f", "suffix": "MSCFH"}, "position": {"x": 570, "y": 1430}, "attribute": "text", "point_tag": "24-FIC-0401.PV", "description": "Fuel Gas Flow", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-fic0402-pv": {"id": "readout-u24-fic0402-pv", "parent": "u24-heater-2401", "mapping": {"type": "text", "format": "%.1f", "suffix": "Klb/h"}, "position": {"x": 450, "y": 880}, "attribute": "text", "point_tag": "24-FIC-0402.PV", "description": "Process Steam Flow", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-lic0701-pv": {"id": "readout-u24-lic0701-pv", "parent": "u24-steam-drum", "mapping": {"type": "text", "format": "%.1f", "suffix": "%"}, "position": {"x": 600, "y": 280}, "attribute": "text", "point_tag": "24-LIC-0701.PV", "description": "Steam Drum Level", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-pic0401-pv": {"id": "readout-u24-pic0401-pv", "parent": "u24-heater-2401", "mapping": {"type": "text", "format": "%.2f", "suffix": "\"H2O"}, "position": {"x": 570, "y": 1460}, "attribute": "text", "point_tag": "24-PIC-0401.PV", "description": "Firebox Draft", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-sic0801-pv": {"id": "readout-u24-sic0801-pv", "parent": "u24-compressor-2401", "mapping": {"type": "text", "format": "%.0f", "suffix": "RPM"}, "position": {"x": 1690, "y": 880}, "attribute": "text", "point_tag": "24-SIC-0801.PV", "description": "K-2401 Speed", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-tic0401-pv": {"id": "readout-u24-tic0401-pv", "parent": "u24-heater-2401", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 520, "y": 570}, "attribute": "text", "point_tag": "24-TIC-0401.PV", "description": "Reformer Outlet T", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-tic0401-sp": {"id": "readout-u24-tic0401-sp", "parent": "u24-heater-2401", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 520, "y": 587}, "attribute": "text", "point_tag": "24-TIC-0401.SP", "description": "SP", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u24-tic0701-pv": {"id": "readout-u24-tic0701-pv", "parent": "u24-steam-drum", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 700, "y": 220}, "attribute": "text", "point_tag": "24-TIC-0701.PV", "description": "Superheater T", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-fic1001-pv": {"id": "readout-u25-fic1001-pv", "parent": "u25-vessel-2501", "mapping": {"type": "text", "format": "%.1f", "suffix": "BPD"}, "position": {"x": 2160, "y": 1060}, "attribute": "text", "point_tag": "25-FIC-1001.PV", "description": "Feed Flow", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-fic1012-pv": {"id": "readout-u25-fic1012-pv", "parent": "u25-heater-2501", "mapping": {"type": "text", "format": "%.1f", "suffix": "MSCFH"}, "position": {"x": 2760, "y": 1110}, "attribute": "text", "point_tag": "25-FIC-1012.PV", "description": "Fuel Gas Flow", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-fic1120-pv": {"id": "readout-u25-fic1120-pv", "parent": "u25-reactor-2501", "mapping": {"type": "text", "format": "%.1f", "suffix": "MSCFH"}, "position": {"x": 2950, "y": 620}, "attribute": "text", "point_tag": "25-FIC-1120.PV", "description": "IB1 Quench", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-fic1122-pv": {"id": "readout-u25-fic1122-pv", "parent": "u25-reactor-2501", "mapping": {"type": "text", "format": "%.1f", "suffix": "MSCFH"}, "position": {"x": 2950, "y": 800}, "attribute": "text", "point_tag": "25-FIC-1122.PV", "description": "IB2 Quench", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-fic1124-pv": {"id": "readout-u25-fic1124-pv", "parent": "u25-reactor-2501", "mapping": {"type": "text", "format": "%.1f", "suffix": "MSCFH"}, "position": {"x": 2950, "y": 980}, "attribute": "text", "point_tag": "25-FIC-1124.PV", "description": "IB3 Quench", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-fic1220-pv": {"id": "readout-u25-fic1220-pv", "parent": "u25-reactor-2502", "mapping": {"type": "text", "format": "%.1f", "suffix": "MSCFH"}, "position": {"x": 3280, "y": 720}, "attribute": "text", "point_tag": "25-FIC-1220.PV", "description": "IB1 Quench", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-fic1222-pv": {"id": "readout-u25-fic1222-pv", "parent": "u25-reactor-2502", "mapping": {"type": "text", "format": "%.1f", "suffix": "MSCFH"}, "position": {"x": 3280, "y": 900}, "attribute": "text", "point_tag": "25-FIC-1222.PV", "description": "IB2 Quench", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-fic2230-pv": {"id": "readout-u25-fic2230-pv", "parent": "u25-column-2502", "mapping": {"type": "text", "format": "%.1f", "suffix": "BPD"}, "position": {"x": 4700, "y": 790}, "attribute": "text", "point_tag": "25-FIC-2230.PV", "description": "Kero Draw", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-fic2231-pv": {"id": "readout-u25-fic2231-pv", "parent": "u25-column-2502", "mapping": {"type": "text", "format": "%.1f", "suffix": "BPD"}, "position": {"x": 4700, "y": 650}, "attribute": "text", "point_tag": "25-FIC-2231.PV", "description": "Diesel Draw", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-fic2332-pv": {"id": "readout-u25-fic2332-pv", "mapping": {"type": "text", "format": "%.1f", "suffix": "BPD"}, "position": {"x": 5020, "y": 520}, "attribute": "text", "point_tag": "25-FIC-2332.PV", "description": "LPG Flow", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-lic1320-pv": {"id": "readout-u25-lic1320-pv", "parent": "u25-vessel-2502", "mapping": {"type": "text", "format": "%.1f", "suffix": "%"}, "position": {"x": 3830, "y": 980}, "attribute": "text", "point_tag": "25-LIC-1320.PV", "description": "HHPS HC Level", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-lic1330-pv": {"id": "readout-u25-lic1330-pv", "parent": "u25-vessel-2503", "mapping": {"type": "text", "format": "%.1f", "suffix": "%"}, "position": {"x": 3830, "y": 1290}, "attribute": "text", "point_tag": "25-LIC-1330.PV", "description": "CHPS HC Level", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-lic1340-pv": {"id": "readout-u25-lic1340-pv", "parent": "u25-vessel-2504", "mapping": {"type": "text", "format": "%.1f", "suffix": "%"}, "position": {"x": 4000, "y": 920}, "attribute": "text", "point_tag": "25-LIC-1340.PV", "description": "HLPS Level", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-lic2211-pv": {"id": "readout-u25-lic2211-pv", "parent": "u25-column-2502", "mapping": {"type": "text", "format": "%.1f", "suffix": "%"}, "position": {"x": 4600, "y": 1800}, "attribute": "text", "point_tag": "25-LIC-2211.PV", "description": "Bottoms Level", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-pic1301-pv": {"id": "readout-u25-pic1301-pv", "parent": "u25-vessel-2503", "mapping": {"type": "text", "format": "%.0f", "suffix": "PSIG"}, "position": {"x": 3730, "y": 1170}, "attribute": "text", "point_tag": "25-PIC-1301.PV", "description": "CHPS P", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-pic2201-pv": {"id": "readout-u25-pic2201-pv", "parent": "u25-column-2502", "mapping": {"type": "text", "format": "%.0f", "suffix": "PSIG"}, "position": {"x": 4540, "y": 180}, "attribute": "text", "point_tag": "25-PIC-2201.PV", "description": "Ovhd P", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-sic2001-pv": {"id": "readout-u25-sic2001-pv", "parent": "u25-compressor-2501", "mapping": {"type": "text", "format": "%.0f", "suffix": "RPM"}, "position": {"x": 4330, "y": 760}, "attribute": "text", "point_tag": "25-SIC-2001.PV", "description": "K-2501 Speed", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-ti2204-col": {"id": "readout-u25-ti2204-col", "parent": "u25-column-2502", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 4560, "y": 1185}, "attribute": "text", "point_tag": "25-TI-2204", "description": "Tray T", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-tic1010-pv": {"id": "readout-u25-tic1010-pv", "parent": "u25-heater-2501", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 2740, "y": 570}, "attribute": "text", "point_tag": "25-TIC-1010.PV", "description": "Pass 1 Outlet T", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-tic1010-sp": {"id": "readout-u25-tic1010-sp", "parent": "u25-heater-2501", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 2740, "y": 587}, "attribute": "text", "point_tag": "25-TIC-1010.SP", "description": "SP", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-tic1011-pv": {"id": "readout-u25-tic1011-pv", "parent": "u25-heater-2501", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 2840, "y": 570}, "attribute": "text", "point_tag": "25-TIC-1011.PV", "description": "Pass 2 Outlet T", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-tic1101-pv": {"id": "readout-u25-tic1101-pv", "parent": "u25-reactor-2501", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 2980, "y": 440}, "attribute": "text", "point_tag": "25-TIC-1101.PV", "description": "Inlet T", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-tic1101-sp": {"id": "readout-u25-tic1101-sp", "parent": "u25-reactor-2501", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 2980, "y": 457}, "attribute": "text", "point_tag": "25-TIC-1101.SP", "description": "SP", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-tic1201-pv": {"id": "readout-u25-tic1201-pv", "parent": "u25-reactor-2502", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 3300, "y": 520}, "attribute": "text", "point_tag": "25-TIC-1201.PV", "description": "Inlet T", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-tic1201-sp": {"id": "readout-u25-tic1201-sp", "parent": "u25-reactor-2502", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 3300, "y": 537}, "attribute": "text", "point_tag": "25-TIC-1201.SP", "description": "SP", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-tic1305-pv": {"id": "readout-u25-tic1305-pv", "parent": "u25-air-cooler-2501", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 3670, "y": 510}, "attribute": "text", "point_tag": "25-TIC-1305.PV", "description": "Air Cooler T", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-u25-tic2260-pv": {"id": "readout-u25-tic2260-pv", "parent": "u25-column-2502", "mapping": {"type": "text", "format": "%.1f", "suffix": "°F"}, "position": {"x": 4480, "y": 1900}, "attribute": "text", "point_tag": "25-TIC-2260.PV", "description": "Reboiler T", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "kpi-u24-h2-export-spark": {"id": "kpi-u24-h2-export-spark", "mapping": {"type": "sparkline", "time_window_minutes": 60}, "position": {"x": 350, "y": 140}, "attribute": "text", "point_tag": "24-FI-0801", "source_hint": "SimBLAH-OPC", "element_type": "sparkline"}, "kpi-u24-h2-purity-spark": {"id": "kpi-u24-h2-purity-spark", "mapping": {"type": "sparkline", "time_window_minutes": 60}, "position": {"x": 120, "y": 140}, "attribute": "text", "point_tag": "24-AI-0601", "source_hint": "SimBLAH-OPC", "element_type": "sparkline"}, "kpi-u25-specific-energy": {"id": "kpi-u25-specific-energy", "mapping": {"type": "text", "format": "%.2f", "suffix": ""}, "position": {"x": 3950, "y": 110}, "attribute": "text", "point_tag": "25-CALC-3109", "description": "Specific Energy", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "status-u24-sic0801-mode": {"id": "status-u24-sic0801-mode", "parent": "u24-compressor-2401", "mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "position": {"x": 1690, "y": 911}, "attribute": "class", "point_tag": "24-SIC-0801.MODE", "source_hint": "SimBLAH-OPC", "element_type": "digital_status"}, "status-u24-tic0401-mode": {"id": "status-u24-tic0401-mode", "parent": "u24-heater-2401", "mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "position": {"x": 520, "y": 618}, "attribute": "class", "point_tag": "24-TIC-0401.MODE", "source_hint": "SimBLAH-OPC", "element_type": "digital_status"}, "status-u25-fic1001-mode": {"id": "status-u25-fic1001-mode", "parent": "u25-vessel-2501", "mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "position": {"x": 2160, "y": 1091}, "attribute": "class", "point_tag": "25-FIC-1001.MODE", "source_hint": "SimBLAH-OPC", "element_type": "digital_status"}, "status-u25-sic2001-mode": {"id": "status-u25-sic2001-mode", "parent": "u25-compressor-2501", "mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "position": {"x": 4330, "y": 791}, "attribute": "class", "point_tag": "25-SIC-2001.MODE", "source_hint": "SimBLAH-OPC", "element_type": "digital_status"}, "status-u25-tic1010-mode": {"id": "status-u25-tic1010-mode", "parent": "u25-heater-2501", "mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "position": {"x": 2740, "y": 618}, "attribute": "class", "point_tag": "25-TIC-1010.MODE", "source_hint": "SimBLAH-OPC", "element_type": "digital_status"}, "status-u25-tic1101-mode": {"id": "status-u25-tic1101-mode", "parent": "u25-reactor-2501", "mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "position": {"x": 2980, "y": 488}, "attribute": "class", "point_tag": "25-TIC-1101.MODE", "source_hint": "SimBLAH-OPC", "element_type": "digital_status"}, "status-u25-tic1201-mode": {"id": "status-u25-tic1201-mode", "parent": "u25-reactor-2502", "mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "position": {"x": 3300, "y": 568}, "attribute": "class", "point_tag": "25-TIC-1201.MODE", "source_hint": "SimBLAH-OPC", "element_type": "digital_status"}, "kpi-u24-outlet-ch4-spark": {"id": "kpi-u24-outlet-ch4-spark", "mapping": {"type": "sparkline", "time_window_minutes": 60}, "position": {"x": 1040, "y": 140}, "attribute": "text", "point_tag": "24-AI-0403", "source_hint": "SimBLAH-OPC", "element_type": "sparkline"}, "kpi-u24-reformer-t-spark": {"id": "kpi-u24-reformer-t-spark", "mapping": {"type": "sparkline", "time_window_minutes": 60}, "position": {"x": 580, "y": 140}, "attribute": "text", "point_tag": "24-TIC-0401.PV", "source_hint": "SimBLAH-OPC", "element_type": "sparkline"}, "kpi-u25-conversion-spark": {"id": "kpi-u25-conversion-spark", "mapping": {"type": "sparkline", "time_window_minutes": 60}, "position": {"x": 2700, "y": 140}, "attribute": "text", "point_tag": "25-CONV-1001", "source_hint": "SimBLAH-OPC", "element_type": "sparkline"}, "kpi-u25-h2hc-ratio-spark": {"id": "kpi-u25-h2hc-ratio-spark", "mapping": {"type": "sparkline", "time_window_minutes": 60}, "position": {"x": 3200, "y": 140}, "attribute": "text", "point_tag": "25-CALC-3104", "source_hint": "SimBLAH-OPC", "element_type": "sparkline"}, "alarm-u24-compressor-2401": {"id": "alarm-u24-compressor-2401", "parent": "u24-compressor-2401", "mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["24-SIC-0801.PV", "24-PI-0801", "24-PI-0803", "24-VT-0801-1X"]}, "position": {"x": 1750, "y": 900}, "attribute": "visibility", "source_hint": "SimBLAH-OPC", "element_type": "alarm_indicator"}, "alarm-u25-compressor-2501": {"id": "alarm-u25-compressor-2501", "parent": "u25-compressor-2501", "mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-SIC-2001.PV", "25-PI-2001", "25-PI-2002", "25-VSHH-2001"]}, "position": {"x": 4395, "y": 740}, "attribute": "visibility", "source_hint": "SimBLAH-OPC", "element_type": "alarm_indicator"}, "kpi-u25-diesel-sulfur-spark": {"id": "kpi-u25-diesel-sulfur-spark", "mapping": {"type": "sparkline", "time_window_minutes": 60}, "position": {"x": 3700, "y": 140}, "attribute": "text", "point_tag": "25-AI-3001", "source_hint": "SimBLAH-OPC", "element_type": "sparkline"}, "readout-interconnect-fi0801": {"id": "readout-interconnect-fi0801", "mapping": {"type": "text", "format": "%.2f", "suffix": "MMSCFD"}, "position": {"x": 1870, "y": 1020}, "attribute": "text", "point_tag": "24-FI-0801", "description": "H2 Delivery Flow", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "readout-interconnect-pi0803": {"id": "readout-interconnect-pi0803", "mapping": {"type": "text", "format": "%.0f", "suffix": "PSIG"}, "position": {"x": 1870, "y": 1050}, "attribute": "text", "point_tag": "24-PI-0803", "description": "H2 Delivery P", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "kpi-u25-h2-consumption-spark": {"id": "kpi-u25-h2-consumption-spark", "mapping": {"type": "sparkline", "time_window_minutes": 60}, "position": {"x": 3450, "y": 140}, "attribute": "text", "point_tag": "25-CALC-3105", "source_hint": "SimBLAH-OPC", "element_type": "sparkline"}, "readout-interconnect-fic1501": {"id": "readout-interconnect-fic1501", "mapping": {"type": "text", "format": "%.2f", "suffix": "MMSCFD"}, "position": {"x": 1870, "y": 1080}, "attribute": "text", "point_tag": "25-FIC-1501.PV", "description": "Makeup H2 SP", "source_hint": "SimBLAH-OPC", "element_type": "text_readout"}, "kpi-u25-specific-energy-spark": {"id": "kpi-u25-specific-energy-spark", "mapping": {"type": "sparkline", "time_window_minutes": 60}, "position": {"x": 3950, "y": 140}, "attribute": "text", "point_tag": "25-CALC-3109", "source_hint": "SimBLAH-OPC", "element_type": "sparkline"}}, "metadata": {"tags": ["unit24", "unit25", "h2plant", "hcu", "hydrocracker", "reformer", "combined", "end-to-end", "integration"], "width": 5120, "height": 2880, "viewBox": "0 0 5120 2880", "description": "End-to-end combined process view of the H2 Plant (Unit 24) and Hydrocracker (Unit 25). H2 Plant occupies the left third of the canvas; HCU occupies the right ~60%. The H2 delivery interconnect between units is the visual centerpiece. Tag density is reduced (~136 total tags) to emphasize process flow over detail.", "background_color": "#09090B"}, "annotations": [{"id": "label-title-bar", "size": "14px 600", "type": "text", "style": "#A1A1AA", "content": "UNIT 24 + UNIT 25 — INTEGRATED H₂ PRODUCTION & HYDROCRACKING", "position": {"x": 50, "y": 42}}, {"id": "label-title-timestamp", "size": "11px normal", "type": "text", "style": "#71717A", "content": "[live timestamp]", "position": {"x": 5000, "y": 42}}, {"id": "label-unit24-area", "size": "18px 600", "type": "text", "style": "#E5E5E5", "content": "UNIT 24 — H₂ PLANT", "position": {"x": 880, "y": 230}}, {"id": "label-unit25-area", "size": "18px 600", "type": "text", "style": "#E5E5E5", "content": "UNIT 25 — HYDROCRACKER", "position": {"x": 3580, "y": 230}}, {"id": "label-kpi-divider", "end": {"x": 5120, "y": 200}, "type": "line", "start": {"x": 0, "y": 200}, "style": "1px stroke #3F3F46"}, {"id": "label-esd-divider", "end": {"x": 5120, "y": 2800}, "type": "line", "start": {"x": 0, "y": 2800}, "style": "1px stroke #3F3F46"}, {"id": "label-interconnect-divider", "end": {"x": 1900, "y": 2800}, "type": "line", "start": {"x": 1900, "y": 200}, "style": "1px dashed stroke #27272A"}, {"id": "label-interconnect-unit", "size": "12px 600", "type": "text", "style": "#71717A rotate 90°", "content": "UNIT 24 | UNIT 25", "position": {"x": 1900, "y": 100}}, {"id": "label-h2delivery-title", "size": "14px 600", "type": "text", "style": "#A1A1AA", "content": "H₂ DELIVERY", "position": {"x": 1860, "y": 850}}, {"id": "label-h2delivery-subtitle", "size": "10px normal", "type": "text", "style": "#71717A", "content": "Unit 24 → Unit 25", "position": {"x": 1860, "y": 870}}, {"id": "rect-h2delivery-bg", "type": "rect", "style": "fill #18181B stroke 1px #27272A", "width": 200, "height": 120, "position": {"x": 1855, "y": 840}}, {"id": "label-recycle-h2", "size": "10px normal", "type": "text", "style": "#71717A", "content": "RECYCLE H₂", "position": {"x": 3600, "y": 310}}, {"id": "label-equip-v2401", "size": "10px normal", "type": "text", "style": "#A1A1AA", "content": "V-2401", "position": {"x": 220, "y": 1190}}, {"id": "label-equip-e2401", "size": "10px normal", "type": "text", "style": "#A1A1AA", "content": "E-2401", "position": {"x": 370, "y": 1190}}, {"id": "label-equip-h2401", "size": "12px 600", "type": "text", "style": "#A1A1AA", "content": "H-2401", "position": {"x": 570, "y": 1530}}, {"id": "label-equip-steam-drum", "size": "10px normal", "type": "text", "style": "#A1A1AA", "content": "Steam Drum", "position": {"x": 600, "y": 420}}, {"id": "label-equip-e2402", "size": "10px normal", "type": "text", "style": "#A1A1AA", "content": "E-2402", "position": {"x": 1070, "y": 1080}}, {"id": "label-equip-hts", "size": "10px normal", "type": "text", "style": "#A1A1AA", "content": "HTS", "position": {"x": 1200, "y": 1250}}, {"id": "label-equip-lts", "size": "10px normal", "type": "text", "style": "#A1A1AA", "content": "LTS", "position": {"x": 1360, "y": 1250}}, {"id": "label-equip-psa", "size": "10px normal", "type": "text", "style": "#A1A1AA", "content": "PSA Unit", "position": {"x": 1560, "y": 1270}}, {"id": "label-equip-k2401", "size": "10px normal", "type": "text", "style": "#A1A1AA", "content": "K-2401", "position": {"x": 1690, "y": 1130}}, {"id": "label-equip-k2502", "size": "10px normal", "type": "text", "style": "#A1A1AA", "content": "K-2502", "position": {"x": 2050, "y": 870}}, {"id": "label-equip-v2501", "size": "10px normal", "type": "text", "style": "#A1A1AA", "content": "V-2501", "position": {"x": 2220, "y": 1190}}, {"id": "label-equip-h2501", "size": "12px 600", "type": "text", "style": "#A1A1AA", "content": "H-2501", "position": {"x": 2820, "y": 1080}}, {"id": "label-equip-r2501", "size": "10px normal", "type": "text", "style": "#A1A1AA", "content": "R-2501", "position": {"x": 3100, "y": 1480}}, {"id": "label-equip-r2502", "size": "10px normal", "type": "text", "style": "#A1A1AA", "content": "R-2502", "position": {"x": 3410, "y": 1500}}, {"id": "label-equip-a2501", "size": "10px normal", "type": "text", "style": "#A1A1AA", "content": "A-2501", "position": {"x": 3670, "y": 700}}, {"id": "label-equip-v2502", "size": "10px normal", "type": "text", "style": "#A1A1AA", "content": "V-2502 (HHPS)", "position": {"x": 3830, "y": 1010}}, {"id": "label-equip-v2503", "size": "10px normal", "type": "text", "style": "#A1A1AA", "content": "V-2503 (CHPS)", "position": {"x": 3830, "y": 1380}}, {"id": "label-equip-v2504", "size": "10px normal", "type": "text", "style": "#A1A1AA", "content": "V-2504 (HLPS)", "position": {"x": 4000, "y": 1100}}, {"id": "label-equip-v2505", "size": "10px normal", "type": "text", "style": "#A1A1AA", "content": "V-2505 (CLPS)", "position": {"x": 4000, "y": 1360}}, {"id": "label-equip-c2507", "size": "10px normal", "type": "text", "style": "#A1A1AA", "content": "C-2507", "position": {"x": 4130, "y": 870}}, {"id": "label-equip-k2501", "size": "10px normal", "type": "text", "style": "#A1A1AA", "content": "K-2501", "position": {"x": 4330, "y": 1080}}, {"id": "label-equip-c2501", "size": "10px normal", "type": "text", "style": "#A1A1AA", "content": "C-2501", "position": {"x": 4490, "y": 1500}}, {"id": "label-equip-c2502", "size": "12px 600", "type": "text", "style": "#A1A1AA", "content": "C-2502", "position": {"x": 4600, "y": 1950}}, {"id": "label-equip-c2503", "size": "10px normal", "type": "text", "style": "#A1A1AA", "content": "C-2503", "position": {"x": 4820, "y": 1280}}, {"id": "label-equip-c2504", "size": "10px normal", "type": "text", "style": "#A1A1AA", "content": "C-2504", "position": {"x": 4940, "y": 1280}}, {"id": "label-product-lpg", "size": "9px normal", "type": "text", "style": "#71717A", "content": "LPG →", "position": {"x": 5000, "y": 545}}, {"id": "label-product-ln", "size": "9px normal", "type": "text", "style": "#71717A", "content": "LN →", "position": {"x": 5000, "y": 605}}, {"id": "label-product-hn", "size": "9px normal", "type": "text", "style": "#71717A", "content": "HN →", "position": {"x": 5000, "y": 665}}, {"id": "label-product-kero", "size": "9px normal", "type": "text", "style": "#71717A", "content": "Kero →", "position": {"x": 5000, "y": 775}}, {"id": "label-product-diesel", "size": "9px normal", "type": "text", "style": "#71717A", "content": "Diesel →", "position": {"x": 5000, "y": 675}}, {"id": "label-product-uco", "size": "9px normal", "type": "text", "style": "#71717A", "content": "UCO →", "position": {"x": 5000, "y": 1795}}, {"id": "label-section-feed-desulf", "size": "11px 600", "type": "text", "style": "#71717A", "content": "NG Feed & Desulf", "position": {"x": 200, "y": 950}}, {"id": "label-section-reformer", "size": "11px 600", "type": "text", "style": "#71717A", "content": "Reformer Section", "position": {"x": 570, "y": 450}}, {"id": "label-section-whb-shift", "size": "11px 600", "type": "text", "style": "#71717A", "content": "WHB + Shift", "position": {"x": 1200, "y": 740}}, {"id": "label-section-psa", "size": "11px 600", "type": "text", "style": "#71717A", "content": "PSA Unit", "position": {"x": 1560, "y": 640}}, {"id": "label-section-feed-preheat", "size": "11px 600", "type": "text", "style": "#71717A", "content": "Feed Preheat", "position": {"x": 2370, "y": 950}}, {"id": "label-section-heater", "size": "11px 600", "type": "text", "style": "#71717A", "content": "Charge Heater", "position": {"x": 2820, "y": 460}}, {"id": "label-section-reactors", "size": "11px 600", "type": "text", "style": "#71717A", "content": "Reactor Section", "position": {"x": 3250, "y": 320}}, {"id": "label-section-hp-sep", "size": "11px 600", "type": "text", "style": "#71717A", "content": "HP Separation", "position": {"x": 3800, "y": 480}}, {"id": "label-section-rgc", "size": "11px 600", "type": "text", "style": "#71717A", "content": "RGC Loop", "position": {"x": 4200, "y": 260}}, {"id": "label-section-frac", "size": "11px 600", "type": "text", "style": "#71717A", "content": "Fractionation", "position": {"x": 4700, "y": 160}}, {"id": "label-esd-bar-title", "size": "9px normal", "type": "text", "style": "#71717A", "content": "ESD / RUNNING STATUS", "position": {"x": 50, "y": 2820}}]}'::jsonb,
  '{"module": "process"}'::jsonb,
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  svg_data = EXCLUDED.svg_data,
  metadata = EXCLUDED.metadata,
  bindings = EXCLUDED.bindings;

-- UNIT 24 — HYDROGEN PLANT (SMR) — PROCESS OVERVIEW
INSERT INTO design_objects (id, name, type, svg_data, bindings, metadata, created_by)
VALUES (
  '401ed010-2a20-4bf0-afe0-9324afbc19a2',
  'UNIT 24 — HYDROGEN PLANT (SMR) — PROCESS OVERVIEW',
  'graphic',
  $svg$<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2560 1440">
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 Z" fill="#71717A"/>
    </marker>
    <marker id="arr-g" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 Z" fill="#34D399"/>
    </marker>
    <marker id="arr-b" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 Z" fill="#60A5FA"/>
    </marker>
    <marker id="arr-o" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 Z" fill="#F97316"/>
    </marker>
    <marker id="arr-r" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 Z" fill="#EF4444"/>
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="#09090B"/>
  <text x="1280" y="52" text-anchor="middle" font-family="monospace" font-size="22" font-weight="bold" fill="#E4E4E7">UNIT 24 — HYDROGEN PLANT (SMR) — PROCESS OVERVIEW</text>
  <line x1="250" y1="70" x2="250" y2="920" stroke="#27272A" stroke-width="1" stroke-dasharray="3,5"/>
  <line x1="460" y1="70" x2="460" y2="920" stroke="#27272A" stroke-width="1" stroke-dasharray="3,5"/>
  <line x1="760" y1="70" x2="760" y2="920" stroke="#27272A" stroke-width="1" stroke-dasharray="3,5"/>
  <line x1="1400" y1="70" x2="1400" y2="920" stroke="#27272A" stroke-width="1" stroke-dasharray="3,5"/>
  <line x1="1760" y1="70" x2="1760" y2="920" stroke="#27272A" stroke-width="1" stroke-dasharray="3,5"/>
  <text x="145" y="88" text-anchor="middle" font-family="monospace" font-size="11" fill="#52525B">DESULFURIZATION</text>
  <text x="355" y="88" text-anchor="middle" font-family="monospace" font-size="11" fill="#52525B">PREHEAT</text>
  <text x="607" y="88" text-anchor="middle" font-family="monospace" font-size="11" fill="#52525B">REFORMING</text>
  <text x="1080" y="88" text-anchor="middle" font-family="monospace" font-size="11" fill="#52525B">SHIFT CONVERSION</text>
  <text x="1578" y="88" text-anchor="middle" font-family="monospace" font-size="11" fill="#52525B">PRESSURE SWING ADSORPTION</text>
  <text x="1950" y="88" text-anchor="middle" font-family="monospace" font-size="11" fill="#52525B">COMPRESSION &amp; EXPORT</text>
  <text x="30" y="170" font-family="monospace" font-size="12" fill="#3B82F6">— STEAM SYSTEM —</text>
  <path d="M 18 235 L 100 235" stroke="#60A5FA" stroke-width="2" fill="none" marker-end="url(#arr-b)"/>
  <text x="20" y="222" font-family="monospace" font-size="10" fill="#60A5FA">BFW IN</text>
  <g id="v-stm-drum" transform="translate(100,210)">
    <rect width="110" height="50" rx="25" fill="#18181B" stroke="#3B82F6" stroke-width="1.5"/>
    <text x="55" y="19" text-anchor="middle" font-family="monospace" font-size="9" fill="#60A5FA">STM DRUM</text>
    <text x="55" y="33" text-anchor="middle" font-family="monospace" font-size="9" fill="#3B82F6">V-2401D</text>
  </g>
  <path d="M 210 235 L 530 235" stroke="#60A5FA" stroke-width="2" fill="none"/>
  <text x="368" y="222" text-anchor="middle" font-family="monospace" font-size="10" fill="#60A5FA">STEAM</text>
  <g id="e-sh" transform="translate(530,210)">
    <rect width="100" height="50" fill="#1C1917" stroke="#78350F" stroke-width="1.5"/>
    <line x1="25" y1="0" x2="25" y2="50" stroke="#92400E" stroke-width="1" stroke-dasharray="2,2"/>
    <line x1="50" y1="0" x2="50" y2="50" stroke="#92400E" stroke-width="1" stroke-dasharray="2,2"/>
    <line x1="75" y1="0" x2="75" y2="50" stroke="#92400E" stroke-width="1" stroke-dasharray="2,2"/>
    <text x="50" y="31" text-anchor="middle" font-family="monospace" font-size="9" fill="#F59E0B">E-SH</text>
  </g>
  <text x="580" y="278" text-anchor="middle" font-family="monospace" font-size="10" fill="#A1A1AA">SUPERHEATER</text>
  <path d="M 580 260 L 580 310 L 250 310 L 250 760" stroke="#60A5FA" stroke-width="2" fill="none" stroke-dasharray="6,3"/>
  <text x="440" y="302" text-anchor="middle" font-family="monospace" font-size="10" fill="#60A5FA">PROCESS STEAM</text>
  <circle cx="250" cy="760" r="5" fill="#60A5FA"/>
  <path d="M 630 235 L 880 235" stroke="#60A5FA" stroke-width="2" fill="none" marker-end="url(#arr-b)"/>
  <text x="752" y="222" text-anchor="middle" font-family="monospace" font-size="10" fill="#60A5FA">EXPORT STEAM</text>
  <path d="M 795 730 L 795 380 L 155 380 L 155 260" stroke="#60A5FA" stroke-width="1.5" fill="none" stroke-dasharray="4,3" opacity="0.6"/>
  <text x="476" y="372" text-anchor="middle" font-family="monospace" font-size="9" fill="#60A5FA" opacity="0.7">STEAM CIRC (WHB)</text>
  <g id="stack" transform="translate(461,110)">
    <rect width="20" height="90" fill="#27272A" stroke="#52525B" stroke-width="1.5"/>
    <rect x="-12" y="82" width="44" height="12" rx="2" fill="#27272A" stroke="#52525B" stroke-width="1"/>
  </g>
  <text x="486" y="158" font-family="monospace" font-size="9" fill="#71717A">CEMS</text>
  <text x="471" y="216" text-anchor="middle" font-family="monospace" font-size="10" fill="#71717A">STACK</text>
  <path d="M 580 590 L 580 450 L 471 450 L 471 202" stroke="#EF4444" stroke-width="2" fill="none" stroke-dasharray="8,3" marker-end="url(#arr-r)"/>
  <text x="528" y="440" text-anchor="middle" font-family="monospace" font-size="10" fill="#EF4444">FLUE GAS</text>
  <path d="M 18 760 L 90 760" stroke="#71717A" stroke-width="2" fill="none" marker-end="url(#arr)"/>
  <text x="20" y="748" font-family="monospace" font-size="10" fill="#E4E4E7">NG FEED</text>
  <g id="v-2401" transform="translate(100,690)">
    <rect width="60" height="140" rx="22" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <text x="30" y="60" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">V</text>
    <text x="30" y="74" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">DSUF</text>
  </g>
  <text x="130" y="850" text-anchor="middle" font-family="monospace" font-size="11" fill="#E4E4E7">V-2401</text>
  <text x="130" y="865" text-anchor="middle" font-family="monospace" font-size="10" fill="#A1A1AA">DESULFURIZER</text>
  <path id="pipe-desulf-to-preheat" d="M 160 760 L 285 760" stroke="#71717A" stroke-width="2" fill="none"/>
  <g id="e-2401" transform="translate(285,730)">
    <rect width="120" height="60" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <ellipse cx="30" cy="30" rx="13" ry="22" fill="none" stroke="#3F3F46" stroke-width="1"/>
    <line x1="43" y1="30" x2="77" y2="30" stroke="#3F3F46" stroke-width="1"/>
    <ellipse cx="90" cy="30" rx="13" ry="22" fill="none" stroke="#3F3F46" stroke-width="1"/>
  </g>
  <text x="345" y="808" text-anchor="middle" font-family="monospace" font-size="11" fill="#E4E4E7">E-2401</text>
  <text x="345" y="822" text-anchor="middle" font-family="monospace" font-size="10" fill="#A1A1AA">PREHEAT</text>
  <path id="pipe-preheat-to-reformer" d="M 405 760 L 505 760" stroke="#71717A" stroke-width="2" fill="none"/>
  <g id="h-2401-conv" transform="translate(505,590)">
    <rect width="160" height="60" fill="#1C1917" stroke="#78350F" stroke-width="1.5"/>
    <text x="80" y="22" text-anchor="middle" font-family="monospace" font-size="9" fill="#D97706">CONVECTION</text>
    <text x="80" y="38" text-anchor="middle" font-family="monospace" font-size="9" fill="#D97706">SECTION</text>
  </g>
  <g id="h-2401-firebox" transform="translate(505,650)">
    <rect width="160" height="190" fill="#1C1917" stroke="#B45309" stroke-width="2"/>
    <text x="80" y="28" text-anchor="middle" font-family="monospace" font-size="11" fill="#F59E0B">H-2401</text>
    <text x="80" y="44" text-anchor="middle" font-family="monospace" font-size="10" fill="#D97706">REFORMER</text>
    <line x1="40" y1="58" x2="40" y2="170" stroke="#78350F" stroke-width="1.5" stroke-dasharray="3,3"/>
    <line x1="60" y1="58" x2="60" y2="170" stroke="#78350F" stroke-width="1.5" stroke-dasharray="3,3"/>
    <line x1="80" y1="58" x2="80" y2="170" stroke="#78350F" stroke-width="1.5" stroke-dasharray="3,3"/>
    <line x1="100" y1="58" x2="100" y2="170" stroke="#78350F" stroke-width="1.5" stroke-dasharray="3,3"/>
    <line x1="120" y1="58" x2="120" y2="170" stroke="#78350F" stroke-width="1.5" stroke-dasharray="3,3"/>
    <path d="M 38 178 Q 45 162 48 174 Q 51 160 55 174 Q 58 162 52 178 Z" fill="#F97316" opacity="0.7"/>
    <path d="M 72 178 Q 79 162 82 174 Q 85 160 89 174 Q 92 162 86 178 Z" fill="#F97316" opacity="0.7"/>
    <path d="M 106 178 Q 113 162 116 174 Q 119 160 123 174 Q 126 162 120 178 Z" fill="#F97316" opacity="0.7"/>
  </g>
  <path id="pipe-reformer-out" d="M 665 760 L 745 760" stroke="#F97316" stroke-width="2.5" fill="none"/>
  <text x="705" y="748" text-anchor="middle" font-family="monospace" font-size="9" fill="#F97316">~850°C</text>
  <g id="e-whb" transform="translate(745,730)">
    <rect width="100" height="60" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <ellipse cx="25" cy="30" rx="13" ry="22" fill="none" stroke="#3F3F46" stroke-width="1"/>
    <line x1="38" y1="30" x2="62" y2="30" stroke="#3F3F46" stroke-width="1"/>
    <ellipse cx="75" cy="30" rx="13" ry="22" fill="none" stroke="#3F3F46" stroke-width="1"/>
  </g>
  <text x="795" y="808" text-anchor="middle" font-family="monospace" font-size="11" fill="#E4E4E7">E-WHB</text>
  <text x="795" y="822" text-anchor="middle" font-family="monospace" font-size="10" fill="#A1A1AA">WASTE HEAT BOILER</text>
  <path id="pipe-whb-to-hts" d="M 845 760 L 920 760" stroke="#71717A" stroke-width="2" fill="none"/>
  <g id="r-2401" transform="translate(920,680)">
    <rect width="70" height="160" rx="12" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <rect x="8" y="55" width="54" height="62" rx="4" fill="#27272A" opacity="0.5"/>
    <text x="35" y="72" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">HTS</text>
    <text x="35" y="86" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">CAT</text>
  </g>
  <text x="955" y="858" text-anchor="middle" font-family="monospace" font-size="11" fill="#E4E4E7">R-2401</text>
  <text x="955" y="872" text-anchor="middle" font-family="monospace" font-size="10" fill="#A1A1AA">HTS REACTOR</text>
  <path id="pipe-hts-to-intcl" d="M 990 760 L 1060 760" stroke="#71717A" stroke-width="2" fill="none"/>
  <g id="e-intcl" transform="translate(1060,730)">
    <rect width="100" height="60" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <ellipse cx="25" cy="30" rx="13" ry="22" fill="none" stroke="#3F3F46" stroke-width="1"/>
    <line x1="38" y1="30" x2="62" y2="30" stroke="#3F3F46" stroke-width="1"/>
    <ellipse cx="75" cy="30" rx="13" ry="22" fill="none" stroke="#3F3F46" stroke-width="1"/>
  </g>
  <text x="1110" y="808" text-anchor="middle" font-family="monospace" font-size="11" fill="#E4E4E7">E-INTCL</text>
  <text x="1110" y="822" text-anchor="middle" font-family="monospace" font-size="10" fill="#A1A1AA">INTERCOOLER</text>
  <path id="pipe-intcl-to-lts" d="M 1160 760 L 1230 760" stroke="#71717A" stroke-width="2" fill="none"/>
  <g id="r-2402" transform="translate(1230,680)">
    <rect width="70" height="160" rx="12" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <rect x="8" y="55" width="54" height="62" rx="4" fill="#27272A" opacity="0.5"/>
    <text x="35" y="72" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">LTS</text>
    <text x="35" y="86" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">CAT</text>
  </g>
  <text x="1265" y="858" text-anchor="middle" font-family="monospace" font-size="11" fill="#E4E4E7">R-2402</text>
  <text x="1265" y="872" text-anchor="middle" font-family="monospace" font-size="10" fill="#A1A1AA">LTS REACTOR</text>
  <path id="pipe-lts-to-psa" d="M 1300 760 L 1410 760" stroke="#71717A" stroke-width="2" fill="none"/>
  <text x="1354" y="748" text-anchor="middle" font-family="monospace" font-size="10" fill="#A1A1AA">SYNGAS</text>
  <path id="pipe-psa-feed-hdr" d="M 1410 420 L 1410 1070" stroke="#71717A" stroke-width="3" fill="none"/>
  <text x="1398" y="415" text-anchor="end" font-family="monospace" font-size="10" fill="#A1A1AA">FEED HDR</text>
  <path id="pipe-tailgas-collect" d="M 1480 560 L 1480 1200" stroke="#A1A1AA" stroke-width="2" fill="none" stroke-dasharray="5,3"/>
  <g id="a-2401a" transform="translate(1440,440)">
    <rect width="80" height="120" rx="12" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <rect x="10" y="38" width="60" height="58" rx="4" fill="#27272A" opacity="0.6"/>
    <text x="40" y="26" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">PSA</text>
    <text x="40" y="74" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">BED A</text>
  </g>
  <text x="1480" y="576" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">A-2401A</text>
  <path id="pipe-psa-a-feed" d="M 1410 500 L 1440 500" stroke="#71717A" stroke-width="2" fill="none"/>
  <path id="pipe-psa-a-prod" d="M 1520 500 L 1600 500" stroke="#34D399" stroke-width="2" fill="none"/>
  <g id="a-2401b" transform="translate(1440,700)">
    <rect width="80" height="120" rx="12" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <rect x="10" y="38" width="60" height="58" rx="4" fill="#27272A" opacity="0.6"/>
    <text x="40" y="26" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">PSA</text>
    <text x="40" y="74" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">BED B</text>
  </g>
  <text x="1480" y="836" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">A-2401B</text>
  <path id="pipe-psa-b-feed" d="M 1410 760 L 1440 760" stroke="#71717A" stroke-width="2" fill="none"/>
  <path id="pipe-psa-b-prod" d="M 1520 760 L 1600 760" stroke="#34D399" stroke-width="2" fill="none"/>
  <g id="a-2401c" transform="translate(1440,960)">
    <rect width="80" height="120" rx="12" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <rect x="10" y="38" width="60" height="58" rx="4" fill="#27272A" opacity="0.6"/>
    <text x="40" y="26" text-anchor="middle" font-family="monospace" font-size="9" fill="#A1A1AA">PSA</text>
    <text x="40" y="74" text-anchor="middle" font-family="monospace" font-size="9" fill="#71717A">BED C</text>
  </g>
  <text x="1480" y="1096" text-anchor="middle" font-family="monospace" font-size="10" fill="#E4E4E7">A-2401C</text>
  <path id="pipe-psa-c-feed" d="M 1410 1020 L 1440 1020" stroke="#71717A" stroke-width="2" fill="none"/>
  <path id="pipe-psa-c-prod" d="M 1520 1020 L 1600 1020" stroke="#34D399" stroke-width="2" fill="none"/>
  <path id="pipe-h2-prod-hdr" d="M 1600 480 L 1600 1040" stroke="#34D399" stroke-width="3" fill="none"/>
  <text x="1612" y="478" font-family="monospace" font-size="10" fill="#34D399">H2 PROD HDR</text>
  <path id="pipe-h2-to-comp" d="M 1600 760 L 1700 760" stroke="#34D399" stroke-width="2" fill="none"/>
  <path id="pipe-tailgas-hdr" d="M 1480 1200 L 585 1200" stroke="#A1A1AA" stroke-width="2" fill="none" stroke-dasharray="5,3"/>
  <text x="1032" y="1220" text-anchor="middle" font-family="monospace" font-size="10" fill="#A1A1AA">PSA TAIL GAS → FUEL HEADER</text>
  <g id="k-2401" transform="translate(1700,700)">
    <circle cx="60" cy="60" r="60" fill="#18181B" stroke="#52525B" stroke-width="1.5"/>
    <line x1="60" y1="60" x2="60" y2="18" stroke="#3F3F46" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="60" y1="60" x2="93" y2="39" stroke="#3F3F46" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="60" y1="60" x2="99" y2="75" stroke="#3F3F46" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="60" y1="60" x2="60" y2="102" stroke="#3F3F46" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="60" y1="60" x2="27" y2="81" stroke="#3F3F46" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="60" y1="60" x2="21" y2="45" stroke="#3F3F46" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="60" cy="60" r="5" fill="#52525B"/>
  </g>
  <text x="1760" y="782" text-anchor="middle" font-family="monospace" font-size="11" fill="#E4E4E7">K-2401</text>
  <text x="1760" y="798" text-anchor="middle" font-family="monospace" font-size="10" fill="#A1A1AA">H2 COMPRESSOR</text>
  <path id="pipe-h2-export" d="M 1820 760 L 2500 760" stroke="#34D399" stroke-width="2.5" fill="none" marker-end="url(#arr-g)"/>
  <text x="2155" y="745" text-anchor="middle" font-family="monospace" font-size="13" font-weight="bold" fill="#34D399">H2 EXPORT → HCU UNIT 25</text>
  <text x="2155" y="782" text-anchor="middle" font-family="monospace" font-size="11" fill="#6EE7B7">99.9%+ H2</text>
  <text x="30" y="1155" font-family="monospace" font-size="12" fill="#F97316">— FUEL GAS SYSTEM —</text>
  <path d="M 18 1200 L 100 1200" stroke="#F97316" stroke-width="2" fill="none" marker-end="url(#arr-o)"/>
  <text x="20" y="1188" font-family="monospace" font-size="10" fill="#F97316">FUEL GAS IN</text>
  <path id="pipe-fuel-hdr" d="M 100 1200 L 585 1200" stroke="#F97316" stroke-width="2" fill="none"/>
  <circle cx="585" cy="1200" r="4" fill="#F97316"/>
  <path id="pipe-fuel-to-reformer" d="M 585 1200 L 585 843" stroke="#F97316" stroke-width="2" fill="none" marker-end="url(#arr-o)"/>
  <text x="603" y="1030" font-family="monospace" font-size="10" fill="#F97316">FUEL TO</text>
  <text x="603" y="1044" font-family="monospace" font-size="10" fill="#F97316">BURNERS</text>
  <rect x="1840" y="858" width="310" height="230" rx="4" fill="#0F0F11" stroke="#27272A" stroke-width="1"/>
  <text x="1995" y="881" text-anchor="middle" font-family="monospace" font-size="11" fill="#71717A">LEGEND</text>
  <line x1="1860" y1="898" x2="1910" y2="898" stroke="#71717A" stroke-width="2"/>
  <text x="1920" y="902" font-family="monospace" font-size="10" fill="#A1A1AA">Process Gas / Syngas</text>
  <line x1="1860" y1="918" x2="1910" y2="918" stroke="#34D399" stroke-width="2"/>
  <text x="1920" y="922" font-family="monospace" font-size="10" fill="#A1A1AA">Hydrogen Product</text>
  <line x1="1860" y1="938" x2="1910" y2="938" stroke="#60A5FA" stroke-width="2"/>
  <text x="1920" y="942" font-family="monospace" font-size="10" fill="#A1A1AA">Steam / BFW</text>
  <line x1="1860" y1="958" x2="1910" y2="958" stroke="#F97316" stroke-width="2"/>
  <text x="1920" y="962" font-family="monospace" font-size="10" fill="#A1A1AA">Fuel Gas</text>
  <line x1="1860" y1="978" x2="1910" y2="978" stroke="#EF4444" stroke-width="2" stroke-dasharray="8,3"/>
  <text x="1920" y="982" font-family="monospace" font-size="10" fill="#A1A1AA">Flue Gas</text>
  <line x1="1860" y1="998" x2="1910" y2="998" stroke="#A1A1AA" stroke-width="2" stroke-dasharray="5,3"/>
  <text x="1920" y="1002" font-family="monospace" font-size="10" fill="#A1A1AA">PSA Tail Gas</text>
  <line x1="1860" y1="1018" x2="1910" y2="1018" stroke="#60A5FA" stroke-width="1.5" stroke-dasharray="6,3"/>
  <text x="1920" y="1022" font-family="monospace" font-size="10" fill="#A1A1AA">Process Steam</text>
  <line x1="1860" y1="1038" x2="1910" y2="1038" stroke="#F97316" stroke-width="2.5"/>
  <text x="1920" y="1042" font-family="monospace" font-size="10" fill="#A1A1AA">Hot Reformed Gas</text>
  <text x="1995" y="1076" text-anchor="middle" font-family="monospace" font-size="9" fill="#52525B">UNIT 24 SMR — REV.1</text>
</svg>$svg$,
  '{"e-sh": "ns=1;s=24-TIC-0701.PV", "e-whb": "ns=1;s=24-FI-0405", "stack": "ns=1;s=24-AI-0952", "e-2401": "ns=1;s=24-TI-0105", "k-2401": "ns=1;s=24-SIC-0801.PV", "r-2401": "ns=1;s=24-AI-0505", "r-2402": "ns=1;s=24-AI-0503", "v-2401": "ns=1;s=24-AI-0101", "a-2401a": "ns=1;s=24-PI-0607", "a-2401b": "ns=1;s=24-PI-0609", "a-2401c": "ns=1;s=24-PI-0611", "e-intcl": "ns=1;s=24-TI-0502", "v-stm-drum": "ns=1;s=24-LIC-0701.PV", "h-2401-conv": "ns=1;s=24-AI-0401", "pipe-fuel-hdr": "ns=1;s=24-FIC-0401.PV", "h-2401-firebox": "ns=1;s=24-TI-0413", "pipe-h2-export": "ns=1;s=24-AI-0601", "pipe-h2-to-comp": "ns=1;s=24-PI-0801", "pipe-lts-to-psa": "ns=1;s=24-TI-0508", "pipe-psa-a-feed": "ns=1;s=24-ZI-0601", "pipe-psa-a-prod": "ns=1;s=24-ZI-0602", "pipe-psa-b-feed": "ns=1;s=24-ZI-0603", "pipe-psa-b-prod": "ns=1;s=24-ZI-0604", "pipe-psa-c-feed": "ns=1;s=24-ZI-0605", "pipe-psa-c-prod": "ns=1;s=24-ZI-0606", "pipe-whb-to-hts": "ns=1;s=24-TI-0501", "pipe-h2-prod-hdr": "ns=1;s=24-PI-0601", "pipe-tailgas-hdr": "ns=1;s=24-FI-0602", "pipe-hts-to-intcl": "ns=1;s=24-AI-0502", "pipe-intcl-to-lts": "ns=1;s=24-TI-0507", "pipe-psa-feed-hdr": "ns=1;s=24-PI-0602", "pipe-reformer-out": "ns=1;s=24-TIC-0401.PV", "pipe-tailgas-collect": "ns=1;s=24-AI-0602", "pipe-desulf-to-preheat": "ns=1;s=24-FIC-0101.PV", "pipe-preheat-to-reformer": "ns=1;s=24-TI-0417"}'::jsonb,
  '{"module": "process"}'::jsonb,
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  svg_data = EXCLUDED.svg_data,
  metadata = EXCLUDED.metadata,
  bindings = EXCLUDED.bindings;

-- H2 Plant Overview — Reformer & Shift
INSERT INTO design_objects (id, name, type, svg_data, bindings, metadata, created_by)
VALUES (
  'b165e49d-13ca-47cc-a86d-36aad91ed2a8',
  'H2 Plant Overview — Reformer & Shift',
  'graphic',
  $svg$<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><rect width="100%" height="100%" fill="#09090B"/>
<path id="pipe-ng-in" d="M 50 400 L 180 400" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">NG Feed</text>
<path id="pipe-desulf-preheat" d="M 230 400 L 300 400" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-preheat-reformer" d="M 400 400 L 500 400" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-reformer-whb" d="M 800 350 L 860 350" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Syngas 1550F</text>
<path id="pipe-whb-hts" d="M 950 400 L 1050 400 L 1050 470" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-hts-lts" d="M 1100 600 L 1150 600 L 1250 600 L 1250 520" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-lts-psa" d="M 1310 650 L 1400 650 L 1480 650" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">To PSA</text>
<path id="pipe-psa-product" d="M 1700 250 L 1920 250" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">H2 Product to K-2401</text>
<path id="pipe-tailgas-fuel" d="M 1400 750 L 1350 750 L 800 750 L 700 720" stroke="#FBBF24" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Tail Gas to Fuel</text>
<path id="pipe-steam-reformer" d="M 450 300 L 500 300 L 600 300" stroke="#E4E4E7" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Process Steam</text>
<path id="pipe-fuelgas-burner" d="M 580 700 L 600 710" stroke="#FBBF24" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-fuelgas-heater" d="M 600 710 L 620 710" stroke="#FBBF24" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-flue-stack" d="M 750 150 L 800 150 L 800 100" stroke="#71717A" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Flue Gas</text>
<text x="960" y="30" font-family="monospace" font-size="14" fill="#E4E4E7">UNIT 24 — H2 PLANT: REFORMER / SHIFT REACTORS / PSA</text>
<text x="180" y="540" font-family="monospace" font-size="14" fill="#E4E4E7">V-2401 Desulfurizer</text>
<text x="650" y="590" font-family="monospace" font-size="14" fill="#E4E4E7">H-2401 Reformer</text>
<text x="900" y="420" font-family="monospace" font-size="14" fill="#E4E4E7">WHB</text>
<text x="1050" y="660" font-family="monospace" font-size="14" fill="#E4E4E7">HTS Reactor</text>
<text x="1250" y="660" font-family="monospace" font-size="14" fill="#E4E4E7">LTS Reactor</text>
<text x="1570" y="650" font-family="monospace" font-size="14" fill="#E4E4E7">PSA Unit (6 Beds)</text>
<text x="680" y="415" font-family="monospace" font-size="14" fill="#E4E4E7">Tube Skin TCs</text>
<text x="650" y="765" font-family="monospace" font-size="14" fill="#E4E4E7">Zone Pyrometers</text>
<g id="vessel-v2401" transform="translate(180.0,400.0) scale(1.6000,2.2400)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="hx-e2401" transform="translate(350.0,400.0) rotate(90.0,32.0,32.0) scale(1.0000,1.0000)"><rect width="64" height="64" fill="#27272A" stroke="#52525B" stroke-width="1"/><text x="32" y="36" font-size="8" fill="#71717A" text-anchor="middle">heat-exchanger-shell-tube</text></g>
<g id="heater-h2401" transform="translate(650.0,350.0) scale(2.6667,2.4000)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M 15,2 L 29,2 L 29,18 L 37,28 L 37,58 L 7,58 L 7,28 L 15,18 Z"
          fill="none" stroke="#808080" stroke-width="1.5"
          stroke-linejoin="miter"/>
    <polyline points="37,55 20,55 33,44 20,31 37,31"
             fill="none" stroke="#808080" stroke-width="1.5"
             stroke-linejoin="miter"/>
    <line x1="25.5" y1="58" x2="25.5" y2="55"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="33.5" y1="58" x2="33.5" y2="55"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="hx-whb" transform="translate(900.0,350.0) rotate(90.0,32.0,32.0) scale(1.0000,1.0000)"><rect width="64" height="64" fill="#27272A" stroke="#52525B" stroke-width="1"/><text x="32" y="36" font-size="8" fill="#71717A" text-anchor="middle">heat-exchanger-shell-tube</text></g>
<g id="vessel-hts" transform="translate(1050.0,500.0) scale(1.6000,2.2400)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="vessel-lts" transform="translate(1250.0,500.0) scale(1.6000,2.2400)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-fv0401" transform="translate(600.0,710.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="valve-xv0401" transform="translate(580.0,710.0) scale(1.0667,1.0667)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,0 24,12 0,24"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,0 24,12 48,24"
             fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g></svg>$svg$,
  '{"hx-whb": "ns=1;s=24-FI-0405", "hx-e2401": "ns=1;s=24-TI-0105", "cv-fv0401": "ns=1;s=24-FV-0401", "pipe-ng-in": "ns=1;s=24-FIC-0101.PV", "vessel-hts": "ns=1;s=24-AI-0505", "vessel-lts": "ns=1;s=24-AI-0503", "heater-h2401": "ns=1;s=24-TIC-0401.PV", "pipe-hts-lts": "ns=1;s=24-AI-0502", "pipe-lts-psa": "ns=1;s=24-TI-0508", "pipe-whb-hts": "ns=1;s=24-TI-0501", "valve-xv0401": "ns=1;s=24-XV-0401", "vessel-v2401": "ns=1;s=24-AI-0101", "pipe-flue-stack": "ns=1;s=24-AI-0952", "pipe-psa-product": "ns=1;s=24-AI-0601", "pipe-reformer-whb": "ns=1;s=24-TIC-0401.PV", "pipe-tailgas-fuel": "ns=1;s=24-FI-0602", "pipe-desulf-preheat": "ns=1;s=24-FIC-0101.PV", "pipe-fuelgas-burner": "ns=1;s=24-PI-0402", "pipe-fuelgas-heater": "ns=1;s=24-FIC-0401.PV", "pipe-steam-reformer": "ns=1;s=24-FIC-0402.PV", "pipe-preheat-reformer": "ns=1;s=24-TI-0417"}'::jsonb,
  NULL,
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  svg_data = EXCLUDED.svg_data,
  metadata = EXCLUDED.metadata,
  bindings = EXCLUDED.bindings;

-- H2 Plant — Steam System / Compression / Utilities
INSERT INTO design_objects (id, name, type, svg_data, bindings, metadata, created_by)
VALUES (
  '5a8987cc-22a8-46f9-a100-fb29c534f181',
  'H2 Plant — Steam System / Compression / Utilities',
  'graphic',
  $svg$<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><rect width="100%" height="100%" fill="#09090B"/>
<path id="pipe-bfw-in" d="M 50 400 L 150 400" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">BFW Feed</text>
<path id="pipe-bfw-drum" d="M 200 380 L 250 380 L 250 300" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-steam-super" d="M 300 200 L 400 200 L 450 200" stroke="#E4E4E7" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Steam</text>
<path id="pipe-export-steam" d="M 500 250 L 700 250" stroke="#E4E4E7" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Export Steam</text>
<path id="pipe-process-steam" d="M 450 270 L 650 270" stroke="#E4E4E7" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Process Steam</text>
<path id="pipe-cond-return" d="M 350 500 L 300 500" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Condensate Return</text>
<path id="pipe-h2-to-k2401" d="M 700 350 L 900 350" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">H2 from PSA</text>
<path id="pipe-k2401-out" d="M 900 350 L 1100 360" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-k2401-delivery" d="M 1100 360 L 1200 360 L 1920 360" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">H2 to HCU 2200 psig</text>
<path id="pipe-cw-supply" d="M 1350 150 L 1920 150" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">CW Supply</text>
<path id="pipe-cw-return" d="M 1350 210 L 1920 210" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">CW Return</text>
<text x="960" y="30" font-family="monospace" font-size="14" fill="#E4E4E7">UNIT 24 — H2 PLANT: STEAM SYSTEM / H2 COMPRESSION / UTILITIES</text>
<text x="300" y="370" font-family="monospace" font-size="14" fill="#E4E4E7">Steam Drum</text>
<text x="300" y="570" font-family="monospace" font-size="14" fill="#E4E4E7">Condensate Drum</text>
<text x="900" y="510" font-family="monospace" font-size="14" fill="#E4E4E7">K-2401 H2 Compressor</text>
<text x="1150" y="360" font-family="monospace" font-size="14" fill="#E4E4E7">Vibration</text>
<text x="1580" y="80" font-family="monospace" font-size="14" fill="#E4E4E7">Utilities</text>
<text x="1400" y="130" font-family="monospace" font-size="14" fill="#E4E4E7">Cooling Water</text>
<text x="1400" y="310" font-family="monospace" font-size="14" fill="#E4E4E7">Plant / Instrument Air</text>
<text x="1400" y="460" font-family="monospace" font-size="14" fill="#E4E4E7">Fuel Gas / Flare</text>
<text x="1650" y="820" font-family="monospace" font-size="14" fill="#E4E4E7">CONTINUOUS EMISSIONS MONITOR</text>
<text x="1550" y="835" font-family="monospace" font-size="14" fill="#E4E4E7">NOx</text>
<text x="1700" y="835" font-family="monospace" font-size="14" fill="#E4E4E7">SO2</text>
<text x="1550" y="885" font-family="monospace" font-size="14" fill="#E4E4E7">CO</text>
<text x="1700" y="885" font-family="monospace" font-size="14" fill="#E4E4E7">Opacity</text>
<g id="hx-bfw-preheat" transform="translate(150.0,400.0) rotate(90.0,32.0,32.0) scale(1.0000,1.0000)"><rect width="64" height="64" fill="#27272A" stroke="#52525B" stroke-width="1"/><text x="32" y="36" font-size="8" fill="#71717A" text-anchor="middle">heat-exchanger-shell-tube</text></g>
<g id="vessel-steam-drum" transform="translate(300.0,300.0) rotate(90.0,40.0,20.0) scale(1.1200,0.8000)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M12,10 A5,10 0 0,0 12,30"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="10" x2="68" y2="10"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="30" x2="68" y2="30"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M68,10 A5,10 0 0,1 68,30"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="vessel-cond-drum" transform="translate(300.0,500.0) scale(1.6000,1.6000)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="compressor-k2401" transform="translate(900.0,350.0) scale(1.7920,1.7920)">
  <g class="io-shape-body">
    <circle class="io-stateful" cx="25" cy="25" r="20"
            fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="12.1" y1="9.7" x2="43.1" y2="16.5"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="12.1" y1="40.3" x2="43.1" y2="33.5"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="valve-xv0801" transform="translate(1100.0,360.0) scale(1.0667,1.0667)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,0 24,12 0,24"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,0 24,12 48,24"
             fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g></svg>$svg$,
  '{"pipe-bfw-in": "ns=1;s=24-FIC-0701.PV", "valve-xv0801": "ns=1;s=24-XV-0801", "pipe-bfw-drum": "ns=1;s=24-FIC-0701.PV", "hx-bfw-preheat": "ns=1;s=24-TI-0702", "pipe-cw-return": "ns=1;s=24-TI-0902", "pipe-cw-supply": "ns=1;s=24-TI-0901", "pipe-k2401-out": "ns=1;s=24-PI-0803", "compressor-k2401": "ns=1;s=24-SIC-0801.PV", "pipe-cond-return": "ns=1;s=24-AI-0701", "pipe-h2-to-k2401": "ns=1;s=24-PI-0801", "pipe-steam-super": "ns=1;s=24-PI-0701", "vessel-cond-drum": "ns=1;s=24-LI-0701", "pipe-export-steam": "ns=1;s=24-FIC-0702.PV", "vessel-steam-drum": "ns=1;s=24-LIC-0701.PV", "pipe-process-steam": "ns=1;s=24-FIC-0402.PV", "pipe-k2401-delivery": "ns=1;s=24-FI-0801"}'::jsonb,
  NULL,
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  svg_data = EXCLUDED.svg_data,
  metadata = EXCLUDED.metadata,
  bindings = EXCLUDED.bindings;

-- HCU Feed Preheat & Charge Heater
INSERT INTO design_objects (id, name, type, svg_data, bindings, metadata, created_by)
VALUES (
  'b665f179-a8ca-459d-9fc0-4200572e8298',
  'HCU Feed Preheat & Charge Heater',
  'graphic',
  $svg$<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><rect width="100%" height="100%" fill="#09090B"/>
<path id="pipe-feed-inlet" d="M 20 480 L 100 480" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-v2501-e2501" d="M 130 480 L 240 480" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-e2501-e2502" d="M 310 480 L 400 480" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-e2502-e2503" d="M 470 480 L 560 480" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-e2503-pump" d="M 630 480 L 630 550 L 740 550" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-pump-mix" d="M 740 620 L 740 480 L 860 480" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-h2-recycle" d="M 900 50 L 900 480 L 860 480" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Recycle H2</text>
<path id="pipe-mix-heater" d="M 860 480 L 950 480 L 950 450" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-fuelgas" d="M 950 700 L 1000 720" stroke="#FBBF24" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Fuel Gas</text>
<path id="pipe-fuelgas-burner" d="M 1000 720 L 1050 720" stroke="#FBBF24" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-heater-out" d="M 1050 450 L 1300 450 L 1920 450" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">To Reactors</text>
<text x="960" y="30" font-family="monospace" font-size="14" fill="#E4E4E7">UNIT 25 — CHARGE HEATER H-2501 / FEED PREHEAT</text>
<text x="430" y="150" font-family="monospace" font-size="14" fill="#E4E4E7">Feed Preheat Train</text>
<text x="1050" y="150" font-family="monospace" font-size="14" fill="#E4E4E7">H-2501 Charge Heater</text>
<text x="990" y="295" font-family="monospace" font-size="14" fill="#E4E4E7">Tube Skin TCs</text>
<text x="100" y="540" font-family="monospace" font-size="14" fill="#E4E4E7">V-2501</text>
<text x="740" y="680" font-family="monospace" font-size="14" fill="#E4E4E7">P-2501</text>
<text x="1050" y="580" font-family="monospace" font-size="14" fill="#E4E4E7">H-2501</text>
<text x="1700" y="960" font-family="monospace" font-size="14" fill="#E4E4E7">V-2510</text>
<g id="vessel-v2501" transform="translate(100.0,480.0) scale(1.6000,1.9200)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="hx-e2501" transform="translate(270.0,480.0) rotate(90.0,32.0,32.0) scale(1.0000,1.0000)"><rect width="64" height="64" fill="#27272A" stroke="#52525B" stroke-width="1"/><text x="32" y="36" font-size="8" fill="#71717A" text-anchor="middle">heat-exchanger-shell-tube</text></g>
<g id="hx-e2502" transform="translate(430.0,480.0) rotate(90.0,32.0,32.0) scale(1.0000,1.0000)"><rect width="64" height="64" fill="#27272A" stroke="#52525B" stroke-width="1"/><text x="32" y="36" font-size="8" fill="#71717A" text-anchor="middle">heat-exchanger-shell-tube</text></g>
<g id="hx-e2503" transform="translate(590.0,480.0) rotate(90.0,32.0,32.0) scale(1.0000,1.0000)"><rect width="64" height="64" fill="#27272A" stroke="#52525B" stroke-width="1"/><text x="32" y="36" font-size="8" fill="#71717A" text-anchor="middle">heat-exchanger-shell-tube</text></g>
<g id="pump-p2501" transform="translate(740.0,620.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <circle class="io-stateful" cx="24" cy="24" r="20"
            fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="4" y1="24" x2="44" y2="24"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="4" x2="44" y2="24"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="44" x2="44" y2="24"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="heater-h2501" transform="translate(1050.0,450.0) scale(2.4000,2.1333)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M 15,2 L 29,2 L 29,18 L 37,28 L 37,58 L 7,58 L 7,28 L 15,18 Z"
          fill="none" stroke="#808080" stroke-width="1.5"
          stroke-linejoin="miter"/>
    <polyline points="37,55 20,55 33,44 20,31 37,31"
             fill="none" stroke="#808080" stroke-width="1.5"
             stroke-linejoin="miter"/>
    <line x1="25.5" y1="58" x2="25.5" y2="55"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="33.5" y1="58" x2="33.5" y2="55"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="vessel-v2510" transform="translate(1700.0,900.0) scale(1.6000,1.6000)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-fic1010" transform="translate(1100.0,560.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-fic1011" transform="translate(1200.0,560.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-fv1012" transform="translate(1000.0,720.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g></svg>$svg$,
  '{"name": "HCU Feed Preheat & Charge Heater", "type": "graphic", "pipes": [{"label": null, "path_data": "M 20 480 L 100 480", "element_id": "pipe-feed-inlet", "service_type": "process", "stroke_width": 2.0}, {"label": null, "path_data": "M 130 480 L 240 480", "element_id": "pipe-v2501-e2501", "service_type": "process", "stroke_width": 2.0}, {"label": null, "path_data": "M 310 480 L 400 480", "element_id": "pipe-e2501-e2502", "service_type": "process", "stroke_width": 2.0}, {"label": null, "path_data": "M 470 480 L 560 480", "element_id": "pipe-e2502-e2503", "service_type": "process", "stroke_width": 2.0}, {"label": null, "path_data": "M 630 480 L 630 550 L 740 550", "element_id": "pipe-e2503-pump", "service_type": "process", "stroke_width": 2.0}, {"label": null, "path_data": "M 740 620 L 740 480 L 860 480", "element_id": "pipe-pump-mix", "service_type": "process", "stroke_width": 2.0}, {"label": "Recycle H2", "path_data": "M 900 50 L 900 480 L 860 480", "element_id": "pipe-h2-recycle", "service_type": "gas_vapor", "stroke_width": 2.0}, {"label": null, "path_data": "M 860 480 L 950 480 L 950 450", "element_id": "pipe-mix-heater", "service_type": "process", "stroke_width": 2.0}, {"label": "Fuel Gas", "path_data": "M 950 700 L 1000 720", "element_id": "pipe-fuelgas", "service_type": "fuel_gas", "stroke_width": 1.5}, {"label": null, "path_data": "M 1000 720 L 1050 720", "element_id": "pipe-fuelgas-burner", "service_type": "fuel_gas", "stroke_width": 1.5}, {"label": "To Reactors", "path_data": "M 1050 450 L 1300 450 L 1920 450", "element_id": "pipe-heater-out", "service_type": "process", "stroke_width": 2.0}], "layers": [{"name": "Background", "locked": true, "visible": true, "elements": ["pipe-feed-inlet", "pipe-v2501-e2501", "pipe-e2501-e2502", "pipe-e2502-e2503", "pipe-e2503-pump", "pipe-pump-mix", "pipe-h2-recycle", "pipe-mix-heater", "pipe-fuelgas", "pipe-fuelgas-burner", "pipe-heater-out", "divider-sections"]}, {"name": "Equipment", "locked": false, "visible": true, "elements": ["vessel-v2501", "hx-e2501", "hx-e2502", "hx-e2503", "pump-p2501", "heater-h2501", "vessel-v2510", "cv-fic1010", "cv-fic1011", "cv-fv1012"]}, {"name": "Instruments", "locked": false, "visible": true, "elements": ["readout-li1001", "gauge-li1001", "readout-pi1001", "alarm-v2501", "readout-fic1001-pv", "readout-fic1001-sp", "readout-fic1001-out", "status-fic1001-mode", "alarm-fic1001", "readout-ft1001", "readout-fi0001", "readout-pi0001", "alarm-pi0001", "readout-ti1001", "readout-ti1002", "readout-ti1003", "readout-ti1004", "readout-ti1005", "readout-ti1006", "readout-pi1002", "readout-pi1003", "readout-ii1001", "readout-pdi1001", "status-p2501-run", "alarm-p2501", "readout-pi1004", "readout-fi1002", "readout-tic1010-pv", "readout-tic1010-sp", "readout-tic1010-out", "status-tic1010-mode", "alarm-tic1010", "readout-tic1011-pv", "readout-tic1011-sp", "readout-tic1011-out", "status-tic1011-mode", "alarm-tic1011", "readout-fic1010-pv", "alarm-fic1010", "readout-fic1011-pv", "alarm-fic1011", "readout-ti1016", "alarm-ti1016", "readout-ti1017", "readout-ti1018", "readout-fic1012-pv", "alarm-fic1012", "readout-pi1010", "alarm-pi1010", "readout-pic1010-pv", "alarm-pic1010", "readout-ai1010", "alarm-ai1010", "readout-ai1011", "alarm-ai1011", "readout-ti1015", "readout-ii1010", "readout-ii1011", "readout-fi1013", "readout-fi1014", "status-tshh1010", "status-tshh1011", "status-psll1010", "alarm-h2501", "readout-ti1020", "readout-ti1021", "readout-ti1022", "readout-ti1023", "readout-ti1024", "readout-ti1025", "readout-ti1026", "readout-ti1027", "readout-ti1028", "readout-ti1029", "readout-ti1030", "readout-ti1031", "readout-ti-max"]}, {"name": "Labels", "locked": false, "visible": true, "elements": ["label-screen-title", "label-preheat-section", "label-heater-section", "label-tube-skin", "label-v2501", "label-p2501", "label-h2501", "label-v2510"]}], "shapes": [{"scale": {"x": 1.0, "y": 1.2}, "mirror": "none", "variant": "opt1", "position": {"x": 100, "y": 480}, "rotation": 0, "shape_id": "vessel-vertical", "element_id": "vessel-v2501", "configuration": "plain", "composable_parts": []}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 270, "y": 480}, "rotation": 90, "shape_id": "heat-exchanger-shell-tube", "element_id": "hx-e2501", "configuration": null, "composable_parts": []}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 430, "y": 480}, "rotation": 90, "shape_id": "heat-exchanger-shell-tube", "element_id": "hx-e2502", "configuration": null, "composable_parts": []}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 590, "y": 480}, "rotation": 90, "shape_id": "heat-exchanger-shell-tube", "element_id": "hx-e2503", "configuration": null, "composable_parts": []}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 740, "y": 620}, "rotation": 0, "shape_id": "pump-centrifugal", "element_id": "pump-p2501", "configuration": null, "composable_parts": []}, {"scale": {"x": 1.8, "y": 1.6}, "mirror": "none", "variant": "opt1", "position": {"x": 1050, "y": 450}, "rotation": 0, "shape_id": "heater-fired", "element_id": "heater-h2501", "configuration": null, "composable_parts": []}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 1700, "y": 900}, "rotation": 0, "shape_id": "vessel-vertical", "element_id": "vessel-v2510", "configuration": "plain", "composable_parts": []}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 1100, "y": 560}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-fic1010", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attachment": "stem"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 1200, "y": 560}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-fic1011", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attachment": "stem"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 1000, "y": 720}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-fv1012", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attachment": "stem"}]}], "bindings": {"alarm-h2501": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-TIC-1010.PV", "25-TIC-1011.PV", "25-AI-1010.PV", "25-TI-1016.PV", "25-FIC-1012.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-p2501": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PI-1003.PV", "25-II-1001.PV", "25-PDI-1001.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-v2501": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-LI-1001.PV", "25-PI-1001.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ai1010": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-AI-1010.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ai1011": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-AI-1011.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pi0001": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PI-0001.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pi1010": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PI-1010.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ti1016": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-TI-1016.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "gauge-li1001": {"mapping": {"type": "fill_gauge", "range_hi": 100, "range_lo": 0, "placement": "vessel_overlay", "fill_direction": "up", "clip_to_shape_id": "vessel-v2501"}, "attribute": "fill", "point_tag": "25-LI-1001.PV", "source_hint": "SimBLAH-OPC"}, "alarm-fic1001": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-FIC-1001.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-fic1010": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-FIC-1010.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-fic1011": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-FIC-1011.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-fic1012": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-FIC-1012.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pic1010": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PIC-1010.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-tic1010": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-TIC-1010.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-tic1011": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-TIC-1011.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "readout-ai1010": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-AI-1010.PV", "source_hint": "SimBLAH-OPC"}, "readout-ai1011": {"mapping": {"type": "text", "format": "%.1f", "suffix": " ppm"}, "attribute": "text", "point_tag": "25-AI-1011.PV", "source_hint": "SimBLAH-OPC"}, "readout-fi0001": {"mapping": {"type": "text", "format": "%.2f", "suffix": " kBPD"}, "attribute": "text", "point_tag": "25-FI-0001.PV", "source_hint": "SimBLAH-OPC"}, "readout-fi1002": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FI-1002.PV", "source_hint": "SimBLAH-OPC"}, "readout-fi1013": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FI-1013.PV", "source_hint": "SimBLAH-OPC"}, "readout-fi1014": {"mapping": {"type": "text", "format": "%.1f", "suffix": " klb/hr"}, "attribute": "text", "point_tag": "25-FI-1014.PV", "source_hint": "SimBLAH-OPC"}, "readout-ft1001": {"mapping": {"type": "text", "format": "%.1f", "suffix": " kBPD"}, "attribute": "text", "point_tag": "25-FT-1001.PV", "source_hint": "SimBLAH-OPC"}, "readout-ii1001": {"mapping": {"type": "text", "format": "%.0f", "suffix": " A"}, "attribute": "text", "point_tag": "25-II-1001.PV", "source_hint": "SimBLAH-OPC"}, "readout-ii1010": {"mapping": {"type": "text", "format": "%.0f", "suffix": " A"}, "attribute": "text", "point_tag": "25-II-1010.PV", "source_hint": "SimBLAH-OPC"}, "readout-ii1011": {"mapping": {"type": "text", "format": "%.0f", "suffix": " A"}, "attribute": "text", "point_tag": "25-II-1011.PV", "source_hint": "SimBLAH-OPC"}, "readout-li1001": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LI-1001.PV", "source_hint": "SimBLAH-OPC"}, "readout-pi0001": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-0001.PV", "source_hint": "SimBLAH-OPC"}, "readout-pi1001": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-1001.PV", "source_hint": "SimBLAH-OPC"}, "readout-pi1002": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-1002.PV", "source_hint": "SimBLAH-OPC"}, "readout-pi1003": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-1003.PV", "source_hint": "SimBLAH-OPC"}, "readout-pi1004": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-1004.PV", "source_hint": "SimBLAH-OPC"}, "readout-pi1010": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-1010.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti-max": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "source_hint": "SimBLAH-OPC", "expression_key": "max-tube-skin"}, "readout-ti1001": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1001.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1002": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1002.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1003": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1003.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1004": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1004.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1005": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1005.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1006": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1006.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1015": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1015.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1016": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1016.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1017": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1017.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1018": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1018.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1020": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1020.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1021": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1021.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1022": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1022.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1023": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1023.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1024": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1024.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1025": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1025.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1026": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1026.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1027": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1027.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1028": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1028.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1029": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1029.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1030": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1030.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1031": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1031.PV", "source_hint": "SimBLAH-OPC"}, "readout-pdi1001": {"mapping": {"type": "text", "format": "%.2f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PDI-1001.PV", "source_hint": "SimBLAH-OPC"}, "status-psll1010": {"mapping": {"type": "state_class", "states": {"0": "NORMAL", "1": "TRIP"}}, "attribute": "class", "point_tag": "25-PSLL-1010.PV", "source_hint": "SimBLAH-OPC"}, "status-tshh1010": {"mapping": {"type": "state_class", "states": {"0": "NORMAL", "1": "TRIP"}}, "attribute": "class", "point_tag": "25-TSHH-1010.PV", "source_hint": "SimBLAH-OPC"}, "status-tshh1011": {"mapping": {"type": "state_class", "states": {"0": "NORMAL", "1": "TRIP"}}, "attribute": "class", "point_tag": "25-TSHH-1011.PV", "source_hint": "SimBLAH-OPC"}, "status-p2501-run": {"mapping": {"type": "state_class", "states": {"0": "STOPPED", "1": "RUNNING"}}, "attribute": "class", "point_tag": "25-P-2501A.RUN", "source_hint": "SimBLAH-OPC"}, "readout-fic1001-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " kBPD"}, "attribute": "text", "point_tag": "25-FIC-1001.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic1001-sp": {"mapping": {"type": "text", "format": "%.1f", "suffix": " kBPD"}, "attribute": "text", "point_tag": "25-FIC-1001.SP", "source_hint": "SimBLAH-OPC"}, "readout-fic1010-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " kBPD"}, "attribute": "text", "point_tag": "25-FIC-1010.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic1011-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " kBPD"}, "attribute": "text", "point_tag": "25-FIC-1011.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic1012-pv": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FIC-1012.PV", "source_hint": "SimBLAH-OPC"}, "readout-pic1010-pv": {"mapping": {"type": "text", "format": "%.2f", "suffix": " inH2O"}, "attribute": "text", "point_tag": "25-PIC-1010.PV", "source_hint": "SimBLAH-OPC"}, "readout-tic1010-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TIC-1010.PV", "source_hint": "SimBLAH-OPC"}, "readout-tic1010-sp": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TIC-1010.SP", "source_hint": "SimBLAH-OPC"}, "readout-tic1011-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TIC-1011.PV", "source_hint": "SimBLAH-OPC"}, "readout-tic1011-sp": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TIC-1011.SP", "source_hint": "SimBLAH-OPC"}, "readout-fic1001-out": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-FIC-1001.OUT", "source_hint": "SimBLAH-OPC"}, "readout-tic1010-out": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-TIC-1010.OUT", "source_hint": "SimBLAH-OPC"}, "readout-tic1011-out": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-TIC-1011.OUT", "source_hint": "SimBLAH-OPC"}, "status-fic1001-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-FIC-1001.MODE", "source_hint": "SimBLAH-OPC"}, "status-tic1010-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-TIC-1010.MODE", "source_hint": "SimBLAH-OPC"}, "status-tic1011-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-TIC-1011.MODE", "source_hint": "SimBLAH-OPC"}}, "metadata": {"tags": ["hcu", "unit25", "heater", "preheat", "charge", "feed"], "width": 1920, "height": 1080, "viewBox": "0 0 1920 1080", "description": "VGO feed preheat train (E-2501/2/3), charge pump P-2501, and fired charge heater H-2501 with tube skin TCs and combustion controls.", "background_color": "#09090B"}, "annotations": [{"fill": "#E5E5E5", "font": "18px bold", "type": "text", "content": "UNIT 25 — CHARGE HEATER H-2501 / FEED PREHEAT", "position": {"x": 960, "y": 30}, "element_id": "label-screen-title"}, {"fill": "#A1A1AA", "font": "14px 600", "type": "text", "content": "Feed Preheat Train", "position": {"x": 430, "y": 150}, "element_id": "label-preheat-section"}, {"fill": "#A1A1AA", "font": "14px 600", "type": "text", "content": "H-2501 Charge Heater", "position": {"x": 1050, "y": 150}, "element_id": "label-heater-section"}, {"fill": "#71717A", "font": "10px normal", "type": "text", "content": "Tube Skin TCs", "position": {"x": 990, "y": 295}, "element_id": "label-tube-skin"}, {"fill": "#A1A1AA", "font": "10px normal", "type": "text", "content": "V-2501", "position": {"x": 100, "y": 540}, "element_id": "label-v2501"}, {"fill": "#A1A1AA", "font": "10px normal", "type": "text", "content": "P-2501", "position": {"x": 740, "y": 680}, "element_id": "label-p2501"}, {"fill": "#A1A1AA", "font": "10px normal", "type": "text", "content": "H-2501", "position": {"x": 1050, "y": 580}, "element_id": "label-h2501"}, {"fill": "#A1A1AA", "font": "10px normal", "type": "text", "content": "V-2510", "position": {"x": 1700, "y": 960}, "element_id": "label-v2510"}, {"type": "line", "stroke": "#3F3F46", "content": null, "position": {"x": 0, "y": 60}, "element_id": "divider-sections", "end_position": {"x": 1920, "y": 60}, "stroke_width": 1}], "expressions": {"max-tube-skin": {"inputs": ["25-TI-1020.PV", "25-TI-1021.PV", "25-TI-1022.PV", "25-TI-1023.PV", "25-TI-1024.PV", "25-TI-1025.PV", "25-TI-1026.PV", "25-TI-1027.PV", "25-TI-1028.PV", "25-TI-1029.PV", "25-TI-1030.PV", "25-TI-1031.PV"], "function": "MAX"}}}'::jsonb,
  NULL,
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  svg_data = EXCLUDED.svg_data,
  metadata = EXCLUDED.metadata,
  bindings = EXCLUDED.bindings;

-- HCU Fractionator
INSERT INTO design_objects (id, name, type, svg_data, bindings, metadata, created_by)
VALUES (
  '4abe4d89-2c19-4866-8391-156e79d0a0ae',
  'HCU Fractionator',
  'graphic',
  $svg$<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><rect width="100%" height="100%" fill="#09090B"/>
<path id="pipe-feed-c2502" d="M 100 780 L 400 780 L 700 780" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Feed from HP Sep</text>
<path id="pipe-c2501-c2502" d="M 200 700 L 350 700 L 700 700" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-c2502-overhead" d="M 700 80 L 900 80" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-condenser-accum" d="M 1100 80 L 1150 80" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-reflux" d="M 1150 200 L 930 200" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-reflux-col" d="M 870 200 L 750 200" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-uco-out" d="M 770 880 L 850 880 L 1920 880" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">UCO Rundown</text>
<path id="pipe-diesel-draw" d="M 700 420 L 800 420" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Diesel</text>
<path id="pipe-diesel-strip" d="M 850 420 L 1050 420" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-kero-draw" d="M 700 520 L 800 520" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Kerosene</text>
<path id="pipe-kero-strip" d="M 850 520 L 1250 520" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-reboiler-in" d="M 700 870 L 600 870" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-reboiler-out" d="M 550 820 L 700 820" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-reboiler-steam" d="M 400 900 L 550 900" stroke="#E4E4E7" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Reboiler Steam</text>
<text x="960" y="30" font-family="monospace" font-size="14" fill="#E4E4E7">UNIT 25 — FRACTIONATOR C-2502 / PRODUCT STRIPPER C-2501</text>
<text x="700" y="970" font-family="monospace" font-size="14" fill="#E4E4E7">C-2502 Fractionator</text>
<text x="200" y="720" font-family="monospace" font-size="14" fill="#E4E4E7">C-2501 Stripper</text>
<text x="1200" y="170" font-family="monospace" font-size="14" fill="#E4E4E7">Overhead Accumulator</text>
<text x="1650" y="370" font-family="monospace" font-size="14" fill="#E4E4E7">Product Analyzers</text>
<text x="1100" y="660" font-family="monospace" font-size="14" fill="#E4E4E7">Diesel Stripper</text>
<text x="1300" y="700" font-family="monospace" font-size="14" fill="#E4E4E7">Kero Stripper</text>
<g id="column-c2501" transform="translate(200.0,500.0) scale(1.1636,2.3273)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,10 A12,5 0 0,1 34,10"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="10" x2="10" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="34" y1="10" x2="34" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,110 A12,5 0 0,0 34,110"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="column-c2502" transform="translate(700.0,300.0) scale(1.4545,2.9091)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,10 A12,5 0 0,1 34,10"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="10" x2="10" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="34" y1="10" x2="34" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,110 A12,5 0 0,0 34,110"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="vessel-accum" transform="translate(1200.0,100.0) rotate(90.0,40.0,20.0) scale(0.9600,0.8000)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M12,10 A5,10 0 0,0 12,30"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="10" x2="68" y2="10"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="30" x2="68" y2="30"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M68,10 A5,10 0 0,1 68,30"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="pump-p2507" transform="translate(1200.0,200.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <circle class="io-stateful" cx="24" cy="24" r="20"
            fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="4" y1="24" x2="44" y2="24"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="4" x2="44" y2="24"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="44" x2="44" y2="24"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="hx-reboiler" transform="translate(550.0,900.0) rotate(90.0,32.0,32.0) scale(1.0000,1.0000)"><rect width="64" height="64" fill="#27272A" stroke="#52525B" stroke-width="1"/><text x="32" y="36" font-size="8" fill="#71717A" text-anchor="middle">heat-exchanger-shell-tube</text></g>
<g id="air-cooler-cond" transform="translate(1000.0,80.0) scale(1.1789,0.8421)">
  <g class="io-shape-body">
    <line x1="5" y1="5" x2="55" y2="5" stroke="#808080" stroke-width="0.75"/>
    <line x1="5" y1="5" x2="5" y2="27" stroke="#808080" stroke-width="0.75"/>
    <line x1="55" y1="5" x2="55" y2="27" stroke="#808080" stroke-width="0.75"/>
    <polyline points="-4,11 5,11 9,14 14,8 19,14 24,8 29,14 34,8 39,14 44,8 49,14 52,11 55,11 63,11"
              fill="none" stroke="#808080" stroke-width="0.75"/>
    <polyline points="59,8 63,11 59,14"
              fill="none" stroke="#808080" stroke-width="0.75"/>
    <path class="io-stateful"
          d="M30,22 C30,21 8,18 8,22 C8,26 30,23 30,22 Z"
          fill="none" stroke="#808080" stroke-width="0.75"/>
    <path class="io-stateful"
          d="M30,22 C30,21 52,18 52,22 C52,26 30,23 30,22 Z"
          fill="none" stroke="#808080" stroke-width="0.75"/>
    <line x1="30" y1="22" x2="30" y2="30" stroke="#808080" stroke-width="0.75"/>
  </g>
</g>
<g id="column-diesel-strip" transform="translate(1100.0,500.0) scale(1.0182,1.7455)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,10 A12,5 0 0,1 34,10"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="10" x2="10" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="34" y1="10" x2="34" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,110 A12,5 0 0,0 34,110"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="column-kero-strip" transform="translate(1300.0,550.0) scale(1.0182,1.7455)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,10 A12,5 0 0,1 34,10"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="10" x2="10" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="34" y1="10" x2="34" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,110 A12,5 0 0,0 34,110"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-lv2211" transform="translate(770.0,880.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-fv2222" transform="translate(900.0,220.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-fv2230" transform="translate(820.0,520.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-fv2231" transform="translate(820.0,420.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g></svg>$svg$,
  '{"name": "HCU Fractionator", "type": "graphic", "pipes": [{"label": "Feed from HP Sep", "path_data": "M 100 780 L 400 780 L 700 780", "element_id": "pipe-feed-c2502", "service_type": "process", "stroke_width": 2.0}, {"label": null, "path_data": "M 200 700 L 350 700 L 700 700", "element_id": "pipe-c2501-c2502", "service_type": "process", "stroke_width": 2.0}, {"label": null, "path_data": "M 700 80 L 900 80", "element_id": "pipe-c2502-overhead", "service_type": "gas_vapor", "stroke_width": 2.0}, {"label": null, "path_data": "M 1100 80 L 1150 80", "element_id": "pipe-condenser-accum", "service_type": "process", "stroke_width": 2.0}, {"label": null, "path_data": "M 1150 200 L 930 200", "element_id": "pipe-reflux", "service_type": "process", "stroke_width": 1.5}, {"label": null, "path_data": "M 870 200 L 750 200", "element_id": "pipe-reflux-col", "service_type": "process", "stroke_width": 1.5}, {"label": "UCO Rundown", "path_data": "M 770 880 L 850 880 L 1920 880", "element_id": "pipe-uco-out", "service_type": "process", "stroke_width": 2.0}, {"label": "Diesel", "path_data": "M 700 420 L 800 420", "element_id": "pipe-diesel-draw", "service_type": "process", "stroke_width": 2.0}, {"label": null, "path_data": "M 850 420 L 1050 420", "element_id": "pipe-diesel-strip", "service_type": "process", "stroke_width": 2.0}, {"label": "Kerosene", "path_data": "M 700 520 L 800 520", "element_id": "pipe-kero-draw", "service_type": "process", "stroke_width": 2.0}, {"label": null, "path_data": "M 850 520 L 1250 520", "element_id": "pipe-kero-strip", "service_type": "process", "stroke_width": 2.0}, {"label": null, "path_data": "M 700 870 L 600 870", "element_id": "pipe-reboiler-in", "service_type": "process", "stroke_width": 2.0}, {"label": null, "path_data": "M 550 820 L 700 820", "element_id": "pipe-reboiler-out", "service_type": "process", "stroke_width": 2.0}, {"label": "Reboiler Steam", "path_data": "M 400 900 L 550 900", "element_id": "pipe-reboiler-steam", "service_type": "steam", "stroke_width": 1.5}], "layers": [{"name": "Background", "locked": true, "visible": true, "elements": ["pipe-feed-c2502", "pipe-c2501-c2502", "pipe-c2502-overhead", "pipe-condenser-accum", "pipe-reflux", "pipe-reflux-col", "pipe-uco-out", "pipe-diesel-draw", "pipe-diesel-strip", "pipe-kero-draw", "pipe-kero-strip", "pipe-reboiler-in", "pipe-reboiler-out", "pipe-reboiler-steam", "divider-title", "divider-analyzers"]}, {"name": "Equipment", "locked": false, "visible": true, "elements": ["column-c2501", "column-c2502", "vessel-accum", "pump-p2507", "hx-reboiler", "air-cooler-cond", "column-diesel-strip", "column-kero-strip", "cv-lv2211", "cv-fv2222", "cv-fv2230", "cv-fv2231"]}, {"name": "Instruments", "locked": false, "visible": true, "elements": ["readout-ti2101", "readout-pi2101", "alarm-pi2101", "readout-lic2101-pv", "gauge-lic2101", "alarm-lic2101", "readout-ti2201", "readout-ti2202", "readout-ti2203", "readout-ti2204", "readout-ti2205", "readout-ti2206", "readout-ti2207", "readout-ti2208", "readout-pic2201-pv", "readout-pic2201-sp", "status-pic2201-mode", "alarm-pic2201", "readout-pdi2201", "alarm-pdi2201", "readout-pdi2202", "alarm-pdi2202", "readout-pdi2203", "alarm-pdi2203", "readout-ti2209", "readout-fi2201", "readout-lic2211-pv", "gauge-lic2211", "alarm-lic2211", "status-lv2211", "readout-fi2212", "readout-pi2210", "alarm-pi2210", "readout-ii2210", "alarm-ii2210", "readout-lic2220-pv", "gauge-lic2220", "alarm-lic2220", "readout-lic2221-pv", "alarm-lic2221", "readout-fic2222-pv", "readout-fic2222-sp", "status-fic2222-mode", "alarm-fic2222", "status-fv2222", "readout-fi2223", "readout-fi2215", "readout-pi2211", "alarm-pi2211", "readout-ii2211", "alarm-ii2211", "readout-ti2225", "readout-fi2226", "readout-ii2201", "alarm-ii2201", "readout-ii2202", "alarm-ii2202", "readout-fic2231-pv", "readout-fic2231-sp", "status-fic2231-mode", "alarm-fic2231", "status-fv2231", "readout-fic2230-pv", "readout-fic2230-sp", "status-fic2230-mode", "alarm-fic2230", "status-fv2230", "readout-fic2240-pv", "readout-ti2240", "readout-ti2241", "readout-fic2242-pv", "readout-ti2242", "readout-ti2243", "readout-tic2260-pv", "readout-tic2260-sp", "status-tic2260-mode", "alarm-tic2260", "readout-fic2261-pv", "alarm-fic2261", "readout-ti2262", "readout-li2263", "readout-fi2264", "readout-fic2250-pv", "alarm-fic2250", "readout-ti2250", "readout-fic2251-pv", "alarm-fic2251", "readout-ti2251", "readout-ai2230", "alarm-ai2230", "readout-ai2231", "alarm-ai2231", "readout-ai2232", "alarm-ai2232", "readout-ai2233", "alarm-ai2233", "readout-ai2234", "alarm-ai2234", "readout-ai2235", "alarm-ai2235"]}, {"name": "Labels", "locked": false, "visible": true, "elements": ["label-screen-title", "label-c2502", "label-c2501", "label-accum", "label-analyzers", "label-diesel-strip", "label-kero-strip"]}], "shapes": [{"scale": {"x": 0.8, "y": 1.6}, "mirror": "none", "variant": "opt1", "position": {"x": 200, "y": 500}, "rotation": 0, "shape_id": "column-distillation", "element_id": "column-c2501", "configuration": "trayed-6", "composable_parts": []}, {"scale": {"x": 1.0, "y": 2.0}, "mirror": "none", "variant": "opt1", "position": {"x": 700, "y": 300}, "rotation": 0, "shape_id": "column-distillation", "element_id": "column-c2502", "configuration": "trayed-10", "composable_parts": []}, {"scale": {"x": 1.2, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 1200, "y": 100}, "rotation": 90, "shape_id": "vessel-horizontal", "element_id": "vessel-accum", "configuration": "plain", "composable_parts": [{"part_id": "part-support-saddle", "attachment": "bottom"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 1200, "y": 200}, "rotation": 0, "shape_id": "pump-centrifugal", "element_id": "pump-p2507", "configuration": null, "composable_parts": []}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 550, "y": 900}, "rotation": 90, "shape_id": "heat-exchanger-shell-tube", "element_id": "hx-reboiler", "configuration": null, "composable_parts": []}, {"scale": {"x": 1.4, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 1000, "y": 80}, "rotation": 0, "shape_id": "air-cooler", "element_id": "air-cooler-cond", "configuration": null, "composable_parts": []}, {"scale": {"x": 0.7, "y": 1.2}, "mirror": "none", "variant": "opt1", "position": {"x": 1100, "y": 500}, "rotation": 0, "shape_id": "column-distillation", "element_id": "column-diesel-strip", "configuration": "trayed-6", "composable_parts": []}, {"scale": {"x": 0.7, "y": 1.2}, "mirror": "none", "variant": "opt1", "position": {"x": 1300, "y": 550}, "rotation": 0, "shape_id": "column-distillation", "element_id": "column-kero-strip", "configuration": "trayed-6", "composable_parts": []}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 770, "y": 880}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-lv2211", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attachment": "stem"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 900, "y": 220}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-fv2222", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attachment": "stem"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 820, "y": 520}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-fv2230", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attachment": "stem"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 820, "y": 420}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-fv2231", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attachment": "stem"}]}], "bindings": {"alarm-ai2230": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-AI-2230.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ai2231": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-AI-2231.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ai2232": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-AI-2232.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ai2233": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-AI-2233.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ai2234": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-AI-2234.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ai2235": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-AI-2235.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ii2201": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-II-2201.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ii2202": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-II-2202.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ii2210": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-II-2210.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ii2211": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-II-2211.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pi2101": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PI-2101.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pi2210": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PI-2210.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pi2211": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PI-2211.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-fic2222": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-FIC-2222.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-fic2230": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-FIC-2230.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-fic2231": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-FIC-2231.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-fic2250": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-FIC-2250.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-fic2251": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-FIC-2251.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-fic2261": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-FIC-2261.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-lic2101": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-LIC-2101.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-lic2211": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-LIC-2211.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-lic2220": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-LIC-2220.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-lic2221": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-LIC-2221.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pdi2201": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PDI-2201.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pdi2202": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PDI-2202.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pdi2203": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PDI-2203.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pic2201": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PIC-2201.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-tic2260": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-TIC-2260.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "gauge-lic2101": {"mapping": {"type": "fill_gauge", "range_hi": 100, "range_lo": 0, "placement": "vessel_overlay", "fill_direction": "up", "clip_to_shape_id": "column-c2501"}, "attribute": "fill", "point_tag": "25-LIC-2101.PV", "source_hint": "SimBLAH-OPC"}, "gauge-lic2211": {"mapping": {"type": "fill_gauge", "range_hi": 100, "range_lo": 0, "placement": "vessel_overlay", "fill_direction": "up", "clip_to_shape_id": "column-c2502"}, "attribute": "fill", "point_tag": "25-LIC-2211.PV", "source_hint": "SimBLAH-OPC"}, "gauge-lic2220": {"mapping": {"type": "fill_gauge", "range_hi": 100, "range_lo": 0, "placement": "vessel_overlay", "fill_direction": "up", "clip_to_shape_id": "vessel-accum"}, "attribute": "fill", "point_tag": "25-LIC-2220.PV", "source_hint": "SimBLAH-OPC"}, "status-fv2222": {"mapping": {"type": "state_class", "states": {"0": "CLOSED", "1": "OPEN"}}, "attribute": "class", "point_tag": "25-FV-2222.POS", "source_hint": "SimBLAH-OPC"}, "status-fv2230": {"mapping": {"type": "state_class", "states": {"0": "CLOSED", "1": "OPEN"}}, "attribute": "class", "point_tag": "25-FV-2230.POS", "source_hint": "SimBLAH-OPC"}, "status-fv2231": {"mapping": {"type": "state_class", "states": {"0": "CLOSED", "1": "OPEN"}}, "attribute": "class", "point_tag": "25-FV-2231.POS", "source_hint": "SimBLAH-OPC"}, "status-lv2211": {"mapping": {"type": "state_class", "states": {"0": "CLOSED", "1": "OPEN"}}, "attribute": "class", "point_tag": "25-LV-2211.POS", "source_hint": "SimBLAH-OPC"}, "readout-ai2230": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-AI-2230.PV", "source_hint": "SimBLAH-OPC"}, "readout-ai2231": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-AI-2231.PV", "source_hint": "SimBLAH-OPC"}, "readout-ai2232": {"mapping": {"type": "text", "format": "%.2f", "suffix": " ppm"}, "attribute": "text", "point_tag": "25-AI-2232.PV", "source_hint": "SimBLAH-OPC"}, "readout-ai2233": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-AI-2233.PV", "source_hint": "SimBLAH-OPC"}, "readout-ai2234": {"mapping": {"type": "text", "format": "%.1f", "suffix": ""}, "attribute": "text", "point_tag": "25-AI-2234.PV", "source_hint": "SimBLAH-OPC"}, "readout-ai2235": {"mapping": {"type": "text", "format": "%.1f", "suffix": " mm"}, "attribute": "text", "point_tag": "25-AI-2235.PV", "source_hint": "SimBLAH-OPC"}, "readout-fi2201": {"mapping": {"type": "text", "format": "%.1f", "suffix": " kBPD"}, "attribute": "text", "point_tag": "25-FI-2201.PV", "source_hint": "SimBLAH-OPC"}, "readout-fi2212": {"mapping": {"type": "text", "format": "%.1f", "suffix": " kBPD"}, "attribute": "text", "point_tag": "25-FI-2212.PV", "source_hint": "SimBLAH-OPC"}, "readout-fi2215": {"mapping": {"type": "text", "format": "%.1f", "suffix": " kBPD"}, "attribute": "text", "point_tag": "25-FI-2215.PV", "source_hint": "SimBLAH-OPC"}, "readout-fi2223": {"mapping": {"type": "text", "format": "%.1f", "suffix": " kBPD"}, "attribute": "text", "point_tag": "25-FI-2223.PV", "source_hint": "SimBLAH-OPC"}, "readout-fi2226": {"mapping": {"type": "text", "format": "%.1f", "suffix": " gpm"}, "attribute": "text", "point_tag": "25-FI-2226.PV", "source_hint": "SimBLAH-OPC"}, "readout-fi2264": {"mapping": {"type": "text", "format": "%.1f", "suffix": " klb/hr"}, "attribute": "text", "point_tag": "25-FI-2264.PV", "source_hint": "SimBLAH-OPC"}, "readout-ii2201": {"mapping": {"type": "text", "format": "%.0f", "suffix": " A"}, "attribute": "text", "point_tag": "25-II-2201.PV", "source_hint": "SimBLAH-OPC"}, "readout-ii2202": {"mapping": {"type": "text", "format": "%.0f", "suffix": " A"}, "attribute": "text", "point_tag": "25-II-2202.PV", "source_hint": "SimBLAH-OPC"}, "readout-ii2210": {"mapping": {"type": "text", "format": "%.0f", "suffix": " A"}, "attribute": "text", "point_tag": "25-II-2210.PV", "source_hint": "SimBLAH-OPC"}, "readout-ii2211": {"mapping": {"type": "text", "format": "%.0f", "suffix": " A"}, "attribute": "text", "point_tag": "25-II-2211.PV", "source_hint": "SimBLAH-OPC"}, "readout-li2263": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LI-2263.PV", "source_hint": "SimBLAH-OPC"}, "readout-pi2101": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-2101.PV", "source_hint": "SimBLAH-OPC"}, "readout-pi2210": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-2210.PV", "source_hint": "SimBLAH-OPC"}, "readout-pi2211": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-2211.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2101": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2101.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2201": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2201.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2202": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2202.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2203": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2203.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2204": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2204.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2205": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2205.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2206": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2206.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2207": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2207.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2208": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2208.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2209": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2209.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2225": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2225.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2240": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2240.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2241": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2241.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2242": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2242.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2243": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2243.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2250": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2250.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2251": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2251.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2262": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2262.PV", "source_hint": "SimBLAH-OPC"}, "readout-pdi2201": {"mapping": {"type": "text", "format": "%.2f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PDI-2201.PV", "source_hint": "SimBLAH-OPC"}, "readout-pdi2202": {"mapping": {"type": "text", "format": "%.2f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PDI-2202.PV", "source_hint": "SimBLAH-OPC"}, "readout-pdi2203": {"mapping": {"type": "text", "format": "%.2f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PDI-2203.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic2222-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " kBPD"}, "attribute": "text", "point_tag": "25-FIC-2222.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic2222-sp": {"mapping": {"type": "text", "format": "%.1f", "suffix": " kBPD"}, "attribute": "text", "point_tag": "25-FIC-2222.SP", "source_hint": "SimBLAH-OPC"}, "readout-fic2230-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " kBPD"}, "attribute": "text", "point_tag": "25-FIC-2230.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic2230-sp": {"mapping": {"type": "text", "format": "%.1f", "suffix": " kBPD"}, "attribute": "text", "point_tag": "25-FIC-2230.SP", "source_hint": "SimBLAH-OPC"}, "readout-fic2231-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " kBPD"}, "attribute": "text", "point_tag": "25-FIC-2231.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic2231-sp": {"mapping": {"type": "text", "format": "%.1f", "suffix": " kBPD"}, "attribute": "text", "point_tag": "25-FIC-2231.SP", "source_hint": "SimBLAH-OPC"}, "readout-fic2240-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " kBPD"}, "attribute": "text", "point_tag": "25-FIC-2240.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic2242-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " kBPD"}, "attribute": "text", "point_tag": "25-FIC-2242.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic2250-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " klb/hr"}, "attribute": "text", "point_tag": "25-FIC-2250.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic2251-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " klb/hr"}, "attribute": "text", "point_tag": "25-FIC-2251.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic2261-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " klb/hr"}, "attribute": "text", "point_tag": "25-FIC-2261.PV", "source_hint": "SimBLAH-OPC"}, "readout-lic2101-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-2101.PV", "source_hint": "SimBLAH-OPC"}, "readout-lic2211-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-2211.PV", "source_hint": "SimBLAH-OPC"}, "readout-lic2220-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-2220.PV", "source_hint": "SimBLAH-OPC"}, "readout-lic2221-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-2221.PV", "source_hint": "SimBLAH-OPC"}, "readout-pic2201-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PIC-2201.PV", "source_hint": "SimBLAH-OPC"}, "readout-pic2201-sp": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PIC-2201.SP", "source_hint": "SimBLAH-OPC"}, "readout-tic2260-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TIC-2260.PV", "source_hint": "SimBLAH-OPC"}, "readout-tic2260-sp": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TIC-2260.SP", "source_hint": "SimBLAH-OPC"}, "status-fic2222-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO"}}, "attribute": "class", "point_tag": "25-FIC-2222.MODE", "source_hint": "SimBLAH-OPC"}, "status-fic2230-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO"}}, "attribute": "class", "point_tag": "25-FIC-2230.MODE", "source_hint": "SimBLAH-OPC"}, "status-fic2231-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO"}}, "attribute": "class", "point_tag": "25-FIC-2231.MODE", "source_hint": "SimBLAH-OPC"}, "status-pic2201-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO"}}, "attribute": "class", "point_tag": "25-PIC-2201.MODE", "source_hint": "SimBLAH-OPC"}, "status-tic2260-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO"}}, "attribute": "class", "point_tag": "25-TIC-2260.MODE", "source_hint": "SimBLAH-OPC"}}, "metadata": {"tags": ["hcu", "unit25", "fractionator", "c2502", "c2501", "products", "diesel", "kerosene", "naphtha", "uco"], "width": 1920, "height": 1080, "viewBox": "0 0 1920 1080", "description": "Fractionator C-2502, product stripper C-2501, diesel/kerosene side strippers, overhead accumulator, reboiler, and product rundowns.", "background_color": "#09090B"}, "annotations": [{"fill": "#E5E5E5", "font": "18px bold", "type": "text", "content": "UNIT 25 — FRACTIONATOR C-2502 / PRODUCT STRIPPER C-2501", "position": {"x": 960, "y": 30}, "element_id": "label-screen-title"}, {"fill": "#A1A1AA", "font": "12px 600", "type": "text", "content": "C-2502 Fractionator", "position": {"x": 700, "y": 970}, "element_id": "label-c2502"}, {"fill": "#A1A1AA", "font": "10px normal", "type": "text", "content": "C-2501 Stripper", "position": {"x": 200, "y": 720}, "element_id": "label-c2501"}, {"fill": "#71717A", "font": "10px normal", "type": "text", "content": "Overhead Accumulator", "position": {"x": 1200, "y": 170}, "element_id": "label-accum"}, {"fill": "#A1A1AA", "font": "12px 600", "type": "text", "content": "Product Analyzers", "position": {"x": 1650, "y": 370}, "element_id": "label-analyzers"}, {"fill": "#71717A", "font": "10px normal", "type": "text", "content": "Diesel Stripper", "position": {"x": 1100, "y": 660}, "element_id": "label-diesel-strip"}, {"fill": "#71717A", "font": "10px normal", "type": "text", "content": "Kero Stripper", "position": {"x": 1300, "y": 700}, "element_id": "label-kero-strip"}, {"type": "line", "stroke": "#3F3F46", "content": null, "position": {"x": 0, "y": 60}, "element_id": "divider-title", "end_position": {"x": 1920, "y": 60}, "stroke_width": 1}, {"type": "line", "stroke": "#3F3F46", "content": null, "position": {"x": 1480, "y": 60}, "element_id": "divider-analyzers", "end_position": {"x": 1480, "y": 1080}, "stroke_width": 1}]}'::jsonb,
  NULL,
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  svg_data = EXCLUDED.svg_data,
  metadata = EXCLUDED.metadata,
  bindings = EXCLUDED.bindings;

-- HCU HP Separation
INSERT INTO design_objects (id, name, type, svg_data, bindings, metadata, created_by)
VALUES (
  '55aecf35-c52b-44f6-aa2c-0369b957dea0',
  'HCU HP Separation',
  'graphic',
  $svg$<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><rect width="100%" height="100%" fill="#09090B"/>
<path id="pipe-effluent-in" d="M 100 200 L 500 200" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Reactor Eff 780F</text>
<path id="pipe-cooler-hhps" d="M 750 200 L 900 200 L 900 300" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">110F</text>
<path id="pipe-wash-water" d="M 500 50 L 450 100" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Wash Water</text>
<path id="pipe-wash-injection" d="M 450 150 L 550 150 L 550 180" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-hhps-chps" d="M 900 600 L 900 650" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">HC Liquid</text>
<path id="pipe-hhps-rg" d="M 1050 350 L 1920 350" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Recycle Gas</text>
<path id="pipe-chps-hlps" d="M 1100 780 L 1300 780 L 1300 620" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">HC Liquid</text>
<path id="pipe-chps-sws" d="M 960 870 L 1100 900 L 1920 900" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Sour Water</text>
<path id="pipe-hlps-clps" d="M 1300 650 L 1300 700" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text x="960" y="30" font-family="monospace" font-size="14" fill="#E4E4E7">UNIT 25 — HP SEPARATION SYSTEM</text>
<text x="600" y="260" font-family="monospace" font-size="14" fill="#E4E4E7">A-2501 Air Cooler</text>
<text x="900" y="580" font-family="monospace" font-size="14" fill="#E4E4E7">V-2502 HHPS</text>
<text x="900" y="900" font-family="monospace" font-size="14" fill="#E4E4E7">V-2503 CHPS</text>
<text x="1300" y="640" font-family="monospace" font-size="14" fill="#E4E4E7">V-2504 HLPS</text>
<text x="1300" y="840" font-family="monospace" font-size="14" fill="#E4E4E7">V-2505 CLPS</text>
<text x="1700" y="330" font-family="monospace" font-size="14" fill="#E4E4E7">Recycle Gas to K-2501</text>
<g id="air-cooler-a2501" transform="translate(600.0,200.0) scale(1.5158,0.8421)">
  <g class="io-shape-body">
    <line x1="5" y1="5" x2="55" y2="5" stroke="#808080" stroke-width="0.75"/>
    <line x1="5" y1="5" x2="5" y2="27" stroke="#808080" stroke-width="0.75"/>
    <line x1="55" y1="5" x2="55" y2="27" stroke="#808080" stroke-width="0.75"/>
    <polyline points="-4,11 5,11 9,14 14,8 19,14 24,8 29,14 34,8 39,14 44,8 49,14 52,11 55,11 63,11"
              fill="none" stroke="#808080" stroke-width="0.75"/>
    <polyline points="59,8 63,11 59,14"
              fill="none" stroke="#808080" stroke-width="0.75"/>
    <path class="io-stateful"
          d="M30,22 C30,21 8,18 8,22 C8,26 30,23 30,22 Z"
          fill="none" stroke="#808080" stroke-width="0.75"/>
    <path class="io-stateful"
          d="M30,22 C30,21 52,18 52,22 C52,26 30,23 30,22 Z"
          fill="none" stroke="#808080" stroke-width="0.75"/>
    <line x1="30" y1="22" x2="30" y2="30" stroke="#808080" stroke-width="0.75"/>
  </g>
</g>
<g id="vessel-v2502" transform="translate(900.0,400.0) scale(1.6000,2.5600)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="vessel-v2503" transform="translate(900.0,720.0) rotate(90.0,40.0,20.0) scale(1.1200,0.8000)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M12,10 A5,10 0 0,0 12,30"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="10" x2="68" y2="10"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="30" x2="68" y2="30"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M68,10 A5,10 0 0,1 68,30"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="vessel-v2504" transform="translate(1300.0,500.0) scale(1.6000,1.9200)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="vessel-v2505" transform="translate(1300.0,760.0) rotate(90.0,40.0,20.0) scale(0.9600,0.8000)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M12,10 A5,10 0 0,0 12,30"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="10" x2="68" y2="10"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="30" x2="68" y2="30"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M68,10 A5,10 0 0,1 68,30"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-fv1310" transform="translate(450.0,100.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-lv1320" transform="translate(960.0,560.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-pv1301" transform="translate(750.0,640.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-lv1330" transform="translate(960.0,810.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-lv1331" transform="translate(960.0,870.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g></svg>$svg$,
  '{"name": "HCU HP Separation", "type": "graphic", "pipes": [{"label": "Reactor Eff 780F", "path_data": "M 100 200 L 500 200", "element_id": "pipe-effluent-in", "service_type": "process", "stroke_width": 2.0}, {"label": "110F", "path_data": "M 750 200 L 900 200 L 900 300", "element_id": "pipe-cooler-hhps", "service_type": "process", "stroke_width": 2.0}, {"label": "Wash Water", "path_data": "M 500 50 L 450 100", "element_id": "pipe-wash-water", "service_type": "water", "stroke_width": 1.5}, {"label": null, "path_data": "M 450 150 L 550 150 L 550 180", "element_id": "pipe-wash-injection", "service_type": "water", "stroke_width": 1.5}, {"label": "HC Liquid", "path_data": "M 900 600 L 900 650", "element_id": "pipe-hhps-chps", "service_type": "process", "stroke_width": 2.0}, {"label": "Recycle Gas", "path_data": "M 1050 350 L 1920 350", "element_id": "pipe-hhps-rg", "service_type": "gas_vapor", "stroke_width": 2.0}, {"label": "HC Liquid", "path_data": "M 1100 780 L 1300 780 L 1300 620", "element_id": "pipe-chps-hlps", "service_type": "process", "stroke_width": 2.0}, {"label": "Sour Water", "path_data": "M 960 870 L 1100 900 L 1920 900", "element_id": "pipe-chps-sws", "service_type": "water", "stroke_width": 1.5}, {"label": null, "path_data": "M 1300 650 L 1300 700", "element_id": "pipe-hlps-clps", "service_type": "process", "stroke_width": 2.0}], "layers": [{"name": "Background", "locked": true, "visible": true, "elements": ["pipe-effluent-in", "pipe-cooler-hhps", "pipe-wash-water", "pipe-wash-injection", "pipe-hhps-chps", "pipe-hhps-rg", "pipe-chps-hlps", "pipe-chps-sws", "pipe-hlps-clps", "divider-title"]}, {"name": "Equipment", "locked": false, "visible": true, "elements": ["air-cooler-a2501", "vessel-v2502", "vessel-v2503", "vessel-v2504", "vessel-v2505", "cv-fv1310", "cv-lv1320", "cv-pv1301", "cv-lv1330", "cv-lv1331"]}, {"name": "Instruments", "locked": false, "visible": true, "elements": ["readout-ti1301", "readout-ti1302", "readout-tic1305-pv", "readout-tic1305-sp", "status-tic1305-mode", "alarm-tic1305", "readout-ti1310", "readout-ii1305", "alarm-ii1305", "alarm-a2501", "readout-fic1310-pv", "readout-fic1310-sp", "status-fic1310-mode", "alarm-fic1310", "status-fv1310", "readout-ti1321", "readout-pi1321", "alarm-pi1321", "readout-lic1320-pv", "readout-lic1320-sp", "status-lic1320-mode", "gauge-lic1320", "alarm-lic1320", "status-lv1320", "readout-fi1320", "readout-ai1301", "alarm-ai1301", "alarm-v2502", "readout-ti1332", "readout-pic1301-pv", "readout-pic1301-sp", "status-pic1301-mode", "alarm-pic1301", "readout-pt1301", "status-pv1301", "readout-lic1330-pv", "gauge-lic1330", "alarm-lic1330", "status-lv1330", "readout-lic1331-pv", "gauge-lic1331", "alarm-lic1331", "status-lv1331", "readout-ai1330", "alarm-ai1330", "status-lsll1330", "alarm-v2503", "readout-lic1340-pv", "gauge-lic1340", "alarm-lic1340", "readout-pi1340", "alarm-pi1340", "readout-ti1304", "readout-li1342", "readout-fi1343", "readout-lic1341-pv", "gauge-lic1341", "alarm-lic1341", "readout-pi1341", "alarm-pi1341", "readout-ti1303", "readout-pi1303", "readout-fi1344", "readout-fi1350"]}, {"name": "Labels", "locked": false, "visible": true, "elements": ["label-screen-title", "label-a2501", "label-v2502", "label-v2503", "label-v2504", "label-v2505", "label-rg-outlet"]}], "shapes": [{"scale": {"x": 1.8, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 600, "y": 200}, "rotation": 0, "shape_id": "air-cooler", "element_id": "air-cooler-a2501", "configuration": null, "composable_parts": []}, {"scale": {"x": 1.0, "y": 1.6}, "mirror": "none", "variant": "opt1", "position": {"x": 900, "y": 400}, "rotation": 0, "shape_id": "vessel-vertical", "element_id": "vessel-v2502", "configuration": "plain", "composable_parts": []}, {"scale": {"x": 1.4, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 900, "y": 720}, "rotation": 90, "shape_id": "vessel-horizontal", "element_id": "vessel-v2503", "configuration": "plain", "composable_parts": [{"part_id": "part-support-saddle", "attachment": "bottom"}]}, {"scale": {"x": 1.0, "y": 1.2}, "mirror": "none", "variant": "opt1", "position": {"x": 1300, "y": 500}, "rotation": 0, "shape_id": "vessel-vertical", "element_id": "vessel-v2504", "configuration": "plain", "composable_parts": []}, {"scale": {"x": 1.2, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 1300, "y": 760}, "rotation": 90, "shape_id": "vessel-horizontal", "element_id": "vessel-v2505", "configuration": "plain", "composable_parts": [{"part_id": "part-support-saddle", "attachment": "bottom"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 450, "y": 100}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-fv1310", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attachment": "stem"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 960, "y": 560}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-lv1320", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attachment": "stem"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 750, "y": 640}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-pv1301", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attachment": "stem"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 960, "y": 810}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-lv1330", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attachment": "stem"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 960, "y": 870}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-lv1331", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attachment": "stem"}]}], "bindings": {"alarm-a2501": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-TIC-1305.PV", "25-II-1305.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-v2502": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PI-1321.PV", "25-LIC-1320.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-v2503": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PIC-1301.PV", "25-LIC-1330.PV", "25-LIC-1331.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ai1301": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-AI-1301.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ai1330": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-AI-1330.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ii1305": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-II-1305.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pi1321": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PI-1321.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pi1340": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PI-1340.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pi1341": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PI-1341.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-fic1310": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-FIC-1310.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-lic1320": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-LIC-1320.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-lic1330": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-LIC-1330.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-lic1331": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-LIC-1331.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-lic1340": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-LIC-1340.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-lic1341": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-LIC-1341.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pic1301": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PIC-1301.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-tic1305": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-TIC-1305.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "gauge-lic1320": {"mapping": {"type": "fill_gauge", "range_hi": 100, "range_lo": 0, "placement": "vessel_overlay", "fill_direction": "up", "clip_to_shape_id": "vessel-v2502"}, "attribute": "fill", "point_tag": "25-LIC-1320.PV", "source_hint": "SimBLAH-OPC"}, "gauge-lic1330": {"mapping": {"type": "fill_gauge", "range_hi": 100, "range_lo": 0, "placement": "vessel_overlay", "fill_direction": "up", "clip_to_shape_id": "vessel-v2503"}, "attribute": "fill", "point_tag": "25-LIC-1330.PV", "source_hint": "SimBLAH-OPC"}, "gauge-lic1331": {"mapping": {"type": "fill_gauge", "range_hi": 100, "range_lo": 0, "placement": "vessel_overlay", "fill_direction": "up", "clip_to_shape_id": "vessel-v2503"}, "attribute": "fill", "point_tag": "25-LIC-1331.PV", "source_hint": "SimBLAH-OPC"}, "gauge-lic1340": {"mapping": {"type": "fill_gauge", "range_hi": 100, "range_lo": 0, "placement": "vessel_overlay", "fill_direction": "up", "clip_to_shape_id": "vessel-v2504"}, "attribute": "fill", "point_tag": "25-LIC-1340.PV", "source_hint": "SimBLAH-OPC"}, "gauge-lic1341": {"mapping": {"type": "fill_gauge", "range_hi": 100, "range_lo": 0, "placement": "vessel_overlay", "fill_direction": "up", "clip_to_shape_id": "vessel-v2505"}, "attribute": "fill", "point_tag": "25-LIC-1341.PV", "source_hint": "SimBLAH-OPC"}, "status-fv1310": {"mapping": {"type": "state_class", "states": {"0": "CLOSED", "1": "OPEN"}}, "attribute": "class", "point_tag": "25-FV-1310.POS", "source_hint": "SimBLAH-OPC"}, "status-lv1320": {"mapping": {"type": "state_class", "states": {"0": "CLOSED", "1": "OPEN"}}, "attribute": "class", "point_tag": "25-LV-1320.POS", "source_hint": "SimBLAH-OPC"}, "status-lv1330": {"mapping": {"type": "state_class", "states": {"0": "CLOSED", "1": "OPEN"}}, "attribute": "class", "point_tag": "25-LV-1330.POS", "source_hint": "SimBLAH-OPC"}, "status-lv1331": {"mapping": {"type": "state_class", "states": {"0": "CLOSED", "1": "OPEN"}}, "attribute": "class", "point_tag": "25-LV-1331.POS", "source_hint": "SimBLAH-OPC"}, "status-pv1301": {"mapping": {"type": "state_class", "states": {"0": "CLOSED", "1": "OPEN"}}, "attribute": "class", "point_tag": "25-PV-1301.POS", "source_hint": "SimBLAH-OPC"}, "readout-ai1301": {"mapping": {"type": "text", "format": "%.2f", "suffix": " ppm"}, "attribute": "text", "point_tag": "25-AI-1301.PV", "source_hint": "SimBLAH-OPC"}, "readout-ai1330": {"mapping": {"type": "text", "format": "%.2f", "suffix": " ppm"}, "attribute": "text", "point_tag": "25-AI-1330.PV", "source_hint": "SimBLAH-OPC"}, "readout-fi1320": {"mapping": {"type": "text", "format": "%.1f", "suffix": " kBPD"}, "attribute": "text", "point_tag": "25-FI-1320.PV", "source_hint": "SimBLAH-OPC"}, "readout-fi1343": {"mapping": {"type": "text", "format": "%.1f", "suffix": " gpm"}, "attribute": "text", "point_tag": "25-FI-1343.PV", "source_hint": "SimBLAH-OPC"}, "readout-fi1344": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FI-1344.PV", "source_hint": "SimBLAH-OPC"}, "readout-fi1350": {"mapping": {"type": "text", "format": "%.1f", "suffix": " gpm"}, "attribute": "text", "point_tag": "25-FI-1350.PV", "source_hint": "SimBLAH-OPC"}, "readout-ii1305": {"mapping": {"type": "text", "format": "%.0f", "suffix": " A"}, "attribute": "text", "point_tag": "25-II-1305.PV", "source_hint": "SimBLAH-OPC"}, "readout-li1342": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LI-1342.PV", "source_hint": "SimBLAH-OPC"}, "readout-pi1303": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-1303.PV", "source_hint": "SimBLAH-OPC"}, "readout-pi1321": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-1321.PV", "source_hint": "SimBLAH-OPC"}, "readout-pi1340": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-1340.PV", "source_hint": "SimBLAH-OPC"}, "readout-pi1341": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-1341.PV", "source_hint": "SimBLAH-OPC"}, "readout-pt1301": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PT-1301.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1301": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1301.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1302": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1302.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1303": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1303.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1304": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1304.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1310": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1310.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1321": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1321.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1332": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1332.PV", "source_hint": "SimBLAH-OPC"}, "status-lsll1330": {"mapping": {"type": "state_class", "states": {"0": "NORMAL", "1": "TRIP"}}, "attribute": "class", "point_tag": "25-LSLL-1330.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic1310-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " gpm"}, "attribute": "text", "point_tag": "25-FIC-1310.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic1310-sp": {"mapping": {"type": "text", "format": "%.1f", "suffix": " gpm"}, "attribute": "text", "point_tag": "25-FIC-1310.SP", "source_hint": "SimBLAH-OPC"}, "readout-lic1320-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-1320.PV", "source_hint": "SimBLAH-OPC"}, "readout-lic1320-sp": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-1320.SP", "source_hint": "SimBLAH-OPC"}, "readout-lic1330-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-1330.PV", "source_hint": "SimBLAH-OPC"}, "readout-lic1331-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-1331.PV", "source_hint": "SimBLAH-OPC"}, "readout-lic1340-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-1340.PV", "source_hint": "SimBLAH-OPC"}, "readout-lic1341-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-1341.PV", "source_hint": "SimBLAH-OPC"}, "readout-pic1301-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PIC-1301.PV", "source_hint": "SimBLAH-OPC"}, "readout-pic1301-sp": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PIC-1301.SP", "source_hint": "SimBLAH-OPC"}, "readout-tic1305-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TIC-1305.PV", "source_hint": "SimBLAH-OPC"}, "readout-tic1305-sp": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TIC-1305.SP", "source_hint": "SimBLAH-OPC"}, "status-fic1310-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO"}}, "attribute": "class", "point_tag": "25-FIC-1310.MODE", "source_hint": "SimBLAH-OPC"}, "status-lic1320-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO"}}, "attribute": "class", "point_tag": "25-LIC-1320.MODE", "source_hint": "SimBLAH-OPC"}, "status-pic1301-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO"}}, "attribute": "class", "point_tag": "25-PIC-1301.MODE", "source_hint": "SimBLAH-OPC"}, "status-tic1305-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO"}}, "attribute": "class", "point_tag": "25-TIC-1305.MODE", "source_hint": "SimBLAH-OPC"}}, "metadata": {"tags": ["hcu", "unit25", "separation", "hp-sep", "hhps", "chps", "hlps", "clps", "air-cooler"], "width": 1920, "height": 1080, "viewBox": "0 0 1920 1080", "description": "HP separation system — HHPS/CHPS/HLPS/CLPS vessels, air cooler A-2501, and wash water injection.", "background_color": "#09090B"}, "annotations": [{"fill": "#E5E5E5", "font": "18px bold", "type": "text", "content": "UNIT 25 — HP SEPARATION SYSTEM", "position": {"x": 960, "y": 30}, "element_id": "label-screen-title"}, {"fill": "#A1A1AA", "font": "10px normal", "type": "text", "content": "A-2501 Air Cooler", "position": {"x": 600, "y": 260}, "element_id": "label-a2501"}, {"fill": "#A1A1AA", "font": "10px normal", "type": "text", "content": "V-2502 HHPS", "position": {"x": 900, "y": 580}, "element_id": "label-v2502"}, {"fill": "#A1A1AA", "font": "10px normal", "type": "text", "content": "V-2503 CHPS", "position": {"x": 900, "y": 900}, "element_id": "label-v2503"}, {"fill": "#A1A1AA", "font": "10px normal", "type": "text", "content": "V-2504 HLPS", "position": {"x": 1300, "y": 640}, "element_id": "label-v2504"}, {"fill": "#A1A1AA", "font": "10px normal", "type": "text", "content": "V-2505 CLPS", "position": {"x": 1300, "y": 840}, "element_id": "label-v2505"}, {"fill": "#71717A", "font": "10px normal", "type": "text", "content": "Recycle Gas to K-2501", "position": {"x": 1700, "y": 330}, "element_id": "label-rg-outlet"}, {"type": "line", "stroke": "#3F3F46", "content": null, "position": {"x": 0, "y": 60}, "element_id": "divider-title", "end_position": {"x": 1920, "y": 60}, "stroke_width": 1}]}'::jsonb,
  NULL,
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  svg_data = EXCLUDED.svg_data,
  metadata = EXCLUDED.metadata,
  bindings = EXCLUDED.bindings;

-- HCU Light Ends
INSERT INTO design_objects (id, name, type, svg_data, bindings, metadata, created_by)
VALUES (
  '16f0faa3-6b9e-4a88-b643-7ee62a05b2ff',
  'HCU Light Ends',
  'graphic',
  $svg$<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><rect width="100%" height="100%" fill="#09090B"/>
<path id="pipe-feed-ns" d="M 100 400 L 400 400" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Feed from Frac</text>
<path id="pipe-ns-overhead" d="M 400 100 L 650 100" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-ns-reflux-back" d="M 620 180 L 450 180" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Reflux</text>
<path id="pipe-ln-product" d="M 700 130 L 920 130" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">LN Product</text>
<path id="pipe-hn-bottoms" d="M 400 700 L 600 700" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">HN Bottoms</text>
<path id="pipe-ns-db-feed" d="M 600 150 L 900 150 L 900 400" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">To Debutanizer</text>
<path id="pipe-db-overhead" d="M 1100 100 L 1350 100" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-db-reflux-back" d="M 1370 180 L 1150 180" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Reflux</text>
<path id="pipe-lpg-product" d="M 1400 130 L 1550 130 L 1920 130" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">LPG Product</text>
<path id="pipe-db-bottoms" d="M 1100 700 L 1350 700" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Naphtha Bottoms</text>
<text x="960" y="30" font-family="monospace" font-size="14" fill="#E4E4E7">UNIT 25 — LIGHT ENDS / NAPHTHA SPLITTER C-2503 / DEBUTANIZER C-2504</text>
<text x="400" y="830" font-family="monospace" font-size="14" fill="#E4E4E7">C-2503 Naphtha Splitter</text>
<text x="1100" y="830" font-family="monospace" font-size="14" fill="#E4E4E7">C-2504 Debutanizer</text>
<text x="700" y="270" font-family="monospace" font-size="14" fill="#E4E4E7">NS Reflux Drum</text>
<text x="1400" y="270" font-family="monospace" font-size="14" fill="#E4E4E7">DB Reflux Drum</text>
<g id="column-c2503" transform="translate(400.0,400.0) scale(1.4545,2.6182)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,10 A12,5 0 0,1 34,10"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="10" x2="10" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="34" y1="10" x2="34" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,110 A12,5 0 0,0 34,110"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="vessel-ns-reflux" transform="translate(700.0,150.0) rotate(90.0,40.0,20.0) scale(0.8800,0.8000)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M12,10 A5,10 0 0,0 12,30"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="10" x2="68" y2="10"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="30" x2="68" y2="30"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M68,10 A5,10 0 0,1 68,30"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="column-c2504" transform="translate(1100.0,400.0) scale(1.4545,2.6182)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,10 A12,5 0 0,1 34,10"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="10" x2="10" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="34" y1="10" x2="34" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,110 A12,5 0 0,0 34,110"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="vessel-db-reflux" transform="translate(1400.0,150.0) rotate(90.0,40.0,20.0) scale(0.8800,0.8000)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M12,10 A5,10 0 0,0 12,30"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="10" x2="68" y2="10"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="30" x2="68" y2="30"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M68,10 A5,10 0 0,1 68,30"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g></svg>$svg$,
  '{"name": "HCU Light Ends", "type": "graphic", "pipes": [{"label": "Feed from Frac", "path_data": "M 100 400 L 400 400", "element_id": "pipe-feed-ns", "service_type": "process", "stroke_width": 2.0}, {"label": null, "path_data": "M 400 100 L 650 100", "element_id": "pipe-ns-overhead", "service_type": "gas_vapor", "stroke_width": 2.0}, {"label": "Reflux", "path_data": "M 620 180 L 450 180", "element_id": "pipe-ns-reflux-back", "service_type": "process", "stroke_width": 1.5}, {"label": "LN Product", "path_data": "M 700 130 L 920 130", "element_id": "pipe-ln-product", "service_type": "process", "stroke_width": 2.0}, {"label": "HN Bottoms", "path_data": "M 400 700 L 600 700", "element_id": "pipe-hn-bottoms", "service_type": "process", "stroke_width": 2.0}, {"label": "To Debutanizer", "path_data": "M 600 150 L 900 150 L 900 400", "element_id": "pipe-ns-db-feed", "service_type": "process", "stroke_width": 2.0}, {"label": null, "path_data": "M 1100 100 L 1350 100", "element_id": "pipe-db-overhead", "service_type": "gas_vapor", "stroke_width": 2.0}, {"label": "Reflux", "path_data": "M 1370 180 L 1150 180", "element_id": "pipe-db-reflux-back", "service_type": "process", "stroke_width": 1.5}, {"label": "LPG Product", "path_data": "M 1400 130 L 1550 130 L 1920 130", "element_id": "pipe-lpg-product", "service_type": "gas_vapor", "stroke_width": 2.0}, {"label": "Naphtha Bottoms", "path_data": "M 1100 700 L 1350 700", "element_id": "pipe-db-bottoms", "service_type": "process", "stroke_width": 2.0}], "layers": [{"name": "Background", "locked": true, "visible": true, "elements": ["pipe-feed-ns", "pipe-ns-overhead", "pipe-ns-reflux-back", "pipe-ln-product", "pipe-hn-bottoms", "pipe-ns-db-feed", "pipe-db-overhead", "pipe-db-reflux-back", "pipe-lpg-product", "pipe-db-bottoms", "divider-title", "divider-columns"]}, {"name": "Equipment", "locked": false, "visible": true, "elements": ["column-c2503", "vessel-ns-reflux", "column-c2504", "vessel-db-reflux"]}, {"name": "Instruments", "locked": false, "visible": true, "elements": ["readout-pic2301-pv", "readout-pic2301-sp", "status-pic2301-mode", "alarm-pic2301", "readout-ti2301", "readout-ti2302", "readout-ti2303", "readout-ti2304", "readout-ti2305", "readout-ti2326", "readout-li2327", "readout-lic2310-pv", "gauge-lic2310", "alarm-lic2310", "readout-fi2314", "readout-ai2302", "alarm-ai2302", "readout-ai2303", "alarm-ai2303", "readout-lic2311-pv", "gauge-lic2311", "alarm-lic2311", "readout-fic2312-pv", "readout-fic2312-sp", "status-fic2312-mode", "alarm-fic2312", "readout-fi2313", "readout-ai2301", "alarm-ai2301", "readout-pi2340", "alarm-pi2340", "readout-ii2310", "alarm-ii2310", "readout-pic2320-pv", "readout-pic2320-sp", "status-pic2320-mode", "alarm-pic2320", "readout-ti2321", "readout-ti2322", "readout-ti2323", "readout-ti2324", "readout-ti2325", "readout-ti2334", "readout-fi2334", "readout-lic2330-pv", "gauge-lic2330", "alarm-lic2330", "readout-fi2333", "readout-ti2335", "readout-pi2336", "alarm-pi2336", "readout-ai2321", "alarm-ai2321", "readout-ai2322", "alarm-ai2322", "readout-lic2331-pv", "gauge-lic2331", "alarm-lic2331", "readout-fic2332-pv", "readout-fic2332-sp", "status-fic2332-mode", "alarm-fic2332", "readout-ai2320", "alarm-ai2320", "readout-pi2341", "alarm-pi2341", "readout-ii2320", "alarm-ii2320"]}, {"name": "Labels", "locked": false, "visible": true, "elements": ["label-screen-title", "label-c2503", "label-c2504", "label-ns-drum", "label-db-drum"]}], "shapes": [{"scale": {"x": 1.0, "y": 1.8}, "mirror": "none", "variant": "opt1", "position": {"x": 400, "y": 400}, "rotation": 0, "shape_id": "column-distillation", "element_id": "column-c2503", "configuration": "trayed-6", "composable_parts": []}, {"scale": {"x": 1.1, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 700, "y": 150}, "rotation": 90, "shape_id": "vessel-horizontal", "element_id": "vessel-ns-reflux", "configuration": "plain", "composable_parts": [{"part_id": "part-support-saddle", "attachment": "bottom"}]}, {"scale": {"x": 1.0, "y": 1.8}, "mirror": "none", "variant": "opt1", "position": {"x": 1100, "y": 400}, "rotation": 0, "shape_id": "column-distillation", "element_id": "column-c2504", "configuration": "trayed-6", "composable_parts": []}, {"scale": {"x": 1.1, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 1400, "y": 150}, "rotation": 90, "shape_id": "vessel-horizontal", "element_id": "vessel-db-reflux", "configuration": "plain", "composable_parts": [{"part_id": "part-support-saddle", "attachment": "bottom"}]}], "bindings": {"alarm-ai2301": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-AI-2301.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ai2302": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-AI-2302.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ai2303": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-AI-2303.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ai2320": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-AI-2320.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ai2321": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-AI-2321.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ai2322": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-AI-2322.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ii2310": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-II-2310.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ii2320": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-II-2320.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pi2336": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PI-2336.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pi2340": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PI-2340.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pi2341": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PI-2341.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-fic2312": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-FIC-2312.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-fic2332": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-FIC-2332.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-lic2310": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-LIC-2310.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-lic2311": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-LIC-2311.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-lic2330": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-LIC-2330.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-lic2331": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-LIC-2331.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pic2301": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PIC-2301.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pic2320": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PIC-2320.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "gauge-lic2310": {"mapping": {"type": "fill_gauge", "range_hi": 100, "range_lo": 0, "placement": "vessel_overlay", "fill_direction": "up", "clip_to_shape_id": "column-c2503"}, "attribute": "fill", "point_tag": "25-LIC-2310.PV", "source_hint": "SimBLAH-OPC"}, "gauge-lic2311": {"mapping": {"type": "fill_gauge", "range_hi": 100, "range_lo": 0, "placement": "vessel_overlay", "fill_direction": "up", "clip_to_shape_id": "vessel-ns-reflux"}, "attribute": "fill", "point_tag": "25-LIC-2311.PV", "source_hint": "SimBLAH-OPC"}, "gauge-lic2330": {"mapping": {"type": "fill_gauge", "range_hi": 100, "range_lo": 0, "placement": "vessel_overlay", "fill_direction": "up", "clip_to_shape_id": "column-c2504"}, "attribute": "fill", "point_tag": "25-LIC-2330.PV", "source_hint": "SimBLAH-OPC"}, "gauge-lic2331": {"mapping": {"type": "fill_gauge", "range_hi": 100, "range_lo": 0, "placement": "vessel_overlay", "fill_direction": "up", "clip_to_shape_id": "vessel-db-reflux"}, "attribute": "fill", "point_tag": "25-LIC-2331.PV", "source_hint": "SimBLAH-OPC"}, "readout-ai2301": {"mapping": {"type": "text", "format": "%.1f", "suffix": " psi"}, "attribute": "text", "point_tag": "25-AI-2301.PV", "source_hint": "SimBLAH-OPC"}, "readout-ai2302": {"mapping": {"type": "text", "format": "%.2f", "suffix": " ppm"}, "attribute": "text", "point_tag": "25-AI-2302.PV", "source_hint": "SimBLAH-OPC"}, "readout-ai2303": {"mapping": {"type": "text", "format": "%.2f", "suffix": " ppm"}, "attribute": "text", "point_tag": "25-AI-2303.PV", "source_hint": "SimBLAH-OPC"}, "readout-ai2320": {"mapping": {"type": "text", "format": "%.2f", "suffix": " mol%"}, "attribute": "text", "point_tag": "25-AI-2320.PV", "source_hint": "SimBLAH-OPC"}, "readout-ai2321": {"mapping": {"type": "text", "format": "%.2f", "suffix": " ppm"}, "attribute": "text", "point_tag": "25-AI-2321.PV", "source_hint": "SimBLAH-OPC"}, "readout-ai2322": {"mapping": {"type": "text", "format": "%.2f", "suffix": " ppm"}, "attribute": "text", "point_tag": "25-AI-2322.PV", "source_hint": "SimBLAH-OPC"}, "readout-fi2313": {"mapping": {"type": "text", "format": "%.1f", "suffix": " kBPD"}, "attribute": "text", "point_tag": "25-FI-2313.PV", "source_hint": "SimBLAH-OPC"}, "readout-fi2314": {"mapping": {"type": "text", "format": "%.1f", "suffix": " kBPD"}, "attribute": "text", "point_tag": "25-FI-2314.PV", "source_hint": "SimBLAH-OPC"}, "readout-fi2333": {"mapping": {"type": "text", "format": "%.1f", "suffix": " kBPD"}, "attribute": "text", "point_tag": "25-FI-2333.PV", "source_hint": "SimBLAH-OPC"}, "readout-fi2334": {"mapping": {"type": "text", "format": "%.1f", "suffix": " klb/hr"}, "attribute": "text", "point_tag": "25-FI-2334.PV", "source_hint": "SimBLAH-OPC"}, "readout-ii2310": {"mapping": {"type": "text", "format": "%.0f", "suffix": " A"}, "attribute": "text", "point_tag": "25-II-2310.PV", "source_hint": "SimBLAH-OPC"}, "readout-ii2320": {"mapping": {"type": "text", "format": "%.0f", "suffix": " A"}, "attribute": "text", "point_tag": "25-II-2320.PV", "source_hint": "SimBLAH-OPC"}, "readout-li2327": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LI-2327.PV", "source_hint": "SimBLAH-OPC"}, "readout-pi2336": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-2336.PV", "source_hint": "SimBLAH-OPC"}, "readout-pi2340": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-2340.PV", "source_hint": "SimBLAH-OPC"}, "readout-pi2341": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-2341.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2301": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2301.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2302": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2302.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2303": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2303.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2304": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2304.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2305": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2305.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2321": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2321.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2322": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2322.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2323": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2323.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2324": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2324.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2325": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2325.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2326": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2326.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2334": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2334.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2335": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2335.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic2312-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " kBPD"}, "attribute": "text", "point_tag": "25-FIC-2312.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic2312-sp": {"mapping": {"type": "text", "format": "%.1f", "suffix": " kBPD"}, "attribute": "text", "point_tag": "25-FIC-2312.SP", "source_hint": "SimBLAH-OPC"}, "readout-fic2332-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " kBPD"}, "attribute": "text", "point_tag": "25-FIC-2332.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic2332-sp": {"mapping": {"type": "text", "format": "%.1f", "suffix": " kBPD"}, "attribute": "text", "point_tag": "25-FIC-2332.SP", "source_hint": "SimBLAH-OPC"}, "readout-lic2310-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-2310.PV", "source_hint": "SimBLAH-OPC"}, "readout-lic2311-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-2311.PV", "source_hint": "SimBLAH-OPC"}, "readout-lic2330-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-2330.PV", "source_hint": "SimBLAH-OPC"}, "readout-lic2331-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-2331.PV", "source_hint": "SimBLAH-OPC"}, "readout-pic2301-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PIC-2301.PV", "source_hint": "SimBLAH-OPC"}, "readout-pic2301-sp": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PIC-2301.SP", "source_hint": "SimBLAH-OPC"}, "readout-pic2320-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PIC-2320.PV", "source_hint": "SimBLAH-OPC"}, "readout-pic2320-sp": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PIC-2320.SP", "source_hint": "SimBLAH-OPC"}, "status-fic2312-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO"}}, "attribute": "class", "point_tag": "25-FIC-2312.MODE", "source_hint": "SimBLAH-OPC"}, "status-fic2332-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO"}}, "attribute": "class", "point_tag": "25-FIC-2332.MODE", "source_hint": "SimBLAH-OPC"}, "status-pic2301-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO"}}, "attribute": "class", "point_tag": "25-PIC-2301.MODE", "source_hint": "SimBLAH-OPC"}, "status-pic2320-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO"}}, "attribute": "class", "point_tag": "25-PIC-2320.MODE", "source_hint": "SimBLAH-OPC"}}, "metadata": {"tags": ["hcu", "unit25", "light-ends", "naphtha", "lpg", "debutanizer", "c2503", "c2504"], "width": 1920, "height": 1080, "viewBox": "0 0 1920 1080", "description": "Naphtha splitter C-2503 and debutanizer C-2504 with reflux drums, LPG overhead, and product analyzers.", "background_color": "#09090B"}, "annotations": [{"fill": "#E5E5E5", "font": "18px bold", "type": "text", "content": "UNIT 25 — LIGHT ENDS / NAPHTHA SPLITTER C-2503 / DEBUTANIZER C-2504", "position": {"x": 960, "y": 30}, "element_id": "label-screen-title"}, {"fill": "#A1A1AA", "font": "12px 600", "type": "text", "content": "C-2503 Naphtha Splitter", "position": {"x": 400, "y": 830}, "element_id": "label-c2503"}, {"fill": "#A1A1AA", "font": "12px 600", "type": "text", "content": "C-2504 Debutanizer", "position": {"x": 1100, "y": 830}, "element_id": "label-c2504"}, {"fill": "#71717A", "font": "10px normal", "type": "text", "content": "NS Reflux Drum", "position": {"x": 700, "y": 270}, "element_id": "label-ns-drum"}, {"fill": "#71717A", "font": "10px normal", "type": "text", "content": "DB Reflux Drum", "position": {"x": 1400, "y": 270}, "element_id": "label-db-drum"}, {"type": "line", "stroke": "#3F3F46", "content": null, "position": {"x": 0, "y": 60}, "element_id": "divider-title", "end_position": {"x": 1920, "y": 60}, "stroke_width": 1}, {"type": "line", "stroke": "#3F3F46", "content": null, "position": {"x": 900, "y": 60}, "element_id": "divider-columns", "end_position": {"x": 900, "y": 1080}, "stroke_width": 1}]}'::jsonb,
  NULL,
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  svg_data = EXCLUDED.svg_data,
  metadata = EXCLUDED.metadata,
  bindings = EXCLUDED.bindings;

-- HCU Overview / Performance
INSERT INTO design_objects (id, name, type, svg_data, bindings, metadata, created_by)
VALUES (
  'b2d452d5-764d-4eab-af45-b4d03b5b9dbf',
  'HCU Overview / Performance',
  'graphic',
  $svg$<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><rect width="100%" height="100%" fill="#09090B"/>
<path id="arrow-feed-preheat" d="M 160 400 L 220 400" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="arrow-preheat-heater" d="M 320 400 L 390 400" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="arrow-heater-r2501" d="M 490 400 L 540 380" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="arrow-heater-r2502" d="M 490 400 L 540 480" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="arrow-r2501-hpsep" d="M 640 360 L 700 410" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="arrow-r2502-hpsep" d="M 640 500 L 700 430" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="arrow-hpsep-frac" d="M 800 420 L 870 420" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="arrow-h2-recycle" d="M 580 200 L 580 340" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Recycle H2</text>
<path id="arrow-h2-makeup" d="M 100 200 L 540 200" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Makeup H2</text>
<text x="960" y="30" font-family="monospace" font-size="14" fill="#E4E4E7">UNIT 25 — HCU UNIT OVERVIEW & PERFORMANCE</text>
<text x="120" y="395" font-family="monospace" font-size="14" fill="#E4E4E7">FEED</text>
<text x="270" y="395" font-family="monospace" font-size="14" fill="#E4E4E7">PREHEAT</text>
<text x="440" y="395" font-family="monospace" font-size="14" fill="#E4E4E7">H-2501</text>
<text x="590" y="355" font-family="monospace" font-size="14" fill="#E4E4E7">R-2501</text>
<text x="590" y="495" font-family="monospace" font-size="14" fill="#E4E4E7">R-2502</text>
<text x="750" y="425" font-family="monospace" font-size="14" fill="#E4E4E7">HP SEP</text>
<text x="910" y="415" font-family="monospace" font-size="14" fill="#E4E4E7">FRAC</text>
<text x="1300" y="65" font-family="monospace" font-size="14" fill="#E4E4E7">Performance KPIs</text>
<text x="1300" y="625" font-family="monospace" font-size="14" fill="#E4E4E7">Product Quality</text>
<text x="50" y="930" font-family="monospace" font-size="14" fill="#E4E4E7">ESD Status</text>
<text x="50" y="1005" font-family="monospace" font-size="14" fill="#E4E4E7">Running Status</text>
<g id="valve-xv2501" transform="translate(50.0,950.0) scale(1.0667,1.0667)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,0 24,12 0,24"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,0 24,12 48,24"
             fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="valve-xv2502" transform="translate(150.0,950.0) scale(1.0667,1.0667)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,0 24,12 0,24"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,0 24,12 48,24"
             fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="valve-xv2503" transform="translate(250.0,950.0) scale(1.0667,1.0667)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,0 24,12 0,24"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,0 24,12 48,24"
             fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="valve-xv2504" transform="translate(350.0,950.0) scale(1.0667,1.0667)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,0 24,12 0,24"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,0 24,12 48,24"
             fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g></svg>$svg$,
  '{"name": "HCU Overview / Performance", "type": "graphic", "pipes": [{"label": null, "path_data": "M 160 400 L 220 400", "element_id": "arrow-feed-preheat", "service_type": "process", "stroke_width": 2.0}, {"label": null, "path_data": "M 320 400 L 390 400", "element_id": "arrow-preheat-heater", "service_type": "process", "stroke_width": 2.0}, {"label": null, "path_data": "M 490 400 L 540 380", "element_id": "arrow-heater-r2501", "service_type": "process", "stroke_width": 2.0}, {"label": null, "path_data": "M 490 400 L 540 480", "element_id": "arrow-heater-r2502", "service_type": "process", "stroke_width": 2.0}, {"label": null, "path_data": "M 640 360 L 700 410", "element_id": "arrow-r2501-hpsep", "service_type": "process", "stroke_width": 2.0}, {"label": null, "path_data": "M 640 500 L 700 430", "element_id": "arrow-r2502-hpsep", "service_type": "process", "stroke_width": 2.0}, {"label": null, "path_data": "M 800 420 L 870 420", "element_id": "arrow-hpsep-frac", "service_type": "process", "stroke_width": 2.0}, {"label": "Recycle H2", "path_data": "M 580 200 L 580 340", "element_id": "arrow-h2-recycle", "service_type": "gas_vapor", "stroke_width": 1.5}, {"label": "Makeup H2", "path_data": "M 100 200 L 540 200", "element_id": "arrow-h2-makeup", "service_type": "gas_vapor", "stroke_width": 1.5}], "layers": [{"name": "Background", "locked": true, "visible": true, "elements": ["arrow-feed-preheat", "arrow-preheat-heater", "arrow-heater-r2501", "arrow-heater-r2502", "arrow-r2501-hpsep", "arrow-r2502-hpsep", "arrow-hpsep-frac", "arrow-h2-recycle", "arrow-h2-makeup", "divider-title", "divider-kpi-quality", "divider-esd", "divider-left-right"]}, {"name": "Equipment", "locked": false, "visible": true, "elements": ["valve-xv2501", "valve-xv2502", "valve-xv2503", "valve-xv2504", "block-feed", "block-preheat", "block-heater", "block-r2501", "block-r2502", "block-hpsep", "block-frac"]}, {"name": "Instruments", "locked": false, "visible": true, "elements": ["readout-fi0001", "readout-fic1001-pv", "readout-ti1004", "readout-tic1010-pv", "readout-wabt-r2501", "readout-wabt-r2502", "readout-ti1321", "readout-pi1321", "readout-ti2204", "readout-calc3103", "sparkline-calc3103", "readout-calc3104", "sparkline-calc3104", "readout-calc3105", "sparkline-calc3105", "readout-conv1001", "sparkline-conv1001", "readout-calc3106", "readout-calc3107", "readout-calc3101", "readout-calc3102", "readout-calc3109", "readout-wabt-comb", "sparkline-wabt-comb", "readout-ai3001", "alarm-ai3001", "readout-ai3002", "alarm-ai3002", "readout-ai3003", "alarm-ai3003", "readout-ai3004", "alarm-ai3004", "readout-ai3005", "alarm-ai3005", "readout-ai3006", "alarm-ai3006", "readout-ai3007", "alarm-ai3007", "readout-ai3008", "alarm-ai3008", "readout-ai3009", "alarm-ai3009", "readout-ai3010", "status-xv2501", "status-xv2502", "status-xv2503", "status-xv2504", "status-zeds-small", "status-zeds-large", "status-fsll1001", "status-lshh2001", "readout-fi9001", "readout-pi9001", "alarm-pi9001", "readout-li9002", "status-p2501a-run", "status-k2501-run", "status-k2502-run", "status-p2503-run", "status-p2504-run"]}, {"name": "Labels", "locked": false, "visible": true, "elements": ["label-screen-title", "label-block-feed", "label-block-preheat", "label-block-heater", "label-block-r2501", "label-block-r2502", "label-block-hpsep", "label-block-frac", "label-kpi-title", "label-quality-title", "label-esd-title", "label-running-title"]}], "shapes": [{"scale": {"x": 0.8, "y": 0.8}, "mirror": "none", "variant": "opt1", "position": {"x": 50, "y": 950}, "rotation": 0, "shape_id": "valve-gate", "element_id": "valve-xv2501", "configuration": null, "composable_parts": []}, {"scale": {"x": 0.8, "y": 0.8}, "mirror": "none", "variant": "opt1", "position": {"x": 150, "y": 950}, "rotation": 0, "shape_id": "valve-gate", "element_id": "valve-xv2502", "configuration": null, "composable_parts": []}, {"scale": {"x": 0.8, "y": 0.8}, "mirror": "none", "variant": "opt1", "position": {"x": 250, "y": 950}, "rotation": 0, "shape_id": "valve-gate", "element_id": "valve-xv2503", "configuration": null, "composable_parts": []}, {"scale": {"x": 0.8, "y": 0.8}, "mirror": "none", "variant": "opt1", "position": {"x": 350, "y": 950}, "rotation": 0, "shape_id": "valve-gate", "element_id": "valve-xv2504", "configuration": null, "composable_parts": []}], "bindings": {"alarm-ai3001": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-AI-3001.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ai3002": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-AI-3002.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ai3003": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-AI-3003.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ai3004": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-AI-3004.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ai3005": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-AI-3005.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ai3006": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-AI-3006.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ai3007": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-AI-3007.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ai3008": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-AI-3008.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ai3009": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-AI-3009.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pi9001": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PI-9001.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "status-xv2501": {"mapping": {"type": "state_class", "states": {"0": "CLOSED", "1": "OPEN"}}, "attribute": "class", "point_tag": "25-XV-2501.POS", "source_hint": "SimBLAH-OPC"}, "status-xv2502": {"mapping": {"type": "state_class", "states": {"0": "CLOSED", "1": "OPEN"}}, "attribute": "class", "point_tag": "25-XV-2502.POS", "source_hint": "SimBLAH-OPC"}, "status-xv2503": {"mapping": {"type": "state_class", "states": {"0": "CLOSED", "1": "OPEN"}}, "attribute": "class", "point_tag": "25-XV-2503.POS", "source_hint": "SimBLAH-OPC"}, "status-xv2504": {"mapping": {"type": "state_class", "states": {"0": "CLOSED", "1": "OPEN"}}, "attribute": "class", "point_tag": "25-XV-2504.POS", "source_hint": "SimBLAH-OPC"}, "readout-ai3001": {"mapping": {"type": "text", "format": "%.1f", "suffix": " ppm"}, "attribute": "text", "point_tag": "25-AI-3001.PV", "source_hint": "SimBLAH-OPC"}, "readout-ai3002": {"mapping": {"type": "text", "format": "%.1f", "suffix": " ppm"}, "attribute": "text", "point_tag": "25-AI-3002.PV", "source_hint": "SimBLAH-OPC"}, "readout-ai3003": {"mapping": {"type": "text", "format": "%.1f", "suffix": " ppm"}, "attribute": "text", "point_tag": "25-AI-3003.PV", "source_hint": "SimBLAH-OPC"}, "readout-ai3004": {"mapping": {"type": "text", "format": "%.1f", "suffix": " API"}, "attribute": "text", "point_tag": "25-AI-3004.PV", "source_hint": "SimBLAH-OPC"}, "readout-ai3005": {"mapping": {"type": "text", "format": "%.1f", "suffix": " API"}, "attribute": "text", "point_tag": "25-AI-3005.PV", "source_hint": "SimBLAH-OPC"}, "readout-ai3006": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-AI-3006.PV", "source_hint": "SimBLAH-OPC"}, "readout-ai3007": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-AI-3007.PV", "source_hint": "SimBLAH-OPC"}, "readout-ai3008": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-AI-3008.PV", "source_hint": "SimBLAH-OPC"}, "readout-ai3009": {"mapping": {"type": "text", "format": "%.1f", "suffix": " API"}, "attribute": "text", "point_tag": "25-AI-3009.PV", "source_hint": "SimBLAH-OPC"}, "readout-ai3010": {"mapping": {"type": "text", "format": "%.1f", "suffix": " vol%"}, "attribute": "text", "point_tag": "25-AI-3010.PV", "source_hint": "SimBLAH-OPC"}, "readout-fi0001": {"mapping": {"type": "text", "format": "%.1f", "suffix": " kBPD"}, "attribute": "text", "point_tag": "25-FI-0001.PV", "source_hint": "SimBLAH-OPC"}, "readout-fi9001": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FI-9001.PV", "source_hint": "SimBLAH-OPC"}, "readout-li9002": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LI-9002.PV", "source_hint": "SimBLAH-OPC"}, "readout-pi1321": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-1321.PV", "source_hint": "SimBLAH-OPC"}, "readout-pi9001": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-9001.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1004": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1004.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1321": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1321.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2204": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2204.PV", "source_hint": "SimBLAH-OPC"}, "status-fsll1001": {"mapping": {"type": "state_class", "states": {"0": "NORMAL", "1": "TRIP"}}, "attribute": "class", "point_tag": "25-FSLL-1001.PV", "source_hint": "SimBLAH-OPC"}, "status-lshh2001": {"mapping": {"type": "state_class", "states": {"0": "NORMAL", "1": "TRIP"}}, "attribute": "class", "point_tag": "25-LSHH-2001.PV", "source_hint": "SimBLAH-OPC"}, "readout-calc3101": {"mapping": {"type": "text", "format": "%.0f", "suffix": " days"}, "attribute": "text", "point_tag": "25-CALC-3101.PV", "source_hint": "SimBLAH-OPC"}, "readout-calc3102": {"mapping": {"type": "text", "format": "%.0f", "suffix": " days"}, "attribute": "text", "point_tag": "25-CALC-3102.PV", "source_hint": "SimBLAH-OPC"}, "readout-calc3103": {"mapping": {"type": "text", "format": "%.2f", "suffix": " 1/hr"}, "attribute": "text", "point_tag": "25-CALC-3103.PV", "source_hint": "SimBLAH-OPC"}, "readout-calc3104": {"mapping": {"type": "text", "format": "%.0f", "suffix": " SCF/bbl"}, "attribute": "text", "point_tag": "25-CALC-3104.PV", "source_hint": "SimBLAH-OPC"}, "readout-calc3105": {"mapping": {"type": "text", "format": "%.0f", "suffix": " SCF/bbl"}, "attribute": "text", "point_tag": "25-CALC-3105.PV", "source_hint": "SimBLAH-OPC"}, "readout-calc3106": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-CALC-3106.PV", "source_hint": "SimBLAH-OPC"}, "readout-calc3107": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-CALC-3107.PV", "source_hint": "SimBLAH-OPC"}, "readout-calc3109": {"mapping": {"type": "text", "format": "%.3f", "suffix": " MMBTU/bbl"}, "attribute": "text", "point_tag": "25-CALC-3109.PV", "source_hint": "SimBLAH-OPC"}, "readout-conv1001": {"mapping": {"type": "text", "format": "%.1f", "suffix": " vol%"}, "attribute": "text", "point_tag": "25-CONV-1001.PV", "source_hint": "SimBLAH-OPC"}, "status-k2501-run": {"mapping": {"type": "state_class", "states": {"0": "STOPPED", "1": "RUNNING"}}, "attribute": "class", "point_tag": "25-K-2501.RUN", "source_hint": "SimBLAH-OPC"}, "status-k2502-run": {"mapping": {"type": "state_class", "states": {"0": "STOPPED", "1": "RUNNING"}}, "attribute": "class", "point_tag": "25-K-2502.RUN", "source_hint": "SimBLAH-OPC"}, "status-p2503-run": {"mapping": {"type": "state_class", "states": {"0": "STOPPED", "1": "RUNNING"}}, "attribute": "class", "point_tag": "25-P-2503.RUN", "source_hint": "SimBLAH-OPC"}, "status-p2504-run": {"mapping": {"type": "state_class", "states": {"0": "STOPPED", "1": "RUNNING"}}, "attribute": "class", "point_tag": "25-P-2504.RUN", "source_hint": "SimBLAH-OPC"}, "readout-wabt-comb": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-WABT-COMB.PV", "source_hint": "SimBLAH-OPC"}, "status-p2501a-run": {"mapping": {"type": "state_class", "states": {"0": "STOPPED", "1": "RUNNING"}}, "attribute": "class", "point_tag": "25-P-2501A.RUN", "source_hint": "SimBLAH-OPC"}, "status-zeds-large": {"mapping": {"type": "state_class", "states": {"0": "CLOSED", "1": "OPEN"}}, "attribute": "class", "point_tag": "25-ZI-EDS-LARGE.PV", "source_hint": "SimBLAH-OPC"}, "status-zeds-small": {"mapping": {"type": "state_class", "states": {"0": "CLOSED", "1": "OPEN"}}, "attribute": "class", "point_tag": "25-ZI-EDS-SMALL.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic1001-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " kBPD"}, "attribute": "text", "point_tag": "25-FIC-1001.PV", "source_hint": "SimBLAH-OPC"}, "readout-tic1010-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TIC-1010.PV", "source_hint": "SimBLAH-OPC"}, "readout-wabt-r2501": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-WABT-1101.PV", "source_hint": "SimBLAH-OPC"}, "readout-wabt-r2502": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-WABT-1201.PV", "source_hint": "SimBLAH-OPC"}, "sparkline-calc3103": {"mapping": {"type": "sparkline", "scale_mode": "auto", "time_window_minutes": 60}, "attribute": "text", "point_tag": "25-CALC-3103.PV", "source_hint": "SimBLAH-OPC"}, "sparkline-calc3104": {"mapping": {"type": "sparkline", "scale_mode": "auto", "time_window_minutes": 60}, "attribute": "text", "point_tag": "25-CALC-3104.PV", "source_hint": "SimBLAH-OPC"}, "sparkline-calc3105": {"mapping": {"type": "sparkline", "scale_mode": "auto", "time_window_minutes": 60}, "attribute": "text", "point_tag": "25-CALC-3105.PV", "source_hint": "SimBLAH-OPC"}, "sparkline-conv1001": {"mapping": {"type": "sparkline", "scale_mode": "auto", "time_window_minutes": 60}, "attribute": "text", "point_tag": "25-CONV-1001.PV", "source_hint": "SimBLAH-OPC"}, "sparkline-wabt-comb": {"mapping": {"type": "sparkline", "scale_mode": "auto", "time_window_minutes": 60}, "attribute": "text", "point_tag": "25-WABT-COMB.PV", "source_hint": "SimBLAH-OPC"}}, "metadata": {"tags": ["hcu", "unit25", "overview", "performance", "kpi", "esd", "conversion", "wabt"], "width": 1920, "height": 1080, "viewBox": "0 0 1920 1080", "description": "HCU unit-level overview with simplified process block diagram, performance KPI cards, product quality analyzers, and ESD status row.", "background_color": "#09090B"}, "annotations": [{"fill": "#E5E5E5", "font": "18px bold", "type": "text", "content": "UNIT 25 — HCU UNIT OVERVIEW & PERFORMANCE", "position": {"x": 960, "y": 30}, "element_id": "label-screen-title"}, {"rx": 4, "fill": "#18181B", "type": "rect", "width": 80, "height": 60, "stroke": "#3F3F46", "content": null, "position": {"x": 80, "y": 370}, "element_id": "block-feed"}, {"fill": "#A1A1AA", "font": "10px 600", "type": "text", "content": "FEED", "position": {"x": 120, "y": 395}, "element_id": "label-block-feed"}, {"rx": 4, "fill": "#18181B", "type": "rect", "width": 100, "height": 60, "stroke": "#3F3F46", "content": null, "position": {"x": 220, "y": 370}, "element_id": "block-preheat"}, {"fill": "#A1A1AA", "font": "10px 600", "type": "text", "content": "PREHEAT", "position": {"x": 270, "y": 395}, "element_id": "label-block-preheat"}, {"rx": 4, "fill": "#18181B", "type": "rect", "width": 100, "height": 60, "stroke": "#3F3F46", "content": null, "position": {"x": 390, "y": 370}, "element_id": "block-heater"}, {"fill": "#A1A1AA", "font": "10px 600", "type": "text", "content": "H-2501", "position": {"x": 440, "y": 395}, "element_id": "label-block-heater"}, {"rx": 4, "fill": "#18181B", "type": "rect", "width": 100, "height": 80, "stroke": "#3F3F46", "content": null, "position": {"x": 540, "y": 320}, "element_id": "block-r2501"}, {"fill": "#A1A1AA", "font": "10px 600", "type": "text", "content": "R-2501", "position": {"x": 590, "y": 355}, "element_id": "label-block-r2501"}, {"rx": 4, "fill": "#18181B", "type": "rect", "width": 100, "height": 80, "stroke": "#3F3F46", "content": null, "position": {"x": 540, "y": 460}, "element_id": "block-r2502"}, {"fill": "#A1A1AA", "font": "10px 600", "type": "text", "content": "R-2502", "position": {"x": 590, "y": 495}, "element_id": "label-block-r2502"}, {"rx": 4, "fill": "#18181B", "type": "rect", "width": 100, "height": 70, "stroke": "#3F3F46", "content": null, "position": {"x": 700, "y": 390}, "element_id": "block-hpsep"}, {"fill": "#A1A1AA", "font": "10px 600", "type": "text", "content": "HP SEP", "position": {"x": 750, "y": 425}, "element_id": "label-block-hpsep"}, {"rx": 4, "fill": "#18181B", "type": "rect", "width": 80, "height": 80, "stroke": "#3F3F46", "content": null, "position": {"x": 870, "y": 380}, "element_id": "block-frac"}, {"fill": "#A1A1AA", "font": "10px 600", "type": "text", "content": "FRAC", "position": {"x": 910, "y": 415}, "element_id": "label-block-frac"}, {"fill": "#A1A1AA", "font": "14px 600", "type": "text", "content": "Performance KPIs", "position": {"x": 1300, "y": 65}, "element_id": "label-kpi-title"}, {"fill": "#A1A1AA", "font": "14px 600", "type": "text", "content": "Product Quality", "position": {"x": 1300, "y": 625}, "element_id": "label-quality-title"}, {"fill": "#A1A1AA", "font": "12px 600", "type": "text", "content": "ESD Status", "position": {"x": 50, "y": 930}, "element_id": "label-esd-title"}, {"fill": "#71717A", "font": "10px normal", "type": "text", "content": "Running Status", "position": {"x": 50, "y": 1005}, "element_id": "label-running-title"}, {"type": "line", "stroke": "#3F3F46", "content": null, "position": {"x": 0, "y": 60}, "element_id": "divider-title", "end_position": {"x": 1920, "y": 60}, "stroke_width": 1}, {"type": "line", "stroke": "#3F3F46", "content": null, "position": {"x": 960, "y": 600}, "element_id": "divider-kpi-quality", "end_position": {"x": 1920, "y": 600}, "stroke_width": 1}, {"type": "line", "stroke": "#3F3F46", "content": null, "position": {"x": 0, "y": 920}, "element_id": "divider-esd", "end_position": {"x": 1920, "y": 920}, "stroke_width": 1}, {"type": "line", "stroke": "#3F3F46", "content": null, "position": {"x": 950, "y": 60}, "element_id": "divider-left-right", "end_position": {"x": 950, "y": 920}, "stroke_width": 1}]}'::jsonb,
  NULL,
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  svg_data = EXCLUDED.svg_data,
  metadata = EXCLUDED.metadata,
  bindings = EXCLUDED.bindings;

-- HCU Reactor R-2501 (Pretreater)
INSERT INTO design_objects (id, name, type, svg_data, bindings, metadata, created_by)
VALUES (
  'b02feff2-dec9-4c8e-a647-4baf102c2ae8',
  'HCU Reactor R-2501 (Pretreater)',
  'graphic',
  $svg$<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><rect width="100%" height="100%" fill="#09090B"/>
<path id="pipe-feed-in" d="M 960 50 L 960 400" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Feed from H-2501</text>
<path id="pipe-reactor-out" d="M 960 700 L 1920 700" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">To HP Sep</text>
<path id="pipe-quench-header" d="M 680 150 L 680 600" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Quench H2 Header</text>
<path id="pipe-quench-ib1" d="M 680 280 L 750 280" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-quench-ib1-out" d="M 750 280 L 900 280" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-quench-ib2" d="M 680 380 L 750 380" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-quench-ib2-out" d="M 750 380 L 900 380" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-quench-ib3" d="M 680 480 L 750 480" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-quench-ib3-out" d="M 750 480 L 900 480" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text x="960" y="30" font-family="monospace" font-size="14" fill="#E4E4E7">UNIT 25 — PRETREATER REACTOR R-2501</text>
<text x="960" y="800" font-family="monospace" font-size="14" fill="#E4E4E7">R-2501</text>
<text x="1240" y="175" font-family="monospace" font-size="14" fill="#E4E4E7">BED 1</text>
<text x="1240" y="335" font-family="monospace" font-size="14" fill="#E4E4E7">BED 2</text>
<text x="1240" y="455" font-family="monospace" font-size="14" fill="#E4E4E7">BED 3</text>
<text x="1240" y="575" font-family="monospace" font-size="14" fill="#E4E4E7">BED 4</text>
<text x="640" y="150" font-family="monospace" font-size="14" fill="#E4E4E7">Quench System</text>
<text x="700" y="865" font-family="monospace" font-size="14" fill="#E4E4E7">Calculated Values</text>
<g id="reactor-r2501" transform="translate(960.0,400.0) scale(1.9200,2.8800)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="68" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-fv1120" transform="translate(750.0,280.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-fv1122" transform="translate(750.0,380.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-fv1124" transform="translate(750.0,480.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g></svg>$svg$,
  '{"name": "HCU Reactor R-2501 (Pretreater)", "type": "graphic", "pipes": [{"label": "Feed from H-2501", "path_data": "M 960 50 L 960 400", "element_id": "pipe-feed-in", "service_type": "process", "stroke_width": 2.0}, {"label": "To HP Sep", "path_data": "M 960 700 L 1920 700", "element_id": "pipe-reactor-out", "service_type": "process", "stroke_width": 2.0}, {"label": "Quench H2 Header", "path_data": "M 680 150 L 680 600", "element_id": "pipe-quench-header", "service_type": "gas_vapor", "stroke_width": 1.5}, {"label": null, "path_data": "M 680 280 L 750 280", "element_id": "pipe-quench-ib1", "service_type": "gas_vapor", "stroke_width": 1.5}, {"label": null, "path_data": "M 750 280 L 900 280", "element_id": "pipe-quench-ib1-out", "service_type": "gas_vapor", "stroke_width": 1.5}, {"label": null, "path_data": "M 680 380 L 750 380", "element_id": "pipe-quench-ib2", "service_type": "gas_vapor", "stroke_width": 1.5}, {"label": null, "path_data": "M 750 380 L 900 380", "element_id": "pipe-quench-ib2-out", "service_type": "gas_vapor", "stroke_width": 1.5}, {"label": null, "path_data": "M 680 480 L 750 480", "element_id": "pipe-quench-ib3", "service_type": "gas_vapor", "stroke_width": 1.5}, {"label": null, "path_data": "M 750 480 L 900 480", "element_id": "pipe-quench-ib3-out", "service_type": "gas_vapor", "stroke_width": 1.5}], "layers": [{"name": "Background", "locked": true, "visible": true, "elements": ["pipe-feed-in", "pipe-reactor-out", "pipe-quench-header", "pipe-quench-ib1", "pipe-quench-ib1-out", "pipe-quench-ib2", "pipe-quench-ib2-out", "pipe-quench-ib3", "pipe-quench-ib3-out", "divider-calc", "divider-title"]}, {"name": "Equipment", "locked": false, "visible": true, "elements": ["reactor-r2501", "cv-fv1120", "cv-fv1122", "cv-fv1124"]}, {"name": "Instruments", "locked": false, "visible": true, "elements": ["readout-tic1101-pv", "readout-tic1101-sp", "status-tic1101-mode", "alarm-tic1101", "readout-pi1101", "alarm-pi1101", "bar-wabt1101", "readout-wabt1101", "status-pshh1101", "readout-h2pp1101", "alarm-h2pp1101", "readout-h2pp1102", "readout-pdi1101", "alarm-pdi1101", "readout-pdi1102", "alarm-pdi1102", "readout-pdi1103", "alarm-pdi1103", "readout-pdi1104", "alarm-pdi1104", "readout-pdi1105", "alarm-pdi1105", "readout-pdi1106", "alarm-pdi1106", "readout-ti1160", "readout-ti1161", "readout-ti1162", "readout-ai1101", "alarm-ai1101", "readout-ai1102", "alarm-ai1102", "readout-ai1103", "alarm-ai1103", "readout-fic1120-pv", "readout-fic1120-sp", "status-fic1120-mode", "alarm-fic1120", "status-fv1120", "readout-tic1121-pv", "readout-ti1163", "alarm-ti1163", "readout-fi1131", "readout-fic1122-pv", "readout-fic1122-sp", "status-fic1122-mode", "alarm-fic1122", "status-fv1122", "readout-ti1164", "alarm-ti1164", "readout-fi1132", "readout-fic1124-pv", "readout-fic1124-sp", "status-fic1124-mode", "alarm-fic1124", "status-fv1124", "readout-ti1165", "alarm-ti1165", "readout-fi1133", "readout-ti1110", "readout-ti1111", "readout-ti1112", "readout-ti1113", "readout-ti1114", "readout-ti1115", "readout-ti1116", "readout-ti1117", "readout-ti1118", "readout-ti1119", "readout-ti1120", "readout-ti1121", "readout-ti1122", "readout-ti1123", "readout-ti1124", "readout-ti1125", "readout-ti1126", "readout-ti1127", "readout-ti1128", "readout-ti1129", "readout-ti1130", "readout-ti1131", "readout-ti1132", "readout-ti1133", "readout-ti1134", "readout-ti1135", "readout-ti1136", "readout-ti1137", "readout-ti1138", "readout-ti1139", "readout-ti1140", "readout-ti1141", "readout-ti1142", "readout-ti1143", "readout-ti1144", "readout-ti1145", "readout-ti1146", "readout-ti1147", "readout-ti1148", "readout-ti1149", "readout-ti1150", "readout-ti1151", "readout-ti1152", "readout-ti1153", "readout-ti1154", "readout-ti1155", "readout-ti1156", "readout-ti1157", "status-tshh1110", "status-tshh1122", "status-tshh1134", "status-tshh1146", "readout-calc1101", "readout-calc1102", "readout-calc1103", "readout-calc1104", "readout-wabt-comb"]}, {"name": "Labels", "locked": false, "visible": true, "elements": ["label-screen-title", "label-reactor", "label-bed1", "label-bed2", "label-bed3", "label-bed4", "label-quench", "label-calc-row"]}], "shapes": [{"scale": {"x": 1.2, "y": 1.8}, "mirror": "none", "variant": "opt1", "position": {"x": 960, "y": 400}, "rotation": 0, "shape_id": "reactor", "element_id": "reactor-r2501", "configuration": "base", "composable_parts": []}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 750, "y": 280}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-fv1120", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attachment": "stem"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 750, "y": 380}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-fv1122", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attachment": "stem"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 750, "y": 480}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-fv1124", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attachment": "stem"}]}], "bindings": {"alarm-ai1101": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-AI-1101.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ai1102": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-AI-1102.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ai1103": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-AI-1103.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pi1101": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PI-1101.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ti1163": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-TI-1163.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ti1164": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-TI-1164.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ti1165": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-TI-1165.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "bar-wabt1101": {"mapping": {"type": "analog_bar", "range_hi": 760, "range_lo": 650}, "attribute": "fill", "point_tag": "25-WABT-1101.PV", "source_hint": "SimBLAH-OPC"}, "alarm-fic1120": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-FIC-1120.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-fic1122": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-FIC-1122.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-fic1124": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-FIC-1124.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pdi1101": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PDI-1101.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pdi1102": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PDI-1102.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pdi1103": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PDI-1103.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pdi1104": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PDI-1104.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pdi1105": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PDI-1105.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pdi1106": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PDI-1106.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-tic1101": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-TIC-1101.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "status-fv1120": {"mapping": {"type": "state_class", "states": {"0": "CLOSED", "1": "OPEN"}}, "attribute": "class", "point_tag": "25-FV-1120.POS", "source_hint": "SimBLAH-OPC"}, "status-fv1122": {"mapping": {"type": "state_class", "states": {"0": "CLOSED", "1": "OPEN"}}, "attribute": "class", "point_tag": "25-FV-1122.POS", "source_hint": "SimBLAH-OPC"}, "status-fv1124": {"mapping": {"type": "state_class", "states": {"0": "CLOSED", "1": "OPEN"}}, "attribute": "class", "point_tag": "25-FV-1124.POS", "source_hint": "SimBLAH-OPC"}, "alarm-h2pp1101": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-H2PP-1101.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "readout-ai1101": {"mapping": {"type": "text", "format": "%.2f", "suffix": " ppm"}, "attribute": "text", "point_tag": "25-AI-1101.PV", "source_hint": "SimBLAH-OPC"}, "readout-ai1102": {"mapping": {"type": "text", "format": "%.2f", "suffix": " ppm"}, "attribute": "text", "point_tag": "25-AI-1102.PV", "source_hint": "SimBLAH-OPC"}, "readout-ai1103": {"mapping": {"type": "text", "format": "%.2f", "suffix": " ppm"}, "attribute": "text", "point_tag": "25-AI-1103.PV", "source_hint": "SimBLAH-OPC"}, "readout-fi1131": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FI-1131.PV", "source_hint": "SimBLAH-OPC"}, "readout-fi1132": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FI-1132.PV", "source_hint": "SimBLAH-OPC"}, "readout-fi1133": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FI-1133.PV", "source_hint": "SimBLAH-OPC"}, "readout-pi1101": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-1101.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1110": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1110.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1111": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1111.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1112": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1112.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1113": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1113.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1114": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1114.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1115": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1115.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1116": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1116.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1117": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1117.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1118": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1118.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1119": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1119.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1120": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1120.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1121": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1121.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1122": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1122.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1123": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1123.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1124": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1124.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1125": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1125.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1126": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1126.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1127": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1127.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1128": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1128.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1129": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1129.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1130": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1130.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1131": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1131.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1132": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1132.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1133": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1133.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1134": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1134.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1135": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1135.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1136": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1136.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1137": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1137.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1138": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1138.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1139": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1139.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1140": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1140.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1141": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1141.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1142": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1142.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1143": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1143.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1144": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1144.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1145": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1145.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1146": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1146.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1147": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1147.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1148": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1148.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1149": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1149.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1150": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1150.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1151": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1151.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1152": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1152.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1153": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1153.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1154": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1154.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1155": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1155.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1156": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1156.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1157": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1157.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1160": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1160.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1161": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1161.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1162": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1162.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1163": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1163.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1164": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1164.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1165": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1165.PV", "source_hint": "SimBLAH-OPC"}, "readout-pdi1101": {"mapping": {"type": "text", "format": "%.2f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PDI-1101.PV", "source_hint": "SimBLAH-OPC"}, "readout-pdi1102": {"mapping": {"type": "text", "format": "%.2f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PDI-1102.PV", "source_hint": "SimBLAH-OPC"}, "readout-pdi1103": {"mapping": {"type": "text", "format": "%.2f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PDI-1103.PV", "source_hint": "SimBLAH-OPC"}, "readout-pdi1104": {"mapping": {"type": "text", "format": "%.2f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PDI-1104.PV", "source_hint": "SimBLAH-OPC"}, "readout-pdi1105": {"mapping": {"type": "text", "format": "%.2f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PDI-1105.PV", "source_hint": "SimBLAH-OPC"}, "readout-pdi1106": {"mapping": {"type": "text", "format": "%.2f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PDI-1106.PV", "source_hint": "SimBLAH-OPC"}, "status-pshh1101": {"mapping": {"type": "state_class", "states": {"0": "NORMAL", "1": "TRIP"}}, "attribute": "class", "point_tag": "25-PSHH-1101.PV", "source_hint": "SimBLAH-OPC"}, "status-tshh1110": {"mapping": {"type": "state_class", "states": {"0": "NORMAL", "1": "TRIP"}}, "attribute": "class", "point_tag": "25-TSHH-1110.PV", "source_hint": "SimBLAH-OPC"}, "status-tshh1122": {"mapping": {"type": "state_class", "states": {"0": "NORMAL", "1": "TRIP"}}, "attribute": "class", "point_tag": "25-TSHH-1122.PV", "source_hint": "SimBLAH-OPC"}, "status-tshh1134": {"mapping": {"type": "state_class", "states": {"0": "NORMAL", "1": "TRIP"}}, "attribute": "class", "point_tag": "25-TSHH-1134.PV", "source_hint": "SimBLAH-OPC"}, "status-tshh1146": {"mapping": {"type": "state_class", "states": {"0": "NORMAL", "1": "TRIP"}}, "attribute": "class", "point_tag": "25-TSHH-1146.PV", "source_hint": "SimBLAH-OPC"}, "readout-calc1101": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-CALC-1101.PV", "source_hint": "SimBLAH-OPC"}, "readout-calc1102": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-CALC-1102.PV", "source_hint": "SimBLAH-OPC"}, "readout-calc1103": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-CALC-1103.PV", "source_hint": "SimBLAH-OPC"}, "readout-calc1104": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-CALC-1104.PV", "source_hint": "SimBLAH-OPC"}, "readout-h2pp1101": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-H2PP-1101.PV", "source_hint": "SimBLAH-OPC"}, "readout-h2pp1102": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-H2PP-1102.PV", "source_hint": "SimBLAH-OPC"}, "readout-wabt1101": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-WABT-1101.PV", "source_hint": "SimBLAH-OPC"}, "readout-wabt-comb": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-WABT-COMB.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic1120-pv": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FIC-1120.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic1120-sp": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FIC-1120.SP", "source_hint": "SimBLAH-OPC"}, "readout-fic1122-pv": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FIC-1122.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic1122-sp": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FIC-1122.SP", "source_hint": "SimBLAH-OPC"}, "readout-fic1124-pv": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FIC-1124.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic1124-sp": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FIC-1124.SP", "source_hint": "SimBLAH-OPC"}, "readout-tic1101-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TIC-1101.PV", "source_hint": "SimBLAH-OPC"}, "readout-tic1101-sp": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TIC-1101.SP", "source_hint": "SimBLAH-OPC"}, "readout-tic1121-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TIC-1121.PV", "source_hint": "SimBLAH-OPC"}, "status-fic1120-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO"}}, "attribute": "class", "point_tag": "25-FIC-1120.MODE", "source_hint": "SimBLAH-OPC"}, "status-fic1122-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO"}}, "attribute": "class", "point_tag": "25-FIC-1122.MODE", "source_hint": "SimBLAH-OPC"}, "status-fic1124-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO"}}, "attribute": "class", "point_tag": "25-FIC-1124.MODE", "source_hint": "SimBLAH-OPC"}, "status-tic1101-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-TIC-1101.MODE", "source_hint": "SimBLAH-OPC"}}, "metadata": {"tags": ["hcu", "unit25", "reactor", "pretreater", "r2501", "quench", "beds"], "width": 1920, "height": 1080, "viewBox": "0 0 1920 1080", "description": "4-bed pretreater reactor R-2501 with interbed quench system, full bed temperature grids, and wall thermocouples.", "background_color": "#09090B"}, "annotations": [{"fill": "#E5E5E5", "font": "18px bold", "type": "text", "content": "UNIT 25 — PRETREATER REACTOR R-2501", "position": {"x": 960, "y": 30}, "element_id": "label-screen-title"}, {"fill": "#A1A1AA", "font": "12px 600", "type": "text", "content": "R-2501", "position": {"x": 960, "y": 800}, "element_id": "label-reactor"}, {"fill": "#71717A", "font": "10px normal", "type": "text", "content": "BED 1", "position": {"x": 1240, "y": 175}, "element_id": "label-bed1"}, {"fill": "#71717A", "font": "10px normal", "type": "text", "content": "BED 2", "position": {"x": 1240, "y": 335}, "element_id": "label-bed2"}, {"fill": "#71717A", "font": "10px normal", "type": "text", "content": "BED 3", "position": {"x": 1240, "y": 455}, "element_id": "label-bed3"}, {"fill": "#71717A", "font": "10px normal", "type": "text", "content": "BED 4", "position": {"x": 1240, "y": 575}, "element_id": "label-bed4"}, {"fill": "#A1A1AA", "font": "12px 600", "type": "text", "content": "Quench System", "position": {"x": 640, "y": 150}, "element_id": "label-quench"}, {"fill": "#71717A", "font": "10px normal", "type": "text", "content": "Calculated Values", "position": {"x": 700, "y": 865}, "element_id": "label-calc-row"}, {"type": "line", "stroke": "#3F3F46", "content": null, "position": {"x": 0, "y": 855}, "element_id": "divider-calc", "end_position": {"x": 1920, "y": 855}, "stroke_width": 1}, {"type": "line", "stroke": "#3F3F46", "content": null, "position": {"x": 0, "y": 60}, "element_id": "divider-title", "end_position": {"x": 1920, "y": 60}, "stroke_width": 1}]}'::jsonb,
  NULL,
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  svg_data = EXCLUDED.svg_data,
  metadata = EXCLUDED.metadata,
  bindings = EXCLUDED.bindings;

-- HCU Reactor R-2502 (Cracker)
INSERT INTO design_objects (id, name, type, svg_data, bindings, metadata, created_by)
VALUES (
  '88b9bbfb-3808-48f4-9b92-76dc75347156',
  'HCU Reactor R-2502 (Cracker)',
  'graphic',
  $svg$<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><rect width="100%" height="100%" fill="#09090B"/>
<path id="pipe-feed-in" d="M 960 50 L 960 430" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Feed from R-2501</text>
<path id="pipe-reactor-out" d="M 960 720 L 1920 720" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">To HP Sep</text>
<path id="pipe-quench-header" d="M 680 150 L 680 550" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Quench H2 Header</text>
<path id="pipe-quench-ib1" d="M 680 320 L 750 320" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-quench-ib1-out" d="M 750 320 L 900 320" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-quench-ib2" d="M 680 440 L 750 440" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-quench-ib2-out" d="M 750 440 L 900 440" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text x="960" y="30" font-family="monospace" font-size="14" fill="#E4E4E7">UNIT 25 — CRACKING REACTOR R-2502</text>
<text x="960" y="800" font-family="monospace" font-size="14" fill="#E4E4E7">R-2502</text>
<text x="1240" y="235" font-family="monospace" font-size="14" fill="#E4E4E7">BED 1</text>
<text x="1240" y="375" font-family="monospace" font-size="14" fill="#E4E4E7">BED 2</text>
<text x="1240" y="505" font-family="monospace" font-size="14" fill="#E4E4E7">BED 3</text>
<text x="640" y="150" font-family="monospace" font-size="14" fill="#E4E4E7">Quench System</text>
<text x="700" y="865" font-family="monospace" font-size="14" fill="#E4E4E7">Calculated Values</text>
<g id="reactor-r2502" transform="translate(960.0,430.0) scale(1.9200,2.5600)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="68" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-fv1220" transform="translate(750.0,320.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-fv1222" transform="translate(750.0,440.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g></svg>$svg$,
  '{"name": "HCU Reactor R-2502 (Cracker)", "type": "graphic", "pipes": [{"label": "Feed from R-2501", "path_data": "M 960 50 L 960 430", "element_id": "pipe-feed-in", "service_type": "process", "stroke_width": 2.0}, {"label": "To HP Sep", "path_data": "M 960 720 L 1920 720", "element_id": "pipe-reactor-out", "service_type": "process", "stroke_width": 2.0}, {"label": "Quench H2 Header", "path_data": "M 680 150 L 680 550", "element_id": "pipe-quench-header", "service_type": "gas_vapor", "stroke_width": 1.5}, {"label": null, "path_data": "M 680 320 L 750 320", "element_id": "pipe-quench-ib1", "service_type": "gas_vapor", "stroke_width": 1.5}, {"label": null, "path_data": "M 750 320 L 900 320", "element_id": "pipe-quench-ib1-out", "service_type": "gas_vapor", "stroke_width": 1.5}, {"label": null, "path_data": "M 680 440 L 750 440", "element_id": "pipe-quench-ib2", "service_type": "gas_vapor", "stroke_width": 1.5}, {"label": null, "path_data": "M 750 440 L 900 440", "element_id": "pipe-quench-ib2-out", "service_type": "gas_vapor", "stroke_width": 1.5}], "layers": [{"name": "Background", "locked": true, "visible": true, "elements": ["pipe-feed-in", "pipe-reactor-out", "pipe-quench-header", "pipe-quench-ib1", "pipe-quench-ib1-out", "pipe-quench-ib2", "pipe-quench-ib2-out", "divider-calc", "divider-title"]}, {"name": "Equipment", "locked": false, "visible": true, "elements": ["reactor-r2502", "cv-fv1220", "cv-fv1222"]}, {"name": "Instruments", "locked": false, "visible": true, "elements": ["readout-tic1201-pv", "readout-tic1201-sp", "status-tic1201-mode", "alarm-tic1201", "readout-pi1201", "alarm-pi1201", "bar-wabt1201", "readout-wabt1201", "readout-conv2501", "readout-h2pp1201", "alarm-h2pp1201", "readout-pdi1201", "alarm-pdi1201", "readout-pdi1202", "alarm-pdi1202", "readout-pdi1203", "alarm-pdi1203", "readout-pdi1204", "alarm-pdi1204", "readout-pdi1205", "alarm-pdi1205", "readout-ti1250", "readout-ti1251", "readout-ti1252", "readout-ai1201", "alarm-ai1201", "status-pshh1201", "readout-fic1220-pv", "readout-fic1220-sp", "status-fic1220-mode", "alarm-fic1220", "status-fv1220", "readout-ti1254", "alarm-ti1254", "readout-fi1231", "readout-fic1222-pv", "readout-fic1222-sp", "status-fic1222-mode", "alarm-fic1222", "status-fv1222", "readout-ti1255", "alarm-ti1255", "readout-fi1232", "readout-ti1210", "readout-ti1211", "readout-ti1212", "readout-ti1213", "readout-ti1214", "readout-ti1215", "readout-ti1216", "readout-ti1217", "readout-ti1218", "readout-ti1219", "readout-ti1220", "readout-ti1221", "readout-ti1222", "readout-ti1223", "readout-ti1224", "readout-ti1225", "readout-ti1226", "readout-ti1227", "readout-ti1228", "readout-ti1229", "readout-ti1230", "readout-ti1231", "readout-ti1232", "readout-ti1233", "readout-ti1234", "readout-ti1235", "readout-ti1236", "readout-ti1237", "readout-ti1238", "readout-ti1239", "readout-ti1240", "readout-ti1241", "readout-ti1242", "readout-ti1243", "readout-ti1244", "readout-ti1245", "status-tshh1210", "status-tshh1222", "status-tshh1234", "readout-calc1201", "readout-calc1202", "readout-calc1203", "readout-ti1202", "readout-ti1208"]}, {"name": "Labels", "locked": false, "visible": true, "elements": ["label-screen-title", "label-reactor", "label-bed1", "label-bed2", "label-bed3", "label-quench", "label-calc-row"]}], "shapes": [{"scale": {"x": 1.2, "y": 1.6}, "mirror": "none", "variant": "opt1", "position": {"x": 960, "y": 430}, "rotation": 0, "shape_id": "reactor", "element_id": "reactor-r2502", "configuration": "base", "composable_parts": []}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 750, "y": 320}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-fv1220", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attachment": "stem"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 750, "y": 440}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-fv1222", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attachment": "stem"}]}], "bindings": {"alarm-ai1201": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-AI-1201.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pi1201": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PI-1201.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ti1254": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-TI-1254.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ti1255": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-TI-1255.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "bar-wabt1201": {"mapping": {"type": "analog_bar", "range_hi": 780, "range_lo": 650}, "attribute": "fill", "point_tag": "25-WABT-1201.PV", "source_hint": "SimBLAH-OPC"}, "alarm-fic1220": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-FIC-1220.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-fic1222": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-FIC-1222.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pdi1201": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PDI-1201.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pdi1202": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PDI-1202.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pdi1203": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PDI-1203.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pdi1204": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PDI-1204.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pdi1205": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PDI-1205.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-tic1201": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-TIC-1201.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "status-fv1220": {"mapping": {"type": "state_class", "states": {"0": "CLOSED", "1": "OPEN"}}, "attribute": "class", "point_tag": "25-FV-1220.POS", "source_hint": "SimBLAH-OPC"}, "status-fv1222": {"mapping": {"type": "state_class", "states": {"0": "CLOSED", "1": "OPEN"}}, "attribute": "class", "point_tag": "25-FV-1222.POS", "source_hint": "SimBLAH-OPC"}, "alarm-h2pp1201": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-H2PP-1201.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "readout-ai1201": {"mapping": {"type": "text", "format": "%.2f", "suffix": " mol%"}, "attribute": "text", "point_tag": "25-AI-1201.PV", "source_hint": "SimBLAH-OPC"}, "readout-fi1231": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FI-1231.PV", "source_hint": "SimBLAH-OPC"}, "readout-fi1232": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FI-1232.PV", "source_hint": "SimBLAH-OPC"}, "readout-pi1201": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-1201.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1202": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1202.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1208": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1208.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1210": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1210.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1211": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1211.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1212": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1212.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1213": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1213.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1214": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1214.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1215": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1215.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1216": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1216.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1217": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1217.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1218": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1218.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1219": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1219.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1220": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1220.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1221": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1221.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1222": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1222.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1223": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1223.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1224": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1224.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1225": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1225.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1226": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1226.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1227": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1227.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1228": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1228.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1229": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1229.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1230": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1230.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1231": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1231.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1232": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1232.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1233": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1233.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1234": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1234.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1235": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1235.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1236": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1236.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1237": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1237.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1238": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1238.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1239": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1239.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1240": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1240.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1241": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1241.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1242": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1242.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1243": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1243.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1244": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1244.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1245": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1245.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1250": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1250.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1251": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1251.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1252": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1252.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1254": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1254.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1255": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1255.PV", "source_hint": "SimBLAH-OPC"}, "readout-pdi1201": {"mapping": {"type": "text", "format": "%.2f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PDI-1201.PV", "source_hint": "SimBLAH-OPC"}, "readout-pdi1202": {"mapping": {"type": "text", "format": "%.2f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PDI-1202.PV", "source_hint": "SimBLAH-OPC"}, "readout-pdi1203": {"mapping": {"type": "text", "format": "%.2f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PDI-1203.PV", "source_hint": "SimBLAH-OPC"}, "readout-pdi1204": {"mapping": {"type": "text", "format": "%.2f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PDI-1204.PV", "source_hint": "SimBLAH-OPC"}, "readout-pdi1205": {"mapping": {"type": "text", "format": "%.2f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PDI-1205.PV", "source_hint": "SimBLAH-OPC"}, "status-pshh1201": {"mapping": {"type": "state_class", "states": {"0": "NORMAL", "1": "TRIP"}}, "attribute": "class", "point_tag": "25-PSHH-1201.PV", "source_hint": "SimBLAH-OPC"}, "status-tshh1210": {"mapping": {"type": "state_class", "states": {"0": "NORMAL", "1": "TRIP"}}, "attribute": "class", "point_tag": "25-TSHH-1210.PV", "source_hint": "SimBLAH-OPC"}, "status-tshh1222": {"mapping": {"type": "state_class", "states": {"0": "NORMAL", "1": "TRIP"}}, "attribute": "class", "point_tag": "25-TSHH-1222.PV", "source_hint": "SimBLAH-OPC"}, "status-tshh1234": {"mapping": {"type": "state_class", "states": {"0": "NORMAL", "1": "TRIP"}}, "attribute": "class", "point_tag": "25-TSHH-1234.PV", "source_hint": "SimBLAH-OPC"}, "readout-calc1201": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-CALC-1201.PV", "source_hint": "SimBLAH-OPC"}, "readout-calc1202": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-CALC-1202.PV", "source_hint": "SimBLAH-OPC"}, "readout-calc1203": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-CALC-1203.PV", "source_hint": "SimBLAH-OPC"}, "readout-conv2501": {"mapping": {"type": "text", "format": "%.1f", "suffix": " vol%"}, "attribute": "text", "point_tag": "25-CONV-2501.PV", "source_hint": "SimBLAH-OPC"}, "readout-h2pp1201": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-H2PP-1201.PV", "source_hint": "SimBLAH-OPC"}, "readout-wabt1201": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-WABT-1201.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic1220-pv": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FIC-1220.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic1220-sp": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FIC-1220.SP", "source_hint": "SimBLAH-OPC"}, "readout-fic1222-pv": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FIC-1222.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic1222-sp": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FIC-1222.SP", "source_hint": "SimBLAH-OPC"}, "readout-tic1201-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TIC-1201.PV", "source_hint": "SimBLAH-OPC"}, "readout-tic1201-sp": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TIC-1201.SP", "source_hint": "SimBLAH-OPC"}, "status-fic1220-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO"}}, "attribute": "class", "point_tag": "25-FIC-1220.MODE", "source_hint": "SimBLAH-OPC"}, "status-fic1222-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO"}}, "attribute": "class", "point_tag": "25-FIC-1222.MODE", "source_hint": "SimBLAH-OPC"}, "status-tic1201-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-TIC-1201.MODE", "source_hint": "SimBLAH-OPC"}}, "metadata": {"tags": ["hcu", "unit25", "reactor", "cracker", "r2502", "quench", "beds"], "width": 1920, "height": 1080, "viewBox": "0 0 1920 1080", "description": "3-bed hydrocracking reactor R-2502 with interbed quench system and full bed temperature grids.", "background_color": "#09090B"}, "annotations": [{"fill": "#E5E5E5", "font": "18px bold", "type": "text", "content": "UNIT 25 — CRACKING REACTOR R-2502", "position": {"x": 960, "y": 30}, "element_id": "label-screen-title"}, {"fill": "#A1A1AA", "font": "12px 600", "type": "text", "content": "R-2502", "position": {"x": 960, "y": 800}, "element_id": "label-reactor"}, {"fill": "#71717A", "font": "10px normal", "type": "text", "content": "BED 1", "position": {"x": 1240, "y": 235}, "element_id": "label-bed1"}, {"fill": "#71717A", "font": "10px normal", "type": "text", "content": "BED 2", "position": {"x": 1240, "y": 375}, "element_id": "label-bed2"}, {"fill": "#71717A", "font": "10px normal", "type": "text", "content": "BED 3", "position": {"x": 1240, "y": 505}, "element_id": "label-bed3"}, {"fill": "#A1A1AA", "font": "12px 600", "type": "text", "content": "Quench System", "position": {"x": 640, "y": 150}, "element_id": "label-quench"}, {"fill": "#71717A", "font": "10px normal", "type": "text", "content": "Calculated Values", "position": {"x": 700, "y": 865}, "element_id": "label-calc-row"}, {"type": "line", "stroke": "#3F3F46", "content": null, "position": {"x": 0, "y": 855}, "element_id": "divider-calc", "end_position": {"x": 1920, "y": 855}, "stroke_width": 1}, {"type": "line", "stroke": "#3F3F46", "content": null, "position": {"x": 0, "y": 60}, "element_id": "divider-title", "end_position": {"x": 1920, "y": 60}, "stroke_width": 1}]}'::jsonb,
  NULL,
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  svg_data = EXCLUDED.svg_data,
  metadata = EXCLUDED.metadata,
  bindings = EXCLUDED.bindings;

-- HCU Recycle Gas Compressor
INSERT INTO design_objects (id, name, type, svg_data, bindings, metadata, created_by)
VALUES (
  'ea78e79a-c6cb-4219-8c32-85e11707eae7',
  'HCU Recycle Gas Compressor',
  'graphic',
  $svg$<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><rect width="100%" height="100%" fill="#09090B"/>
<path id="pipe-rg-in" d="M 100 400 L 250 400" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">RG from HHPS</text>
<path id="pipe-v2506-absorber" d="M 300 400 L 400 400" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-absorber-k2501" d="M 550 350 L 700 350" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-k2501-out" d="M 850 400 L 1100 400" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">To Reactors</text>
<path id="pipe-lean-amine" d="M 300 220 L 380 250" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Lean Amine</text>
<path id="pipe-lean-amine-col" d="M 380 200 L 450 200" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-rich-amine-out" d="M 450 700 L 300 700" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Rich Amine Return</text>
<path id="pipe-steam-turbine" d="M 850 550 L 850 600" stroke="#E4E4E7" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">HP Steam</text>
<path id="pipe-exhaust-steam" d="M 850 700 L 850 750" stroke="#E4E4E7" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Exhaust Steam</text>
<path id="pipe-antisurge" d="M 850 400 L 1050 350" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-antisurge-back" d="M 950 360 L 750 360" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-h2-makeup" d="M 1200 350 L 1400 400" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">H2 from H2 Plant</text>
<path id="pipe-k2502-out" d="M 1400 400 L 1600 400" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">To Recycle Header</text>
<text x="960" y="30" font-family="monospace" font-size="14" fill="#E4E4E7">UNIT 25 — RECYCLE GAS SYSTEM / COMPRESSOR K-2501</text>
<text x="850" y="470" font-family="monospace" font-size="14" fill="#E4E4E7">K-2501</text>
<text x="1400" y="460" font-family="monospace" font-size="14" fill="#E4E4E7">K-2502 Makeup</text>
<text x="450" y="650" font-family="monospace" font-size="14" fill="#E4E4E7">C-2507 Amine Absorber</text>
<text x="250" y="450" font-family="monospace" font-size="14" fill="#E4E4E7">V-2506 HP KO</text>
<text x="750" y="210" font-family="monospace" font-size="14" fill="#E4E4E7">Seal Oil Tank</text>
<text x="820" y="800" font-family="monospace" font-size="14" fill="#E4E4E7">Lube/Seal Oil Console</text>
<text x="820" y="600" font-family="monospace" font-size="14" fill="#E4E4E7">Steam Turbine Driver</text>
<text x="1100" y="420" font-family="monospace" font-size="14" fill="#E4E4E7">Vibration / Mechanical</text>
<g id="vessel-v2506" transform="translate(250.0,400.0) scale(1.6000,1.6000)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="column-c2507" transform="translate(450.0,350.0) scale(1.4545,2.3273)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,10 A12,5 0 0,1 34,10"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="10" x2="10" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="34" y1="10" x2="34" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,110 A12,5 0 0,0 34,110"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="compressor-k2501" transform="translate(850.0,400.0) scale(1.7920,1.7920)">
  <g class="io-shape-body">
    <circle class="io-stateful" cx="25" cy="25" r="20"
            fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="12.1" y1="9.7" x2="43.1" y2="16.5"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="12.1" y1="40.3" x2="43.1" y2="33.5"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="vessel-seal-tank" transform="translate(750.0,150.0) scale(1.2800,1.2800)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="compressor-k2502" transform="translate(1400.0,400.0) scale(1.2800,1.2800)">
  <g class="io-shape-body">
    <circle class="io-stateful" cx="25" cy="25" r="20"
            fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="12.1" y1="9.7" x2="43.1" y2="16.5"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="12.1" y1="40.3" x2="43.1" y2="33.5"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-fic1411" transform="translate(380.0,250.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-fic2010" transform="translate(950.0,350.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g></svg>$svg$,
  '{"name": "HCU Recycle Gas Compressor", "type": "graphic", "pipes": [{"label": "RG from HHPS", "path_data": "M 100 400 L 250 400", "element_id": "pipe-rg-in", "service_type": "gas_vapor", "stroke_width": 2.0}, {"label": null, "path_data": "M 300 400 L 400 400", "element_id": "pipe-v2506-absorber", "service_type": "gas_vapor", "stroke_width": 2.0}, {"label": null, "path_data": "M 550 350 L 700 350", "element_id": "pipe-absorber-k2501", "service_type": "gas_vapor", "stroke_width": 2.0}, {"label": "To Reactors", "path_data": "M 850 400 L 1100 400", "element_id": "pipe-k2501-out", "service_type": "gas_vapor", "stroke_width": 2.0}, {"label": "Lean Amine", "path_data": "M 300 220 L 380 250", "element_id": "pipe-lean-amine", "service_type": "chemical", "stroke_width": 1.5}, {"label": null, "path_data": "M 380 200 L 450 200", "element_id": "pipe-lean-amine-col", "service_type": "chemical", "stroke_width": 1.5}, {"label": "Rich Amine Return", "path_data": "M 450 700 L 300 700", "element_id": "pipe-rich-amine-out", "service_type": "chemical", "stroke_width": 1.5}, {"label": "HP Steam", "path_data": "M 850 550 L 850 600", "element_id": "pipe-steam-turbine", "service_type": "steam", "stroke_width": 1.5}, {"label": "Exhaust Steam", "path_data": "M 850 700 L 850 750", "element_id": "pipe-exhaust-steam", "service_type": "steam", "stroke_width": 1.5}, {"label": null, "path_data": "M 850 400 L 1050 350", "element_id": "pipe-antisurge", "service_type": "gas_vapor", "stroke_width": 1.5}, {"label": null, "path_data": "M 950 360 L 750 360", "element_id": "pipe-antisurge-back", "service_type": "gas_vapor", "stroke_width": 1.5}, {"label": "H2 from H2 Plant", "path_data": "M 1200 350 L 1400 400", "element_id": "pipe-h2-makeup", "service_type": "gas_vapor", "stroke_width": 2.0}, {"label": "To Recycle Header", "path_data": "M 1400 400 L 1600 400", "element_id": "pipe-k2502-out", "service_type": "gas_vapor", "stroke_width": 2.0}], "layers": [{"name": "Background", "locked": true, "visible": true, "elements": ["pipe-rg-in", "pipe-v2506-absorber", "pipe-absorber-k2501", "pipe-k2501-out", "pipe-lean-amine", "pipe-lean-amine-col", "pipe-rich-amine-out", "pipe-steam-turbine", "pipe-exhaust-steam", "pipe-antisurge", "pipe-antisurge-back", "pipe-h2-makeup", "pipe-k2502-out", "divider-title", "divider-vib"]}, {"name": "Equipment", "locked": false, "visible": true, "elements": ["vessel-v2506", "column-c2507", "compressor-k2501", "vessel-seal-tank", "compressor-k2502", "cv-fic1411", "cv-fic2010"]}, {"name": "Instruments", "locked": false, "visible": true, "elements": ["readout-ai1401", "alarm-ai1401", "readout-fi1401", "readout-li2020", "gauge-li2020", "readout-lic1410-pv", "gauge-lic1410", "readout-fic1411-pv", "readout-fic1411-sp", "status-fic1411-mode", "alarm-fic1411", "readout-ti1411", "readout-fi1412", "readout-ti1413", "readout-ai1402", "alarm-ai1402", "readout-ai1403", "readout-sic2001-pv", "readout-sic2001-sp", "status-sic2001-mode", "alarm-sic2001", "readout-pi2001", "alarm-pi2001", "readout-pi2002", "alarm-pi2002", "readout-ti2001", "readout-ti2002", "alarm-ti2002", "readout-fi2003", "readout-fi2004", "readout-pi2004", "alarm-pi2004", "readout-ti2006", "alarm-ti2006", "readout-calc2001", "readout-calc2002", "readout-calc2003", "alarm-calc2003", "status-sy2001", "status-zi2031", "alarm-k2501", "readout-vt2001-1x", "alarm-vt2001-1x", "readout-vt2001-1y", "alarm-vt2001-1y", "readout-vt2001-2x", "alarm-vt2001-2x", "readout-vt2001-2y", "alarm-vt2001-2y", "readout-zt2001-ax", "alarm-zt2001-ax", "readout-zt2001-bx", "alarm-zt2001-bx", "readout-zt2001-by", "alarm-zt2001-by", "readout-ti2003", "alarm-ti2003", "readout-ti2004", "alarm-ti2004", "readout-ti2007", "alarm-ti2007", "readout-ti2008", "status-vshh2001", "status-tshh2003", "readout-fi2001", "alarm-fi2001", "readout-pi2003", "alarm-pi2003", "readout-ti2005", "alarm-ti2005", "readout-fi2002", "alarm-fi2002", "readout-pi2005", "alarm-pi2005", "readout-li2030", "gauge-li2030", "status-psll2003", "readout-ii2001", "readout-pi2032", "alarm-pi2032", "readout-ti2032", "readout-pi2033", "alarm-pi2033", "readout-fic2010-pv", "readout-fic2010-sp", "status-fic2010-mode", "alarm-fic2010", "status-zi2010", "readout-fi2010", "readout-pi2030", "alarm-pi2030", "readout-pi2031", "alarm-pi2031", "readout-ti2031", "readout-ii2030", "alarm-ii2030", "readout-fic1501-pv", "alarm-fic1501", "status-k2501-run", "status-k2502-run", "alarm-k2502"]}, {"name": "Labels", "locked": false, "visible": true, "elements": ["label-screen-title", "label-k2501", "label-k2502", "label-c2507", "label-v2506", "label-seal-tank", "label-lube-oil", "label-turbine", "label-vib"]}], "shapes": [{"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 250, "y": 400}, "rotation": 0, "shape_id": "vessel-vertical", "element_id": "vessel-v2506", "configuration": "plain", "composable_parts": []}, {"scale": {"x": 1.0, "y": 1.6}, "mirror": "none", "variant": "opt1", "position": {"x": 450, "y": 350}, "rotation": 0, "shape_id": "column-distillation", "element_id": "column-c2507", "configuration": "trayed-6", "composable_parts": []}, {"scale": {"x": 1.4, "y": 1.4}, "mirror": "none", "variant": "opt1", "position": {"x": 850, "y": 400}, "rotation": 0, "shape_id": "compressor", "element_id": "compressor-k2501", "configuration": null, "composable_parts": []}, {"scale": {"x": 0.8, "y": 0.8}, "mirror": "none", "variant": "opt1", "position": {"x": 750, "y": 150}, "rotation": 0, "shape_id": "vessel-vertical", "element_id": "vessel-seal-tank", "configuration": "plain", "composable_parts": []}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 1400, "y": 400}, "rotation": 0, "shape_id": "compressor", "element_id": "compressor-k2502", "configuration": null, "composable_parts": []}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 380, "y": 250}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-fic1411", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attachment": "stem"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 950, "y": 350}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-fic2010", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attachment": "stem"}]}], "bindings": {"alarm-k2501": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-SIC-2001.PV", "25-PI-2001.PV", "25-PI-2002.PV", "25-CALC-2003.PV", "25-VT-2001-1X.PV", "25-VT-2001-1Y.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-k2502": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PI-2030.PV", "25-PI-2031.PV", "25-II-2030.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ai1401": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-AI-1401.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ai1402": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-AI-1402.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-fi2001": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-FI-2001.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-fi2002": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-FI-2002.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ii2030": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-II-2030.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pi2001": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PI-2001.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pi2002": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PI-2002.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pi2003": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PI-2003.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pi2004": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PI-2004.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pi2005": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PI-2005.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pi2030": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PI-2030.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pi2031": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PI-2031.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pi2032": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PI-2032.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-pi2033": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PI-2033.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ti2002": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-TI-2002.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ti2003": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-TI-2003.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ti2004": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-TI-2004.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ti2005": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-TI-2005.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ti2006": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-TI-2006.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-ti2007": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-TI-2007.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "gauge-li2020": {"mapping": {"type": "fill_gauge", "range_hi": 100, "range_lo": 0, "placement": "vessel_overlay", "fill_direction": "up", "clip_to_shape_id": "vessel-v2506"}, "attribute": "fill", "point_tag": "25-LI-2020.PV", "source_hint": "SimBLAH-OPC"}, "gauge-li2030": {"mapping": {"type": "fill_gauge", "range_hi": 100, "range_lo": 0, "placement": "vessel_overlay", "fill_direction": "up", "clip_to_shape_id": "vessel-seal-tank"}, "attribute": "fill", "point_tag": "25-LI-2030.PV", "source_hint": "SimBLAH-OPC"}, "alarm-fic1411": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-FIC-1411.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-fic1501": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-FIC-1501.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-fic2010": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-FIC-2010.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-sic2001": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-SIC-2001.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "gauge-lic1410": {"mapping": {"type": "fill_gauge", "range_hi": 100, "range_lo": 0, "placement": "vessel_overlay", "fill_direction": "up", "clip_to_shape_id": "column-c2507"}, "attribute": "fill", "point_tag": "25-LIC-1410.PV", "source_hint": "SimBLAH-OPC"}, "status-sy2001": {"mapping": {"type": "state_class", "states": {"0": "STOPPED", "1": "RUNNING"}}, "attribute": "class", "point_tag": "25-SY-2001.PV", "source_hint": "SimBLAH-OPC"}, "status-zi2010": {"mapping": {"type": "state_class", "states": {"0": "CLOSED", "1": "OPEN"}}, "attribute": "class", "point_tag": "25-ZI-2010.PV", "source_hint": "SimBLAH-OPC"}, "status-zi2031": {"mapping": {"type": "state_class", "states": {"0": "CLOSED", "1": "OPEN"}}, "attribute": "class", "point_tag": "25-ZI-2031.PV", "source_hint": "SimBLAH-OPC"}, "alarm-calc2003": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-CALC-2003.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "readout-ai1401": {"mapping": {"type": "text", "format": "%.1f", "suffix": " mol%"}, "attribute": "text", "point_tag": "25-AI-1401.PV", "source_hint": "SimBLAH-OPC"}, "readout-ai1402": {"mapping": {"type": "text", "format": "%.2f", "suffix": " ppm"}, "attribute": "text", "point_tag": "25-AI-1402.PV", "source_hint": "SimBLAH-OPC"}, "readout-ai1403": {"mapping": {"type": "text", "format": "%.2f", "suffix": " mol/mol"}, "attribute": "text", "point_tag": "25-AI-1403.PV", "source_hint": "SimBLAH-OPC"}, "readout-fi1401": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FI-1401.PV", "source_hint": "SimBLAH-OPC"}, "readout-fi1412": {"mapping": {"type": "text", "format": "%.1f", "suffix": " gpm"}, "attribute": "text", "point_tag": "25-FI-1412.PV", "source_hint": "SimBLAH-OPC"}, "readout-fi2001": {"mapping": {"type": "text", "format": "%.1f", "suffix": " gpm"}, "attribute": "text", "point_tag": "25-FI-2001.PV", "source_hint": "SimBLAH-OPC"}, "readout-fi2002": {"mapping": {"type": "text", "format": "%.1f", "suffix": " gpm"}, "attribute": "text", "point_tag": "25-FI-2002.PV", "source_hint": "SimBLAH-OPC"}, "readout-fi2003": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FI-2003.PV", "source_hint": "SimBLAH-OPC"}, "readout-fi2004": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FI-2004.PV", "source_hint": "SimBLAH-OPC"}, "readout-fi2010": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FI-2010.PV", "source_hint": "SimBLAH-OPC"}, "readout-ii2001": {"mapping": {"type": "text", "format": "%.1f", "suffix": " klb/hr"}, "attribute": "text", "point_tag": "25-II-2001.PV", "source_hint": "SimBLAH-OPC"}, "readout-ii2030": {"mapping": {"type": "text", "format": "%.0f", "suffix": " A"}, "attribute": "text", "point_tag": "25-II-2030.PV", "source_hint": "SimBLAH-OPC"}, "readout-li2020": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LI-2020.PV", "source_hint": "SimBLAH-OPC"}, "readout-li2030": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LI-2030.PV", "source_hint": "SimBLAH-OPC"}, "readout-pi2001": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-2001.PV", "source_hint": "SimBLAH-OPC"}, "readout-pi2002": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-2002.PV", "source_hint": "SimBLAH-OPC"}, "readout-pi2003": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-2003.PV", "source_hint": "SimBLAH-OPC"}, "readout-pi2004": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-2004.PV", "source_hint": "SimBLAH-OPC"}, "readout-pi2005": {"mapping": {"type": "text", "format": "%.2f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-2005.PV", "source_hint": "SimBLAH-OPC"}, "readout-pi2030": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-2030.PV", "source_hint": "SimBLAH-OPC"}, "readout-pi2031": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-2031.PV", "source_hint": "SimBLAH-OPC"}, "readout-pi2032": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-2032.PV", "source_hint": "SimBLAH-OPC"}, "readout-pi2033": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-2033.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1411": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1411.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti1413": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1413.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2001": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2001.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2002": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2002.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2003": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2003.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2004": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2004.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2005": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2005.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2006": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2006.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2007": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2007.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2008": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-TI-2008.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2031": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2031.PV", "source_hint": "SimBLAH-OPC"}, "readout-ti2032": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2032.PV", "source_hint": "SimBLAH-OPC"}, "alarm-vt2001-1x": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-VT-2001-1X.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-vt2001-1y": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-VT-2001-1Y.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-vt2001-2x": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-VT-2001-2X.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-vt2001-2y": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-VT-2001-2Y.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-zt2001-ax": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-ZT-2001-AX.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-zt2001-bx": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-ZT-2001-BX.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-zt2001-by": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-ZT-2001-BY.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "status-psll2003": {"mapping": {"type": "state_class", "states": {"0": "NORMAL", "1": "TRIP"}}, "attribute": "class", "point_tag": "25-PSLL-2003.PV", "source_hint": "SimBLAH-OPC"}, "status-tshh2003": {"mapping": {"type": "state_class", "states": {"0": "NORMAL", "1": "TRIP"}}, "attribute": "class", "point_tag": "25-TSHH-2003.PV", "source_hint": "SimBLAH-OPC"}, "status-vshh2001": {"mapping": {"type": "state_class", "states": {"0": "NORMAL", "1": "TRIP"}}, "attribute": "class", "point_tag": "25-VSHH-2001.PV", "source_hint": "SimBLAH-OPC"}, "readout-calc2001": {"mapping": {"type": "text", "format": "%.0f", "suffix": " ft"}, "attribute": "text", "point_tag": "25-CALC-2001.PV", "source_hint": "SimBLAH-OPC"}, "readout-calc2002": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-CALC-2002.PV", "source_hint": "SimBLAH-OPC"}, "readout-calc2003": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-CALC-2003.PV", "source_hint": "SimBLAH-OPC"}, "status-k2501-run": {"mapping": {"type": "state_class", "states": {"0": "STOPPED", "1": "RUNNING"}}, "attribute": "class", "point_tag": "25-K-2501.RUN", "source_hint": "SimBLAH-OPC"}, "status-k2502-run": {"mapping": {"type": "state_class", "states": {"0": "STOPPED", "1": "RUNNING"}}, "attribute": "class", "point_tag": "25-K-2502.RUN", "source_hint": "SimBLAH-OPC"}, "readout-vt2001-1x": {"mapping": {"type": "text", "format": "%.2f", "suffix": " mil"}, "attribute": "text", "point_tag": "25-VT-2001-1X.PV", "source_hint": "SimBLAH-OPC"}, "readout-vt2001-1y": {"mapping": {"type": "text", "format": "%.2f", "suffix": " mil"}, "attribute": "text", "point_tag": "25-VT-2001-1Y.PV", "source_hint": "SimBLAH-OPC"}, "readout-vt2001-2x": {"mapping": {"type": "text", "format": "%.2f", "suffix": " mil"}, "attribute": "text", "point_tag": "25-VT-2001-2X.PV", "source_hint": "SimBLAH-OPC"}, "readout-vt2001-2y": {"mapping": {"type": "text", "format": "%.2f", "suffix": " mil"}, "attribute": "text", "point_tag": "25-VT-2001-2Y.PV", "source_hint": "SimBLAH-OPC"}, "readout-zt2001-ax": {"mapping": {"type": "text", "format": "%.2f", "suffix": " mil"}, "attribute": "text", "point_tag": "25-ZT-2001-AX.PV", "source_hint": "SimBLAH-OPC"}, "readout-zt2001-bx": {"mapping": {"type": "text", "format": "%.2f", "suffix": " mil"}, "attribute": "text", "point_tag": "25-ZT-2001-BX.PV", "source_hint": "SimBLAH-OPC"}, "readout-zt2001-by": {"mapping": {"type": "text", "format": "%.2f", "suffix": " mil"}, "attribute": "text", "point_tag": "25-ZT-2001-BY.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic1411-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " gpm"}, "attribute": "text", "point_tag": "25-FIC-1411.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic1411-sp": {"mapping": {"type": "text", "format": "%.1f", "suffix": " gpm"}, "attribute": "text", "point_tag": "25-FIC-1411.SP", "source_hint": "SimBLAH-OPC"}, "readout-fic1501-pv": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FIC-1501.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic2010-pv": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FIC-2010.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic2010-sp": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FIC-2010.SP", "source_hint": "SimBLAH-OPC"}, "readout-lic1410-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-1410.PV", "source_hint": "SimBLAH-OPC"}, "readout-sic2001-pv": {"mapping": {"type": "text", "format": "%.0f", "suffix": " rpm"}, "attribute": "text", "point_tag": "25-SIC-2001.PV", "source_hint": "SimBLAH-OPC"}, "readout-sic2001-sp": {"mapping": {"type": "text", "format": "%.0f", "suffix": " rpm"}, "attribute": "text", "point_tag": "25-SIC-2001.SP", "source_hint": "SimBLAH-OPC"}, "status-fic1411-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO"}}, "attribute": "class", "point_tag": "25-FIC-1411.MODE", "source_hint": "SimBLAH-OPC"}, "status-fic2010-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO"}}, "attribute": "class", "point_tag": "25-FIC-2010.MODE", "source_hint": "SimBLAH-OPC"}, "status-sic2001-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO"}}, "attribute": "class", "point_tag": "25-SIC-2001.MODE", "source_hint": "SimBLAH-OPC"}}, "metadata": {"tags": ["hcu", "unit25", "compressor", "k2501", "k2502", "amine", "recycle-gas", "turbine"], "width": 1920, "height": 1080, "viewBox": "0 0 1920 1080", "description": "Recycle gas system — K-2501 centrifugal compressor (steam turbine driven), amine absorber C-2507, HP KO drum V-2506, seal oil tank, and K-2502 makeup compressor.", "background_color": "#09090B"}, "annotations": [{"fill": "#E5E5E5", "font": "18px bold", "type": "text", "content": "UNIT 25 — RECYCLE GAS SYSTEM / COMPRESSOR K-2501", "position": {"x": 960, "y": 30}, "element_id": "label-screen-title"}, {"fill": "#A1A1AA", "font": "12px 600", "type": "text", "content": "K-2501", "position": {"x": 850, "y": 470}, "element_id": "label-k2501"}, {"fill": "#A1A1AA", "font": "10px normal", "type": "text", "content": "K-2502 Makeup", "position": {"x": 1400, "y": 460}, "element_id": "label-k2502"}, {"fill": "#A1A1AA", "font": "10px normal", "type": "text", "content": "C-2507 Amine Absorber", "position": {"x": 450, "y": 650}, "element_id": "label-c2507"}, {"fill": "#A1A1AA", "font": "10px normal", "type": "text", "content": "V-2506 HP KO", "position": {"x": 250, "y": 450}, "element_id": "label-v2506"}, {"fill": "#71717A", "font": "10px normal", "type": "text", "content": "Seal Oil Tank", "position": {"x": 750, "y": 210}, "element_id": "label-seal-tank"}, {"fill": "#71717A", "font": "10px normal", "type": "text", "content": "Lube/Seal Oil Console", "position": {"x": 820, "y": 800}, "element_id": "label-lube-oil"}, {"fill": "#71717A", "font": "10px normal", "type": "text", "content": "Steam Turbine Driver", "position": {"x": 820, "y": 600}, "element_id": "label-turbine"}, {"fill": "#A1A1AA", "font": "10px 600", "type": "text", "content": "Vibration / Mechanical", "position": {"x": 1100, "y": 420}, "element_id": "label-vib"}, {"type": "line", "stroke": "#3F3F46", "content": null, "position": {"x": 0, "y": 60}, "element_id": "divider-title", "end_position": {"x": 1920, "y": 60}, "stroke_width": 1}, {"type": "line", "stroke": "#3F3F46", "content": null, "position": {"x": 1080, "y": 420}, "element_id": "divider-vib", "end_position": {"x": 1080, "y": 900}, "stroke_width": 1}]}'::jsonb,
  NULL,
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  svg_data = EXCLUDED.svg_data,
  metadata = EXCLUDED.metadata,
  bindings = EXCLUDED.bindings;

-- HCU Unit 25 Process
INSERT INTO design_objects (id, name, type, svg_data, bindings, metadata, created_by)
VALUES (
  '4a9773e5-3d29-4778-a312-134cc81e5f98',
  'HCU Unit 25 Process',
  'graphic',
  $svg$<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3840 2160"><rect width="100%" height="100%" fill="#09090B"/>
<path id="pipe-feed-inlet" d="M 20 1050 L 160 1050" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">VGO Feed</text>
<path id="pipe-v2501-to-e2501" d="M 160 1050 L 310 1000" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-e2501-to-e2502" d="M 310 1000 L 410 1000" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-e2502-to-e2503" d="M 410 1000 L 510 1000" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-e2503-to-pump" d="M 510 1000 L 545 1000 L 545 1130 L 460 1130" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-pump-to-mix" d="M 460 1200 L 485 1000 L 620 1000" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-mix-to-heater" d="M 620 1000 L 830 880" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-heater-to-r2501" d="M 830 880 L 955 880 L 955 610 L 1160 610" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-r2501-to-r2502" d="M 1160 1130 L 1240 1130 L 1310 1130 L 1310 760 L 1375 760 L 1450 760" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-effluent-to-hx" d="M 1450 1190 L 1525 1190 L 1600 1190 L 1600 1000" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Reactor Effluent</text>
<path id="pipe-hx-block-to-aircooler" d="M 1600 1000 L 1600 530 L 1580 530 L 1730 530" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-aircooler-to-hhps" d="M 1730 570 L 1730 740 L 1780 740" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-hhps-to-chps" d="M 1780 960 L 1780 1110 L 1780 1200" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-chps-boot-sour" d="M 1780 1290 L 1780 1430 L 1680 1430" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Sour Water</text>
<path id="pipe-hhps-to-hlps" d="M 1835 850 L 1950 850 L 1950 820 L 2000 820 L 2050 820" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-hlps-to-frac" d="M 2100 820 L 2250 820 L 2250 1050 L 2385 1050 L 2420 1050" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-clps-to-frac" d="M 2050 1150 L 2100 1150 L 2250 1150" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-c2501-to-c2502" d="M 2455 1000 L 2675 1000 L 2720 1000" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-c2502-ovhd" d="M 2765 425 L 2910 425 L 2910 380 L 2980 380" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-v2508-to-products" d="M 2980 380 L 3120 380 L 3150 380" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-c2502-bottoms-uco" d="M 2765 1270 L 2765 1700 L 3150 1700" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">UCO Bottoms</text>
<path id="pipe-reboiler-steam" d="M 2380 1750 L 2560 1750" stroke="#E4E4E7" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">LP Steam</text>
<path id="pipe-reboiler-return" d="M 2605 1750 L 2765 1750" stroke="#E4E4E7" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Reboil Return</text>
<path id="pipe-recycle-header" d="M 1900 310 L 2000 200 L 1160 200 L 1160 610" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">RECYCLE H2 LOOP</text>
<path id="pipe-recycle-to-r2502" d="M 1450 200 L 1450 760" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-hhps-vapor-rgc" d="M 1780 740 L 1780 400 L 1580 400 L 1580 330 L 1700 330 L 1845 330 L 1845 310" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path id="pipe-makeup-h2" d="M 2150 310 L 2230 310 L 2000 310" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Makeup H2</text>
<path id="pipe-quench-r2501-ib1" d="M 1160 200 L 1160 780 L 980 780" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">IB1 Quench</text>
<path id="pipe-quench-r2501-ib2" d="M 1160 200 L 1160 880 L 980 880" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">IB2 Quench</text>
<path id="pipe-quench-r2501-ib3" d="M 1160 200 L 1160 980 L 980 980" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">IB3 Quench</text>
<path id="pipe-quench-r2502-ib1" d="M 1450 200 L 1450 860 L 1280 860" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">IB1 Quench</text>
<path id="pipe-quench-r2502-ib2" d="M 1450 200 L 1450 990 L 1280 990" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">IB2 Quench</text>
<path id="pipe-amine-supply" d="M 1560 150 L 1640 150 L 1640 200 L 1700 200" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Lean Amine</text>
<path id="pipe-amine-return" d="M 1700 430 L 1560 430" stroke="#71717A" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Rich Amine</text>
<path id="pipe-fuel-gas" d="M 700 1160 L 830 1160" stroke="#FBBF24" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Fuel Gas</text>
<path id="pipe-diesel-draw" d="M 2810 980 L 2900 980" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Diesel Draw</text>
<path id="pipe-kero-draw" d="M 2810 1140 L 2900 1140" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Kero Draw</text>
<path id="pipe-reflux" d="M 2980 480 L 2870 480 L 2765 480" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Reflux</text>
<path id="pipe-lpg-rundown" d="M 3150 460 L 3380 460" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">LPG</text>
<path id="pipe-ln-rundown" d="M 3150 580 L 3380 580" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Lt Naphtha</text>
<path id="pipe-hn-rundown" d="M 3150 700 L 3380 700" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Hvy Naphtha</text>
<path id="pipe-effluent-hx-cold" d="M 460 1200 L 545 1000" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Cold Feed (F/E Exchanger)</text>
<path id="pipe-effluent-hx-hot" d="M 1600 1000 L 545 1000" stroke="#71717A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text font-family="monospace" font-size="11" fill="#A1A1AA" opacity="0.8">Hot Effluent (F/E Exchanger)</text>
<text x="50" y="55" font-family="monospace" font-size="36" fill="#E4E4E7">UNIT 25 — HYDROCRACKER (HCU) — PROCESS OVERVIEW</text>
<text x="3780" y="55" font-family="monospace" font-size="14" fill="#E4E4E7">LIVE HH:MM:SS UTC</text>
<text x="200" y="150" font-family="monospace" font-size="14" fill="#E4E4E7">Feed & Preheat</text>
<text x="830" y="150" font-family="monospace" font-size="14" fill="#E4E4E7">Charge Heater</text>
<text x="1300" y="150" font-family="monospace" font-size="14" fill="#E4E4E7">Reactor Section</text>
<text x="1900" y="150" font-family="monospace" font-size="14" fill="#E4E4E7">HP Separation</text>
<text x="1870" y="90" font-family="monospace" font-size="13" fill="#E4E4E7">RGC Loop</text>
<text x="2700" y="150" font-family="monospace" font-size="14" fill="#E4E4E7">Fractionation</text>
<text x="3250" y="150" font-family="monospace" font-size="14" fill="#E4E4E7">Products</text>
<text x="160" y="1195" font-family="monospace" font-size="12" fill="#E4E4E7">V-2501</text>
<text x="310" y="1055" font-family="monospace" font-size="11" fill="#E4E4E7">E-2501</text>
<text x="410" y="1055" font-family="monospace" font-size="11" fill="#E4E4E7">E-2502</text>
<text x="510" y="1055" font-family="monospace" font-size="11" fill="#E4E4E7">E-2503</text>
<text x="460" y="1255" font-family="monospace" font-size="11" fill="#E4E4E7">P-2501</text>
<text x="830" y="1120" font-family="monospace" font-size="18" fill="#E4E4E7">H-2501</text>
<text x="1160" y="1195" font-family="monospace" font-size="16" fill="#E4E4E7">R-2501</text>
<text x="1450" y="1265" font-family="monospace" font-size="16" fill="#E4E4E7">R-2502</text>
<text x="1730" y="610" font-family="monospace" font-size="12" fill="#E4E4E7">A-2501</text>
<text x="1780" y="1075" font-family="monospace" font-size="14" fill="#E4E4E7">V-2502 HHPS</text>
<text x="1780" y="1430" font-family="monospace" font-size="14" fill="#E4E4E7">V-2503 CHPS</text>
<text x="2050" y="1000" font-family="monospace" font-size="12" fill="#E4E4E7">V-2504 HLPS</text>
<text x="2050" y="1310" font-family="monospace" font-size="12" fill="#E4E4E7">V-2505 CLPS</text>
<text x="1580" y="435" font-family="monospace" font-size="12" fill="#E4E4E7">V-2506</text>
<text x="1700" y="485" font-family="monospace" font-size="13" fill="#E4E4E7">C-2507</text>
<text x="1900" y="430" font-family="monospace" font-size="14" fill="#E4E4E7">K-2501 RGC</text>
<text x="2150" y="400" font-family="monospace" font-size="14" fill="#E4E4E7">K-2502 MUC</text>
<text x="2420" y="1280" font-family="monospace" font-size="13" fill="#E4E4E7">C-2501</text>
<text x="2720" y="1340" font-family="monospace" font-size="14" fill="#E4E4E7">C-2502</text>
<text x="2980" y="470" font-family="monospace" font-size="12" fill="#E4E4E7">V-2508</text>
<text x="2560" y="1820" font-family="monospace" font-size="11" fill="#E4E4E7">E-Reb</text>
<text x="1580" y="175" font-family="monospace" font-size="12" fill="#E4E4E7">RECYCLE H2 LOOP</text>
<text x="410" y="955" font-family="monospace" font-size="12" fill="#E4E4E7">FEED/EFFLUENT EXCHANGE</text>
<text x="3160" y="448" font-family="monospace" font-size="14" fill="#E4E4E7">LPG</text>
<text x="3160" y="568" font-family="monospace" font-size="14" fill="#E4E4E7">Lt Naphtha (LN)</text>
<text x="3160" y="688" font-family="monospace" font-size="14" fill="#E4E4E7">Hvy Naphtha (HN)</text>
<text x="3160" y="808" font-family="monospace" font-size="14" fill="#E4E4E7">Kerosene</text>
<text x="3160" y="948" font-family="monospace" font-size="14" fill="#E4E4E7">Diesel</text>
<text x="3160" y="1688" font-family="monospace" font-size="14" fill="#E4E4E7">UCO (Unconverted)</text>
<text x="1590" y="1445" font-family="monospace" font-size="11" fill="#E4E4E7">SOUR WATER</text>
<text x="1160" y="645" font-family="monospace" font-size="14" fill="#E4E4E7">B1</text>
<text x="1160" y="771" font-family="monospace" font-size="14" fill="#E4E4E7">B2</text>
<text x="1160" y="897" font-family="monospace" font-size="14" fill="#E4E4E7">B3</text>
<text x="1160" y="1023" font-family="monospace" font-size="14" fill="#E4E4E7">B4</text>
<text x="1450" y="776" font-family="monospace" font-size="14" fill="#E4E4E7">B1</text>
<text x="1450" y="914" font-family="monospace" font-size="14" fill="#E4E4E7">B2</text>
<text x="1450" y="1052" font-family="monospace" font-size="14" fill="#E4E4E7">B3</text>
<text x="725" y="700" font-family="monospace" font-size="10" fill="#E4E4E7">TUBE SKIN</text>
<text x="706" y="1050" font-family="monospace" font-size="14" fill="#E4E4E7">MAX SKIN:</text>
<text x="50" y="2065" font-family="monospace" font-size="11" fill="#E4E4E7">ESD / EQUIPMENT STATUS</text>
<text x="100" y="2085" font-family="monospace" font-size="11" fill="#E4E4E7">Feed Cutoff</text>
<text x="230" y="2085" font-family="monospace" font-size="11" fill="#E4E4E7">H2 Isolation</text>
<text x="360" y="2085" font-family="monospace" font-size="11" fill="#E4E4E7">RG Isolation</text>
<text x="490" y="2085" font-family="monospace" font-size="11" fill="#E4E4E7">Fuel Gas XV</text>
<text x="620" y="2085" font-family="monospace" font-size="11" fill="#E4E4E7">P-2501</text>
<text x="750" y="2085" font-family="monospace" font-size="11" fill="#E4E4E7">K-2501</text>
<text x="880" y="2085" font-family="monospace" font-size="11" fill="#E4E4E7">K-2502</text>
<text x="1010" y="2085" font-family="monospace" font-size="11" fill="#E4E4E7">Flare Flow</text>
<text x="1140" y="2085" font-family="monospace" font-size="11" fill="#E4E4E7">HP Relief P</text>
<text x="3545" y="415" font-family="monospace" font-size="12" fill="#E4E4E7">KEY PERFORMANCE INDICATORS</text>
<text x="3660" y="2040" font-family="monospace" font-size="11" fill="#E4E4E7">SCALE REFERENCE</text>
<text x="3740" y="2073" font-family="monospace" font-size="11" fill="#E4E4E7">≈ 80 ft</text>
<g id="vessel-v2501" transform="translate(160.0,1050.0) scale(1.6000,1.9200)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="hx-e2501" transform="translate(310.0,1000.0) rotate(90.0,32.0,32.0) scale(1.0000,1.0000)"><rect width="64" height="64" fill="#27272A" stroke="#52525B" stroke-width="1"/><text x="32" y="36" font-size="8" fill="#71717A" text-anchor="middle">heat-exchanger-shell-tube</text></g>
<g id="hx-e2502" transform="translate(410.0,1000.0) rotate(90.0,32.0,32.0) scale(1.0000,1.0000)"><rect width="64" height="64" fill="#27272A" stroke="#52525B" stroke-width="1"/><text x="32" y="36" font-size="8" fill="#71717A" text-anchor="middle">heat-exchanger-shell-tube</text></g>
<g id="hx-e2503" transform="translate(510.0,1000.0) rotate(90.0,32.0,32.0) scale(1.0000,1.0000)"><rect width="64" height="64" fill="#27272A" stroke="#52525B" stroke-width="1"/><text x="32" y="36" font-size="8" fill="#71717A" text-anchor="middle">heat-exchanger-shell-tube</text></g>
<g id="pump-p2501" transform="translate(460.0,1200.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <circle class="io-stateful" cx="24" cy="24" r="20"
            fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="4" y1="24" x2="44" y2="24"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="4" x2="44" y2="24"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="44" x2="44" y2="24"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="heater-h2501" transform="translate(830.0,880.0) scale(1.3333,2.0000)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M 15,2 L 29,2 L 29,18 L 37,28 L 37,58 L 7,58 L 7,28 L 15,18 Z"
          fill="none" stroke="#808080" stroke-width="1.5"
          stroke-linejoin="miter"/>
    <polyline points="37,55 20,55 33,44 20,31 37,31"
             fill="none" stroke="#808080" stroke-width="1.5"
             stroke-linejoin="miter"/>
    <line x1="25.5" y1="58" x2="25.5" y2="55"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="33.5" y1="58" x2="33.5" y2="55"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="reactor-r2501" transform="translate(1160.0,870.0) scale(1.6000,3.5200)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="68" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="reactor-r2502" transform="translate(1450.0,950.0) scale(1.6000,2.8800)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="68" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="air-cooler-a2501" transform="translate(1730.0,530.0) scale(2.1053,0.8421)">
  <g class="io-shape-body">
    <line x1="5" y1="5" x2="55" y2="5" stroke="#808080" stroke-width="0.75"/>
    <line x1="5" y1="5" x2="5" y2="27" stroke="#808080" stroke-width="0.75"/>
    <line x1="55" y1="5" x2="55" y2="27" stroke="#808080" stroke-width="0.75"/>
    <polyline points="-4,11 5,11 9,14 14,8 19,14 24,8 29,14 34,8 39,14 44,8 49,14 52,11 55,11 63,11"
              fill="none" stroke="#808080" stroke-width="0.75"/>
    <polyline points="59,8 63,11 59,14"
              fill="none" stroke="#808080" stroke-width="0.75"/>
    <path class="io-stateful"
          d="M30,22 C30,21 8,18 8,22 C8,26 30,23 30,22 Z"
          fill="none" stroke="#808080" stroke-width="0.75"/>
    <path class="io-stateful"
          d="M30,22 C30,21 52,18 52,22 C52,26 30,23 30,22 Z"
          fill="none" stroke="#808080" stroke-width="0.75"/>
    <line x1="30" y1="22" x2="30" y2="30" stroke="#808080" stroke-width="0.75"/>
  </g>
</g>
<g id="vessel-v2502" transform="translate(1780.0,850.0) scale(1.6000,2.8800)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="vessel-v2503" transform="translate(1780.0,1200.0) scale(1.6000,2.4000)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="vessel-v2504" transform="translate(2050.0,820.0) scale(1.6000,2.2400)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="vessel-v2505" transform="translate(2050.0,1150.0) scale(1.6000,1.9200)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="vessel-v2506" transform="translate(1580.0,330.0) scale(1.6000,1.6000)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="column-c2507" transform="translate(1700.0,330.0) scale(1.4545,2.3273)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,10 A12,5 0 0,1 34,10"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="10" x2="10" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="34" y1="10" x2="34" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,110 A12,5 0 0,0 34,110"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="compressor-k2501" transform="translate(1900.0,310.0) scale(1.2800,1.2800)">
  <g class="io-shape-body">
    <circle class="io-stateful" cx="25" cy="25" r="20"
            fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="12.1" y1="9.7" x2="43.1" y2="16.5"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="12.1" y1="40.3" x2="43.1" y2="33.5"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="compressor-k2502" transform="translate(2150.0,310.0) scale(1.0240,1.0240)">
  <g class="io-shape-body">
    <circle class="io-stateful" cx="25" cy="25" r="20"
            fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="12.1" y1="9.7" x2="43.1" y2="16.5"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="12.1" y1="40.3" x2="43.1" y2="33.5"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="column-c2501" transform="translate(2420.0,1000.0) scale(1.4545,2.6182)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,10 A12,5 0 0,1 34,10"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="10" x2="10" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="34" y1="10" x2="34" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,110 A12,5 0 0,0 34,110"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="column-c2502" transform="translate(2720.0,850.0) scale(1.4545,2.9091)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,10 A12,5 0 0,1 34,10"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="10" x2="10" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="34" y1="10" x2="34" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,110 A12,5 0 0,0 34,110"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="vessel-v2508" transform="translate(2980.0,380.0) scale(0.9600,0.8000)">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M12,10 A5,10 0 0,0 12,30"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="10" x2="68" y2="10"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="30" x2="68" y2="30"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M68,10 A5,10 0 0,1 68,30"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="hx-ereb" transform="translate(2560.0,1750.0) rotate(90.0,32.0,32.0) scale(1.0000,1.0000)"><rect width="64" height="64" fill="#27272A" stroke="#52525B" stroke-width="1"/><text x="32" y="36" font-size="8" fill="#71717A" text-anchor="middle">heat-exchanger-shell-tube</text></g>
<g id="cv-fic1001" transform="translate(85.0,930.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-lic1001" transform="translate(160.0,1140.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-tic1010" transform="translate(780.0,660.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-tic1011" transform="translate(900.0,660.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-fic1012" transform="translate(830.0,1160.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-fic1120" transform="translate(980.0,780.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-fic1122" transform="translate(980.0,880.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-fic1124" transform="translate(980.0,980.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-fic1220" transform="translate(1280.0,860.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-fic1222" transform="translate(1280.0,990.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-lic1320" transform="translate(1780.0,1030.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-lic1330" transform="translate(1780.0,1310.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-lic1331" transform="translate(1780.0,1380.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-lic1340" transform="translate(2050.0,910.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-lic1341" transform="translate(2050.0,1210.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-fic1411" transform="translate(1640.0,200.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-fic1501" transform="translate(2100.0,230.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-fic2222" transform="translate(2870.0,490.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-lic2220" transform="translate(2980.0,340.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-fic2231" transform="translate(2900.0,990.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-fic2230" transform="translate(2900.0,1150.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-lic2211" transform="translate(2720.0,1630.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-tic2260" transform="translate(2560.0,1810.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-fic2261" transform="translate(2440.0,1810.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-fic2332" transform="translate(3150.0,460.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-tic1305" transform="translate(1730.0,440.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-pic1301" transform="translate(1660.0,1190.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="cv-pic2201" transform="translate(2640.0,570.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="xv-2501" transform="translate(100.0,1050.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,0 24,12 0,24"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,0 24,12 48,24"
             fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="xv-2502" transform="translate(1160.0,200.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,0 24,12 0,24"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,0 24,12 48,24"
             fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="xv-2503" transform="translate(1845.0,280.0) scale(1.3333,1.3333)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,0 24,12 0,24"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,0 24,12 48,24"
             fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g>
<g id="xv-2504" transform="translate(830.0,1170.0) scale(1.0667,1.0667)">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,0 24,12 0,24"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,0 24,12 48,24"
             fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</g></svg>$svg$,
  '{"name": "HCU Unit 25 Process", "type": "graphic", "pipes": [{"label": "VGO Feed", "path_data": "M 20 1050 L 160 1050", "element_id": "pipe-feed-inlet", "service_type": "process", "stroke_width": 2.0}, {"label": null, "path_data": "M 160 1050 L 310 1000", "element_id": "pipe-v2501-to-e2501", "service_type": "process", "stroke_width": 2.0}, {"label": null, "path_data": "M 310 1000 L 410 1000", "element_id": "pipe-e2501-to-e2502", "service_type": "process", "stroke_width": 2.0}, {"label": null, "path_data": "M 410 1000 L 510 1000", "element_id": "pipe-e2502-to-e2503", "service_type": "process", "stroke_width": 2.0}, {"label": null, "path_data": "M 510 1000 L 545 1000 L 545 1130 L 460 1130", "element_id": "pipe-e2503-to-pump", "service_type": "process", "stroke_width": 2.0}, {"label": null, "path_data": "M 460 1200 L 485 1000 L 620 1000", "element_id": "pipe-pump-to-mix", "service_type": "process", "stroke_width": 2.0}, {"label": null, "path_data": "M 620 1000 L 830 880", "element_id": "pipe-mix-to-heater", "service_type": "process", "stroke_width": 2.0}, {"label": null, "path_data": "M 830 880 L 955 880 L 955 610 L 1160 610", "element_id": "pipe-heater-to-r2501", "service_type": "process", "stroke_width": 2.0}, {"label": null, "path_data": "M 1160 1130 L 1240 1130 L 1310 1130 L 1310 760 L 1375 760 L 1450 760", "element_id": "pipe-r2501-to-r2502", "service_type": "process", "stroke_width": 2.0}, {"label": "Reactor Effluent", "path_data": "M 1450 1190 L 1525 1190 L 1600 1190 L 1600 1000", "element_id": "pipe-effluent-to-hx", "service_type": "gas_vapor", "stroke_width": 2.0}, {"label": null, "path_data": "M 1600 1000 L 1600 530 L 1580 530 L 1730 530", "element_id": "pipe-hx-block-to-aircooler", "service_type": "gas_vapor", "stroke_width": 2.0}, {"label": null, "path_data": "M 1730 570 L 1730 740 L 1780 740", "element_id": "pipe-aircooler-to-hhps", "service_type": "process", "stroke_width": 2.0}, {"label": null, "path_data": "M 1780 960 L 1780 1110 L 1780 1200", "element_id": "pipe-hhps-to-chps", "service_type": "process", "stroke_width": 2.0}, {"label": "Sour Water", "path_data": "M 1780 1290 L 1780 1430 L 1680 1430", "element_id": "pipe-chps-boot-sour", "service_type": "drain", "stroke_width": 1.5}, {"label": null, "path_data": "M 1835 850 L 1950 850 L 1950 820 L 2000 820 L 2050 820", "element_id": "pipe-hhps-to-hlps", "service_type": "process", "stroke_width": 2.0}, {"label": null, "path_data": "M 2100 820 L 2250 820 L 2250 1050 L 2385 1050 L 2420 1050", "element_id": "pipe-hlps-to-frac", "service_type": "process", "stroke_width": 2.0}, {"label": null, "path_data": "M 2050 1150 L 2100 1150 L 2250 1150", "element_id": "pipe-clps-to-frac", "service_type": "process", "stroke_width": 2.0}, {"label": null, "path_data": "M 2455 1000 L 2675 1000 L 2720 1000", "element_id": "pipe-c2501-to-c2502", "service_type": "process", "stroke_width": 2.0}, {"label": null, "path_data": "M 2765 425 L 2910 425 L 2910 380 L 2980 380", "element_id": "pipe-c2502-ovhd", "service_type": "gas_vapor", "stroke_width": 2.0}, {"label": null, "path_data": "M 2980 380 L 3120 380 L 3150 380", "element_id": "pipe-v2508-to-products", "service_type": "process", "stroke_width": 2.0}, {"label": "UCO Bottoms", "path_data": "M 2765 1270 L 2765 1700 L 3150 1700", "element_id": "pipe-c2502-bottoms-uco", "service_type": "process", "stroke_width": 2.0}, {"label": "LP Steam", "path_data": "M 2380 1750 L 2560 1750", "element_id": "pipe-reboiler-steam", "service_type": "steam", "stroke_width": 1.5}, {"label": "Reboil Return", "path_data": "M 2605 1750 L 2765 1750", "element_id": "pipe-reboiler-return", "service_type": "steam", "stroke_width": 1.5}, {"label": "RECYCLE H2 LOOP", "path_data": "M 1900 310 L 2000 200 L 1160 200 L 1160 610", "element_id": "pipe-recycle-header", "service_type": "gas_vapor", "stroke_width": 2.0}, {"label": null, "path_data": "M 1450 200 L 1450 760", "element_id": "pipe-recycle-to-r2502", "service_type": "gas_vapor", "stroke_width": 2.0}, {"label": null, "path_data": "M 1780 740 L 1780 400 L 1580 400 L 1580 330 L 1700 330 L 1845 330 L 1845 310", "element_id": "pipe-hhps-vapor-rgc", "service_type": "gas_vapor", "stroke_width": 2.0}, {"label": "Makeup H2", "path_data": "M 2150 310 L 2230 310 L 2000 310", "element_id": "pipe-makeup-h2", "service_type": "gas_vapor", "stroke_width": 2.0}, {"label": "IB1 Quench", "path_data": "M 1160 200 L 1160 780 L 980 780", "element_id": "pipe-quench-r2501-ib1", "service_type": "gas_vapor", "stroke_width": 2.0}, {"label": "IB2 Quench", "path_data": "M 1160 200 L 1160 880 L 980 880", "element_id": "pipe-quench-r2501-ib2", "service_type": "gas_vapor", "stroke_width": 2.0}, {"label": "IB3 Quench", "path_data": "M 1160 200 L 1160 980 L 980 980", "element_id": "pipe-quench-r2501-ib3", "service_type": "gas_vapor", "stroke_width": 2.0}, {"label": "IB1 Quench", "path_data": "M 1450 200 L 1450 860 L 1280 860", "element_id": "pipe-quench-r2502-ib1", "service_type": "gas_vapor", "stroke_width": 2.0}, {"label": "IB2 Quench", "path_data": "M 1450 200 L 1450 990 L 1280 990", "element_id": "pipe-quench-r2502-ib2", "service_type": "gas_vapor", "stroke_width": 2.0}, {"label": "Lean Amine", "path_data": "M 1560 150 L 1640 150 L 1640 200 L 1700 200", "element_id": "pipe-amine-supply", "service_type": "chemical", "stroke_width": 1.5}, {"label": "Rich Amine", "path_data": "M 1700 430 L 1560 430", "element_id": "pipe-amine-return", "service_type": "chemical", "stroke_width": 1.5}, {"label": "Fuel Gas", "path_data": "M 700 1160 L 830 1160", "element_id": "pipe-fuel-gas", "service_type": "fuel_gas", "stroke_width": 1.5}, {"label": "Diesel Draw", "path_data": "M 2810 980 L 2900 980", "element_id": "pipe-diesel-draw", "service_type": "process", "stroke_width": 2.0}, {"label": "Kero Draw", "path_data": "M 2810 1140 L 2900 1140", "element_id": "pipe-kero-draw", "service_type": "process", "stroke_width": 2.0}, {"label": "Reflux", "path_data": "M 2980 480 L 2870 480 L 2765 480", "element_id": "pipe-reflux", "service_type": "process", "stroke_width": 2.0}, {"label": "LPG", "path_data": "M 3150 460 L 3380 460", "element_id": "pipe-lpg-rundown", "service_type": "process", "stroke_width": 2.0}, {"label": "Lt Naphtha", "path_data": "M 3150 580 L 3380 580", "element_id": "pipe-ln-rundown", "service_type": "process", "stroke_width": 2.0}, {"label": "Hvy Naphtha", "path_data": "M 3150 700 L 3380 700", "element_id": "pipe-hn-rundown", "service_type": "process", "stroke_width": 2.0}, {"label": "Cold Feed (F/E Exchanger)", "path_data": "M 460 1200 L 545 1000", "element_id": "pipe-effluent-hx-cold", "service_type": "process", "stroke_width": 2.0}, {"label": "Hot Effluent (F/E Exchanger)", "path_data": "M 1600 1000 L 545 1000", "element_id": "pipe-effluent-hx-hot", "service_type": "gas_vapor", "stroke_width": 2.0}], "layers": [{"name": "Background", "locked": true, "visible": true, "elements": ["pipe-feed-inlet", "pipe-v2501-to-e2501", "pipe-e2501-to-e2502", "pipe-e2502-to-e2503", "pipe-e2503-to-pump", "pipe-pump-to-mix", "pipe-mix-to-heater", "pipe-heater-to-r2501", "pipe-r2501-to-r2502", "pipe-effluent-to-hx", "pipe-hx-block-to-aircooler", "pipe-aircooler-to-hhps", "pipe-hhps-to-chps", "pipe-chps-boot-sour", "pipe-hhps-to-hlps", "pipe-hlps-to-frac", "pipe-clps-to-frac", "pipe-c2501-to-c2502", "pipe-c2502-ovhd", "pipe-v2508-to-products", "pipe-c2502-bottoms-uco", "pipe-reboiler-steam", "pipe-reboiler-return", "pipe-recycle-header", "pipe-recycle-to-r2502", "pipe-hhps-vapor-rgc", "pipe-makeup-h2", "pipe-quench-r2501-ib1", "pipe-quench-r2501-ib2", "pipe-quench-r2501-ib3", "pipe-quench-r2502-ib1", "pipe-quench-r2502-ib2", "pipe-amine-supply", "pipe-amine-return", "pipe-fuel-gas", "pipe-diesel-draw", "pipe-kero-draw", "pipe-reflux", "pipe-lpg-rundown", "pipe-ln-rundown", "pipe-hn-rundown", "pipe-effluent-hx-cold", "pipe-effluent-hx-hot", "divider-zone1-2", "divider-zone2-3", "divider-zone3-4", "divider-zone4-5", "divider-zone5-6", "divider-zone6-7", "divider-kpi", "rect-esd-row-bg", "rect-kpi-panel-bg", "rect-scale-bg", "shape-scale-r2501"]}, {"name": "Equipment", "locked": false, "visible": true, "elements": ["vessel-v2501", "hx-e2501", "hx-e2502", "hx-e2503", "pump-p2501", "heater-h2501", "reactor-r2501", "reactor-r2502", "air-cooler-a2501", "vessel-v2502", "vessel-v2503", "vessel-v2504", "vessel-v2505", "vessel-v2506", "column-c2507", "compressor-k2501", "compressor-k2502", "column-c2501", "column-c2502", "vessel-v2508", "hx-ereb", "cv-fic1001", "cv-lic1001", "cv-tic1010", "cv-tic1011", "cv-fic1012", "cv-fic1120", "cv-fic1122", "cv-fic1124", "cv-fic1220", "cv-fic1222", "cv-lic1320", "cv-lic1330", "cv-lic1331", "cv-lic1340", "cv-lic1341", "cv-fic1411", "cv-fic1501", "cv-fic2222", "cv-lic2220", "cv-fic2231", "cv-fic2230", "cv-lic2211", "cv-tic2260", "cv-fic2261", "cv-fic2332", "cv-tic1305", "cv-pic1301", "cv-pic2201", "xv-2501", "xv-2502", "xv-2503", "xv-2504"]}, {"name": "Instruments", "locked": false, "visible": true, "elements": ["readout-fic1001-pv", "readout-fic1001-sp", "readout-fic1001-out", "bar-fic1001-out", "status-fic1001-mode", "alarm-fic1001", "readout-fi0001", "readout-ti1001", "readout-ti1004", "readout-lic1001-pv", "readout-lic1001-sp", "readout-lic1001-out", "bar-lic1001-out", "status-lic1001-mode", "gauge-lic1001", "alarm-v2501", "readout-fi1002", "readout-pi1004", "readout-pi1003", "readout-ii1001", "alarm-p2501", "status-p2501-run", "readout-tic1010-pv", "readout-tic1010-sp", "readout-tic1010-out", "bar-tic1010-out", "status-tic1010-mode", "readout-tic1011-pv", "readout-tic1011-sp", "readout-tic1011-out", "bar-tic1011-out", "status-tic1011-mode", "readout-ti1006", "readout-fic1012-pv", "readout-fic1012-sp", "readout-fic1012-out", "bar-fic1012-out", "status-fic1012-mode", "readout-ai1010", "readout-ti1016", "readout-ti1015", "status-tshh1010", "readout-ti1020", "readout-ti1021", "readout-ti1022", "readout-ti1023", "readout-ti1024", "readout-ti1025", "readout-ti1026", "readout-ti1027", "readout-ti1028", "readout-ti1029", "readout-ti1030", "readout-ti1031", "readout-max-skin", "alarm-h2501", "readout-tic1101-pv", "readout-tic1101-sp", "readout-tic1101-out", "bar-tic1101-out", "status-tic1101-mode", "readout-pi1101", "readout-wabt1101", "readout-h2pp1101", "readout-pdi1101", "readout-ti1160", "readout-ai1102", "readout-fic1120-pv", "readout-fic1120-sp", "readout-fic1120-out", "status-fic1120-mode", "readout-fic1122-pv", "readout-fic1122-sp", "readout-fic1122-out", "status-fic1122-mode", "readout-fic1124-pv", "readout-fic1124-sp", "readout-fic1124-out", "status-fic1124-mode", "status-pshh1101", "readout-ti1110", "readout-ti1111", "readout-ti1120", "readout-ti1121", "readout-ti1130", "readout-ti1131", "readout-ti1140", "readout-ti1141", "alarm-r2501", "sparkline-wabt1101", "readout-tic1201-pv", "readout-tic1201-sp", "readout-tic1201-out", "bar-tic1201-out", "status-tic1201-mode", "readout-pi1201", "readout-wabt1201", "readout-conv2501", "readout-h2pp1201", "readout-pdi1201", "readout-ti1250", "readout-fic1220-pv", "readout-fic1220-sp", "readout-fic1220-out", "status-fic1220-mode", "readout-fic1222-pv", "readout-fic1222-sp", "readout-fic1222-out", "status-fic1222-mode", "status-pshh1201", "readout-ti1210", "readout-ti1211", "readout-ti1220", "readout-ti1221", "readout-ti1230", "readout-ti1231", "alarm-r2502", "sparkline-wabt1201", "readout-tic1305-pv", "readout-tic1305-sp", "readout-tic1305-out", "status-tic1305-mode", "readout-ai1301", "readout-ti1321", "readout-pi1321", "readout-lic1320-pv", "readout-lic1320-sp", "readout-lic1320-out", "status-lic1320-mode", "gauge-lic1320", "alarm-v2502", "readout-pic1301-pv", "readout-pic1301-sp", "readout-pic1301-out", "status-pic1301-mode", "readout-ti1332", "readout-lic1330-pv", "readout-lic1330-sp", "readout-lic1330-out", "status-lic1330-mode", "readout-lic1331-pv", "readout-lic1331-sp", "readout-lic1331-out", "status-lic1331-mode", "gauge-lic1330", "alarm-v2503", "readout-lic1340-pv", "readout-lic1340-sp", "readout-lic1340-out", "status-lic1340-mode", "readout-lic1341-pv", "readout-lic1341-sp", "readout-lic1341-out", "status-lic1341-mode", "gauge-lic1340", "gauge-lic1341", "alarm-v2504", "alarm-v2505", "readout-ai1401", "readout-ai1402", "readout-fic1411-pv", "readout-fic1411-sp", "readout-fic1411-out", "status-fic1411-mode", "readout-sic2001-pv", "readout-sic2001-sp", "readout-sic2001-out", "bar-sic2001-out", "status-sic2001-mode", "readout-pi2001", "readout-pi2002", "readout-ti2002", "readout-calc2003", "sparkline-calc2003", "readout-vt2001", "status-k2501-run", "alarm-k2501", "readout-fic1501-pv", "readout-fic1501-sp", "readout-fic1501-out", "status-fic1501-mode", "readout-pi2031", "status-k2502-run", "alarm-k2502", "readout-ii2001", "alarm-c2507", "readout-pic2201-pv", "readout-pic2201-sp", "readout-pic2201-out", "status-pic2201-mode", "readout-ti2208", "readout-ti2204", "readout-ti2201", "readout-fi2201", "readout-lic2211-pv", "readout-lic2211-sp", "readout-lic2211-out", "status-lic2211-mode", "gauge-lic2211", "readout-fic2231-pv", "readout-fic2231-sp", "readout-fic2231-out", "status-fic2231-mode", "readout-fic2230-pv", "readout-fic2230-sp", "readout-fic2230-out", "status-fic2230-mode", "readout-fic2222-pv", "readout-fic2222-sp", "readout-fic2222-out", "status-fic2222-mode", "readout-lic2220-pv", "readout-lic2220-sp", "readout-lic2220-out", "status-lic2220-mode", "gauge-lic2220", "readout-fi2223", "readout-fi2212", "readout-tic2260-pv", "readout-tic2260-sp", "readout-tic2260-out", "status-tic2260-mode", "readout-fic2261-pv", "readout-fic2261-sp", "readout-fic2261-out", "status-fic2261-mode", "readout-ai2232", "alarm-c2502", "alarm-c2501", "alarm-v2508", "readout-fic2332-pv", "readout-fi2313", "readout-fi2314", "readout-kero-rundown", "readout-diesel-rundown", "readout-uco-rundown", "kpi-conv1001", "kpi-wabt-comb", "kpi-lhsv", "kpi-h2cons", "kpi-r2501-dt", "kpi-r2502-dt", "kpi-diesel-s", "kpi-kero-s", "kpi-naphtha-s", "kpi-uco-api", "status-xv2501", "status-xv2502", "status-xv2503", "status-xv2504", "status-esd-p2501", "status-esd-k2501", "status-esd-k2502", "readout-fi9001", "readout-pi9001"]}, {"name": "Labels", "locked": false, "visible": true, "elements": ["label-unit-title", "label-timestamp", "label-zone-feed", "label-zone-heater", "label-zone-reactor", "label-zone-hpsep", "label-zone-rgc", "label-zone-frac", "label-zone-products", "label-equip-v2501", "label-equip-e2501", "label-equip-e2502", "label-equip-e2503", "label-equip-p2501", "label-equip-h2501", "label-equip-r2501", "label-equip-r2502", "label-equip-a2501", "label-equip-v2502", "label-equip-v2503", "label-equip-v2504", "label-equip-v2505", "label-equip-v2506", "label-equip-c2507", "label-equip-k2501", "label-equip-k2502", "label-equip-c2501", "label-equip-c2502", "label-equip-v2508", "label-equip-ereb", "label-recycle-header", "label-fe-exchange", "label-product-lpg", "label-product-ln", "label-product-hn", "label-product-kero", "label-product-diesel", "label-product-uco", "label-sour-water", "label-r2501-bed1", "label-r2501-bed2", "label-r2501-bed3", "label-r2501-bed4", "label-r2502-bed1", "label-r2502-bed2", "label-r2502-bed3", "label-tube-skin-strip", "label-max-skin", "label-esd-row-title", "label-esd-xv2501", "label-esd-xv2502", "label-esd-xv2503", "label-esd-xv2504", "label-esd-p2501", "label-esd-k2501", "label-esd-k2502", "label-esd-flare", "label-esd-relief", "label-kpi-title", "label-scale-title", "label-scale-height"]}], "shapes": [{"scale": {"x": 1.0, "y": 1.2}, "mirror": "none", "variant": "opt1", "position": {"x": 160, "y": 1050}, "rotation": 0, "shape_id": "vessel-vertical", "element_id": "vessel-v2501", "configuration": "flanged-both", "composable_parts": [{"part_id": "part-support-legs", "attach_point": "bottom"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 310, "y": 1000}, "rotation": 90, "shape_id": "heat-exchanger-shell-tube", "element_id": "hx-e2501", "configuration": null, "composable_parts": []}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 410, "y": 1000}, "rotation": 90, "shape_id": "heat-exchanger-shell-tube", "element_id": "hx-e2502", "configuration": null, "composable_parts": []}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 510, "y": 1000}, "rotation": 90, "shape_id": "heat-exchanger-shell-tube", "element_id": "hx-e2503", "configuration": null, "composable_parts": []}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 460, "y": 1200}, "rotation": 0, "shape_id": "pump-centrifugal", "element_id": "pump-p2501", "configuration": null, "composable_parts": []}, {"scale": {"x": 1.0, "y": 1.5}, "mirror": "none", "variant": "opt1", "position": {"x": 830, "y": 880}, "rotation": 0, "shape_id": "heater-fired", "element_id": "heater-h2501", "configuration": null, "composable_parts": []}, {"scale": {"x": 1.0, "y": 2.2}, "mirror": "none", "variant": "opt1", "position": {"x": 1160, "y": 870}, "rotation": 0, "shape_id": "reactor", "element_id": "reactor-r2501", "configuration": "base", "composable_parts": []}, {"scale": {"x": 1.0, "y": 1.8}, "mirror": "none", "variant": "opt1", "position": {"x": 1450, "y": 950}, "rotation": 0, "shape_id": "reactor", "element_id": "reactor-r2502", "configuration": "base", "composable_parts": []}, {"scale": {"x": 2.5, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 1730, "y": 530}, "rotation": 0, "shape_id": "air-cooler", "element_id": "air-cooler-a2501", "configuration": null, "composable_parts": []}, {"scale": {"x": 1.0, "y": 1.8}, "mirror": "none", "variant": "opt1", "position": {"x": 1780, "y": 850}, "rotation": 0, "shape_id": "vessel-vertical", "element_id": "vessel-v2502", "configuration": "flanged-both", "composable_parts": [{"part_id": "part-support-skirt", "attach_point": "bottom"}]}, {"scale": {"x": 1.0, "y": 1.5}, "mirror": "none", "variant": "opt1", "position": {"x": 1780, "y": 1200}, "rotation": 0, "shape_id": "vessel-vertical", "element_id": "vessel-v2503", "configuration": "flanged-both", "composable_parts": [{"part_id": "part-support-skirt", "attach_point": "bottom"}]}, {"scale": {"x": 1.0, "y": 1.4}, "mirror": "none", "variant": "opt1", "position": {"x": 2050, "y": 820}, "rotation": 0, "shape_id": "vessel-vertical", "element_id": "vessel-v2504", "configuration": "flanged-both", "composable_parts": []}, {"scale": {"x": 1.0, "y": 1.2}, "mirror": "none", "variant": "opt1", "position": {"x": 2050, "y": 1150}, "rotation": 0, "shape_id": "vessel-vertical", "element_id": "vessel-v2505", "configuration": "flanged-both", "composable_parts": []}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 1580, "y": 330}, "rotation": 0, "shape_id": "vessel-vertical", "element_id": "vessel-v2506", "configuration": "flanged-both", "composable_parts": []}, {"scale": {"x": 1.0, "y": 1.6}, "mirror": "none", "variant": "opt1", "position": {"x": 1700, "y": 330}, "rotation": 0, "shape_id": "column-distillation", "element_id": "column-c2507", "configuration": "trayed-6", "composable_parts": []}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 1900, "y": 310}, "rotation": 0, "shape_id": "compressor", "element_id": "compressor-k2501", "configuration": null, "composable_parts": []}, {"scale": {"x": 0.8, "y": 0.8}, "mirror": "none", "variant": "opt1", "position": {"x": 2150, "y": 310}, "rotation": 0, "shape_id": "compressor", "element_id": "compressor-k2502", "configuration": null, "composable_parts": []}, {"scale": {"x": 1.0, "y": 1.8}, "mirror": "none", "variant": "opt1", "position": {"x": 2420, "y": 1000}, "rotation": 0, "shape_id": "column-distillation", "element_id": "column-c2501", "configuration": "trayed-6", "composable_parts": []}, {"scale": {"x": 1.0, "y": 2.0}, "mirror": "none", "variant": "opt1", "position": {"x": 2720, "y": 850}, "rotation": 0, "shape_id": "column-distillation", "element_id": "column-c2502", "configuration": "trayed-10", "composable_parts": []}, {"scale": {"x": 1.2, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 2980, "y": 380}, "rotation": 0, "shape_id": "vessel-horizontal", "element_id": "vessel-v2508", "configuration": "flanged-both", "composable_parts": []}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 2560, "y": 1750}, "rotation": 90, "shape_id": "heat-exchanger-shell-tube", "element_id": "hx-ereb", "configuration": null, "composable_parts": []}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 85, "y": 930}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-fic1001", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}, {"part_id": "part-fail-closed", "attach_point": "body"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 160, "y": 1140}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-lic1001", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}, {"part_id": "part-fail-closed", "attach_point": "body"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 780, "y": 660}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-tic1010", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}, {"part_id": "part-fail-closed", "attach_point": "body"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 900, "y": 660}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-tic1011", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}, {"part_id": "part-fail-closed", "attach_point": "body"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 830, "y": 1160}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-fic1012", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}, {"part_id": "part-fail-closed", "attach_point": "body"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 980, "y": 780}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-fic1120", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}, {"part_id": "part-fail-closed", "attach_point": "body"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 980, "y": 880}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-fic1122", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}, {"part_id": "part-fail-closed", "attach_point": "body"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 980, "y": 980}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-fic1124", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}, {"part_id": "part-fail-closed", "attach_point": "body"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 1280, "y": 860}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-fic1220", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}, {"part_id": "part-fail-closed", "attach_point": "body"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 1280, "y": 990}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-fic1222", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}, {"part_id": "part-fail-closed", "attach_point": "body"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 1780, "y": 1030}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-lic1320", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}, {"part_id": "part-fail-closed", "attach_point": "body"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 1780, "y": 1310}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-lic1330", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}, {"part_id": "part-fail-closed", "attach_point": "body"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 1780, "y": 1380}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-lic1331", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}, {"part_id": "part-fail-closed", "attach_point": "body"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 2050, "y": 910}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-lic1340", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}, {"part_id": "part-fail-closed", "attach_point": "body"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 2050, "y": 1210}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-lic1341", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}, {"part_id": "part-fail-closed", "attach_point": "body"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 1640, "y": 200}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-fic1411", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}, {"part_id": "part-fail-closed", "attach_point": "body"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 2100, "y": 230}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-fic1501", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}, {"part_id": "part-fail-closed", "attach_point": "body"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 2870, "y": 490}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-fic2222", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}, {"part_id": "part-fail-closed", "attach_point": "body"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 2980, "y": 340}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-lic2220", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}, {"part_id": "part-fail-closed", "attach_point": "body"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 2900, "y": 990}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-fic2231", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}, {"part_id": "part-fail-closed", "attach_point": "body"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 2900, "y": 1150}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-fic2230", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}, {"part_id": "part-fail-closed", "attach_point": "body"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 2720, "y": 1630}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-lic2211", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}, {"part_id": "part-fail-closed", "attach_point": "body"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 2560, "y": 1810}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-tic2260", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}, {"part_id": "part-fail-closed", "attach_point": "body"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 2440, "y": 1810}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-fic2261", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}, {"part_id": "part-fail-closed", "attach_point": "body"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 3150, "y": 460}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-fic2332", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}, {"part_id": "part-fail-closed", "attach_point": "body"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 1730, "y": 440}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-tic1305", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}, {"part_id": "part-fail-open", "attach_point": "body"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 1660, "y": 1190}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-pic1301", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}, {"part_id": "part-fail-open", "attach_point": "body"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 2640, "y": 570}, "rotation": 0, "shape_id": "valve-control", "element_id": "cv-pic2201", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}, {"part_id": "part-fail-open", "attach_point": "body"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 100, "y": 1050}, "rotation": 0, "shape_id": "valve-gate", "element_id": "xv-2501", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 1160, "y": 200}, "rotation": 0, "shape_id": "valve-gate", "element_id": "xv-2502", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}]}, {"scale": {"x": 1.0, "y": 1.0}, "mirror": "none", "variant": "opt1", "position": {"x": 1845, "y": 280}, "rotation": 0, "shape_id": "valve-gate", "element_id": "xv-2503", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}]}, {"scale": {"x": 0.8, "y": 0.8}, "mirror": "none", "variant": "opt1", "position": {"x": 830, "y": 1170}, "rotation": 0, "shape_id": "valve-gate", "element_id": "xv-2504", "configuration": null, "composable_parts": [{"part_id": "part-actuator-pneumatic", "attach_point": "stem"}]}], "bindings": {"kpi-lhsv": {"mapping": {"type": "text", "format": "%.2f", "suffix": " 1/hr"}, "attribute": "text", "point_tag": "25-CALC-3103", "source_hint": "SimBLAH-OPC"}, "kpi-h2cons": {"mapping": {"type": "text", "format": "%.0f", "suffix": " SCF/bbl"}, "attribute": "text", "point_tag": "25-CALC-3105", "source_hint": "SimBLAH-OPC"}, "kpi-kero-s": {"mapping": {"type": "text", "format": "%.1f", "suffix": " ppm"}, "attribute": "text", "point_tag": "25-AI-3002", "source_hint": "SimBLAH-OPC"}, "alarm-c2501": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-FI-2201", "25-TIC-2260.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-c2502": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-PIC-2201.PV", "25-TI-2208", "25-TI-2204", "25-TI-2201", "25-LIC-2211.PV", "25-AI-2232"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-c2507": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-AI-1402", "25-FIC-1411.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-h2501": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-TIC-1010.PV", "25-TIC-1011.PV", "25-TI-1016", "25-TI-1015", "25-AI-1010", "25-TI-1020", "25-TI-1021", "25-TI-1022", "25-TI-1023", "25-TI-1024", "25-TI-1025", "25-TI-1026", "25-TI-1027", "25-TI-1028", "25-TI-1029", "25-TI-1030", "25-TI-1031"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-k2501": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-SIC-2001.PV", "25-PI-2001", "25-PI-2002", "25-TI-2002", "25-CALC-2003", "25-VT-2001-1X", "25-K-2501.RUN"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-k2502": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-K-2502.RUN", "25-PI-2031"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-p2501": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-P-2501A.RUN", "25-PI-1003", "25-II-1001"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-r2501": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-TI-1110", "25-TI-1111", "25-TI-1120", "25-TI-1121", "25-TI-1130", "25-TI-1131", "25-TI-1140", "25-TI-1141", "25-PI-1101", "25-PDI-1101", "25-PSHH-1101"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-r2502": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-TI-1210", "25-TI-1211", "25-TI-1220", "25-TI-1221", "25-TI-1230", "25-TI-1231", "25-PI-1201", "25-PDI-1201", "25-PSHH-1201"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-v2501": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-LIC-1001.PV", "25-TI-1001", "25-PI-1004"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-v2502": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-LIC-1320.PV", "25-TI-1321", "25-PI-1321"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-v2503": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-LIC-1330.PV", "25-LIC-1331.PV", "25-TI-1332", "25-PIC-1301.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-v2504": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-LIC-1340.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-v2505": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-LIC-1341.PV"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "alarm-v2508": {"mapping": {"mode": "aggregate", "type": "alarm_indicator", "equipment_point_tags": ["25-LIC-2220.PV", "25-FI-2223"]}, "attribute": "visibility", "source_hint": "SimBLAH-OPC"}, "kpi-uco-api": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degAPI"}, "attribute": "text", "point_tag": "25-AI-3009", "source_hint": "SimBLAH-OPC"}, "kpi-conv1001": {"mapping": {"type": "text", "format": "%.1f", "suffix": " vol%"}, "attribute": "text", "point_tag": "25-CONV-1001", "source_hint": "SimBLAH-OPC"}, "kpi-diesel-s": {"mapping": {"type": "text", "format": "%.1f", "suffix": " ppm"}, "attribute": "text", "point_tag": "25-AI-3001", "source_hint": "SimBLAH-OPC"}, "kpi-r2501-dt": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-CALC-3106", "source_hint": "SimBLAH-OPC"}, "kpi-r2502-dt": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-CALC-3107", "source_hint": "SimBLAH-OPC"}, "alarm-fic1001": {"mapping": {"mode": "single", "type": "alarm_indicator"}, "attribute": "visibility", "point_tag": "25-FIC-1001.PV", "source_hint": "SimBLAH-OPC"}, "gauge-lic1001": {"mapping": {"type": "fill_gauge", "range_hi": 100, "range_lo": 0, "placement": "vessel_overlay", "fill_direction": "up", "clip_to_shape_id": "vessel-v2501"}, "attribute": "fill", "point_tag": "25-LIC-1001.PV", "source_hint": "SimBLAH-OPC"}, "gauge-lic1320": {"mapping": {"type": "fill_gauge", "range_hi": 100, "range_lo": 0, "placement": "vessel_overlay", "fill_direction": "up", "clip_to_shape_id": "vessel-v2502"}, "attribute": "fill", "point_tag": "25-LIC-1320.PV", "source_hint": "SimBLAH-OPC"}, "gauge-lic1330": {"mapping": {"type": "fill_gauge", "range_hi": 100, "range_lo": 0, "placement": "vessel_overlay", "fill_direction": "up", "clip_to_shape_id": "vessel-v2503"}, "attribute": "fill", "point_tag": "25-LIC-1330.PV", "source_hint": "SimBLAH-OPC"}, "gauge-lic1340": {"mapping": {"type": "fill_gauge", "range_hi": 100, "range_lo": 0, "placement": "vessel_overlay", "fill_direction": "up", "clip_to_shape_id": "vessel-v2504"}, "attribute": "fill", "point_tag": "25-LIC-1340.PV", "source_hint": "SimBLAH-OPC"}, "gauge-lic1341": {"mapping": {"type": "fill_gauge", "range_hi": 100, "range_lo": 0, "placement": "vessel_overlay", "fill_direction": "up", "clip_to_shape_id": "vessel-v2505"}, "attribute": "fill", "point_tag": "25-LIC-1341.PV", "source_hint": "SimBLAH-OPC"}, "gauge-lic2211": {"mapping": {"type": "fill_gauge", "range_hi": 100, "range_lo": 0, "placement": "vessel_overlay", "fill_direction": "up", "clip_to_shape_id": "column-c2502"}, "attribute": "fill", "point_tag": "25-LIC-2211.PV", "source_hint": "SimBLAH-OPC"}, "gauge-lic2220": {"mapping": {"type": "fill_gauge", "range_hi": 100, "range_lo": 0, "placement": "vessel_overlay", "fill_direction": "up", "clip_to_shape_id": "vessel-v2508"}, "attribute": "fill", "point_tag": "25-LIC-2220.PV", "source_hint": "SimBLAH-OPC"}, "kpi-naphtha-s": {"mapping": {"type": "text", "format": "%.1f", "suffix": " ppm"}, "attribute": "text", "point_tag": "25-AI-3003", "source_hint": "SimBLAH-OPC"}, "kpi-wabt-comb": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-WABT-COMB", "source_hint": "SimBLAH-OPC"}, "status-xv2501": {"mapping": {"type": "state_class", "states": {"0": "CLOSED", "1": "OPEN"}}, "attribute": "class", "point_tag": "25-XV-2501", "source_hint": "SimBLAH-OPC"}, "status-xv2502": {"mapping": {"type": "state_class", "states": {"0": "CLOSED", "1": "OPEN"}}, "attribute": "class", "point_tag": "25-XV-2502", "source_hint": "SimBLAH-OPC"}, "status-xv2503": {"mapping": {"type": "state_class", "states": {"0": "CLOSED", "1": "OPEN"}}, "attribute": "class", "point_tag": "25-XV-2503", "source_hint": "SimBLAH-OPC"}, "status-xv2504": {"mapping": {"type": "state_class", "states": {"0": "CLOSED", "1": "OPEN"}}, "attribute": "class", "point_tag": "25-XV-2504", "source_hint": "SimBLAH-OPC"}, "readout-ai1010": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-AI-1010", "source_hint": "SimBLAH-OPC"}, "readout-ai1102": {"mapping": {"type": "text", "format": "%.1f", "suffix": " ppm"}, "attribute": "text", "point_tag": "25-AI-1102", "source_hint": "SimBLAH-OPC"}, "readout-ai1301": {"mapping": {"type": "text", "format": "%.1f", "suffix": " ppm"}, "attribute": "text", "point_tag": "25-AI-1301", "source_hint": "SimBLAH-OPC"}, "readout-ai1401": {"mapping": {"type": "text", "format": "%.1f", "suffix": " mol%"}, "attribute": "text", "point_tag": "25-AI-1401", "source_hint": "SimBLAH-OPC"}, "readout-ai1402": {"mapping": {"type": "text", "format": "%.1f", "suffix": " ppm"}, "attribute": "text", "point_tag": "25-AI-1402", "source_hint": "SimBLAH-OPC"}, "readout-ai2232": {"mapping": {"type": "text", "format": "%.1f", "suffix": " ppm"}, "attribute": "text", "point_tag": "25-AI-2232", "source_hint": "SimBLAH-OPC"}, "readout-fi0001": {"mapping": {"type": "text", "format": "%.0f", "suffix": " BPD"}, "attribute": "text", "point_tag": "25-FI-0001", "source_hint": "SimBLAH-OPC"}, "readout-fi1002": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FI-1002", "source_hint": "SimBLAH-OPC"}, "readout-fi2201": {"mapping": {"type": "text", "format": "%.0f", "suffix": " BPD"}, "attribute": "text", "point_tag": "25-FI-2201", "source_hint": "SimBLAH-OPC"}, "readout-fi2212": {"mapping": {"type": "text", "format": "%.0f", "suffix": " BPD"}, "attribute": "text", "point_tag": "25-FI-2212", "source_hint": "SimBLAH-OPC"}, "readout-fi2223": {"mapping": {"type": "text", "format": "%.0f", "suffix": " BPD"}, "attribute": "text", "point_tag": "25-FI-2223", "source_hint": "SimBLAH-OPC"}, "readout-fi2313": {"mapping": {"type": "text", "format": "%.0f", "suffix": " BPD"}, "attribute": "text", "point_tag": "25-FI-2313", "source_hint": "SimBLAH-OPC"}, "readout-fi2314": {"mapping": {"type": "text", "format": "%.0f", "suffix": " BPD"}, "attribute": "text", "point_tag": "25-FI-2314", "source_hint": "SimBLAH-OPC"}, "readout-fi9001": {"mapping": {"type": "text", "format": "%.1f", "suffix": " BPD"}, "attribute": "text", "point_tag": "25-FI-9001", "source_hint": "SimBLAH-OPC"}, "readout-ii1001": {"mapping": {"type": "text", "format": "%.1f", "suffix": " A"}, "attribute": "text", "point_tag": "25-II-1001", "source_hint": "SimBLAH-OPC"}, "readout-ii2001": {"mapping": {"type": "text", "format": "%.1f", "suffix": " klb/hr"}, "attribute": "text", "point_tag": "25-II-2001", "source_hint": "SimBLAH-OPC"}, "readout-pi1003": {"mapping": {"type": "text", "format": "%.0f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-1003", "source_hint": "SimBLAH-OPC"}, "readout-pi1004": {"mapping": {"type": "text", "format": "%.0f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-1004", "source_hint": "SimBLAH-OPC"}, "readout-pi1101": {"mapping": {"type": "text", "format": "%.0f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-1101", "source_hint": "SimBLAH-OPC"}, "readout-pi1201": {"mapping": {"type": "text", "format": "%.0f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-1201", "source_hint": "SimBLAH-OPC"}, "readout-pi1321": {"mapping": {"type": "text", "format": "%.0f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-1321", "source_hint": "SimBLAH-OPC"}, "readout-pi2001": {"mapping": {"type": "text", "format": "%.0f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-2001", "source_hint": "SimBLAH-OPC"}, "readout-pi2002": {"mapping": {"type": "text", "format": "%.0f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-2002", "source_hint": "SimBLAH-OPC"}, "readout-pi2031": {"mapping": {"type": "text", "format": "%.0f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-2031", "source_hint": "SimBLAH-OPC"}, "readout-pi9001": {"mapping": {"type": "text", "format": "%.0f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PI-9001", "source_hint": "SimBLAH-OPC"}, "readout-ti1001": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1001", "source_hint": "SimBLAH-OPC"}, "readout-ti1004": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1004", "source_hint": "SimBLAH-OPC"}, "readout-ti1006": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1006", "source_hint": "SimBLAH-OPC"}, "readout-ti1015": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1015", "source_hint": "SimBLAH-OPC"}, "readout-ti1016": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1016", "source_hint": "SimBLAH-OPC"}, "readout-ti1020": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1020", "source_hint": "SimBLAH-OPC"}, "readout-ti1021": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1021", "source_hint": "SimBLAH-OPC"}, "readout-ti1022": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1022", "source_hint": "SimBLAH-OPC"}, "readout-ti1023": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1023", "source_hint": "SimBLAH-OPC"}, "readout-ti1024": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1024", "source_hint": "SimBLAH-OPC"}, "readout-ti1025": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1025", "source_hint": "SimBLAH-OPC"}, "readout-ti1026": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1026", "source_hint": "SimBLAH-OPC"}, "readout-ti1027": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1027", "source_hint": "SimBLAH-OPC"}, "readout-ti1028": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1028", "source_hint": "SimBLAH-OPC"}, "readout-ti1029": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1029", "source_hint": "SimBLAH-OPC"}, "readout-ti1030": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1030", "source_hint": "SimBLAH-OPC"}, "readout-ti1031": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1031", "source_hint": "SimBLAH-OPC"}, "readout-ti1110": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1110", "source_hint": "SimBLAH-OPC"}, "readout-ti1111": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1111", "source_hint": "SimBLAH-OPC"}, "readout-ti1120": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1120", "source_hint": "SimBLAH-OPC"}, "readout-ti1121": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1121", "source_hint": "SimBLAH-OPC"}, "readout-ti1130": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1130", "source_hint": "SimBLAH-OPC"}, "readout-ti1131": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1131", "source_hint": "SimBLAH-OPC"}, "readout-ti1140": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1140", "source_hint": "SimBLAH-OPC"}, "readout-ti1141": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1141", "source_hint": "SimBLAH-OPC"}, "readout-ti1160": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1160", "source_hint": "SimBLAH-OPC"}, "readout-ti1210": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1210", "source_hint": "SimBLAH-OPC"}, "readout-ti1211": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1211", "source_hint": "SimBLAH-OPC"}, "readout-ti1220": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1220", "source_hint": "SimBLAH-OPC"}, "readout-ti1221": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1221", "source_hint": "SimBLAH-OPC"}, "readout-ti1230": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1230", "source_hint": "SimBLAH-OPC"}, "readout-ti1231": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1231", "source_hint": "SimBLAH-OPC"}, "readout-ti1250": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1250", "source_hint": "SimBLAH-OPC"}, "readout-ti1321": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1321", "source_hint": "SimBLAH-OPC"}, "readout-ti1332": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1332", "source_hint": "SimBLAH-OPC"}, "readout-ti2002": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2002", "source_hint": "SimBLAH-OPC"}, "readout-ti2201": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2201", "source_hint": "SimBLAH-OPC"}, "readout-ti2204": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2204", "source_hint": "SimBLAH-OPC"}, "readout-ti2208": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-2208", "source_hint": "SimBLAH-OPC"}, "readout-vt2001": {"mapping": {"type": "text", "format": "%.1f", "suffix": " mil"}, "attribute": "text", "point_tag": "25-VT-2001-1X", "source_hint": "SimBLAH-OPC"}, "bar-fic1001-out": {"mapping": {"type": "analog_bar", "range_hi": 100, "range_lo": 0}, "attribute": "fill", "point_tag": "25-FIC-1001.OUT", "source_hint": "SimBLAH-OPC"}, "bar-fic1012-out": {"mapping": {"type": "analog_bar", "range_hi": 100, "range_lo": 0}, "attribute": "fill", "point_tag": "25-FIC-1012.OUT", "source_hint": "SimBLAH-OPC"}, "bar-lic1001-out": {"mapping": {"type": "analog_bar", "range_hi": 100, "range_lo": 0}, "attribute": "fill", "point_tag": "25-LIC-1001.OUT", "source_hint": "SimBLAH-OPC"}, "bar-sic2001-out": {"mapping": {"type": "analog_bar", "range_hi": 100, "range_lo": 0}, "attribute": "fill", "point_tag": "25-SIC-2001.OUT", "source_hint": "SimBLAH-OPC"}, "bar-tic1010-out": {"mapping": {"type": "analog_bar", "range_hi": 100, "range_lo": 0}, "attribute": "fill", "point_tag": "25-TIC-1010.OUT", "source_hint": "SimBLAH-OPC"}, "bar-tic1011-out": {"mapping": {"type": "analog_bar", "range_hi": 100, "range_lo": 0}, "attribute": "fill", "point_tag": "25-TIC-1011.OUT", "source_hint": "SimBLAH-OPC"}, "bar-tic1101-out": {"mapping": {"type": "analog_bar", "range_hi": 100, "range_lo": 0}, "attribute": "fill", "point_tag": "25-TIC-1101.OUT", "source_hint": "SimBLAH-OPC"}, "bar-tic1201-out": {"mapping": {"type": "analog_bar", "range_hi": 100, "range_lo": 0}, "attribute": "fill", "point_tag": "25-TIC-1201.OUT", "source_hint": "SimBLAH-OPC"}, "readout-pdi1101": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSI"}, "attribute": "text", "point_tag": "25-PDI-1101", "source_hint": "SimBLAH-OPC"}, "readout-pdi1201": {"mapping": {"type": "text", "format": "%.1f", "suffix": " PSI"}, "attribute": "text", "point_tag": "25-PDI-1201", "source_hint": "SimBLAH-OPC"}, "status-pshh1101": {"mapping": {"type": "state_class", "states": {"0": "NORMAL", "1": "TRIP"}}, "attribute": "class", "point_tag": "25-PSHH-1101", "source_hint": "SimBLAH-OPC"}, "status-pshh1201": {"mapping": {"type": "state_class", "states": {"0": "NORMAL", "1": "TRIP"}}, "attribute": "class", "point_tag": "25-PSHH-1201", "source_hint": "SimBLAH-OPC"}, "status-tshh1010": {"mapping": {"type": "state_class", "states": {"0": "NORMAL", "1": "TRIP"}}, "attribute": "class", "point_tag": "25-TSHH-1010", "source_hint": "SimBLAH-OPC"}, "readout-calc2003": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-CALC-2003", "source_hint": "SimBLAH-OPC"}, "readout-conv2501": {"mapping": {"type": "text", "format": "%.1f", "suffix": " vol%"}, "attribute": "text", "point_tag": "25-CONV-2501", "source_hint": "SimBLAH-OPC"}, "readout-h2pp1101": {"mapping": {"type": "text", "format": "%.0f", "suffix": " PSIA"}, "attribute": "text", "point_tag": "25-H2PP-1101", "source_hint": "SimBLAH-OPC"}, "readout-h2pp1201": {"mapping": {"type": "text", "format": "%.0f", "suffix": " PSIA"}, "attribute": "text", "point_tag": "25-H2PP-1201", "source_hint": "SimBLAH-OPC"}, "readout-max-skin": {"mapping": {"type": "text", "format": "%.0f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TI-1020", "source_hint": "SimBLAH-OPC"}, "readout-wabt1101": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-WABT-1101", "source_hint": "SimBLAH-OPC"}, "readout-wabt1201": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-WABT-1201", "source_hint": "SimBLAH-OPC"}, "status-esd-k2501": {"mapping": {"type": "state_class", "states": {"0": "STOP", "1": "RUN"}}, "attribute": "class", "point_tag": "25-K-2501.RUN", "source_hint": "SimBLAH-OPC"}, "status-esd-k2502": {"mapping": {"type": "state_class", "states": {"0": "STOP", "1": "RUN"}}, "attribute": "class", "point_tag": "25-K-2502.RUN", "source_hint": "SimBLAH-OPC"}, "status-esd-p2501": {"mapping": {"type": "state_class", "states": {"0": "STOP", "1": "RUN"}}, "attribute": "class", "point_tag": "25-P-2501A.RUN", "source_hint": "SimBLAH-OPC"}, "status-k2501-run": {"mapping": {"type": "state_class", "states": {"0": "STOP", "1": "RUN"}}, "attribute": "class", "point_tag": "25-K-2501.RUN", "source_hint": "SimBLAH-OPC"}, "status-k2502-run": {"mapping": {"type": "state_class", "states": {"0": "STOP", "1": "RUN"}}, "attribute": "class", "point_tag": "25-K-2502.RUN", "source_hint": "SimBLAH-OPC"}, "status-p2501-run": {"mapping": {"type": "state_class", "states": {"0": "STOP", "1": "RUN"}}, "attribute": "class", "point_tag": "25-P-2501A.RUN", "source_hint": "SimBLAH-OPC"}, "readout-fic1001-pv": {"mapping": {"type": "text", "format": "%.0f", "suffix": " BPD"}, "attribute": "text", "point_tag": "25-FIC-1001.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic1001-sp": {"mapping": {"type": "text", "format": "%.0f", "suffix": " BPD"}, "attribute": "text", "point_tag": "25-FIC-1001.SP", "source_hint": "SimBLAH-OPC"}, "readout-fic1012-pv": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FIC-1012.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic1012-sp": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FIC-1012.SP", "source_hint": "SimBLAH-OPC"}, "readout-fic1120-pv": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FIC-1120.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic1120-sp": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FIC-1120.SP", "source_hint": "SimBLAH-OPC"}, "readout-fic1122-pv": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FIC-1122.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic1122-sp": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FIC-1122.SP", "source_hint": "SimBLAH-OPC"}, "readout-fic1124-pv": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FIC-1124.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic1124-sp": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FIC-1124.SP", "source_hint": "SimBLAH-OPC"}, "readout-fic1220-pv": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FIC-1220.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic1220-sp": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FIC-1220.SP", "source_hint": "SimBLAH-OPC"}, "readout-fic1222-pv": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FIC-1222.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic1222-sp": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FIC-1222.SP", "source_hint": "SimBLAH-OPC"}, "readout-fic1411-pv": {"mapping": {"type": "text", "format": "%.0f", "suffix": " GPM"}, "attribute": "text", "point_tag": "25-FIC-1411.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic1411-sp": {"mapping": {"type": "text", "format": "%.0f", "suffix": " GPM"}, "attribute": "text", "point_tag": "25-FIC-1411.SP", "source_hint": "SimBLAH-OPC"}, "readout-fic1501-pv": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FIC-1501.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic1501-sp": {"mapping": {"type": "text", "format": "%.2f", "suffix": " MMSCFD"}, "attribute": "text", "point_tag": "25-FIC-1501.SP", "source_hint": "SimBLAH-OPC"}, "readout-fic2222-pv": {"mapping": {"type": "text", "format": "%.0f", "suffix": " BPD"}, "attribute": "text", "point_tag": "25-FIC-2222.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic2222-sp": {"mapping": {"type": "text", "format": "%.0f", "suffix": " BPD"}, "attribute": "text", "point_tag": "25-FIC-2222.SP", "source_hint": "SimBLAH-OPC"}, "readout-fic2230-pv": {"mapping": {"type": "text", "format": "%.0f", "suffix": " BPD"}, "attribute": "text", "point_tag": "25-FIC-2230.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic2230-sp": {"mapping": {"type": "text", "format": "%.0f", "suffix": " BPD"}, "attribute": "text", "point_tag": "25-FIC-2230.SP", "source_hint": "SimBLAH-OPC"}, "readout-fic2231-pv": {"mapping": {"type": "text", "format": "%.0f", "suffix": " BPD"}, "attribute": "text", "point_tag": "25-FIC-2231.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic2231-sp": {"mapping": {"type": "text", "format": "%.0f", "suffix": " BPD"}, "attribute": "text", "point_tag": "25-FIC-2231.SP", "source_hint": "SimBLAH-OPC"}, "readout-fic2261-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " klb/hr"}, "attribute": "text", "point_tag": "25-FIC-2261.PV", "source_hint": "SimBLAH-OPC"}, "readout-fic2261-sp": {"mapping": {"type": "text", "format": "%.1f", "suffix": " klb/hr"}, "attribute": "text", "point_tag": "25-FIC-2261.SP", "source_hint": "SimBLAH-OPC"}, "readout-fic2332-pv": {"mapping": {"type": "text", "format": "%.0f", "suffix": " BPD"}, "attribute": "text", "point_tag": "25-FIC-2332.PV", "source_hint": "SimBLAH-OPC"}, "readout-lic1001-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-1001.PV", "source_hint": "SimBLAH-OPC"}, "readout-lic1001-sp": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-1001.SP", "source_hint": "SimBLAH-OPC"}, "readout-lic1320-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-1320.PV", "source_hint": "SimBLAH-OPC"}, "readout-lic1320-sp": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-1320.SP", "source_hint": "SimBLAH-OPC"}, "readout-lic1330-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-1330.PV", "source_hint": "SimBLAH-OPC"}, "readout-lic1330-sp": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-1330.SP", "source_hint": "SimBLAH-OPC"}, "readout-lic1331-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-1331.PV", "source_hint": "SimBLAH-OPC"}, "readout-lic1331-sp": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-1331.SP", "source_hint": "SimBLAH-OPC"}, "readout-lic1340-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-1340.PV", "source_hint": "SimBLAH-OPC"}, "readout-lic1340-sp": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-1340.SP", "source_hint": "SimBLAH-OPC"}, "readout-lic1341-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-1341.PV", "source_hint": "SimBLAH-OPC"}, "readout-lic1341-sp": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-1341.SP", "source_hint": "SimBLAH-OPC"}, "readout-lic2211-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-2211.PV", "source_hint": "SimBLAH-OPC"}, "readout-lic2211-sp": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-2211.SP", "source_hint": "SimBLAH-OPC"}, "readout-lic2220-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-2220.PV", "source_hint": "SimBLAH-OPC"}, "readout-lic2220-sp": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-2220.SP", "source_hint": "SimBLAH-OPC"}, "readout-pic1301-pv": {"mapping": {"type": "text", "format": "%.0f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PIC-1301.PV", "source_hint": "SimBLAH-OPC"}, "readout-pic1301-sp": {"mapping": {"type": "text", "format": "%.0f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PIC-1301.SP", "source_hint": "SimBLAH-OPC"}, "readout-pic2201-pv": {"mapping": {"type": "text", "format": "%.0f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PIC-2201.PV", "source_hint": "SimBLAH-OPC"}, "readout-pic2201-sp": {"mapping": {"type": "text", "format": "%.0f", "suffix": " PSIG"}, "attribute": "text", "point_tag": "25-PIC-2201.SP", "source_hint": "SimBLAH-OPC"}, "readout-sic2001-pv": {"mapping": {"type": "text", "format": "%.0f", "suffix": " RPM"}, "attribute": "text", "point_tag": "25-SIC-2001.PV", "source_hint": "SimBLAH-OPC"}, "readout-sic2001-sp": {"mapping": {"type": "text", "format": "%.0f", "suffix": " RPM"}, "attribute": "text", "point_tag": "25-SIC-2001.SP", "source_hint": "SimBLAH-OPC"}, "readout-tic1010-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TIC-1010.PV", "source_hint": "SimBLAH-OPC"}, "readout-tic1010-sp": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TIC-1010.SP", "source_hint": "SimBLAH-OPC"}, "readout-tic1011-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TIC-1011.PV", "source_hint": "SimBLAH-OPC"}, "readout-tic1011-sp": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TIC-1011.SP", "source_hint": "SimBLAH-OPC"}, "readout-tic1101-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TIC-1101.PV", "source_hint": "SimBLAH-OPC"}, "readout-tic1101-sp": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TIC-1101.SP", "source_hint": "SimBLAH-OPC"}, "readout-tic1201-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TIC-1201.PV", "source_hint": "SimBLAH-OPC"}, "readout-tic1201-sp": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TIC-1201.SP", "source_hint": "SimBLAH-OPC"}, "readout-tic1305-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TIC-1305.PV", "source_hint": "SimBLAH-OPC"}, "readout-tic1305-sp": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TIC-1305.SP", "source_hint": "SimBLAH-OPC"}, "readout-tic2260-pv": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TIC-2260.PV", "source_hint": "SimBLAH-OPC"}, "readout-tic2260-sp": {"mapping": {"type": "text", "format": "%.1f", "suffix": " degF"}, "attribute": "text", "point_tag": "25-TIC-2260.SP", "source_hint": "SimBLAH-OPC"}, "sparkline-calc2003": {"mapping": {"type": "sparkline", "time_window_minutes": 60}, "attribute": "text", "point_tag": "25-CALC-2003", "source_hint": "SimBLAH-OPC"}, "sparkline-wabt1101": {"mapping": {"type": "sparkline", "time_window_minutes": 60}, "attribute": "text", "point_tag": "25-WABT-1101", "source_hint": "SimBLAH-OPC"}, "sparkline-wabt1201": {"mapping": {"type": "sparkline", "time_window_minutes": 60}, "attribute": "text", "point_tag": "25-WABT-1201", "source_hint": "SimBLAH-OPC"}, "readout-fic1001-out": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-FIC-1001.OUT", "source_hint": "SimBLAH-OPC"}, "readout-fic1012-out": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-FIC-1012.OUT", "source_hint": "SimBLAH-OPC"}, "readout-fic1120-out": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-FIC-1120.OUT", "source_hint": "SimBLAH-OPC"}, "readout-fic1122-out": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-FIC-1122.OUT", "source_hint": "SimBLAH-OPC"}, "readout-fic1124-out": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-FIC-1124.OUT", "source_hint": "SimBLAH-OPC"}, "readout-fic1220-out": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-FIC-1220.OUT", "source_hint": "SimBLAH-OPC"}, "readout-fic1222-out": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-FIC-1222.OUT", "source_hint": "SimBLAH-OPC"}, "readout-fic1411-out": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-FIC-1411.OUT", "source_hint": "SimBLAH-OPC"}, "readout-fic1501-out": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-FIC-1501.OUT", "source_hint": "SimBLAH-OPC"}, "readout-fic2222-out": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-FIC-2222.OUT", "source_hint": "SimBLAH-OPC"}, "readout-fic2230-out": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-FIC-2230.OUT", "source_hint": "SimBLAH-OPC"}, "readout-fic2231-out": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-FIC-2231.OUT", "source_hint": "SimBLAH-OPC"}, "readout-fic2261-out": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-FIC-2261.OUT", "source_hint": "SimBLAH-OPC"}, "readout-lic1001-out": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-1001.OUT", "source_hint": "SimBLAH-OPC"}, "readout-lic1320-out": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-1320.OUT", "source_hint": "SimBLAH-OPC"}, "readout-lic1330-out": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-1330.OUT", "source_hint": "SimBLAH-OPC"}, "readout-lic1331-out": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-1331.OUT", "source_hint": "SimBLAH-OPC"}, "readout-lic1340-out": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-1340.OUT", "source_hint": "SimBLAH-OPC"}, "readout-lic1341-out": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-1341.OUT", "source_hint": "SimBLAH-OPC"}, "readout-lic2211-out": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-2211.OUT", "source_hint": "SimBLAH-OPC"}, "readout-lic2220-out": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-LIC-2220.OUT", "source_hint": "SimBLAH-OPC"}, "readout-pic1301-out": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-PIC-1301.OUT", "source_hint": "SimBLAH-OPC"}, "readout-pic2201-out": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-PIC-2201.OUT", "source_hint": "SimBLAH-OPC"}, "readout-sic2001-out": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-SIC-2001.OUT", "source_hint": "SimBLAH-OPC"}, "readout-tic1010-out": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-TIC-1010.OUT", "source_hint": "SimBLAH-OPC"}, "readout-tic1011-out": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-TIC-1011.OUT", "source_hint": "SimBLAH-OPC"}, "readout-tic1101-out": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-TIC-1101.OUT", "source_hint": "SimBLAH-OPC"}, "readout-tic1201-out": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-TIC-1201.OUT", "source_hint": "SimBLAH-OPC"}, "readout-tic1305-out": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-TIC-1305.OUT", "source_hint": "SimBLAH-OPC"}, "readout-tic2260-out": {"mapping": {"type": "text", "format": "%.1f", "suffix": " %"}, "attribute": "text", "point_tag": "25-TIC-2260.OUT", "source_hint": "SimBLAH-OPC"}, "readout-uco-rundown": {"mapping": {"type": "text", "format": "%.0f", "suffix": " BPD"}, "attribute": "text", "point_tag": "25-FI-2212", "source_hint": "SimBLAH-OPC"}, "status-fic1001-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-FIC-1001.MODE", "source_hint": "SimBLAH-OPC"}, "status-fic1012-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-FIC-1012.MODE", "source_hint": "SimBLAH-OPC"}, "status-fic1120-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-FIC-1120.MODE", "source_hint": "SimBLAH-OPC"}, "status-fic1122-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-FIC-1122.MODE", "source_hint": "SimBLAH-OPC"}, "status-fic1124-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-FIC-1124.MODE", "source_hint": "SimBLAH-OPC"}, "status-fic1220-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-FIC-1220.MODE", "source_hint": "SimBLAH-OPC"}, "status-fic1222-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-FIC-1222.MODE", "source_hint": "SimBLAH-OPC"}, "status-fic1411-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-FIC-1411.MODE", "source_hint": "SimBLAH-OPC"}, "status-fic1501-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-FIC-1501.MODE", "source_hint": "SimBLAH-OPC"}, "status-fic2222-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-FIC-2222.MODE", "source_hint": "SimBLAH-OPC"}, "status-fic2230-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-FIC-2230.MODE", "source_hint": "SimBLAH-OPC"}, "status-fic2231-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-FIC-2231.MODE", "source_hint": "SimBLAH-OPC"}, "status-fic2261-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-FIC-2261.MODE", "source_hint": "SimBLAH-OPC"}, "status-lic1001-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-LIC-1001.MODE", "source_hint": "SimBLAH-OPC"}, "status-lic1320-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-LIC-1320.MODE", "source_hint": "SimBLAH-OPC"}, "status-lic1330-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-LIC-1330.MODE", "source_hint": "SimBLAH-OPC"}, "status-lic1331-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-LIC-1331.MODE", "source_hint": "SimBLAH-OPC"}, "status-lic1340-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-LIC-1340.MODE", "source_hint": "SimBLAH-OPC"}, "status-lic1341-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-LIC-1341.MODE", "source_hint": "SimBLAH-OPC"}, "status-lic2211-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-LIC-2211.MODE", "source_hint": "SimBLAH-OPC"}, "status-lic2220-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-LIC-2220.MODE", "source_hint": "SimBLAH-OPC"}, "status-pic1301-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-PIC-1301.MODE", "source_hint": "SimBLAH-OPC"}, "status-pic2201-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-PIC-2201.MODE", "source_hint": "SimBLAH-OPC"}, "status-sic2001-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-SIC-2001.MODE", "source_hint": "SimBLAH-OPC"}, "status-tic1010-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-TIC-1010.MODE", "source_hint": "SimBLAH-OPC"}, "status-tic1011-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-TIC-1011.MODE", "source_hint": "SimBLAH-OPC"}, "status-tic1101-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-TIC-1101.MODE", "source_hint": "SimBLAH-OPC"}, "status-tic1201-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-TIC-1201.MODE", "source_hint": "SimBLAH-OPC"}, "status-tic1305-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-TIC-1305.MODE", "source_hint": "SimBLAH-OPC"}, "status-tic2260-mode": {"mapping": {"type": "state_class", "states": {"0": "MAN", "1": "AUTO", "2": "CAS"}}, "attribute": "class", "point_tag": "25-TIC-2260.MODE", "source_hint": "SimBLAH-OPC"}, "readout-kero-rundown": {"mapping": {"type": "text", "format": "%.0f", "suffix": " BPD"}, "attribute": "text", "point_tag": "25-FIC-2230.PV", "source_hint": "SimBLAH-OPC"}, "readout-diesel-rundown": {"mapping": {"type": "text", "format": "%.0f", "suffix": " BPD"}, "attribute": "text", "point_tag": "25-FIC-2231.PV", "source_hint": "SimBLAH-OPC"}}, "metadata": {"tags": ["hcu", "hydrocracker", "unit-25", "reactors", "fractionation", "rgc", "hp-separation"], "width": 3840, "height": 2160, "viewBox": "0 0 3840 2160", "description": "Full Unit 25 Hydrocracker process overview — feed preheat, charge heater, reactors, HP separation, RGC loop, fractionation, and product rundown. Single large canvas, left-to-right flow.", "background_color": "#09090B"}, "annotations": [{"fill": "#A1A1AA", "type": "text", "content": "UNIT 25 — HYDROCRACKER (HCU) — PROCESS OVERVIEW", "position": {"x": 50, "y": 55}, "font_size": 36, "element_id": "label-unit-title"}, {"fill": "#71717A", "type": "text", "content": "LIVE HH:MM:SS UTC", "position": {"x": 3780, "y": 55}, "font_size": 14, "element_id": "label-timestamp"}, {"fill": "#71717A", "type": "text", "content": "Feed & Preheat", "position": {"x": 200, "y": 150}, "font_size": 14, "element_id": "label-zone-feed"}, {"fill": "#71717A", "type": "text", "content": "Charge Heater", "position": {"x": 830, "y": 150}, "font_size": 14, "element_id": "label-zone-heater"}, {"fill": "#71717A", "type": "text", "content": "Reactor Section", "position": {"x": 1300, "y": 150}, "font_size": 14, "element_id": "label-zone-reactor"}, {"fill": "#71717A", "type": "text", "content": "HP Separation", "position": {"x": 1900, "y": 150}, "font_size": 14, "element_id": "label-zone-hpsep"}, {"fill": "#71717A", "type": "text", "content": "RGC Loop", "position": {"x": 1870, "y": 90}, "font_size": 13, "element_id": "label-zone-rgc"}, {"fill": "#71717A", "type": "text", "content": "Fractionation", "position": {"x": 2700, "y": 150}, "font_size": 14, "element_id": "label-zone-frac"}, {"fill": "#71717A", "type": "text", "content": "Products", "position": {"x": 3250, "y": 150}, "font_size": 14, "element_id": "label-zone-products"}, {"fill": "#A1A1AA", "type": "text", "content": "V-2501", "position": {"x": 160, "y": 1195}, "font_size": 12, "element_id": "label-equip-v2501"}, {"fill": "#71717A", "type": "text", "content": "E-2501", "position": {"x": 310, "y": 1055}, "font_size": 11, "element_id": "label-equip-e2501"}, {"fill": "#71717A", "type": "text", "content": "E-2502", "position": {"x": 410, "y": 1055}, "font_size": 11, "element_id": "label-equip-e2502"}, {"fill": "#71717A", "type": "text", "content": "E-2503", "position": {"x": 510, "y": 1055}, "font_size": 11, "element_id": "label-equip-e2503"}, {"fill": "#71717A", "type": "text", "content": "P-2501", "position": {"x": 460, "y": 1255}, "font_size": 11, "element_id": "label-equip-p2501"}, {"fill": "#A1A1AA", "type": "text", "content": "H-2501", "position": {"x": 830, "y": 1120}, "font_size": 18, "element_id": "label-equip-h2501"}, {"fill": "#A1A1AA", "type": "text", "content": "R-2501", "position": {"x": 1160, "y": 1195}, "font_size": 16, "element_id": "label-equip-r2501"}, {"fill": "#A1A1AA", "type": "text", "content": "R-2502", "position": {"x": 1450, "y": 1265}, "font_size": 16, "element_id": "label-equip-r2502"}, {"fill": "#A1A1AA", "type": "text", "content": "A-2501", "position": {"x": 1730, "y": 610}, "font_size": 12, "element_id": "label-equip-a2501"}, {"fill": "#A1A1AA", "type": "text", "content": "V-2502 HHPS", "position": {"x": 1780, "y": 1075}, "font_size": 14, "element_id": "label-equip-v2502"}, {"fill": "#A1A1AA", "type": "text", "content": "V-2503 CHPS", "position": {"x": 1780, "y": 1430}, "font_size": 14, "element_id": "label-equip-v2503"}, {"fill": "#A1A1AA", "type": "text", "content": "V-2504 HLPS", "position": {"x": 2050, "y": 1000}, "font_size": 12, "element_id": "label-equip-v2504"}, {"fill": "#A1A1AA", "type": "text", "content": "V-2505 CLPS", "position": {"x": 2050, "y": 1310}, "font_size": 12, "element_id": "label-equip-v2505"}, {"fill": "#A1A1AA", "type": "text", "content": "V-2506", "position": {"x": 1580, "y": 435}, "font_size": 12, "element_id": "label-equip-v2506"}, {"fill": "#A1A1AA", "type": "text", "content": "C-2507", "position": {"x": 1700, "y": 485}, "font_size": 13, "element_id": "label-equip-c2507"}, {"fill": "#A1A1AA", "type": "text", "content": "K-2501 RGC", "position": {"x": 1900, "y": 430}, "font_size": 14, "element_id": "label-equip-k2501"}, {"fill": "#A1A1AA", "type": "text", "content": "K-2502 MUC", "position": {"x": 2150, "y": 400}, "font_size": 14, "element_id": "label-equip-k2502"}, {"fill": "#A1A1AA", "type": "text", "content": "C-2501", "position": {"x": 2420, "y": 1280}, "font_size": 13, "element_id": "label-equip-c2501"}, {"fill": "#A1A1AA", "type": "text", "content": "C-2502", "position": {"x": 2720, "y": 1340}, "font_size": 14, "element_id": "label-equip-c2502"}, {"fill": "#A1A1AA", "type": "text", "content": "V-2508", "position": {"x": 2980, "y": 470}, "font_size": 12, "element_id": "label-equip-v2508"}, {"fill": "#71717A", "type": "text", "content": "E-Reb", "position": {"x": 2560, "y": 1820}, "font_size": 11, "element_id": "label-equip-ereb"}, {"fill": "#71717A", "type": "text", "content": "RECYCLE H2 LOOP", "position": {"x": 1580, "y": 175}, "font_size": 12, "element_id": "label-recycle-header"}, {"fill": "#71717A", "type": "text", "content": "FEED/EFFLUENT EXCHANGE", "position": {"x": 410, "y": 955}, "font_size": 12, "element_id": "label-fe-exchange"}, {"fill": "#A1A1AA", "type": "text", "content": "LPG", "position": {"x": 3160, "y": 448}, "font_size": 14, "element_id": "label-product-lpg"}, {"fill": "#A1A1AA", "type": "text", "content": "Lt Naphtha (LN)", "position": {"x": 3160, "y": 568}, "font_size": 14, "element_id": "label-product-ln"}, {"fill": "#A1A1AA", "type": "text", "content": "Hvy Naphtha (HN)", "position": {"x": 3160, "y": 688}, "font_size": 14, "element_id": "label-product-hn"}, {"fill": "#A1A1AA", "type": "text", "content": "Kerosene", "position": {"x": 3160, "y": 808}, "font_size": 14, "element_id": "label-product-kero"}, {"fill": "#A1A1AA", "type": "text", "content": "Diesel", "position": {"x": 3160, "y": 948}, "font_size": 14, "element_id": "label-product-diesel"}, {"fill": "#A1A1AA", "type": "text", "content": "UCO (Unconverted)", "position": {"x": 3160, "y": 1688}, "font_size": 14, "element_id": "label-product-uco"}, {"fill": "#71717A", "type": "text", "content": "SOUR WATER", "position": {"x": 1590, "y": 1445}, "font_size": 11, "element_id": "label-sour-water"}, {"fill": "#71717A", "type": "text", "content": "B1", "position": {"x": 1160, "y": 645}, "font_size": 14, "element_id": "label-r2501-bed1"}, {"fill": "#71717A", "type": "text", "content": "B2", "position": {"x": 1160, "y": 771}, "font_size": 14, "element_id": "label-r2501-bed2"}, {"fill": "#71717A", "type": "text", "content": "B3", "position": {"x": 1160, "y": 897}, "font_size": 14, "element_id": "label-r2501-bed3"}, {"fill": "#71717A", "type": "text", "content": "B4", "position": {"x": 1160, "y": 1023}, "font_size": 14, "element_id": "label-r2501-bed4"}, {"fill": "#71717A", "type": "text", "content": "B1", "position": {"x": 1450, "y": 776}, "font_size": 14, "element_id": "label-r2502-bed1"}, {"fill": "#71717A", "type": "text", "content": "B2", "position": {"x": 1450, "y": 914}, "font_size": 14, "element_id": "label-r2502-bed2"}, {"fill": "#71717A", "type": "text", "content": "B3", "position": {"x": 1450, "y": 1052}, "font_size": 14, "element_id": "label-r2502-bed3"}, {"fill": "#71717A", "type": "text", "content": "TUBE SKIN", "position": {"x": 725, "y": 700}, "font_size": 10, "element_id": "label-tube-skin-strip"}, {"fill": "#71717A", "type": "text", "content": "MAX SKIN:", "position": {"x": 706, "y": 1050}, "font_size": 14, "element_id": "label-max-skin"}, {"fill": "#71717A", "type": "text", "content": "ESD / EQUIPMENT STATUS", "position": {"x": 50, "y": 2065}, "font_size": 11, "element_id": "label-esd-row-title"}, {"fill": "#71717A", "type": "text", "content": "Feed Cutoff", "position": {"x": 100, "y": 2085}, "font_size": 11, "element_id": "label-esd-xv2501"}, {"fill": "#71717A", "type": "text", "content": "H2 Isolation", "position": {"x": 230, "y": 2085}, "font_size": 11, "element_id": "label-esd-xv2502"}, {"fill": "#71717A", "type": "text", "content": "RG Isolation", "position": {"x": 360, "y": 2085}, "font_size": 11, "element_id": "label-esd-xv2503"}, {"fill": "#71717A", "type": "text", "content": "Fuel Gas XV", "position": {"x": 490, "y": 2085}, "font_size": 11, "element_id": "label-esd-xv2504"}, {"fill": "#71717A", "type": "text", "content": "P-2501", "position": {"x": 620, "y": 2085}, "font_size": 11, "element_id": "label-esd-p2501"}, {"fill": "#71717A", "type": "text", "content": "K-2501", "position": {"x": 750, "y": 2085}, "font_size": 11, "element_id": "label-esd-k2501"}, {"fill": "#71717A", "type": "text", "content": "K-2502", "position": {"x": 880, "y": 2085}, "font_size": 11, "element_id": "label-esd-k2502"}, {"fill": "#71717A", "type": "text", "content": "Flare Flow", "position": {"x": 1010, "y": 2085}, "font_size": 11, "element_id": "label-esd-flare"}, {"fill": "#71717A", "type": "text", "content": "HP Relief P", "position": {"x": 1140, "y": 2085}, "font_size": 11, "element_id": "label-esd-relief"}, {"fill": "#71717A", "type": "text", "content": "KEY PERFORMANCE INDICATORS", "position": {"x": 3545, "y": 415}, "font_size": 12, "element_id": "label-kpi-title"}, {"fill": "#71717A", "type": "text", "content": "SCALE REFERENCE", "position": {"x": 3660, "y": 2040}, "font_size": 11, "element_id": "label-scale-title"}, {"fill": "#71717A", "type": "text", "content": "≈ 80 ft", "position": {"x": 3740, "y": 2073}, "font_size": 11, "element_id": "label-scale-height"}, {"type": "line", "stroke": "#3F3F46", "content": null, "position": {"x": 700, "y": 180}, "element_id": "divider-zone1-2", "end_position": {"x": 700, "y": 1400}, "stroke_width": 1}, {"type": "line", "stroke": "#3F3F46", "content": null, "position": {"x": 1050, "y": 180}, "element_id": "divider-zone2-3", "end_position": {"x": 1050, "y": 1400}, "stroke_width": 1}, {"type": "line", "stroke": "#3F3F46", "content": null, "position": {"x": 1310, "y": 180}, "element_id": "divider-zone3-4", "end_position": {"x": 1310, "y": 1400}, "stroke_width": 1}, {"type": "line", "stroke": "#3F3F46", "content": null, "position": {"x": 1600, "y": 180}, "element_id": "divider-zone4-5", "end_position": {"x": 1600, "y": 1500}, "stroke_width": 1}, {"type": "line", "stroke": "#3F3F46", "content": null, "position": {"x": 2230, "y": 180}, "element_id": "divider-zone5-6", "end_position": {"x": 2230, "y": 1500}, "stroke_width": 1}, {"type": "line", "stroke": "#3F3F46", "content": null, "position": {"x": 3150, "y": 180}, "element_id": "divider-zone6-7", "end_position": {"x": 3150, "y": 1900}, "stroke_width": 1}, {"type": "line", "stroke": "#3F3F46", "content": null, "position": {"x": 3440, "y": 350}, "element_id": "divider-kpi", "end_position": {"x": 3440, "y": 1920}, "stroke_width": 1}, {"fill": "#18181B", "type": "rect", "width": 1300, "height": 90, "content": null, "opacity": 0.8, "position": {"x": 50, "y": 2010}, "element_id": "rect-esd-row-bg"}, {"fill": "#18181B", "type": "rect", "width": 390, "height": 650, "stroke": "#808080", "content": null, "opacity": 0.4, "position": {"x": 3445, "y": 390}, "element_id": "rect-kpi-panel-bg"}, {"fill": "#18181B", "type": "rect", "width": 190, "height": 80, "stroke": "#3F3F46", "content": null, "position": {"x": 3650, "y": 2020}, "element_id": "rect-scale-bg"}, {"fill": "none", "type": "rect", "width": 16, "height": 50, "stroke": "#808080", "content": null, "position": {"x": 3710, "y": 2048}, "element_id": "shape-scale-r2501"}]}'::jsonb,
  '{"module": "process"}'::jsonb,
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  svg_data = EXCLUDED.svg_data,
  metadata = EXCLUDED.metadata,
  bindings = EXCLUDED.bindings;

