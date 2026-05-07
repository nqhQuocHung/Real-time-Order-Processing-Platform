package com.nqh.authservice.dtos;

import com.nqh.authservice.enums.GenderEnum;
import com.nqh.authservice.enums.UserStatusEnum;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateUserRequest {

    @Size(max = 255, message = "Email must be at most 255 characters")
    @Email(message = "Email must be valid")
    private String email;

    @Size(max = 20, message = "Phone must be at most 20 characters")
    @Pattern(regexp = "^[0-9+()\\-\\s]*$", message = "Phone has invalid format")
    private String phone;

    @Size(max = 100, message = "First name must be at most 100 characters")
    private String firstName;

    @Size(max = 100, message = "Last name must be at most 100 characters")
    private String lastName;

    @Size(max = 500, message = "Avatar must be at most 500 characters")
    private String avatar;

    private GenderEnum gender;
    private UserStatusEnum status;
    private Boolean isActive;
    private Boolean emailVerified;
    private List<String> roleCodes;
}
