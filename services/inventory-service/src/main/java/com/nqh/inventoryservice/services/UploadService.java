package com.nqh.inventoryservice.services;

import org.springframework.web.multipart.MultipartFile;

public interface UploadService {

    String uploadProductImage(MultipartFile image);

    String resolveDefaultProductImageUrl();
}
