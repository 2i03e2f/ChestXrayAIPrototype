import { useState } from "react";
import "./App.css";

function highlightJson(code) {
  const tokens = [];
  let i = 0;
  while (i < code.length) {
    // Comments (// ...)
    if (code[i] === "/" && code[i + 1] === "/") {
      const end = code.indexOf("\n", i);
      const endIdx = end === -1 ? code.length : end;
      tokens.push({ type: "comment", text: code.slice(i, endIdx) });
      i = endIdx;
      continue;
    }
    // Strings
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
    // Numbers
    if (/[0-9]/.test(code[i]) && (i === 0 || !/[a-zA-Z_]/.test(code[i - 1]))) {
      let j = i;
      while (j < code.length && /[0-9.]/.test(code[j])) j++;
      tokens.push({ type: "number", text: code.slice(i, j) });
      i = j;
      continue;
    }
    // Booleans / null
    const bMatch = code.slice(i).match(/^(true|false|null)\b/);
    if (bMatch) {
      tokens.push({ type: "boolean", text: bMatch[0] });
      i += bMatch[0].length;
      continue;
    }
    // Punctuation
    if (/[{}\[\],:]/.test(code[i])) {
      tokens.push({ type: "punct", text: code[i] });
      i++;
      continue;
    }
    // Plain
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

const MODELS = ["GPT-4o", "Claude", "Gemini", "Grok"];
const CONDS = ["pneumothorax", "pleural_effusion", "pulmonary_edema"];
const COND_LABELS = { pneumothorax: "Pneumothorax", pleural_effusion: "Pleural Effusion", pulmonary_edema: "Pulmonary Edema" };

const MODEL_COLORS = {
  "GPT-4o": { dot: "#10a37f" },
  "Claude":  { dot: "#d97706" },
  "Gemini":  { dot: "#4285f4" },
  "Grok":    { dot: "#8b5cf6" },
};

function classScore(pred, gt) {
  if (pred === gt) return 1;
  if (pred === "uncertain") return 0.5;
  return 0;
}
function sevScore(pred, gt) {
  const diff = Math.abs(pred - gt);
  return parseFloat((1 - diff / 4).toFixed(2));
}
function totalScore(mo, gt) {
  const cs = CONDS.map(c => classScore(mo[c], gt[c]));
  const ss = sevScore(mo.severity, gt.severity);
  const classAvg = cs.reduce((a, b) => a + b, 0) / cs.length;
  return parseFloat(((classAvg + ss) / 2).toFixed(2));
}

const MOCK_DATA = Array.from({ length: 20 }, (_, i) => {
  const gt = {
    pneumothorax: Math.random() > 0.5 ? "present" : "absent",
    pleural_effusion: Math.random() > 0.6 ? "present" : "absent",
    pulmonary_edema: Math.random() > 0.7 ? "present" : "absent",
    severity: Math.floor(Math.random() * 5) + 1,
  };
  const models = {};
  MODELS.forEach(m => {
    const flip = (v) => {
      const r = Math.random();
      if (r > 0.75) return v;
      if (r > 0.5) return v;
      if (r > 0.25) return "uncertain";
      return v === "present" ? "absent" : "present";
    };
    models[m] = {
      pneumothorax: flip(gt.pneumothorax),
      pleural_effusion: flip(gt.pleural_effusion),
      pulmonary_edema: flip(gt.pulmonary_edema),
      severity: Math.max(1, Math.min(5, gt.severity + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 2))),
      prompt: Math.random() > 0.5 ? "standard" : "cot",
    };
  });
  return { id: `CXR_${String(i + 1).padStart(4, "0")}`, ground_truth: gt, models };
});

function calcAccuracy(model) {
  let score = 0;
  MOCK_DATA.forEach(d => score += totalScore(d.models[model], d.ground_truth));
  return (score / MOCK_DATA.length).toFixed(2);
}

const ACCURACY = Object.fromEntries(MODELS.map(m => [m, calcAccuracy(m)]));
const BEST = MODELS.reduce((a, b) => parseFloat(ACCURACY[a]) > parseFloat(ACCURACY[b]) ? a : b);

const scoreColor = (v) => v === 1 ? "#6ee7b7" : v === 0.5 ? "#fbbf24" : v >= 0.75 ? "#a3e0c8" : v >= 0.5 ? "#fde68a" : "#f87171";

const pill = (val) => {
  if (val === "present") return <span className="pill-present">Present</span>;
  if (val === "absent")  return <span className="pill-absent">Absent</span>;
  return <span className="pill-uncertain">Uncertain</span>;
};

function DetailPanel({ row }) {
  const [detailTab, setDetailTab] = useState("breakdown");
  const gt = row.ground_truth;

  return (
    <tr>
      <td colSpan={MODELS.length + 2} className="detail-td">
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
              {MODELS.map(m => {
                const mo = row.models[m];
                const classScores = CONDS.map(c => ({ cond: c, score: classScore(mo[c], gt[c]), pred: mo[c] }));
                const ss = sevScore(mo.severity, gt.severity);
                const total = totalScore(mo, gt);
                return (
                  <div key={m} className="break-card">
                    <div className="break-top">
                      <span className="model-dot" style={{ background: MODEL_COLORS[m].dot }} />
                      <span className="break-name">{m}</span>
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
                        <span className="sev-chip">{mo.severity}/5 <span style={{ color: "#8d8d8d" }}>vs</span> {gt.severity}/5</span>
                      </span>
                      <span className="break-score" style={{ color: scoreColor(ss) }}>{ss}</span>
                    </div>
                    <div className="break-row" style={{ marginTop: 6, paddingTop: 6, borderTop: "0.5px solid #2a2a2e" }}>
                      <span className="break-cond" style={{ color: "#888" }}>Total</span>
                      <span />
                      <span className="break-score" style={{ color: scoreColor(total), fontWeight: 600, fontSize: 14 }}>{total}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {detailTab === "calculation" && (
            <div className="calc-wrap">
              <div className="calc-section">
                <div className="calc-title">Classification score (per condition) ตารางคะแนน</div>
                <div className="calc-table">
                  <div className="calc-row"><span className="calc-case">Prediction = Ground truth</span><span className="calc-val" style={{ color: "#6ee7b7" }}>1.0</span><span className="calc-note">exact match</span></div>
                  <div className="calc-row"><span className="calc-case">Prediction = Uncertain</span><span className="calc-val" style={{ color: "#fbbf24" }}>0.5</span><span className="calc-note">partial credit</span></div>
                  <div className="calc-row"><span className="calc-case">Prediction ≠ Ground truth</span><span className="calc-val" style={{ color: "#f87171" }}>0.0</span><span className="calc-note">wrong</span></div>
                </div>
              </div>
              <div className="calc-section">
                <div className="calc-title">Severity score (weighted) สูตรระดับความรุนแรง</div>
                <div className="calc-formula">score = 1 - |pred - gt| ÷ 4</div>
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
              </div>
              <div className="calc-section">
                <div className="calc-title">This image - scores per model เลขผลลัพธ์ที่ได้สุทธิ เต็ม1</div>
                {MODELS.map(m => {
                  const mo = row.models[m];
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
      </td>
    </tr>
  );
}

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all" ? MOCK_DATA : MOCK_DATA.filter(d => {
    const hasError = MODELS.some(m => totalScore(d.models[m], d.ground_truth) < 1);
    return filter === "wrong" ? hasError : !hasError;
  });

  return (
    <div className="app">
      <div className="header">
        <div>
          <div className="header-title">CXR Benchmark</div>
          <div className="header-sub">Chest X-ray · {MOCK_DATA.length} images · 4 models · 3 conditions</div>
        </div>
        <div className="tabs">
          {[["dashboard","Dashboard"],["table","Image table"]].map(([t,l]) => (
            <button key={t} onClick={() => setTab(t)} className={`tab-btn${tab === t ? " active" : ""}`}>{l}</button>
          ))}
        </div>
      </div>

      {tab === "dashboard" && (
        <div className="dash-wrap">
          <div className="score-grid">
            {MODELS.map(m => (
              <div key={m} className="score-card">
                <div className="score-top">
                  <span className="model-dot" style={{ background: MODEL_COLORS[m].dot }} />
                  <span className="model-name">{m}</span>
                  {m === BEST && <span className="winner-badge">best</span>}
                </div>
                <div className="score-num">{ACCURACY[m]}<span className="score-pct">/1.0</span></div>
                <div className="score-label">avg total score</div>
                <div className="kappa-row">
                  <span className="kappa-label">classification</span>
                  <span className="kappa-val">{(MOCK_DATA.reduce((a,d)=>{
                    const cs = CONDS.map(c=>classScore(d.models[m][c],d.ground_truth[c]));
                    return a + cs.reduce((x,y)=>x+y,0)/3;
                  },0)/MOCK_DATA.length).toFixed(2)}</span>
                </div>
                <div className="kappa-row">
                  <span className="kappa-label">severity kappa</span>
                  <span className="kappa-val">{(MOCK_DATA.reduce((a,d)=>a+sevScore(d.models[m].severity,d.ground_truth.severity),0)/MOCK_DATA.length).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="section-label">Per-condition accuracy</div>
          <div className="cond-grid">
            {CONDS.map(cond => (
              <div key={cond} className="cond-card">
                <div className="cond-title">{COND_LABELS[cond]}</div>
                {MODELS.map(m => {
                  const acc = MOCK_DATA.filter(d => d.models[m][cond] === d.ground_truth[cond]).length / MOCK_DATA.length * 100;
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

          <div style={{ marginTop: "1.75rem" }}>
            <div className="section-label">Data structure - ตัวอย่างการเก็บข้อมูล</div>
            <JsonFileBlock
              filename="ground_truth.json"
              desc="เซตของคำตอบที่ถูกต้อง มาตรฐานที่ใช้วัดผล"
              code={`{
  "CXR_0001": {
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
              desc="สิ่งที่ AI แต่ละตัวตอบมา raw เก็บแยกเพื่อคำนวณใหม่ได้ทีหลังโดยไม่ต้องรัน API ซ้ำ"
              code={`{
  "CXR_0001": {
    "GPT-4o": {
      "pneumothorax":     "present",
      "pleural_effusion": "absent",
      "pulmonary_edema":  "uncertain",  // uncertain = partial credit
      "severity": 2,
      "prompt": "cot"                   // standard | cot
    },
    "Claude": {
      "pneumothorax":     "present",
      "pleural_effusion": "absent",
      "pulmonary_edema":  "absent",
      "severity": 3,
      "prompt": "standard"
    }
    // ... Gemini, Grok
  }
}`}
            />
            <JsonFileBlock
              filename="scores.json"
              desc="คะแนนที่คำนวณได้ ถ้าเปลี่ยนสูตรแค่ recalculate ไฟล์นี้ใหม่ ไม่ต้องแตะไฟล์อื่น"
              code={`{
  "CXR_0001": {
    "GPT-4o": {
      "pneumothorax":     1.0,   // ถูก
      "pleural_effusion": 1.0,   // ถูก
      "pulmonary_edema":  0.5,   // uncertain → partial
      "severity":         0.75,  // 1 - |2-3| / 4
      "total":            0.81   // (avg_class + severity) / 2
    },
    "Claude": {
      "pneumothorax":     1.0,
      "pleural_effusion": 1.0,
      "pulmonary_edema":  1.0,
      "severity":         1.0,
      "total":            1.0
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
    "GPT-4o":  { "version": "gpt-4o-2024-11-20",          "temp": 0 },
    "Claude":  { "version": "claude-sonnet-4-20250514",    "temp": 0 },
    "Gemini":  { "version": "gemini-1.5-pro-002",          "temp": 0 },
    "Grok":    { "version": "grok-2-vision-1212",          "temp": 0 }
  },
  "prompts": {
    "standard": "Does this chest X-ray show the following...",
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
                        <div className="gt-cell">
                          {pill(row.ground_truth.pneumothorax)}
                          <span className="gt-sev">sev {row.ground_truth.severity}/5</span>
                        </div>
                      </td>
                      {MODELS.map(m => {
                        const total = totalScore(row.models[m], row.ground_truth);
                        return (
                          <td key={m} style={{ background: total === 1 ? "rgba(16,163,127,0.04)" : total >= 0.7 ? "rgba(251,191,36,0.04)" : "rgba(220,38,38,0.04)" }}>
                            <div className="model-cell">
                              {pill(row.models[m].pneumothorax)}
                              <span className="total-chip" style={{ color: scoreColor(total) }}>{total}</span>
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
        </div>
      )}
    </div>
  );
}
