package com.nqh.authservice.repositories;

import com.nqh.authservice.pojos.Role;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoleRepository extends JpaRepository<Role, UUID> {
    @EntityGraph(attributePaths = {"menus"})
    List<Role> findAllByOrderByCodeAsc();

    @EntityGraph(attributePaths = {"menus"})
    Optional<Role> findGraphByCodeIgnoreCase(String code);

    Optional<Role> findByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCase(String code);
}
