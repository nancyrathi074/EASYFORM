package com.easyform.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class FormRequest {

    @NotBlank(message = "Form text cannot be empty")
    @Size(max = 30000, message = "Form text must be 30,000 characters or fewer")
    private String formText;

    private String language;

    public String getFormText() {
        return formText;
    }

    public void setFormText(String formText) {
        this.formText = formText;
    }

    public String getLanguage() {
        return language;
    }

    public void setLanguage(String language) {
        this.language = language;
    }
}