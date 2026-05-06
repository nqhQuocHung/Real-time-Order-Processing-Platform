package com.nqh.authservice.common.response;

import com.nqh.authservice.common.messages.MessageCode;
import com.nqh.authservice.common.messages.MessageResolver;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ApiResponseFactory {

    private static final String TRACE_HEADER = "X-Correlation-Id";
    private final MessageResolver messageResolver;

    public <T> ResponseEntity<BaseResponse<T>> success(
            HttpStatus status,
            MessageCode messageCode,
            T data,
            HttpServletRequest request
    ) {
        Locale locale = request.getLocale();
        String message = messageResolver.get(messageCode, locale);
        String traceId = request.getHeader(TRACE_HEADER);

        BaseResponse<T> response = BaseResponse.success(
                status.value(),
                messageCode.name(),
                message,
                traceId,
                data
        );
        return ResponseEntity.status(status).body(response);
    }
}
