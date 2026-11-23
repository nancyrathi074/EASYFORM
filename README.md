EASYFORM
---
AI-Assisted Form Understanding and Guided Filling

EASYFORM is a web application that helps users understand forms and
complete them with step-by-step guidance. Users can upload a PDF, upload
a picture of a form, or provide form text. The application uses AI to
explain the document and identify fields that the applicant may need to
complete.

Table of contents
- Key features
- How AI is used
- How EASYFORM works
- Technology stack
- Project structure
- Run locally
- Environment configuration
- API endpoints
- Limitations and responsible use
- Future improvements

Key features
---
1. PDF form analysis
- Upload a PDF form through the web interface.
- The backend extracts text from the PDF.
- AI produces a concise explanation of the form, its purpose,
  important sections, required information, and warnings.
2. Form photo analysis
- Upload a supported form image (JPG, PNG, or WEBP).
- The backend sends the image to a vision-capable AI model.
- EASYFORM returns an explanation and any form text or fields
  identified by the model.
3. AI-guided form filling
- Extracts applicant-facing fields from form text.
- Presents questions one at a time in a guided interface.
- Shows field information such as section, page, required/optional
  status, and help text when available.
- Supports navigation through questions using Previous and Next
  controls.
- Keeps separate people and roles distinct where the form identifies
  them, such as primary and joint account holders.
4. Form explanation
- Explains the purpose and important parts of a form in simpler
  language.
- Highlights information a user may need before completing the form.
5. Language selection
- The frontend and backend pass a selected language to the AI
  workflow. The available language options depend on the current
  frontend implementation and model response.

How AI is used
EASYFORM uses the Groq API to access language and vision models.

AI workflow
1. A user uploads a PDF/image or provides form text.
2. The Spring Boot backend extracts PDF text or receives the image.
3. The backend sends the relevant content and instructions to Groq.
4. The AI returns an explanation or structured field data.
5. The backend validates/parses the response and returns it to the
   React frontend.
6. The frontend displays the explanation or guided questions.
Important: AI-generated field extraction is an assistive feature,
not a guarantee that every field has been detected correctly. Users
should compare the generated questions with the original document before
submitting an official form.

```bash
How EASYFORM works
User
 |
 v
React + Vite frontend
 |  PDF / image / text
 v
Java Spring Boot REST API
 |                  |
 |                  +--> PDF text extraction
 |
 +--> Groq API (text and vision AI)
 |
 v
Structured response / form explanation
 |
 v
Guided questions displayed in the frontend
```

Technology stack
                                
  Frontend:
  ```bash
  React, Vite, JavaScript
```

  Backend:                           
  ```bash 
  Java, Spring Boot, Maven
```

  AI provider                         Groq API

  AI tasks                            Text analysis, structured field
extraction, image analysis

  Database                            MySQL (configured through backend
environment settings)

  API style                           REST
Development tools                   VS Code, Node.js/npm, Java 21,
Maven
The exact model names and available capabilities are configured in the
backend and may change as the project evolves.
```bash
Project structure
EASYFORM/
├── easyform-frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   └── ...
│   ├── package.json
│   └── .env.example
│
├── easyform-backend/
│   ├── src/
│   │   └── main/
│   │       ├── java/com/easyform/
│   │       │   ├── controller/
│   │       │   ├── dto/
│   │       │   └── service/
│   │       └── resources/
│   ├── pom.xml
│   └── .env.example
│
└── README.md
```

Folder contents may change as development continues.
Run locally
Prerequisites
Install: - Java 21 - Node.js and npm - MySQL Server - Git
1. Clone the repository
git clone https://github.com/nancyrathi074/EASYFORM.git
cd EASYFORM
2. Configure the backend
Open the backend folder:
cd easyform-backend
Create a local .env file using the keys documented in
easyform-backend/.env.example. Set your own database connection
details and Groq API key. Do not commit this file.

The backend configuration uses environment variables for values such
as: - DB_URL - DB_USERNAME - DB_PASSWORD - GROQ_API_KEY -
GROQ_API_URL - JPA_DDL_AUTO - CORS_ALLOWED_ORIGIN

Make sure the MySQL database exists and the configured database user has
the required permissions.

Run the backend:

Windows PowerShell
```bash
.\mvnw.cmd spring-boot:run
```
The backend is configured to run locally on port 8080.

3. Configure the frontend
   
Open a second terminal:
```bash
cd easyform-frontend
```

Create a .env file based on easyform-frontend/.env.example. Set the
frontend API base URL to your local backend, using the variable name
expected by the current frontend source. For Vite, client-side
environment variables must use the VITE_ prefix.

Install dependencies and start the development server:
```bash
npm install
npm run dev
```

Open the local Vite URL shown in the terminal (typically
http://localhost:5173).

4. Build the frontend
```bash
npm run build
```

The production files are generated in the dist/ directory.
Environment configuration

Never put API keys, database passwords, or other secrets in frontend
source code.
- Keep the Groq API key on the backend only.
- Keep real .env files out of Git.
- Commit .env.example files with placeholder values only.
- Configure production secrets through the hosting provider's
  environment-variable settings.
- Restrict CORS to the deployed frontend origin in production.

Example placeholder only:
```bash
GROQ_API_KEY=your_groq_api_key

DB_URL=jdbc:mysql://localhost:3306/easyform

DB_USERNAME=your_database_username

DB_PASSWORD=your_database_password
```
Do not use these placeholder values as real credentials.

API endpoints
The backend exposes these form endpoints under /api/forms:
  Method                  Endpoint                Purpose
  POST                    /analyze              Analyse pasted form
text

  POST                    /analyze-pdf          Upload a PDF, extract
its text, and analyse
it

  POST                    /analyze-image        Upload and analyse a
form image
POST                    /extract-fields       Extract structured
fields for guided
filling
The upload endpoints use multipart/form-data. The text endpoints
accept JSON requests. Refer to FormController.java and the DTO classes
for the exact request fields.

Users open EASYFORM in a browser, visit its web interface, and upload or
provide the form content there. The React frontend communicates with the
Spring Boot backend through REST APIs.


Limitations and responsible use
- AI may omit, mislabel, duplicate, or incorrectly classify fields.
- Complex, scanned, low-quality, or very long documents may take
  longer to process or may exceed the AI provider's request or token
  limits.
- AI provider rate limits can temporarily prevent extraction.
- Users must verify generated questions and answers against the
  original form.
- EASYFORM does not guarantee that a form is legally, financially, or
  administratively correct.
- Do not upload confidential identity, banking, medical, or other
  sensitive documents unless you understand and accept the data
  handling and AI-provider processing involved.
- Do not rely on EASYFORM as a substitute for instructions from the
  issuing organisation or a qualified professional.
  

Repository: https://github.com/nancyrathi074/EASYFORM
