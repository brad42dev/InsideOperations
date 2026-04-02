// ---------------------------------------------------------------------------
// Chart type metadata — name, category, description, pros/cons, usage notes
// Used by ChartTypePicker to populate the left list and right preview panel.
// ---------------------------------------------------------------------------

import type { ChartTypeId } from "./chart-config-types";

export type ChartTier = "initial" | "mid" | "late";
export type ChartLibrary =
  | "uPlot"
  | "ECharts"
  | "Plotly"
  | "Custom"
  | "TanStack";
export type ChartContext = "console" | "dashboard" | "designer" | "report";

/** Which point data categories a chart type can meaningfully render. */
export type PointTypeCategory = "analog" | "boolean" | "discrete_enum" | "any";

export interface ChartScenario {
  role: string;
  title: string;
  description: string;
}

export interface ChartDefinition {
  id: ChartTypeId;
  name: string;
  category: string;
  tier: ChartTier;
  library: ChartLibrary;
  realTime: boolean | "optional";
  description: string;
  benefits: string[];
  downsides: string[];
  usage?: string;
  scenarios?: ChartScenario[];
  /** If present, chart is only available in the listed contexts. Omit = available everywhere. */
  contexts?: ChartContext[];
  /** Which point type categories this chart can render. "any" means unrestricted. */
  acceptedPointTypes: PointTypeCategory[];
}

export const CHART_DEFINITIONS: ChartDefinition[] = [
  // ── Time-Series Trends ──────────────────────────────────────────────────────
  {
    id: 1,
    name: "Trend",
    category: "Time-Series",
    tier: "initial",
    library: "uPlot",
    realTime: true,
    acceptedPointTypes: ["any"],
    description:
      "Multi-pen time-series line chart. Auto-scrolls in live console mode; renders a fixed historical window when the console timeline is engaged. Supports multiple independent Y-axes for variables with different engineering units, and a stacked layout that gives each pen its own horizontal band on a shared time axis.",
    benefits: [
      "Live and historical in one chart — mode follows the console timeline",
      "Up to 12 pens on shared or independent Y-axes",
      "Stacked layout separates variables with incompatible magnitudes",
      "Synchronized crosshair reads all axes at the same instant",
    ],
    downsides: [
      "Beyond 4–5 independent axes, two separate panes are easier to read",
    ],
    usage:
      "Assign related process variables in the Data Points tab. For variables that share engineering units (e.g. multiple temperatures in °C), leave them on the default shared axis — the Scaling tab lets you set a common min/max so proportional comparison is preserved. For variables with incompatible units (e.g. temperature °C, pressure bar, and flow kg/h), assign each to its own axis group in the Scaling tab; the synchronized crosshair lets you read all three at the same moment without unit confusion. Use the Stacked toggle in the toolbar when magnitudes differ so much that a shared axis would visually compress the smaller signal — each pen fills its own band while the time axis stays locked. In live mode the chart auto-scrolls and the duration slider sets how far back you see; in historical mode (console timeline) the chart freezes to the selected window and a Historical badge appears in the toolbar.",
    scenarios: [
      {
        role: "Operator",
        title: "HCU Quench Hydrogen Early Warning",
        description:
          "Watch quench H₂ flow, bed-3 outlet temperature, and reactor differential pressure together on a 15-minute live window during a rate increase. A rising bed temperature that outpaces quench response gives 3–5 minutes of warning before the high-temperature alarm fires — enough time to bring the quench controller into manual and add flow before the trip interlock activates.",
      },
      {
        role: "Controls Engineer",
        title: "PID Loop Tuning — SP, PV, and Output on Independent Axes",
        description:
          "Place setpoint (SP), process variable (PV), and controller output (MV) on three independent axes — PV and SP on °C, output on % — and watch all three during a setpoint step test. The lag between SP change and PV response and the resulting output trajectory directly reveals whether integral time is too aggressive (overshoot) or too slow (long settling). Switch to stacked layout so the output signal isn't visually lost against the temperature scale.",
      },
      {
        role: "Process Engineer",
        title: "Root Cause Analysis for WABT Exceedance",
        description:
          "Engage the console timeline, set a 6-hour window around a documented reactor WABT exceedance, and overlay quench hydrogen flow, recycle purity, and bed outlet temperatures at 1-minute resolution. The historical trend reveals whether temperature rose before or after quench flow dropped — that sequence determines whether the root cause is a controller failure, a hydrogen supply issue, or an operator action.",
      },
      {
        role: "Reliability Engineer",
        title: "Centrifugal Compressor Performance Map Validation",
        description:
          "Plot suction flow (MMSCFD), discharge pressure (psig), shaft speed (RPM), and power (kW) on four independent axes in stacked layout after a rotor replacement. Each pen fills its own band so no signal is compressed, and the shared time axis makes it immediately visible if flow-head relationship at a given speed has changed from the pre-replacement baseline.",
      },
    ],
  },
  {
    id: 4,
    name: "Step Chart",
    category: "Time-Series",
    tier: "initial",
    library: "uPlot",
    realTime: true,
    acceptedPointTypes: ["analog", "boolean", "discrete_enum"],
    description:
      "Horizontal-then-vertical step interpolation for discrete/digital values. A valve is either OPEN or CLOSED — never mid-transition. Rendering discrete states with a sloped line between them implies a smooth transition that does not exist and misrepresents the data.",
    benefits: [
      "Correct visualization for digital and discrete values",
      "Shows exact state transition moments without false interpolation",
      "ISA-compliant discrete state display",
    ],
    downsides: ["Not appropriate for analog continuous variables"],
    usage:
      "Use wherever a point has a finite number of named states: valve open/closed, pump running/stopped, compressor mode (auto/manual/cascade), or any on/off permissive. Assign the digital point in the Data Points tab and configure the label and color for each state value in the Scaling tab. Combine with a Trend chart in the same or adjacent pane — layering pump status below a pressure trend immediately shows whether pressure drops correlate with pump trips. The step function preserves the exact transition time, which is critical for root cause analysis: a sloped line would imply a gradual change that never actually happened.",
    scenarios: [
      {
        role: "Controls Engineer",
        title: "Controller Mode Audit During Incident Investigation",
        description:
          "Plot the mode status (auto/manual/cascade) for the quench flow, feed temperature, and bed outlet temperature controllers as stacked step lanes over a 4-hour investigation window. The step chart reveals whether any controller was left in manual when the temperature exceedance occurred — a critical distinction between an equipment failure and an operator procedure deviation.",
      },
      {
        role: "Operator",
        title: "Compressor Startup Interlock Sequence Monitoring",
        description:
          "Display run permissive status, trip circuit state, lube oil pump running, and seal gas supply as four step lanes during a compressor startup sequence. When a startup fails, the step chart shows which permissive dropped out first and whether it cleared before the operator attempted a restart — eliminating guesswork about the sequence of interlock events.",
      },
      {
        role: "Safety Engineer",
        title: "Hot-Work Permit Area Inhibit State Verification",
        description:
          "Monitor fire and gas detector zone inhibit state, gas alarm state, and flame alarm state as live step lanes during a maintenance hot-work window. The inhibit must remain active throughout the permit; any uninhibited alarm activation during the window is a permit violation that must be escalated and documented regardless of whether a real gas release occurred.",
      },
      {
        role: "Environmental / HSE Engineer",
        title: "SRU Bypass Valve Position — Compliance Evidence",
        description:
          "Review 30 days of SRU tail gas treating bypass valve position (open/closed) and tail gas bypass valve state when preparing the monthly SO₂ compliance report. The step chart provides an irrefutable timestamped record of every bypass-open event and its duration — the evidentiary basis for explaining any permit exceedance to the environmental regulator.",
      },
    ],
  },
  {
    id: 16,
    name: "Batch Comparison",
    category: "Time-Series",
    tier: "mid",
    library: "uPlot",
    realTime: false,
    acceptedPointTypes: ["any"],
    description:
      "Multiple time-series from different time periods overlaid on a common relative time axis (elapsed time from batch start). Compare this batch against a golden batch — the best-performing historical run — to see exactly where and when the current process deviated.",
    benefits: [
      "Identifies batch-to-batch deviations against a golden reference",
      "Aligns multiple runs to a common elapsed-time axis",
      "Golden batch label configurable so operators know which run is the standard",
    ],
    downsides: [
      "Requires a batch-aware process with defined start/end times",
      "Historical data only",
    ],
    usage:
      "In the Data Points tab, assign the variable you want to compare across batches. In the Options tab, set the Reference batch label to identify your golden batch — the best-performing historical run (best yield, best quality, best energy efficiency) — so operators see a clear reference name rather than a timestamp. Select your golden batch time window and overlay the current or recent batches against it. Deviations from the golden batch shape in the first 20–30% of elapsed time often predict end-of-batch quality, making this chart valuable for early intervention. When a batch fails, compare it against the golden batch to identify which phase introduced the deviation — the crossing point of the lines is where the run went wrong.",
    scenarios: [
      {
        role: "Process Engineer",
        title: "HCU Startup Profile vs. Golden Startup",
        description:
          "Align each reactor startup at the moment of feed introduction and overlay WABT rise profiles for the current startup against the last three successful ones. The golden batch reference shows the expected WABT trajectory within ±10°F; a current startup deviating more than 15°F at the 4-hour mark indicates a hydrogen purity, pressure, or catalyst wetout issue that must be corrected before advancing to full rate.",
      },
      {
        role: "Quality Analyst",
        title: "Coker Drum Switch Cycle Repeatability",
        description:
          "Align 20 consecutive drum switch cycles at the switching valve closure moment and overlay the pressure decay curve for each cycle. Cycle-to-cycle variability in pressure decay rate reveals inconsistent quench water flow or steam strip execution — outlier cycles with slow decay indicate incomplete stripping, which creates coke fines and delays the next switch.",
      },
      {
        role: "Operations Manager",
        title: "Reformer Severity Ramp — Best vs. Worst Campaign",
        description:
          "Compare five historical severity ramp campaigns overlaid on elapsed time, plotting reactor outlet temperature against C5+ yield. Each campaign ran at a slightly different ramp rate; the chart shows which rate delivered the best octane pickup per unit of yield loss — informing the optimal ramp rate and recovery strategy for future campaigns and quantifying the production value difference.",
      },
    ],
  },
  {
    id: 22,
    name: "Stacked Area",
    category: "Time-Series",
    tier: "mid",
    library: "uPlot",
    realTime: true,
    acceptedPointTypes: ["analog", "boolean", "discrete_enum"],
    description:
      "Line chart with colored fill below each series, stacked so total height represents the cumulative sum. Shows both the total and each component's contribution over time. The bottom series is the most readable; upper series show relative contribution rather than precise values.",
    benefits: [
      "Shows total and component breakdown simultaneously",
      "Proportional and absolute stacking modes",
      "Live or historical",
    ],
    downsides: [
      "Hard to read accurately when many series are present",
      "Upper series are difficult to compare in absolute terms",
    ],
    usage:
      "Assign each contributing stream in the Data Points tab — I/O stacks them in the order they appear on the list, so put the most important or most stable series at the bottom where the absolute scale is clearest. Use absolute stacking to visualize total plant throughput broken down by unit or feed source: each colored band is one contributor and the top edge of the stack is the plant total. Switch to 100% stacking in the Options tab to show how the product mix or feed composition changes as a proportion of total — useful when absolute volumes fluctuate seasonally and you want to see whether the split is changing independently of volume. Keep to 5 or fewer series; beyond that, the thin upper bands become unreadable and a grouped bar chart communicates the same information more clearly.",
    scenarios: [
      {
        role: "Energy Manager",
        title: "Steam Demand by Consumer — 24-Hour Profile",
        description:
          "Stack hourly steam consumption for each major consumer (crude unit reboiler, HCU preheat, SRU, turbine drives, miscellaneous) into a stacked area over a full day. The chart immediately shows which shift and which unit drove peak demand above header capacity — critical for identifying where demand response curtailment should be called first during a boiler trip.",
      },
      {
        role: "Accounting / Finance",
        title: "Product Revenue Breakdown by Stream — Rolling 12 Months",
        description:
          "Stack monthly product revenue for naphtha, jet fuel, diesel, fuel oil, LPG, and sulfur over a 12-month rolling window using calculated revenue tags (volume × reference price). When the naphtha band narrows while the diesel band widens, it confirms the crude slate shift toward heavier feedstocks that the purchasing team executed — and quantifies the revenue impact of that shift on the margin.",
      },
      {
        role: "Environmental / HSE Engineer",
        title: "GHG Emissions by Combustion Source — 90-Day Rolling",
        description:
          "Stack CO₂-equivalent emissions calculated from fuel gas consumption across all fired equipment — each heater, boiler, and flare pilot as a separate band — over a rolling 90-day window. This directly supports the monthly GHG inventory and reveals which combustion source is driving the facility toward its permitted annual CO₂ cap, allowing for targeted fuel efficiency improvement before a cap is breached.",
      },
      {
        role: "Production Planner",
        title: "Crude Yield Structure — How the Slate Changed",
        description:
          "Stack monthly production volumes for each crude unit product (LPG, naphtha, kerosene, gasoil, residue, loss) as a proportion of total crude charge over a 12-month campaign. When the residue band widens at the expense of distillate, the planner can immediately see the moment the crude slate shifted heavier — and correlate it with a specific crude purchasing change — to recalibrate the forward yield model.",
      },
    ],
  },

  // ── SPC ────────────────────────────────────────────────────────────────────
  {
    id: 24,
    name: "Shewhart Control Chart",
    category: "SPC",
    tier: "mid",
    library: "uPlot",
    realTime: false,
    acceptedPointTypes: ["analog", "boolean", "discrete_enum"],
    description:
      "The foundational SPC chart. Time-series with center line (process mean), UCL at +3σ, and LCL at -3σ. Automated Western Electric rules flag pattern violations with highlighted markers — a single point outside the 3σ limits, or eight consecutive points on one side of the mean, are both signals that the process has changed.",
    benefits: [
      "Detects large sudden shifts (>2σ) immediately",
      "Industry-standard SPC chart — universally understood",
      "Western Electric rule violations flagged automatically",
    ],
    downsides: [
      "Insensitive to small sustained shifts (<1.5σ) — use CUSUM or EWMA for those",
      "Assumes independent, approximately normal observations",
    ],
    usage:
      "Apply to any critical process parameter where you need to distinguish natural variation from a real process change — product quality measurements, yield per shift, catalyst activity, or utility consumption. In I/O, control limits are computed automatically from all data in the displayed window: the chart calculates the mean and ±3σ from whatever duration you set in the toolbar. To establish control limits from a known-stable baseline, set the toolbar duration to cover a period of stable operation (at least 25–30 observations) — the resulting UCL and LCL define what natural variation looks like when the process is in control. Once you have reviewed the limits and confirmed they represent true in-control behavior, you can extend the duration forward to include more recent data and watch for rule violations that signal process changes. When a Western Electric rule fires, investigate the process at that timestamp before making any adjustment — over-correction on a false signal increases variance and makes the process harder to control.",
    scenarios: [
      {
        role: "Quality Analyst",
        title: "Diesel Sulfur Content — Regulatory Compliance Monitoring",
        description:
          "Apply a Shewhart chart to the online diesel sulfur analyzer (ppmw) with the toolbar set to 30 days of recent stable operation to establish the UCL/LCL. When the process mean shifts upward following a crude slate change, the control chart flags the shift before product sulfur approaches the 10 ppmw regulatory specification limit — giving the engineer time to adjust the hydrotreater severity before any off-spec product is made.",
      },
      {
        role: "Process Engineer",
        title: "Reformer Yield Stability — Shift-Level Monitoring",
        description:
          "Track C5+ reformate yield per shift as a single point on a Shewhart chart over a 90-day catalyst cycle. Downward rule violations signal either catalyst deactivation requiring a temperature bump or a feed quality change requiring investigation — the chart distinguishes random shift-to-shift variation from a real trend that needs an engineering response.",
      },
      {
        role: "Environmental / HSE Engineer",
        title: "Stack NOx Emissions — Regulatory Limit Surveillance",
        description:
          "Apply a Shewhart chart to the continuous emissions monitoring system (CEMS) NOx analyzer averaged to hourly values. The 3σ UCL — set from a 30-day stable period — provides an early warning threshold well below the permit limit, so engineering can investigate a combustion air imbalance or burner fouling before approaching the threshold that triggers a regulatory notification obligation.",
      },
      {
        role: "Accounting / Finance",
        title: "Energy Intensity — Cost per Barrel Stability",
        description:
          "Track the monthly refinery energy intensity (USD per barrel crude processed) on a Shewhart chart, with control limits set from the previous year of stable operation. When a rule violation appears after a major equipment overhaul, it objectively confirms that the project delivered a statistically significant efficiency improvement — or that it didn't — providing defensible evidence for the capital project post-investment review.",
      },
    ],
  },
  {
    id: 29,
    name: "CUSUM Chart",
    category: "SPC",
    tier: "late",
    library: "uPlot",
    realTime: false,
    acceptedPointTypes: ["analog"],
    description:
      "Cumulative sum of deviations from a target. Specifically designed to detect small sustained shifts (1σ or less) that Shewhart charts miss. A 0.5σ drift produces a steadily climbing line that eventually signals, where a Shewhart chart would show nothing for weeks.",
    benefits: [
      "Most sensitive SPC chart for small sustained mean shifts",
      "Amplifies persistent drift that trends would hide in noise",
      "Target, allowance (k), and decision limit (h) all configurable",
    ],
    downsides: [
      "Resets after each signal — does not show the full history of drift",
      "Less sensitive to sudden large shifts — pair with Shewhart for both",
    ],
    usage:
      "Apply to slow-drifting processes where early warning of gradual change matters most: catalyst deactivation, heat exchanger fouling, column tray efficiency, pump wear, or analyzer drift. In the Options tab, set Target to your process aim point — the intended operating value, not the alarm limit (leave it blank to use the mean of all data in the window). Allowance (k) controls the noise threshold: the default 0.5 means drifts smaller than half a standard deviation accumulate slowly and won't trigger false alarms on normal process noise. Control limit (h) is the cumulative sum threshold for signalling: the default 4 provides a good balance between sensitivity and false alarm rate. Set the toolbar duration to cover several weeks of data — the slope of the rising CUSUM line shows how long the drift has been occurring, which is the most actionable piece of information when planning a maintenance intervention or process adjustment.",
    scenarios: [
      {
        role: "Reliability Engineer",
        title: "Heat Exchanger Fouling Detection — Weeks Early",
        description:
          "Apply a CUSUM to the calculated overall heat transfer coefficient (U-value) for the crude preheat train, with the target set to the post-cleaning clean baseline value. A rising CUSUM signals that fouling is accumulating at a statistically meaningful rate weeks before the process impact becomes large enough to see in a Shewhart chart or trend — allowing a cleaning to be scheduled proactively at the next available unit pause.",
      },
      {
        role: "Process Engineer",
        title: "HCU Catalyst Deactivation Rate Monitoring",
        description:
          "Apply a CUSUM to the daily weighted average bed temperature (WABT) required to maintain target conversion, with the target set to the beginning-of-cycle value. The cumulative sum amplifies the slow, persistent upward drift of WABT as the catalyst deactivates — the slope of the CUSUM line at any point gives the current deactivation rate in °F/day, enabling an accurate projection of end-of-cycle.",
      },
      {
        role: "Energy Manager",
        title: "Steam Trap Failure Detection — Rising Consumption",
        description:
          "Apply a CUSUM to the steam balance residual for a unit (measured production minus metered consumption), with target set to zero. A failing open steam trap creates a persistent small positive deviation in the residual that accumulates in the CUSUM and signals within 2–3 weeks, while the individual weekly values show nothing above the normal measurement noise — a steam trap survey is then targeted at the specific unit rather than plant-wide.",
      },
    ],
  },
  {
    id: 30,
    name: "EWMA Chart",
    category: "SPC",
    tier: "late",
    library: "uPlot",
    realTime: false,
    acceptedPointTypes: ["analog"],
    description:
      "Exponentially weighted moving average with adaptive control limits. More robust than Shewhart for autocorrelated or non-normal data — most continuous process measurements are autocorrelated (the current value depends on the previous value), which makes EWMA a better default than Shewhart for many process variables. Lambda controls the balance between sensitivity and noise rejection.",
    benefits: [
      "Handles autocorrelated data — the correct chart for most continuous process variables",
      "Robust to non-normal distributions",
      "Lambda and control limit width both configurable in Options",
    ],
    downsides: [
      "Requires lambda tuning for best sensitivity on a specific variable",
      "Less intuitive to explain to operators than a Shewhart chart",
    ],
    usage:
      "Use EWMA as the default SPC chart for continuous process measurements like temperature, pressure, and flow — these are almost always autocorrelated, which inflates false alarm rates on a Shewhart chart. In the Options tab, Lambda (λ) controls how heavily each new observation is weighted against the accumulated history: the default 0.2 balances sensitivity and noise rejection well as a starting point. Tighten lambda toward 0.05–0.1 for slow-drifting variables like catalyst activity or heat exchanger UA. Increase lambda toward 0.3–0.4 if the process changes quickly and you need to react to step changes rather than slow drift. L (control limit width, default 3) sets how many smoothed standard errors trigger an out-of-control signal — widen to 3.5 for noisy variables prone to false alarms. Set the toolbar duration long enough to span several typical process cycles so the early transient occupies a small fraction of the display.",
    scenarios: [
      {
        role: "Controls Engineer",
        title: "Feedback Controller Performance Surveillance",
        description:
          "Apply an EWMA chart to the control error (SP minus PV) for a critical column pressure controller, with lambda set low (0.1) to track the slowly varying mean error. When the EWMA line drifts consistently above or below zero, the controller has accumulated a bias — either the transmitter has drifted or the valve characteristic has changed — which distinguishes a tuning problem from a calibration problem before operators start fighting a controller they don't trust.",
      },
      {
        role: "Process Engineer",
        title: "Atmospheric Column Tray Efficiency Drift",
        description:
          "Apply an EWMA chart to the calculated Murphree tray efficiency for the AGO draw section of the atmospheric column, derived from the draw temperature and product ASTM 50% point. Tray efficiency degrades slowly through fouling — the EWMA smooths the daily lab-result noise and signals a statistically real decline about 4–6 weeks before the product distillation specification is breached, leaving time to plan a controlled rate reduction and tray washing.",
      },
      {
        role: "Quality Analyst",
        title: "Jet Fuel Flash Point Drift — Specification Risk",
        description:
          "Apply EWMA to the jet cut draw temperature with lambda tuned to 0.15, targeting the temperature setpoint that historically delivers 45°C flash point. When the EWMA drifts below the lower control limit, it signals that the flash point is trending toward the 38°C regulatory minimum — giving the blending team time to adjust the draw-point before the next QC sample fails.",
      },
    ],
  },

  // ── Statistical ─────────────────────────────────────────────────────────────
  {
    id: 13,
    name: "XY Plot / Scatter",
    category: "Statistical",
    tier: "initial",
    library: "ECharts",
    realTime: false,
    acceptedPointTypes: ["analog"],
    description:
      "One process variable plotted against another (not time). Shows relationships and correlations — compressor discharge pressure vs. speed, heat exchanger effectiveness vs. throughput, reactor conversion vs. temperature. Each point is a moment in time; the cloud of points reveals the underlying process relationship. Density mode bins the X/Y space and colors each bin by point density — essential when thousands of overlapping points make individual markers unreadable.",
    benefits: [
      "Reveals variable relationships and correlations",
      "Operating envelope analysis — see where the process actually runs",
      "Color by time shows whether the relationship is drifting over months",
      "Density mode handles months of high-frequency data without overplotting",
    ],
    downsides: ["Historical data only", "Requires a meaningful X-Y pairing"],
    usage:
      "In the Data Points tab, assign the driving variable as X and the response variable as Y. Set the toolbar duration to cover the full range of operating conditions you want to characterize — the longer the window, the more complete the operating envelope. In the Options tab, enable Color by time to see whether the process relationship has shifted over months. For large datasets, switch Density mode to Auto or On to bin the X/Y space and color each cell by operating hours spent there — the darkest bins are your normal operating zone. Enable Regression line to overlay the fitted curve and quantify the relationship. Adjust Symbol size and Opacity when overplotting makes the cloud structure hard to read.",
    scenarios: [
      {
        role: "Process Engineer",
        title: "Compressor Performance Map — Actual vs. Design Curve",
        description:
          "Plot compressor suction flow (X) against differential head (Y) over 3 months of operation with color-by-time enabled. When the scatter cloud drifts downward from the published performance curve, it quantifies the efficiency loss from fouling or wear — a 5% drop in head at a given flow triggers an online performance test and condition assessment before scheduling an overhaul.",
      },
      {
        role: "Reliability Engineer",
        title: "Pump Operating Point vs. Best-Efficiency Point",
        description:
          "Plot pump discharge flow (X) against differential pressure (Y) over 6 months with the design pump curve overlaid as a reference line. Operating points clustering far left of the BEP (best-efficiency point) indicate the pump is oversized for its service — chronic operation in this region accelerates seal and bearing wear, justifying an impeller trim or a recirculation line modification.",
      },
      {
        role: "Energy Manager",
        title: "Boiler Efficiency vs. Firing Rate — Optimization Envelope",
        description:
          "Plot boiler firing rate (X) against calculated thermal efficiency (Y) for each of the facility's three boilers over 30 days. The scatter reveals the efficiency curve shape for each boiler — the most efficient firing rate window becomes the dispatch target, and the boiler with the flattest efficiency curve gets dispatched last when the load drops, minimizing total fuel spend per unit of steam produced.",
      },
      {
        role: "Marketing / Trading",
        title: "Feedstock Quality vs. Product Yield — Crude Sourcing Decisions",
        description:
          "Plot crude API gravity (X) against observed naphtha yield (Y) for every cargo processed over the past 12 months to quantify the naphtha yield sensitivity to crude quality. The scatter defines the trading team's expected yield model for pricing alternative crude opportunities — a crude offer 2° API lighter than the current slate can be valued more accurately using the fitted slope than using the generic yield model in the planning system.",
      },
    ],
  },
  {
    id: 19,
    name: "Box Plot",
    category: "Statistical",
    tier: "mid",
    library: "ECharts",
    realTime: false,
    acceptedPointTypes: ["analog"],
    description:
      "Distribution summary showing median, Q1, Q3, whiskers at 1.5×IQR, and individual outlier points. Ideal for side-by-side comparison of the same variable across shifts, time periods, or operating modes. The box width represents the middle 50% of values — a wide box means high variability, a narrow box means tight control.",
    benefits: [
      "Compact comparison of multiple distributions side by side",
      "Shows median, spread, and outliers in one view",
      "Notched boxes give a visual significance test for median differences",
    ],
    downsides: [
      "Loses distribution shape detail — use Histogram for bimodal detection",
      "Only 5 summary statistics per group",
    ],
    usage:
      "Compare process performance across shifts, operators, weeks, or before/after a process change. A box that shifts upward means the median has moved; a taller box means variability increased. Enable Show individual points in the Options tab to see every data point alongside the box. Enable Notched boxes to visually compare medians: non-overlapping notches indicate a statistically significant difference. The whisker points beyond 1.5×IQR are your worst-case excursions — note their timestamps and investigate those specific periods.",
    scenarios: [
      {
        role: "Operations Manager",
        title: "Shift Performance Comparison — Which Shift Runs Best?",
        description:
          "Compare CDU charge rate, HCU conversion, and energy intensity distributions across the three operating shifts (Day, Evening, Night) as side-by-side box plots. Non-overlapping notches between shifts on the conversion metric identify a statistically significant difference in operating discipline — the investigation into what the high-performing shift does differently becomes the basis for a best-practice sharing session.",
      },
      {
        role: "Process Engineer",
        title: "Crude Quality Impact — Before vs. After Slate Change",
        description:
          "Compare the distribution of reformer C5+ yield for the 30-day period before a crude slate change against the 30-day period after. When the post-change box has shifted downward and grown taller, it confirms both a yield loss and an increase in variability — quantifying the economic impact of the crude substitution for the commercial team's next purchasing decision.",
      },
      {
        role: "Accounting / Finance",
        title: "Maintenance Cost per Shift — Identifying Outlier Events",
        description:
          "Compare the distribution of maintenance labor and material costs by shift over a quarter, grouped by shift team. The outlier points visible in the box plot correspond to specific emergency repair events — clicking each outlier reveals the timestamp, which can be cross-referenced against the work order system to determine whether the repair was truly emergency-driven or could have been planned.",
      },
    ],
  },
  {
    id: 20,
    name: "Histogram / Violin Plot",
    category: "Statistical",
    tier: "mid",
    library: "ECharts",
    realTime: false,
    acceptedPointTypes: ["analog"],
    description:
      "Two display modes in one chart type. Histogram mode reveals the full distribution shape — normal, right-skewed, bimodal, or otherwise. Violin mode overlays a kernel density estimate with box plot statistics — a bimodal violin (two bulges) immediately reveals two distinct operating modes that a box plot would show as just a wide IQR.",
    benefits: [
      "Histogram reveals full distribution shape, not just summary statistics",
      "Violin detects bimodal distributions that box plots miss",
      "Cp/Cpk capability stats with configurable specification limits",
      "Normal curve overlay shows how close the process is to normal",
    ],
    downsides: [
      "One variable at a time — not for multi-group comparison",
      "Bin count choice affects histogram appearance significantly",
    ],
    usage:
      "Assign the process variable in the Data Points tab and set the toolbar duration to 1–3 months. Enable the Normal curve overlay to check for normality. Enable Cp/Cpk and enter your USL/LSL to calculate process capability — Cpk above 1.33 means the process is capable with margin; below 1.0 means regular out-of-spec product. If you see a bimodal shape, the process has two distinct operating modes — split the duration into the separate periods and histogram each one independently.",
    scenarios: [
      {
        role: "Quality Analyst",
        title: "Diesel Cetane — Process Capability vs. Specification",
        description:
          "Build a histogram of 6 months of diesel cetane index values from the online analyzer, with USL and LSL set to the product specification limits. Enabling Cp/Cpk reveals whether the process is statistically capable of meeting spec without relying on end-of-pipe product blending — a Cpk below 1.33 triggers a process capability improvement project that avoids the cost of blending premium cetane improver.",
      },
      {
        role: "Process Engineer",
        title: "Bimodal Reactor Temperature — Two Operating Modes Revealed",
        description:
          "Build a histogram of reformer reactor inlet temperatures over a 90-day period. A bimodal shape (two humps) that looks like a single wide distribution on a box plot immediately reveals that the unit operates in two distinct severity modes — low severity for light crude runs and high severity for heavy crude processing — telling the process engineer to develop two separate control strategies rather than one compromise setpoint.",
      },
      {
        role: "Environmental / HSE Engineer",
        title: "Stack Opacity Distribution — Compliance Evidence",
        description:
          "Build a histogram of continuous opacity monitor (COM) readings over a permit year, with a vertical line at the 20% opacity permit limit. The shape of the distribution determines whether exceedances are isolated spikes (rare tails) or a systematic problem (the bulk of the distribution near the limit) — the distinction completely changes the regulatory response and remediation strategy.",
      },
      {
        role: "Accounting / Finance",
        title: "Energy Cost per Barrel — Distribution for Budget Planning",
        description:
          "Build a histogram of daily energy intensity (USD per barrel processed) over the previous fiscal year to understand the range and shape of the distribution before setting the coming year's energy budget. A right-skewed distribution with a long tail confirms that a small number of days with planned startups or major upsets drive the average above the median — the median is the correct target, and the budget should include a contingency allowance for the tail events.",
      },
    ],
  },
  {
    id: 25,
    name: "Regression / Trendline",
    category: "Statistical",
    tier: "mid",
    library: "uPlot",
    realTime: false,
    acceptedPointTypes: ["analog"],
    description:
      "Fitted mathematical curve (linear, polynomial, exponential, logarithmic, or power law) overlaid on time-series or scatter data. Shows trend direction and rate with equation, R², and optional confidence band.",
    benefits: [
      "Quantifies degradation rate with equation and R²",
      "Five model types to match the physics of different degradation mechanisms",
      "Confidence band shows uncertainty in the fit",
    ],
    downsides: [
      "Cannot extrapolate reliably far beyond the data range",
      "Assumes the chosen model shape matches the actual process",
    ],
    usage:
      "Assign the variable to monitor in the Data Points tab, then set the toolbar duration to cover the degradation period of interest. In the Options tab, select the model type that best matches the physical mechanism: Exponential fits most fouling and deactivation curves. Polynomial fits non-monotonic curves. Linear is adequate for approximately constant drift. The R² value shows how well the model fits — above 0.7 means the signal is clear; below 0.5 means variability is masking the trend. The fitted equation gives the rate of change for projecting when the variable will reach an operating or maintenance limit.",
    scenarios: [
      {
        role: "Reliability Engineer",
        title: "Heat Exchanger U-Value Decay — Projected Cleaning Date",
        description:
          "Fit an exponential regression to the calculated overall heat transfer coefficient (U-value, kW/m²·K) for the crude preheat train over 90 days since the last cleaning. The fitted exponential equation gives the fouling rate constant; projecting forward to the minimum acceptable U-value before heater duty is impacted yields a specific projected cleaning date that can be submitted to the planning department as a maintenance request with a justified schedule.",
      },
      {
        role: "Process Engineer",
        title: "HCU Catalyst Deactivation Rate — End-of-Cycle Projection",
        description:
          "Fit a linear regression to the monthly WABT required to hold target conversion over the catalyst cycle. The slope (°F/month) is the deactivation rate; projecting forward to the maximum allowable WABT gives the predicted end-of-cycle date. Comparing the actual deactivation rate against the licensor's guarantee determines whether a warranty claim is warranted or whether a process change (e.g., crude contaminant) is accelerating deactivation.",
      },
      {
        role: "Accounting / Finance",
        title: "Maintenance Cost Escalation — Budget Projection",
        description:
          "Fit a linear or exponential regression to annual maintenance spend per equipment class (rotating, static, instrumentation) over 5 years as the asset ages. The fitted trend line extrapolates the expected cost in year 6 and beyond, providing a data-driven basis for the long-range maintenance budget rather than a flat percentage inflation assumption — critical for justifying a capital replacement decision when the regression indicates the asset is approaching an exponential cost escalation inflection point.",
      },
      {
        role: "Energy Manager",
        title: "Fired Heater Efficiency Decay — Fuel Cost Impact",
        description:
          "Fit a linear regression to the calculated heater thermal efficiency over the period since the last burner tip cleaning. The slope (efficiency points per month) multiplied by the current fuel gas price gives the monthly fuel cost increase from declining efficiency — a concrete dollar figure that justifies the cost of a planned burner maintenance outage to the plant manager.",
      },
    ],
  },
  {
    id: 26,
    name: "Correlation Matrix",
    category: "Statistical",
    tier: "mid",
    library: "ECharts",
    realTime: false,
    acceptedPointTypes: ["analog"],
    description:
      "Square grid showing pairwise correlation coefficients between multiple variables, color-coded from strong negative (blue) to zero (white) to strong positive (red). The fastest way to screen many variables for relationships — a single matrix replaces hundreds of individual scatter plots.",
    benefits: [
      "Shows all pairwise correlations simultaneously",
      "Quickly identifies leading indicators and candidate control handles",
      "Optional coefficient labels for precise reading",
    ],
    downsides: [
      "Practical limit of 20–25 variables before labels become crowded",
      "Only shows linear correlation — non-linear relationships may appear weak",
    ],
    usage:
      "In the Data Points tab, assign all variables you want to screen — 10–20 is the practical sweet spot. Set the toolbar duration to span several weeks of normal operating variation. Enable Show values in the Options tab to display the correlation coefficient in each cell. A coefficient above 0.7 (or below −0.7) is typically strong enough to investigate further. Click any strongly-correlated cell to open the full XY Scatter view for that pair. Start your investigation with the quality or efficiency variable as the reference row — the entire row tells you which inputs move with that outcome.",
    scenarios: [
      {
        role: "Process Engineer",
        title: "Root Cause Screening for Diesel Quality Upset",
        description:
          "Add 15–20 upstream process variables (draw temperatures, flow rates, feed composition, column pressures) alongside the diesel cetane index and flash point for a 60-day period. The correlation matrix identifies which upstream variable has the strongest coefficient with the failing quality — a dark red cell between the AGO draw temperature and flash point immediately focuses the investigation on the draw-point controller rather than requiring a week of manual analysis.",
      },
      {
        role: "Controls Engineer",
        title: "Loop Interaction Screening Before Advanced Control Project",
        description:
          "Add all MV (manipulated variable) and CV (controlled variable) tags for a proposed APC (advanced process control) application to the correlation matrix over a period of natural process variation. Strong off-diagonal correlations between manipulated variables and non-target controlled variables identify loop interactions that must be included in the APC model — missing them produces a controller that fights itself and delivers poor performance.",
      },
      {
        role: "Marketing / Trading",
        title: "Crude Quality vs. Product Value — Cargo Pricing Model",
        description:
          "Correlate crude quality metrics (API gravity, sulfur content, distillation T50, TAN) against the realized product slate value ($/bbl) for every cargo processed over 18 months. The matrix identifies which crude quality parameters have the strongest impact on realizable value — the API gravity and sulfur coefficient become the primary variables in the trading desk's crude evaluation model for pricing spot cargo opportunities.",
      },
      {
        role: "Energy Manager",
        title: "Energy Waste Driver Screening — Where to Focus First",
        description:
          "Build a matrix of energy intensity (GJ/bbl) against 15–20 potential driver variables: feed rate, crude API, ambient temperature, steam-to-crude ratio, number of units online, column reflux ratios, and others. The strongest correlations reveal whether high energy intensity is being driven by operational choices (reflux ratio set too high) or external factors (ambient temperature in summer) — directing the improvement program at the controllable variables.",
      },
    ],
  },
  {
    id: 31,
    name: "Probability Plot",
    category: "Statistical",
    tier: "late",
    library: "Plotly",
    realTime: false,
    acceptedPointTypes: ["analog"],
    description:
      "Normal Q-Q (quantile-quantile) plot comparing your actual data against a theoretical normal distribution. If the data is normally distributed, points fall on the straight reference line. An S-curve indicates heavy tails; a bend at one end indicates skewness; a step pattern indicates a mixture of two populations.",
    benefits: [
      "Precise normality assessment — the definitive check before setting up SPC",
      "More sensitive than a histogram for detecting tail behavior",
      "Critical prerequisite for validating Shewhart and EWMA control limit validity",
    ],
    downsides: [
      "Less intuitive to interpret than a histogram for most audiences",
    ],
    usage:
      "Assign the process variable in the Data Points tab and set the toolbar duration to several weeks of normal operation. I/O plots each observation against where it would fall if the data were perfectly normal — points following the straight reference line confirm approximate normality and validate standard ±3σ SPC control limits. If the points curve away from the line, standard limits will produce too many false alarms or miss real signals. For skewed variables (concentrations, ratios), consider log-transforming before building a control chart — run the Probability Plot on the transformed values to confirm the transform corrects the shape.",
    scenarios: [
      {
        role: "Quality Analyst",
        title: "Normality Check Before Diesel Sulfur SPC Deployment",
        description:
          "Before deploying a Shewhart chart for diesel sulfur compliance monitoring, run the Probability Plot on 30 days of the online analyzer data. If the points follow the reference line, the ±3σ limits will have the expected 0.27% false alarm rate — any significant departure from the line means the limits must be recalculated using the actual distribution or the data log-transformed, otherwise the compliance alert system will be miscalibrated from day one.",
      },
      {
        role: "Environmental / HSE Engineer",
        title:
          "Emissions Data Validation — Are Our Measurements Representative?",
        description:
          "Run the Probability Plot on a year of CEMS NOx hourly averages before submitting the annual compliance report. A heavy right tail reveals that a small number of startup and upset events are skewing the annual average far above the steady-state operating level — this distribution information supports a request to the regulator for a separate startup/shutdown emissions averaging methodology rather than a single annual average.",
      },
      {
        role: "Process Engineer",
        title:
          "Validating EWMA Chart Choice for Autocorrelated Temperature Data",
        description:
          "Apply the Probability Plot to residuals from an autocorrelation model for the reformer reactor inlet temperature before deploying an EWMA chart. If the residuals (the portion of variation that isn't explained by yesterday's value) fall on the normal reference line, the EWMA control limits are statistically valid. If the residuals are heavy-tailed, the lambda must be tuned conservatively to avoid excessive false alarms on genuinely normal process variation.",
      },
    ],
  },

  // ── Categorical ─────────────────────────────────────────────────────────────
  {
    id: 5,
    name: "Bar / Column Chart",
    category: "Categorical",
    tier: "initial",
    library: "ECharts",
    realTime: "optional",
    acceptedPointTypes: ["analog", "boolean", "discrete_enum"],
    description:
      "Vertical (column) or horizontal (bar) charts for categorical comparisons. Supports grouped, stacked, and 100%-stacked variants. A combination mode overlays a secondary line series on the same chart area. Error bars show ±σ or min/max spread per bar.",
    benefits: [
      "Precise magnitude comparison — bar length is easy to compare accurately",
      "Grouped, stacked, and 100% stacked variants in one chart type",
      "Combination mode overlays a line series on bars",
      "Error bars show spread or uncertainty per category",
    ],
    downsides: [
      "Not for time-series with many data points",
      "When categories need sorting by rank, use Pareto instead",
    ],
    usage:
      "Assign each category's value point in the Data Points tab; configure orientation, grouping mode, and error bars in the Options tab. Use vertical columns for a small number of categories; horizontal bars when category names are long or there are many categories. Group bars side by side to compare the same metric across time periods or operating modes. Use 100% stacking to show proportional breakdown independent of total size. Enable combo mode to overlay a target or cumulative total line on the bars.",
    scenarios: [
      {
        role: "Reliability Engineer",
        title: "Crude Preheat Exchanger Fouling — Cleaning Priority Ranking",
        description:
          "Build a horizontal bar chart of current fouling resistance for every heat exchanger in the preheat train, sorted highest to lowest. The chart immediately identifies which exchanger has drifted furthest from its clean design value and should be the first target in the next turnaround cleaning schedule — replacing a spreadsheet that took 2 hours to compile with a view that updates automatically as new performance calculations arrive.",
      },
      {
        role: "Accounting / Finance",
        title: "Fuel Gas Cost by Process Unit — Actual vs. Budget",
        description:
          "Build a grouped bar chart of monthly fuel gas cost (USD) by process unit — CDU, HCU, Reformer, SRU, Utilities — comparing this month against the same month last year and against the budget. Units where the actual bar significantly exceeds both comparison bars are flagged for an efficiency investigation; units where actual falls below budget provide evidence that an energy improvement project is delivering its financial target.",
      },
      {
        role: "Marketing / Trading",
        title: "Product Sales Volume by Grade — Month vs. Month",
        description:
          "Build a grouped column chart of volumes sold (bbl) for each product grade (regular gasoline, premium gasoline, jet fuel, ULSD, fuel oil) for each of the last 6 months. When the jet fuel column starts declining while ULSD grows, the trading team can see the market demand shift and begin adjusting the crude cut-point strategy before inventories reach a limit that forces a distressed sale or a costly blend adjustment.",
      },
      {
        role: "Operations Manager",
        title: "Unit Availability by Area — Quarter vs. Target",
        description:
          "Compare process unit runtime availability (%) for CDU, HCU, Reformer, SRU, and Utilities as a grouped bar chart against the Q1 plan target. Units failing to meet their availability target are immediately visible by their gap to the target line, and the magnitude of the gap informs where to focus the reliability improvement discussion in the quarterly business review.",
      },
    ],
  },
  {
    id: 6,
    name: "Pie / Donut Chart",
    category: "Categorical",
    tier: "initial",
    library: "ECharts",
    realTime: "optional",
    acceptedPointTypes: ["analog", "boolean", "discrete_enum"],
    description:
      'Circular proportional chart. Limited to approximately 7 slices; additional values bucketed into "Other." Donut variant embeds a total or summary label in the center. Slice area is proportional to value, making large differences obvious but small differences hard to compare.',
    benefits: [
      'Instantly communicates "parts of a whole" to any audience',
      "Center label in donut variant shows the total or a KPI",
      "Familiar to all audiences without explanation",
    ],
    downsides: [
      "Poor for comparing similarly-sized slices — bar charts are more precise",
      "Limited to ~7 meaningful categories",
    ],
    usage:
      'Best suited to high-level composition snapshots where the audience needs "roughly what fraction." Keep to 4–6 meaningful slices; consolidate the remainder into "Other." If two or more slices are similar in size and the exact difference matters, switch to a bar chart. The donut variant works well on dashboards where the center label shows the total throughput or a key KPI value.',
    scenarios: [
      {
        role: "Production Planner",
        title: "Crude Slate Composition — Current Month",
        description:
          "Build a donut chart of crude blend volume by crude type for the current month, with the center label showing total crude processed in barrels. When a cargo delivery is delayed and the blend shifts toward a different crude, the pie chart updates in real time and the planner sees at a glance whether the API gravity and sulfur content assumptions in the yield plan are still valid.",
      },
      {
        role: "Accounting / Finance",
        title: "Maintenance Spend — Planned vs. Emergency vs. Deferred",
        description:
          "Display year-to-date maintenance cost divided into planned (turnaround + PM), emergency (priority-1/2 correctives), and deferred (approved deferrals). The design target is below 15% emergency spend; a donut showing above 25% emergency provides the financial evidence that the preventive maintenance program is underfunded relative to asset age — supporting a budget increase request to leadership.",
      },
      {
        role: "Energy Manager",
        title: "Refinery Energy Source Breakdown — GJ Mix",
        description:
          "Build a donut of total energy consumption split across fuel gas combustion, purchased electricity, steam imports, and hydrogen production, with the center label showing the headline energy intensity (GJ/bbl). The slice proportions immediately show whether a recent electricity tariff increase has become the dominant energy cost driver — informing a priority review of on-site cogeneration capacity versus continued grid purchases.",
      },
      {
        role: "Marketing / Trading",
        title: "Product Revenue Mix — Where the Margin Comes From",
        description:
          "Build a donut of total monthly revenue by product stream — jet fuel, ULSD, gasoline, fuel oil, LPG, sulfur. When the jet fuel slice accounts for 45% of revenue but only 20% of volume, the trading team sees the margin concentration risk: any disruption to jet production has a disproportionate impact on the facility's financial result, justifying a hedging strategy for jet fuel price exposure.",
      },
    ],
  },
  {
    id: 23,
    name: "Bullet Chart",
    category: "Categorical",
    tier: "mid",
    library: "ECharts",
    realTime: "optional",
    acceptedPointTypes: ["analog", "boolean", "discrete_enum"],
    description:
      "Compact bar showing actual value against a target marker, with shaded background bands for qualitative performance levels. One-fifth the screen space of a gauge for the same information — a column of 8–10 bullet charts fits on a single dashboard. Supports horizontal and vertical orientations.",
    benefits: [
      "Very space-efficient KPI display — 5× more compact than a gauge",
      "Shows actual vs. target in a single view",
      "Qualitative bands give instant context without reading a number",
    ],
    downsides: [
      "Less immediately intuitive than a gauge to audiences unfamiliar with bullet charts",
    ],
    usage:
      "Stack multiple bullet charts vertically for a compact KPI dashboard. In the Data Points tab, assign the actual-value point and target point for each bullet. In the Scaling tab, define 2–3 background bands (green for acceptable, yellow for marginal, red for off-target). The bar length instantly shows whether the process is on target, how far off it is, and which qualitative zone it occupies.",
    scenarios: [
      {
        role: "Operations Manager",
        title: "Unit Charge Rate vs. Monthly Production Plan",
        description:
          "Display a bullet chart for each process unit showing today's average charge rate against the monthly production plan target, with bands colored poor (below 90% of plan), acceptable (90–97%), good (97–103%), and exceptional (above 103%). Six bullet charts replace six separate KPI discussions in the morning standup — any unit in the red or yellow band immediately draws attention.",
      },
      {
        role: "Energy Manager",
        title: "Steam-to-Crude Ratio vs. Energy Efficiency Target",
        description:
          "A bullet chart for steam consumption per barrel (klb/bbl) against the energy management plan target, with the danger band starting at 110% of the target. When the bullet reaches the danger band, the energy manager investigates whether a heat exchanger has fouled, a steam trap has failed open, or a temperature controller is driving excess reboiler duty — before the month-end energy report shows an overrun.",
      },
      {
        role: "Accounting / Finance",
        title: "Month-to-Date Refinery Margin vs. Budget",
        description:
          "Display bullet charts for month-to-date realized margin ($/bbl), operating cost ($/bbl), and energy intensity (USD/bbl) side by side against their respective budget targets. The finance team sees at a glance whether margin underperformance is being driven by revenue (product prices), cost (energy or maintenance), or both — focusing the mid-month corrective discussion on the right lever.",
      },
      {
        role: "Environmental / HSE Engineer",
        title: "Month-to-Date Flare Loss vs. Permit Limit",
        description:
          "Show a bullet chart of month-to-date hydrocarbon flaring (tonnes) against the monthly permit limit, with a danger band for the last 10% of the limit. When the bullet enters the warning band before day 20, it triggers a formal flaring reduction review — identifying continuous pilots that can be extinguished and routing upset gas to recovery rather than the flare.",
      },
    ],
  },
  {
    id: 18,
    name: "Pareto Chart",
    category: "Categorical",
    tier: "mid",
    library: "ECharts",
    realTime: false,
    acceptedPointTypes: ["analog"],
    description:
      "Bar chart sorted by frequency/impact (descending) with overlaid cumulative percentage line. Three ranking modes: count, standing time (ISA-18.2 nuisance alarm KPI), and rate. Priority distribution mode checks alarm priority balance against ISA-18.2 targets.",
    benefits: [
      "Enforces sorted ranking — most impactful problem is always leftmost",
      "Cumulative line shows the 80/20 threshold visually",
      "Standing time mode surfaces nuisance alarms active for hours",
      "Priority distribution mode checks ISA-18.2 balance targets",
    ],
    downsides: [
      "Historical data only",
      "Requires event or count data, not continuous measurements",
    ],
    usage:
      "In the Options tab, select the ranking mode. Count mode identifies the most frequently triggered tags. Standing time mode surfaces tags that stay active longest — an alarm active 12 hours is a nuisance even if it triggered once. The cumulative line crossing 80% shows exactly how many tags you need to address to resolve the majority of alarm load. Use priority distribution mode to check whether your alarm configuration follows ISA-18.2 guidance: less than 5% Critical and less than 15% High by annunciation count.",
    scenarios: [
      {
        role: "Controls Engineer",
        title: "ISA-18.2 Bad Actor Identification — Monthly Review",
        description:
          "Generate a Pareto of total alarm activations per tag over the last 30 days in count mode. ISA-18.2 specifies that the top 10 bad actors typically account for over 60% of all alarm activations — the cumulative line makes this visually immediate. Rationalizing the top 5 tags (usually chattering level or analyzer tags with noisy signals) eliminates the majority of alarm burden without touching the remaining alarms.",
      },
      {
        role: "Reliability Engineer",
        title: "Equipment Failure Modes — Where to Invest in Prevention",
        description:
          "Build a Pareto of corrective maintenance work orders over the past year, categorized by failure mode — mechanical seal failure, bearing failure, valve packing, instrument drift, electrical fault. When mechanical seal failures account for 38% of all unplanned maintenance hours, the Pareto provides the business case to justify upgrading from single to double mechanical seals on the crude charge pumps.",
      },
      {
        role: "Safety Engineer",
        title: "Near-Miss Root Cause Distribution — Safety Budget Targeting",
        description:
          "Generate a Pareto of near-miss events over 12 months, categorized by root cause — isolation procedure deviation, hot-work permit violation, LOTO non-compliance, housekeeping, dropped objects. The cumulative line crossing 80% after just two or three categories means the safety improvement budget should be concentrated on those root cause elimination initiatives rather than spread uniformly across all categories.",
      },
      {
        role: "Accounting / Finance",
        title: "Production Loss by Cause — Where the Revenue Went",
        description:
          "Build a Pareto of barrels of crude throughput lost to unplanned outages by cause over the quarter — compressor trips, amine upsets, utility steam pressure drops, flare system constraints, analyzer failures. When two root causes account for 55% of lost production, the finance team can translate the bar lengths directly into lost revenue at the current product price — the Pareto becomes the justification for the reliability improvement capital request.",
      },
    ],
  },
  {
    id: 21,
    name: "Waterfall Chart",
    category: "Categorical",
    tier: "mid",
    library: "ECharts",
    realTime: false,
    acceptedPointTypes: ["analog"],
    description:
      "Sequential bar chart showing how positive and negative contributions accumulate to a total. Each bar starts where the previous ended. Green bars add to the total, red bars subtract — the final bar is the net result.",
    benefits: [
      "Shows where gains and losses occur in a cumulative sequence",
      "Running total always visible",
      "Clear positive/negative contribution coding",
    ],
    downsides: [
      "Only for cumulative sequential data",
      "Requires a pre-defined step sequence that sums meaningfully",
    ],
    usage:
      "Define the step sequence in the Data Points tab — one point per step. Configure whether the first and last bars are totals (rendered as full-length floating bars) vs. incremental contributors in the Options tab. Use horizontal orientation when step names are long descriptive labels. Keep to 8 or fewer steps for readability.",
    scenarios: [
      {
        role: "Process Engineer",
        title: "Fired Heater Energy Balance — Where the Heat Goes",
        description:
          "Build a waterfall starting from total fuel gas heat input, then subtract flue gas stack loss, radiation loss, blowdown loss, and unaccounted losses to arrive at net useful heat delivered. The bar with the greatest negative contribution immediately shows where the efficiency improvement project should focus — stack loss is typically 15–18% and is the largest single recovery opportunity through air preheat or convection section cleaning.",
      },
      {
        role: "Accounting / Finance",
        title: "Refinery Margin Construction — Crude to Net Margin",
        description:
          "Start from the product realization (USD/bbl crude equivalent), then subtract crude cost, variable operating costs (fuel, chemicals, utilities), fixed costs (labor, maintenance, depreciation), and capital charges to arrive at the net refinery margin. When the margin falls below break-even, the waterfall immediately shows whether the culprit is a crude cost increase, a product price collapse, or a specific operating cost overrun — directing the corrective conversation to the right team.",
      },
      {
        role: "Production Planner",
        title: "OEE Decomposition — From Rated Capacity to Actual Production",
        description:
          "Start from rated nameplate capacity (bbl/day), then subtract planned downtime (turnarounds and scheduled maintenance), unplanned downtime (equipment failures), rate derating (operating below design), and quality losses (off-spec product not counted as saleable) to arrive at actual production. Each bar length is a quantified loss category — the production efficiency improvement roadmap is visible in the bar chart before a single data point is analyzed in detail.",
      },
      {
        role: "Accounting / Finance",
        title: "Actual vs. Budget Variance — What Changed and Why",
        description:
          "Start from the budgeted monthly operating cost, then show sequential bars for volume variance (more or fewer barrels processed than planned), rate variance (unit costs above or below budget), mix variance (different crude slate than budgeted), and unplanned events (emergency maintenance, regulatory fines). The waterfall transforms a single budget variance number into a decomposed story — each bar tells finance and operations exactly what happened and who owns the variance.",
      },
    ],
  },

  // ── Flow / Hierarchy ────────────────────────────────────────────────────────
  {
    id: 27,
    name: "Sankey Diagram",
    category: "Flow / Hierarchy",
    tier: "late",
    library: "ECharts",
    realTime: "optional",
    acceptedPointTypes: ["analog", "boolean", "discrete_enum"],
    description:
      "Flow diagram where link widths are proportional to flow quantity. Shows how a total splits, merges, and routes through a system. At a glance, the widest links are the dominant flows and the thinnest links are the minor ones.",
    benefits: [
      "Link width proportionality makes dominant flows immediately obvious",
      "Shows branching and merging flows that a bar chart cannot represent",
      "Can refresh on interval for a live energy balance display",
    ],
    downsides: [
      "Requires manual node and link definition before connecting to live data",
      "Complex to configure for large networks — build incrementally",
    ],
    usage:
      "Define nodes (sources, intermediate points, sinks) and draw links between them in the Options tab, then assign each link to a process point in the Data Points tab so width updates automatically. Build from the highest level first — two or three major flow paths — then add detail as sub-links. Set a refresh interval in Options for a live energy dashboard.",
    scenarios: [
      {
        role: "Energy Manager",
        title: "Plant Steam and Energy Balance — Live Dashboard",
        description:
          "Map the refinery energy flow from fuel gas combustion through each fired heater, to process duties, steam generation, and turbine drives, with every link assigned to a flow totaliser tag. The link widths update on a 5-minute refresh cycle, making the energy balance a live dashboard rather than a monthly calculation. The widest links at each node show where the most energy flows — the thinnest links out of proportion to their physical importance are where to investigate losses.",
      },
      {
        role: "Process Engineer",
        title: "Crude Unit Material Balance — Feed Through Products",
        description:
          "Map crude charge through the distillation tower to each product draw-off — naphtha, kerosene, AGO, residue, gas — with link widths proportional to flow rate. Gaps between the input node and the sum of product outputs reveal unmeasured vents, sample losses, or meter drift requiring calibration. The diagram makes the material balance immediately visible to non-engineers in a management review.",
      },
      {
        role: "Accounting / Finance",
        title: "Revenue Flow — From Crude Purchase to Product Sales",
        description:
          "Map the financial flow from crude purchase cost (widest input link) through each product yield (link widths proportional to revenue contribution) to net margin. The diagram visually communicates to non-technical stakeholders where the refinery makes its money — when the jet fuel output link carries 45% of total revenue width, the financial risk of a jet market disruption is immediately apparent without a spreadsheet.",
      },
    ],
  },
  {
    id: 28,
    name: "Treemap",
    category: "Flow / Hierarchy",
    tier: "late",
    library: "ECharts",
    realTime: false,
    acceptedPointTypes: ["analog", "boolean", "discrete_enum"],
    description:
      "Nested rectangles where area is proportional to value within a hierarchy. Color encodes a second dimension. The largest, darkest rectangle is your highest-priority problem — visible at a glance.",
    benefits: [
      "Preserves hierarchical structure (Plant → Area → Unit → Tag) in one view",
      "Area proportionality makes magnitude instantly comparable across many items",
      "Drill-down navigation through the hierarchy",
    ],
    downsides: [
      "Requires hierarchical data structured as a parent-child tree",
      "Hard to read when many items are similar in size",
    ],
    usage:
      "Structure the hierarchy in the Data Points tab to match your plant: Plant → Process Area → Unit → Tag. Set rectangle area to the metric you want to size by and color to severity or priority. Click to drill into an area and see contributing units. The treemap is most powerful when values span a wide range — a unit with 10× the alarm count stands out immediately by area.",
    scenarios: [
      {
        role: "Controls Engineer",
        title: "Plant-Wide Alarm Load — Which Area Drives the Burden?",
        description:
          "Structure the treemap as Plant → Process Area → Unit → Tag, with area proportional to 30-day alarm count and color representing worst active priority. At a glance, the largest red rectangle is the unit and area responsible for the most alarm burden — the drill-down reveals the specific tags without needing to scroll through an alarm report sorted by a single column.",
      },
      {
        role: "Reliability Engineer",
        title: "Maintenance Backlog — Work Orders by Area and Priority",
        description:
          "Map open work orders with area proportional to estimated labor hours and color by priority (P1=red, P2=orange, P3=yellow). The treemap immediately shows whether the backlog is concentrated in one process area or spread uniformly — when 60% of labor hours are in one area, that is where contract maintenance support should be deployed first.",
      },
      {
        role: "Accounting / Finance",
        title: "Operating Cost Distribution — Spend by Area",
        description:
          "Map year-to-date operating cost with area proportional to spend and color representing variance from budget (green=under, red=over). The treemap makes it immediately obvious which cost category and process area is driving the overspend — replacing a multi-tab spreadsheet with a single view that non-financial managers can read in 10 seconds during a budget review meeting.",
      },
    ],
  },
  {
    id: 32,
    name: "Funnel Chart",
    category: "Flow / Hierarchy",
    tier: "late",
    library: "ECharts",
    realTime: "optional",
    acceptedPointTypes: ["analog", "boolean", "discrete_enum"],
    description:
      "Stacked trapezoids of decreasing width representing progressive reduction through sequential stages. Width proportional to value makes drop-off rates between stages immediately visible — a dramatic narrowing between two stages is where the bottleneck or attrition occurs.",
    benefits: [
      "Stage-by-stage attrition is visually obvious by width change",
      "Conversion rates between stages labeled automatically",
      "Works for any sequential pipeline with measurable counts at each stage",
    ],
    downsides: [
      "Only for strictly sequential processes where items can drop out",
      "Not for branching flows — use Sankey for those",
    ],
    usage:
      "Assign a count or total point to each pipeline stage in the Data Points tab. Enable conversion percentage labels in the Options tab — the largest percentage drop between adjacent steps is your process bottleneck. Configure an auto-refresh interval for a live operational dashboard.",
    scenarios: [
      {
        role: "Reliability Engineer",
        title: "Work Order Lifecycle — Where Do Orders Stall?",
        description:
          "Map the work order pipeline stages: Raised → Screened → Approved → Planned → Scheduled → In Progress → Closed. The stage with the largest funnel narrowing — typically between Approved and Planned — identifies where the bottleneck is. If 40% of approved work orders never reach the Planning stage within the target 5 days, the funnel immediately shows this without requiring a query against the CMMS.",
      },
      {
        role: "Safety Engineer",
        title: "Near-Miss to Corrective Action — Closure Rate",
        description:
          "Track the safety observation pipeline: Reported → Reviewed → Root Cause Identified → Action Assigned → Action Completed → Verified Closed. Each stage narrowing shows the percentage that progressed. When corrective actions are assigned but fewer than 60% are verified closed, the funnel quantifies the closure culture problem in one visual — the basis for a management accountability conversation.",
      },
      {
        role: "Accounting / Finance",
        title: "Capital Project Approval Pipeline — Budget at Each Stage",
        description:
          "Track capital project requests through the approval pipeline: Concept → Scope Defined → Cost Estimate → Approval Requested → Approved → Funded → In Execution. The funnel stages by total requested dollar value rather than count — the dramatic narrowing between Approval Requested and Approved shows exactly how much capital value is waiting in queue and how the approval bottleneck is delaying the asset improvement program.",
      },
    ],
  },
  {
    id: 33,
    name: "Radar Chart",
    category: "Flow / Hierarchy",
    tier: "late",
    library: "ECharts",
    realTime: "optional",
    acceptedPointTypes: ["analog", "boolean", "discrete_enum"],
    description:
      "Multi-axis polygon where each axis represents a different attribute. A perfectly balanced polygon means all attributes are equal; a lopsided shape immediately points to the weak attribute.",
    benefits: [
      "Multi-attribute equipment health profiles in one compact view",
      '"Shape" of the polygon is instantly recognizable across equipment',
      "Immediately highlights the weakest dimension",
    ],
    downsides: [
      "Hard to read with more than 8 axes",
      "Requires normalization — all axes must share a 0–100 scale",
    ],
    usage:
      "In the Scaling tab, normalize all axes to 0–100 where 100 is perfect health and 0 is the worst acceptable state. Use 4–7 axes. Overlay multiple pieces of the same equipment type to compare health profiles — a collapsed corner on one polygon shows which machine has a problem and on which attribute.",
    scenarios: [
      {
        role: "Reliability Engineer",
        title: "Compressor Fleet Health Comparison — One Glance",
        description:
          "Normalize vibration severity, bearing temperature deviation from ambient, efficiency vs. design, hours since last maintenance, and lube oil pressure across all compressors in the plant to a 0–100 scale. Overlay K-101A, K-101B, and K-101C as three polygons on the same radar. The polygon with the most collapsed corner immediately identifies which compressor has the most acute problem and on which attribute — directing the next field inspection without reviewing six separate trend charts.",
      },
      {
        role: "Process Engineer",
        title: "Unit Performance Scorecard — Design vs. Current",
        description:
          "Build a radar with axes for feed rate vs. design, conversion vs. design, yield efficiency, energy intensity, product quality index, and run length vs. planned. Overlay the current campaign against the best historical campaign. The shape difference reveals which performance dimension has degraded most since the last turnaround — focusing the engineer's investigation on the attribute with the most collapsed axis rather than reviewing all parameters equally.",
      },
      {
        role: "Accounting / Finance",
        title: "Business Unit Performance vs. Budget — Multi-KPI Profile",
        description:
          "Build a radar with axes for production volume, margin per barrel, energy cost per barrel, maintenance cost per barrel, unit availability, and HSE leading indicator score — all normalized to 100% of budget/target. Overlay this month against the same month last year. The finance team sees the complete performance profile in one chart rather than six separate slides — a business unit that is strong on volume but collapsing on energy cost is immediately identifiable by the lopsided polygon shape.",
      },
    ],
  },

  // ── Industrial Indicators ───────────────────────────────────────────────────
  {
    id: 7,
    name: "KPI Card",
    category: "Industrial",
    tier: "initial",
    library: "Custom",
    realTime: true,
    acceptedPointTypes: ["any"],
    description:
      'Single large value display with label, trend indicator (up/down arrow), threshold coloring, and optional embedded sparkline. The "big number" widget for dashboards — readable from across a control room.',
    benefits: [
      "Instantly readable at distance — designed for control room displays",
      "Threshold coloring responds live to alarm state changes",
      "Optional sparkline shows recent trend direction",
    ],
    downsides: [
      "Only shows one value — no time-series context without sparkline",
    ],
    usage:
      "Reserve KPI Cards for the 5–10 metrics that matter most at shift level. In the Scaling tab, set warning and critical thresholds — the card background color changes automatically. Enable the sparkline to show the last 2–4 hours of trend direction alongside the current value. Group related KPI Cards together in a pane for a complete status picture.",
    scenarios: [
      {
        role: "Operations Manager",
        title: "Crude Charge Rate — Are We Making the Plan?",
        description:
          "Display today's average crude charge rate (MBPD) as the primary large number with threshold coloring (green if within 2% of monthly plan, red if more than 5% below plan). In the morning standup, this single number replaces a 5-minute discussion about whether the unit made its rate — the color communicates the answer before anyone speaks.",
      },
      {
        role: "Safety Engineer",
        title: "Days Since Last Recordable Safety Incident",
        description:
          "Display the current count of consecutive days without a recordable incident in large, bold type with the personal best (record streak) shown in smaller text below. This card is displayed on the control room main monitor at all times as a behavioral safety reinforcement tool — any supervisor entering the control room sees whether the streak is intact or was broken before opening a single system.",
      },
      {
        role: "Accounting / Finance",
        title: "Month-to-Date Realized Refinery Margin ($/bbl)",
        description:
          "Display the rolling month-to-date realized net refinery margin (USD per barrel processed), calculated from product revenue minus crude cost minus variable costs, updated daily as accounting closes each day's actuals. A red card mid-month triggers a cost reduction review with operations before the month closes — the single number tells finance whether the business is tracking to plan or needs corrective action immediately.",
      },
      {
        role: "Marketing / Trading",
        title: "Current Gasoline Crack Spread — Live Margin Signal",
        description:
          "Display the live calculated gasoline crack spread (product price minus crude cost, USD/bbl) from a calculated point fed by market price data. The card color changes when the crack spread drops below the variable cost floor — the signal that the blending team should defer a tank transfer to avoid locking in a loss — or rises above the target, signaling that a prompt cargo sale maximizes value.",
      },
    ],
    contexts: ["dashboard", "designer", "report"],
  },
  {
    id: 8,
    name: "Gauge",
    category: "Industrial",
    tier: "initial",
    library: "ECharts",
    realTime: true,
    acceptedPointTypes: ["analog", "boolean", "discrete_enum"],
    description:
      "Circular radial gauge showing a single value against a range with colored threshold zones. Maps directly to the physical instrument analogy — operators who came up through the field recognize a gauge face immediately.",
    benefits: [
      "Familiar physical instrument metaphor — no training required",
      "Colored threshold zones (green/yellow/red) respond to live values",
      "Live needle updates",
    ],
    downsides: [
      "Large screen footprint for a single value",
      "Less space-efficient than a Bullet Chart for KPI dashboards",
    ],
    usage:
      "In the Scaling tab, set the full engineering range from the physical minimum to the physical maximum — not just the alarm range. Define 2–3 colored zones: green for the normal operating band, yellow for the caution zone, and red for the alarm zone. Use gauges sparingly — a row of 4–6 gauges communicates unit health at a glance, but a page full of gauges becomes harder to scan than a table.",
    scenarios: [
      {
        role: "Operator",
        title: "HCU Reactor Inlet Pressure — Physical Instrument Analogy",
        description:
          "Place a gauge for reactor inlet pressure (psig) on the process graphic adjacent to the reactor vessel symbol, with green zones for normal operating range, yellow for approach-to-limit zones, and red for interlock action zones. Field operators who rotate through the control room recognize the gauge face format from physical panel instruments — no legend or training is required to understand whether the reading is safe.",
      },
      {
        role: "Environmental / HSE Engineer",
        title: "SRU Tail Gas H₂S — Real-Time Compliance Gauge",
        description:
          "Display a gauge for tail gas H₂S concentration (ppmv) on the environmental compliance workstation with a green zone below the permit limit, yellow from 80% to 100% of the limit, and red above. When the needle enters yellow, the HSE engineer calls the SRU operator to evaluate whether additional catalyst bed bypass adjustment is needed — without having to open a trend or alarm screen.",
      },
      {
        role: "Reliability Engineer",
        title: "Centrifugal Compressor Discharge Temperature",
        description:
          "Display a gauge for main air compressor discharge temperature on the equipment health dashboard, with threshold zones calibrated to the OEM bearing temperature limits. A value creeping into the yellow zone during a routine area patrol prompts an immediate check of lube oil flow and cooler performance — the gauge gives the maintenance technician the answer faster than pulling up a trend on a terminal.",
      },
    ],
  },
  {
    id: 9,
    name: "Sparkline",
    category: "Industrial",
    tier: "initial",
    library: "uPlot",
    realTime: true,
    acceptedPointTypes: ["any"],
    description:
      'Miniature inline trend chart with no axes, no labels, no interactive features. Answers only one question — "which direction is this going?" — in the smallest possible space.',
    benefits: [
      "Extremely compact — adds trend context with minimal screen space",
      "No visual clutter",
      "Live updates",
    ],
    downsides: ["No scale context — cannot read specific values"],
    usage:
      "Embed inside a KPI Card to show the recent history behind the headline number. Use in Data Table cells to add a trend direction column alongside current values. A 1–2 hour lookback suits shift-level monitoring; extend to 8 hours for full-shift direction.",
    scenarios: [
      {
        role: "Operator",
        title: "KPI Card Trend Direction — Is This Getting Better or Worse?",
        description:
          "Embed a sparkline in each KPI card on the shift dashboard to show the last 2 hours of trend alongside the current value. An operator seeing a green KPI card with a steeply falling sparkline understands that the value is currently within threshold but trending toward a breach — without the sparkline, the card color alone would suggest everything is fine.",
      },
      {
        role: "Reliability Engineer",
        title: "Equipment Health Table — Trend Column for Every Asset",
        description:
          "Add a sparkline column to the rotating equipment health data table, showing the last 8-hour vibration trend for every pump and compressor in one row. A technician scanning the table during an area round immediately sees which equipment is trending upward versus stable — the sparklines replace 20 separate trend chart opens with a single scannable column.",
      },
    ],
    contexts: ["dashboard", "designer", "report"],
  },
  {
    id: 10,
    name: "Analog Bar Indicator",
    category: "Industrial",
    tier: "initial",
    library: "Custom",
    realTime: true,
    acceptedPointTypes: ["analog", "boolean", "discrete_enum"],
    description:
      'ISA-101 "moving analog indicator" — segmented zone bar with moving pointer. Shows value position relative to operating limits, alarm thresholds, and setpoint in a compact linear format.',
    benefits: [
      "ISA-101 compliant",
      "Shows threshold position relative to full engineering range",
      "Optional setpoint marker for control loop monitoring",
      "Horizontal or vertical orientation",
    ],
    downsides: [
      "Only for continuous analog variables with defined operating zones",
    ],
    usage:
      "In the Scaling tab, set the full engineering range and define colored operating zones. Add a setpoint marker in Options when the variable is under automatic control. Mount vertically to mimic panel instrument orientation, or horizontally for compact dashboards.",
    scenarios: [
      {
        role: "Operator",
        title: "Flow Controller — Value, Setpoint, and Limits in One View",
        description:
          "Place an analog bar indicator for a crude charge flow controller alongside its control faceplate on the process graphic. The bar shows the current flow (pointer position), the setpoint (marker line), the normal operating band (green zone), and the alarm limits (red zones) simultaneously — the gap between pointer and setpoint marker tells the operator whether the controller is responding without reading any numbers.",
      },
      {
        role: "Controls Engineer",
        title: "Controller Output Monitoring — Is the Valve Saturating?",
        description:
          "Add an analog bar indicator for controller output (0–100%) on the tuning display for a critical pressure controller. When the output pointer sits at 100% (fully saturated), the controller has lost authority and can no longer respond to a rising pressure — the bar indicator makes this immediately visible, prompting the engineer to either reduce the setpoint or investigate why the valve is undersized for the current load.",
      },
    ],
    contexts: ["dashboard", "designer", "report"],
  },
  {
    id: 11,
    name: "Fill Gauge",
    category: "Industrial",
    tier: "initial",
    library: "Custom",
    realTime: true,
    acceptedPointTypes: ["analog", "boolean", "discrete_enum"],
    description:
      "Level indicator showing physical capacity as a continuous fill. A 62% value fills 62% of the gauge. Supports vessel overlay mode (fills a custom equipment shape) and standalone bar mode.",
    benefits: [
      "Direct physical metaphor for tank and vessel levels",
      "Fill color follows alarm state automatically",
      "Vessel overlay mode fills a drawn equipment shape in the Designer",
    ],
    downsides: [
      "Only for physical levels (volume, mass, percentage of capacity)",
    ],
    usage:
      "In the Scaling tab, set the scale to actual engineering units and configure alarm thresholds — the fill color shifts automatically when live values cross each threshold. In the Designer module, use vessel overlay mode to place the fill inside a drawn vessel shape so the level appears to fill the actual vessel outline.",
    scenarios: [
      {
        role: "Operator",
        title: "Crude Storage Tank Level — Visual Fill on Process Graphic",
        description:
          "Place a fill gauge inside the drawn tank outline on the crude storage area graphic, configured in barrels with high-high and low-low alarm thresholds. As the tank fills from a cargo delivery, the fill height rises in real time — operators in the control room can see exactly how full the tank is without navigating to a separate level display or calculating from a raw percentage reading.",
      },
      {
        role: "Production Planner",
        title: "Finished Product Tank Inventory — Multiple Tanks at a Glance",
        description:
          "Display fill gauges for all finished product tanks (gasoline, jet, diesel) side by side on a tank farm overview graphic. The planner sees the inventory position for every product simultaneously and can immediately identify which tank is approaching a high level (requiring a prompt cargo scheduling decision) and which is approaching a low level (requiring a production rate adjustment to avoid running dry during a customer delivery).",
      },
    ],
    contexts: ["dashboard", "designer", "report"],
  },
  {
    id: 12,
    name: "Alarm Indicator",
    category: "Industrial",
    tier: "initial",
    library: "Custom",
    realTime: true,
    acceptedPointTypes: ["any"],
    description:
      "ISA-101 priority-coded alarm indicator. Triple redundant coding (shape + color + text) ensures the priority is readable even by colorblind operators. Completely invisible when no alarm is active.",
    benefits: [
      "ISA-101 compliant triple coding — accessible to colorblind operators",
      "Single-point or aggregate mode (worst active priority across multiple alarms)",
      "Flashes for unacknowledged alarms, solid for acknowledged-but-active",
      "Disappears entirely when all alarms are normal",
    ],
    downsides: ["Point-in-time indicator only — no trend or history context"],
    usage:
      "Place directly adjacent to or inside an equipment shape on a process graphic. Use single-point mode for one alarm tag per indicator. Use aggregate mode for complex equipment — all associated alarm tags feed into one indicator showing the worst active priority. The indicator flashes when unacknowledged and disappears entirely when all conditions return to normal.",
    scenarios: [
      {
        role: "Operator",
        title: "Process Graphic Alarm Indication — Equipment-Level Status",
        description:
          "Place an alarm indicator in aggregate mode on each piece of major equipment on the HCU overview graphic — reactor, recycle compressor, feed/effluent exchangers, product separator. Each indicator summarizes all alarms for that equipment item into one symbol using the worst active priority. During an upset, the operator sees at a glance which equipment has active alarms without opening the alarm list — the worst-priority symbol tells them where to focus first.",
      },
      {
        role: "Safety Engineer",
        title: "Safety-Critical Instrument Status — Graphic Overlay",
        description:
          "Place alarm indicators on every SIL-rated safety instrument function (SIF) on the safety instrumented system overview graphic. An activated indicator on a SIF input transmitter signals that the safety function may be impaired — the operator or safety technician must investigate and apply the site bypass management procedure before the function can be considered unavailable without a written bypass.",
      },
    ],
    contexts: ["dashboard", "designer"],
  },

  // ── Heatmap ─────────────────────────────────────────────────────────────────
  {
    id: 17,
    name: "Heatmap",
    category: "Heatmap",
    tier: "mid",
    library: "ECharts",
    realTime: "optional",
    acceptedPointTypes: ["analog", "boolean", "discrete_enum"],
    description:
      "Two display modes in one chart type. Matrix mode: X/Y grid where color intensity represents value magnitude at each cell intersection. Calendar mode: full calendar layout — each day colored by its aggregate value. Reveals 2D patterns invisible in trend charts.",
    benefits: [
      "Reveals 2D patterns invisible in trend charts",
      "Matrix mode identifies systematic triggers by hour and day of week",
      "Calendar mode shows seasonal and day-of-year patterns across a full year",
      "Configurable color scale",
    ],
    downsides: [
      "Matrix mode requires the data to aggregate meaningfully by hour and day-of-week",
      "Color scale choice significantly affects perceived pattern strength",
    ],
    usage:
      "In the Options tab, choose Matrix or Calendar mode. Matrix mode aggregates the assigned point by hour-of-day × day-of-week. Calendar mode shows a full year — set the Year in Options to select which year. Select the color scale for your use case — Blue→Red for alarm/frequency, Viridis for continuous value distributions.",
    scenarios: [
      {
        role: "Controls Engineer",
        title: "Alarm Frequency Heat Map — Systematic Trigger Identification",
        description:
          "Assign an alarm activation count tag in matrix mode for a 90-day period. A bright cell at 6 AM Monday reveals that the alarm fires systematically at shift change — the root cause is typically a setpoint change procedure during handover rather than a process condition, completely changing the corrective action from alarm rationalization to operator procedure revision.",
      },
      {
        role: "Energy Manager",
        title: "Peak Demand Pattern — When the Refinery Draws Most",
        description:
          "Assign total electrical demand (kW) in matrix mode over 6 months. The resulting heat map shows which hours of the day and which days of the week consistently drive peak demand charges on the utility bill. Scheduled startups and high-load operations concentrated in the peak-demand cells can be shifted by 1–2 hours with no production impact, reducing the monthly demand charge by thousands of dollars.",
      },
      {
        role: "Environmental / HSE Engineer",
        title: "Annual Flare Activity Calendar — Seasonal Patterns",
        description:
          "Assign the daily total flare hydrocarbon loss in calendar mode for the full permit year. The calendar view reveals whether flaring is concentrated in winter months (due to steam system pressure management) or during specific turnaround periods, or distributed uniformly — the pattern completely changes the remediation strategy and the narrative in the annual environmental report.",
      },
      {
        role: "Accounting / Finance",
        title: "Daily Revenue Pattern — Which Days Generate Most Value",
        description:
          "Assign calculated daily product revenue in calendar mode for a full year. Days with high revenue (driven by high throughput and favorable product prices) stand out as dark cells; turnaround and maintenance days appear as light cells. The calendar makes it immediately visible how many high-value operating days were lost to unplanned shutdowns versus planned maintenance — a financial argument for shifting planned downtime from high-margin summer periods to low-margin shoulder months.",
      },
    ],
  },

  // ── Event / Timeline ─────────────────────────────────────────────────────────
  {
    id: 14,
    name: "Event Timeline",
    category: "Event",
    tier: "initial",
    library: "Custom",
    realTime: true,
    acceptedPointTypes: ["any"],
    description:
      "Horizontal timeline showing events, alarms, and state changes as colored bars and markers. Multiple rows for different alarm sources. A synchronized crosshair connects the event timeline with adjacent trend charts.",
    benefits: [
      "Synchronized crosshair correlates alarms with trend values at the exact same instant",
      "Duration bars show how long each alarm was active",
      "Priority filter (HH/H/M/L) removes noise",
    ],
    downsides: [
      "Dense data with many alarm sources requires filtering to be readable",
      "Not for continuous measurement trends",
    ],
    usage:
      "Place in a pane directly below a Trend chart for investigation layouts. Filter to High and High-High in the Options tab to remove background noise. Enable duration bars to see how long each alarm was active. Use the synchronized crosshair to step from an alarm event to the corresponding moment on the trend.",
    scenarios: [
      {
        role: "Process Engineer",
        title: "WABT Exceedance Investigation — Which Alarm Came First?",
        description:
          "Build an event timeline for the 6-hour window around a documented temperature exceedance, showing quench flow alarm, hydrogen purity alarm, makeup hydrogen alarm, and WABT high alarm as separate rows. The timeline visually proves that the quench flow alarm preceded the temperature alarm by 14 minutes — changing the root cause from 'equipment failure' to 'operator response time' and directing the corrective action to the alarm response procedure rather than the equipment.",
      },
      {
        role: "Controls Engineer",
        title: "Alarm Flood Characterization — Rate Push Analysis",
        description:
          "Generate an event timeline showing every alarm activation across the CDU during a 2-hour rate increase from 85% to 100% capacity. When 47 alarms fire within the first 20 minutes, the dense bar pattern makes the alarm flood visible immediately — and the fact that all 47 come from the same process area identifies that the level controllers are not in rate-following mode, focusing the DCS configuration fix.",
      },
      {
        role: "Safety Engineer",
        title:
          "ESD Sequence Verification — Did the Shutdown Execute Correctly?",
        description:
          "Render an event timeline of all ESD valve closures, pump trips, and compressor coast-down confirmations during a unit trip, each as a bar with start and end timestamps. The timeline confirms whether the ESD executed within its design response time (typically under 2 seconds for critical valves) and whether all shutdown elements completed in the correct sequence — required for the post-trip safety system performance report.",
      },
      {
        role: "Environmental / HSE Engineer",
        title: "Permit Exceedance — Events and Maintenance Context",
        description:
          "Build a timeline overlay showing regulatory exceedance periods (red bars) for the tail gas analyzer alongside co-occurring maintenance events from the work order system (operator log entries from the logbook, catalyst bypass valve position). The multi-layer timeline proves or disproves operator awareness during exceedance events — critical for determining whether the exceedance qualifies as a reportable deviation requiring regulatory notification.",
      },
    ],
  },

  // ── Tabular ──────────────────────────────────────────────────────────────────
  {
    id: 15,
    name: "Data Table",
    category: "Tabular",
    tier: "initial",
    library: "TanStack",
    realTime: true,
    acceptedPointTypes: ["any"],
    description:
      "Full-featured data table with sorting, filtering, conditional formatting, and real-time cell updates. Handles very large datasets without slowing down — suitable for point lists, event logs, and any tabular data that needs precise reading of individual values.",
    benefits: [
      "Handles 100K+ rows without performance degradation",
      "Sortable and filterable columns",
      "Real-time cell updates",
      "Conditional formatting colors cells by threshold or state",
    ],
    downsides: [
      "No trend context — just the current value at the current moment",
      "Text-heavy — not suited for at-a-glance monitoring from a distance",
    ],
    usage:
      "Add each monitored point in the Data Points tab — each becomes a column showing current value, quality status, and last update time. Configure conditional formatting rules in the Options tab to color cells red when outside limits and yellow for caution. Sort by value to quickly find the highest or lowest reading. Apply a tag name or description filter to locate specific points in a large list.",
    scenarios: [
      {
        role: "Operator",
        title: "All Active Alarms — Priority-Sorted Live Table",
        description:
          "Display all currently active alarms in a table sorted by ISA-18.2 priority (HH first, then H, Lo, LLo), with columns for tag, alarm type, current value, limit, activation time, and acknowledgment status. New alarms appear at the top in red before acknowledgment and shift to yellow after — the operator always sees the most critical unacknowledged condition without any manual sorting or filtering.",
      },
      {
        role: "Reliability Engineer",
        title: "Rotating Equipment Health Board — All Assets in One View",
        description:
          "Build a live table of every pump and compressor with columns for current vibration, bearing temperature, lube oil pressure, and a calculated health index, with row coloring green (normal), yellow (alert range), and red (danger range). A red row for any asset directs the next field patrol immediately — the table replaces the need to open individual trend screens for 30+ pieces of equipment during a daily equipment review.",
      },
      {
        role: "Quality Analyst",
        title: "Product Rundown Stream Compliance — Live Pass/Fail",
        description:
          "Monitor every rundown stream from the crude unit in a table — stream name, current measured value (flash point, sulfur, distillation T90), specification limit, and a live pass/fail indicator column. When the jet stream shows 'FAIL' before the tank switch, the analyst immediately calls the board operator to adjust the draw-point before off-spec material enters the product tank.",
      },
      {
        role: "Accounting / Finance",
        title: "Daily Production Totaliser Reconciliation — Automated Check",
        description:
          "Display all flow totalisers updated at midnight with columns for instrument tag, description, yesterday's process totaliser volume, the custody transfer meter reading, and the calculated discrepancy (%). Any row with a discrepancy above 0.5% turns red automatically — this is the first step in the daily hydrocarbon loss-and-gain accounting process, replacing a manual 2-hour spreadsheet exercise with an automated check that takes 10 minutes to review.",
      },
    ],
  },

  // ── New chart types (ids 35–39) ─────────────────────────────────────────────
  {
    id: 35,
    name: "State Timeline",
    category: "Industrial",
    tier: "initial",
    library: "Custom",
    realTime: true,
    acceptedPointTypes: ["boolean", "discrete_enum"],
    description:
      "Shows discrete equipment states as colored horizontal bands over time. Multiple equipment items share a synchronized time axis. Distinct from Event Timeline: State Timeline shows the continuous state at every moment, not just when events occur.",
    benefits: [
      "Continuous state history of multiple equipment items simultaneously",
      "Synchronized with adjacent trend charts via shared time cursor",
      "Simultaneous trips appear as a vertical boundary across multiple rows",
    ],
    downsides: [
      "Only for discrete digital points — not for continuous analog values",
    ],
    usage:
      "Add each equipment point in the Data Points tab — each becomes one labeled row. In the Options tab, configure the State mapping table to match your actual discrete values with labels and colors. Set the toolbar duration to the shift or investigation window. Place above or below a trend chart for correlation.",
    scenarios: [
      {
        role: "Operator",
        title: "Compressor and Pump Status — Unit-Wide Equipment Overview",
        description:
          "Add all rotating equipment in a process unit as rows (compressors, charge pumps, product pumps, cooling water pumps) and set the toolbar to an 8-hour shift window. The state timeline shows every equipment item that was running, stopped, tripped, or in maintenance simultaneously on a shared time axis — the operator or shift supervisor can answer 'what was the equipment status at any point in the shift' without reviewing alarm logs.",
      },
      {
        role: "Reliability Engineer",
        title: "OEE Availability Calculation — From the State Timeline",
        description:
          "Configure the state timeline for all equipment in a unit to distinguish Running (green), Planned Maintenance (purple), and Unplanned Downtime (red) states over a 30-day period. The total colored bar lengths directly yield the availability, planned downtime, and unplanned downtime percentages for the OEE calculation — replacing a manual review of work orders and operator logs with an automated availability measurement.",
      },
      {
        role: "Production Planner",
        title: "Maintenance Window Impact — Visualizing Schedule Conflicts",
        description:
          "Display the planned maintenance schedule for an upcoming turnaround as a state timeline showing each equipment item's planned status (running, in preparation, isolated, in maintenance, recommissioning) by day. When two interdependent equipment items are scheduled for simultaneous isolation, the timeline makes the conflict immediately visible — a scheduling risk that a Gantt chart table would require careful inspection to catch.",
      },
    ],
  },
  {
    id: 36,
    name: "Scorecard Table",
    category: "Tabular",
    tier: "mid",
    library: "TanStack",
    realTime: true,
    acceptedPointTypes: ["analog", "boolean", "discrete_enum"],
    description:
      "Multi-KPI table where each cell is individually color-coded green/yellow/red against configurable thresholds. Rows are time periods or parallel assets. Each column is a KPI point.",
    benefits: [
      "Per-cell threshold coloring — each KPI has its own green/yellow/red limits",
      "Rows can be time periods (shift comparison) or parallel assets (unit comparison)",
      "Aggregate function configurable per deployment",
      "Auto-refreshes on a configurable interval",
    ],
    downsides: [
      "Aggregated view only — not for reading raw values at specific timestamps",
    ],
    usage:
      "Assign each KPI as a Metric point in the Data Points tab. In the Options tab, set Row period (Hour, Shift, Day, Week) and Aggregate function (Average, Last, Sum). Configure green/yellow/red threshold bands in the Scaling tab per column. Set Refresh interval to keep cells current.",
    scenarios: [
      {
        role: "Operations Manager",
        title: "Shift Handover Scorecard — Did Each Shift Hit Its Targets?",
        description:
          "Configure rows as Day/Evening/Night shift and columns as throughput rate, HCU conversion, energy intensity, alarm count, and product quality index. Set green thresholds to plan values and yellow to 5% off plan. The outgoing shift supervisor sees at a glance which KPIs each shift hit, which were marginal, and which failed — the handover takes 5 minutes instead of 30 because the data is already aggregated and color-coded.",
      },
      {
        role: "Reliability Engineer",
        title: "Parallel Compressor Fleet — Health Comparison",
        description:
          "Configure rows as Compressor A, B, and C, and columns as vibration index, bearing temperature delta, efficiency vs. design, and hours since last PM. Each cell is green/yellow/red against health thresholds. The maintenance planner sees which compressor is most degraded on which attribute without opening individual trend screens — directing the next planned maintenance intervention to the most compromised asset.",
      },
      {
        role: "Accounting / Finance",
        title: "Business Unit Financial Scorecard — Month to Plan",
        description:
          "Configure rows as the three business units (Crude Processing, HCU/Reforming, Utilities/Offsites) and columns as production volume, realized margin, energy cost, maintenance cost, and availability. Set thresholds to monthly budget values. The CFO and finance team see the complete financial picture across all business units in one table — the color coding immediately identifies which unit and which KPI needs a detailed investigation without reviewing three separate operating reports.",
      },
      {
        role: "Marketing / Trading",
        title: "Product Slate Performance vs. Market Targets",
        description:
          "Configure rows as weekly time periods and columns as realized price vs. benchmark for each product stream (gasoline, jet, diesel, fuel oil). Yellow and red thresholds fire when the realized price falls below the benchmark by more than 1% or 3% respectively — indicating that a blending or scheduling decision resulted in below-market realization. The trading desk sees the performance pattern across weeks and identifies whether the discount is systematic or event-driven.",
      },
    ],
    contexts: ["dashboard", "designer", "report"],
  },
  {
    id: 37,
    name: "Parallel Coordinate Plot",
    category: "Statistical",
    tier: "mid",
    library: "ECharts",
    realTime: false,
    acceptedPointTypes: ["analog"],
    description:
      "Each process variable is a vertical axis arranged side by side. Each observation — a shift, a day, a batch run — becomes a line connecting all axes at its values. Lines that cross or deviate from the main cluster are the outliers.",
    benefits: [
      "Shows all process variables for every operating period simultaneously",
      "Outlier observations stand out visually as lines that cross or fall outside the cluster",
      "Color by time reveals long-term drift across a campaign",
    ],
    downsides: [
      "Dense with many observations — opacity tuning is essential",
      "Requires a common time window or period alignment",
    ],
    usage:
      "Assign each process variable as an Axis point in the Data Points tab. In the Options tab, set Bucket size (Shift, Day, Week) and Line opacity to 0.2–0.3 so the dense normal cluster appears darker while outlier lines remain visible. Enable Color by time to detect drifting clusters. Enable Highlight outliers to automatically flag lines furthest from the cluster.",
    scenarios: [
      {
        role: "Process Engineer",
        title: "Multi-Variable Root Cause — Which Shift Was Different?",
        description:
          "Add all key process variables (temperatures, pressures, flows, compositions, quality outcomes) for a process unit at shift-level aggregation over 3 months — each line is one shift. Lines that cross through the main cluster identify anomalous shifts. Click a highlighted outlier line to identify the specific shift, then investigate what was different about that shift's process conditions versus the normal cluster.",
      },
      {
        role: "Reliability Engineer",
        title: "Compressor Performance Cluster Analysis",
        description:
          "Add suction pressure, discharge pressure, flow, speed, and power as axes for 6 months of hourly data from three parallel compressors at day-level aggregation. Each line is one day; color by which compressor. When one compressor's lines cluster differently from the others, the shape of the deviation across all five axes simultaneously identifies whether the problem is a suction pressure issue, a discharge restriction, or an internal mechanical degradation.",
      },
      {
        role: "Accounting / Finance",
        title:
          "Shift Profitability Profile — Identifying Best and Worst Shifts",
        description:
          "Add throughput, energy intensity, product quality premium, maintenance events, and calculated shift margin as axes over 6 months of shift-level data. Color lines by shift team. When one shift team's lines cluster in a distinct region — higher energy intensity and lower quality premium — the parallel coordinate plot reveals a systematic operational pattern that a Shewhart chart on a single metric would miss entirely, pointing to a specific training or procedure gap.",
      },
    ],
  },
  {
    id: 38,
    name: "X-bar/R & X-bar/S Chart",
    category: "SPC",
    tier: "mid",
    library: "uPlot",
    realTime: false,
    acceptedPointTypes: ["analog"],
    description:
      "Subgroup SPC chart with two synchronized panels tracking both process centering (X-bar) and process spread (R or S chart). Both must be in control for the process to be considered stable.",
    benefits: [
      "Monitors both centering and spread simultaneously",
      "More statistically efficient than individuals charts for subgroup data",
      "Dual subgrouping: time-based (n consecutive readings) or spatial (multiple instruments)",
    ],
    downsides: [
      "Requires subgroup data",
      "Assumes rational subgroups with common cause variation within each subgroup",
    ],
    usage:
      "In the Data Points tab, assign a single point for time-based subgrouping or multiple instruments for spatial subgrouping. In the Options tab, set Subgroup size (n) for time-based and switch the bottom panel between R and S for n > 10. Set the toolbar duration to span at least 25 subgroups. Confirm the R or S chart is in control before interpreting the X-bar chart.",
    scenarios: [
      {
        role: "Quality Analyst",
        title: "Lab Sample SPC — Shift-Level Product Quality Monitoring",
        description:
          "Assign the diesel sulfur analyzer tag with subgroup size n=5 (5 consecutive readings per shift form one subgroup, giving one X-bar chart point per shift). The X-bar chart tracks whether the sulfur mean is shifting; the R chart tracks whether measurement-to-measurement variability within each shift is increasing. An out-of-control R chart before the X-bar chart signals that analyzer maintenance is needed — not a process change.",
      },
      {
        role: "Process Engineer",
        title: "Reactor Bed Temperature Uniformity — Spatial Subgrouping",
        description:
          "Assign all 8 thermocouples across a reactor bed as separate instrument points for spatial subgrouping — at each timestamp, all 8 readings form one subgroup. The X-bar chart tracks whether the mean bed temperature is shifting (requiring a WABT adjustment); the R chart tracks whether thermocouple-to-thermocouple spread is increasing (indicating a catalyst channeling or hot spot problem). This distinguishes overall temperature management from spatial non-uniformity in one chart.",
      },
      {
        role: "Environmental / HSE Engineer",
        title: "CEMS Analyzer Precision Monitoring — Calibration Drift",
        description:
          "Apply the X-bar/R chart to hourly CEMS stack gas readings with n=6 (six consecutive hours form one daily subgroup). An out-of-control R chart on the daily subgroup spread indicates that the analyzer is drifting within the day — the instrument requires recalibration before its daily readings can be used for regulatory compliance calculation and reporting.",
      },
    ],
  },
  {
    id: 39,
    name: "Attribute Control Chart",
    category: "SPC",
    tier: "late",
    library: "ECharts",
    realTime: false,
    acceptedPointTypes: ["boolean", "discrete_enum"],
    description:
      "SPC chart for count and proportion data. Four variants: p-chart (fraction defective, variable sample), np-chart (count defective, fixed sample), c-chart (defect count per unit, fixed sample), u-chart (defects per unit, variable sample). Control limits derived from binomial or Poisson distributions, not the normal distribution.",
    benefits: [
      "Correct statistical model for count and proportion data",
      "All four standard attribute chart variants in one chart type",
      "Staircase UCL/LCL for variable sample sizes (p and u charts)",
    ],
    downsides: [
      "Count and proportion data only — not for continuous measurements",
      "Requires at least 25–30 inspection periods for reliable control limits",
    ],
    usage:
      "In the Options tab, select the chart variant that matches your data structure. For p-chart: assign defect count point and sample size point. For np-chart: set Fixed sample size in Options, assign defect count point. For c-chart: assign total defect count with fixed inspection quantity. For u-chart: assign defects per unit with variable inspection count. Set the toolbar duration to span at least 25–30 inspection periods.",
    scenarios: [
      {
        role: "Quality Analyst",
        title: "Product Inspection Failure Rate — p-chart for Variable Sample",
        description:
          "Apply a p-chart to the fraction of gasoline blend samples failing octane specification per day, with variable daily sample size. Days where the sample size is small get wider control limits (staircase profile) — the p-chart correctly accounts for this, whereas a simple fraction chart with fixed limits would incorrectly flag small-sample days. An out-of-control point triggers a blending recipe review before the product tank is nominated for delivery.",
      },
      {
        role: "Safety Engineer",
        title: "Near-Miss Rate Monitoring — u-chart Normalizing for Exposure",
        description:
          "Apply a u-chart to the count of near-miss events per unit-month, normalized by the number of person-hours worked each month (variable sample size). The u-chart correctly accounts for periods with fewer person-hours (planned shutdowns, holiday periods) when the absolute count would naturally be lower even if the underlying safety culture was unchanged. An upward trend in the u-chart signals a deteriorating safety culture before a recordable incident occurs.",
      },
      {
        role: "Environmental / HSE Engineer",
        title: "Permit Limit Exceedances — c-chart for Monthly Count",
        description:
          "Apply a c-chart to the count of hourly CEMS exceedance events per month, with fixed monitoring hours (720 per month for continuous monitoring). The c-chart detects whether the monthly exceedance count is increasing beyond natural variation — an out-of-control signal triggers a formal root cause analysis under the environmental management system before the facility approaches a regulatory reporting threshold.",
      },
    ],
  },

  // ── 3D ──────────────────────────────────────────────────────────────────────
  {
    id: 34,
    name: "3D Surface / Contour",
    category: "3D",
    tier: "late",
    library: "Plotly",
    realTime: false,
    acceptedPointTypes: ["analog"],
    description:
      "Three-dimensional surface or 2D contour projection showing how a response variable (Z) changes across two inputs (X, Y). Interactive 3D rotation, zoom, and pan. The ridge or valley on the surface is your optimal operating region.",
    benefits: [
      "Shows the response surface across two independent variables simultaneously",
      "Interactive 3D rotation — view the surface from any angle",
      "Contour mode provides a top-down view for identifying operating targets",
      "Grid resolution configurable for smooth vs. fast rendering",
    ],
    downsides: [
      "Needs sufficient historical variation in both X and Y to produce a meaningful surface",
      "No live updates — historical data only",
    ],
    usage:
      "In the Data Points tab, assign X, Y, and Z roles — X and Y are the two inputs, Z is the response variable. Set the toolbar duration long enough to cover significant variation in both X and Y. In the Options tab, increase Grid resolution from 20×20 to 30×30 if the surface appears blocky. Enable Wireframe to see grid structure. The contour view is often more useful than 3D for identifying optimal operating targets.",
    scenarios: [
      {
        role: "Process Engineer",
        title:
          "HCU Yield Optimization — Temperature and Pressure Response Surface",
        description:
          "Assign reactor temperature (X), operating pressure (Y), and VGO conversion (Z) over 6 months of varied operating conditions. The resulting surface maps the conversion response across the entire operating envelope — the ridge of maximum conversion at each pressure-temperature combination defines the optimal severity curve, replacing a static licensor table with a surface built from actual plant performance data.",
      },
      {
        role: "Energy Manager",
        title: "Fired Heater Efficiency Map — Throughput vs. Excess Air",
        description:
          "Assign crude charge rate (X), stack O₂ percent (Y), and calculated thermal efficiency (Z) for 90 days of operation. The contour view shows which combination of throughput and excess air delivers the highest thermal efficiency — the optimal operating window is visible as a dark-colored region on the contour map, and the operator setpoint target for combustion air can be directly read from the contour lines.",
      },
      {
        role: "Marketing / Trading",
        title: "Product Realization vs. Crude API and Sulfur — Value Surface",
        description:
          "Assign crude API gravity (X), crude sulfur content (Y), and realized product slate value per barrel (Z) for every cargo processed over 2 years. The resulting surface is the trading desk's empirical crude valuation model — rather than using a static linear equation, the surface captures non-linearities in how crude quality affects product mix and realization. A new crude offer can be evaluated by locating its API/sulfur coordinates on the surface and reading the expected value directly.",
      },
    ],
  },
];

export const CHART_CATEGORIES = [
  "Time-Series",
  "SPC",
  "Statistical",
  "Categorical",
  "Flow / Hierarchy",
  "Industrial",
  "Heatmap",
  "Event",
  "Scheduling",
  "Tabular",
  "3D",
];

export function getChartDefinition(id: ChartTypeId): ChartDefinition {
  const def = CHART_DEFINITIONS.find((d) => d.id === id);
  if (!def) throw new Error(`Unknown chart type ${id}`);
  return def;
}

export function getTierLabel(tier: ChartTier): string {
  switch (tier) {
    case "initial":
      return "Standard";
    case "mid":
      return "Advanced";
    case "late":
      return "Specialized";
  }
}
