import axios from "axios";

const api = axios.create({
  timeout: 10000,
  baseURL: import.meta.env.PROD ? "/api" : import.meta.env.VITE_API_URL || "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.response.use(
  (respuesta) => {
    if (respuesta.config.method === "put" && /\/roles\/\d+\/permisos/.test(respuesta.config.url)) {
      window.dispatchEvent(new Event("permisos-actualizados"));
    }
    return respuesta;
  },
  (error) => {
    if ([401, 403].includes(error.response?.status) && error.config?.url !== "/auth/permisos") {
      window.dispatchEvent(new Event("permisos-actualizados"));
      error.response.data = {
        ...error.response.data,
        mensaje:
          error.response.data?.mensaje ||
          (error.response.status === 403
            ? "No tienes permiso para realizar esta acción."
            : "Tu sesión ha expirado. Inicia sesión nuevamente."),
      };
    }
    return Promise.reject(error);
  },
);

export default api;
