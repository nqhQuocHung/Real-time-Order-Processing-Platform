package com.nqh.authservice.services.impl;

import com.cloudinary.Cloudinary;
import com.nqh.authservice.common.exception.AppException;
import com.nqh.authservice.common.messages.MessageCode;
import com.nqh.authservice.services.UploadService;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class UploadServiceImpl implements UploadService {

    private final Cloudinary cloudinary;

    @Value("${app.avatar.max-size-bytes:2097152}")
    private long maxAvatarSizeBytes;

    @Override
    public String uploadAvatar(MultipartFile avatar) {
        validateAvatar(avatar);

        try {
            Map<String, Object> options = new HashMap<>();
            options.put("folder", "avatars");
            options.put("resource_type", "image");

            Map<?, ?> result = cloudinary.uploader().upload(avatar.getBytes(), options);
            return (String) result.get("secure_url");
        } catch (Exception ex) {
            throw new AppException(HttpStatus.INTERNAL_SERVER_ERROR, MessageCode.AUTH_AVATAR_UPLOAD_FAILED);
        }
    }

    private void validateAvatar(MultipartFile avatar) {
        if (avatar == null || avatar.isEmpty()) {
            return;
        }

        String contentType = avatar.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.AUTH_AVATAR_INVALID_TYPE);
        }

        if (avatar.getSize() > maxAvatarSizeBytes) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.AUTH_AVATAR_TOO_LARGE);
        }
    }
}
