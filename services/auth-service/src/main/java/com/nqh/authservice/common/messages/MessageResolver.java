package com.nqh.authservice.common.messages;

import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.context.MessageSource;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MessageResolver {

    private final MessageSource messageSource;

    public String get(MessageCode code, Locale locale, Object... args) {
        return messageSource.getMessage(code.key(), args, code.key(), locale);
    }

    public String get(String messageKey, Locale locale, Object... args) {
        return messageSource.getMessage(messageKey, args, messageKey, locale);
    }
}
