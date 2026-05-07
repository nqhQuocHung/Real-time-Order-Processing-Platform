package com.nqh.paymentservice.common.response;

import java.time.LocalDateTime;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BaseResponse<T> {
    private LocalDateTime timestamp;
    private int status;
    private String code;
    private String message;
    private String traceId;
    private T data;
    private List<ValidationError> errors;

    public static <T> BaseResponse<T> success(int status, String code, String message, String traceId, T data) {
        return BaseResponse.<T>builder()
                .timestamp(LocalDateTime.now())
                .status(status)
                .code(code)
                .message(message)
                .traceId(traceId)
                .data(data)
                .build();
    }

    public static BaseResponse<Void> error(
            int status,
            String code,
            String message,
            String traceId,
            List<ValidationError> errors
    ) {
        return BaseResponse.<Void>builder()
                .timestamp(LocalDateTime.now())
                .status(status)
                .code(code)
                .message(message)
                .traceId(traceId)
                .errors(errors)
                .build();
    }
}
