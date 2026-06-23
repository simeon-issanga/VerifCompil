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
                    "code_version":"code version n°",
                    "inexecutable":"unachievable",
                    "fileChoice": "import a C/C++ file",
                    "allPasses":"all passes",
                    "modifPasses":"modification passes",
                    "modification":"modification",
                    "previous": "previous",
                    "next": "next",
                    "NoModification":"No modifications",
                    "lines":"lines",
                    "added": "added",
                    "deleted":"deleted",
                    "total":"total"
                }
            },
            fr: {
                translation: {
                    "app-title": "parallele React FR",
                    "title": "Traduction de C vers LLVM - IR",
                    "C_code": "code en C",
                    "IR_code": "code en IR (avant optimisation)",
                    "submit" : "valider",
                    "code_version":"version du code n°",
                    "inexecutable":"inexécutable",
                    "fileChoice":"Choisir un fichier C / C++",
                    "allPasses":"toutes les passes",
                    "modifPasses":"passes de modification",
                    "modification":"modification",
                    "previous": "précédent",
                    "next": "suivant",
                    "NoModification" : "aucune modification",
                    "lines":"lignes",
                    "added": "ajouts",
                    "deleted":"supprimées",
                    "total":"total"
                }
            },
            es: {
                translation: {
                    "app-title": "parallele React ES",
                    "title": "Traducción de C a LLVM-IR",
                    "C_code": "código en C",
                    "IR_code": "código en IR (antes de la optimización)",
                    "submit" : "confirmar",
                    "code_version":"versión del código n°",
                    "inexecutable":"inaplicable",
                    "fileChoice":"importar un fichero C / C++",
                    "allPasses":"todos los passes",
                    "modifPasses":"passes de modificación",
                    "modification":"modificación",
                    "previous": "anterior",
                    "next": "siguiente",
                    "NoModification" : "sin modificaciones",
                    "lines":"lineas",
                    "added": "añadidas",
                    "deleted":"eliminadas",
                    "total":"total"
                }
            }
        }
    });

export default i18n;