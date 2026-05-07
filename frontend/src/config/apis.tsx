import axios from 'axios'
import type { AxiosResponse } from 'axios'

const BASE_URL = 'http://localhost:8080'

const endpoints = {
  auth: {
    login: '/api/v1/auth/login',
    register: '/api/v1/auth/register',
    refreshToken: '/api/v1/auth/refresh-token',
    forgotPassword: '/api/v1/auth/forgot-password',
    changePassword: '/api/v1/auth/change-password',
    otpForgotPassword: '/api/v1/auth/otp-forgot-password',
    otpChangePassword: '/api/v1/auth/otp-change-password',
    getUserById: (id: number | string) => `/api/v1/auth/user/${id}`,
    patchUserById: (id: number | string) => `/api/v1/auth/user/${id}`,
    putUserById: (id: number | string) => `/api/v1/auth/user/${id}`,
  },
}

type ApiResponseEnvelope<T> = {
  status?: number
  message?: string
  data: T
}

const apis = (accessToken?: string) => {
  const instance = axios.create({
    baseURL: BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  })

  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response) {
        console.error('Lỗi từ server:', error.response)
      } else if (error.request) {
        console.error('Không nhận được phản hồi từ server:', error.request)
      } else {
        console.error('Lỗi không xác định:', error.message)
      }
      return Promise.reject(error)
    },
  )

  return instance
}

function extractApiData<T>(response: AxiosResponse<ApiResponseEnvelope<T>>): T {
  return response.data.data
}

function extractApiMessage<T>(
  response: AxiosResponse<ApiResponseEnvelope<T>>,
): string {
  return response.data.message || ''
}

export { apis, endpoints, extractApiData, extractApiMessage }
