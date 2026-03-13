export const getBasePath = () => {
  if (import.meta.env.DEV) return "/";
  return "/document/";
};
