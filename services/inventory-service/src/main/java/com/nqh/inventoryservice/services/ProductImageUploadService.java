package com.nqh.inventoryservice.services;

import org.springframework.web.multipart.MultipartFile;

public interface ProductImageUploadService {

    String uploadProductImageOrDefault(MultipartFile image);

    String resolveDefaultProductImageUrl();
}
