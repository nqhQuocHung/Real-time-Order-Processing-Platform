package com.nqh.authservice.common.exception;

import com.nqh.authservice.common.messages.MessageCode;
import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public class AppException extends RuntimeException {

    private final HttpStatus status;
    private final MessageCode messageCode;
    private final Object[] messageArgs;

    public AppException(HttpStatus status, MessageCode messageCode, Object... messageArgs) {
        super(messageCode.key());
        this.status = status;
        this.messageCode = messageCode;
        this.messageArgs = messageArgs;
    }
}
