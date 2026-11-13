
package com.easyform.service;

import net.sourceforge.tess4j.ITessAPI;
import net.sourceforge.tess4j.Tesseract;
import net.sourceforge.tess4j.TesseractException;
import net.sourceforge.tess4j.Word;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.Rectangle;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@Service
public class OcrService {

    @Value("${easyform.ocr.tessdata-path:C:/Program Files/Tesseract-OCR/tessdata}")
    private String tessdataPath;

    @Value("${easyform.ocr.language:eng}")
    private String language;

    /**
     * Creates a new Tesseract instance.
     * A separate instance is used for each operation.
     */
    private Tesseract createTesseract() {

        Tesseract tesseract = new Tesseract();

        tesseract.setDatapath(tessdataPath);
        tesseract.setLanguage(language);

        // Automatic page layout detection
        tesseract.setPageSegMode(
                ITessAPI.TessPageSegMode.PSM_AUTO);

        return tesseract;
    }

    /**
     * Reads an uploaded image.
     */
    private BufferedImage readImage(byte[] imageBytes)
            throws IOException {

        if (imageBytes == null || imageBytes.length == 0) {
            throw new IllegalArgumentException(
                    "Image data is empty.");
        }

        BufferedImage image = ImageIO.read(
                new ByteArrayInputStream(imageBytes));

        if (image == null) {
            throw new IllegalArgumentException(
                    "Unable to read the uploaded image.");
        }

        return image;
    }

    /**
     * Extracts all recognized text from an image.
     */
    public String extractText(byte[] imageBytes)
            throws IOException, TesseractException {

        BufferedImage image = readImage(imageBytes);

        Tesseract tesseract = createTesseract();

        return tesseract.doOCR(image);
    }

    /**
     * Extracts individual words with their bounding boxes.
     * Coordinates are normalized to a 0-1000 scale.
     */
    public List<OcrWord> extractWords(byte[] imageBytes)
            throws IOException {

        BufferedImage image = readImage(imageBytes);

        int imageWidth = image.getWidth();
        int imageHeight = image.getHeight();

        Tesseract tesseract = createTesseract();

        List<Word> detectedWords = tesseract.getWords(
                image,
                ITessAPI.TessPageIteratorLevel.RIL_WORD);

        List<OcrWord> results = new ArrayList<>();

        for (Word word : detectedWords) {

            String text = word.getText();

            if (text == null || text.isBlank()) {
                continue;
            }

            Rectangle box = word.getBoundingBox();

            if (box == null
                    || box.width <= 0
                    || box.height <= 0) {
                continue;
            }

            // Convert pixel coordinates to 0-1000 scale.
            int x = normalize(box.x, imageWidth);
            int y = normalize(box.y, imageHeight);

            int right = normalize(
                    box.x + box.width,
                    imageWidth);

            int bottom = normalize(
                    box.y + box.height,
                    imageHeight);

            int width = Math.max(1, right - x);
            int height = Math.max(1, bottom - y);

            results.add(new OcrWord(
                    text.trim(),
                    x,
                    y,
                    width,
                    height,
                    word.getConfidence()));
        }

        return results;
    }

    /**
     * Converts pixel coordinates to normalized coordinates.
     */
    private int normalize(int coordinate, int dimension) {

        if (dimension <= 0) {
            return 0;
        }

        int normalized = (int) Math.round(
                (coordinate * 1000.0) / dimension);

        return Math.max(0, Math.min(1000, normalized));
    }

    /**
     * Structure returned for each recognized word.
     */
    public record OcrWord(
            String text,
            int x,
            int y,
            int width,
            int height,
            float confidence) {
    }
}
