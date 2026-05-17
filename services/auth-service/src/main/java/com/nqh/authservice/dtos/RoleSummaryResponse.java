package com.nqh.authservice.dtos;

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
public class RoleSummaryResponse {
    private String code;
    private String name;
    private Boolean isActive;
    private List<String> menuKeys;
}
