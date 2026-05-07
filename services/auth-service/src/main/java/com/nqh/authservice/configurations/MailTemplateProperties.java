package com.nqh.authservice.configurations;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "mail.template")
public class MailTemplateProperties {

    private Template registerSuccess = new Template();
    private Template accountActivated = new Template();
    private Template accountDeactivated = new Template();
    private Template changePasswordOtp = new Template();
    private Template forgotPasswordOtp = new Template();
    private Template accountLocked = new Template();

    @Getter
    @Setter
    public static class Template {
        private String subject;
        private String body;
    }
}
