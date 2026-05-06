package com.nqh.authservice.services;

import org.springframework.web.multipart.MultipartFile;

public interface UploadService {

    String uploadAvatar(MultipartFile avatar);
}
