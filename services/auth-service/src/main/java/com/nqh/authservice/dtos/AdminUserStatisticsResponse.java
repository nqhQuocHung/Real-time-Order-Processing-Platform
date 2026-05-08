package com.nqh.authservice.dtos;

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
public class AdminUserStatisticsResponse {
    private long totalUsers;
    private long totalPartners;
    private long totalActiveUsers;
    private long totalInactiveUsers;
    private long totalPendingUsers;
}
