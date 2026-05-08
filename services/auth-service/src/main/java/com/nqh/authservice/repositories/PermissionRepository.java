package com.nqh.authservice.repositories;

import com.nqh.authservice.pojos.Permission;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PermissionRepository extends JpaRepository<Permission, UUID> {
    Optional<Permission> findByCodeIgnoreCase(String code);

    List<Permission> findAllByOrderByCodeAsc();
}
