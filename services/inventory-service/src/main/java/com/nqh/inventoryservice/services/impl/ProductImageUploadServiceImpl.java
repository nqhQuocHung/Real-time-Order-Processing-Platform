package com.nqh.inventoryservice.services.impl;

import com.cloudinary.Cloudinary;
import com.nqh.inventoryservice.common.exception.AppException;
import com.nqh.inventoryservice.common.messages.MessageCode;
import com.nqh.inventoryservice.services.ProductImageUploadService;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class ProductImageUploadServiceImpl implements ProductImageUploadService {

    private final Cloudinary cloudinary;

    @Value("${app.product.image.max-size-bytes:5242880}")
    private long maxProductImageSizeBytes;

    @Value("${app.product.default-image-url}")
    private String defaultProductImageUrl;

    @Value("${cloudinary.cloudName:}")
    private String cloudinaryCloudName;

    @Value("${cloudinary.apiKey:}")
    private String cloudinaryApiKey;

    @Value("${cloudinary.apiSecret:}")
    private String cloudinaryApiSecret;

    @Override
    public String uploadProductImageOrDefault(MultipartFile image) {
        if (image == null || image.isEmpty()) {
            return resolveDefaultProductImageUrl();
        }

        validateImage(image);
        if (!isCloudinaryConfigured()) {
            return resolveDefaultProductImageUrl();
        }

        try {
            Map<String, Object> options = new HashMap<>();
            options.put("folder", "products");
            options.put("resource_type", "image");

            Map<?, ?> result = cloudinary.uploader().upload(image.getBytes(), options);
            String uploadedImageUrl = (String) result.get("secure_url");
            if (!StringUtils.hasText(uploadedImageUrl)) {
                return resolveDefaultProductImageUrl();
            }
            return uploadedImageUrl;
        } catch (AppException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new AppException(HttpStatus.INTERNAL_SERVER_ERROR, MessageCode.INVENTORY_PRODUCT_IMAGE_UPLOAD_FAILED);
        }
    }

    @Override
    public String resolveDefaultProductImageUrl() {
        return defaultProductImageUrl;
    }

    private void validateImage(MultipartFile image) {
        String contentType = image.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.INVENTORY_PRODUCT_IMAGE_INVALID_TYPE);
        }

        if (image.getSize() > maxProductImageSizeBytes) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.INVENTORY_PRODUCT_IMAGE_TOO_LARGE);
        }
    }

    private boolean isCloudinaryConfigured() {
        return StringUtils.hasText(cloudinaryCloudName)
                && StringUtils.hasText(cloudinaryApiKey)
                && StringUtils.hasText(cloudinaryApiSecret);
    }
}
