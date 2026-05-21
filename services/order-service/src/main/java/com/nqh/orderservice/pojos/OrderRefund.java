package com.nqh.orderservice.pojos;

import com.nqh.orderservice.enums.OrderRefundStatusEnum;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "order_refunds", schema = "orders")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class OrderRefund extends BasePojo {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @EqualsAndHashCode.Include
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false, unique = true)
    private CustomerOrder order;

    @Column(name = "customer_id", nullable = false)
    private UUID customerId;

    @Column(name = "refund_amount", nullable = false, precision = 19, scale = 2)
    private BigDecimal refundAmount;

    @Column(name = "currency", nullable = false, length = 10)
    private String currency;

    @Column(name = "refund_account_name", nullable = false, length = 120)
    private String refundAccountName;

    @Column(name = "refund_account_number", nullable = false, length = 60)
    private String refundAccountNumber;

    @Column(name = "refund_bank_code", nullable = false, length = 40)
    private String refundBankCode;

    @Column(name = "refund_reason", nullable = false, length = 500)
    private String refundReason;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private OrderRefundStatusEnum status;

    @Column(name = "seller_decision_note", length = 255)
    private String sellerDecisionNote;

    @Column(name = "seller_decision_by", length = 120)
    private String sellerDecisionBy;

    @Column(name = "provider_refund_id", length = 120)
    private String providerRefundId;

    @Column(name = "provider_refund_url", columnDefinition = "TEXT")
    private String providerRefundUrl;

    @Column(name = "provider_note", length = 255)
    private String providerNote;

    @Column(name = "processed_at")
    private LocalDateTime processedAt;
}
