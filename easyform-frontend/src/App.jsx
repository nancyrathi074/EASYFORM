import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import "./App.css";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080"
).replace(/\/$/, "");
import translations from "./translations";

// Remove genuine duplicate questions without merging
// separate people, account holders or other repeated entries.
const deduplicateGuidedFields = (inputFields) => {
  if (!Array.isArray(inputFields)) return [];

  const seen = new Set();

  const normalize = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");

  const isRepeatableSlot = (field) => {
    const identity = normalize(
      `${field.name || ""} ${field.label || ""} ${field.help || ""}`
    );

    return (
      /\b(holder|nominee|beneficiary|guardian|witness|dependent|co applicant|joint|partner|director|reference|insured|applicant)\b/.test(identity) ||
      /\b\d+\b/.test(identity)
    );
  };

  return inputFields.filter((field) => {
    if (!field || typeof field !== "object") return false;

    const label = normalize(field.label);
    const help = normalize(field.help);
    const section = normalize(field.section);
    const audience = normalize(field.audience || "applicant");

    if (!label) return true;

    // Never merge fields belonging to separate people or slots.
    if (isRepeatableSlot(field)) return true;

    const signature = `${label}|${help}|${section}|${audience}`;

    if (seen.has(signature)) {
      return false;
    }

    seen.add(signature);
    return true;
  });
};

function App() {
  const [language, setLanguage] = useState("English");
  const t = translations[language] || translations.English;

  const [formText, setFormText] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [inputMode, setInputMode] = useState("upload");

  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const [result, setResult] = useState(null);
  const [fields, setFields] = useState([]);
  const [answers, setAnswers] = useState({});
  const [showFillForm, setShowFillForm] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);

  const [error, setError] = useState("");
  const [fillError, setFillError] = useState("");
  const [expanded, setExpanded] = useState(false);

  const fileInput = useRef(null);
  const photoInput = useRef(null);

  useEffect(() => {
    if (!selectedFile || !selectedFile.type.startsWith("image/")) {
      setPhotoPreview("");
      return;
    }
    const objectUrl = URL.createObjectURL(selectedFile);
    setPhotoPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  const resetResults = () => {
    setResult(null);
    setFields([]);
    setAnswers({});
    setShowFillForm(false);
    setReviewMode(false);
    setCurrentFieldIndex(0);
    setError("");
    setFillError("");
    setExpanded(false);
  };

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setSelectedFile(null);
      setError(t.invalidFile);
      event.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setSelectedFile(null);
      setError(t.fileSize);
      event.target.value = "";
      return;
    }

    setSelectedFile(file);
    resetResults();
  };

  const handlePhotoFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setSelectedFile(null);
      setError(language === "Hindi" ? "कृपया JPG, PNG या WEBP फोटो चुनें।" : "Please choose a JPG, PNG or WEBP image.");
      event.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setSelectedFile(null);
      setError(t.fileSize);
      event.target.value = "";
      return;
    }
    setSelectedFile(file);
    setError("");
    resetResults();
  };

  const handleContinue = async () => {
    resetResults();

    if ((inputMode === "upload" || inputMode === "photo") && !selectedFile) {
      setError(inputMode === "photo" ? (language === "Hindi" ? "कृपया फॉर्म की फोटो चुनें।" : "Please select a form photo first.") : t.selectFile);
      return;
    }

    if (inputMode === "paste" && !formText.trim()) {
      setError(t.enterText);
      return;
    }

    try {
      setLoading(true);
      let response;

      if (inputMode === "upload" || inputMode === "photo") {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("language", language);

        const endpoint = inputMode === "photo" ? "analyze-image" : "analyze-pdf";
        response = await fetch(`${API_BASE}/api/forms/${endpoint}`, {
          method: "POST",
          body: formData,
        });
      } else {
        response = await fetch(`${API_BASE}/api/forms/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ formText, language }),
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || t.connection);
      }

      if (inputMode === "upload" || inputMode === "photo") {
        setFormText(data.formText || "");
      }
      if (inputMode === "photo" && Array.isArray(data.fields)) {
  setFields(deduplicateGuidedFields(data.fields));
}

      setResult(data);
    } catch (err) {
      console.error("Form processing error:", err);
      setError(err.message || t.connection);
    } finally {
      setLoading(false);
    }
  };

  const handleExtractFields = async () => {
    setFillError("");
    setAnswers({});
    setReviewMode(false);

    if (fields.length > 0 && result?.fields?.length > 0) {
      setShowFillForm(true);
      setCurrentFieldIndex(0);
      return;
    }

    if (!formText.trim()) {
      setFillError(t.enterText);
      return;
    }

    try {
      setExtracting(true);

      const response = await fetch(`${API_BASE}/api/forms/extract-fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formText, language }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || t.extractionError);
      }
if (!Array.isArray(data.fields) || data.fields.length === 0) {
  throw new Error(t.noFields);
}

const uniqueFields = deduplicateGuidedFields(data.fields);

if (uniqueFields.length === 0) {
  throw new Error(t.noFields);
}

setFields(uniqueFields);
setCurrentFieldIndex(0);
setShowFillForm(true);
    } catch (err) {
      console.error("Field extraction error:", err);
      setFillError(err.message || t.extractionError);
    } finally {
      setExtracting(false);
    }
  };

  const handleAnswerChange = (name, value) => {
    setAnswers((previous) => ({ ...previous, [name]: value }));
    setFillError("");
  };

  const getFieldKey = (field, index) =>
    field.name || `field_${index}`;

  const handleReviewAnswers = () => {
    const missing = fields.filter((field, index) => {
      if (!field.required || field.audience === "bank_staff") return false;

      const answer = answers[getFieldKey(field, index)];

      return (
        answer === undefined ||
        answer === null ||
        answer === "" ||
        (String(field.type || "").toLowerCase() === "checkbox" && answer !== true) ||
        (Array.isArray(answer) && answer.length === 0)
      );
    });

    if (missing.length) {
      setFillError(
        `${t.requiredList} ${missing
          .map((field) => field.label || field.name)
          .join(", ")}`
      );
      return;
    }

    setFillError("");
    setReviewMode(true);
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let y = 48;

    doc.setFillColor(38, 61, 53);
    doc.rect(0, 0, pageWidth, 38, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(21);
    doc.text("EASYFORM", margin, 17);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Completed Form Summary", margin, 27);

    doc.setTextColor(80, 90, 84);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-IN")}`, margin, 44);

    fields.forEach((field, index) => {
      const answer = answers[getFieldKey(field, index)];
      const label = field.label || field.name || `Field ${index + 1}`;
      const answerText =
        answer === undefined || answer === ""
          ? t.notAnswered
          : answer === true
          ? t.yes
          : answer === false
          ? t.no
          : String(answer);

      const labelLines = doc.splitTextToSize(label, contentWidth);
      const answerLines = doc.splitTextToSize(answerText, contentWidth);
      const blockHeight =
        labelLines.length * 5 + answerLines.length * 5 + 12;

      if (y + blockHeight > pageHeight - 18) {
        doc.addPage();
        y = 25;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(38, 61, 53);
      doc.text(labelLines, margin, y);
      y += labelLines.length * 5 + 3;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(75, 85, 80);
      doc.text(answerLines, margin, y);
      y += answerLines.length * 5 + 5;

      doc.setDrawColor(220, 226, 220);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;
    });

    const totalPages = doc.internal.getNumberOfPages();

    for (let page = 1; page <= totalPages; page++) {
      doc.setPage(page);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(110, 120, 114);
      doc.text("Generated by EASYFORM", 20, pageHeight - 10);
      doc.text(`Page ${page} of ${totalPages}`, pageWidth - 20, pageHeight - 10, {
        align: "right",
      });
    }

    doc.save("EASYFORM-Completed-Form.pdf");
  };

  const renderField = (field, index) => {
    const name = getFieldKey(field, index);
    const type = (field.type || "text").toLowerCase();
    const value = answers[name] ?? "";
    const id = `form-field-${index}`;
    const options = Array.isArray(field.options) ? field.options : [];

    const optionValue = (option) =>
      typeof option === "string"
        ? option
        : option.value || option.label || "";

    const optionLabel = (option) =>
      typeof option === "string"
        ? option
        : option.label || option.value;

    return (
      <div className="guided-field" key={name}>
        <label htmlFor={id}>
          {field.label || field.name}
          {field.required && field.audience !== "bank_staff" && (
            <span className="required-mark"> *</span>
          )}
        </label>

        <div className="field-source-meta">
          <span>
            {field.audience === "bank_staff"
              ? (language === "Hindi" ? "केवल बैंक कर्मचारी" : "Bank staff only")
              : field.audience === "shared"
              ? (language === "Hindi" ? "साझा जानकारी" : "Shared information")
              : (language === "Hindi" ? "आवेदक के लिए" : "Applicant field")}
          </span>
          {field.optional && (
            <span>{language === "Hindi" ? "वैकल्पिक" : "Optional"}</span>
          )}
          {field.section && <span>{field.section}</span>}
          {Number.isInteger(field.page) && (
            <span>{language === "Hindi" ? `पृष्ठ ${field.page}` : `Page ${field.page}`}</span>
          )}
        </div>

        {field.help && <p className="field-help">{field.help}</p>}

        {field.audience === "bank_staff" ? (
          <div className="bank-only-notice" role="note">
            {language === "Hindi"
              ? "यह भाग बैंक के उपयोग के लिए है। आवेदक को इसे नहीं भरना चाहिए।"
              : "This section is reserved for bank staff. Applicants should leave it blank."}
          </div>
        ) : type === "textarea" ? (
          <textarea
            id={id}
            value={value}
            required={field.required}
            placeholder={t.enterAnswer}
            onChange={(e) => handleAnswerChange(name, e.target.value)}
          />
        ) : type === "select" ? (
          <select
            id={id}
            value={value}
            required={field.required}
            onChange={(e) => handleAnswerChange(name, e.target.value)}
          >
            <option value="">{t.selectOption}</option>
            {options.map((option, i) => (
              <option key={i} value={optionValue(option)}>
                {optionLabel(option)}
              </option>
            ))}
          </select>
        ) : type === "radio" ? (
          <div className="guided-options">
            {options.map((option, i) => (
              <label className="guided-option" key={i}>
                <input
                  type="radio"
                  name={name}
                  value={optionValue(option)}
                  checked={value === optionValue(option)}
                  onChange={() =>
                    handleAnswerChange(name, optionValue(option))
                  }
                />
                {optionLabel(option)}
              </label>
            ))}
          </div>
        ) : type === "checkbox" ? (
          <label className="guided-option">
            <input
              id={id}
              type="checkbox"
              checked={value === true}
              onChange={(e) => handleAnswerChange(name, e.target.checked)}
            />
            {field.help || t.yes}
          </label>
        ) : (
          <input
            id={id}
            type={["text", "email", "number", "date"].includes(type) ? type : "text"}
            value={value}
            required={field.required}
            placeholder={t.enterAnswer}
            onChange={(e) => handleAnswerChange(name, e.target.value)}
          />
        )}
      </div>
    );
  };

  return (
         <div className="site-wrapper" lang={language === "Hindi" ? "hi" : "en"}>      <header className="site-header">
        <a href="#home" className="brand">
          <span className="brand-mark">e.</span>
          <span>easyform</span>
        </a>

        <nav className="main-nav">
          <a href="#home">{t.home}</a>
          <a href="#how-it-works">{t.how}</a>
          <a href="#about">{t.about}</a>
        </nav>

        <div className="header-actions">
          <div className="language-switcher">
            <span>文</span>
            <select
              aria-label="Select language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="English">🇮🇳 English</option>
              <option value="Hindi">🇮🇳 हिन्दी</option>
            </select>
          </div>

          <a href="#get-started" className="header-link">
            {t.start} ↗
          </a>
        </div>
      </header>

      <main>
        <section className="hero-section" id="home">
          <div className="hero-copy">
            <div className="ai-badge">
              <span className="ai-dot" />
              {t.badge}
            </div>

            <div className="eyebrow" style={{ marginTop: 25 }}>
              <span className="eyebrow-line" />
              {t.eyebrow}
            </div>

            <h1>
              {t.hero1}
              <br />
              {t.hero2} <em>{t.hero3}</em>
            </h1>

            <p className="hero-description">{t.description}</p>

            <div className="hero-actions">
              <a href="#get-started" className="button-dark">
                {t.try} ↗
              </a>
              <a href="#how-it-works" className="text-link">
                {t.see} →
              </a>
            </div>

            <div className="hero-note">
              <span className="note-dot" />
              {t.note}
            </div>
          </div>

          <div className="hero-art">
            <div className="paper paper-back">
              <div className="paper-topline">DOCUMENT / 02</div>
              <div className="paper-rule" />
              <div className="paper-placeholder wide" />
              <div className="paper-placeholder" />
              <div className="paper-placeholder medium" />
              <div className="paper-box" />
              <div className="paper-placeholder wide" />
            </div>

            <div className="paper paper-front">
              <div className="paper-topline">
                <span>YOUR DOCUMENT</span>
                <span className="paper-number">01</span>
              </div>
              <h3>{language === "Hindi" ? "व्यक्तिगत जानकारी" : "Personal details"}</h3>
              <p className="paper-description">
                {language === "Hindi"
                  ? "कृपया निम्नलिखित जानकारी दें।"
                  : "Please provide the following information."}
              </p>
              {(
                language === "Hindi"
                  ? ["पूरा नाम", "जन्म तिथि", "घर का पता"]
                  : ["Full name", "Date of birth", "Residential address"]
              ).map((item) => (
                <div className="paper-field" key={item}>
                  <span>{item}</span>
                  <div />
                </div>
              ))}
              <div className="paper-highlight">
                <span>i</span>
                <div>
                  <strong>
                    {language === "Hindi"
                      ? "समझ नहीं आ रहा?"
                      : "Not sure what this means?"}
                  </strong>
                  <small>
                    {language === "Hindi"
                      ? "भरने से पहले आसान भाषा में समझें।"
                      : "Get a simple explanation before filling it in."}
                  </small>
                </div>
              </div>
            </div>

            <div className="art-caption">
              <span>01 — UNDERSTAND</span>
              <span>02 — COMPLETE</span>
            </div>
          </div>
        </section>

        <section className="intro-strip">
          <p>{t.intro}</p>
          <span>{t.introText}</span>
        </section>

        <section className="workspace-section" id="get-started">
          <div className="section-heading">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line" />
                {t.workspaceLabel}
              </div>
              <h2>{t.workspaceTitle}</h2>
              <p>{t.workspaceDescription}</p>
            </div>
            <span className="section-index">01 / 03</span>
          </div>

          <div className="workspace">
            <aside className="workspace-sidebar">
              <span className="sidebar-label">{t.workspace}</span>

              <div className="sidebar-item active">
                <span>01</span>
                <div>
                  <strong>{t.provide}</strong>
                  <small>{t.uploadPaste}</small>
                </div>
              </div>

              <div className="sidebar-item">
                <span>02</span>
                <div>
                  <strong>{t.understand}</strong>
                  <small>{t.review}</small>
                </div>
              </div>

              <div className="sidebar-item">
                <span>03</span>
                <div>
                  <strong>{t.fill}</strong>
                  <small>{t.complete}</small>
                </div>
              </div>
            </aside>

            <div className="workspace-main">
              <div className="workspace-tabs">
                <button
                  type="button"
                  className={inputMode === "upload" ? "tab active-tab" : "tab"}
                  onClick={() => {
                    setInputMode("upload");
                    setSelectedFile(null);
                    resetResults();
                  }}
                >
                  ↥ {t.upload}
                </button>

                <button
                  type="button"
                  className={inputMode === "photo" ? "tab active-tab" : "tab"}
                  onClick={() => {
                    setInputMode("photo");
                    setSelectedFile(null);
                    resetResults();
                  }}
                >
                  ◉ {t.photo}
                </button>

                <button
                  type="button"
                  className={inputMode === "paste" ? "tab active-tab" : "tab"}
                  onClick={() => {
                    setInputMode("paste");
                    setSelectedFile(null);
                    resetResults();
                  }}
                >
                  ⌘ {t.paste}
                </button>
              </div>

              {inputMode === "upload" ? (
                <div className="upload-area">
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFile}
                    hidden
                  />
                  <div className="upload-symbol">↥</div>
                  <h3>{selectedFile ? selectedFile.name : t.choose}</h3>
                  <p>{selectedFile ? t.selected : t.pdf}</p>
                  <button
                    type="button"
                    className="button-outline"
                    onClick={() => fileInput.current?.click()}
                  >
                    {t.browse}
                  </button>
                  <div className="file-types">{t.pdf}</div>
                </div>
              ) : inputMode === "photo" ? (
                <div className="upload-area photo-upload-area">
                  <input
                    ref={photoInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    onChange={handlePhotoFile}
                    hidden
                  />
                  <div className="upload-symbol">◎</div>
                  <h3>{selectedFile ? selectedFile.name : t.photoChoose}</h3>
                  <p>{selectedFile ? t.photoSelected : t.photoHint}</p>
                  {photoPreview && <img className="photo-preview-thumb" src={photoPreview} alt="Selected form preview" />}
                  <button type="button" className="button-outline" onClick={() => photoInput.current?.click()}>
                    {language === "Hindi" ? "फोटो चुनें / कैमरा खोलें" : "Choose photo / Open camera"}
                  </button>
                  <div className="file-types">{t.photoHint}</div>
                </div>
              ) : (
                <div className="paste-area">
                  <label htmlFor="form-text">{t.content}</label>
                  <textarea
                    id="form-text"
                    value={formText}
                    onChange={(e) => {
                      setFormText(e.target.value);
                      resetResults();
                    }}
                    placeholder={t.placeholder}
                  />
                  <div className="paste-footer">
                    <span>{formText.length} {t.characters}</span>
                    <span>{t.textInput}</span>
                  </div>
                </div>
              )}

              <div className="workspace-footer">
                <p><span>i</span>{inputMode === "photo" ? t.photoPrivacy : t.privacy}</p>
                <button
                  type="button"
                  className="button-dark continue-button"
                  onClick={handleContinue}
                  disabled={
                    loading ||
                    ((inputMode === "upload" || inputMode === "photo")
                      ? !selectedFile
                      : !formText.trim())
                  }
                >
                  {loading ? t.processing : t.analyze} →
                </button>
              </div>

              {error && <div className="error-message" role="alert">{error}</div>}

              {result && (
                <div className="result-card" role="status">
                  <div className="result-header">
                    <h3>{t.received}</h3>
                    <div className="result-info">
                      <span>{result.message}</span>
                      <span>{t.resultLanguage}: {result.language}</span>
                      <span>{t.status}: {result.status}</span>
                    </div>
                  </div>


                  {inputMode === "photo" && photoPreview && (
                    <section className="photo-explanation-section">
                      <div className="photo-explanation-heading">
                        <h3>{t.visualMap}</h3>
                        <p>{t.visualMapText}</p>
                      </div>
                      <div className="photo-explanation-grid">
                        <div className="annotated-photo">
                          <img src={photoPreview} alt="Uploaded form" />
                          <svg className="photo-annotation-layer" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label="Detected form field locations">
                            {(result.fields || []).map((field, index) => {
                              const box = field.box;
                              if (!box || ![box.x, box.y, box.width, box.height].every(Number.isFinite)) return null;
                              return <g key={`${field.name}-${index}`}>
                                <rect x={box.x} y={box.y} width={box.width} height={box.height} rx="5" />
                                <circle cx={Math.max(18, Math.min(982, box.x))} cy={Math.max(18, Math.min(982, box.y))} r="17" />
                                <text x={Math.max(18, Math.min(982, box.x))} y={Math.max(18, Math.min(982, box.y)) + 6}>{index + 1}</text>
                              </g>;
                            })}
                          </svg>
                        </div>
                        <div className="photo-field-list">
                          {(result.fields || []).map((field, index) => (
                            <article className="photo-field-card" key={`${field.name}-${index}`}>
                              <span className="photo-field-number">{index + 1}</span>
                              <div>
                                <strong>{field.label || field.name}</strong>
                                <p>{field.help || (language === "Hindi" ? "इस फ़ील्ड का विवरण उपलब्ध नहीं है।" : "No explanation was returned for this field.")}</p>
                                <div className="field-source-meta">
                                  <span>{field.audience === "bank_staff" ? (language === "Hindi" ? "बैंक कर्मचारी" : "Bank staff") : field.audience === "shared" ? (language === "Hindi" ? "साझा" : "Shared") : (language === "Hindi" ? "आवेदक" : "Applicant")}</span>
                                  {field.confidence && <span>{language === "Hindi" ? "विश्वास" : "Confidence"}: {field.confidence}</span>}
                                  {field.box == null && <span>{t.noBox}</span>}
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>
                    </section>
                  )}

                  <section className="analysis-card">
                    <div className="ai-provider">
                      ✦ {t.explanation}
                    </div>
                    <h3>{t.understanding}</h3>
                    <div className={`ai-analysis ${!expanded && (result.analysis || "").length > 400 ? "collapsed" : ""}`}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {result.analysis || ""}
                      </ReactMarkdown>
                    </div>
                    {(result.analysis || "").length > 400 && (
                      <button
                        type="button"
                        className="read-more-button"
                        aria-expanded={expanded}
                        onClick={() => setExpanded((value) => !value)}
                      >
                        {expanded ? t.readLess : t.readMore}
                      </button>
                    )}
                  </section>

                  {!showFillForm && (
                    <section className="fill-start-section">
                      <h3>{t.guided}</h3>
                      <p>{t.guidedText}</p>
                      <button
                        type="button"
                        className="button-dark"
                        onClick={handleExtractFields}
                        disabled={extracting}
                      >
                        {extracting ? t.preparing : t.fillButton + " →"}
                      </button>
                      {fillError && (
                        <div className="error-message" role="alert">{fillError}</div>
                      )}
                    </section>
                  )}

                  {showFillForm && (
                    <section className="guided-form-section">
                      <div className="guided-form-heading">
                        <h3>{reviewMode ? t.reviewTitle : t.fillTitle}</h3>
                        <p>{reviewMode ? t.reviewDescription : t.fillDescription}</p>
                      </div>

                      {!reviewMode ? (
                        <>
                          {fields[currentFieldIndex] && (
                            <>
                              <div className="guided-progress">
                                <span>
                                  {t.question} {currentFieldIndex + 1} {language === "Hindi" ? "में से" : "of"} {fields.length}
                                </span>
                                <span>
                                  {Math.round(((currentFieldIndex + 1) / fields.length) * 100)}%
                                </span>
                              </div>

                              <div className="guided-progress-track">
                                <div
                                  className="guided-progress-fill"
                                  style={{
                                    width: `${((currentFieldIndex + 1) / fields.length) * 100}%`,
                                  }}
                                />
                              </div>

                              <div className="guided-question">
                                {renderField(fields[currentFieldIndex], currentFieldIndex)}
                              </div>

                              {fillError && (
                                <div className="error-message" role="alert">{fillError}</div>
                              )}

                              <div className="guided-navigation">
                                <button
                                  type="button"
                                  className="button-outline"
                                  disabled={currentFieldIndex === 0}
                                  onClick={() => setCurrentFieldIndex((i) => i - 1)}
                                >
                                  {t.previous}
                                </button>

                                {currentFieldIndex < fields.length - 1 ? (
                                  <button
                                    type="button"
                                    className="button-dark"
                                    onClick={() => {
                                      const field = fields[currentFieldIndex];
                                      const answer = answers[getFieldKey(field, currentFieldIndex)];

                                      if (
                                        field.required &&
                                        field.audience !== "bank_staff" &&
                                        (answer === undefined ||
                                          answer === null ||
                                          answer === "" ||
                                          answer === false)
                                      ) {
                                        setFillError(t.required);
                                        return;
                                      }

                                      setFillError("");
                                      setCurrentFieldIndex((i) => i + 1);
                                    }}
                                  >
                                    {t.next}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="button-dark"
                                    onClick={handleReviewAnswers}
                                  >
                                    {t.reviewAnswers}
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="answer-review">
                            {fields.map((field, index) => {
                              const answer = answers[getFieldKey(field, index)];

                              return (
                                <div className="review-answer" key={getFieldKey(field, index)}>
                                  <strong>{field.label || field.name}</strong>
                                  <div className="field-source-meta">
                                    <span>
                                      {field.audience === "bank_staff"
                                        ? (language === "Hindi" ? "केवल बैंक कर्मचारी" : "Bank staff only")
                                        : field.audience === "shared"
                                        ? (language === "Hindi" ? "साझा जानकारी" : "Shared information")
                                        : (language === "Hindi" ? "आवेदक के लिए" : "Applicant field")}
                                    </span>
                                    {field.section && <span>{field.section}</span>}
                                    {Number.isInteger(field.page) && (
                                      <span>{language === "Hindi" ? `पृष्ठ ${field.page}` : `Page ${field.page}`}</span>
                                    )}
                                  </div>
                                  <p>
                                    {field.audience === "bank_staff"
                                      ? (language === "Hindi" ? "बैंक द्वारा भरा जाएगा" : "To be completed by bank staff")
                                      : answer === undefined || answer === ""
                                      ? t.notAnswered
                                      : answer === true
                                      ? t.yes
                                      : answer === false
                                      ? t.no
                                      : String(answer)}
                                  </p>
                                </div>
                              );
                            })}
                          </div>

                          <button
                            type="button"
                            className="button-outline"
                            onClick={() => {
                              setReviewMode(false);
                              setCurrentFieldIndex(0);
                            }}
                          >
                            {t.edit}
                          </button>

                          <button
                            type="button"
                            className="button-dark"
                            onClick={handleDownloadPDF}
                          >
                            {t.download}
                          </button>

                          <p className="review-note">{t.verify}</p>
                        </>
                      )}
                    </section>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="process-section" id="how-it-works">
          <div className="process-heading">
            <div className="eyebrow">
              <span className="eyebrow-line" />
              {t.process}
            </div>
            <h2>{t.processTitle}</h2>
          </div>

          <div className="process-grid">
            <article className="process-card">
              <span className="process-number">01</span>
              <div className="process-icon">↥</div>
              <h3>{t.bring}</h3>
              <p>{t.bringText}</p>
            </article>

            <article className="process-card">
              <span className="process-number">02</span>
              <div className="process-icon">⌕</div>
              <h3>{t.makeSense}</h3>
              <p>{t.makeSenseText}</p>
            </article>

            <article className="process-card">
              <span className="process-number">03</span>
              <div className="process-icon">✓</div>
              <h3>{t.confidence}</h3>
              <p>{t.confidenceText}</p>
            </article>
          </div>
        </section>

        <section className="closing-section" id="about">
          <div>
            <span>{t.closingLabel}</span>
            <h2>{t.closingTitle}</h2>
          </div>
          <a href="#get-started" className="button-light">
            {t.closingButton} ↗
          </a>
        </section>
      </main>

      <footer className="site-footer">
        <a href="#home" className="brand footer-brand">
          <span className="brand-mark">e.</span>
          <span>easyform</span>
        </a>
        <p>{t.footer}</p>
        <span className="copyright">© 2026 EASYFORM</span>
      </footer>
    </div>
  );
}

export default App;