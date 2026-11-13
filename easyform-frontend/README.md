# EASYFORM — Frontend

EASYFORM is a React + Vite interface for understanding text-based PDF documents or pasted form text, extracting guided fields, reviewing answers, and downloading an answer-summary PDF.

## Requirements
- Node.js 20.19+ or 22.12+
- npm
- EASYFORM Spring Boot backend running

## Run locally
1. Copy `.env.example` to `.env`.
2. Keep `VITE_API_BASE_URL=http://localhost:8080` for local development.
3. Run `npm ci`.
4. Run `npm run dev`.

## Production build
Set `VITE_API_BASE_URL` to the public HTTPS URL of the deployed backend, then run:

```bash
npm ci
npm run lint
npm run build
```

Deploy the generated `dist/` directory to a static hosting provider. The `VITE_` value is public in the browser bundle; never put API keys or database credentials in frontend environment variables.

## Current limitations
- Only text-based PDFs are supported. Scanned/image-only PDFs need OCR, which is not included yet.
- The guided workflow creates a completed answer-summary PDF; it does not write answers into the original uploaded PDF.
- AI field extraction and explanations may use only an initial portion of long documents. Always compare AI output and answers with the original document.
- The generated PDF currently uses standard jsPDF fonts; Hindi/Devanagari text may not render correctly in the downloaded PDF.
- Document text is sent to the configured Groq API for analysis. Do not upload sensitive personal, medical, financial, or identity information.
