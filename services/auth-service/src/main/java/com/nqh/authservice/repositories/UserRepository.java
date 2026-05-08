package com.nqh.authservice.repositories;

import com.nqh.authservice.enums.UserStatusEnum;
import com.nqh.authservice.pojos.User;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByUsernameIgnoreCaseOrEmailIgnoreCase(String username, String email);

    @EntityGraph(attributePaths = {"roles", "roles.permissions", "roles.menus", "roles.menus.permission"})
    Optional<User> findGraphByUsernameIgnoreCaseOrEmailIgnoreCase(String username, String email);

    @EntityGraph(attributePaths = {"roles", "roles.permissions", "roles.menus", "roles.menus.permission"})
    Optional<User> findGraphById(UUID userId);

    boolean existsByUsernameIgnoreCase(String username);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByPhone(String phone);

    @EntityGraph(attributePaths = {"roles"})
    @Query(
            value = """
                select distinct u
                from User u
                left join u.roles r
                where (:keyword is null
                    or lower(u.username) like lower(concat('%', :keyword, '%'))
                    or lower(u.email) like lower(concat('%', :keyword, '%')))
                  and (:roleCode is null or r.code = :roleCode)
                  and (:status is null or u.status = :status)
                  and (:isActive is null or u.isActive = :isActive)
                """,
            countQuery = """
                select count(distinct u)
                from User u
                left join u.roles r
                where (:keyword is null
                    or lower(u.username) like lower(concat('%', :keyword, '%'))
                    or lower(u.email) like lower(concat('%', :keyword, '%')))
                  and (:roleCode is null or r.code = :roleCode)
                  and (:status is null or u.status = :status)
                  and (:isActive is null or u.isActive = :isActive)
                """
    )
    Page<User> searchUsers(
            @Param("keyword") String keyword,
            @Param("roleCode") String roleCode,
            @Param("status") UserStatusEnum status,
            @Param("isActive") Boolean isActive,
            Pageable pageable
    );

    @Query("""
        select count(distinct u)
        from User u
        join u.roles r
        where r.code = :roleCode
        """)
    long countByRoleCode(@Param("roleCode") String roleCode);

    long countByIsActiveTrue();

    long countByIsActiveFalse();

    long countByStatus(UserStatusEnum status);
}
