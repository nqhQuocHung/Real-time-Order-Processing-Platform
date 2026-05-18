package com.nqh.inventoryservice.controllers;

import com.nqh.inventoryservice.common.exception.AppException;
import com.nqh.inventoryservice.common.messages.MessageCode;
import com.nqh.inventoryservice.common.response.ApiResponseFactory;
import com.nqh.inventoryservice.common.response.BaseResponse;
import com.nqh.inventoryservice.dtos.CreatePartnerProductRequest;
import com.nqh.inventoryservice.dtos.CreateProductReviewCommentRequest;
import com.nqh.inventoryservice.dtos.CreateProductReviewRequest;
import com.nqh.inventoryservice.dtos.CreateProductCategoryRequest;
import com.nqh.inventoryservice.dtos.InventoryAdjustRequest;
import com.nqh.inventoryservice.dtos.InventoryCheckRequest;
import com.nqh.inventoryservice.dtos.InventoryCheckResponse;
import com.nqh.inventoryservice.dtos.InventoryReservationActionRequest;
import com.nqh.inventoryservice.dtos.InventoryReservationResponse;
import com.nqh.inventoryservice.dtos.InventoryReserveRequest;
import com.nqh.inventoryservice.dtos.InventoryStockResponse;
import com.nqh.inventoryservice.dtos.InventorySummaryResponse;
import com.nqh.inventoryservice.dtos.ProductReviewCommentResponse;
import com.nqh.inventoryservice.dtos.ProductReviewListResponse;
import com.nqh.inventoryservice.dtos.ProductReviewResponse;
import com.nqh.inventoryservice.dtos.ProductReviewStatsResponse;
import com.nqh.inventoryservice.dtos.ProductImageUploadResponse;
import com.nqh.inventoryservice.dtos.ProductCategoryResponse;
import com.nqh.inventoryservice.dtos.UpdatePartnerProductRequest;
import com.nqh.inventoryservice.dtos.UpdateProductReviewRequest;
import com.nqh.inventoryservice.dtos.UpdateProductCategoryRequest;
import com.nqh.inventoryservice.services.InventoryService;
import com.nqh.inventoryservice.services.UploadService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/inventories")
@RequiredArgsConstructor
@Validated
public class InventoryController {

    private final InventoryService inventoryService;
    private final UploadService uploadService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping("/{productId}")
    public ResponseEntity<BaseResponse<InventoryStockResponse>> getStock(
            @PathVariable UUID productId,
            HttpServletRequest httpServletRequest
    ) {
        InventoryStockResponse response = inventoryService.getStock(productId);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.INVENTORY_STOCK_GET_SUCCESS, response, httpServletRequest);
    }

    @GetMapping("/catalog")
    public ResponseEntity<BaseResponse<List<InventoryStockResponse>>> getCatalog(
            HttpServletRequest httpServletRequest
    ) {
        List<InventoryStockResponse> response = inventoryService.getCatalog();
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.COMMON_SUCCESS, response, httpServletRequest);
    }

    @GetMapping("/my-products")
    public ResponseEntity<BaseResponse<List<InventoryStockResponse>>> getMyProducts(
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest httpServletRequest
    ) {
        UUID shopId = UUID.fromString(jwt.getSubject());
        List<InventoryStockResponse> response = inventoryService.getCatalogByShopId(shopId);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.COMMON_SUCCESS, response, httpServletRequest);
    }

    @GetMapping("/products/{productId}/reviews")
    public ResponseEntity<BaseResponse<ProductReviewListResponse>> getProductReviews(
            @PathVariable UUID productId,
            @RequestParam(defaultValue = "latest") String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            HttpServletRequest httpServletRequest
    ) {
        ProductReviewListResponse response = inventoryService.getProductReviews(productId, sort, page, size);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.COMMON_SUCCESS, response, httpServletRequest);
    }

    @GetMapping("/products/{productId}/review-stats")
    public ResponseEntity<BaseResponse<ProductReviewStatsResponse>> getProductReviewStats(
            @PathVariable UUID productId,
            HttpServletRequest httpServletRequest
    ) {
        ProductReviewStatsResponse response = inventoryService.getProductReviewStats(productId);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.COMMON_SUCCESS, response, httpServletRequest);
    }

    @PostMapping("/products/{productId}/reviews")
    public ResponseEntity<BaseResponse<ProductReviewResponse>> createProductReview(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID productId,
            @RequestBody @Valid CreateProductReviewRequest request,
            HttpServletRequest httpServletRequest
    ) {
        UUID userId = UUID.fromString(jwt.getSubject());
        String userName = jwt.getClaimAsString("username");
        ProductReviewResponse response = inventoryService.createProductReview(productId, userId, userName, request);
        return apiResponseFactory.success(HttpStatus.CREATED, MessageCode.INVENTORY_REVIEW_CREATE_SUCCESS, response, httpServletRequest);
    }

    @PutMapping("/reviews/{reviewId}")
    public ResponseEntity<BaseResponse<ProductReviewResponse>> updateProductReview(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID reviewId,
            @RequestBody @Valid UpdateProductReviewRequest request,
            HttpServletRequest httpServletRequest
    ) {
        UUID userId = UUID.fromString(jwt.getSubject());
        String userName = jwt.getClaimAsString("username");
        ProductReviewResponse response = inventoryService.updateProductReview(reviewId, userId, userName, request);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.INVENTORY_REVIEW_UPDATE_SUCCESS, response, httpServletRequest);
    }

    @PostMapping("/reviews/{reviewId}/comments")
    public ResponseEntity<BaseResponse<ProductReviewCommentResponse>> createProductReviewComment(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID reviewId,
            @RequestBody @Valid CreateProductReviewCommentRequest request,
            HttpServletRequest httpServletRequest
    ) {
        UUID userId = UUID.fromString(jwt.getSubject());
        String userName = jwt.getClaimAsString("username");
        ProductReviewCommentResponse response = inventoryService.createProductReviewComment(reviewId, userId, userName, request);
        return apiResponseFactory.success(HttpStatus.CREATED, MessageCode.INVENTORY_REVIEW_COMMENT_CREATE_SUCCESS, response, httpServletRequest);
    }

    @GetMapping("/admin/products")
    public ResponseEntity<BaseResponse<List<InventoryStockResponse>>> getAdminProducts(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) UUID shopId,
            @RequestParam(defaultValue = "true") boolean includeInactive,
            HttpServletRequest httpServletRequest
    ) {
        boolean isAdmin = jwt != null
                && jwt.getClaimAsStringList("roles") != null
                && jwt.getClaimAsStringList("roles").stream().anyMatch("ADMIN"::equalsIgnoreCase);
        ensureAdminAccess(isAdmin);

        List<InventoryStockResponse> response = inventoryService.getAdminProducts(shopId, includeInactive);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.COMMON_SUCCESS, response, httpServletRequest);
    }

    @PostMapping(value = "/products", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<BaseResponse<InventoryStockResponse>> createPartnerProduct(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody @Valid CreatePartnerProductRequest request,
            HttpServletRequest httpServletRequest
    ) {
        boolean isAdmin = jwt != null
                && jwt.getClaimAsStringList("roles") != null
                && jwt.getClaimAsStringList("roles").stream().anyMatch("ADMIN"::equalsIgnoreCase);

        UUID requesterUserId = UUID.fromString(jwt.getSubject());
        InventoryStockResponse response = inventoryService.createPartnerProduct(requesterUserId, isAdmin, request);
        return apiResponseFactory.success(HttpStatus.CREATED, MessageCode.INVENTORY_PRODUCT_CREATE_SUCCESS, response, httpServletRequest);
    }

    @PostMapping(value = "/products", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<BaseResponse<InventoryStockResponse>> createPartnerProductMultipart(
            @AuthenticationPrincipal Jwt jwt,
            @ModelAttribute @Valid CreatePartnerProductRequest request,
            @RequestParam(name = "image", required = false) MultipartFile image,
            HttpServletRequest httpServletRequest
    ) {
        applyUploadedProductImage(request, image);

        boolean isAdmin = jwt != null
                && jwt.getClaimAsStringList("roles") != null
                && jwt.getClaimAsStringList("roles").stream().anyMatch("ADMIN"::equalsIgnoreCase);

        UUID requesterUserId = UUID.fromString(jwt.getSubject());
        InventoryStockResponse response = inventoryService.createPartnerProduct(requesterUserId, isAdmin, request);
        return apiResponseFactory.success(HttpStatus.CREATED, MessageCode.INVENTORY_PRODUCT_CREATE_SUCCESS, response, httpServletRequest);
    }

    @PostMapping(value = "/products/upload-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<BaseResponse<ProductImageUploadResponse>> uploadProductImage(
            @RequestParam("image") MultipartFile image,
            HttpServletRequest httpServletRequest
    ) {
        String imageUrl = uploadService.uploadProductImage(image);
        ProductImageUploadResponse response = ProductImageUploadResponse.builder()
                .imageUrl(imageUrl)
                .defaultImageUsed(Boolean.FALSE)
                .build();
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.INVENTORY_PRODUCT_IMAGE_UPLOAD_SUCCESS, response, httpServletRequest);
    }

    @GetMapping("/categories")
    public ResponseEntity<BaseResponse<List<ProductCategoryResponse>>> getProductCategories(
            HttpServletRequest httpServletRequest
    ) {
        List<ProductCategoryResponse> response = inventoryService.getProductCategories();
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.COMMON_SUCCESS, response, httpServletRequest);
    }

    @PostMapping("/categories")
    public ResponseEntity<BaseResponse<ProductCategoryResponse>> createProductCategory(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody @Valid CreateProductCategoryRequest request,
            HttpServletRequest httpServletRequest
    ) {
        boolean isAdmin = jwt != null
                && jwt.getClaimAsStringList("roles") != null
                && jwt.getClaimAsStringList("roles").stream().anyMatch("ADMIN"::equalsIgnoreCase);
        ensureAdminForCategoryManagement(isAdmin);

        ProductCategoryResponse response = inventoryService.createProductCategory(request);
        return apiResponseFactory.success(HttpStatus.CREATED, MessageCode.INVENTORY_CATEGORY_CREATE_SUCCESS, response, httpServletRequest);
    }

    @PutMapping("/categories/{categoryId}")
    public ResponseEntity<BaseResponse<ProductCategoryResponse>> updateProductCategory(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID categoryId,
            @RequestBody @Valid UpdateProductCategoryRequest request,
            HttpServletRequest httpServletRequest
    ) {
        boolean isAdmin = jwt != null
                && jwt.getClaimAsStringList("roles") != null
                && jwt.getClaimAsStringList("roles").stream().anyMatch("ADMIN"::equalsIgnoreCase);
        ensureAdminForCategoryManagement(isAdmin);

        ProductCategoryResponse response = inventoryService.updateProductCategory(categoryId, request);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.INVENTORY_CATEGORY_UPDATE_SUCCESS, response, httpServletRequest);
    }

    @DeleteMapping("/categories/{categoryId}")
    public ResponseEntity<BaseResponse<ProductCategoryResponse>> deleteProductCategory(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID categoryId,
            HttpServletRequest httpServletRequest
    ) {
        boolean isAdmin = jwt != null
                && jwt.getClaimAsStringList("roles") != null
                && jwt.getClaimAsStringList("roles").stream().anyMatch("ADMIN"::equalsIgnoreCase);
        ensureAdminForCategoryManagement(isAdmin);

        ProductCategoryResponse response = inventoryService.deleteProductCategory(categoryId);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.INVENTORY_CATEGORY_DELETE_SUCCESS, response, httpServletRequest);
    }

    @PutMapping(value = "/products/{productId}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<BaseResponse<InventoryStockResponse>> updatePartnerProduct(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID productId,
            @RequestBody @Valid UpdatePartnerProductRequest request,
            HttpServletRequest httpServletRequest
    ) {
        boolean isAdmin = jwt != null
                && jwt.getClaimAsStringList("roles") != null
                && jwt.getClaimAsStringList("roles").stream().anyMatch("ADMIN"::equalsIgnoreCase);

        UUID requesterUserId = UUID.fromString(jwt.getSubject());
        InventoryStockResponse response = inventoryService.updatePartnerProduct(requesterUserId, isAdmin, productId, request);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.INVENTORY_PRODUCT_UPDATE_SUCCESS, response, httpServletRequest);
    }

    @PutMapping(value = "/products/{productId}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<BaseResponse<InventoryStockResponse>> updatePartnerProductMultipart(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID productId,
            @ModelAttribute @Valid UpdatePartnerProductRequest request,
            @RequestParam(name = "image", required = false) MultipartFile image,
            HttpServletRequest httpServletRequest
    ) {
        applyUploadedProductImage(request, image);

        boolean isAdmin = jwt != null
                && jwt.getClaimAsStringList("roles") != null
                && jwt.getClaimAsStringList("roles").stream().anyMatch("ADMIN"::equalsIgnoreCase);

        UUID requesterUserId = UUID.fromString(jwt.getSubject());
        InventoryStockResponse response = inventoryService.updatePartnerProduct(requesterUserId, isAdmin, productId, request);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.INVENTORY_PRODUCT_UPDATE_SUCCESS, response, httpServletRequest);
    }

    @DeleteMapping("/products/{productId}")
    public ResponseEntity<BaseResponse<InventoryStockResponse>> deletePartnerProduct(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID productId,
            @RequestParam(required = false) UUID shopId,
            HttpServletRequest httpServletRequest
    ) {
        boolean isAdmin = jwt != null
                && jwt.getClaimAsStringList("roles") != null
                && jwt.getClaimAsStringList("roles").stream().anyMatch("ADMIN"::equalsIgnoreCase);

        UUID requesterUserId = UUID.fromString(jwt.getSubject());
        InventoryStockResponse response = inventoryService.deletePartnerProduct(requesterUserId, isAdmin, shopId, productId);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.INVENTORY_PRODUCT_DELETE_SUCCESS, response, httpServletRequest);
    }

    @GetMapping("/summary")
    public ResponseEntity<BaseResponse<InventorySummaryResponse>> getInventorySummary(
            HttpServletRequest httpServletRequest
    ) {
        InventorySummaryResponse response = inventoryService.getInventorySummary();
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.COMMON_SUCCESS, response, httpServletRequest);
    }

    @PostMapping("/check")
    public ResponseEntity<BaseResponse<InventoryCheckResponse>> checkStock(
            @RequestBody @Valid InventoryCheckRequest request,
            HttpServletRequest httpServletRequest
    ) {
        InventoryCheckResponse response = inventoryService.checkStock(request);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.INVENTORY_STOCK_CHECK_SUCCESS, response, httpServletRequest);
    }

    @PostMapping("/reserve")
    public ResponseEntity<BaseResponse<InventoryReservationResponse>> reserveStock(
            @RequestBody @Valid InventoryReserveRequest request,
            HttpServletRequest httpServletRequest
    ) {
        InventoryReservationResponse response = inventoryService.reserveStock(request);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.INVENTORY_STOCK_RESERVE_SUCCESS, response, httpServletRequest);
    }

    @PostMapping("/release")
    public ResponseEntity<BaseResponse<InventoryReservationResponse>> releaseReservation(
            @RequestBody @Valid InventoryReservationActionRequest request,
            HttpServletRequest httpServletRequest
    ) {
        InventoryReservationResponse response = inventoryService.releaseReservation(request);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.INVENTORY_STOCK_RELEASE_SUCCESS, response, httpServletRequest);
    }

    @PostMapping("/confirm-deduct")
    public ResponseEntity<BaseResponse<InventoryReservationResponse>> confirmDeduct(
            @RequestBody @Valid InventoryReservationActionRequest request,
            HttpServletRequest httpServletRequest
    ) {
        InventoryReservationResponse response = inventoryService.confirmDeduct(request);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.INVENTORY_STOCK_COMMIT_SUCCESS, response, httpServletRequest);
    }

    @PostMapping("/adjust")
    public ResponseEntity<BaseResponse<InventoryStockResponse>> adjustStock(
            @RequestBody @Valid InventoryAdjustRequest request,
            HttpServletRequest httpServletRequest
    ) {
        InventoryStockResponse response = inventoryService.adjustStock(request);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.INVENTORY_STOCK_ADJUST_SUCCESS, response, httpServletRequest);
    }

    private void ensureAdminForCategoryManagement(boolean isAdmin) {
        if (!isAdmin) {
            throw new AppException(HttpStatus.FORBIDDEN, MessageCode.COMMON_FORBIDDEN);
        }
    }

    private void ensureAdminAccess(boolean isAdmin) {
        if (!isAdmin) {
            throw new AppException(HttpStatus.FORBIDDEN, MessageCode.COMMON_FORBIDDEN);
        }
    }

    private void applyUploadedProductImage(CreatePartnerProductRequest request, MultipartFile image) {
        if (image == null || image.isEmpty()) {
            return;
        }

        request.setImageUrl(uploadService.uploadProductImage(image));
    }

    private void applyUploadedProductImage(UpdatePartnerProductRequest request, MultipartFile image) {
        if (image == null || image.isEmpty()) {
            return;
        }

        request.setImageUrl(uploadService.uploadProductImage(image));
    }
}
