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
                    "app-title": "from C to LLVM - IR",
                    "title": "Translation from C to LLVM - IR",
                    "C_code": "C code",
                    "IR_code": "IR code (before optimisation)",
                    "submit" : "submit",
                    "code_version":"code version n°",
                    "inexecutable":"unachievable",
                    "fileChoice": "import a C/C++ file",
                    "allPasses":"all passes",
                    "modifPasses":"modification passes",
                    "modification":"modification"
                }
            },
            fr: {
                translation: {
                    "app-title": "C vers LLVM - IR",
                    "title": "Traduction de C vers LLVM - IR",
                    "C_code": "code en C",
                    "IR_code": "code en IR (avant optimisation)",
                    "submit" : "valider",
                    "code_version":"version du code n°",
                    "inexecutable":"inexécutable",
                    "fileChoice":"Choisir un fichier C / C++",
                    "allPasses":"toutes les passes",
                    "modifPasses":"passes de modification",
                    "modification":"modification"
                }
            },
            es: {
                translation: {
                    "app-title": "de C a LLVM-IR",
                    "title": "Traducción de C a LLVM-IR",
                    "C_code": "código en C",
                    "IR_code": "código en IR (antes de la optimización)",
                    "submit" : "confirmar",
                    "code_version":"versión del código n°",
                    "inexecutable":"inaplicable",
                    "fileChoice":"importar un fichero C / C++",
                    "allPasses":"todos los passes",
                    "modifPasses":"passes de modificación",
                    "modification":"modificación"
                }
            }
        }
    });

export default i18n;