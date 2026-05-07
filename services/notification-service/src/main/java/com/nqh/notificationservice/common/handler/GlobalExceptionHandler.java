package com.nqh.notificationservice.common.handler;

import com.nqh.notificationservice.common.exception.AppException;
import com.nqh.notificationservice.common.messages.MessageCode;
import com.nqh.notificationservice.common.response.BaseResponse;
import com.nqh.notificationservice.common.response.ValidationError;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final String TRACE_HEADER = "X-Correlation-Id";

    @ExceptionHandler(AppException.class)
    public ResponseEntity<BaseResponse<Void>> handleAppException(AppException ex, HttpServletRequest request) {
        String traceId = request.getHeader(TRACE_HEADER);
        BaseResponse<Void> response = BaseResponse.error(
                ex.getStatus().value(),
                ex.getMessageCode().getCode(),
                ex.getMessageCode().getDefaultMessage(),
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
        String traceId = request.getHeader(TRACE_HEADER);
        List<ValidationError> errors = ex.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(this::toValidationError)
                .toList();

        BaseResponse<Void> response = BaseResponse.error(
                HttpStatus.BAD_REQUEST.value(),
                MessageCode.COMMON_VALIDATION_ERROR.getCode(),
                MessageCode.COMMON_VALIDATION_ERROR.getDefaultMessage(),
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
                MessageCode.COMMON_VALIDATION_ERROR.getCode(),
                MessageCode.COMMON_VALIDATION_ERROR.getDefaultMessage(),
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
        String traceId = request.getHeader(TRACE_HEADER);
        BaseResponse<Void> response = BaseResponse.error(
                HttpStatus.BAD_REQUEST.value(),
                MessageCode.COMMON_BAD_REQUEST.getCode(),
                MessageCode.COMMON_BAD_REQUEST.getDefaultMessage(),
                traceId,
                null
        );
        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler({MethodArgumentTypeMismatchException.class, MissingServletRequestParameterException.class})
    public ResponseEntity<BaseResponse<Void>> handleArgumentTypeMismatch(HttpServletRequest request) {
        String traceId = request.getHeader(TRACE_HEADER);
        BaseResponse<Void> response = BaseResponse.error(
                HttpStatus.BAD_REQUEST.value(),
                MessageCode.COMMON_BAD_REQUEST.getCode(),
                MessageCode.COMMON_BAD_REQUEST.getDefaultMessage(),
                traceId,
                null
        );
        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<BaseResponse<Void>> handleUnhandledException(Exception ex, HttpServletRequest request) {
        String traceId = request.getHeader(TRACE_HEADER);
        BaseResponse<Void> response = BaseResponse.error(
                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                MessageCode.COMMON_INTERNAL_ERROR.getCode(),
                MessageCode.COMMON_INTERNAL_ERROR.getDefaultMessage(),
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
