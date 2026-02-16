import axios from "axios";

//axios 인스턴스. 이후 주소 쓸 때는 api/ 이후 부터 쓰면 됨
const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL}/api/`,
  headers: {
    "Content-Type": "application/json",
  },
});

//요청 인터셉터
api.interceptors.request.use(
  async (config) => {
    // 토큰 갱신 요청은 인터셉터에서 제외 (무한 루프 방지)
    if (config._skipAuthRefresh) {
      return config;
    }

    const accessToken = localStorage.getItem("accessToken");
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => {
    console.log("요청 인터셉터 에러: ", error);
    return Promise.reject(error);
  },
);

//응답 인터셉터 - 401시 토큰 갱신 시도
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // 401 에러이고, 아직 재시도하지 않은 요청일 때
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest._skipAuthRefresh
    ) {
      originalRequest._retry = true;

      const storedRefreshToken = localStorage.getItem("refreshToken");
      if (storedRefreshToken) {
        try {
          // refreshToken으로 새 accessToken 발급 (api 인스턴스 사용하여 프록시 경유)
          const response = await api.post(
            "auth/refresh-token",
            {},
            {
              headers: {
                Authorization: `Bearer ${storedRefreshToken}`,
              },
              _skipAuthRefresh: true,
            },
          );

          const newAccessToken = response.data.accessToken;
          if (newAccessToken) {
            localStorage.setItem("accessToken", newAccessToken);
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return api(originalRequest);
          }
        } catch (refreshError) {
          // 갱신 실패 시 토큰 제거
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          return Promise.reject(refreshError);
        }
      }
    }

    return Promise.reject(error);
  },
);

export default api;
