package com.nqh.authservice.repositories;

import com.nqh.authservice.pojos.User;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByUsernameIgnoreCaseOrEmailIgnoreCase(String username, String email);

    @EntityGraph(attributePaths = {"roles", "roles.permissions", "roles.menus", "roles.menus.permission"})
    Optional<User> findGraphByUsernameIgnoreCaseOrEmailIgnoreCase(String username, String email);

    @EntityGraph(attributePaths = {"roles", "roles.permissions", "roles.menus", "roles.menus.permission"})
    Optional<User> findGraphById(UUID userId);

    boolean existsByUsernameIgnoreCase(String username);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByPhone(String phone);
}
