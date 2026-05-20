package com.nqh.paymentservice.pojos;

import com.nqh.paymentservice.enums.PaymentRefundStatusEnum;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
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
@Table(name = "payment_refunds", schema = "payment")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class PaymentRefund extends BasePojo {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @EqualsAndHashCode.Include
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "payment_transaction_id", nullable = false)
    private PaymentTransaction paymentTransaction;

    @Column(name = "order_code", nullable = false, unique = true, length = 64)
    private String orderCode;

    @Column(name = "customer_id", nullable = false)
    private UUID customerId;

    @Column(name = "amount", nullable = false, precision = 19, scale = 2)
    private BigDecimal amount;

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
    private PaymentRefundStatusEnum status;

    @Column(name = "provider_refund_id", length = 120)
    private String providerRefundId;

    @Column(name = "refund_url", columnDefinition = "TEXT")
    private String refundUrl;

    @Column(name = "actor", length = 120)
    private String actor;

    @Column(name = "idempotency_key", nullable = false, unique = true, length = 255)
    private String idempotencyKey;

    @Column(name = "note", length = 255)
    private String note;

    @Column(name = "processed_at")
    private LocalDateTime processedAt;
}
