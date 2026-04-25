import { useApp } from "../contexts/AppContext";
import { getTranslation, getTranslationValue } from "../data/translations";

const useI18n = () => {
  const { language = "en" } = useApp();
  const translation = getTranslation(language);

  return {
    language,
    direction: translation.direction || "ltr",
    t: (path, fallback = "") => getTranslationValue(language, path, fallback),
  };
};

export default useI18n;
