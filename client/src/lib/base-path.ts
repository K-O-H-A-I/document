export const getBasePath = () => {
  const base = import.meta.env.BASE_URL || "/";
  if (base && base !== "/") return base;
  const path = window.location.pathname || "/";
  if (path.startsWith("/document/") || path === "/document") {
    return "/document/";
  }
  return "/";
};
