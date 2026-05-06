package com.nqh.authservice.services;

public interface EmailService {

    void sendHtmlEmail(String to, String subject, String htmlBody);
}
