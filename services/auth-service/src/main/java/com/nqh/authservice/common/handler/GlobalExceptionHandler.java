package com.nqh.authservice.common.handler;

import com.nqh.authservice.common.exception.AppException;
import com.nqh.authservice.common.messages.MessageCode;
import com.nqh.authservice.common.messages.MessageResolver;
import com.nqh.authservice.common.response.BaseResponse;
import com.nqh.authservice.common.response.ValidationError;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import java.util.List;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final String TRACE_HEADER = "X-Correlation-Id";

    private final MessageResolver messageResolver;

    public GlobalExceptionHandler(MessageResolver messageResolver) {
        this.messageResolver = messageResolver;
    }

    @ExceptionHandler(AppException.class)
    public ResponseEntity<BaseResponse<Void>> handleAppException(AppException ex, HttpServletRequest request) {
        Locale locale = request.getLocale();
        String message = messageResolver.get(ex.getMessageCode(), locale, ex.getMessageArgs());
        String traceId = request.getHeader(TRACE_HEADER);

        BaseResponse<Void> response = BaseResponse.error(
                ex.getStatus().value(),
                ex.getMessageCode().name(),
                message,
                traceId,
                null
        );
        return ResponseEntity.status(ex.getStatus()).body(response);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<BaseResponse<Void>> handleValidationException(
            MethodArgumentNotValidException ex,
            HttpServletRequest request
    ) {
        Locale locale = request.getLocale();
        String message = messageResolver.get(MessageCode.COMMON_VALIDATION_ERROR, locale);
        String traceId = request.getHeader(TRACE_HEADER);

        List<ValidationError> errors = ex.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(this::toValidationError)
                .toList();

        BaseResponse<Void> response = BaseResponse.error(
                HttpStatus.BAD_REQUEST.value(),
                MessageCode.COMMON_VALIDATION_ERROR.name(),
                message,
                traceId,
                errors
        );
        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<BaseResponse<Void>> handleConstraintViolationException(
            ConstraintViolationException ex,
            HttpServletRequest request
    ) {
        Locale locale = request.getLocale();
        String message = messageResolver.get(MessageCode.COMMON_VALIDATION_ERROR, locale);
        String traceId = request.getHeader(TRACE_HEADER);

        List<ValidationError> errors = ex.getConstraintViolations()
                .stream()
                .map(violation -> ValidationError.builder()
                        .field(violation.getPropertyPath().toString())
                        .message(violation.getMessage())
                        .build())
                .toList();

        BaseResponse<Void> response = BaseResponse.error(
                HttpStatus.BAD_REQUEST.value(),
                MessageCode.COMMON_VALIDATION_ERROR.name(),
                message,
                traceId,
                errors
        );
        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<BaseResponse<Void>> handleUnreadablePayload(
            HttpMessageNotReadableException ex,
            HttpServletRequest request
    ) {
        Locale locale = request.getLocale();
        String message = messageResolver.get(MessageCode.COMMON_BAD_REQUEST, locale);
        String traceId = request.getHeader(TRACE_HEADER);

        BaseResponse<Void> response = BaseResponse.error(
                HttpStatus.BAD_REQUEST.value(),
                MessageCode.COMMON_BAD_REQUEST.name(),
                message,
                traceId,
                null
        );
        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<BaseResponse<Void>> handleUnhandledException(Exception ex, HttpServletRequest request) {
        Locale locale = request.getLocale();
        String message = messageResolver.get(MessageCode.COMMON_INTERNAL_ERROR, locale);
        String traceId = request.getHeader(TRACE_HEADER);

        BaseResponse<Void> response = BaseResponse.error(
                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                MessageCode.COMMON_INTERNAL_ERROR.name(),
                message,
                traceId,
                null
        );
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }

    private ValidationError toValidationError(FieldError fieldError) {
        return ValidationError.builder()
                .field(fieldError.getField())
                .message(fieldError.getDefaultMessage())
                .build();
    }
}
