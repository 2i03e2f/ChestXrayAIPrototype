import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import { createPortal } from "react-dom";
import "./App.css";

/* Tracks which tabs have been viewed in this session - animations only fire on
   the FIRST visit per tab per page load. Refresh resets back to false. */
const SEEN = { dashboard: false, graphs: false, stdCharts: false, cotCharts: false, ssMetrics: false, deltaSection: false };

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

/* ─── In-view hook - uses callback ref so effect re-runs when element attaches ─── */
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
  const sex = Math.random() > 0.5 ? "M" : "F";
  const age = Math.floor(Math.random() * 73) + 18;
  return { id: `CXR_${String(i + 1).padStart(4, "0")}`, ground_truth: gt, models, sex, age };
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

function severityMAE(model, prompt) {
  const total = MOCK_DATA.reduce((s, d) => s + Math.abs(d.models[model][prompt].severity - d.ground_truth.severity), 0);
  return (total / MOCK_DATA.length).toFixed(2);
}

function accuracyBySeverity(model, prompt) {
  const groups = {};
  MOCK_DATA.forEach(d => {
    const sev = d.ground_truth.severity;
    if (!groups[sev]) groups[sev] = { total: 0, correct: 0 };
    groups[sev].total++;
    if (CONDS.every(c => d.models[model][prompt][c] === d.ground_truth[c])) groups[sev].correct++;
  });
  return groups;
}

function accuracyByCooccurrence(model, prompt) {
  const groups = { 0: { total: 0, correct: 0 }, 1: { total: 0, correct: 0 }, 2: { total: 0, correct: 0 }, 3: { total: 0, correct: 0 } };
  MOCK_DATA.forEach(d => {
    const n = CONDS.filter(c => d.ground_truth[c] === "present").length;
    groups[n].total++;
    if (CONDS.every(c => d.models[model][prompt][c] === d.ground_truth[c])) groups[n].correct++;
  });
  return groups;
}

function interModelAgreement(modelA, modelB, prompt) {
  let totalAgree = 0;
  MOCK_DATA.forEach(d => {
    const agree = CONDS.filter(c => d.models[modelA][prompt][c] === d.models[modelB][prompt][c]).length;
    totalAgree += agree / CONDS.length;
  });
  return (totalAgree / MOCK_DATA.length * 100).toFixed(0);
}

function condStats(model, cond, prompt) {
  let TP=0, FP=0, TN=0, FN=0;
  MOCK_DATA.forEach(d => {
    const p = d.models[model][prompt][cond], g = d.ground_truth[cond];
    if (g==="present"&&p==="present") TP++;
    else if (g==="absent"&&p==="present") FP++;
    else if (g==="absent"&&p==="absent") TN++;
    else FN++;
  });
  const sens = TP+FN>0 ? TP/(TP+FN) : 0;
  const spec = TN+FP>0 ? TN/(TN+FP) : 0;
  const ppv  = TP+FP>0 ? TP/(TP+FP) : null;
  const npv  = TN+FN>0 ? TN/(TN+FN) : null;
  const f1   = ppv!==null&&sens>0 ? 2*ppv*sens/(ppv+sens) : null;
  return { TP, FP, TN, FN, sens, spec, ppv, npv, f1 };
}

function cohensKappa(model, prompt) {
  let sum = 0;
  CONDS.forEach(cond => {
    const { TP, FP, TN, FN } = condStats(model, cond, prompt);
    const n = MOCK_DATA.length;
    const po = (TP+TN)/n;
    const pe = ((TP+FN)/n)*((TP+FP)/n) + ((TN+FP)/n)*((TN+FN)/n);
    sum += pe < 1 ? (po-pe)/(1-pe) : 1;
  });
  return (sum/CONDS.length).toFixed(2);
}

function classAccCI(model, prompt) {
  const p = parseFloat(avgClass(model, prompt));
  const n = MOCK_DATA.length;
  const z = 1.96;
  const denom = 1 + z*z/n;
  const center = (p + z*z/(2*n)) / denom;
  const margin = z * Math.sqrt(p*(1-p)/n + z*z/(4*n*n)) / denom;
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin) };
}

function normalCDF(z) {
  const a=[0.254829592,-0.284496736,1.421413741,-1.453152027,1.061405429], p=0.3275911;
  const sign=z<0?-1:1, az=Math.abs(z);
  const t=1/(1+p*az);
  const y=1-(((((a[4]*t+a[3])*t+a[2])*t+a[1])*t+a[0])*t)*Math.exp(-az*az);
  return 0.5*(1+sign*y);
}

function weightedKappaSeverity(model, prompt) {
  const n=MOCK_DATA.length, k=5;
  const cm=Array.from({length:k},()=>Array(k).fill(0));
  MOCK_DATA.forEach(d=>{
    cm[d.models[model][prompt].severity-1][d.ground_truth.severity-1]++;
  });
  const w=(i,j)=>1-Math.abs(i-j)/(k-1);
  let po=0;
  for(let i=0;i<k;i++) for(let j=0;j<k;j++) po+=w(i,j)*cm[i][j]/n;
  const row=cm.map(r=>r.reduce((a,b)=>a+b,0));
  const col=cm[0].map((_,j)=>cm.reduce((s,r)=>s+r[j],0));
  let pe=0;
  for(let i=0;i<k;i++) for(let j=0;j<k;j++) pe+=w(i,j)*(row[i]/n)*(col[j]/n);
  return pe<1?((po-pe)/(1-pe)).toFixed(2):"1.00";
}

function pearsonSeverity(model, prompt) {
  const preds=MOCK_DATA.map(d=>d.models[model][prompt].severity);
  const gts=MOCK_DATA.map(d=>d.ground_truth.severity);
  const n=preds.length;
  const mp=preds.reduce((a,b)=>a+b,0)/n, mg=gts.reduce((a,b)=>a+b,0)/n;
  const num=preds.reduce((s,p,i)=>s+(p-mp)*(gts[i]-mg),0);
  const dp=Math.sqrt(preds.reduce((s,p)=>s+(p-mp)**2,0));
  const dg=Math.sqrt(gts.reduce((s,g)=>s+(g-mg)**2,0));
  return dp*dg>0?(num/(dp*dg)).toFixed(2):"-";
}

function mcnemarTest(modelA, modelB, prompt) {
  let b=0, c=0;
  MOCK_DATA.forEach(d=>{
    const aOk=CONDS.every(cn=>d.models[modelA][prompt][cn]===d.ground_truth[cn]);
    const bOk=CONDS.every(cn=>d.models[modelB][prompt][cn]===d.ground_truth[cn]);
    if(aOk&&!bOk) b++; else if(!aOk&&bOk) c++;
  });
  const nn=b+c;
  if(nn===0) return {chi2:"0.00",p:"1.000",sig:false,b,c};
  const chi2=Math.max(0,(Math.abs(b-c)-1)**2/nn);
  const rawP=2*(1-normalCDF(Math.sqrt(chi2)));
  const p=rawP<0.001?"<0.001":rawP<0.01?"<0.01":rawP<0.05?"<0.05":rawP.toFixed(3);
  return {chi2:chi2.toFixed(2),p,sig:rawP<0.05,b,c};
}

function aucROC(model, cond, prompt) {
  const { sens, spec } = condStats(model, cond, prompt);
  return (sens + spec) / 2;
}

function accuracyBySex(model, prompt) {
  const groups = { M: { total: 0, correct: 0 }, F: { total: 0, correct: 0 } };
  MOCK_DATA.forEach(d => {
    groups[d.sex].total++;
    if (CONDS.every(c => d.models[model][prompt][c] === d.ground_truth[c])) groups[d.sex].correct++;
  });
  return groups;
}

function accuracyByAgeGroup(model, prompt) {
  const groups = { "18–40": { total: 0, correct: 0 }, "41–60": { total: 0, correct: 0 }, "61+": { total: 0, correct: 0 } };
  MOCK_DATA.forEach(d => {
    const key = d.age <= 40 ? "18–40" : d.age <= 60 ? "41–60" : "61+";
    groups[key].total++;
    if (CONDS.every(c => d.models[model][prompt][c] === d.ground_truth[c])) groups[key].correct++;
  });
  return groups;
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

/* ─── Demographics ─── */
const DEMO = (() => {
  const malePct = Math.round(MOCK_DATA.filter(d => d.sex === "M").length / MOCK_DATA.length * 100);
  const ages = MOCK_DATA.map(d => d.age).sort((a, b) => a - b);
  const mid = Math.floor(ages.length / 2);
  const median = ages.length % 2 === 0 ? Math.round((ages[mid - 1] + ages[mid]) / 2) : ages[mid];
  return { malePct, femalePct: 100 - malePct, minAge: ages[0], maxAge: ages[ages.length - 1], median };
})();

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
            <span className="detail-id">{row.id} - detailed scoring</span>
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
                <div className="calc-title">Classification score (per condition)</div>
                <div className="calc-table">
                  <div className="calc-row"><span className="calc-case">Prediction = Ground truth</span><span className="calc-val" style={{ color: "#6ee7b7" }}>1.0</span><span className="calc-note">exact match</span></div>
                  <div className="calc-row"><span className="calc-case">Prediction ≠ Ground truth</span><span className="calc-val" style={{ color: "#f87171" }}>0.0</span><span className="calc-note">wrong</span></div>
                  <div className="calc-row"><span className="calc-case" style={{ fontStyle: "italic", color: "var(--ink-mute)" }}>Binary scoring: correct = 1, wrong = 0. No partial credit. the model must give a decisive answer.</span></div>
                </div>
              </div>
              <div className="calc-section">
                <div className="calc-title">Severity score (weighted)</div>
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
                <div className="calc-title">Total score</div>
                <div className="calc-formula">total = (avg classification + severity) ÷ 2</div>
                <div className="calc-note2">Range: 0.0-1.0 Higher is better</div>
                <div className="calc-note2">classification = (sum of classification scores) ÷ 3</div>
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
            <line x1={ML} y1={py(t)} x2={ML + inW} y2={py(t)} stroke="rgba(255, 255, 255, 0.06)" strokeWidth={1} />
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

/* ─── Per-condition metrics animated block ─── */
function SSCondBlock({ cond, index }) {
  const [ref, inView] = useInView(0.08);
  const [visible, setVisible] = useState(SEEN.ssMetrics);
  useEffect(() => {
    if (inView && !visible) { SEEN.ssMetrics = true; setVisible(true); }
  }, [inView]);
  const sc2 = v => v!==null&&v>=0.7?"var(--ok)":v!==null&&v>=0.5?"var(--warn)":"var(--bad)";
  const fmt = v => v!==null?`${(v*100).toFixed(0)}%`:"-";
  const scLRp = v => v>=10?"var(--ok)":v>=5?"var(--warn)":"var(--bad)";
  const scLRm = v => v<=0.1?"var(--ok)":v<=0.2?"var(--warn)":"var(--bad)";
  const fmtLR = v => v===null?"-":v>99?"≥99":v.toFixed(2);
  return (
    <div
      ref={ref}
      className={`ss-cond-block2 reveal-section${visible ? " visible" : ""}`}
      style={{ "--reveal-delay": `${index * 0.12}s` }}
    >
      <div className="ss-cond-title">{COND_LABELS[cond]}</div>
      <div className="ss-metric-table-wrap">
        <table className="ss-metric-table">
          <thead>
            <tr>
              <th>Model</th><th>Prompt</th>
              <th>Sens</th><th>Spec</th><th>AUC<span className="th-sub">≥0.7</span></th><th>PPV</th><th>NPV</th><th>F1</th>
              <th>LR+<span className="th-sub">≥10 good</span></th>
              <th>LR-<span className="th-sub">≤0.1 good</span></th>
            </tr>
          </thead>
          <tbody>
            {MODELS.flatMap(m => PROMPTS.map(p => {
              const { sens, spec, ppv, npv, f1 } = condStats(m, cond, p);
              const auc = aucROC(m, cond, p);
              const lrp = spec < 1 ? sens / (1 - spec) : null;
              const lrm = spec > 0 ? (1 - sens) / spec : null;
              return (
                <tr key={`${m}-${p}`}>
                  <td className="ss-model-cell"><ModelIcon model={m} size={11}/><span>{m}</span></td>
                  <td><span className="prompt-chip">{PROMPT_SHORT[p]}</span></td>
                  <td style={{color:sc2(sens)}}>{fmt(sens)}</td>
                  <td style={{color:sc2(spec)}}>{fmt(spec)}</td>
                  <td style={{color:sc2(auc)}}>{fmt(auc)}</td>
                  <td style={{color:sc2(ppv)}}>{fmt(ppv)}</td>
                  <td style={{color:sc2(npv)}}>{fmt(npv)}</td>
                  <td style={{color:sc2(f1)}}>{fmt(f1)}</td>
                  <td style={{color:lrp!==null?scLRp(lrp):"var(--ink-mute)"}}>{fmtLR(lrp)}</td>
                  <td style={{color:lrm!==null?scLRm(lrm):"var(--ink-mute)"}}>{fmtLR(lrm)}</td>
                </tr>
              );
            }))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Subgroup: accuracy by ground truth severity ─── */
function SeveritySubgroupSection() {
  const [prompt, setPrompt] = useState("std");
  const sevLevels = [1, 2, 3, 4, 5];
  const sc = v => v >= 0.7 ? "var(--ok)" : v >= 0.5 ? "var(--warn)" : "var(--bad)";
  return (
    <div>
      <div className="section-label">Accuracy by severity level</div>
      <div className="sg-desc">Classification accuracy (all 3 conditions correct) grouped by ground truth severity score. Reveals whether models perform differently on mild vs. severe cases.</div>
      <div className="cm-ctrl-group" style={{ marginBottom: "1rem" }}>
        {PROMPTS.map(p => (
          <button key={p} className={`cm-ctrl-btn${prompt===p?" active":""}`} onClick={() => setPrompt(p)}>
            {PROMPT_LABELS[p]}
          </button>
        ))}
      </div>
      <div className="sg-table-scroll">
        <table className="sg-table">
          <thead>
            <tr>
              <th>Severity</th>
              <th>n</th>
              {MODELS.map(m => <th key={m}><ModelIcon model={m} size={11}/> {m}</th>)}
            </tr>
          </thead>
          <tbody>
            {sevLevels.map(sev => {
              const groupsPerModel = MODELS.map(m => accuracyBySeverity(m, prompt)[sev] || { total: 0, correct: 0 });
              const n = groupsPerModel[0]?.total ?? 0;
              return (
                <tr key={sev}>
                  <td><span className="sev-chip">{sev}/5</span></td>
                  <td className="stat-n">{n}</td>
                  {groupsPerModel.map((g, mi) => {
                    const rate = g.total > 0 ? g.correct / g.total : null;
                    return (
                      <td key={mi} className="stat-n" style={{ color: rate !== null ? sc(rate) : "var(--ink-faint)" }}>
                        {rate !== null ? `${(rate * 100).toFixed(0)}%` : "-"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Subgroup: accuracy by condition co-occurrence ─── */
function CooccurrenceSection() {
  const [prompt, setPrompt] = useState("std");
  const sc = v => v >= 0.7 ? "var(--ok)" : v >= 0.5 ? "var(--warn)" : "var(--bad)";
  const labels = { 0: "No finding", 1: "1 condition", 2: "2 conditions", 3: "All 3" };
  return (
    <div>
      <div className="section-label">Accuracy by condition co-occurrence</div>
      <div className="sg-desc">Classification accuracy grouped by number of conditions present simultaneously. Models typically struggle more when multiple findings co-occur.</div>
      <div className="cm-ctrl-group" style={{ marginBottom: "1rem" }}>
        {PROMPTS.map(p => (
          <button key={p} className={`cm-ctrl-btn${prompt===p?" active":""}`} onClick={() => setPrompt(p)}>
            {PROMPT_LABELS[p]}
          </button>
        ))}
      </div>
      <div className="sg-table-scroll">
        <table className="sg-table">
          <thead>
            <tr>
              <th>Conditions</th>
              <th>n</th>
              {MODELS.map(m => <th key={m}><ModelIcon model={m} size={11}/> {m}</th>)}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3].map(k => {
              const groupsPerModel = MODELS.map(m => accuracyByCooccurrence(m, prompt)[k] || { total: 0, correct: 0 });
              const n = groupsPerModel[0]?.total ?? 0;
              return (
                <tr key={k}>
                  <td>{labels[k]}</td>
                  <td className="stat-n">{n}</td>
                  {groupsPerModel.map((g, mi) => {
                    const rate = g.total > 0 ? g.correct / g.total : null;
                    return (
                      <td key={mi} className="stat-n" style={{ color: rate !== null ? sc(rate) : "var(--ink-faint)" }}>
                        {rate !== null ? `${(rate * 100).toFixed(0)}%` : "-"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Inter-model agreement matrix ─── */
function InterModelAgreementSection() {
  const [prompt, setPrompt] = useState("std");
  const agreeColor = v => {
    const n = parseInt(v);
    if (n >= 80) return "var(--ok)";
    if (n >= 65) return "var(--warn)";
    return "var(--bad)";
  };
  return (
    <div>
      <div className="section-label">Inter-model agreement</div>
      <div className="sg-desc">Percentage of images where both models gave the same answer (regardless of ground truth). High agreement with low accuracy indicates consistent shared errors.</div>
      <div className="cm-ctrl-group" style={{ marginBottom: "1rem" }}>
        {PROMPTS.map(p => (
          <button key={p} className={`cm-ctrl-btn${prompt===p?" active":""}`} onClick={() => setPrompt(p)}>
            {PROMPT_LABELS[p]}
          </button>
        ))}
      </div>
      <div className="sg-table-scroll">
        <table className="sg-table agree-matrix">
          <thead>
            <tr>
              <th></th>
              {MODELS.map(m => <th key={m}>{m}</th>)}
            </tr>
          </thead>
          <tbody>
            {MODELS.map((rowModel, ri) => (
              <tr key={rowModel}>
                <td className="agree-row-label"><ModelIcon model={rowModel} size={11}/> {rowModel}</td>
                {MODELS.map((colModel, ci) => {
                  if (ri === ci) return <td key={colModel} className="agree-diag">-</td>;
                  const pct = interModelAgreement(rowModel, colModel, prompt);
                  return (
                    <td key={colModel} className="stat-n" style={{ color: agreeColor(pct) }}>
                      {pct}%
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="stat-footnote">Agreement = % images where both models predicted the same answer per condition, averaged across PTX · EFF · EDEMA</div>
    </div>
  );
}

/* ─── Statistical comparison (McNemar's test) ─── */
function StatComparisonSection() {
  const [prompt, setPrompt] = useState("std");
  const [infoOpen, setInfoOpen] = useState(false);
  const pairs = [];
  for (let i=0;i<MODELS.length;i++)
    for (let j=i+1;j<MODELS.length;j++)
      pairs.push([MODELS[i], MODELS[j]]);

  useEffect(() => {
    if (infoOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [infoOpen]);

  useEffect(() => {
    if (!infoOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setInfoOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [infoOpen]);

  return (
    <div>
      <div className="section-label">
        Statistical comparison - McNemar's test
        <button className="info-btn" onClick={() => setInfoOpen(true)} title="About McNemar's test">i</button>
      </div>

      {infoOpen && createPortal(
        <div className="info-overlay" onClick={() => setInfoOpen(false)}>
          <div className="info-modal" onClick={e => e.stopPropagation()}>
            <button className="info-modal-close" onClick={() => setInfoOpen(false)}>✕</button>
            <div className="info-modal-title">McNemar's Test</div>

            <div className="info-block">
              <div className="info-block-label">What it measures</div>
              <div className="info-block-body">Compares model A vs B by looking only at cases where<strong style={{color:"var(--ink)"}}> they disagree</strong>. Cases where both are correct or both are wrong add no information.</div>
            </div>

            <div className="info-block">
              <div className="info-block-label">Definition of correct</div>
              <div className="info-block-body">An image is counted correct only if the model predicts <strong style={{color:"var(--ink)"}}>all three conditions (PTX + EFF + EDEMA) correctly</strong>. Missing even one counts as wrong.</div>
            </div>

            <div className="info-block">
              <div className="info-block-label">Variables b and c</div>
              <div className="info-def-row"><span className="info-def-key">b</span><span className="info-def-val">= images where A is correct but B is wrong</span></div>
              <div className="info-def-row"><span className="info-def-key">c</span><span className="info-def-val">= images where A is wrong but B is correct</span></div>
              <div className="info-block-body" style={{marginTop:"0.35rem"}}>a and d are excluded. both models agree on those cases</div>
            </div>

            <div className="info-block">
              <div className="info-block-label">Formula χ² (with continuity correction)</div>
              <div className="info-formula">χ² = (|b - c| - 1)² / (b + c)</div>
              <div className="info-block-body">The continuity correction (-1) reduces type I error when n is small; without it, differences would be overestimated.</div>
            </div>

            <div className="info-block">
              <div className="info-block-label">Interpretation</div>
              <div className="info-def-row"><span className="info-def-key" style={{color:"var(--ok)"}}>sig.</span><span className="info-def-val">p &lt; 0.05 = the pair differs significantly in accuracy</span></div>
              <div className="info-def-row"><span className="info-def-key">n.s.</span><span className="info-def-val">p ≥ 0.05 = insufficient evidence of a difference</span></div>
            </div>

            <div className="info-warn">
              Works best when b + c ≥ 10. If b + c is very small, results may be unreliable.
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="stat-desc">
        H₀: the pair has equal error rates · correct = all three conditions predicted correctly · continuity correction applied
      </div>
      <div className="cm-ctrl-group" style={{ marginBottom: "1rem" }}>
        {PROMPTS.map(p => (
          <button key={p} className={`cm-ctrl-btn${prompt===p?" active":""}`} onClick={()=>setPrompt(p)}>
            {PROMPT_LABELS[p]}
          </button>
        ))}
      </div>
      <div className="stat-table-scroll">
        <table className="stat-table">
          <colgroup>
            <col style={{width:"25%"}}/>
            <col style={{width:"15%"}}/>
            <col style={{width:"15%"}}/>
            <col style={{width:"15%"}}/>
            <col style={{width:"15%"}}/>
            <col style={{width:"15%"}}/>
          </colgroup>
          <thead>
            <tr>
              <th>Comparison</th>
              <th>b<span className="th-sub">A correct, B wrong</span></th>
              <th>c<span className="th-sub">A wrong, B correct</span></th>
              <th>χ²</th>
              <th>p-value</th>
              <th>Sig.</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map(([a, b]) => {
              const r = mcnemarTest(a, b, prompt);
              return (
                <tr key={`${a}-${b}`}>
                  <td className="stat-pair-cell">
                    <div className="stat-model-row"><ModelIcon model={a} size={11}/><span>{a}</span></div>
                    <div className="stat-vs">vs</div>
                    <div className="stat-model-row"><ModelIcon model={b} size={11}/><span>{b}</span></div>
                  </td>
                  <td className="stat-n">{r.b}</td>
                  <td className="stat-n">{r.c}</td>
                  <td className="stat-n">{r.chi2}</td>
                  <td className="stat-n" style={{color:r.sig?"var(--ok)":"var(--ink-mute)"}}>{r.p}</td>
                  <td><span className={`stat-badge ${r.sig?"stat-sig":"stat-ns"}`}>{r.sig?"sig.":"n.s."}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="stat-footnote">McNemar's test with continuity correction · n = {MOCK_DATA.length} images · α = 0.05</div>
    </div>
  );
}

/* ─── Confusion matrix ─── */
function ConfusionMatrixSection({ columns = 2 }) {
  const [prompt, setPrompt] = useState("std");
  const [cond, setCond] = useState("pneumothorax");
  const sc = v => v >= 0.7 ? "var(--ok)" : v >= 0.5 ? "var(--warn)" : "var(--bad)";

  return (
    <div>
      <div className="section-label">Confusion matrix</div>
      <div className="cm-controls">
        <div className="cm-ctrl-group">
          {CONDS.map(c => (
            <button key={c} className={`cm-ctrl-btn${cond === c ? " active" : ""}`} onClick={() => setCond(c)}>
              {COND_LABELS[c]}
            </button>
          ))}
        </div>
        <div className="cm-ctrl-group">
          {PROMPTS.map(p => (
            <button key={p} className={`cm-ctrl-btn${prompt === p ? " active" : ""}`} onClick={() => setPrompt(p)}>
              {PROMPT_LABELS[p]}
            </button>
          ))}
        </div>
      </div>
      <div className={`cm-model-grid${columns === 4 ? " cm-model-grid-4" : ""}`}>
        {MODELS.map(m => {
          const { TP, FP, TN, FN, sens, spec, ppv, npv, f1 } = condStats(m, cond, prompt);
          const maxV = Math.max(TP, FP, TN, FN, 1);
          const acc = ((TP+TN)/MOCK_DATA.length*100).toFixed(0);
          return (
            <div key={m} className="cm-card">
              <div className="cm-card-title">
                <ModelIcon model={m} size={12} />
                <span>{m}</span>
                <span className="cm-prompt-badge">{PROMPT_SHORT[prompt]}</span>
              </div>
              <div className="cm-matrix">
                <div className="cm-corner" />
                <div className="cm-col-head">Actual +</div>
                <div className="cm-col-head">Actual -</div>
                <div className="cm-row-head">Pred +</div>
                <div className="cm-cell cm-tp" style={{ "--i": TP/maxV }}><span className="cm-n">{TP}</span><span className="cm-tag2">TP</span></div>
                <div className="cm-cell cm-fp" style={{ "--i": FP/maxV }}><span className="cm-n">{FP}</span><span className="cm-tag2">FP</span></div>
                <div className="cm-row-head">Pred -</div>
                <div className="cm-cell cm-fn" style={{ "--i": FN/maxV }}><span className="cm-n">{FN}</span><span className="cm-tag2">FN</span></div>
                <div className="cm-cell cm-tn" style={{ "--i": TN/maxV }}><span className="cm-n">{TN}</span><span className="cm-tag2">TN</span></div>
              </div>
              <div className="cm-stats-row">
                <div className="cm-stat"><span className="cm-stat-l">Sens</span><span className="cm-stat-v" style={{color:sc(sens)}}>{(sens*100).toFixed(0)}%</span></div>
                <div className="cm-stat"><span className="cm-stat-l">Spec</span><span className="cm-stat-v" style={{color:sc(spec)}}>{(spec*100).toFixed(0)}%</span></div>
                <div className="cm-stat"><span className="cm-stat-l">PPV</span><span className="cm-stat-v" style={{color:ppv!==null?sc(ppv):"var(--ink-mute)"}}>{ppv!==null?`${(ppv*100).toFixed(0)}%`:"-"}</span></div>
                <div className="cm-stat"><span className="cm-stat-l">NPV</span><span className="cm-stat-v" style={{color:npv!==null?sc(npv):"var(--ink-mute)"}}>{npv!==null?`${(npv*100).toFixed(0)}%`:"-"}</span></div>
                <div className="cm-stat"><span className="cm-stat-l">F1</span><span className="cm-stat-v" style={{color:f1!==null?sc(f1):"var(--ink-mute)"}}>{f1!==null?`${(f1*100).toFixed(0)}%`:"-"}</span></div>
                <div className="cm-stat"><span className="cm-stat-l">FNR</span><span className="cm-stat-v" style={{color:(1-sens)<=0.15?"var(--ok)":(1-sens)<=0.3?"var(--warn)":"var(--bad)"}}>{((1-sens)*100).toFixed(0)}%</span></div>
                <div className="cm-stat"><span className="cm-stat-l">Acc</span><span className="cm-stat-v">{acc}%</span></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── STD vs CoT delta table ─── */
function PromptDeltaSection() {
  const [ref, inView] = useInView(0.05);
  const [visible, setVisible] = useState(SEEN.deltaSection);
  useEffect(() => { if (inView && !visible) { SEEN.deltaSection = true; setVisible(true); } }, [inView]); // eslint-disable-line

  const metrics = [
    { label: "Total score",    fn: avgTotal,             positiveGood: true  },
    { label: "Classification", fn: avgClass,             positiveGood: true  },
    { label: "Sev score",      fn: avgSev,               positiveGood: true  },
    { label: "Cohen's κ",      fn: cohensKappa,          positiveGood: true  },
    { label: "Sev MAE",        fn: severityMAE,          positiveGood: false },
    { label: "Pearson r",      fn: pearsonSeverity,      positiveGood: true  },
  ];
  const fmtDelta = (d, positiveGood) => {
    const sign = d > 0 ? "+" : "";
    const color = Math.abs(d) < 0.001
      ? "var(--ink-mute)"
      : d > 0
        ? (positiveGood ? "var(--ok)"  : "var(--bad)")
        : (positiveGood ? "var(--bad)" : "var(--ok)");
    return { text: `${sign}${d.toFixed(2)}`, color };
  };
  return (
    <div ref={ref} className={`delta-section reveal-section${visible ? " visible" : ""}`}>
      <div className="section-label">Prompt effect - CoT vs Standard (Δ = CoT - STD)</div>
      <div className="sg-desc">Positive Δ = CoT improves · Negative Δ = CoT degrades · Sev MAE: negative Δ = improvement (lower error)</div>
      <div className="sg-table-scroll">
        <table className="sg-table">
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Model</th>
              {metrics.map(m => <th key={m.label}>{m.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {MODELS.map(model => (
              <tr key={model}>
                <td className="ss-model-cell"><ModelIcon model={model} size={11}/><span>{model}</span></td>
                {metrics.map(({ label, fn, positiveGood }) => {
                  const delta = parseFloat(fn(model, "cot")) - parseFloat(fn(model, "std"));
                  const { text, color } = fmtDelta(delta, positiveGood);
                  return <td key={label} className="stat-n" style={{ color }}>{text}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Cross-task comparison: classification vs severity grading ─── */
function CrossTaskSection() {
  const [ref, inView] = useInView(0.05);
  const [visible, setVisible] = useState(SEEN.deltaSection);
  useEffect(() => { if (inView && !visible) { SEEN.deltaSection = true; setVisible(true); } }, [inView]); // eslint-disable-line

  const sc  = v => parseFloat(v) >= 0.7 ? "var(--ok)" : parseFloat(v) >= 0.5 ? "var(--warn)" : "var(--bad)";
  const scM = v => parseFloat(v) <= 0.5 ? "var(--ok)" : parseFloat(v) <= 1   ? "var(--warn)" : "var(--bad)";
  const scR = v => parseFloat(v) >= 0.6 ? "var(--ok)" : parseFloat(v) >= 0.3 ? "var(--warn)" : "var(--bad)";
  return (
    <div ref={ref} className={`cross-task-section reveal-section${visible ? " visible" : ""}`} style={{ "--reveal-delay": "0.08s" }}>
      <div className="section-label">Cross-task performance - Classification vs Severity grading</div>
      <div className="sg-desc">Direct comparison of each model across the two evaluation tasks and both prompt types.</div>
      <div className="sg-table-scroll">
        <table className="sg-table">
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Model</th>
              <th style={{ textAlign: "left" }}>Prompt</th>
              <th>Class avg</th><th>Sev avg</th>
              <th>Cohen's κ</th><th>Weighted κ</th>
              <th>MAE</th><th>Pearson r</th>
            </tr>
          </thead>
          <tbody>
            {MODELS.flatMap(model => PROMPTS.map(prompt => (
              <tr key={`${model}-${prompt}`}>
                <td className="ss-model-cell"><ModelIcon model={model} size={11}/><span>{model}</span></td>
                <td><span className="prompt-chip">{PROMPT_SHORT[prompt]}</span></td>
                <td style={{ color: sc(avgClass(model, prompt)) }}>{avgClass(model, prompt)}</td>
                <td style={{ color: sc(avgSev(model, prompt)) }}>{avgSev(model, prompt)}</td>
                <td style={{ color: sc(cohensKappa(model, prompt)) }}>{cohensKappa(model, prompt)}</td>
                <td style={{ color: sc(weightedKappaSeverity(model, prompt)) }}>{weightedKappaSeverity(model, prompt)}</td>
                <td style={{ color: scM(severityMAE(model, prompt)) }}>{severityMAE(model, prompt)}</td>
                <td style={{ color: scR(pearsonSeverity(model, prompt)) }}>{pearsonSeverity(model, prompt)}</td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Demographic subgroup analysis ─── */
function DemographicSubgroupSection() {
  const [ref, inView] = useInView(0.05);
  const [visible, setVisible] = useState(true);
  useEffect(() => { if (inView && !visible) setVisible(true); }, [inView]); // eslint-disable-line
  const [prompt, setPrompt] = useState("std");
  const sc = v => v >= 0.7 ? "var(--ok)" : v >= 0.5 ? "var(--warn)" : "var(--bad)";
  const sexGroups = ["M", "F"];
  const ageGroups = ["18–40", "41–60", "61+"];
  const rateCell = (g, mi) => {
    const rate = g.total > 0 ? g.correct / g.total : null;
    return (
      <td key={mi} className="stat-n" style={{ color: rate !== null ? sc(rate) : "var(--ink-faint)" }}>
        {rate !== null ? `${(rate * 100).toFixed(0)}%` : "-"}
      </td>
    );
  };
  return (
    <div ref={ref} className={`reveal-section${visible ? " visible" : ""}`}>
      <div className="section-label">Accuracy by demographic subgroup</div>
      <div className="sg-desc">Classification accuracy (all 3 conditions correct) by sex and age group. Detects potential demographic bias.</div>
      <div className="cm-ctrl-group" style={{ marginBottom: "1rem" }}>
        {PROMPTS.map(p => (
          <button key={p} className={`cm-ctrl-btn${prompt===p?" active":""}`} onClick={() => setPrompt(p)}>
            {PROMPT_LABELS[p]}
          </button>
        ))}
      </div>
      <div className="sg-desc" style={{ marginBottom: "0.4rem", fontWeight: 600 }}>By sex</div>
      <div className="sg-table-scroll">
        <table className="sg-table">
          <thead>
            <tr>
              <th>Sex</th><th>n</th>
              {MODELS.map(m => <th key={m}><ModelIcon model={m} size={11}/> {m}</th>)}
            </tr>
          </thead>
          <tbody>
            {sexGroups.map(sex => {
              const gpm = MODELS.map(m => accuracyBySex(m, prompt)[sex] || { total: 0, correct: 0 });
              return (
                <tr key={sex}>
                  <td><span className="prompt-chip">{sex}</span></td>
                  <td className="stat-n">{gpm[0].total}</td>
                  {gpm.map(rateCell)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="sg-desc" style={{ margin: "1rem 0 0.4rem", fontWeight: 600 }}>By age group</div>
      <div className="sg-table-scroll">
        <table className="sg-table">
          <thead>
            <tr>
              <th>Age</th><th>n</th>
              {MODELS.map(m => <th key={m}><ModelIcon model={m} size={11}/> {m}</th>)}
            </tr>
          </thead>
          <tbody>
            {ageGroups.map(ag => {
              const gpm = MODELS.map(m => accuracyByAgeGroup(m, prompt)[ag] || { total: 0, correct: 0 });
              return (
                <tr key={ag}>
                  <td>{ag}</td>
                  <td className="stat-n">{gpm[0].total}</td>
                  {gpm.map(rateCell)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Severity scatter plot: predicted vs actual ─── */
function SeverityScatterSection() {
  const [ref, inView] = useInView(0.05);
  const [visible, setVisible] = useState(true);
  useEffect(() => { if (inView && !visible) setVisible(true); }, [inView]); // eslint-disable-line
  const [prompt, setPrompt] = useState("std");
  const [activeModel, setActiveModel] = useState("GPT-4o");

  const W = 580, H = 210;
  const ML = 82, MR = 82, MT = 26, MB = 50;
  const inW = W - ML - MR, inH = H - MT - MB;
  // Padded range so jittered dots never escape the plot area
  const LO = 0.7, HI = 5.3, RNG = HI - LO;
  const px = v => ML + ((v - LO) / RNG) * inW;
  const py = v => MT + inH - ((v - LO) / RNG) * inH;
  const ticks = [1, 2, 3, 4, 5];

  const points = MOCK_DATA.map((row, i) => ({
    gt:   row.ground_truth.severity,
    pred: row.models[activeModel][prompt].severity,
    jx:   ((i * 17 + 3) % 11 - 5) * 1.1,
    jy:   ((i * 13 + 7) % 11 - 5) * 1.1,
  }));
  const col = MODEL_COLORS[activeModel].dot;

  return (
    <div ref={ref} className={`reveal-section${visible ? " visible" : ""}`} style={{ "--reveal-delay": "0.08s" }}>
      <div className="section-label">Severity: predicted vs actual</div>
      <div className="sg-desc">Each dot = one image. Dashed diagonal = perfect prediction. Spread = error magnitude.</div>
      <div className="cm-ctrl-group" style={{ marginBottom: "0.5rem", flexWrap: "wrap" }}>
        {MODELS.map(m => (
          <button key={m} className={`cm-ctrl-btn${activeModel===m?" active":""}`} onClick={() => setActiveModel(m)}>{m}</button>
        ))}
      </div>
      <div className="cm-ctrl-group" style={{ marginBottom: "1rem", marginLeft: "1.5rem" }}>
        {PROMPTS.map(p => (
          <button key={p} className={`cm-ctrl-btn${prompt===p?" active":""}`} onClick={() => setPrompt(p)}>
            {PROMPT_LABELS[p]}
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="chart-svg">
        <defs>
          <clipPath id="scatter-plot-clip">
            <rect x={ML} y={MT} width={inW} height={inH}/>
          </clipPath>
        </defs>
        {/* Grid + ticks */}
        {ticks.map(t => (
          <g key={t}>
            <line x1={ML} y1={py(t)} x2={ML+inW} y2={py(t)} stroke="rgba(255,255,255,0.05)" strokeWidth={1}/>
            <line x1={px(t)} y1={MT} x2={px(t)} y2={MT+inH} stroke="rgba(255,255,255,0.05)" strokeWidth={1}/>
            <text x={ML-6} y={py(t)+4} textAnchor="end" fontSize={9} fill="var(--ink-mute)">{t}</text>
            <text x={px(t)} y={MT+inH+14} textAnchor="middle" fontSize={9} fill="var(--ink-mute)">{t}</text>
          </g>
        ))}
        {/* Axes */}
        <line x1={ML} y1={MT} x2={ML} y2={MT+inH} stroke="rgba(255,255,255,0.15)" strokeWidth={1}/>
        <line x1={ML} y1={MT+inH} x2={ML+inW} y2={MT+inH} stroke="rgba(255,255,255,0.15)" strokeWidth={1}/>
        {/* Diagonal reference */}
        <line x1={px(1)} y1={py(1)} x2={px(5)} y2={py(5)} stroke="rgba(255,255,255,0.18)" strokeWidth={1} strokeDasharray="4,3"/>
        {/* Clipped data points */}
        <g clipPath="url(#scatter-plot-clip)">
          {points.map((pt, i) => (
            <circle key={i} cx={px(pt.gt)+pt.jx} cy={py(pt.pred)+pt.jy} r={3} fill={col} opacity={0.72}/>
          ))}
        </g>
        {/* r / MAE in right margin */}
        <text x={ML+inW+10} y={MT+22} textAnchor="start" fontSize={10} fontWeight="600" fill={col}>r = {pearsonSeverity(activeModel, prompt)}</text>
        <text x={ML+inW+10} y={MT+38} textAnchor="start" fontSize={9} fill="var(--ink-mute)">MAE = {severityMAE(activeModel, prompt)}</text>
        {/* Axis labels */}
        <text x={ML+inW/2} y={H-6} textAnchor="middle" fontSize={9} fill="var(--ink-mute)">Ground truth severity</text>
        <text x={ML/2} y={MT+inH/2} textAnchor="middle" fontSize={9} fill="var(--ink-mute)" transform={`rotate(-90,${ML/2},${MT+inH/2})`}>Predicted</text>
      </svg>
    </div>
  );
}

/* ─── App ─── */
function GraphsPage() {
  const [stdOpen, setStdOpen] = useState(false);
  const [cotOpen, setCotOpen] = useState(false);
  const [stdEverOpened, setStdEverOpened] = useState(false);
  const [cotEverOpened, setCotEverOpened] = useState(false);
  const [confEverRight, setConfEverRight] = useState(false);
  const nOpen = (stdOpen ? 1 : 0) + (cotOpen ? 1 : 0);
  const doAnimate = useRef(!SEEN.graphs);
  const [barsVisible, setBarsVisible] = useState(SEEN.graphs);
  useEffect(() => {
    if (!doAnimate.current) { setBarsVisible(true); return; }
    SEEN.graphs = true;
    const raf = requestAnimationFrame(() => setBarsVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => { if (nOpen >= 2) setConfEverRight(true); }, [nOpen]);

  const toggleStd = () => setStdOpen(v => { if (!v) setStdEverOpened(true); return !v; });
  const toggleCot = () => setCotOpen(v => { if (!v) setCotEverOpened(true); return !v; });

  /* bar chart constants */
  const BW = 640, BH = 200;
  const BML = 56, BMR = 20, BMT = 16, BMB = 46;
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

  const barChartSvg = (
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
        const ciS = classAccCI(m, "std");
        const ciC = classAccCI(m, "cot");
        return (
          <g key={m}>
            <rect className={`bar-svg-anim${barsVisible ? " bar-visible" : ""}`} style={{ "--bar-delay": `${mi * 0.12}s` }} x={stdX} y={bY(stdV)} width={bw} height={stdV * bInH} fill={MODEL_COLORS[m].dot} opacity={0.85} rx={2} />
            <rect className={`bar-svg-anim${barsVisible ? " bar-visible" : ""}`} style={{ "--bar-delay": `${mi * 0.12 + 0.06}s` }} x={cotX} y={bY(cotV)} width={bw} height={cotV * bInH} fill={MODEL_COLORS[m].dot} opacity={0.35} rx={2} />
            <g className={`bar-label-svg-anim${barsVisible ? " bar-visible" : ""}`} style={{ "--bl-delay": `${mi * 0.12 + 0.82}s` }}>
              {(() => {
                const wx = 3, col = MODEL_COLORS[m].dot;
                const cx1 = stdX+bw/2, cx2 = cotX+bw/2;
                return (
                  <>
                    <line x1={cx1} y1={bY(ciS.high)} x2={cx1} y2={bY(ciS.low)} stroke={col} strokeWidth={1.2} opacity={0.8} />
                    <line x1={cx1-wx} y1={bY(ciS.high)} x2={cx1+wx} y2={bY(ciS.high)} stroke={col} strokeWidth={1.2} opacity={0.8} />
                    <line x1={cx1-wx} y1={bY(ciS.low)} x2={cx1+wx} y2={bY(ciS.low)} stroke={col} strokeWidth={1.2} opacity={0.8} />
                    <line x1={cx2} y1={bY(ciC.high)} x2={cx2} y2={bY(ciC.low)} stroke={col} strokeWidth={1.2} opacity={0.4} />
                    <line x1={cx2-wx} y1={bY(ciC.high)} x2={cx2+wx} y2={bY(ciC.high)} stroke={col} strokeWidth={1.2} opacity={0.4} />
                    <line x1={cx2-wx} y1={bY(ciC.low)} x2={cx2+wx} y2={bY(ciC.low)} stroke={col} strokeWidth={1.2} opacity={0.4} />
                  </>
                );
              })()}
            </g>
            <g className={`bar-label-svg-anim${barsVisible ? " bar-visible" : ""}`} style={{ "--bl-delay": `${mi * 0.12 + 0.45}s` }}>
              <text x={stdX + bw / 2} y={bY(ciS.high) - 7} textAnchor="middle" fontSize={12} fill={MODEL_COLORS[m].dot}><AnimatedNum value={stdV} duration={700} delay={mi * 0.12} run={doAnimate.current} /></text>
              <text x={cotX + bw / 2} y={bY(ciC.high) - 7} textAnchor="middle" fontSize={12} fill={MODEL_COLORS[m].dot} opacity={0.7}><AnimatedNum value={cotV} duration={700} delay={mi * 0.12 + 0.06} run={doAnimate.current} /></text>
            </g>
            <text x={cx} y={BH - BMB + 20} textAnchor="middle" fontSize={13} fill="var(--ink-soft)">{m}</text>
          </g>
        );
      })}
      <rect x={BML} y={BH - 18} width={14} height={9} fill="white" opacity={0.7} rx={1} />
      <text x={BML + 18} y={BH - 9} fontSize={12} fill="var(--ink-mute)">STD</text>
      <rect x={BML + 54} y={BH - 18} width={14} height={9} fill="white" opacity={0.3} rx={1} />
      <text x={BML + 72} y={BH - 9} fontSize={12} fill="var(--ink-mute)">CoT</text>
      <text x={BML + 120} y={BH - 9} fontSize={11} fill="var(--ink-faint)">whiskers = 95% CI</text>
    </svg>
  );

  const lineChartSvg = (prompt) => (
    <svg viewBox={`0 0 ${LW} ${LH}`} width="100%" className="chart-svg">
      {yTicks.map(t => (
        <g key={t}>
          <line x1={LML} y1={lY(t)} x2={LML + lInW} y2={lY(t)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
          <text x={LML - 8} y={lY(t) + 5} textAnchor="end" fontSize={13} fill="var(--ink-mute)">{t.toFixed(1)}</text>
        </g>
      ))}
      <line x1={LML} y1={LMT + lInH} x2={LML + lInW} y2={LMT + lInH} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
      {MODELS.map((m, mi) => (
        <AnimatedPath key={m} d={makePath(m, prompt)} stroke={MODEL_COLORS[m].dot} strokeWidth={1.8} opacity={0.85} delay={mi * 0.15} animate={doAnimate.current} />
      ))}
      {MOCK_DATA.map((_, i) => {
        if (i % 4 !== 0 && i !== MOCK_DATA.length - 1) return null;
        return <text key={i} x={lX(i)} y={LH - LMB + 18} textAnchor="middle" fontSize={12} fill="var(--ink-mute)">{i + 1}</text>;
      })}
      <text x={LML + lInW / 2} y={LH - LMB + 34} textAnchor="middle" fontSize={12} fill="var(--ink-mute)">image #</text>
      {MODELS.map((m, mi) => (
        <g key={m}>
          <line x1={LML + mi * 110} y1={LH - 13} x2={LML + mi * 110 + 20} y2={LH - 13} stroke={MODEL_COLORS[m].dot} strokeWidth={2} />
          <text x={LML + mi * 110 + 24} y={LH - 8} fontSize={12} fill="var(--ink-mute)">{m}</text>
        </g>
      ))}
    </svg>
  );

  return (
    <div className="graphs-page">

      {/* ── Top: 2 columns ── */}
      <div className="graphs-two-col">

        {/* Left: score per image charts */}
        <div className="graphs-col">
          <div className="gg-cell">
            <div className="section-label">Average total score by model</div>
            <div className="graph-card">{barChartSvg}</div>
          </div>

          <div className="gg-cell">
            <div className="section-label">Score per image - Standard</div>
            <div className="graph-card">{lineChartSvg("std")}</div>
            <button className="expand-detail-btn" onClick={toggleStd}>
              <span className="expand-icon" style={{ transform: stdOpen ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
              {stdOpen ? "Hide per-model charts" : "Show per-model charts"}
            </button>
            <div className={`model-charts-collapse${stdOpen ? " open" : ""}`}>
              <div className="model-charts-inner">
                {stdEverOpened && (
                  <div className="model-charts-grid" style={{ marginTop: 8 }}>
                    {MODELS.map(m => <ModelLineChart key={m} model={m} prompt="std" />)}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="gg-cell">
            <div className="section-label">Score per image - Chain of Thought</div>
            <div className="graph-card">{lineChartSvg("cot")}</div>
            <button className="expand-detail-btn" onClick={toggleCot}>
              <span className="expand-icon" style={{ transform: cotOpen ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
              {cotOpen ? "Hide per-model charts" : "Show per-model charts"}
            </button>
            <div className={`model-charts-collapse${cotOpen ? " open" : ""}`}>
              <div className="model-charts-inner">
                {cotEverOpened && (
                  <div className="model-charts-grid" style={{ marginTop: 8 }}>
                    {MODELS.map(m => <ModelLineChart key={m} model={m} prompt="cot" />)}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="gg-cell"><SeverityScatterSection /></div>
          {/* Confusion slides out of left when both charts open */}
          <div className={`gg-col-collapse${nOpen < 2 ? " open" : ""}`}>
            <div className="gg-col-inner">
              <div className="gg-cell"><ConfusionMatrixSection /></div>
            </div>
          </div>
        </div>

        {/* Right: comparison & analysis tables */}
        <div className="graphs-col">
          <div className="gg-cell"><InterModelAgreementSection /></div>
          <div className="gg-cell"><SeveritySubgroupSection /></div>
          <div className="gg-cell"><CooccurrenceSection /></div>
          <div className="gg-cell"><DemographicSubgroupSection /></div>
          <div className="gg-cell"><StatComparisonSection /></div>
          {/* Confusion slides into right when both charts open */}
          <div className={`gg-col-collapse${nOpen >= 2 ? " open" : ""}`}>
            <div className="gg-col-inner">
              {confEverRight && <div className="gg-cell"><ConfusionMatrixSection /></div>}
            </div>
          </div>
        </div>

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

const groundTruthData = () => Object.fromEntries(MOCK_DATA.map(row => [row.id, { ...row.ground_truth, sex: row.sex, age: row.age }]));

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
        <div className="section-label">Ground truth - reference standard</div>
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
              <span className="gt-sev-mini">{row.sex} · {row.age}y</span>
            </div>
          ))}
        </div>

        <div className="data-section">
          <div className="section-label">Standard prompt answers</div>
          <div className="data-table-grid">
            {MODELS.map(model => <ModelAnswerTable key={`std-${model}`} model={model} prompt="std" />)}
          </div>
        </div>

        <div className="data-section">
          <div className="section-label">Chain-of-thought prompt answers</div>
          <div className="data-table-grid">
            {MODELS.map(model => <ModelAnswerTable key={`cot-${model}`} model={model} prompt="cot" />)}
          </div>
        </div>

        {/* Dataset overview */}
        <div className="data-section">
          <div className="section-label">Dataset overview</div>
          <div className="dataset-grid">
            {[
              { label: "Source",       val: "NIH ChestX-ray14",                                          note: "Wang et al., 2017" },
              { label: "Total images", val: `${MOCK_DATA.length} (prototype)`,                          note: "target: 1,000 from 112,120" },
              { label: "Sex",          val: `${DEMO.malePct}% M · ${DEMO.femalePct}% F`,               note: "Male / Female" },
              { label: "Age range",    val: `${DEMO.minAge}–${DEMO.maxAge} yrs`,                       note: `median ${DEMO.median} years` },
            ].map(({ label, val, note }) => (
              <div key={label} className="ds-card">
                <span className="ds-card-label">{label}</span>
                <span className="ds-card-val">{val}</span>
                <span className="ds-card-note">{note}</span>
              </div>
            ))}
          </div>
          <div className="section-sublabel">Models evaluated</div>
          <div className="model-ver-grid">
            {[
              { name: "GPT-4o",  version: "gpt-4o-2024-11-20",        temp: 0 },
              { name: "Claude",  version: "claude-sonnet-4-20250514",  temp: 0 },
              { name: "Gemini",  version: "gemini-1.5-pro-002",        temp: 0 },
              { name: "Grok",    version: "grok-2-vision-1212",        temp: 0 },
            ].map(({ name, version, temp }) => (
              <div key={name} className="model-ver-card">
                <ModelIcon model={name} size={14}/>
                <span className="model-ver-name">{name}</span>
                <span className="model-ver-version">{version}</span>
                <span className="model-ver-temp">temp={temp}</span>
              </div>
            ))}
          </div>
          <div className="section-sublabel">Disease prevalence in sample</div>
          <div className="prev-grid">
            {[
              { cond: "Pneumothorax",    prev: parseFloat((MOCK_DATA.filter(d => d.ground_truth.pneumothorax === "present").length / MOCK_DATA.length * 100).toFixed(1)),    color: "#f87171" },
              { cond: "Pleural Effusion",prev: parseFloat((MOCK_DATA.filter(d => d.ground_truth.pleural_effusion === "present").length / MOCK_DATA.length * 100).toFixed(1)), color: "#fbbf24" },
              { cond: "Pulmonary Edema", prev: parseFloat((MOCK_DATA.filter(d => d.ground_truth.pulmonary_edema === "present").length / MOCK_DATA.length * 100).toFixed(1)),  color: "#60a5fa" },
              { cond: "No finding",      prev: parseFloat((MOCK_DATA.filter(d => CONDS.every(c => d.ground_truth[c] === "absent")).length / MOCK_DATA.length * 100).toFixed(1)), color: "var(--ok)" },
            ].map(({ cond, prev, color }) => (
              <div key={cond} className="prev-row">
                <span className="prev-label">{cond}</span>
                <div className="prev-track">
                  <div className="prev-fill" style={{ width: `${prev}%`, background: color }} />
                </div>
                <span className="prev-val">{prev}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Prompts */}
        <div className="data-section">
          <div className="section-label">Prompts used</div>
          <div className="prompt-display-grid">
            {[
              {
                key: "std", label: "Standard prompt", short: "STD",
                text: `Does this chest X-ray show any of the following findings? For each condition respond with "present" or "absent". Also rate the overall severity from 1 (minimal/incidental) to 5 (critical/life-threatening).

Respond ONLY in this exact JSON format - no explanation, no preamble:
{
  "pneumothorax":     "present" | "absent",
  "pleural_effusion": "present" | "absent",
  "pulmonary_edema":  "present" | "absent",
  "severity": 1-5
}`,
              },
              {
                key: "cot", label: "Chain-of-Thought prompt", short: "CoT",
                text: `Think step by step. Analyze this chest X-ray carefully before giving your final answer.

Step 1 - Image quality & overview: describe the projection, rotation, and overall quality.
Step 2 - Pneumothorax: look for a pleural line, absent lung markings in the periphery, or tracheal deviation.
Step 3 - Pleural effusion: look for blunting of the costophrenic angles, meniscus sign, or hemithorax opacification.
Step 4 - Pulmonary edema: look for increased vascular markings, perihilar haze, Kerley B lines, or bat-wing pattern.
Step 5 - Severity: considering all findings, rate from 1 (minimal/incidental) to 5 (critical/life-threatening).

After your reasoning, provide your final answer ONLY in this JSON format:
{
  "pneumothorax":     "present" | "absent",
  "pleural_effusion": "present" | "absent",
  "pulmonary_edema":  "present" | "absent",
  "severity": 1-5
}`,
              },
            ].map(({ key, label, short, text }) => (
              <div key={key} className="prompt-display-card">
                <div className="prompt-display-header">
                  <span className="prompt-display-label">{label}</span>
                  <span className="prompt-chip">{short}</span>
                </div>
                <pre className="prompt-display-body">{text}</pre>
              </div>
            ))}
          </div>
        </div>

        <div className="ground-json">
          <div className="section-label">JSON data</div>
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
                  <span className="kappa-label">avg sev score</span>
                  <div className="kappa-split">
                    <span className="kappa-val"><AnimatedNum value={parseFloat(avgSev(m, "std"))} run={doAnimateCards.current} /></span>
                    <span className="kappa-sep">|</span>
                    <span className="kappa-val"><AnimatedNum value={parseFloat(avgSev(m, "cot"))} run={doAnimateCards.current} /></span>
                  </div>
                </div>
                {(() => {
                  const ks=cohensKappa(m,"std"), kc=cohensKappa(m,"cot");
                  const wks=weightedKappaSeverity(m,"std"), wkc=weightedKappaSeverity(m,"cot");
                  const rs=pearsonSeverity(m,"std"), rc=pearsonSeverity(m,"cot");
                  const ciS=classAccCI(m,"std"), ciC=classAccCI(m,"cot");
                  const kColor=v=>parseFloat(v)>=0.6?"var(--ok)":parseFloat(v)>=0.4?"var(--warn)":"var(--bad)";
                  const rColor=v=>parseFloat(v)>=0.6?"var(--ok)":parseFloat(v)>=0.3?"var(--warn)":"var(--bad)";
                  return (
                    <>
                      <div className="kappa-row split">
                        <span className="kappa-label">Cohen's κ</span>
                        <div className="kappa-split">
                          <span className="kappa-val" style={{color:kColor(ks)}}>{ks}</span>
                          <span className="kappa-sep">|</span>
                          <span className="kappa-val" style={{color:kColor(kc)}}>{kc}</span>
                        </div>
                      </div>
                      <div className="kappa-row split">
                        <span className="kappa-label">Weighted κ (sev)</span>
                        <div className="kappa-split">
                          <span className="kappa-val" style={{color:kColor(wks)}}>{wks}</span>
                          <span className="kappa-sep">|</span>
                          <span className="kappa-val" style={{color:kColor(wkc)}}>{wkc}</span>
                        </div>
                      </div>
                      <div className="kappa-row split">
                        <span className="kappa-label">Severity MAE</span>
                        <div className="kappa-split">
                          {(() => {
                            const ms=severityMAE(m,"std"), mc=severityMAE(m,"cot");
                            const maeColor=v=>parseFloat(v)<=0.5?"var(--ok)":parseFloat(v)<=1?"var(--warn)":"var(--bad)";
                            return (
                              <>
                                <span className="kappa-val" style={{color:maeColor(ms)}}>{ms}</span>
                                <span className="kappa-sep">|</span>
                                <span className="kappa-val" style={{color:maeColor(mc)}}>{mc}</span>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="kappa-row split">
                        <span className="kappa-label">Pearson r (sev)</span>
                        <div className="kappa-split">
                          <span className="kappa-val" style={{color:rColor(rs)}}>{rs}</span>
                          <span className="kappa-sep">|</span>
                          <span className="kappa-val" style={{color:rColor(rc)}}>{rc}</span>
                        </div>
                      </div>
                      <div className="kappa-row split">
                        <span className="kappa-label">95% CI</span>
                        <div className="kappa-split">
                          <span className="kappa-val kappa-ci">{ciS.low.toFixed(2)}-{ciS.high.toFixed(2)}</span>
                          <span className="kappa-sep">|</span>
                          <span className="kappa-val kappa-ci">{ciC.low.toFixed(2)}-{ciC.high.toFixed(2)}</span>
                        </div>
                      </div>
                    </>
                  );
                })()}
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

          <div className="delta-crosstask-row">
            <PromptDeltaSection />
            <CrossTaskSection />
          </div>

          {/* Per-condition: split STD vs CoT side by side */}
          <div ref={condRef} className={`cond-section${condVisible ? " cond-visible" : ""}`}>
            <div className="section-label">Per-condition accuracy (%)</div>
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

          {/* Per-condition metrics table */}
          <div className="ss-section">
            <div className="section-label">Per-condition metrics - Sens / Spec / PPV / NPV / F1 / LR</div>
            <div className="ss-cond-tabs-grid">
              {CONDS.map((cond, i) => (
                <SSCondBlock key={cond} cond={cond} index={i} />
              ))}
            </div>
          </div>

          {/* JSON section */}
          <div ref={jsonRef} className={`dash-json-section reveal-section${jsonVisible ? " visible" : ""}`} style={{ marginTop: "1.75rem" }}>
            <div className="section-label">Data structure examples</div>
            <JsonFileBlock
              filename="ground_truth.json"
              desc="Reference answers used as the evaluation standard"
              code={`{
  "CXR_0001": { // image ID
    "pneumothorax":     "present",  // present | absent
    "pleural_effusion": "absent",
    "pulmonary_edema":  "absent",
    "severity": 3,                  // 1-5
    "sex": "M",                     // M | F
    "age": 54                       // years
  },
  "CXR_0002": {
    "pneumothorax":     "absent",
    "pleural_effusion": "present",
    "pulmonary_edema":  "absent",
    "severity": 2,
    "sex": "F",
    "age": 37
  }
  // ... 1,000 images
}`}
            />
            <JsonFileBlock
              filename="raw_responses.json"
              desc="Raw model answers grouped by prompt type (std / cot)"
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
              desc="Computed scores"
              code={`{
  "CXR_0001": {
    "GPT-4o": {
      "std": {
        "pneumothorax":     1.0,  // correct → 1
        "pleural_effusion": 1.0,
        "pulmonary_edema":  0.0,  // wrong → 0
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
              desc="Experiment metadata and run configuration"
              code={`{
  "experiment_date": "2025-05-22",  // experiment date
  "dataset": "NIH ChestX-ray14",    // dataset used
  "total_images": 1000,             // total image count
  "runs_per_image": 5,              // inference runs per image
  "models": {                       // model details
    "GPT-4o":  { "version": "gpt-4o-2024-11-20",        "temp": 0 },
    "Claude":  { "version": "claude-sonnet-4-20250514",  "temp": 0 },
    "Gemini":  { "version": "gemini-1.5-pro-002",        "temp": 0 },
    "Grok":    { "version": "grok-2-vision-1212",        "temp": 0 }
  },
  "prompts": {
    "std": "Does this chest X-ray show the following...",        // standard prompt
    "cot": "Think step by step. First describe what you see..."  // chain-of-thought prompt
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
            <span className="filter-note">[ "all correct" = every model scored 1 on all conditions ]</span>
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
                  <Fragment key={row.id}>
                    <tr
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
                    {selected === row.id && <DetailPanel row={row} />}
                  </Fragment>
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
        CXR Benchmark Prototype · Built by{" "}
        <a href="https://github.com/2i03e2f" target="_blank" rel="noreferrer" className="footer-link">
          2i03e2f
        </a>
      </footer>
    </div>
  );
}
