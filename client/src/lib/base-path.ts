export const getBasePath = () => {
  const base = import.meta.env.BASE_URL || "/";
  if (base && base !== "/") return base;
  const path = window.location.pathname || "/";
  const segment = path.split("/").filter(Boolean)[0];
  return segment ? `/${segment}/` : "/";
};
