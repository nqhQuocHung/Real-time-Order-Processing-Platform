package com.nqh.inventoryservice.common.exception;

import com.nqh.inventoryservice.common.messages.MessageCode;
import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public class AppException extends RuntimeException {

    private final HttpStatus status;
    private final MessageCode messageCode;

    public AppException(HttpStatus status, MessageCode messageCode) {
        super(messageCode.getDefaultMessage());
        this.status = status;
        this.messageCode = messageCode;
    }
}
