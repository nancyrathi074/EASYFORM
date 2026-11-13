package com.easyform.service;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Arrays;

@Service
public class PdfService {

    private static final long MAX_FILE_SIZE = 10L * 1024 * 1024;
    private static final byte[] PDF_SIGNATURE = "%PDF-".getBytes(java.nio.charset.StandardCharsets.US_ASCII);

    public String extractText(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Please upload a PDF file.");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("PDF file must be 10 MB or smaller.");
        }

        String filename = file.getOriginalFilename();
        if (filename == null || !filename.toLowerCase().endsWith(".pdf")) {
            throw new IllegalArgumentException("Only PDF files are supported.");
        }

        byte[] bytes = file.getBytes();
        if (bytes.length < PDF_SIGNATURE.length ||
                !Arrays.equals(Arrays.copyOf(bytes, PDF_SIGNATURE.length), PDF_SIGNATURE)) {
            throw new IllegalArgumentException("The uploaded file is not a valid PDF.");
        }

        try (PDDocument document = Loader.loadPDF(bytes)) {
            if (document.isEncrypted()) {
                throw new IllegalArgumentException("Password-protected PDFs are not supported.");
            }

            // Extract each page separately so downstream AI can cite page numbers.
            StringBuilder pagedText = new StringBuilder();
            for (int page = 1; page <= document.getNumberOfPages(); page++) {
                PDFTextStripper pageStripper = new PDFTextStripper();
                pageStripper.setStartPage(page);
                pageStripper.setEndPage(page);
                String pageText = pageStripper.getText(document).trim();
                pagedText.append("\n[PAGE ").append(page).append("]\n");
                if (!pageText.isBlank()) {
                    pagedText.append(pageText).append('\n');
                }
            }
            String extractedText = pagedText.toString().trim();

            if (extractedText.isBlank()) {
                throw new IllegalArgumentException(
                        "No readable text found. This PDF may be scanned; scanned PDF OCR is not supported yet.");
            }

            return extractedText;
        } catch (org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException ex) {
            throw new IllegalArgumentException("Password-protected PDFs are not supported.");
        }
    }
}
