package com.nqh.notificationservice.common.response;

import com.nqh.notificationservice.common.messages.MessageCode;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;

@Component
public class ApiResponseFactory {

    private static final String TRACE_HEADER = "X-Correlation-Id";

    public <T> ResponseEntity<BaseResponse<T>> success(
            HttpStatus status,
            MessageCode messageCode,
            T data,
            HttpServletRequest request
    ) {
        String traceId = request.getHeader(TRACE_HEADER);
        BaseResponse<T> response = BaseResponse.success(
                status.value(),
                messageCode.getCode(),
                messageCode.getDefaultMessage(),
                traceId,
                data
        );
        return ResponseEntity.status(status).body(response);
    }
}
