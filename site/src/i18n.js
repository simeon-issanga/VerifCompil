import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        fallbackLng: 'fr',
        resources: {
            en: {
                translation: {
                    "app-title": "parallele React EN",
                    "title": "Translation from C to LLVM - IR",
                    "C_code": "C code",
                    "IR_code": "IR code (before optimisation)",
                    "submit" : "submit",
                    "code_version":"code version n°"
                }
            },
            fr: {
                translation: {
                    "app-title": "parallele React FR",
                    "title": "Traduction de C vers LLVM - IR",
                    "C_code": "code en C",
                    "IR_code": "code en IR (avant optimisation)",
                    "submit" : "valider",
                    "code_version":"version du code n°"
                }
            },
            es: {
                translation: {
                    "app-title": "parallele React ES",
                    "title": "Traducción de C a LLVM-IR",
                    "C_code": "código en C",
                    "IR_code": "código en IR (antes de la optimización)",
                    "submit" : "confirmar",
                    "code_version":"versión del código n°"
                }
            }
        }
    });

export default i18n;