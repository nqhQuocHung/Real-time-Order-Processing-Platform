package com.nqh.authservice.repositories;

import com.nqh.authservice.pojos.Menu;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MenuRepository extends JpaRepository<Menu, UUID> {
    Optional<Menu> findByMenuKey(String menuKey);

    Optional<Menu> findByMenuKeyIgnoreCase(String menuKey);

    boolean existsByMenuKeyIgnoreCase(String menuKey);

    boolean existsByPathIgnoreCase(String path);

    boolean existsByMenuKeyIgnoreCaseAndIdNot(String menuKey, UUID id);

    boolean existsByPathIgnoreCaseAndIdNot(String path, UUID id);

    List<Menu> findAllByOrderByDisplayOrderAscMenuKeyAsc();
}
