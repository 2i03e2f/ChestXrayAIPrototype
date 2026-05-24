import { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";

/* Tracks which tabs have been viewed in this session — animations only fire on
   the FIRST visit per tab per page load. Refresh resets back to false. */
const SEEN = { dashboard: false, graphs: false, stdCharts: false, cotCharts: false };

/* ─── Count-up hook ─── */
function useCountUp(target, duration = 950, delay = 0, run = true) {
  const n = parseFloat(target);
  const shouldRun = useRef(run);
  const [val, setVal] = useState(shouldRun.current ? 0 : n);
  useEffect(() => {
    if (!shouldRun.current) return;
    let raf, timer;
    const start = () => {
      const t0 = performance.now();
      const tick = (now) => {
        const p = Math.min((now - t0) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        setVal(+(n * eased).toFixed(2));
        if (p < 1) raf = requestAnimationFrame(tick);
        else setVal(n);
      };
      raf = requestAnimationFrame(tick);
    };
    timer = delay > 0 ? setTimeout(start, delay * 1000) : (start(), undefined);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, []); // eslint-disable-line
  return val;
}

function AnimatedNum({ value, decimals = 2, duration = 950, delay = 0, run = true }) {
  const v = useCountUp(parseFloat(value), duration, delay, run);
  return <>{v.toFixed(decimals)}</>;
}

/* ─── In-view hook — uses callback ref so effect re-runs when element attaches ─── */
function useInView(threshold = 0.12) {
  const [el, setEl] = useState(null);
  const ref = useCallback(node => setEl(node), []);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [el, threshold]);
  return [ref, visible];
}

/* ─── JSON syntax highlighter ─── */
function highlightJson(code) {
  const tokens = [];
  let i = 0;
  while (i < code.length) {
    if (code[i] === "/" && code[i + 1] === "/") {
      const end = code.indexOf("\n", i);
      const endIdx = end === -1 ? code.length : end;
      tokens.push({ type: "comment", text: code.slice(i, endIdx) });
      i = endIdx;
      continue;
    }
    if (code[i] === '"') {
      let j = i + 1;
      while (j < code.length && code[j] !== '"') {
        if (code[j] === "\\") j++;
        j++;
      }
      const str = code.slice(i, j + 1);
      let k = j + 1;
      while (k < code.length && /\s/.test(code[k])) k++;
      const isKey = code[k] === ":";
      tokens.push({ type: isKey ? "key" : "string", text: str });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(code[i]) && (i === 0 || !/[a-zA-Z_]/.test(code[i - 1]))) {
      let j = i;
      while (j < code.length && /[0-9.]/.test(code[j])) j++;
      tokens.push({ type: "number", text: code.slice(i, j) });
      i = j;
      continue;
    }
    const bMatch = code.slice(i).match(/^(true|false|null)\b/);
    if (bMatch) {
      tokens.push({ type: "boolean", text: bMatch[0] });
      i += bMatch[0].length;
      continue;
    }
    if (/[{}\[\],:]/.test(code[i])) {
      tokens.push({ type: "punct", text: code[i] });
      i++;
      continue;
    }
    tokens.push({ type: "plain", text: code[i] });
    i++;
  }
  return tokens;
}

function JsonFileBlock({ filename, desc, code }) {
  const [open, setOpen] = useState(false);
  const tokens = open ? highlightJson(code) : [];
  return (
    <div className="json-wrap">
      <div className="json-header" onClick={() => setOpen(o => !o)}>
        <div className="json-left">
          <span className="expand-icon" style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
          <span className="json-filename">{filename}</span>
        </div>
        <span className="json-desc-inline">{desc}</span>
      </div>
      {open && (
        <pre className="json-block">
          {tokens.map((t, i) => (
            <span key={i} className={`tok-${t.type}`}>{t.text}</span>
          ))}
        </pre>
      )}
    </div>
  );
}

import gpt4oIcon from "./assets/models/gpt4o.svg";
import claudeIcon from "./assets/models/claude.svg";
import geminiIcon from "./assets/models/gemini.svg";
import grokIcon from "./assets/models/grok.svg";

const MODEL_ICONS = {
  "GPT-4o": gpt4oIcon,
  "Claude": claudeIcon,
  "Gemini": geminiIcon,
  "Grok":   grokIcon,
};
const INVERT_ON_DARK = new Set(["GPT-4o", "Grok"]);

function ModelIcon({ model, size = 14 }) {
  const src = MODEL_ICONS[model];
  if (!src) return <span className="model-dot" style={{ background: MODEL_COLORS[model]?.dot }} />;
  const cls = "model-icon" + (INVERT_ON_DARK.has(model) ? " invert" : "");
  return <img src={src} alt={model} width={size} height={size} className={cls} />;
}

/* ─── Constants ─── */
const MODELS = ["GPT-4o", "Claude", "Gemini", "Grok"];
const CONDS = ["pneumothorax", "pleural_effusion", "pulmonary_edema"];
const PROMPTS = ["std", "cot"];
const COND_LABELS = { pneumothorax: "Pneumothorax", pleural_effusion: "Pleural Effusion", pulmonary_edema: "Pulmonary Edema" };
const COND_SHORT = { pneumothorax: "PTX", pleural_effusion: "EFF", pulmonary_edema: "EDEMA" };
const PROMPT_LABELS = { std: "Standard", cot: "Chain of Thought" };
const PROMPT_SHORT = { std: "STD", cot: "CoT" };
const MODEL_ERROR_RATES = {
  "GPT-4o": { std: 0.20, cot: 0.15 },
  "Claude":  { std: 0.28, cot: 0.18 },
  "Gemini":  { std: 0.35, cot: 0.25 },
  "Grok":    { std: 0.45, cot: 0.35 },
};
const MODEL_COLORS = {
  "GPT-4o": { dot: "#10a37f" },
  "Claude":  { dot: "#d97706" },
  "Gemini":  { dot: "#4285f4" },
  "Grok":    { dot: "#8b5cf6" },
};
const TABS = [
  ["dashboard", "Dashboard"],
  ["table", "Image table"],
  ["graphs", "Graphs"],
  ["data", "Data"],
];
const TAB_HASH = {
  dashboard: "",
  table: "#image-table",
  graphs: "#graphs",
  data: "#data",
};
const HASH_TAB = Object.fromEntries(Object.entries(TAB_HASH).map(([key, hash]) => [hash, key]));
const tabFromHash = () => HASH_TAB[window.location.hash] || "dashboard";

/* ─── Scoring ─── */
function classScore(pred, gt) {
  return pred === gt ? 1 : 0;
}
function sevScore(pred, gt) {
  const diff = Math.abs(pred - gt);
  return parseFloat((1 - diff / 4).toFixed(2));
}
// promptObj = { pneumothorax, pleural_effusion, pulmonary_edema, severity }
function totalScore(promptObj, gt) {
  const cs = CONDS.map(c => classScore(promptObj[c], gt[c]));
  const ss = sevScore(promptObj.severity, gt.severity);
  const classAvg = cs.reduce((a, b) => a + b, 0) / cs.length;
  return parseFloat(((classAvg + ss) / 2).toFixed(2));
}

/* ─── Mock data ─── */
const MOCK_DATA = Array.from({ length: 20 }, (_, i) => {
  const gt = {
    pneumothorax: Math.random() > 0.5 ? "present" : "absent",
    pleural_effusion: Math.random() > 0.6 ? "present" : "absent",
    pulmonary_edema: Math.random() > 0.7 ? "present" : "absent",
    severity: Math.floor(Math.random() * 5) + 1,
  };
  const flip = (v, rate = 0.25) => Math.random() > rate ? v : (v === "present" ? "absent" : "present");
  const genPrompt = (errorRate) => ({
    pneumothorax: flip(gt.pneumothorax, errorRate),
    pleural_effusion: flip(gt.pleural_effusion, errorRate),
    pulmonary_edema: flip(gt.pulmonary_edema, errorRate),
    severity: Math.max(1, Math.min(5, gt.severity + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 2))),
  });
  const models = {};
  MODELS.forEach(m => {
    models[m] = {
      std: genPrompt(MODEL_ERROR_RATES[m].std),
      cot: genPrompt(MODEL_ERROR_RATES[m].cot),
    };
  });
  return { id: `CXR_${String(i + 1).padStart(4, "0")}`, ground_truth: gt, models };
});

/* ─── Pre-computed aggregates ─── */
function avgTotal(model, prompt) {
  let s = 0;
  MOCK_DATA.forEach(d => s += totalScore(d.models[model][prompt], d.ground_truth));
  return (s / MOCK_DATA.length).toFixed(2);
}
function avgClass(model, prompt) {
  let s = 0;
  MOCK_DATA.forEach(d => {
    const cs = CONDS.map(c => classScore(d.models[model][prompt][c], d.ground_truth[c]));
    s += cs.reduce((a, b) => a + b, 0) / 3;
  });
  return (s / MOCK_DATA.length).toFixed(2);
}
function avgSev(model, prompt) {
  let s = 0;
  MOCK_DATA.forEach(d => s += sevScore(d.models[model][prompt].severity, d.ground_truth.severity));
  return (s / MOCK_DATA.length).toFixed(2);
}
function condAcc(model, cond, prompt) {
  const correct = MOCK_DATA.filter(d => d.models[model][prompt][cond] === d.ground_truth[cond]).length;
  return (correct / MOCK_DATA.length) * 100;
}

const ACCURACY = Object.fromEntries(MODELS.map(m => [m, {
  std: avgTotal(m, "std"),
  cot: avgTotal(m, "cot"),
}]));
const BEST = MODELS.reduce((a, b) => {
  const aMax = Math.max(parseFloat(ACCURACY[a].std), parseFloat(ACCURACY[a].cot));
  const bMax = Math.max(parseFloat(ACCURACY[b].std), parseFloat(ACCURACY[b].cot));
  return aMax > bMax ? a : b;
});

const scoreColor = (v) => v === 1 ? "#6ee7b7" : v >= 0.75 ? "#a3e0c8" : v >= 0.5 ? "#fde68a" : "#f87171";

const pill = (val) => {
  if (val === "present") return <span className="pill-present">Present</span>;
  if (val === "absent")  return <span className="pill-absent">Absent</span>;
  return <span className="pill-uncertain">Uncertain</span>;
};

/* ─── Prompt toggle (used in break-card) ─── */
function PromptToggle({ value, onChange }) {
  const toggle = (e) => {
    e.stopPropagation();
    onChange(value === "std" ? "cot" : "std");
  };
  return (
    <div className="prompt-toggle">
      <div className="prompt-toggle-label">Prompt type</div>
      <div className="prompt-toggle-wrap" onClick={toggle}>
        {PROMPTS.map(p => (
          <div
            key={p}
            className={`prompt-btn${value === p ? " active" : ""}`}
          >
            <span className="prompt-btn-short">{PROMPT_SHORT[p]}</span>
            <span className="prompt-btn-long">{PROMPT_LABELS[p]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Single break-card with its own STD/COT toggle ─── */
function BreakCard({ model, modelData, gt }) {
  const [prompt, setPrompt] = useState("std");
  const promptData = modelData[prompt];
  const classScores = CONDS.map(c => ({
    cond: c,
    score: classScore(promptData[c], gt[c]),
    pred: promptData[c],
  }));
  const ss = sevScore(promptData.severity, gt.severity);
  const total = totalScore(promptData, gt);

  return (
    <div className="break-card">
      <div className="break-top">
        <div className="break-top-left">
          <ModelIcon model={model} />
          <span className="break-name">{model}</span>
          <PromptToggle value={prompt} onChange={setPrompt} />
        </div>
        <span className="total-badge" style={{ color: scoreColor(total) }}>{total}</span>
      </div>
      {classScores.map(({ cond, score, pred }) => (
        <div key={cond} className="break-row">
          <span className="break-cond">{COND_LABELS[cond]}</span>
          <span className="break-pred">{pill(pred)}</span>
          <span className="break-score" style={{ color: scoreColor(score) }}>{score}</span>
        </div>
      ))}
      <div className="break-divider" />
      <div className="break-row">
        <span className="break-cond">Severity</span>
        <span className="break-pred">
          <span className="sev-chip">{promptData.severity}/5 <span style={{ color: "#8d8d8d" }}>vs</span> {gt.severity}/5</span>
        </span>
        <span className="break-score" style={{ color: scoreColor(ss) }}>{ss}</span>
      </div>
      <div className="break-row" style={{ marginTop: 6, paddingTop: 6, borderTop: "1px dashed var(--rule)" }}>
        <span className="break-cond" style={{ color: "var(--ink-soft)" }}>Total</span>
        <span />
        <span className="break-score" style={{ color: scoreColor(total), fontWeight: 700, fontSize: 14 }}>{total}</span>
      </div>
    </div>
  );
}

/* ─── Detail panel ─── */
function DetailContent({ row }) {
  const [detailTab, setDetailTab] = useState("breakdown");
  const gt = row.ground_truth;

  return (
    <div className="detail-wrap">
          <div className="detail-header">
            <span className="detail-id">{row.id} - detailed scoring รายละเอียด</span>
            <div className="detail-tabs">
              {["breakdown", "calculation"].map(t => (
                <button key={t} onClick={() => setDetailTab(t)}
                  className={`dtab${detailTab === t ? " active" : ""}`}>
                  {t === "breakdown" ? "Score breakdown" : "Calculation"}
                </button>
              ))}
            </div>
          </div>

          {detailTab === "breakdown" && (
            <div className="break-grid">
              {MODELS.map(m => (
                <BreakCard key={m} model={m} modelData={row.models[m]} gt={gt} />
              ))}
            </div>
          )}

          {detailTab === "calculation" && (
            <div className="calc-wrap">
              <div className="calc-section">
                <div className="calc-title">Classification score (per condition) ตารางคะแนน</div>
                <div className="calc-table">
                  <div className="calc-row"><span className="calc-case">Prediction = Ground truth</span><span className="calc-val" style={{ color: "#6ee7b7" }}>1.0</span><span className="calc-note">exact match</span></div>
                  <div className="calc-row"><span className="calc-case">Prediction ≠ Ground truth</span><span className="calc-val" style={{ color: "#f87171" }}>0.0</span><span className="calc-note">wrong</span></div>
                  <div className="calc-row"><span className="calc-case" style={{ fontStyle: "italic", color: "var(--ink-mute)" }}>ใช้ระบบ binary: ตอบถูก=1 ตอบผิด=0 ไม่มีคะแนนกลาง เพราะต้องการคำตอบตัดสินใจชัดเจนของ AI</span></div>
                </div>
              </div>
              <div className="calc-section">
                <div className="calc-title">Severity score (weighted) สูตรระดับความรุนแรง</div>
                <div className="calc-formula">score = 1 - (|pred - gt| ÷ 4)</div>
                <div className="calc-table">
                  {[0,1,2,3,4].map(diff => (
                    <div key={diff} className="calc-row">
                      <span className="calc-case">|diff| = {diff}</span>
                      <span className="calc-val" style={{ color: scoreColor(1 - diff/4) }}>{(1 - diff/4).toFixed(2)}</span>
                      <span className="calc-note">{diff === 0 ? "exact" : diff === 4 ? "max wrong" : `off by ${diff}`}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="calc-section">
                <div className="calc-title">Total score สูตรคิดเลขผลลัพธ์สุทธิ</div>
                <div className="calc-formula">total = (avg classification + severity) ÷ 2</div>
                <div className="calc-note2">Range: 0.0 – 1.0 · Higher is better</div>
                <div className="calc-note2">สูตร classification = (sum of classification scores) ÷ 3</div>
              </div>
              <div className="calc-section">
                <div className="calc-title">This image - scores per model (STD prompt)</div>
                {MODELS.map(m => {
                  const mo = row.models[m].std;
                  const classAvg = (CONDS.map(c => classScore(mo[c], gt[c])).reduce((a,b)=>a+b,0)/3).toFixed(2);
                  const ss = sevScore(mo.severity, gt.severity);
                  const total = totalScore(mo, gt);
                  return (
                    <div key={m} className="calc-model-row">
                      <ModelIcon model={m} />
                      <span className="calc-model-name">{m}</span>
                      <span className="calc-eq">({classAvg} + {ss}) ÷ 2</span>
                      <span className="calc-val" style={{ color: scoreColor(total) }}>= {total}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
    </div>
  );
}

function DetailPanel({ row }) {
  return (
    <tr>
      <td colSpan={MODELS.length + 2} className="detail-td">
        <DetailContent row={row} />
      </td>
    </tr>
  );
}

/* ─── Animated SVG path (stroke-dashoffset draw effect) ─── */
function AnimatedPath({ d, stroke, strokeWidth = 1.8, opacity = 1, delay = 0, animate = true }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!animate) {
      el.style.strokeDasharray = "";
      el.style.strokeDashoffset = "";
      el.style.transition = "none";
      return;
    }
    const len = el.getTotalLength();
    el.style.strokeDasharray = len;
    el.style.strokeDashoffset = len;
    el.style.transition = "none";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!ref.current) return;
        el.style.transition = `stroke-dashoffset 1.1s cubic-bezier(0.4,0,0.2,1) ${delay}s`;
        el.style.strokeDashoffset = 0;
      });
    });
  }, [d, animate]); // eslint-disable-line
  return <path ref={ref} d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} opacity={opacity} />;
}

/* ─── Per-model line chart with hover tooltip ─── */
function ModelLineChart({ model, prompt }) {
  const seenKey = prompt === "std" ? "stdCharts" : "cotCharts";
  const doAnimate = useRef(!SEEN[seenKey]);
  useEffect(() => { SEEN[seenKey] = true; }, []); // eslint-disable-line
  const [hover, setHover] = useState(null);

  const W = 560, H = 200;
  const ML = 54, MR = 20, MT = 16, MB = 44;
  const inW = W - ML - MR, inH = H - MT - MB;

  const scores = MOCK_DATA.map(row => totalScore(row.models[model][prompt], row.ground_truth));
  const px = (i) => ML + (i / (MOCK_DATA.length - 1)) * inW;
  const py = (v) => MT + inH * (1 - v);
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0];
  const d = scores.map((s, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(s).toFixed(1)}`).join(" ");

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    if (svgX < ML || svgX > ML + inW) { setHover(null); return; }
    let ni = 0, nd = Infinity;
    for (let i = 0; i < MOCK_DATA.length; i++) {
      const dist = Math.abs(px(i) - svgX);
      if (dist < nd) { nd = dist; ni = i; }
    }
    setHover({ i: ni, x: px(ni), y: py(scores[ni]), s: scores[ni], id: MOCK_DATA[ni].id });
  };

  const TW = 110, TH = 58;
  const tx = hover ? (hover.x + 12 + TW > W - MR ? hover.x - 12 - TW : hover.x + 12) : 0;
  const ty = hover ? Math.max(MT, Math.min(hover.y - TH / 2, MT + inH - TH)) : 0;

  return (
    <div className="model-line-chart">
      <div className="model-line-title">
        <ModelIcon model={model} />
        {model}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="chart-svg"
        onMouseMove={handleMove} onMouseLeave={() => setHover(null)}
        style={{ cursor: "crosshair" }}>
        {yTicks.map(t => (
          <g key={t}>
            <line x1={ML} y1={py(t)} x2={ML + inW} y2={py(t)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
            <text x={ML - 8} y={py(t) + 5} textAnchor="end" fontSize={13} fill="var(--ink-mute)">{t.toFixed(1)}</text>
          </g>
        ))}
        <line x1={ML} y1={MT + inH} x2={ML + inW} y2={MT + inH} stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
        <AnimatedPath d={d} stroke={MODEL_COLORS[model].dot} strokeWidth={2} animate={doAnimate.current} />
        {hover && (
          <>
            <line x1={hover.x} y1={MT} x2={hover.x} y2={MT + inH} stroke="rgba(255,255,255,0.18)" strokeWidth={1} strokeDasharray="3,3" />
            <circle cx={hover.x} cy={hover.y} r={5} fill={MODEL_COLORS[model].dot} stroke="var(--bg)" strokeWidth={2} />
            <rect x={tx} y={ty} width={TW} height={TH} rx={3} fill="var(--paper)" stroke="var(--rule)" />
            <text x={tx + TW / 2} y={ty + 19} textAnchor="middle" className="chart-tip-label">{hover.id}</text>
            <text x={tx + TW / 2} y={ty + 39} textAnchor="middle" className="chart-tip-value" fill={MODEL_COLORS[model].dot}>{hover.s.toFixed(2)}</text>
          </>
        )}
        {MOCK_DATA.map((_, i) => {
          if (i % 4 !== 0 && i !== MOCK_DATA.length - 1) return null;
          return <text key={i} x={px(i)} y={H - MB + 18} textAnchor="middle" fontSize={12} fill="var(--ink-mute)">{i + 1}</text>;
        })}
      </svg>
    </div>
  );
}

/* ─── App ─── */
function GraphsPage() {
  const [stdOpen, setStdOpen] = useState(false);
  const [cotOpen, setCotOpen] = useState(false);
  const doAnimate = useRef(!SEEN.graphs);
  const [barsVisible, setBarsVisible] = useState(SEEN.graphs);
  useEffect(() => {
    if (!doAnimate.current) { setBarsVisible(true); return; }
    SEEN.graphs = true;
    const raf = requestAnimationFrame(() => setBarsVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  /* bar chart constants */
  const BW = 640, BH = 260;
  const BML = 56, BMR = 20, BMT = 20, BMB = 58;
  const bInW = BW - BML - BMR;
  const bInH = BH - BMT - BMB;
  const groupW = bInW / MODELS.length;
  const bw = Math.min(groupW * 0.28, 34);
  const bgap = 5;
  const bY = (v) => BMT + bInH * (1 - v);

  /* line chart constants */
  const LW = 640, LH = 220;
  const LML = 56, LMR = 20, LMT = 20, LMB = 54;
  const lInW = LW - LML - LMR;
  const lInH = LH - LMT - LMB;
  const lX = (i) => LML + (i / (MOCK_DATA.length - 1)) * lInW;
  const lY = (v) => LMT + lInH * (1 - v);
  const makePath = (model, prompt) =>
    MOCK_DATA.map((row, i) => {
      const s = totalScore(row.models[model][prompt], row.ground_truth);
      return `${i === 0 ? "M" : "L"}${lX(i).toFixed(1)},${lY(s).toFixed(1)}`;
    }).join(" ");

  const yTicks = [0, 0.25, 0.5, 0.75, 1.0];

  return (
    <div className="page-wrap graphs-wrap">
      <div className="graphs-inner">
      {/* ── Bar chart ── */}
      <div className="section-label">Average total score by model</div>
      <div className="graph-card">
        <svg viewBox={`0 0 ${BW} ${BH}`} width="100%" className="chart-svg">
          {yTicks.map(t => (
            <g key={t}>
              <line x1={BML} y1={bY(t)} x2={BML + bInW} y2={bY(t)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
              <text x={BML - 8} y={bY(t) + 5} textAnchor="end" fontSize={13} fill="var(--ink-mute)">{t.toFixed(2)}</text>
            </g>
          ))}
          <line x1={BML} y1={BMT + bInH} x2={BML + bInW} y2={BMT + bInH} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
          {MODELS.map((m, mi) => {
            const cx = BML + groupW * (mi + 0.5);
            const stdV = parseFloat(ACCURACY[m].std);
            const cotV = parseFloat(ACCURACY[m].cot);
            const stdX = cx - bw - bgap / 2;
            const cotX = cx + bgap / 2;
            return (
              <g key={m}>
                <rect className={`bar-svg-anim${barsVisible ? " bar-visible" : ""}`} style={{ "--bar-delay": `${mi * 0.12}s` }} x={stdX} y={bY(stdV)} width={bw} height={stdV * bInH} fill={MODEL_COLORS[m].dot} opacity={0.85} rx={2} />
                <rect className={`bar-svg-anim${barsVisible ? " bar-visible" : ""}`} style={{ "--bar-delay": `${mi * 0.12 + 0.06}s` }} x={cotX} y={bY(cotV)} width={bw} height={cotV * bInH} fill={MODEL_COLORS[m].dot} opacity={0.35} rx={2} />
                <g className={`bar-label-svg-anim${barsVisible ? " bar-visible" : ""}`} style={{ "--bl-delay": `${mi * 0.12 + 0.45}s` }}>
                  <text x={stdX + bw / 2} y={bY(stdV) - 6} textAnchor="middle" fontSize={12} fill={MODEL_COLORS[m].dot}><AnimatedNum value={stdV} duration={700} delay={mi * 0.12} run={doAnimate.current} /></text>
                  <text x={cotX + bw / 2} y={bY(cotV) - 6} textAnchor="middle" fontSize={12} fill={MODEL_COLORS[m].dot} opacity={0.7}><AnimatedNum value={cotV} duration={700} delay={mi * 0.12 + 0.06} run={doAnimate.current} /></text>
                </g>
                <text x={cx} y={BH - BMB + 20} textAnchor="middle" fontSize={13} fill="var(--ink-soft)">{m}</text>
              </g>
            );
          })}
          <rect x={BML} y={BH - 18} width={14} height={9} fill="white" opacity={0.7} rx={1} />
          <text x={BML + 18} y={BH - 9} fontSize={12} fill="var(--ink-mute)">STD</text>
          <rect x={BML + 54} y={BH - 18} width={14} height={9} fill="white" opacity={0.3} rx={1} />
          <text x={BML + 72} y={BH - 9} fontSize={12} fill="var(--ink-mute)">CoT</text>
        </svg>
      </div>

      {/* ── Line chart STD ── */}
      <div className="section-label" style={{ marginTop: "1.5rem" }}>Score per image - Standard prompt</div>
      <div className="graph-card">
        <svg viewBox={`0 0 ${LW} ${LH}`} width="100%" className="chart-svg">
          {yTicks.map(t => (
            <g key={t}>
              <line x1={LML} y1={lY(t)} x2={LML + lInW} y2={lY(t)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
              <text x={LML - 8} y={lY(t) + 5} textAnchor="end" fontSize={13} fill="var(--ink-mute)">{t.toFixed(1)}</text>
            </g>
          ))}
          <line x1={LML} y1={LMT + lInH} x2={LML + lInW} y2={LMT + lInH} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
          {MODELS.map((m, mi) => (
            <AnimatedPath key={m} d={makePath(m, "std")} stroke={MODEL_COLORS[m].dot} strokeWidth={1.8} opacity={0.85} delay={mi * 0.15} animate={doAnimate.current} />
          ))}
          {MOCK_DATA.map((row, i) => {
            if (i % 4 !== 0 && i !== MOCK_DATA.length - 1) return null;
            return (
              <text key={i} x={lX(i)} y={LH - LMB + 18} textAnchor="middle" fontSize={12} fill="var(--ink-mute)">{i + 1}</text>
            );
          })}
          <text x={LML + lInW / 2} y={LH - LMB + 34} textAnchor="middle" fontSize={12} fill="var(--ink-mute)">image #</text>
          {MODELS.map((m, mi) => (
            <g key={m}>
              <line x1={LML + mi * 110} y1={LH - 13} x2={LML + mi * 110 + 20} y2={LH - 13} stroke={MODEL_COLORS[m].dot} strokeWidth={2} />
              <text x={LML + mi * 110 + 24} y={LH - 8} fontSize={12} fill="var(--ink-mute)">{m}</text>
            </g>
          ))}
        </svg>
      </div>
      <button className="expand-detail-btn" onClick={() => setStdOpen(v => !v)}>
        <span className="expand-icon" style={{ transform: stdOpen ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
        {stdOpen ? "ซ่อนรายละเอียด" : "ดูรายละเอียดแต่ละ model"}
      </button>
      {stdOpen && (
        <div className="model-charts-grid">
          {MODELS.map(m => <ModelLineChart key={m} model={m} prompt="std" />)}
        </div>
      )}

      {/* ── Line chart CoT ── */}
      <div className="section-label" style={{ marginTop: "1.5rem" }}>Score per image - Chain of Thought prompt</div>
      <div className="graph-card">
        <svg viewBox={`0 0 ${LW} ${LH}`} width="100%" className="chart-svg">
          {yTicks.map(t => (
            <g key={t}>
              <line x1={LML} y1={lY(t)} x2={LML + lInW} y2={lY(t)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
              <text x={LML - 8} y={lY(t) + 5} textAnchor="end" fontSize={13} fill="var(--ink-mute)">{t.toFixed(1)}</text>
            </g>
          ))}
          <line x1={LML} y1={LMT + lInH} x2={LML + lInW} y2={LMT + lInH} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
          {MODELS.map((m, mi) => (
            <AnimatedPath key={m} d={makePath(m, "cot")} stroke={MODEL_COLORS[m].dot} strokeWidth={1.8} opacity={0.85} delay={mi * 0.15} animate={doAnimate.current} />
          ))}
          {MOCK_DATA.map((row, i) => {
            if (i % 4 !== 0 && i !== MOCK_DATA.length - 1) return null;
            return (
              <text key={i} x={lX(i)} y={LH - LMB + 18} textAnchor="middle" fontSize={12} fill="var(--ink-mute)">{i + 1}</text>
            );
          })}
          <text x={LML + lInW / 2} y={LH - LMB + 34} textAnchor="middle" fontSize={12} fill="var(--ink-mute)">image #</text>
          {MODELS.map((m, mi) => (
            <g key={m}>
              <line x1={LML + mi * 110} y1={LH - 13} x2={LML + mi * 110 + 20} y2={LH - 13} stroke={MODEL_COLORS[m].dot} strokeWidth={2} />
              <text x={LML + mi * 110 + 24} y={LH - 8} fontSize={12} fill="var(--ink-mute)">{m}</text>
            </g>
          ))}
        </svg>
      </div>
      <button className="expand-detail-btn" onClick={() => setCotOpen(v => !v)}>
        <span className="expand-icon" style={{ transform: cotOpen ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
        {cotOpen ? "ซ่อนรายละเอียด" : "ดูรายละเอียดแต่ละ model"}
      </button>
      {cotOpen && (
        <div className="model-charts-grid">
          {MODELS.map(m => <ModelLineChart key={m} model={m} prompt="cot" />)}
        </div>
      )}
      </div>
    </div>
  );
}

function ModelAnswerTable({ model, prompt }) {
  return (
    <section className="data-table-card">
      <div className="data-table-title">
        <ModelIcon model={model} />
        <span>{model}</span>
        <span className="prompt-chip">{PROMPT_SHORT[prompt]}</span>
      </div>
      <div className="ground-table-scroll">
        <table className="ground-table data-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>PTX</th>
              <th>EFF</th>
              <th>EDEMA</th>
              <th>Sev</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_DATA.map(row => {
              const answer = row.models[model][prompt];
              const total = totalScore(answer, row.ground_truth);
              return (
                <tr key={`${model}-${prompt}-${row.id}`}>
                  <td><span className="img-id">{row.id}</span></td>
                  {CONDS.map(cond => (
                    <td key={cond}>{pill(answer[cond])}</td>
                  ))}
                  <td><span className="gt-sev">{answer.severity}/5</span></td>
                  <td><span className="calc-val" style={{ color: scoreColor(total) }}>{total}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const groundTruthData = () => Object.fromEntries(MOCK_DATA.map(row => [row.id, row.ground_truth]));

const rawResponsesData = () => Object.fromEntries(MOCK_DATA.map(row => [row.id, row.models]));

const scoresData = () => Object.fromEntries(MOCK_DATA.map(row => [
  row.id,
  Object.fromEntries(MODELS.map(model => [
    model,
    Object.fromEntries(PROMPTS.map(prompt => {
      const answer = row.models[model][prompt];
      return [prompt, {
        pneumothorax: classScore(answer.pneumothorax, row.ground_truth.pneumothorax),
        pleural_effusion: classScore(answer.pleural_effusion, row.ground_truth.pleural_effusion),
        pulmonary_edema: classScore(answer.pulmonary_edema, row.ground_truth.pulmonary_edema),
        severity: sevScore(answer.severity, row.ground_truth.severity),
        total: totalScore(answer, row.ground_truth),
      }];
    })),
  ])),
]));

/* ─── Tree node for the Tree view mode ─── */
function TreeNode({ keyName, value, depth, defaultOpen = false }) {
  const isObj = value !== null && typeof value === "object";
  const [open, setOpen] = useState(defaultOpen || depth < 1);
  if (!isObj) {
    const t = value === null ? "null" : typeof value;
    const display = value === null ? "null" : t === "string" ? `"${value}"` : String(value);
    return (
      <div className="jm-tree-row" style={{ paddingLeft: 16 + depth * 18 }}>
        <span className="jm-tree-chev leaf">·</span>
        {keyName !== undefined && (
          <>
            <span className="jm-tree-key">"{keyName}"</span>
            <span className="jm-tree-colon">:</span>
          </>
        )}
        <span className={`jm-tree-val ${t}`}>{display}</span>
      </div>
    );
  }
  const isArr = Array.isArray(value);
  const entries = isArr ? value.map((v, i) => [i, v]) : Object.entries(value);
  const summary = isArr ? `Array(${entries.length})` : `{${entries.length} keys}`;
  return (
    <>
      <div className="jm-tree-row collapsible" style={{ paddingLeft: 16 + depth * 18 }} onClick={() => setOpen(o => !o)}>
        <span className={`jm-tree-chev${open ? " open" : ""}`}>▸</span>
        {keyName !== undefined && (
          <>
            <span className="jm-tree-key">"{keyName}"</span>
            <span className="jm-tree-colon">:</span>
          </>
        )}
        <span style={{ color: "var(--ink-mute)" }}>{isArr ? "[" : "{"}</span>
        {!open && <span className="jm-tree-summary">{summary}{isArr ? "]" : "}"}</span>}
      </div>
      {open && entries.map(([k, v]) => (
        <TreeNode key={k} keyName={isArr ? undefined : k} value={v} depth={depth + 1} />
      ))}
      {open && (
        <div className="jm-tree-row" style={{ paddingLeft: 16 + depth * 18 }}>
          <span className="jm-tree-chev leaf">·</span>
          <span style={{ color: "var(--ink-mute)" }}>{isArr ? "]" : "}"}</span>
        </div>
      )}
    </>
  );
}

/* ─── Split-view JSON viewer (sidebar + code/tree panel) ─── */
function JsonFilesViewer({ files }) {
  // files: [{ name, desc, code, data }]
  const [active, setActive] = useState(0);
  const [mode, setMode] = useState("code"); // "code" | "tree"

  const f = files[active];
  const lines = f.code.split("\n");

  return (
    <div className="jm-split">
      <aside className="jm-split-side">
        <div className="jm-split-side-label">files</div>
        {files.map((file, i) => (
          <button
            key={file.name}
            className={`jm-split-tab${active === i ? " active" : ""}`}
            onClick={() => setActive(i)}
          >
            <span className="jm-st-icon">{'{}'}</span>
            <span className="jm-st-name">{file.name}</span>
            <span className="jm-st-size">{(file.code.length / 1024).toFixed(1)}kb</span>
          </button>
        ))}
      </aside>
      <div className="jm-split-main">
        <div className="jm-split-head">
          <span className="jm-split-fname">{f.name}</span>
          <span className="jm-split-meta">{lines.length} lines</span>
          <div className="jm-split-mode" role="tablist" aria-label="View mode">
            <button className={mode === "code" ? "active" : ""} onClick={() => setMode("code")}>Code</button>
            <button className={mode === "tree" ? "active" : ""} onClick={() => setMode("tree")}>Tree</button>
          </div>
        </div>
        {mode === "code" ? (
          <pre className="jm-split-body">
            <div className="jm-num-block">
              <div className="jm-num-gutter">
                {lines.map((_, i) => <div key={i}>{i + 1}</div>)}
              </div>
              <div className="jm-num-code">
                {lines.map((line, i) => {
                  const tokens = highlightJson(line);
                  return (
                    <div key={i}>
                      {tokens.map((t, j) => <span key={j} className={`tok-${t.type}`}>{t.text}</span>)}
                    </div>
                  );
                })}
              </div>
            </div>
          </pre>
        ) : (
          <div className="jm-split-body is-tree">
            <TreeNode value={f.data} depth={0} defaultOpen />
          </div>
        )}
      </div>
    </div>
  );
}

function GroundTruthPage() {
  const groundTruthJson = JSON.stringify(groundTruthData(), null, 2);
  const rawResponsesJson = JSON.stringify(rawResponsesData(), null, 2);
  const scoresJson = JSON.stringify(scoresData(), null, 2);

  return (
    <div className="page-wrap ground-wrap">
      <div className="gw-container">
        <div className="section-label">Ground truth - ข้อมูลมาตรฐานสำหรับวัดผล</div>
        <div className="gt-list">
          {MOCK_DATA.map(row => (
            <div key={`gt-${row.id}`} className="gt-list-card">
              <span className="img-id">{row.id}</span>
              <div className="gt-list-pills">
                {CONDS.map(cond => (
                  <span key={cond} className="gt-mini">
                    <span className={`gt-mini-pill ${row.ground_truth[cond]}`} />
                    {COND_SHORT[cond]}
                  </span>
                ))}
              </div>
              <span className="gt-sev-mini">{row.ground_truth.severity}/5</span>
            </div>
          ))}
        </div>

        <div className="data-section">
          <div className="section-label">Standard prompt answers - คำตอบจาก Prompt แบบปกติ</div>
          <div className="data-table-grid">
            {MODELS.map(model => <ModelAnswerTable key={`std-${model}`} model={model} prompt="std" />)}
          </div>
        </div>

        <div className="data-section">
          <div className="section-label">Chain-of-thought prompt answers - คำตอบจาก Prompt แบบ CoT</div>
          <div className="data-table-grid">
            {MODELS.map(model => <ModelAnswerTable key={`cot-${model}`} model={model} prompt="cot" />)}
          </div>
        </div>

        <div className="ground-json">
          <div className="section-label">JSON data - ข้อมูลจัดเก็บแบบ JSON</div>
          <JsonFilesViewer files={[
            { name: "ground_truth.json",  desc: "Ground truth data used by the image table",                  code: groundTruthJson,  data: groundTruthData() },
            { name: "raw_responses.json", desc: "All model responses grouped by image, model, and prompt",    code: rawResponsesJson, data: rawResponsesData() },
            { name: "scores.json",        desc: "Per-condition, severity, and total scores",                  code: scoresJson,       data: scoresData() },
          ]} />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState(tabFromHash);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const [condRef, condVisible] = useInView(0.1);
  const [jsonRef, jsonVisible] = useInView(0.05);
  const doAnimateCards = useRef(!SEEN.dashboard);
  const [cardsVisible, setCardsVisible] = useState(SEEN.dashboard);
  useEffect(() => {
    if (!doAnimateCards.current) { setCardsVisible(true); return; }
    SEEN.dashboard = true;
    const raf = requestAnimationFrame(() => {
      doAnimateCards.current = false;
      setCardsVisible(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const switchTab = (nextTab) => {
    setTab(nextTab);
    if (window.location.hash !== TAB_HASH[nextTab]) {
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}${TAB_HASH[nextTab]}`);
    }
  };

  const filtered = filter === "all" ? MOCK_DATA : MOCK_DATA.filter(d => {
    const hasError = MODELS.some(m =>
      totalScore(d.models[m].std, d.ground_truth) < 1 ||
      totalScore(d.models[m].cot, d.ground_truth) < 1
    );
    return filter === "wrong" ? hasError : !hasError;
  });

  return (
    <div className="app">
      <div className="header">
        <div>
          <div className="header-title">CXR Benchmark</div>
          <div className="header-sub">Chest X-ray · {MOCK_DATA.length} images · 4 models · 3 conditions · 2 prompts</div>
        </div>
        <div className="tabs">
          {TABS.map(([t,l]) => (
            <button key={t} onClick={() => switchTab(t)} className={`tab-btn${tab === t ? " active" : ""}`}>{l}</button>
          ))}
        </div>
      </div>

      {tab === "dashboard" && (
        <div className="dash-wrap">

          {/* Score cards: split STD vs CoT */}
          <div className="score-grid">
            {MODELS.map((m, mi) => (
              <div key={m} className={`score-card${cardsVisible ? " card-visible" : ""}`} style={{ "--card-delay": `${mi * 0.1}s` }}>
                <div className="score-top">
                  <ModelIcon model={m} />
                  <span className="model-name">{m}</span>
                  {m === BEST && <span className="winner-badge">best</span>}
                </div>

                <div className="score-split">
                  {PROMPTS.map(p => (
                    <div key={p} className="score-half">
                      <div className="score-half-label">{PROMPT_SHORT[p]}</div>
                      <div className="score-num"><AnimatedNum value={parseFloat(ACCURACY[m][p])} run={doAnimateCards.current} /><span className="score-pct">/1.0</span></div>
                    </div>
                  ))}
                </div>
                <div className="score-label">avg total score</div>

                <div className="kappa-row split">
                  <span className="kappa-label">classification</span>
                  <div className="kappa-split">
                    <span className="kappa-val"><AnimatedNum value={parseFloat(avgClass(m, "std"))} run={doAnimateCards.current} /></span>
                    <span className="kappa-sep">|</span>
                    <span className="kappa-val"><AnimatedNum value={parseFloat(avgClass(m, "cot"))} run={doAnimateCards.current} /></span>
                  </div>
                </div>
                <div className="kappa-row split">
                  <span className="kappa-label">severity kappa</span>
                  <div className="kappa-split">
                    <span className="kappa-val"><AnimatedNum value={parseFloat(avgSev(m, "std"))} run={doAnimateCards.current} /></span>
                    <span className="kappa-sep">|</span>
                    <span className="kappa-val"><AnimatedNum value={parseFloat(avgSev(m, "cot"))} run={doAnimateCards.current} /></span>
                  </div>
                </div>
                <div className="kappa-row split kappa-row-headers">
                  <span className="kappa-label" />
                  <div className="kappa-split">
                    <span className="kappa-mini-label">STD</span>
                    <span className="kappa-sep" />
                    <span className="kappa-mini-label">CoT</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Per-condition: split STD vs CoT side by side */}
          <div ref={condRef} className={`cond-section${condVisible ? " cond-visible" : ""}`}>
            <div className="section-label">Per-condition accuracy - ความแม่นยำแต่ละภาวะ (%)</div>
            <div className="cond-grid">
              {CONDS.map(cond => (
                <div key={cond} className="cond-card">
                  <div className="cond-title">{COND_LABELS[cond]}</div>
                  <div className="cond-split">
                    {PROMPTS.map((p, pi) => (
                      <div key={p} className="cond-half">
                        <div className="cond-half-label">{PROMPT_SHORT[p]}</div>
                        {MODELS.map((m, mi) => {
                          const acc = condAcc(m, cond, p);
                          return (
                            <div key={m} className="bar-row">
                              <span className="bar-label">{m}</span>
                              <div className="bar-track">
                                <div className="bar-fill" style={{ width: `${acc}%`, background: MODEL_COLORS[m].dot, "--bd": `${(mi + pi * 4) * 0.08}s` }} />
                              </div>
                              <span className="bar-val">{acc.toFixed(0)}%</span>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* JSON section */}
          <div ref={jsonRef} className={`reveal-section${jsonVisible ? " visible" : ""}`} style={{ marginTop: "1.75rem" }}>
            <div className="section-label">Data structure Examples - ตัวอย่างการเก็บข้อมูล</div>
            <JsonFileBlock
              filename="ground_truth.json"
              desc="data set ของคำตอบที่ถูกต้อง มาตรฐานที่ใช้วัดผล"
              code={`{
  "CXR_0001": { // image ID
    "pneumothorax":     "present",  // present | absent
    "pleural_effusion": "absent",
    "pulmonary_edema":  "absent",
    "severity": 3                   // 1-5
  },
  "CXR_0002": {
    "pneumothorax":     "absent",
    "pleural_effusion": "present",
    "pulmonary_edema":  "absent",
    "severity": 2
  }
  // ... 1,000 images
}`}
            />
            <JsonFileBlock
              filename="raw_responses.json"
              desc="สิ่งที่ AI แต่ละตัวตอบมา แยกเป็น std/cot ตามprompt"
              code={`{
  "CXR_0001": {
    "GPT-4o": {
      "std": {  // standard prompt
        "pneumothorax":     "present",  // present | absent
        "pleural_effusion": "absent",
        "pulmonary_edema":  "absent",
        "severity": 2                   // 1 to 5
      },
      "cot": {  // chain of thought prompt
        "pneumothorax":     "present",
        "pleural_effusion": "absent",
        "pulmonary_edema":  "present",
        "severity": 3
      }
    }
    // ... Claude, Gemini, Grok
  }
}`}
            />
            <JsonFileBlock
              filename="scores.json"
              desc="คะแนนที่คำนวณมาได้ (ถ้าเปลี่ยนสูตรแค่ recalculate ไฟล์นี้ใหม่)"
              code={`{
  "CXR_0001": {
    "GPT-4o": {
      "std": {
        "pneumothorax":     1.0,  // ตอบถูก คะแนน 1
        "pleural_effusion": 1.0,  
        "pulmonary_edema":  0.0,  // ตอบผิด คะแนน 0
        "severity":         0.75, // 1 - (|predicted - ground_truth| ÷ 4)
        "total":            0.71  // (avg of classification + severity) ÷ 2
      },
      "cot": {
        "pneumothorax":     1.0,
        "pleural_effusion": 1.0,
        "pulmonary_edema":  0.0,
        "severity":         1.0,
        "total":            0.83
      }
    }
  }
}`}
            />
            <JsonFileBlock
              filename="metadata.json"
              desc="ข้อมูลการทดลอง, meta data ต่างๆ และ config ที่ใช้รัน"
              code={`{
  "experiment_date": "2025-05-22",  // วันที่ทดลอง
  "dataset": "NIH ChestX-ray14",    // data set ที่ใช้
  "total_images": 1000,             // จำนวนภาพรวม
  "runs_per_image": 5,              // จำนวนครั้งที่ให้ AI วิเคราะห์ซ้ำแต่ละภาพ
  "models": {                       // รายละเอียดแต่ละ model
    "GPT-4o":  { "version": "gpt-4o-2024-11-20",        "temp": 0 },
    "Claude":  { "version": "claude-sonnet-4-20250514",  "temp": 0 },
    "Gemini":  { "version": "gemini-1.5-pro-002",        "temp": 0 },
    "Grok":    { "version": "grok-2-vision-1212",        "temp": 0 }
  },
  "prompts": {
    "std": "Does this chest X-ray show the following...",        //คำสั่ง prompt แบบปกติ standard
    "cot": "Think step by step. First describe what you see..."  //คำสั่ง prompt แบบ chain-of-thought
  }
}`}
            />
          </div>
        </div>
      )}

      {tab === "table" && (
        <div className="table-wrap">
          <div className="filter-row">
            {[["all","All"],["wrong","Has errors"],["correct","All correct"]].map(([f,l]) => (
              <button key={f} onClick={() => setFilter(f)} className={`filter-btn${filter === f ? " active" : ""}`}>{l}</button>
            ))}
            <span className="filter-note">[ all correct คือ ทุก model ตอบถูกทั้งหมด (ได้ 1 ทุกตัว) ]</span>
            <span className="filter-count">{filtered.length} images</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Ground truth</th>
                  {MODELS.map(m => <th key={m}>{m}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => (
                  <>
                    <tr key={row.id}
                      onClick={() => setSelected(selected === row.id ? null : row.id)}
                      className={selected === row.id ? "selected" : ""}>
                      <td>
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <span className="img-id">{row.id}</span>
                          <span className="expand-icon" style={{ transform: selected === row.id ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
                        </div>
                      </td>
                      <td>
                        <div className="gt-cell gt-cell-full">
                          {CONDS.map(cond => (
                            <div key={cond} className="gt-cond">
                              <span className="gt-cond-label">{COND_SHORT[cond]}</span>
                              {pill(row.ground_truth[cond])}
                            </div>
                          ))}
                          <span className="gt-sev">sev {row.ground_truth.severity}/5</span>
                        </div>
                      </td>
                      {MODELS.map(m => {
                        const stdTotal = totalScore(row.models[m].std, row.ground_truth);
                        const cotTotal = totalScore(row.models[m].cot, row.ground_truth);
                        const avg = (stdTotal + cotTotal) / 2;
                        return (
                          <td key={m} style={{ background: avg === 1 ? "rgba(16,163,127,0.04)" : avg >= 0.7 ? "rgba(251,191,36,0.04)" : "rgba(220,38,38,0.04)" }}>
                            <div className="model-cell">
                              <div className="cond-boxes">
                                {CONDS.map(c => (
                                  <span
                                    key={c}
                                    className={`cond-box cond-box-${row.models[m].std[c]}`}
                                    title={`${COND_SHORT[c]}: ${row.models[m].std[c]}`}
                                  />
                                ))}
                              </div>
                              <span className="total-chip-split">
                                <span style={{ color: scoreColor(stdTotal) }}>{stdTotal}</span>
                                <span className="total-chip-sep">/</span>
                                <span style={{ color: scoreColor(cotTotal) }}>{cotTotal}</span>
                              </span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                    {selected === row.id && <DetailPanel key={`detail-${row.id}`} row={row} />}
                  </>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mobile-card-list">
            {filtered.map(row => {
              const isOpen = selected === row.id;
              return (
                <article
                  key={`mobile-${row.id}`}
                  className={`mobile-image-card${isOpen ? " selected" : ""}`}
                  onClick={() => setSelected(isOpen ? null : row.id)}
                >
                  <div className="mobile-card-head">
                    <span className="img-id">{row.id}</span>
                    <span className="expand-icon" style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
                  </div>

                  <div className="mobile-gt">
                    <span className="mobile-section-label">Ground truth</span>
                    <div className="gt-cell gt-cell-full">
                      {CONDS.map(cond => (
                        <div key={cond} className="gt-cond">
                          <span className="gt-cond-label">{COND_SHORT[cond]}</span>
                          {pill(row.ground_truth[cond])}
                        </div>
                      ))}
                      <span className="gt-sev">sev {row.ground_truth.severity}/5</span>
                    </div>
                  </div>

                  <div className="mobile-model-list">
                    {MODELS.map(m => {
                      const stdTotal = totalScore(row.models[m].std, row.ground_truth);
                      const cotTotal = totalScore(row.models[m].cot, row.ground_truth);
                      return (
                        <div key={m} className="mobile-model-row">
                          <span className="mobile-model-name">
                            <ModelIcon model={m} />
                            {m}
                          </span>
                          <div className="cond-boxes">
                            {CONDS.map(c => (
                              <span
                                key={c}
                                className={`cond-box cond-box-${row.models[m].std[c]}`}
                                title={`${COND_SHORT[c]}: ${row.models[m].std[c]}`}
                              />
                            ))}
                          </div>
                          <span className="total-chip-split">
                            <span style={{ color: scoreColor(stdTotal) }}>{stdTotal}</span>
                            <span className="total-chip-sep">/</span>
                            <span style={{ color: scoreColor(cotTotal) }}>{cotTotal}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {isOpen && (
                    <div className="mobile-detail" onClick={(e) => e.stopPropagation()}>
                      <DetailContent row={row} />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}
      {tab === "graphs" && <GraphsPage />}
      {tab === "data" && <GroundTruthPage />}
      <footer className="footer">
          CXR Benchmark Prototype · Built by {" "}
  <a href="https://github.com/2i03e2f" target="_blank" rel="noreferrer" className="footer-link">
            2i03e2f
  </a>{" "}
      </footer>
    </div>
  );
}
