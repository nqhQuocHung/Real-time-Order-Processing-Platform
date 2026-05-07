package com.nqh.authservice.repositories;

import com.nqh.authservice.pojos.Menu;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MenuRepository extends JpaRepository<Menu, UUID> {
    Optional<Menu> findByMenuKey(String menuKey);
}
