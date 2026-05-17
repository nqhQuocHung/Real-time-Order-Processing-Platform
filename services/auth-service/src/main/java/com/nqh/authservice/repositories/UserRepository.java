package com.nqh.authservice.repositories;

import com.nqh.authservice.enums.UserStatusEnum;
import com.nqh.authservice.pojos.User;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, UUID>, JpaSpecificationExecutor<User> {
    Optional<User> findByUsernameIgnoreCaseOrEmailIgnoreCase(String username, String email);

    @EntityGraph(attributePaths = {"roles", "roles.permissions", "roles.menus", "roles.menus.permission"})
    Optional<User> findGraphByUsernameIgnoreCaseOrEmailIgnoreCase(String username, String email);

    @EntityGraph(attributePaths = {"roles", "roles.permissions", "roles.menus", "roles.menus.permission"})
    Optional<User> findGraphById(UUID userId);

    boolean existsByUsernameIgnoreCase(String username);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByPhone(String phone);

    @Query("""
        select count(distinct u)
        from User u
        join u.roles r
        where upper(r.code) = upper(:roleCode)
        """)
    long countByRoleCode(@Param("roleCode") String roleCode);

    long countByIsActiveTrue();

    long countByIsActiveFalse();

    long countByStatus(UserStatusEnum status);
}
