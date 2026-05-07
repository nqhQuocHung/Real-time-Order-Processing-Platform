package com.nqh.inventoryservice.pojos;

import com.nqh.inventoryservice.enums.InventoryReservationStatusEnum;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

@Entity
@Table(name = "inventory_reservations", schema = "inventory")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class InventoryReservation extends BasePojo {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @EqualsAndHashCode.Include
    private UUID id;

    @Column(name = "order_code", nullable = false, unique = true, length = 64)
    private String orderCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private InventoryReservationStatusEnum status;

    @Column(name = "actor", length = 120)
    private String actor;

    @Column(name = "note", length = 255)
    private String note;

    @Builder.Default
    @ToString.Exclude
    @OneToMany(mappedBy = "reservation", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<InventoryReservationItem> items = new ArrayList<>();

    public void addItem(InventoryReservationItem item) {
        item.setReservation(this);
        this.items.add(item);
    }
}
