import { useState } from "react";
import "./App.css";

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
          <span className="model-dot" style={{ background: MODEL_COLORS[model].dot }} />
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
            <span className="detail-id">{row.id} - detailed scoring รายละเอียดการนับสกอ</span>
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
                  <div className="calc-row"><span className="calc-case" style={{ fontStyle: "italic", color: "var(--ink-mute)" }}>ใช้ระบบ binary: ตอบถูก=1 ตอบผิด=0 ไม่มีคะแนนกลาง เพราะต้องการคำตอบตัดสินใจชัดเจน</span></div>
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
                      <span className="model-dot" style={{ background: MODEL_COLORS[m].dot }} />
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

/* ─── App ─── */
function GraphsPage() {
  return (
    <div className="page-wrap graphs-wrap">
      <div className="section-label">Graphs</div>
      <div className="graph-placeholder">
        <div className="graph-axis">
          {MODELS.map(m => (
            <div key={m} className="graph-stub-row">
              <span className="model-dot" style={{ background: MODEL_COLORS[m].dot }} />
              <span>{m}</span>
              <div className="graph-stub-track">
                <div className="graph-stub-fill" style={{ width: `${parseFloat(ACCURACY[m].std) * 100}%`, background: MODEL_COLORS[m].dot }} />
              </div>
              <span className="bar-val">{ACCURACY[m].std}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ModelAnswerTable({ model, prompt }) {
  return (
    <section className="data-table-card">
      <div className="data-table-title">
        <span className="model-dot" style={{ background: MODEL_COLORS[model].dot }} />
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

function GroundTruthPage() {
  const groundTruthJson = JSON.stringify(groundTruthData(), null, 2);
  const rawResponsesJson = JSON.stringify(rawResponsesData(), null, 2);
  const scoresJson = JSON.stringify(scoresData(), null, 2);

  return (
    <div className="page-wrap ground-wrap">
      <div className="section-label">Ground truth</div>
      <section className="data-table-card data-table-card-full">
        <div className="data-table-title">Ground truth labels</div>
        <div className="ground-table-scroll">
          <table className="ground-table data-table">
            <thead>
              <tr>
                <th>Image</th>
                {CONDS.map(cond => <th key={cond}>{COND_LABELS[cond]}</th>)}
                <th>Severity</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_DATA.map(row => (
                <tr key={`ground-${row.id}`}>
                  <td><span className="img-id">{row.id}</span></td>
                  {CONDS.map(cond => (
                    <td key={cond}>{pill(row.ground_truth[cond])}</td>
                  ))}
                  <td><span className="gt-sev">sev {row.ground_truth.severity}/5</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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

      <div className="ground-json">
        <div className="section-label">JSON data</div>
        <JsonFileBlock
          filename="ground_truth.json"
          desc="Ground truth data used by the image table"
          code={groundTruthJson}
        />
        <JsonFileBlock
          filename="raw_responses.json"
          desc="All model responses grouped by image, model, and prompt"
          code={rawResponsesJson}
        />
        <JsonFileBlock
          filename="scores.json"
          desc="Per-condition, severity, and total scores calculated from the image table data"
          code={scoresJson}
        />
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState(tabFromHash);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");

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
            {MODELS.map(m => (
              <div key={m} className="score-card">
                <div className="score-top">
                  <span className="model-dot" style={{ background: MODEL_COLORS[m].dot }} />
                  <span className="model-name">{m}</span>
                  {m === BEST && <span className="winner-badge">best</span>}
                </div>

                <div className="score-split">
                  {PROMPTS.map(p => (
                    <div key={p} className="score-half">
                      <div className="score-half-label">{PROMPT_SHORT[p]}</div>
                      <div className="score-num">{ACCURACY[m][p]}<span className="score-pct">/1.0</span></div>
                    </div>
                  ))}
                </div>
                <div className="score-label">avg total score</div>

                <div className="kappa-row split">
                  <span className="kappa-label">classification</span>
                  <div className="kappa-split">
                    <span className="kappa-val">{avgClass(m, "std")}</span>
                    <span className="kappa-sep">|</span>
                    <span className="kappa-val">{avgClass(m, "cot")}</span>
                  </div>
                </div>
                <div className="kappa-row split">
                  <span className="kappa-label">severity kappa</span>
                  <div className="kappa-split">
                    <span className="kappa-val">{avgSev(m, "std")}</span>
                    <span className="kappa-sep">|</span>
                    <span className="kappa-val">{avgSev(m, "cot")}</span>
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
          <div className="section-label">Per-condition accuracy</div>
          <div className="cond-grid">
            {CONDS.map(cond => (
              <div key={cond} className="cond-card">
                <div className="cond-title">{COND_LABELS[cond]}</div>
                <div className="cond-split">
                  {PROMPTS.map(p => (
                    <div key={p} className="cond-half">
                      <div className="cond-half-label">{PROMPT_SHORT[p]}</div>
                      {MODELS.map(m => {
                        const acc = condAcc(m, cond, p);
                        return (
                          <div key={m} className="bar-row">
                            <span className="bar-label">{m}</span>
                            <div className="bar-track">
                              <div className="bar-fill" style={{ width: `${acc}%`, background: MODEL_COLORS[m].dot }} />
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

          {/* JSON section */}
          <div style={{ marginTop: "1.75rem" }}>
            <div className="section-label">Data structure Examples - ตัวอย่างการเก็บข้อมูล</div>
            <JsonFileBlock
              filename="ground_truth.json"
              desc="เซตของคำตอบที่ถูกต้อง มาตรฐานที่ใช้วัดผล"
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
              desc="คะแนนที่คำนวณได้ ถ้าเปลี่ยนสูตรแค่ recalculate ไฟล์นี้ใหม่"
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
              desc="ข้อมูลการทดลอง version ของแต่ละ model และ config ที่ใช้รัน"
              code={`{
  "experiment_date": "2025-05-22",
  "dataset": "NIH ChestX-ray14",
  "total_images": 1000,
  "runs_per_image": 5,
  "models": {
    "GPT-4o":  { "version": "gpt-4o-2024-11-20",        "temp": 0 },
    "Claude":  { "version": "claude-sonnet-4-20250514",  "temp": 0 },
    "Gemini":  { "version": "gemini-1.5-pro-002",        "temp": 0 },
    "Grok":    { "version": "grok-2-vision-1212",        "temp": 0 }
  },
  "prompts": {
    "std": "Does this chest X-ray show the following...",
    "cot": "Think step by step. First describe what you see..."
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
                              {pill(row.models[m].std.pneumothorax)}
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
                            <span className="model-dot" style={{ background: MODEL_COLORS[m].dot }} />
                            {m}
                          </span>
                          {pill(row.models[m].std.pneumothorax)}
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
