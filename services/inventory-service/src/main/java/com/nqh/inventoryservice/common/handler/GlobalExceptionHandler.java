package com.nqh.inventoryservice.common.handler;

import com.nqh.inventoryservice.common.exception.AppException;
import com.nqh.inventoryservice.common.messages.MessageCode;
import com.nqh.inventoryservice.common.response.BaseResponse;
import com.nqh.inventoryservice.common.response.ValidationError;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final String TRACE_HEADER = "X-Correlation-Id";
    private static final Logger LOG = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(AppException.class)
    public ResponseEntity<BaseResponse<Void>> handleAppException(AppException ex, HttpServletRequest request) {
        String traceId = request.getHeader(TRACE_HEADER);
        LOG.warn(
                "Handled AppException status={} code={} traceId={} uri={}",
                ex.getStatus().value(),
                ex.getMessageCode().getCode(),
                traceId,
                request.getRequestURI()
        );
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

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<BaseResponse<Void>> handleBadRequest(HttpServletRequest request) {
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

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<BaseResponse<Void>> handleMaxUploadSizeExceeded(
            MaxUploadSizeExceededException ex,
            HttpServletRequest request
    ) {
        String traceId = request.getHeader(TRACE_HEADER);
        LOG.warn(
                "Multipart file too large traceId={} uri={} message={}",
                traceId,
                request.getRequestURI(),
                ex.getMessage()
        );
        BaseResponse<Void> response = BaseResponse.error(
                HttpStatus.BAD_REQUEST.value(),
                MessageCode.INVENTORY_PRODUCT_IMAGE_TOO_LARGE.getCode(),
                MessageCode.INVENTORY_PRODUCT_IMAGE_TOO_LARGE.getDefaultMessage(),
                traceId,
                null
        );
        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<BaseResponse<Void>> handleMultipartException(
            MultipartException ex,
            HttpServletRequest request
    ) {
        String traceId = request.getHeader(TRACE_HEADER);
        LOG.warn(
                "Multipart request error traceId={} uri={} message={}",
                traceId,
                request.getRequestURI(),
                ex.getMessage()
        );
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
    public ResponseEntity<BaseResponse<Void>> handleUnhandledException(
            Exception ex,
            HttpServletRequest request
    ) {
        String traceId = request.getHeader(TRACE_HEADER);
        LOG.error(
                "Unhandled exception traceId={} uri={}",
                traceId,
                request.getRequestURI(),
                ex
        );
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
