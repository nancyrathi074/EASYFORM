
package com.easyform.controller;

import com.easyform.dto.FormRequest;
import com.easyform.service.GroqService;
import com.easyform.service.PdfService;

import jakarta.validation.Valid;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/forms")
@CrossOrigin(origins = {"${app.cors.allowed-origin:http://localhost:5173}", "http://localhost:5174"})
public class FormController {

        private final GroqService groqService;
        private final PdfService pdfService;

        public FormController(
                        GroqService groqService,
                        PdfService pdfService) {

                this.groqService = groqService;
                this.pdfService = pdfService;
        }

        // Normalize language
        private String getLanguage(String language) {
                return language == null || language.isBlank()
                                ? "English"
                                : language.trim();
        }

        // 1. Analyze pasted form text
        @PostMapping("/analyze")
        public Map<String, Object> analyzeForm(
                        @Valid @RequestBody FormRequest request) {

                String language = getLanguage(request.getLanguage());
                String formText = request.getFormText();

                String analysis = groqService.analyzeForm(
                                formText,
                                language);

                return Map.of(
                                "message", "Form analyzed successfully!",
                                "language", language,
                                "analysis", analysis,
                                "formText", formText,
                                "status", "SUCCESS");
        }

        // 2. Upload and analyze PDF
        @PostMapping(value = "/analyze-pdf", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
        public Map<String, Object> analyzePdf(
                        @RequestParam("file") MultipartFile file,
                        @RequestParam(value = "language", defaultValue = "English") String language)
                        throws IOException {

                language = getLanguage(language);

                // Extract text from PDF
                String extractedText = pdfService.extractText(file);

                // Analyze extracted content
                String analysis = groqService.analyzeForm(
                                extractedText,
                                language);

                return Map.of(
                                "message", "PDF analyzed successfully!",
                                "language", language,
                                "analysis", analysis,
                                "formText", extractedText,
                                "status", "SUCCESS");
        }

        // 3. Upload a photo of a form and analyze it with a vision model.
        @PostMapping(value = "/analyze-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
        public Map<String, Object> analyzeImage(
                        @RequestParam("file") MultipartFile file,
                        @RequestParam(value = "language", defaultValue = "English") String language)
                        throws IOException {

                if (file == null || file.isEmpty()) {
                        throw new IllegalArgumentException("Please select an image of the form.");
                }
                if (file.getSize() > 10L * 1024 * 1024) {
                        throw new IllegalArgumentException("Image must be 10 MB or smaller.");
                }

                String contentType = file.getContentType();
                if (contentType == null || !java.util.List.of("image/jpeg", "image/png", "image/webp").contains(contentType)) {
                        throw new IllegalArgumentException("Please upload a JPG, PNG or WEBP image.");
                }

                var visualResult = groqService.analyzeFormImage(file.getBytes(), contentType, getLanguage(language));
                String analysis = visualResult.path("analysis").asText("The image was received, but no explanation was generated.");
                String extractedText = visualResult.path("extractedText").asText("");

                return Map.of(
                                "message", "Form photo analyzed successfully!",
                                "language", getLanguage(language),
                                "documentTitle", visualResult.path("documentTitle").asText("Form photo"),
                                "analysis", analysis,
                                "formText", extractedText,
                                "fields", visualResult.path("fields"),
                                "status", "SUCCESS");
        }

        // 4. Extract fields for guided form filling
        @PostMapping("/extract-fields")
        public Map<String, Object> extractFields(
                        @Valid @RequestBody FormRequest request) {

                String language = getLanguage(request.getLanguage());
                String formText = request.getFormText();

                var fieldsData = groqService.extractFormFields(
                                formText,
                                language);

                return Map.of(
                                "message", "Form fields extracted successfully!",
                                "fields", fieldsData.path("fields"),
                                "status", "SUCCESS");
        }
}
