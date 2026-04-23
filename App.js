import { useState, useRef, useCallback, useEffect } from "react";
import * as Papa from "papaparse";

const API = "https://api.anthropic.com/v1/messages";

const C = {
  bg: "#07090f",
  panel: "#0c1018",
  panelAlt: "#101520",
  border: "#1c2a3d",
  accent: "#00c8ff",
  accent2: "#ff6b35",
  success: "#00e87a",
  text: "#d8e8f5",
  muted: "#4a6278",
};

async function claude(messages, system) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system,
      messages,
    }),
  });
  const d = await res.json();
  if (d.error) throw new Error(d.error.message);
  return d.content[0].text;
}

function getDataCtx(parsed) {
  const sample = parsed.data.slice(0, 30);
  return `Columns: ${parsed.meta.fields?.join(", ")}\nTotal rows: ${parsed.data.length}\nSample (first 30 rows):\n${JSON.stringify(sample, null, 2)}`;
}

function StatCard({ label, value }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "6px 16px",
        border: `1px solid ${hov ? C.accent : C.border}`,
        borderRadius: 4,
        textAlign: "center",
        transition: "border-color 0.2s, box-shadow 0.2s",
        boxShadow: hov ? `0 0 12px ${C.accent}22` : "none",
        cursor: "default",
        minWidth: 70,
      }}
    >
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 17, fontWeight: 700, color: C.accent }}>{value}</div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted, marginTop: 1 }}>{label}</div>
    </div>
  );
}

export default function DataMind() {
  const [parsed, setParsed] = useState(null);
  const [fileName, setFileName] = useState("");
  const [insights, setInsights] = useState("");
  const [insightLoading, setInsightLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [colFilter, setColFilter] = useState("");
  const fileRef = useRef(null);
  const chatEnd = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

  const loadFile = useCallback((file) => {
    if (!file || !file.name.endsWith(".csv")) return;
    setFileName(file.name);
    setMessages([]);
    setInsights("");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        setParsed(result);
        genInsights(result);
      },
    });
  }, []);

  const genInsights = async (result) => {
    setInsightLoading(true);
    try {
      const ctx = getDataCtx(result);
      const txt = await claude(
        [{ role: "user", content: "Analyze this dataset. Give me 5 sharp, specific insights as bullet points using the • symbol. Focus on distributions, outliers, correlations, and actionable findings." }],
        `You are an expert data analyst. Dataset:\n${ctx}\n\nBe specific, concise, and data-driven. Use • for each bullet point. No fluff.`
      );
      setInsights(txt);
    } catch (e) {
      setInsights("⚠ " + e.message);
    }
    setInsightLoading(false);
  };

  const sendChat = async () => {
    if (!input.trim() || !parsed || chatLoading) return;
    const userMsg = { role: "user", content: input.trim() };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");
    setChatLoading(true);
    try {
      const ctx = getDataCtx(parsed);
      const reply = await claude(
        newMsgs,
        `You are a senior data analyst. Dataset:\n${ctx}\n\nAnswer questions precisely. Compute stats from the provided data when asked. Be concise and clear.`
      );
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", content: "⚠ " + e.message }]);
    }
    setChatLoading(false);
    inputRef.current?.focus();
  };

  const clearData = () => {
    setParsed(null);
    setFileName("");
    setInsights("");
    setMessages([]);
    setColFilter("");
  };

  const fields = parsed?.meta?.fields || [];
  const filteredFields = fields.filter((f) => f.toLowerCase().includes(colFilter.toLowerCase()));
  const rows = parsed?.data || [];

  return (
    <div style={{ height: "100vh", background: C.bg, color: C.text, fontFamily: "'Syne', sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: ${C.panel}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
        ::placeholder { color: ${C.muted}; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes pulse { 0%,100%{box-shadow:0 0 0 0 ${C.accent}44} 50%{box-shadow:0 0 0 6px transparent} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .msg-in { animation: fadeUp 0.2s ease; }
        .row-even { background: ${C.bg}; }
        .row-odd  { background: ${C.panel}; }
        .row-even:hover, .row-odd:hover { background: ${C.panelAlt}; }
        .drop-zone { transition: border-color 0.2s, background 0.2s; }
        .drop-zone:hover { border-color: ${C.accent} !important; background: ${C.accent}08 !important; }
        .send-btn { transition: background 0.15s, color 0.15s; }
        .send-btn:hover:not(:disabled) { background: ${C.accent} !important; color: #000 !important; }
        .send-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .clear-btn:hover { border-color: ${C.accent2} !important; color: ${C.accent2} !important; }
        .regen-btn:hover { border-color: ${C.accent} !important; color: ${C.accent} !important; background: ${C.accent}12 !important; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C.border}`, background: C.panel, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.accent, animation: "pulse 2s infinite" }} />
          <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: "0.08em" }}>DATAMIND</span>
          <span style={{ color: C.muted, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em", paddingTop: 1 }}>AI · ANALYTICS</span>
        </div>
        {parsed && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
            <StatCard label="Rows" value={rows.length.toLocaleString()} />
            <StatCard label="Cols" value={fields.length} />
            <StatCard label="Cells" value={(rows.length * fields.length > 999 ? ((rows.length * fields.length) / 1000).toFixed(1) + "k" : rows.length * fields.length)} />
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── LEFT: Upload / Table ── */}
        <div style={{ width: "55%", borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {!parsed ? (
            /* Drop Zone */
            <div
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); loadFile(e.dataTransfer.files[0]); }}
            >
              <div
                className="drop-zone"
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragging ? C.accent : C.border}`,
                  borderRadius: 10,
                  padding: "64px 88px",
                  textAlign: "center",
                  cursor: "pointer",
                  background: dragging ? `${C.accent}08` : "transparent",
                  maxWidth: 420,
                }}
              >
                <div style={{ fontSize: 38, marginBottom: 14, opacity: 0.6 }}>⬆</div>
                <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>Drop a CSV file</div>
                <div style={{ color: C.muted, fontSize: 13 }}>or click to browse — any size, any columns</div>
                <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => loadFile(e.target.files[0])} />
              </div>
            </div>
          ) : (
            /* Data Table */
            <>
              <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10, background: C.panelAlt, flexShrink: 0 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted }}>
                  {fileName}
                </span>
                <input
                  value={colFilter}
                  onChange={(e) => setColFilter(e.target.value)}
                  placeholder="filter columns…"
                  style={{ marginLeft: "auto", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, padding: "4px 10px", color: C.text, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", width: 140, outline: "none" }}
                />
                <button className="clear-btn" onClick={clearData} style={{ background: "none", border: `1px solid ${C.border}`, color: C.muted, cursor: "pointer", padding: "4px 10px", borderRadius: 4, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", transition: "all 0.15s" }}>
                  ✕ Clear
                </button>
              </div>
              <div style={{ flex: 1, overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: "8px 10px", background: C.panelAlt, color: C.muted, fontWeight: 500, textAlign: "left", position: "sticky", top: 0, borderBottom: `1px solid ${C.border}`, minWidth: 36, zIndex: 1 }}>#</th>
                      {filteredFields.map((h) => (
                        <th key={h} style={{ padding: "8px 12px", background: C.panelAlt, color: C.accent, fontWeight: 600, textAlign: "left", position: "sticky", top: 0, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap", zIndex: 1 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 200).map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? "row-even" : "row-odd"}>
                        <td style={{ padding: "5px 10px", color: C.muted, borderRight: `1px solid ${C.border}22` }}>{i + 1}</td>
                        {filteredFields.map((h) => (
                          <td key={h} style={{ padding: "5px 12px", color: C.text, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", borderRight: `1px solid ${C.border}22` }} title={row[h]}>{row[h]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 200 && (
                  <div style={{ padding: "8px 14px", color: C.muted, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", borderTop: `1px solid ${C.border}` }}>
                    + {(rows.length - 200).toLocaleString()} more rows not shown
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── RIGHT: Insights + Chat ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Insights */}
          <div style={{ height: "42%", borderBottom: `1px solid ${C.border}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, background: C.panelAlt, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.success, boxShadow: `0 0 6px ${C.success}` }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted }}>AI Insights</span>
              {insightLoading && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.accent, marginLeft: 4 }}>analyzing<span style={{ animation: "blink 1s infinite", display: "inline" }}>_</span></span>}
              {parsed && !insightLoading && (
                <button className="regen-btn" onClick={() => genInsights(parsed)} style={{ marginLeft: "auto", background: "none", border: `1px solid ${C.border}`, color: C.muted, cursor: "pointer", padding: "3px 10px", borderRadius: 4, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", transition: "all 0.15s" }}>
                  ↺ Regen
                </button>
              )}
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: "12px 16px" }}>
              {!parsed && (
                <div style={{ color: C.muted, fontSize: 13, textAlign: "center", marginTop: 24 }}>Upload a CSV to generate AI-powered insights</div>
              )}
              {insightLoading && (
                <div style={{ color: C.muted, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>Reading your data...</div>
              )}
              {insights && !insightLoading && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {insights.split("\n").filter((l) => l.trim()).map((line, i) => (
                    <div key={i} style={{ padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13, lineHeight: 1.65, color: C.text }}>
                      {line.startsWith("•") ? (
                        <span>
                          <span style={{ color: C.accent, marginRight: 8, fontWeight: 700 }}>•</span>
                          {line.slice(1).trim()}
                        </span>
                      ) : line}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Chat */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, background: C.panelAlt, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent2, boxShadow: `0 0 6px ${C.accent2}` }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted }}>Ask Questions</span>
              {messages.length > 0 && (
                <button className="clear-btn" onClick={() => setMessages([])} style={{ marginLeft: "auto", background: "none", border: `1px solid ${C.border}`, color: C.muted, cursor: "pointer", padding: "3px 10px", borderRadius: 4, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", transition: "all 0.15s" }}>Clear chat</button>
              )}
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflow: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
              {!parsed && (
                <div style={{ color: C.muted, fontSize: 13, textAlign: "center", marginTop: 24 }}>Upload a dataset to ask questions</div>
              )}
              {parsed && messages.length === 0 && (
                <div style={{ color: C.muted, fontSize: 13, textAlign: "center", marginTop: 24, lineHeight: 1.7 }}>
                  Ask anything about your data<br />
                  <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>"What's the average of X?" · "Any outliers?" · "Top 5 rows by Y?"</span>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className="msg-in" style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "88%",
                    padding: "9px 13px",
                    borderRadius: m.role === "user" ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
                    fontSize: 13,
                    lineHeight: 1.65,
                    background: m.role === "user" ? C.accent : C.panelAlt,
                    color: m.role === "user" ? "#000" : C.text,
                    fontWeight: m.role === "user" ? 600 : 400,
                    border: m.role === "assistant" ? `1px solid ${C.border}` : "none",
                    whiteSpace: "pre-wrap",
                  }}>
                    {m.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="msg-in" style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{ padding: "9px 13px", borderRadius: "10px 10px 10px 2px", background: C.panelAlt, border: `1px solid ${C.border}`, fontSize: 12, color: C.muted, fontFamily: "'JetBrains Mono', monospace" }}>
                    thinking<span style={{ animation: "blink 1s infinite", display: "inline" }}>_</span>
                  </div>
                </div>
              )}
              <div ref={chatEnd} />
            </div>

            {/* Input */}
            <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 8, background: C.panel, flexShrink: 0 }}>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                placeholder={parsed ? "Ask about your data… (Enter to send)" : "Upload a CSV first"}
                disabled={!parsed || chatLoading}
                style={{
                  flex: 1,
                  background: C.panelAlt,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  padding: "10px 14px",
                  color: C.text,
                  fontSize: 13,
                  outline: "none",
                  fontFamily: "'Syne', sans-serif",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.target.style.borderColor = C.accent)}
                onBlur={(e) => (e.target.style.borderColor = C.border)}
              />
              <button
                onClick={sendChat}
                disabled={!parsed || !input.trim() || chatLoading}
                className="send-btn"
                style={{
                  background: C.panelAlt,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  padding: "10px 18px",
                  color: C.text,
                  cursor: "pointer",
                  fontSize: 16,
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}