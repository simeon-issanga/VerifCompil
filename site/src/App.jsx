import { useEffect, useRef, useState } from "react"
import './App.css'
import Editor from "./Editor"
import { EditorState, RangeSetBuilder, Compartment } from "@codemirror/state"
import { EditorView, keymap, lineNumbers, Decoration, ViewPlugin } from "@codemirror/view"
import { defaultKeymap, historyKeymap, history } from "@codemirror/commands"
import { cpp } from "@codemirror/lang-cpp"
import { irLanguage, irHighlight } from "./IRLanguage"
import { tags } from "@lezer/highlight"
import { StreamLanguage, HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { createLineHoverHighlighter, createLineDiffHiglighter, lineClickHandler, requestUpdateLines } from "./lineClickHandler"
import { useTranslation } from 'react-i18next';
import i18n from './i18n.js'


const inputHighlighterCompartment = new Compartment();
const outputHighlighterCompartment = new Compartment();
const previousPassHighlighterCompartment = new Compartment();
const nextPassHighlighterCompartment = new Compartment();

let niveau_optimisation = 0;

export default function App() {

  //gestion des langues
  const { t, i18n } = useTranslation(); //pour la traduction
  const [language, setLanguage] = useState(i18n.language ?? 'fr');
  const handleLanguageChange = (event) => {
    const nextLang = event.target.value;
    setLanguage(nextLang);
    i18n.changeLanguage(nextLang);
  };

  // useRef : persiste entre les rendus et ne déclenche aucun re-rendu, banger non ?!
  const inputRef = useRef(null)   // view de l'éditeur source
  const outputRef = useRef(null)   // view de l'éditeur output
  const previousPass = useRef(null); // view de l'éditeur previousPass
  const nextPass = useRef(null); // view de l'éditeur nextPass

  const reponseIA = useRef(null); //Ensemble des données affichées
  const passesModifiees = useRef([[],[],[]],[]); //indices des diff sans changements

  const [explications, setExplications] = useState('');
  const [currentPass, setCurrentPass] = useState(0);
  const [message, setMessage] = useState('');
  const [nbPasses, setNbPasses] = useState(0);

  useEffect(() => {//TEST de données pour reponseIA
    const donnees = {
      "liste_c": [
        "int main() {",
        "printf(\"Hello, world!\\n\");",
        "return 0;"
      ],
      "liste_diffsO0": [
        " ",//TODO en attente de Sim pour le 1er diff
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_01.ll\t2026-06-01 07:22:13.308794510 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_02.ll\t2026-06-01 07:22:13.308794510 +0000\n@@ -1,11 +1,4 @@\n-*** IR Dump After AlwaysInlinerPass on [module] ***\n-; ModuleID = 'fichier.c'\n-source_filename = \"fichier.c\"\n-target datalayout = \"e-m:e-p270:32:32-p271:32:32-p272:64:64-i64:64-f80:128-n8:16:32:64-S128\"\n-target triple = \"x86_64-pc-linux-gnu\"\n-\n-@.str = private unnamed_addr constant [15 x i8] c\"Hello, world!\\0A\\00\", align 1\n-\n+*** IR Dump After CoroEarlyPass on main ***\n ; Function Attrs: noinline nounwind optnone uwtable\n define dso_local i32 @main() #0 {\n   %1 = alloca i32, align 4\n@@ -13,18 +6,3 @@\n   %2 = call i32 (i8*, ...) @printf(i8* noundef getelementptr inbounds ([15 x i8], [15 x i8]* @.str, i64 0, i64 0))\n   ret i32 0\n }\n-\n-declare i32 @printf(i8* noundef, ...) #1\n-\n-attributes #0 = { noinline nounwind optnone uwtable \"frame-pointer\"=\"all\" \"min-legal-vector-width\"=\"0\" \"no-trapping-math\"=\"true\" \"stack-protector-buffer-size\"=\"8\" \"target-cpu\"=\"x86-64\" \"target-features\"=\"+cx8,+fxsr,+mmx,+sse,+sse2,+x87\" \"tune-cpu\"=\"generic\" }\n-attributes #1 = { \"frame-pointer\"=\"all\" \"no-trapping-math\"=\"true\" \"stack-protector-buffer-size\"=\"8\" \"target-cpu\"=\"x86-64\" \"target-features\"=\"+cx8,+fxsr,+mmx,+sse,+sse2,+x87\" \"tune-cpu\"=\"generic\" }\n-\n-!llvm.module.flags = !{!0, !1, !2, !3, !4}\n-!llvm.ident = !{!5}\n-\n-!0 = !{i32 1, !\"wchar_size\", i32 4}\n-!1 = !{i32 7, !\"PIC Level\", i32 2}\n-!2 = !{i32 7, !\"PIE Level\", i32 2}\n-!3 = !{i32 7, !\"uwtable\", i32 1}\n-!4 = !{i32 7, !\"frame-pointer\", i32 2}\n-!5 = !{!\"Debian clang version 14.0.6\"}\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_02.ll\t2026-06-01 07:22:13.308794510 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_03.ll\t2026-06-01 07:22:13.309794504 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After CoroEarlyPass on main ***\n+*** IR Dump After CoroSplitPass on (main) ***\n ; Function Attrs: noinline nounwind optnone uwtable\n define dso_local i32 @main() #0 {\n   %1 = alloca i32, align 4\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_03.ll\t2026-06-01 07:22:13.309794504 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_04.ll\t2026-06-01 07:22:13.310794497 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After CoroSplitPass on (main) ***\n+*** IR Dump After CoroCleanupPass on main ***\n ; Function Attrs: noinline nounwind optnone uwtable\n define dso_local i32 @main() #0 {\n   %1 = alloca i32, align 4\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_04.ll\t2026-06-01 07:22:13.310794497 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_05.ll\t2026-06-01 07:22:13.311794491 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After CoroCleanupPass on main ***\n+*** IR Dump After AnnotationRemarksPass on main ***\n ; Function Attrs: noinline nounwind optnone uwtable\n define dso_local i32 @main() #0 {\n   %1 = alloca i32, align 4\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_05.ll\t2026-06-01 07:22:13.311794491 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_06.ll\t2026-06-01 07:22:13.312794484 +0000\n@@ -1,4 +1,11 @@\n-*** IR Dump After AnnotationRemarksPass on main ***\n+*** IR Dump After Pre-ISel Intrinsic Lowering (pre-isel-intrinsic-lowering) ***\n+; ModuleID = 'fichier.c'\n+source_filename = \"fichier.c\"\n+target datalayout = \"e-m:e-p270:32:32-p271:32:32-p272:64:64-i64:64-f80:128-n8:16:32:64-S128\"\n+target triple = \"x86_64-pc-linux-gnu\"\n+\n+@.str = private unnamed_addr constant [15 x i8] c\"Hello, world!\\0A\\00\", align 1\n+\n ; Function Attrs: noinline nounwind optnone uwtable\n define dso_local i32 @main() #0 {\n   %1 = alloca i32, align 4\n@@ -6,3 +13,18 @@\n   %2 = call i32 (i8*, ...) @printf(i8* noundef getelementptr inbounds ([15 x i8], [15 x i8]* @.str, i64 0, i64 0))\n   ret i32 0\n }\n+\n+declare i32 @printf(i8* noundef, ...) #1\n+\n+attributes #0 = { noinline nounwind optnone uwtable \"frame-pointer\"=\"all\" \"min-legal-vector-width\"=\"0\" \"no-trapping-math\"=\"true\" \"stack-protector-buffer-size\"=\"8\" \"target-cpu\"=\"x86-64\" \"target-features\"=\"+cx8,+fxsr,+mmx,+sse,+sse2,+x87\" \"tune-cpu\"=\"generic\" }\n+attributes #1 = { \"frame-pointer\"=\"all\" \"no-trapping-math\"=\"true\" \"stack-protector-buffer-size\"=\"8\" \"target-cpu\"=\"x86-64\" \"target-features\"=\"+cx8,+fxsr,+mmx,+sse,+sse2,+x87\" \"tune-cpu\"=\"generic\" }\n+\n+!llvm.module.flags = !{!0, !1, !2, !3, !4}\n+!llvm.ident = !{!5}\n+\n+!0 = !{i32 1, !\"wchar_size\", i32 4}\n+!1 = !{i32 7, !\"PIC Level\", i32 2}\n+!2 = !{i32 7, !\"PIE Level\", i32 2}\n+!3 = !{i32 7, !\"uwtable\", i32 1}\n+!4 = !{i32 7, !\"frame-pointer\", i32 2}\n+!5 = !{!\"Debian clang version 14.0.6\"}\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_06.ll\t2026-06-01 07:22:13.312794484 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_07.ll\t2026-06-01 07:22:13.314794470 +0000\n@@ -1,11 +1,4 @@\n-*** IR Dump After Pre-ISel Intrinsic Lowering (pre-isel-intrinsic-lowering) ***\n-; ModuleID = 'fichier.c'\n-source_filename = \"fichier.c\"\n-target datalayout = \"e-m:e-p270:32:32-p271:32:32-p272:64:64-i64:64-f80:128-n8:16:32:64-S128\"\n-target triple = \"x86_64-pc-linux-gnu\"\n-\n-@.str = private unnamed_addr constant [15 x i8] c\"Hello, world!\\0A\\00\", align 1\n-\n+*** IR Dump After Expand Atomic instructions (atomic-expand) ***\n ; Function Attrs: noinline nounwind optnone uwtable\n define dso_local i32 @main() #0 {\n   %1 = alloca i32, align 4\n@@ -13,18 +6,3 @@\n   %2 = call i32 (i8*, ...) @printf(i8* noundef getelementptr inbounds ([15 x i8], [15 x i8]* @.str, i64 0, i64 0))\n   ret i32 0\n }\n-\n-declare i32 @printf(i8* noundef, ...) #1\n-\n-attributes #0 = { noinline nounwind optnone uwtable \"frame-pointer\"=\"all\" \"min-legal-vector-width\"=\"0\" \"no-trapping-math\"=\"true\" \"stack-protector-buffer-size\"=\"8\" \"target-cpu\"=\"x86-64\" \"target-features\"=\"+cx8,+fxsr,+mmx,+sse,+sse2,+x87\" \"tune-cpu\"=\"generic\" }\n-attributes #1 = { \"frame-pointer\"=\"all\" \"no-trapping-math\"=\"true\" \"stack-protector-buffer-size\"=\"8\" \"target-cpu\"=\"x86-64\" \"target-features\"=\"+cx8,+fxsr,+mmx,+sse,+sse2,+x87\" \"tune-cpu\"=\"generic\" }\n-\n-!llvm.module.flags = !{!0, !1, !2, !3, !4}\n-!llvm.ident = !{!5}\n-\n-!0 = !{i32 1, !\"wchar_size\", i32 4}\n-!1 = !{i32 7, !\"PIC Level\", i32 2}\n-!2 = !{i32 7, !\"PIE Level\", i32 2}\n-!3 = !{i32 7, !\"uwtable\", i32 1}\n-!4 = !{i32 7, !\"frame-pointer\", i32 2}\n-!5 = !{!\"Debian clang version 14.0.6\"}\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_07.ll\t2026-06-01 07:22:13.314794470 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_08.ll\t2026-06-01 07:22:13.315794464 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After Expand Atomic instructions (atomic-expand) ***\n+*** IR Dump After Lower AMX intrinsics (lower-amx-intrinsics) ***\n ; Function Attrs: noinline nounwind optnone uwtable\n define dso_local i32 @main() #0 {\n   %1 = alloca i32, align 4\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_08.ll\t2026-06-01 07:22:13.315794464 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_09.ll\t2026-06-01 07:22:13.316794458 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After Lower AMX intrinsics (lower-amx-intrinsics) ***\n+*** IR Dump After Lower AMX type for load/store (lower-amx-type) ***\n ; Function Attrs: noinline nounwind optnone uwtable\n define dso_local i32 @main() #0 {\n   %1 = alloca i32, align 4\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_09.ll\t2026-06-01 07:22:13.316794458 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_10.ll\t2026-06-01 07:22:13.317794451 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After Lower AMX type for load/store (lower-amx-type) ***\n+*** IR Dump After Pre AMX Tile Config (pre-amx-config) ***\n ; Function Attrs: noinline nounwind optnone uwtable\n define dso_local i32 @main() #0 {\n   %1 = alloca i32, align 4\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_10.ll\t2026-06-01 07:22:13.317794451 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_11.ll\t2026-06-01 07:22:13.318794444 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After Pre AMX Tile Config (pre-amx-config) ***\n+*** IR Dump After Lower Garbage Collection Instructions (gc-lowering) ***\n ; Function Attrs: noinline nounwind optnone uwtable\n define dso_local i32 @main() #0 {\n   %1 = alloca i32, align 4\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_11.ll\t2026-06-01 07:22:13.318794444 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_12.ll\t2026-06-01 07:22:13.319794437 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After Lower Garbage Collection Instructions (gc-lowering) ***\n+*** IR Dump After Shadow Stack GC Lowering (shadow-stack-gc-lowering) ***\n ; Function Attrs: noinline nounwind optnone uwtable\n define dso_local i32 @main() #0 {\n   %1 = alloca i32, align 4\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_12.ll\t2026-06-01 07:22:13.319794437 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_13.ll\t2026-06-01 07:22:13.320794431 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After Shadow Stack GC Lowering (shadow-stack-gc-lowering) ***\n+*** IR Dump After Lower constant intrinsics (lower-constant-intrinsics) ***\n ; Function Attrs: noinline nounwind optnone uwtable\n define dso_local i32 @main() #0 {\n   %1 = alloca i32, align 4\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_13.ll\t2026-06-01 07:22:13.320794431 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_14.ll\t2026-06-01 07:22:13.321794424 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After Lower constant intrinsics (lower-constant-intrinsics) ***\n+*** IR Dump After Remove unreachable blocks from the CFG (unreachableblockelim) ***\n ; Function Attrs: noinline nounwind optnone uwtable\n define dso_local i32 @main() #0 {\n   %1 = alloca i32, align 4\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_14.ll\t2026-06-01 07:22:13.321794424 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_15.ll\t2026-06-01 07:22:13.322794418 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After Remove unreachable blocks from the CFG (unreachableblockelim) ***\n+*** IR Dump After Expand vector predication intrinsics (expandvp) ***\n ; Function Attrs: noinline nounwind optnone uwtable\n define dso_local i32 @main() #0 {\n   %1 = alloca i32, align 4\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_15.ll\t2026-06-01 07:22:13.322794418 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_16.ll\t2026-06-01 07:22:13.323794411 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After Expand vector predication intrinsics (expandvp) ***\n+*** IR Dump After Scalarize Masked Memory Intrinsics (scalarize-masked-mem-intrin) ***\n ; Function Attrs: noinline nounwind optnone uwtable\n define dso_local i32 @main() #0 {\n   %1 = alloca i32, align 4\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_16.ll\t2026-06-01 07:22:13.323794411 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_17.ll\t2026-06-01 07:22:13.324794405 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After Scalarize Masked Memory Intrinsics (scalarize-masked-mem-intrin) ***\n+*** IR Dump After Expand reduction intrinsics (expand-reductions) ***\n ; Function Attrs: noinline nounwind optnone uwtable\n define dso_local i32 @main() #0 {\n   %1 = alloca i32, align 4\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_17.ll\t2026-06-01 07:22:13.324794405 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_18.ll\t2026-06-01 07:22:13.326794391 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After Expand reduction intrinsics (expand-reductions) ***\n+*** IR Dump After Expand indirectbr instructions (indirectbr-expand) ***\n ; Function Attrs: noinline nounwind optnone uwtable\n define dso_local i32 @main() #0 {\n   %1 = alloca i32, align 4\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_18.ll\t2026-06-01 07:22:13.326794391 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_19.ll\t2026-06-01 07:22:13.327794384 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After Expand indirectbr instructions (indirectbr-expand) ***\n+*** IR Dump After Exception handling preparation (dwarfehprepare) ***\n ; Function Attrs: noinline nounwind optnone uwtable\n define dso_local i32 @main() #0 {\n   %1 = alloca i32, align 4\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_19.ll\t2026-06-01 07:22:13.327794384 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_20.ll\t2026-06-01 07:22:13.328794378 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After Exception handling preparation (dwarfehprepare) ***\n+*** IR Dump After Safe Stack instrumentation pass (safe-stack) ***\n ; Function Attrs: noinline nounwind optnone uwtable\n define dso_local i32 @main() #0 {\n   %1 = alloca i32, align 4\n@@ -6,3 +6,4 @@\n   %2 = call i32 (i8*, ...) @printf(i8* noundef getelementptr inbounds ([15 x i8], [15 x i8]* @.str, i64 0, i64 0))\n   ret i32 0\n }\n+# \n\\ No newline at end of file\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_20.ll\t2026-06-01 07:22:13.328794378 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_21.ll\t2026-06-01 07:22:13.329794371 +0000\n@@ -1,9 +1,21 @@\n-*** IR Dump After Safe Stack instrumentation pass (safe-stack) ***\n-; Function Attrs: noinline nounwind optnone uwtable\n-define dso_local i32 @main() #0 {\n-  %1 = alloca i32, align 4\n-  store i32 0, i32* %1, align 4\n-  %2 = call i32 (i8*, ...) @printf(i8* noundef getelementptr inbounds ([15 x i8], [15 x i8]* @.str, i64 0, i64 0))\n-  ret i32 0\n-}\n+*** IR Dump After X86 DAG->DAG Instruction Selection (amdgpu-isel) ***:\n+# Machine code for function main: IsSSA, TracksLiveness\n+Frame Objects:\n+  fi#0: size=4, align=4, at location [SP+8]\n+\n+bb.0 (%ir-block.0):\n+  MOV32mi %stack.0, 1, $noreg, 0, $noreg, 0 :: (store (s32) into %ir.1)\n+  %1:gr64 = LEA64r $rip, 1, $noreg, @.str, $noreg\n+  ADJCALLSTACKDOWN64 0, 0, 0, implicit-def $rsp, implicit-def $eflags, implicit-def $ssp, implicit $rsp, implicit $ssp\n+  $rdi = COPY %1:gr64\n+  $al = MOV8ri 0\n+  CALL64pcrel32 target-flags(x86-plt) @printf, <regmask $bh $bl $bp $bph $bpl $bx $ebp $ebx $hbp $hbx $rbp $rbx $r12 $r13 $r14 $r15 $r12b $r13b $r14b $r15b $r12bh $r13bh $r14bh $r15bh $r12d $r13d $r14d $r15d $r12w $r13w $r14w $r15w $r12wh and 3 more...>, implicit $rsp, implicit $ssp, implicit $al, implicit $rdi, implicit-def $eax\n+  ADJCALLSTACKUP64 0, 0, implicit-def $rsp, implicit-def $eflags, implicit-def $ssp, implicit $rsp, implicit $ssp\n+  %2:gr32 = COPY $eax\n+  %0:gr32 = MOV32r0 implicit-def $eflags\n+  $eax = COPY %0:gr32\n+  RET64 implicit $eax\n+\n+# End machine code for function main.\n+\n # \n\\ No newline at end of file\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_21.ll\t2026-06-01 07:22:13.329794371 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_22.ll\t2026-06-01 07:22:13.330794365 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After X86 DAG->DAG Instruction Selection (amdgpu-isel) ***:\n+*** IR Dump After Finalize ISel and expand pseudo-instructions (finalize-isel) ***:\n # Machine code for function main: IsSSA, TracksLiveness\n Frame Objects:\n   fi#0: size=4, align=4, at location [SP+8]\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_22.ll\t2026-06-01 07:22:13.330794365 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_23.ll\t2026-06-01 07:22:13.331794358 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After Finalize ISel and expand pseudo-instructions (finalize-isel) ***:\n+*** IR Dump After Local Stack Slot Allocation (localstackalloc) ***:\n # Machine code for function main: IsSSA, TracksLiveness\n Frame Objects:\n   fi#0: size=4, align=4, at location [SP+8]\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_23.ll\t2026-06-01 07:22:13.331794358 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_24.ll\t2026-06-01 07:22:13.332794352 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After Local Stack Slot Allocation (localstackalloc) ***:\n+*** IR Dump After X86 speculative load hardening (x86-slh) ***:\n # Machine code for function main: IsSSA, TracksLiveness\n Frame Objects:\n   fi#0: size=4, align=4, at location [SP+8]\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_24.ll\t2026-06-01 07:22:13.332794352 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_25.ll\t2026-06-01 07:22:13.333794345 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After X86 speculative load hardening (x86-slh) ***:\n+*** IR Dump After X86 EFLAGS copy lowering (x86-flags-copy-lowering) ***:\n # Machine code for function main: IsSSA, TracksLiveness\n Frame Objects:\n   fi#0: size=4, align=4, at location [SP+8]\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_25.ll\t2026-06-01 07:22:13.333794345 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_26.ll\t2026-06-01 07:22:13.334794338 +0000\n@@ -1,5 +1,5 @@\n-*** IR Dump After X86 EFLAGS copy lowering (x86-flags-copy-lowering) ***:\n-# Machine code for function main: IsSSA, TracksLiveness\n+*** IR Dump After Eliminate PHI nodes for register allocation (phi-node-elimination) ***:\n+# Machine code for function main: NoPHIs, TracksLiveness\n Frame Objects:\n   fi#0: size=4, align=4, at location [SP+8]\n \n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_26.ll\t2026-06-01 07:22:13.334794338 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_27.ll\t2026-06-01 07:22:13.335794331 +0000\n@@ -1,5 +1,5 @@\n-*** IR Dump After Eliminate PHI nodes for register allocation (phi-node-elimination) ***:\n-# Machine code for function main: NoPHIs, TracksLiveness\n+*** IR Dump After Two-Address instruction pass (twoaddressinstruction) ***:\n+# Machine code for function main: NoPHIs, TracksLiveness, TiedOpsRewritten\n Frame Objects:\n   fi#0: size=4, align=4, at location [SP+8]\n \n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_27.ll\t2026-06-01 07:22:13.335794331 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_28.ll\t2026-06-01 07:22:13.336794325 +0000\n@@ -1,20 +1,17 @@\n-*** IR Dump After Two-Address instruction pass (twoaddressinstruction) ***:\n-# Machine code for function main: NoPHIs, TracksLiveness, TiedOpsRewritten\n+*** IR Dump After Fast Register Allocator (regallocfast) ***:\n+# Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\n Frame Objects:\n   fi#0: size=4, align=4, at location [SP+8]\n \n bb.0 (%ir-block.0):\n   MOV32mi %stack.0, 1, $noreg, 0, $noreg, 0 :: (store (s32) into %ir.1)\n-  %1:gr64 = LEA64r $rip, 1, $noreg, @.str, $noreg\n-  ADJCALLSTACKDOWN64 0, 0, 0, implicit-def $rsp, implicit-def $eflags, implicit-def $ssp, implicit $rsp, implicit $ssp\n-  $rdi = COPY %1:gr64\n+  renamable $rdi = LEA64r $rip, 1, $noreg, @.str, $noreg\n+  ADJCALLSTACKDOWN64 0, 0, 0, implicit-def $rsp, implicit-def dead $eflags, implicit-def $ssp, implicit $rsp, implicit $ssp\n   $al = MOV8ri 0\n-  CALL64pcrel32 target-flags(x86-plt) @printf, <regmask $bh $bl $bp $bph $bpl $bx $ebp $ebx $hbp $hbx $rbp $rbx $r12 $r13 $r14 $r15 $r12b $r13b $r14b $r15b $r12bh $r13bh $r14bh $r15bh $r12d $r13d $r14d $r15d $r12w $r13w $r14w $r15w $r12wh and 3 more...>, implicit $rsp, implicit $ssp, implicit $al, implicit $rdi, implicit-def $eax\n-  ADJCALLSTACKUP64 0, 0, implicit-def $rsp, implicit-def $eflags, implicit-def $ssp, implicit $rsp, implicit $ssp\n-  %2:gr32 = COPY $eax\n-  %0:gr32 = MOV32r0 implicit-def $eflags\n-  $eax = COPY %0:gr32\n-  RET64 implicit $eax\n+  CALL64pcrel32 target-flags(x86-plt) @printf, <regmask $bh $bl $bp $bph $bpl $bx $ebp $ebx $hbp $hbx $rbp $rbx $r12 $r13 $r14 $r15 $r12b $r13b $r14b $r15b $r12bh $r13bh $r14bh $r15bh $r12d $r13d $r14d $r15d $r12w $r13w $r14w $r15w $r12wh and 3 more...>, implicit $rsp, implicit $ssp, implicit killed $al, implicit killed $rdi, implicit-def $eax\n+  ADJCALLSTACKUP64 0, 0, implicit-def $rsp, implicit-def dead $eflags, implicit-def $ssp, implicit $rsp, implicit $ssp\n+  renamable $eax = MOV32r0 implicit-def dead $eflags\n+  RET64 implicit killed $eax\n \n # End machine code for function main.\n \n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_28.ll\t2026-06-01 07:22:13.336794325 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_29.ll\t2026-06-01 07:22:13.337794318 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After Fast Register Allocator (regallocfast) ***:\n+*** IR Dump After Fast Tile Register Configure (fasttileconfig) ***:\n # Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\n Frame Objects:\n   fi#0: size=4, align=4, at location [SP+8]\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_29.ll\t2026-06-01 07:22:13.337794318 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_30.ll\t2026-06-01 07:22:13.339794305 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After Fast Tile Register Configure (fasttileconfig) ***:\n+*** IR Dump After X86 Lower Tile Copy (lowertilecopy) ***:\n # Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\n Frame Objects:\n   fi#0: size=4, align=4, at location [SP+8]\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_30.ll\t2026-06-01 07:22:13.339794305 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_31.ll\t2026-06-01 07:22:13.340794299 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After X86 Lower Tile Copy (lowertilecopy) ***:\n+*** IR Dump After X86 FP Stackifier (x86-codegen) ***:\n # Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\n Frame Objects:\n   fi#0: size=4, align=4, at location [SP+8]\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_31.ll\t2026-06-01 07:22:13.340794299 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_32.ll\t2026-06-01 07:22:13.341794292 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After X86 FP Stackifier (x86-codegen) ***:\n+*** IR Dump After Remove Redundant DEBUG_VALUE analysis (removeredundantdebugvalues) ***:\n # Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\n Frame Objects:\n   fi#0: size=4, align=4, at location [SP+8]\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_32.ll\t2026-06-01 07:22:13.341794292 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_33.ll\t2026-06-01 07:22:13.342794285 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After Remove Redundant DEBUG_VALUE analysis (removeredundantdebugvalues) ***:\n+*** IR Dump After Fixup Statepoint Caller Saved (fixup-statepoint-caller-saved) ***:\n # Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\n Frame Objects:\n   fi#0: size=4, align=4, at location [SP+8]\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_33.ll\t2026-06-01 07:22:13.342794285 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_34.ll\t2026-06-01 07:22:13.343794278 +0000\n@@ -1,16 +1,24 @@\n-*** IR Dump After Fixup Statepoint Caller Saved (fixup-statepoint-caller-saved) ***:\n+*** IR Dump After Prologue/Epilogue Insertion & Frame Finalization (prologepilog) ***:\n # Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\n Frame Objects:\n-  fi#0: size=4, align=4, at location [SP+8]\n+  fi#-1: size=8, align=16, fixed, at location [SP-8]\n+  fi#0: size=4, align=4, at location [SP-12]\n \n bb.0 (%ir-block.0):\n-  MOV32mi %stack.0, 1, $noreg, 0, $noreg, 0 :: (store (s32) into %ir.1)\n+  frame-setup PUSH64r killed $rbp, implicit-def $rsp, implicit $rsp\n+  CFI_INSTRUCTION def_cfa_offset 16\n+  CFI_INSTRUCTION offset $rbp, -16\n+  $rbp = frame-setup MOV64rr $rsp\n+  CFI_INSTRUCTION def_cfa_register $rbp\n+  $rsp = frame-setup SUB64ri8 $rsp(tied-def 0), 16, implicit-def dead $eflags\n+  MOV32mi $rbp, 1, $noreg, -4, $noreg, 0 :: (store (s32) into %ir.1)\n   renamable $rdi = LEA64r $rip, 1, $noreg, @.str, $noreg\n-  ADJCALLSTACKDOWN64 0, 0, 0, implicit-def $rsp, implicit-def dead $eflags, implicit-def $ssp, implicit $rsp, implicit $ssp\n   $al = MOV8ri 0\n   CALL64pcrel32 target-flags(x86-plt) @printf, <regmask $bh $bl $bp $bph $bpl $bx $ebp $ebx $hbp $hbx $rbp $rbx $r12 $r13 $r14 $r15 $r12b $r13b $r14b $r15b $r12bh $r13bh $r14bh $r15bh $r12d $r13d $r14d $r15d $r12w $r13w $r14w $r15w $r12wh and 3 more...>, implicit $rsp, implicit $ssp, implicit killed $al, implicit killed $rdi, implicit-def $eax\n-  ADJCALLSTACKUP64 0, 0, implicit-def $rsp, implicit-def dead $eflags, implicit-def $ssp, implicit $rsp, implicit $ssp\n   renamable $eax = MOV32r0 implicit-def dead $eflags\n+  $rsp = frame-destroy ADD64ri8 $rsp(tied-def 0), 16, implicit-def dead $eflags\n+  $rbp = frame-destroy POP64r implicit-def $rsp, implicit $rsp\n+  CFI_INSTRUCTION def_cfa $rsp, 8\n   RET64 implicit killed $eax\n \n # End machine code for function main.\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_34.ll\t2026-06-01 07:22:13.343794278 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_35.ll\t2026-06-01 07:22:13.344794272 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After Prologue/Epilogue Insertion & Frame Finalization (prologepilog) ***:\n+*** IR Dump After Post-RA pseudo instruction expansion pass (postrapseudos) ***:\n # Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\n Frame Objects:\n   fi#-1: size=8, align=16, fixed, at location [SP-8]\n@@ -15,7 +15,7 @@\n   renamable $rdi = LEA64r $rip, 1, $noreg, @.str, $noreg\n   $al = MOV8ri 0\n   CALL64pcrel32 target-flags(x86-plt) @printf, <regmask $bh $bl $bp $bph $bpl $bx $ebp $ebx $hbp $hbx $rbp $rbx $r12 $r13 $r14 $r15 $r12b $r13b $r14b $r15b $r12bh $r13bh $r14bh $r15bh $r12d $r13d $r14d $r15d $r12w $r13w $r14w $r15w $r12wh and 3 more...>, implicit $rsp, implicit $ssp, implicit killed $al, implicit killed $rdi, implicit-def $eax\n-  renamable $eax = MOV32r0 implicit-def dead $eflags\n+  renamable $eax = XOR32rr undef $eax(tied-def 0), undef $eax, implicit-def dead $eflags\n   $rsp = frame-destroy ADD64ri8 $rsp(tied-def 0), 16, implicit-def dead $eflags\n   $rbp = frame-destroy POP64r implicit-def $rsp, implicit $rsp\n   CFI_INSTRUCTION def_cfa $rsp, 8\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_35.ll\t2026-06-01 07:22:13.344794272 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_36.ll\t2026-06-01 07:22:13.345794266 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After Post-RA pseudo instruction expansion pass (postrapseudos) ***:\n+*** IR Dump After X86 pseudo instruction expansion pass (x86-pseudo) ***:\n # Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\n Frame Objects:\n   fi#-1: size=8, align=16, fixed, at location [SP-8]\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_36.ll\t2026-06-01 07:22:13.345794266 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_37.ll\t2026-06-01 07:22:13.346794259 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After X86 pseudo instruction expansion pass (x86-pseudo) ***:\n+*** IR Dump After Analyze Machine Code For Garbage Collection (gc-analysis) ***:\n # Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\n Frame Objects:\n   fi#-1: size=8, align=16, fixed, at location [SP-8]\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_37.ll\t2026-06-01 07:22:13.346794259 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_38.ll\t2026-06-01 07:22:13.347794252 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After Analyze Machine Code For Garbage Collection (gc-analysis) ***:\n+*** IR Dump After Insert fentry calls (fentry-insert) ***:\n # Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\n Frame Objects:\n   fi#-1: size=8, align=16, fixed, at location [SP-8]\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_38.ll\t2026-06-01 07:22:13.347794252 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_39.ll\t2026-06-01 07:22:13.348794245 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After Insert fentry calls (fentry-insert) ***:\n+*** IR Dump After Insert XRay ops (xray-instrumentation) ***:\n # Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\n Frame Objects:\n   fi#-1: size=8, align=16, fixed, at location [SP-8]\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_39.ll\t2026-06-01 07:22:13.348794245 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_40.ll\t2026-06-01 07:22:13.349794239 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After Insert XRay ops (xray-instrumentation) ***:\n+*** IR Dump After Implement the 'patchable-function' attribute (patchable-function) ***:\n # Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\n Frame Objects:\n   fi#-1: size=8, align=16, fixed, at location [SP-8]\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_40.ll\t2026-06-01 07:22:13.349794239 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_41.ll\t2026-06-01 07:22:13.351794226 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After Implement the 'patchable-function' attribute (patchable-function) ***:\n+*** IR Dump After Compressing EVEX instrs to VEX encoding when possible (x86-evex-to-vex-compress) ***:\n # Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\n Frame Objects:\n   fi#-1: size=8, align=16, fixed, at location [SP-8]\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_41.ll\t2026-06-01 07:22:13.351794226 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_42.ll\t2026-06-01 07:22:13.352794219 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After Compressing EVEX instrs to VEX encoding when possible (x86-evex-to-vex-compress) ***:\n+*** IR Dump After Contiguously Lay Out Funclets (funclet-layout) ***:\n # Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\n Frame Objects:\n   fi#-1: size=8, align=16, fixed, at location [SP-8]\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_42.ll\t2026-06-01 07:22:13.352794219 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_43.ll\t2026-06-01 07:22:13.353794213 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After Contiguously Lay Out Funclets (funclet-layout) ***:\n+*** IR Dump After StackMap Liveness Analysis (stackmap-liveness) ***:\n # Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\n Frame Objects:\n   fi#-1: size=8, align=16, fixed, at location [SP-8]\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_43.ll\t2026-06-01 07:22:13.353794213 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_44.ll\t2026-06-01 07:22:13.354794206 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After StackMap Liveness Analysis (stackmap-liveness) ***:\n+*** IR Dump After Live DEBUG_VALUE analysis (livedebugvalues) ***:\n # Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\n Frame Objects:\n   fi#-1: size=8, align=16, fixed, at location [SP-8]\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_44.ll\t2026-06-01 07:22:13.354794206 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_45.ll\t2026-06-01 07:22:13.355794199 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After Live DEBUG_VALUE analysis (livedebugvalues) ***:\n+*** IR Dump After X86 Speculative Execution Side Effect Suppression (x86-seses) ***:\n # Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\n Frame Objects:\n   fi#-1: size=8, align=16, fixed, at location [SP-8]\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_45.ll\t2026-06-01 07:22:13.355794199 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_46.ll\t2026-06-01 07:22:13.356794192 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After X86 Speculative Execution Side Effect Suppression (x86-seses) ***:\n+*** IR Dump After Check CFA info and insert CFI instructions if needed (cfi-instr-inserter) ***:\n # Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\n Frame Objects:\n   fi#-1: size=8, align=16, fixed, at location [SP-8]\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_46.ll\t2026-06-01 07:22:13.356794192 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_47.ll\t2026-06-01 07:22:13.357794186 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After Check CFA info and insert CFI instructions if needed (cfi-instr-inserter) ***:\n+*** IR Dump After X86 Load Value Injection (LVI) Ret-Hardening (x86-lvi-ret) ***:\n # Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\n Frame Objects:\n   fi#-1: size=8, align=16, fixed, at location [SP-8]\n",
        "--- passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_47.ll\t2026-06-01 07:22:13.357794186 +0000\n+++ passes_69dba41a-a366-4216-8ba7-c7283a6ba711/pass_48.ll\t2026-06-01 07:22:13.358794179 +0000\n@@ -1,4 +1,4 @@\n-*** IR Dump After X86 Load Value Injection (LVI) Ret-Hardening (x86-lvi-ret) ***:\n+*** IR Dump After Pseudo Probe Inserter (pseudo-probe-inserter) ***:\n # Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\n Frame Objects:\n   fi#-1: size=8, align=16, fixed, at location [SP-8]\n@@ -23,4 +23,4 @@\n \n # End machine code for function main.\n \n-# \n\\ No newline at end of file\n+1 warning generated.\n"
      ],
      "liste_explicationO0": [
        "Cette partie définit les métadonnées du module LLVM IR, telles que le nom du fichier source et la cible de compilation.",
        "Cette ligne appelle la fonction printf avec la chaîne \"Hello, world!\\n\" comme argument. La chaîne est définie comme une constante dans le code LLVM IR.",
        "Cette ligne retourne la valeur 0 pour indiquer que le programme s'est terminé avec succès."
      ],
      "liste_llO0": [
        [
          "; ModuleID = 'fichier.c'",
          "source_filename = \"fichier.c\"",
          "target datalayout = \"e-m:e-p270:32:32-p271:32:32-p272:64:64-i64:64-f80:128-n8:16:32:64-S128\"",
          "target triple = \"x86_64-pc-linux-gnu\""
        ],
        [
          "%2 = call i32 (i8*, ...) @printf(i8* noundef getelementptr inbounds ([15 x i8], [15 x i8]* @.str, i64 0, i64 0))",
          "@.str = private unnamed_addr constant [15 x i8] c\"Hello, world!\\0A\\00\", align 1"
        ],
        [
          "ret i32 0"
        ]
      ],
      "liste_passesO0": [
        "*** IR Dump After AlwaysInlinerPass on [module] ***\n; ModuleID = 'fichier.c'\nsource_filename = \"fichier.c\"\ntarget datalayout = \"e-m:e-p270:32:32-p271:32:32-p272:64:64-i64:64-f80:128-n8:16:32:64-S128\"\ntarget triple = \"x86_64-pc-linux-gnu\"\n\n@.str = private unnamed_addr constant [15 x i8] c\"Hello, world!\\0A\\00\", align 1\n\n; Function Attrs: noinline nounwind optnone uwtable\ndefine dso_local i32 @main() #0 {\n  %1 = alloca i32, align 4\n  store i32 0, i32* %1, align 4\n  %2 = call i32 (i8*, ...) @printf(i8* noundef getelementptr inbounds ([15 x i8], [15 x i8]* @.str, i64 0, i64 0))\n  ret i32 0\n}\n\ndeclare i32 @printf(i8* noundef, ...) #1\n\nattributes #0 = { noinline nounwind optnone uwtable \"frame-pointer\"=\"all\" \"min-legal-vector-width\"=\"0\" \"no-trapping-math\"=\"true\" \"stack-protector-buffer-size\"=\"8\" \"target-cpu\"=\"x86-64\" \"target-features\"=\"+cx8,+fxsr,+mmx,+sse,+sse2,+x87\" \"tune-cpu\"=\"generic\" }\nattributes #1 = { \"frame-pointer\"=\"all\" \"no-trapping-math\"=\"true\" \"stack-protector-buffer-size\"=\"8\" \"target-cpu\"=\"x86-64\" \"target-features\"=\"+cx8,+fxsr,+mmx,+sse,+sse2,+x87\" \"tune-cpu\"=\"generic\" }\n\n!llvm.module.flags = !{!0, !1, !2, !3, !4}\n!llvm.ident = !{!5}\n\n!0 = !{i32 1, !\"wchar_size\", i32 4}\n!1 = !{i32 7, !\"PIC Level\", i32 2}\n!2 = !{i32 7, !\"PIE Level\", i32 2}\n!3 = !{i32 7, !\"uwtable\", i32 1}\n!4 = !{i32 7, !\"frame-pointer\", i32 2}\n!5 = !{!\"Debian clang version 14.0.6\"}\n",
        "*** IR Dump After CoroEarlyPass on main ***\n; Function Attrs: noinline nounwind optnone uwtable\ndefine dso_local i32 @main() #0 {\n  %1 = alloca i32, align 4\n  store i32 0, i32* %1, align 4\n  %2 = call i32 (i8*, ...) @printf(i8* noundef getelementptr inbounds ([15 x i8], [15 x i8]* @.str, i64 0, i64 0))\n  ret i32 0\n}\n",
        "*** IR Dump After CoroSplitPass on (main) ***\n; Function Attrs: noinline nounwind optnone uwtable\ndefine dso_local i32 @main() #0 {\n  %1 = alloca i32, align 4\n  store i32 0, i32* %1, align 4\n  %2 = call i32 (i8*, ...) @printf(i8* noundef getelementptr inbounds ([15 x i8], [15 x i8]* @.str, i64 0, i64 0))\n  ret i32 0\n}\n",
        "*** IR Dump After CoroCleanupPass on main ***\n; Function Attrs: noinline nounwind optnone uwtable\ndefine dso_local i32 @main() #0 {\n  %1 = alloca i32, align 4\n  store i32 0, i32* %1, align 4\n  %2 = call i32 (i8*, ...) @printf(i8* noundef getelementptr inbounds ([15 x i8], [15 x i8]* @.str, i64 0, i64 0))\n  ret i32 0\n}\n",
        "*** IR Dump After AnnotationRemarksPass on main ***\n; Function Attrs: noinline nounwind optnone uwtable\ndefine dso_local i32 @main() #0 {\n  %1 = alloca i32, align 4\n  store i32 0, i32* %1, align 4\n  %2 = call i32 (i8*, ...) @printf(i8* noundef getelementptr inbounds ([15 x i8], [15 x i8]* @.str, i64 0, i64 0))\n  ret i32 0\n}\n",
        "*** IR Dump After Pre-ISel Intrinsic Lowering (pre-isel-intrinsic-lowering) ***\n; ModuleID = 'fichier.c'\nsource_filename = \"fichier.c\"\ntarget datalayout = \"e-m:e-p270:32:32-p271:32:32-p272:64:64-i64:64-f80:128-n8:16:32:64-S128\"\ntarget triple = \"x86_64-pc-linux-gnu\"\n\n@.str = private unnamed_addr constant [15 x i8] c\"Hello, world!\\0A\\00\", align 1\n\n; Function Attrs: noinline nounwind optnone uwtable\ndefine dso_local i32 @main() #0 {\n  %1 = alloca i32, align 4\n  store i32 0, i32* %1, align 4\n  %2 = call i32 (i8*, ...) @printf(i8* noundef getelementptr inbounds ([15 x i8], [15 x i8]* @.str, i64 0, i64 0))\n  ret i32 0\n}\n\ndeclare i32 @printf(i8* noundef, ...) #1\n\nattributes #0 = { noinline nounwind optnone uwtable \"frame-pointer\"=\"all\" \"min-legal-vector-width\"=\"0\" \"no-trapping-math\"=\"true\" \"stack-protector-buffer-size\"=\"8\" \"target-cpu\"=\"x86-64\" \"target-features\"=\"+cx8,+fxsr,+mmx,+sse,+sse2,+x87\" \"tune-cpu\"=\"generic\" }\nattributes #1 = { \"frame-pointer\"=\"all\" \"no-trapping-math\"=\"true\" \"stack-protector-buffer-size\"=\"8\" \"target-cpu\"=\"x86-64\" \"target-features\"=\"+cx8,+fxsr,+mmx,+sse,+sse2,+x87\" \"tune-cpu\"=\"generic\" }\n\n!llvm.module.flags = !{!0, !1, !2, !3, !4}\n!llvm.ident = !{!5}\n\n!0 = !{i32 1, !\"wchar_size\", i32 4}\n!1 = !{i32 7, !\"PIC Level\", i32 2}\n!2 = !{i32 7, !\"PIE Level\", i32 2}\n!3 = !{i32 7, !\"uwtable\", i32 1}\n!4 = !{i32 7, !\"frame-pointer\", i32 2}\n!5 = !{!\"Debian clang version 14.0.6\"}\n",
        "*** IR Dump After Expand Atomic instructions (atomic-expand) ***\n; Function Attrs: noinline nounwind optnone uwtable\ndefine dso_local i32 @main() #0 {\n  %1 = alloca i32, align 4\n  store i32 0, i32* %1, align 4\n  %2 = call i32 (i8*, ...) @printf(i8* noundef getelementptr inbounds ([15 x i8], [15 x i8]* @.str, i64 0, i64 0))\n  ret i32 0\n}\n",
        "*** IR Dump After Lower AMX intrinsics (lower-amx-intrinsics) ***\n; Function Attrs: noinline nounwind optnone uwtable\ndefine dso_local i32 @main() #0 {\n  %1 = alloca i32, align 4\n  store i32 0, i32* %1, align 4\n  %2 = call i32 (i8*, ...) @printf(i8* noundef getelementptr inbounds ([15 x i8], [15 x i8]* @.str, i64 0, i64 0))\n  ret i32 0\n}\n",
        "*** IR Dump After Lower AMX type for load/store (lower-amx-type) ***\n; Function Attrs: noinline nounwind optnone uwtable\ndefine dso_local i32 @main() #0 {\n  %1 = alloca i32, align 4\n  store i32 0, i32* %1, align 4\n  %2 = call i32 (i8*, ...) @printf(i8* noundef getelementptr inbounds ([15 x i8], [15 x i8]* @.str, i64 0, i64 0))\n  ret i32 0\n}\n",
        "*** IR Dump After Pre AMX Tile Config (pre-amx-config) ***\n; Function Attrs: noinline nounwind optnone uwtable\ndefine dso_local i32 @main() #0 {\n  %1 = alloca i32, align 4\n  store i32 0, i32* %1, align 4\n  %2 = call i32 (i8*, ...) @printf(i8* noundef getelementptr inbounds ([15 x i8], [15 x i8]* @.str, i64 0, i64 0))\n  ret i32 0\n}\n",
        "*** IR Dump After Lower Garbage Collection Instructions (gc-lowering) ***\n; Function Attrs: noinline nounwind optnone uwtable\ndefine dso_local i32 @main() #0 {\n  %1 = alloca i32, align 4\n  store i32 0, i32* %1, align 4\n  %2 = call i32 (i8*, ...) @printf(i8* noundef getelementptr inbounds ([15 x i8], [15 x i8]* @.str, i64 0, i64 0))\n  ret i32 0\n}\n",
        "*** IR Dump After Shadow Stack GC Lowering (shadow-stack-gc-lowering) ***\n; Function Attrs: noinline nounwind optnone uwtable\ndefine dso_local i32 @main() #0 {\n  %1 = alloca i32, align 4\n  store i32 0, i32* %1, align 4\n  %2 = call i32 (i8*, ...) @printf(i8* noundef getelementptr inbounds ([15 x i8], [15 x i8]* @.str, i64 0, i64 0))\n  ret i32 0\n}\n",
        "*** IR Dump After Lower constant intrinsics (lower-constant-intrinsics) ***\n; Function Attrs: noinline nounwind optnone uwtable\ndefine dso_local i32 @main() #0 {\n  %1 = alloca i32, align 4\n  store i32 0, i32* %1, align 4\n  %2 = call i32 (i8*, ...) @printf(i8* noundef getelementptr inbounds ([15 x i8], [15 x i8]* @.str, i64 0, i64 0))\n  ret i32 0\n}\n",
        "*** IR Dump After Remove unreachable blocks from the CFG (unreachableblockelim) ***\n; Function Attrs: noinline nounwind optnone uwtable\ndefine dso_local i32 @main() #0 {\n  %1 = alloca i32, align 4\n  store i32 0, i32* %1, align 4\n  %2 = call i32 (i8*, ...) @printf(i8* noundef getelementptr inbounds ([15 x i8], [15 x i8]* @.str, i64 0, i64 0))\n  ret i32 0\n}\n",
        "*** IR Dump After Expand vector predication intrinsics (expandvp) ***\n; Function Attrs: noinline nounwind optnone uwtable\ndefine dso_local i32 @main() #0 {\n  %1 = alloca i32, align 4\n  store i32 0, i32* %1, align 4\n  %2 = call i32 (i8*, ...) @printf(i8* noundef getelementptr inbounds ([15 x i8], [15 x i8]* @.str, i64 0, i64 0))\n  ret i32 0\n}\n",
        "*** IR Dump After Scalarize Masked Memory Intrinsics (scalarize-masked-mem-intrin) ***\n; Function Attrs: noinline nounwind optnone uwtable\ndefine dso_local i32 @main() #0 {\n  %1 = alloca i32, align 4\n  store i32 0, i32* %1, align 4\n  %2 = call i32 (i8*, ...) @printf(i8* noundef getelementptr inbounds ([15 x i8], [15 x i8]* @.str, i64 0, i64 0))\n  ret i32 0\n}\n",
        "*** IR Dump After Expand reduction intrinsics (expand-reductions) ***\n; Function Attrs: noinline nounwind optnone uwtable\ndefine dso_local i32 @main() #0 {\n  %1 = alloca i32, align 4\n  store i32 0, i32* %1, align 4\n  %2 = call i32 (i8*, ...) @printf(i8* noundef getelementptr inbounds ([15 x i8], [15 x i8]* @.str, i64 0, i64 0))\n  ret i32 0\n}\n",
        "*** IR Dump After Expand indirectbr instructions (indirectbr-expand) ***\n; Function Attrs: noinline nounwind optnone uwtable\ndefine dso_local i32 @main() #0 {\n  %1 = alloca i32, align 4\n  store i32 0, i32* %1, align 4\n  %2 = call i32 (i8*, ...) @printf(i8* noundef getelementptr inbounds ([15 x i8], [15 x i8]* @.str, i64 0, i64 0))\n  ret i32 0\n}\n",
        "*** IR Dump After Exception handling preparation (dwarfehprepare) ***\n; Function Attrs: noinline nounwind optnone uwtable\ndefine dso_local i32 @main() #0 {\n  %1 = alloca i32, align 4\n  store i32 0, i32* %1, align 4\n  %2 = call i32 (i8*, ...) @printf(i8* noundef getelementptr inbounds ([15 x i8], [15 x i8]* @.str, i64 0, i64 0))\n  ret i32 0\n}\n",
        "*** IR Dump After Safe Stack instrumentation pass (safe-stack) ***\n; Function Attrs: noinline nounwind optnone uwtable\ndefine dso_local i32 @main() #0 {\n  %1 = alloca i32, align 4\n  store i32 0, i32* %1, align 4\n  %2 = call i32 (i8*, ...) @printf(i8* noundef getelementptr inbounds ([15 x i8], [15 x i8]* @.str, i64 0, i64 0))\n  ret i32 0\n}\n# ",
        "*** IR Dump After X86 DAG->DAG Instruction Selection (amdgpu-isel) ***:\n# Machine code for function main: IsSSA, TracksLiveness\nFrame Objects:\n  fi#0: size=4, align=4, at location [SP+8]\n\nbb.0 (%ir-block.0):\n  MOV32mi %stack.0, 1, $noreg, 0, $noreg, 0 :: (store (s32) into %ir.1)\n  %1:gr64 = LEA64r $rip, 1, $noreg, @.str, $noreg\n  ADJCALLSTACKDOWN64 0, 0, 0, implicit-def $rsp, implicit-def $eflags, implicit-def $ssp, implicit $rsp, implicit $ssp\n  $rdi = COPY %1:gr64\n  $al = MOV8ri 0\n  CALL64pcrel32 target-flags(x86-plt) @printf, <regmask $bh $bl $bp $bph $bpl $bx $ebp $ebx $hbp $hbx $rbp $rbx $r12 $r13 $r14 $r15 $r12b $r13b $r14b $r15b $r12bh $r13bh $r14bh $r15bh $r12d $r13d $r14d $r15d $r12w $r13w $r14w $r15w $r12wh and 3 more...>, implicit $rsp, implicit $ssp, implicit $al, implicit $rdi, implicit-def $eax\n  ADJCALLSTACKUP64 0, 0, implicit-def $rsp, implicit-def $eflags, implicit-def $ssp, implicit $rsp, implicit $ssp\n  %2:gr32 = COPY $eax\n  %0:gr32 = MOV32r0 implicit-def $eflags\n  $eax = COPY %0:gr32\n  RET64 implicit $eax\n\n# End machine code for function main.\n\n# ",
        "*** IR Dump After Finalize ISel and expand pseudo-instructions (finalize-isel) ***:\n# Machine code for function main: IsSSA, TracksLiveness\nFrame Objects:\n  fi#0: size=4, align=4, at location [SP+8]\n\nbb.0 (%ir-block.0):\n  MOV32mi %stack.0, 1, $noreg, 0, $noreg, 0 :: (store (s32) into %ir.1)\n  %1:gr64 = LEA64r $rip, 1, $noreg, @.str, $noreg\n  ADJCALLSTACKDOWN64 0, 0, 0, implicit-def $rsp, implicit-def $eflags, implicit-def $ssp, implicit $rsp, implicit $ssp\n  $rdi = COPY %1:gr64\n  $al = MOV8ri 0\n  CALL64pcrel32 target-flags(x86-plt) @printf, <regmask $bh $bl $bp $bph $bpl $bx $ebp $ebx $hbp $hbx $rbp $rbx $r12 $r13 $r14 $r15 $r12b $r13b $r14b $r15b $r12bh $r13bh $r14bh $r15bh $r12d $r13d $r14d $r15d $r12w $r13w $r14w $r15w $r12wh and 3 more...>, implicit $rsp, implicit $ssp, implicit $al, implicit $rdi, implicit-def $eax\n  ADJCALLSTACKUP64 0, 0, implicit-def $rsp, implicit-def $eflags, implicit-def $ssp, implicit $rsp, implicit $ssp\n  %2:gr32 = COPY $eax\n  %0:gr32 = MOV32r0 implicit-def $eflags\n  $eax = COPY %0:gr32\n  RET64 implicit $eax\n\n# End machine code for function main.\n\n# ",
        "*** IR Dump After Local Stack Slot Allocation (localstackalloc) ***:\n# Machine code for function main: IsSSA, TracksLiveness\nFrame Objects:\n  fi#0: size=4, align=4, at location [SP+8]\n\nbb.0 (%ir-block.0):\n  MOV32mi %stack.0, 1, $noreg, 0, $noreg, 0 :: (store (s32) into %ir.1)\n  %1:gr64 = LEA64r $rip, 1, $noreg, @.str, $noreg\n  ADJCALLSTACKDOWN64 0, 0, 0, implicit-def $rsp, implicit-def $eflags, implicit-def $ssp, implicit $rsp, implicit $ssp\n  $rdi = COPY %1:gr64\n  $al = MOV8ri 0\n  CALL64pcrel32 target-flags(x86-plt) @printf, <regmask $bh $bl $bp $bph $bpl $bx $ebp $ebx $hbp $hbx $rbp $rbx $r12 $r13 $r14 $r15 $r12b $r13b $r14b $r15b $r12bh $r13bh $r14bh $r15bh $r12d $r13d $r14d $r15d $r12w $r13w $r14w $r15w $r12wh and 3 more...>, implicit $rsp, implicit $ssp, implicit $al, implicit $rdi, implicit-def $eax\n  ADJCALLSTACKUP64 0, 0, implicit-def $rsp, implicit-def $eflags, implicit-def $ssp, implicit $rsp, implicit $ssp\n  %2:gr32 = COPY $eax\n  %0:gr32 = MOV32r0 implicit-def $eflags\n  $eax = COPY %0:gr32\n  RET64 implicit $eax\n\n# End machine code for function main.\n\n# ",
        "*** IR Dump After X86 speculative load hardening (x86-slh) ***:\n# Machine code for function main: IsSSA, TracksLiveness\nFrame Objects:\n  fi#0: size=4, align=4, at location [SP+8]\n\nbb.0 (%ir-block.0):\n  MOV32mi %stack.0, 1, $noreg, 0, $noreg, 0 :: (store (s32) into %ir.1)\n  %1:gr64 = LEA64r $rip, 1, $noreg, @.str, $noreg\n  ADJCALLSTACKDOWN64 0, 0, 0, implicit-def $rsp, implicit-def $eflags, implicit-def $ssp, implicit $rsp, implicit $ssp\n  $rdi = COPY %1:gr64\n  $al = MOV8ri 0\n  CALL64pcrel32 target-flags(x86-plt) @printf, <regmask $bh $bl $bp $bph $bpl $bx $ebp $ebx $hbp $hbx $rbp $rbx $r12 $r13 $r14 $r15 $r12b $r13b $r14b $r15b $r12bh $r13bh $r14bh $r15bh $r12d $r13d $r14d $r15d $r12w $r13w $r14w $r15w $r12wh and 3 more...>, implicit $rsp, implicit $ssp, implicit $al, implicit $rdi, implicit-def $eax\n  ADJCALLSTACKUP64 0, 0, implicit-def $rsp, implicit-def $eflags, implicit-def $ssp, implicit $rsp, implicit $ssp\n  %2:gr32 = COPY $eax\n  %0:gr32 = MOV32r0 implicit-def $eflags\n  $eax = COPY %0:gr32\n  RET64 implicit $eax\n\n# End machine code for function main.\n\n# ",
        "*** IR Dump After X86 EFLAGS copy lowering (x86-flags-copy-lowering) ***:\n# Machine code for function main: IsSSA, TracksLiveness\nFrame Objects:\n  fi#0: size=4, align=4, at location [SP+8]\n\nbb.0 (%ir-block.0):\n  MOV32mi %stack.0, 1, $noreg, 0, $noreg, 0 :: (store (s32) into %ir.1)\n  %1:gr64 = LEA64r $rip, 1, $noreg, @.str, $noreg\n  ADJCALLSTACKDOWN64 0, 0, 0, implicit-def $rsp, implicit-def $eflags, implicit-def $ssp, implicit $rsp, implicit $ssp\n  $rdi = COPY %1:gr64\n  $al = MOV8ri 0\n  CALL64pcrel32 target-flags(x86-plt) @printf, <regmask $bh $bl $bp $bph $bpl $bx $ebp $ebx $hbp $hbx $rbp $rbx $r12 $r13 $r14 $r15 $r12b $r13b $r14b $r15b $r12bh $r13bh $r14bh $r15bh $r12d $r13d $r14d $r15d $r12w $r13w $r14w $r15w $r12wh and 3 more...>, implicit $rsp, implicit $ssp, implicit $al, implicit $rdi, implicit-def $eax\n  ADJCALLSTACKUP64 0, 0, implicit-def $rsp, implicit-def $eflags, implicit-def $ssp, implicit $rsp, implicit $ssp\n  %2:gr32 = COPY $eax\n  %0:gr32 = MOV32r0 implicit-def $eflags\n  $eax = COPY %0:gr32\n  RET64 implicit $eax\n\n# End machine code for function main.\n\n# ",
        "*** IR Dump After Eliminate PHI nodes for register allocation (phi-node-elimination) ***:\n# Machine code for function main: NoPHIs, TracksLiveness\nFrame Objects:\n  fi#0: size=4, align=4, at location [SP+8]\n\nbb.0 (%ir-block.0):\n  MOV32mi %stack.0, 1, $noreg, 0, $noreg, 0 :: (store (s32) into %ir.1)\n  %1:gr64 = LEA64r $rip, 1, $noreg, @.str, $noreg\n  ADJCALLSTACKDOWN64 0, 0, 0, implicit-def $rsp, implicit-def $eflags, implicit-def $ssp, implicit $rsp, implicit $ssp\n  $rdi = COPY %1:gr64\n  $al = MOV8ri 0\n  CALL64pcrel32 target-flags(x86-plt) @printf, <regmask $bh $bl $bp $bph $bpl $bx $ebp $ebx $hbp $hbx $rbp $rbx $r12 $r13 $r14 $r15 $r12b $r13b $r14b $r15b $r12bh $r13bh $r14bh $r15bh $r12d $r13d $r14d $r15d $r12w $r13w $r14w $r15w $r12wh and 3 more...>, implicit $rsp, implicit $ssp, implicit $al, implicit $rdi, implicit-def $eax\n  ADJCALLSTACKUP64 0, 0, implicit-def $rsp, implicit-def $eflags, implicit-def $ssp, implicit $rsp, implicit $ssp\n  %2:gr32 = COPY $eax\n  %0:gr32 = MOV32r0 implicit-def $eflags\n  $eax = COPY %0:gr32\n  RET64 implicit $eax\n\n# End machine code for function main.\n\n# ",
        "*** IR Dump After Two-Address instruction pass (twoaddressinstruction) ***:\n# Machine code for function main: NoPHIs, TracksLiveness, TiedOpsRewritten\nFrame Objects:\n  fi#0: size=4, align=4, at location [SP+8]\n\nbb.0 (%ir-block.0):\n  MOV32mi %stack.0, 1, $noreg, 0, $noreg, 0 :: (store (s32) into %ir.1)\n  %1:gr64 = LEA64r $rip, 1, $noreg, @.str, $noreg\n  ADJCALLSTACKDOWN64 0, 0, 0, implicit-def $rsp, implicit-def $eflags, implicit-def $ssp, implicit $rsp, implicit $ssp\n  $rdi = COPY %1:gr64\n  $al = MOV8ri 0\n  CALL64pcrel32 target-flags(x86-plt) @printf, <regmask $bh $bl $bp $bph $bpl $bx $ebp $ebx $hbp $hbx $rbp $rbx $r12 $r13 $r14 $r15 $r12b $r13b $r14b $r15b $r12bh $r13bh $r14bh $r15bh $r12d $r13d $r14d $r15d $r12w $r13w $r14w $r15w $r12wh and 3 more...>, implicit $rsp, implicit $ssp, implicit $al, implicit $rdi, implicit-def $eax\n  ADJCALLSTACKUP64 0, 0, implicit-def $rsp, implicit-def $eflags, implicit-def $ssp, implicit $rsp, implicit $ssp\n  %2:gr32 = COPY $eax\n  %0:gr32 = MOV32r0 implicit-def $eflags\n  $eax = COPY %0:gr32\n  RET64 implicit $eax\n\n# End machine code for function main.\n\n# ",
        "*** IR Dump After Fast Register Allocator (regallocfast) ***:\n# Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\nFrame Objects:\n  fi#0: size=4, align=4, at location [SP+8]\n\nbb.0 (%ir-block.0):\n  MOV32mi %stack.0, 1, $noreg, 0, $noreg, 0 :: (store (s32) into %ir.1)\n  renamable $rdi = LEA64r $rip, 1, $noreg, @.str, $noreg\n  ADJCALLSTACKDOWN64 0, 0, 0, implicit-def $rsp, implicit-def dead $eflags, implicit-def $ssp, implicit $rsp, implicit $ssp\n  $al = MOV8ri 0\n  CALL64pcrel32 target-flags(x86-plt) @printf, <regmask $bh $bl $bp $bph $bpl $bx $ebp $ebx $hbp $hbx $rbp $rbx $r12 $r13 $r14 $r15 $r12b $r13b $r14b $r15b $r12bh $r13bh $r14bh $r15bh $r12d $r13d $r14d $r15d $r12w $r13w $r14w $r15w $r12wh and 3 more...>, implicit $rsp, implicit $ssp, implicit killed $al, implicit killed $rdi, implicit-def $eax\n  ADJCALLSTACKUP64 0, 0, implicit-def $rsp, implicit-def dead $eflags, implicit-def $ssp, implicit $rsp, implicit $ssp\n  renamable $eax = MOV32r0 implicit-def dead $eflags\n  RET64 implicit killed $eax\n\n# End machine code for function main.\n\n# ",
        "*** IR Dump After Fast Tile Register Configure (fasttileconfig) ***:\n# Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\nFrame Objects:\n  fi#0: size=4, align=4, at location [SP+8]\n\nbb.0 (%ir-block.0):\n  MOV32mi %stack.0, 1, $noreg, 0, $noreg, 0 :: (store (s32) into %ir.1)\n  renamable $rdi = LEA64r $rip, 1, $noreg, @.str, $noreg\n  ADJCALLSTACKDOWN64 0, 0, 0, implicit-def $rsp, implicit-def dead $eflags, implicit-def $ssp, implicit $rsp, implicit $ssp\n  $al = MOV8ri 0\n  CALL64pcrel32 target-flags(x86-plt) @printf, <regmask $bh $bl $bp $bph $bpl $bx $ebp $ebx $hbp $hbx $rbp $rbx $r12 $r13 $r14 $r15 $r12b $r13b $r14b $r15b $r12bh $r13bh $r14bh $r15bh $r12d $r13d $r14d $r15d $r12w $r13w $r14w $r15w $r12wh and 3 more...>, implicit $rsp, implicit $ssp, implicit killed $al, implicit killed $rdi, implicit-def $eax\n  ADJCALLSTACKUP64 0, 0, implicit-def $rsp, implicit-def dead $eflags, implicit-def $ssp, implicit $rsp, implicit $ssp\n  renamable $eax = MOV32r0 implicit-def dead $eflags\n  RET64 implicit killed $eax\n\n# End machine code for function main.\n\n# ",
        "*** IR Dump After X86 Lower Tile Copy (lowertilecopy) ***:\n# Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\nFrame Objects:\n  fi#0: size=4, align=4, at location [SP+8]\n\nbb.0 (%ir-block.0):\n  MOV32mi %stack.0, 1, $noreg, 0, $noreg, 0 :: (store (s32) into %ir.1)\n  renamable $rdi = LEA64r $rip, 1, $noreg, @.str, $noreg\n  ADJCALLSTACKDOWN64 0, 0, 0, implicit-def $rsp, implicit-def dead $eflags, implicit-def $ssp, implicit $rsp, implicit $ssp\n  $al = MOV8ri 0\n  CALL64pcrel32 target-flags(x86-plt) @printf, <regmask $bh $bl $bp $bph $bpl $bx $ebp $ebx $hbp $hbx $rbp $rbx $r12 $r13 $r14 $r15 $r12b $r13b $r14b $r15b $r12bh $r13bh $r14bh $r15bh $r12d $r13d $r14d $r15d $r12w $r13w $r14w $r15w $r12wh and 3 more...>, implicit $rsp, implicit $ssp, implicit killed $al, implicit killed $rdi, implicit-def $eax\n  ADJCALLSTACKUP64 0, 0, implicit-def $rsp, implicit-def dead $eflags, implicit-def $ssp, implicit $rsp, implicit $ssp\n  renamable $eax = MOV32r0 implicit-def dead $eflags\n  RET64 implicit killed $eax\n\n# End machine code for function main.\n\n# ",
        "*** IR Dump After X86 FP Stackifier (x86-codegen) ***:\n# Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\nFrame Objects:\n  fi#0: size=4, align=4, at location [SP+8]\n\nbb.0 (%ir-block.0):\n  MOV32mi %stack.0, 1, $noreg, 0, $noreg, 0 :: (store (s32) into %ir.1)\n  renamable $rdi = LEA64r $rip, 1, $noreg, @.str, $noreg\n  ADJCALLSTACKDOWN64 0, 0, 0, implicit-def $rsp, implicit-def dead $eflags, implicit-def $ssp, implicit $rsp, implicit $ssp\n  $al = MOV8ri 0\n  CALL64pcrel32 target-flags(x86-plt) @printf, <regmask $bh $bl $bp $bph $bpl $bx $ebp $ebx $hbp $hbx $rbp $rbx $r12 $r13 $r14 $r15 $r12b $r13b $r14b $r15b $r12bh $r13bh $r14bh $r15bh $r12d $r13d $r14d $r15d $r12w $r13w $r14w $r15w $r12wh and 3 more...>, implicit $rsp, implicit $ssp, implicit killed $al, implicit killed $rdi, implicit-def $eax\n  ADJCALLSTACKUP64 0, 0, implicit-def $rsp, implicit-def dead $eflags, implicit-def $ssp, implicit $rsp, implicit $ssp\n  renamable $eax = MOV32r0 implicit-def dead $eflags\n  RET64 implicit killed $eax\n\n# End machine code for function main.\n\n# ",
        "*** IR Dump After Remove Redundant DEBUG_VALUE analysis (removeredundantdebugvalues) ***:\n# Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\nFrame Objects:\n  fi#0: size=4, align=4, at location [SP+8]\n\nbb.0 (%ir-block.0):\n  MOV32mi %stack.0, 1, $noreg, 0, $noreg, 0 :: (store (s32) into %ir.1)\n  renamable $rdi = LEA64r $rip, 1, $noreg, @.str, $noreg\n  ADJCALLSTACKDOWN64 0, 0, 0, implicit-def $rsp, implicit-def dead $eflags, implicit-def $ssp, implicit $rsp, implicit $ssp\n  $al = MOV8ri 0\n  CALL64pcrel32 target-flags(x86-plt) @printf, <regmask $bh $bl $bp $bph $bpl $bx $ebp $ebx $hbp $hbx $rbp $rbx $r12 $r13 $r14 $r15 $r12b $r13b $r14b $r15b $r12bh $r13bh $r14bh $r15bh $r12d $r13d $r14d $r15d $r12w $r13w $r14w $r15w $r12wh and 3 more...>, implicit $rsp, implicit $ssp, implicit killed $al, implicit killed $rdi, implicit-def $eax\n  ADJCALLSTACKUP64 0, 0, implicit-def $rsp, implicit-def dead $eflags, implicit-def $ssp, implicit $rsp, implicit $ssp\n  renamable $eax = MOV32r0 implicit-def dead $eflags\n  RET64 implicit killed $eax\n\n# End machine code for function main.\n\n# ",
        "*** IR Dump After Fixup Statepoint Caller Saved (fixup-statepoint-caller-saved) ***:\n# Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\nFrame Objects:\n  fi#0: size=4, align=4, at location [SP+8]\n\nbb.0 (%ir-block.0):\n  MOV32mi %stack.0, 1, $noreg, 0, $noreg, 0 :: (store (s32) into %ir.1)\n  renamable $rdi = LEA64r $rip, 1, $noreg, @.str, $noreg\n  ADJCALLSTACKDOWN64 0, 0, 0, implicit-def $rsp, implicit-def dead $eflags, implicit-def $ssp, implicit $rsp, implicit $ssp\n  $al = MOV8ri 0\n  CALL64pcrel32 target-flags(x86-plt) @printf, <regmask $bh $bl $bp $bph $bpl $bx $ebp $ebx $hbp $hbx $rbp $rbx $r12 $r13 $r14 $r15 $r12b $r13b $r14b $r15b $r12bh $r13bh $r14bh $r15bh $r12d $r13d $r14d $r15d $r12w $r13w $r14w $r15w $r12wh and 3 more...>, implicit $rsp, implicit $ssp, implicit killed $al, implicit killed $rdi, implicit-def $eax\n  ADJCALLSTACKUP64 0, 0, implicit-def $rsp, implicit-def dead $eflags, implicit-def $ssp, implicit $rsp, implicit $ssp\n  renamable $eax = MOV32r0 implicit-def dead $eflags\n  RET64 implicit killed $eax\n\n# End machine code for function main.\n\n# ",
        "*** IR Dump After Prologue/Epilogue Insertion & Frame Finalization (prologepilog) ***:\n# Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\nFrame Objects:\n  fi#-1: size=8, align=16, fixed, at location [SP-8]\n  fi#0: size=4, align=4, at location [SP-12]\n\nbb.0 (%ir-block.0):\n  frame-setup PUSH64r killed $rbp, implicit-def $rsp, implicit $rsp\n  CFI_INSTRUCTION def_cfa_offset 16\n  CFI_INSTRUCTION offset $rbp, -16\n  $rbp = frame-setup MOV64rr $rsp\n  CFI_INSTRUCTION def_cfa_register $rbp\n  $rsp = frame-setup SUB64ri8 $rsp(tied-def 0), 16, implicit-def dead $eflags\n  MOV32mi $rbp, 1, $noreg, -4, $noreg, 0 :: (store (s32) into %ir.1)\n  renamable $rdi = LEA64r $rip, 1, $noreg, @.str, $noreg\n  $al = MOV8ri 0\n  CALL64pcrel32 target-flags(x86-plt) @printf, <regmask $bh $bl $bp $bph $bpl $bx $ebp $ebx $hbp $hbx $rbp $rbx $r12 $r13 $r14 $r15 $r12b $r13b $r14b $r15b $r12bh $r13bh $r14bh $r15bh $r12d $r13d $r14d $r15d $r12w $r13w $r14w $r15w $r12wh and 3 more...>, implicit $rsp, implicit $ssp, implicit killed $al, implicit killed $rdi, implicit-def $eax\n  renamable $eax = MOV32r0 implicit-def dead $eflags\n  $rsp = frame-destroy ADD64ri8 $rsp(tied-def 0), 16, implicit-def dead $eflags\n  $rbp = frame-destroy POP64r implicit-def $rsp, implicit $rsp\n  CFI_INSTRUCTION def_cfa $rsp, 8\n  RET64 implicit killed $eax\n\n# End machine code for function main.\n\n# ",
        "*** IR Dump After Post-RA pseudo instruction expansion pass (postrapseudos) ***:\n# Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\nFrame Objects:\n  fi#-1: size=8, align=16, fixed, at location [SP-8]\n  fi#0: size=4, align=4, at location [SP-12]\n\nbb.0 (%ir-block.0):\n  frame-setup PUSH64r killed $rbp, implicit-def $rsp, implicit $rsp\n  CFI_INSTRUCTION def_cfa_offset 16\n  CFI_INSTRUCTION offset $rbp, -16\n  $rbp = frame-setup MOV64rr $rsp\n  CFI_INSTRUCTION def_cfa_register $rbp\n  $rsp = frame-setup SUB64ri8 $rsp(tied-def 0), 16, implicit-def dead $eflags\n  MOV32mi $rbp, 1, $noreg, -4, $noreg, 0 :: (store (s32) into %ir.1)\n  renamable $rdi = LEA64r $rip, 1, $noreg, @.str, $noreg\n  $al = MOV8ri 0\n  CALL64pcrel32 target-flags(x86-plt) @printf, <regmask $bh $bl $bp $bph $bpl $bx $ebp $ebx $hbp $hbx $rbp $rbx $r12 $r13 $r14 $r15 $r12b $r13b $r14b $r15b $r12bh $r13bh $r14bh $r15bh $r12d $r13d $r14d $r15d $r12w $r13w $r14w $r15w $r12wh and 3 more...>, implicit $rsp, implicit $ssp, implicit killed $al, implicit killed $rdi, implicit-def $eax\n  renamable $eax = XOR32rr undef $eax(tied-def 0), undef $eax, implicit-def dead $eflags\n  $rsp = frame-destroy ADD64ri8 $rsp(tied-def 0), 16, implicit-def dead $eflags\n  $rbp = frame-destroy POP64r implicit-def $rsp, implicit $rsp\n  CFI_INSTRUCTION def_cfa $rsp, 8\n  RET64 implicit killed $eax\n\n# End machine code for function main.\n\n# ",
        "*** IR Dump After X86 pseudo instruction expansion pass (x86-pseudo) ***:\n# Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\nFrame Objects:\n  fi#-1: size=8, align=16, fixed, at location [SP-8]\n  fi#0: size=4, align=4, at location [SP-12]\n\nbb.0 (%ir-block.0):\n  frame-setup PUSH64r killed $rbp, implicit-def $rsp, implicit $rsp\n  CFI_INSTRUCTION def_cfa_offset 16\n  CFI_INSTRUCTION offset $rbp, -16\n  $rbp = frame-setup MOV64rr $rsp\n  CFI_INSTRUCTION def_cfa_register $rbp\n  $rsp = frame-setup SUB64ri8 $rsp(tied-def 0), 16, implicit-def dead $eflags\n  MOV32mi $rbp, 1, $noreg, -4, $noreg, 0 :: (store (s32) into %ir.1)\n  renamable $rdi = LEA64r $rip, 1, $noreg, @.str, $noreg\n  $al = MOV8ri 0\n  CALL64pcrel32 target-flags(x86-plt) @printf, <regmask $bh $bl $bp $bph $bpl $bx $ebp $ebx $hbp $hbx $rbp $rbx $r12 $r13 $r14 $r15 $r12b $r13b $r14b $r15b $r12bh $r13bh $r14bh $r15bh $r12d $r13d $r14d $r15d $r12w $r13w $r14w $r15w $r12wh and 3 more...>, implicit $rsp, implicit $ssp, implicit killed $al, implicit killed $rdi, implicit-def $eax\n  renamable $eax = XOR32rr undef $eax(tied-def 0), undef $eax, implicit-def dead $eflags\n  $rsp = frame-destroy ADD64ri8 $rsp(tied-def 0), 16, implicit-def dead $eflags\n  $rbp = frame-destroy POP64r implicit-def $rsp, implicit $rsp\n  CFI_INSTRUCTION def_cfa $rsp, 8\n  RET64 implicit killed $eax\n\n# End machine code for function main.\n\n# ",
        "*** IR Dump After Analyze Machine Code For Garbage Collection (gc-analysis) ***:\n# Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\nFrame Objects:\n  fi#-1: size=8, align=16, fixed, at location [SP-8]\n  fi#0: size=4, align=4, at location [SP-12]\n\nbb.0 (%ir-block.0):\n  frame-setup PUSH64r killed $rbp, implicit-def $rsp, implicit $rsp\n  CFI_INSTRUCTION def_cfa_offset 16\n  CFI_INSTRUCTION offset $rbp, -16\n  $rbp = frame-setup MOV64rr $rsp\n  CFI_INSTRUCTION def_cfa_register $rbp\n  $rsp = frame-setup SUB64ri8 $rsp(tied-def 0), 16, implicit-def dead $eflags\n  MOV32mi $rbp, 1, $noreg, -4, $noreg, 0 :: (store (s32) into %ir.1)\n  renamable $rdi = LEA64r $rip, 1, $noreg, @.str, $noreg\n  $al = MOV8ri 0\n  CALL64pcrel32 target-flags(x86-plt) @printf, <regmask $bh $bl $bp $bph $bpl $bx $ebp $ebx $hbp $hbx $rbp $rbx $r12 $r13 $r14 $r15 $r12b $r13b $r14b $r15b $r12bh $r13bh $r14bh $r15bh $r12d $r13d $r14d $r15d $r12w $r13w $r14w $r15w $r12wh and 3 more...>, implicit $rsp, implicit $ssp, implicit killed $al, implicit killed $rdi, implicit-def $eax\n  renamable $eax = XOR32rr undef $eax(tied-def 0), undef $eax, implicit-def dead $eflags\n  $rsp = frame-destroy ADD64ri8 $rsp(tied-def 0), 16, implicit-def dead $eflags\n  $rbp = frame-destroy POP64r implicit-def $rsp, implicit $rsp\n  CFI_INSTRUCTION def_cfa $rsp, 8\n  RET64 implicit killed $eax\n\n# End machine code for function main.\n\n# ",
        "*** IR Dump After Insert fentry calls (fentry-insert) ***:\n# Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\nFrame Objects:\n  fi#-1: size=8, align=16, fixed, at location [SP-8]\n  fi#0: size=4, align=4, at location [SP-12]\n\nbb.0 (%ir-block.0):\n  frame-setup PUSH64r killed $rbp, implicit-def $rsp, implicit $rsp\n  CFI_INSTRUCTION def_cfa_offset 16\n  CFI_INSTRUCTION offset $rbp, -16\n  $rbp = frame-setup MOV64rr $rsp\n  CFI_INSTRUCTION def_cfa_register $rbp\n  $rsp = frame-setup SUB64ri8 $rsp(tied-def 0), 16, implicit-def dead $eflags\n  MOV32mi $rbp, 1, $noreg, -4, $noreg, 0 :: (store (s32) into %ir.1)\n  renamable $rdi = LEA64r $rip, 1, $noreg, @.str, $noreg\n  $al = MOV8ri 0\n  CALL64pcrel32 target-flags(x86-plt) @printf, <regmask $bh $bl $bp $bph $bpl $bx $ebp $ebx $hbp $hbx $rbp $rbx $r12 $r13 $r14 $r15 $r12b $r13b $r14b $r15b $r12bh $r13bh $r14bh $r15bh $r12d $r13d $r14d $r15d $r12w $r13w $r14w $r15w $r12wh and 3 more...>, implicit $rsp, implicit $ssp, implicit killed $al, implicit killed $rdi, implicit-def $eax\n  renamable $eax = XOR32rr undef $eax(tied-def 0), undef $eax, implicit-def dead $eflags\n  $rsp = frame-destroy ADD64ri8 $rsp(tied-def 0), 16, implicit-def dead $eflags\n  $rbp = frame-destroy POP64r implicit-def $rsp, implicit $rsp\n  CFI_INSTRUCTION def_cfa $rsp, 8\n  RET64 implicit killed $eax\n\n# End machine code for function main.\n\n# ",
        "*** IR Dump After Insert XRay ops (xray-instrumentation) ***:\n# Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\nFrame Objects:\n  fi#-1: size=8, align=16, fixed, at location [SP-8]\n  fi#0: size=4, align=4, at location [SP-12]\n\nbb.0 (%ir-block.0):\n  frame-setup PUSH64r killed $rbp, implicit-def $rsp, implicit $rsp\n  CFI_INSTRUCTION def_cfa_offset 16\n  CFI_INSTRUCTION offset $rbp, -16\n  $rbp = frame-setup MOV64rr $rsp\n  CFI_INSTRUCTION def_cfa_register $rbp\n  $rsp = frame-setup SUB64ri8 $rsp(tied-def 0), 16, implicit-def dead $eflags\n  MOV32mi $rbp, 1, $noreg, -4, $noreg, 0 :: (store (s32) into %ir.1)\n  renamable $rdi = LEA64r $rip, 1, $noreg, @.str, $noreg\n  $al = MOV8ri 0\n  CALL64pcrel32 target-flags(x86-plt) @printf, <regmask $bh $bl $bp $bph $bpl $bx $ebp $ebx $hbp $hbx $rbp $rbx $r12 $r13 $r14 $r15 $r12b $r13b $r14b $r15b $r12bh $r13bh $r14bh $r15bh $r12d $r13d $r14d $r15d $r12w $r13w $r14w $r15w $r12wh and 3 more...>, implicit $rsp, implicit $ssp, implicit killed $al, implicit killed $rdi, implicit-def $eax\n  renamable $eax = XOR32rr undef $eax(tied-def 0), undef $eax, implicit-def dead $eflags\n  $rsp = frame-destroy ADD64ri8 $rsp(tied-def 0), 16, implicit-def dead $eflags\n  $rbp = frame-destroy POP64r implicit-def $rsp, implicit $rsp\n  CFI_INSTRUCTION def_cfa $rsp, 8\n  RET64 implicit killed $eax\n\n# End machine code for function main.\n\n# ",
        "*** IR Dump After Implement the 'patchable-function' attribute (patchable-function) ***:\n# Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\nFrame Objects:\n  fi#-1: size=8, align=16, fixed, at location [SP-8]\n  fi#0: size=4, align=4, at location [SP-12]\n\nbb.0 (%ir-block.0):\n  frame-setup PUSH64r killed $rbp, implicit-def $rsp, implicit $rsp\n  CFI_INSTRUCTION def_cfa_offset 16\n  CFI_INSTRUCTION offset $rbp, -16\n  $rbp = frame-setup MOV64rr $rsp\n  CFI_INSTRUCTION def_cfa_register $rbp\n  $rsp = frame-setup SUB64ri8 $rsp(tied-def 0), 16, implicit-def dead $eflags\n  MOV32mi $rbp, 1, $noreg, -4, $noreg, 0 :: (store (s32) into %ir.1)\n  renamable $rdi = LEA64r $rip, 1, $noreg, @.str, $noreg\n  $al = MOV8ri 0\n  CALL64pcrel32 target-flags(x86-plt) @printf, <regmask $bh $bl $bp $bph $bpl $bx $ebp $ebx $hbp $hbx $rbp $rbx $r12 $r13 $r14 $r15 $r12b $r13b $r14b $r15b $r12bh $r13bh $r14bh $r15bh $r12d $r13d $r14d $r15d $r12w $r13w $r14w $r15w $r12wh and 3 more...>, implicit $rsp, implicit $ssp, implicit killed $al, implicit killed $rdi, implicit-def $eax\n  renamable $eax = XOR32rr undef $eax(tied-def 0), undef $eax, implicit-def dead $eflags\n  $rsp = frame-destroy ADD64ri8 $rsp(tied-def 0), 16, implicit-def dead $eflags\n  $rbp = frame-destroy POP64r implicit-def $rsp, implicit $rsp\n  CFI_INSTRUCTION def_cfa $rsp, 8\n  RET64 implicit killed $eax\n\n# End machine code for function main.\n\n# ",
        "*** IR Dump After Compressing EVEX instrs to VEX encoding when possible (x86-evex-to-vex-compress) ***:\n# Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\nFrame Objects:\n  fi#-1: size=8, align=16, fixed, at location [SP-8]\n  fi#0: size=4, align=4, at location [SP-12]\n\nbb.0 (%ir-block.0):\n  frame-setup PUSH64r killed $rbp, implicit-def $rsp, implicit $rsp\n  CFI_INSTRUCTION def_cfa_offset 16\n  CFI_INSTRUCTION offset $rbp, -16\n  $rbp = frame-setup MOV64rr $rsp\n  CFI_INSTRUCTION def_cfa_register $rbp\n  $rsp = frame-setup SUB64ri8 $rsp(tied-def 0), 16, implicit-def dead $eflags\n  MOV32mi $rbp, 1, $noreg, -4, $noreg, 0 :: (store (s32) into %ir.1)\n  renamable $rdi = LEA64r $rip, 1, $noreg, @.str, $noreg\n  $al = MOV8ri 0\n  CALL64pcrel32 target-flags(x86-plt) @printf, <regmask $bh $bl $bp $bph $bpl $bx $ebp $ebx $hbp $hbx $rbp $rbx $r12 $r13 $r14 $r15 $r12b $r13b $r14b $r15b $r12bh $r13bh $r14bh $r15bh $r12d $r13d $r14d $r15d $r12w $r13w $r14w $r15w $r12wh and 3 more...>, implicit $rsp, implicit $ssp, implicit killed $al, implicit killed $rdi, implicit-def $eax\n  renamable $eax = XOR32rr undef $eax(tied-def 0), undef $eax, implicit-def dead $eflags\n  $rsp = frame-destroy ADD64ri8 $rsp(tied-def 0), 16, implicit-def dead $eflags\n  $rbp = frame-destroy POP64r implicit-def $rsp, implicit $rsp\n  CFI_INSTRUCTION def_cfa $rsp, 8\n  RET64 implicit killed $eax\n\n# End machine code for function main.\n\n# ",
        "*** IR Dump After Contiguously Lay Out Funclets (funclet-layout) ***:\n# Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\nFrame Objects:\n  fi#-1: size=8, align=16, fixed, at location [SP-8]\n  fi#0: size=4, align=4, at location [SP-12]\n\nbb.0 (%ir-block.0):\n  frame-setup PUSH64r killed $rbp, implicit-def $rsp, implicit $rsp\n  CFI_INSTRUCTION def_cfa_offset 16\n  CFI_INSTRUCTION offset $rbp, -16\n  $rbp = frame-setup MOV64rr $rsp\n  CFI_INSTRUCTION def_cfa_register $rbp\n  $rsp = frame-setup SUB64ri8 $rsp(tied-def 0), 16, implicit-def dead $eflags\n  MOV32mi $rbp, 1, $noreg, -4, $noreg, 0 :: (store (s32) into %ir.1)\n  renamable $rdi = LEA64r $rip, 1, $noreg, @.str, $noreg\n  $al = MOV8ri 0\n  CALL64pcrel32 target-flags(x86-plt) @printf, <regmask $bh $bl $bp $bph $bpl $bx $ebp $ebx $hbp $hbx $rbp $rbx $r12 $r13 $r14 $r15 $r12b $r13b $r14b $r15b $r12bh $r13bh $r14bh $r15bh $r12d $r13d $r14d $r15d $r12w $r13w $r14w $r15w $r12wh and 3 more...>, implicit $rsp, implicit $ssp, implicit killed $al, implicit killed $rdi, implicit-def $eax\n  renamable $eax = XOR32rr undef $eax(tied-def 0), undef $eax, implicit-def dead $eflags\n  $rsp = frame-destroy ADD64ri8 $rsp(tied-def 0), 16, implicit-def dead $eflags\n  $rbp = frame-destroy POP64r implicit-def $rsp, implicit $rsp\n  CFI_INSTRUCTION def_cfa $rsp, 8\n  RET64 implicit killed $eax\n\n# End machine code for function main.\n\n# ",
        "*** IR Dump After StackMap Liveness Analysis (stackmap-liveness) ***:\n# Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\nFrame Objects:\n  fi#-1: size=8, align=16, fixed, at location [SP-8]\n  fi#0: size=4, align=4, at location [SP-12]\n\nbb.0 (%ir-block.0):\n  frame-setup PUSH64r killed $rbp, implicit-def $rsp, implicit $rsp\n  CFI_INSTRUCTION def_cfa_offset 16\n  CFI_INSTRUCTION offset $rbp, -16\n  $rbp = frame-setup MOV64rr $rsp\n  CFI_INSTRUCTION def_cfa_register $rbp\n  $rsp = frame-setup SUB64ri8 $rsp(tied-def 0), 16, implicit-def dead $eflags\n  MOV32mi $rbp, 1, $noreg, -4, $noreg, 0 :: (store (s32) into %ir.1)\n  renamable $rdi = LEA64r $rip, 1, $noreg, @.str, $noreg\n  $al = MOV8ri 0\n  CALL64pcrel32 target-flags(x86-plt) @printf, <regmask $bh $bl $bp $bph $bpl $bx $ebp $ebx $hbp $hbx $rbp $rbx $r12 $r13 $r14 $r15 $r12b $r13b $r14b $r15b $r12bh $r13bh $r14bh $r15bh $r12d $r13d $r14d $r15d $r12w $r13w $r14w $r15w $r12wh and 3 more...>, implicit $rsp, implicit $ssp, implicit killed $al, implicit killed $rdi, implicit-def $eax\n  renamable $eax = XOR32rr undef $eax(tied-def 0), undef $eax, implicit-def dead $eflags\n  $rsp = frame-destroy ADD64ri8 $rsp(tied-def 0), 16, implicit-def dead $eflags\n  $rbp = frame-destroy POP64r implicit-def $rsp, implicit $rsp\n  CFI_INSTRUCTION def_cfa $rsp, 8\n  RET64 implicit killed $eax\n\n# End machine code for function main.\n\n# ",
        "*** IR Dump After Live DEBUG_VALUE analysis (livedebugvalues) ***:\n# Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\nFrame Objects:\n  fi#-1: size=8, align=16, fixed, at location [SP-8]\n  fi#0: size=4, align=4, at location [SP-12]\n\nbb.0 (%ir-block.0):\n  frame-setup PUSH64r killed $rbp, implicit-def $rsp, implicit $rsp\n  CFI_INSTRUCTION def_cfa_offset 16\n  CFI_INSTRUCTION offset $rbp, -16\n  $rbp = frame-setup MOV64rr $rsp\n  CFI_INSTRUCTION def_cfa_register $rbp\n  $rsp = frame-setup SUB64ri8 $rsp(tied-def 0), 16, implicit-def dead $eflags\n  MOV32mi $rbp, 1, $noreg, -4, $noreg, 0 :: (store (s32) into %ir.1)\n  renamable $rdi = LEA64r $rip, 1, $noreg, @.str, $noreg\n  $al = MOV8ri 0\n  CALL64pcrel32 target-flags(x86-plt) @printf, <regmask $bh $bl $bp $bph $bpl $bx $ebp $ebx $hbp $hbx $rbp $rbx $r12 $r13 $r14 $r15 $r12b $r13b $r14b $r15b $r12bh $r13bh $r14bh $r15bh $r12d $r13d $r14d $r15d $r12w $r13w $r14w $r15w $r12wh and 3 more...>, implicit $rsp, implicit $ssp, implicit killed $al, implicit killed $rdi, implicit-def $eax\n  renamable $eax = XOR32rr undef $eax(tied-def 0), undef $eax, implicit-def dead $eflags\n  $rsp = frame-destroy ADD64ri8 $rsp(tied-def 0), 16, implicit-def dead $eflags\n  $rbp = frame-destroy POP64r implicit-def $rsp, implicit $rsp\n  CFI_INSTRUCTION def_cfa $rsp, 8\n  RET64 implicit killed $eax\n\n# End machine code for function main.\n\n# ",
        "*** IR Dump After X86 Speculative Execution Side Effect Suppression (x86-seses) ***:\n# Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\nFrame Objects:\n  fi#-1: size=8, align=16, fixed, at location [SP-8]\n  fi#0: size=4, align=4, at location [SP-12]\n\nbb.0 (%ir-block.0):\n  frame-setup PUSH64r killed $rbp, implicit-def $rsp, implicit $rsp\n  CFI_INSTRUCTION def_cfa_offset 16\n  CFI_INSTRUCTION offset $rbp, -16\n  $rbp = frame-setup MOV64rr $rsp\n  CFI_INSTRUCTION def_cfa_register $rbp\n  $rsp = frame-setup SUB64ri8 $rsp(tied-def 0), 16, implicit-def dead $eflags\n  MOV32mi $rbp, 1, $noreg, -4, $noreg, 0 :: (store (s32) into %ir.1)\n  renamable $rdi = LEA64r $rip, 1, $noreg, @.str, $noreg\n  $al = MOV8ri 0\n  CALL64pcrel32 target-flags(x86-plt) @printf, <regmask $bh $bl $bp $bph $bpl $bx $ebp $ebx $hbp $hbx $rbp $rbx $r12 $r13 $r14 $r15 $r12b $r13b $r14b $r15b $r12bh $r13bh $r14bh $r15bh $r12d $r13d $r14d $r15d $r12w $r13w $r14w $r15w $r12wh and 3 more...>, implicit $rsp, implicit $ssp, implicit killed $al, implicit killed $rdi, implicit-def $eax\n  renamable $eax = XOR32rr undef $eax(tied-def 0), undef $eax, implicit-def dead $eflags\n  $rsp = frame-destroy ADD64ri8 $rsp(tied-def 0), 16, implicit-def dead $eflags\n  $rbp = frame-destroy POP64r implicit-def $rsp, implicit $rsp\n  CFI_INSTRUCTION def_cfa $rsp, 8\n  RET64 implicit killed $eax\n\n# End machine code for function main.\n\n# ",
        "*** IR Dump After Check CFA info and insert CFI instructions if needed (cfi-instr-inserter) ***:\n# Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\nFrame Objects:\n  fi#-1: size=8, align=16, fixed, at location [SP-8]\n  fi#0: size=4, align=4, at location [SP-12]\n\nbb.0 (%ir-block.0):\n  frame-setup PUSH64r killed $rbp, implicit-def $rsp, implicit $rsp\n  CFI_INSTRUCTION def_cfa_offset 16\n  CFI_INSTRUCTION offset $rbp, -16\n  $rbp = frame-setup MOV64rr $rsp\n  CFI_INSTRUCTION def_cfa_register $rbp\n  $rsp = frame-setup SUB64ri8 $rsp(tied-def 0), 16, implicit-def dead $eflags\n  MOV32mi $rbp, 1, $noreg, -4, $noreg, 0 :: (store (s32) into %ir.1)\n  renamable $rdi = LEA64r $rip, 1, $noreg, @.str, $noreg\n  $al = MOV8ri 0\n  CALL64pcrel32 target-flags(x86-plt) @printf, <regmask $bh $bl $bp $bph $bpl $bx $ebp $ebx $hbp $hbx $rbp $rbx $r12 $r13 $r14 $r15 $r12b $r13b $r14b $r15b $r12bh $r13bh $r14bh $r15bh $r12d $r13d $r14d $r15d $r12w $r13w $r14w $r15w $r12wh and 3 more...>, implicit $rsp, implicit $ssp, implicit killed $al, implicit killed $rdi, implicit-def $eax\n  renamable $eax = XOR32rr undef $eax(tied-def 0), undef $eax, implicit-def dead $eflags\n  $rsp = frame-destroy ADD64ri8 $rsp(tied-def 0), 16, implicit-def dead $eflags\n  $rbp = frame-destroy POP64r implicit-def $rsp, implicit $rsp\n  CFI_INSTRUCTION def_cfa $rsp, 8\n  RET64 implicit killed $eax\n\n# End machine code for function main.\n\n# ",
        "*** IR Dump After X86 Load Value Injection (LVI) Ret-Hardening (x86-lvi-ret) ***:\n# Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\nFrame Objects:\n  fi#-1: size=8, align=16, fixed, at location [SP-8]\n  fi#0: size=4, align=4, at location [SP-12]\n\nbb.0 (%ir-block.0):\n  frame-setup PUSH64r killed $rbp, implicit-def $rsp, implicit $rsp\n  CFI_INSTRUCTION def_cfa_offset 16\n  CFI_INSTRUCTION offset $rbp, -16\n  $rbp = frame-setup MOV64rr $rsp\n  CFI_INSTRUCTION def_cfa_register $rbp\n  $rsp = frame-setup SUB64ri8 $rsp(tied-def 0), 16, implicit-def dead $eflags\n  MOV32mi $rbp, 1, $noreg, -4, $noreg, 0 :: (store (s32) into %ir.1)\n  renamable $rdi = LEA64r $rip, 1, $noreg, @.str, $noreg\n  $al = MOV8ri 0\n  CALL64pcrel32 target-flags(x86-plt) @printf, <regmask $bh $bl $bp $bph $bpl $bx $ebp $ebx $hbp $hbx $rbp $rbx $r12 $r13 $r14 $r15 $r12b $r13b $r14b $r15b $r12bh $r13bh $r14bh $r15bh $r12d $r13d $r14d $r15d $r12w $r13w $r14w $r15w $r12wh and 3 more...>, implicit $rsp, implicit $ssp, implicit killed $al, implicit killed $rdi, implicit-def $eax\n  renamable $eax = XOR32rr undef $eax(tied-def 0), undef $eax, implicit-def dead $eflags\n  $rsp = frame-destroy ADD64ri8 $rsp(tied-def 0), 16, implicit-def dead $eflags\n  $rbp = frame-destroy POP64r implicit-def $rsp, implicit $rsp\n  CFI_INSTRUCTION def_cfa $rsp, 8\n  RET64 implicit killed $eax\n\n# End machine code for function main.\n\n# ",
        "*** IR Dump After Pseudo Probe Inserter (pseudo-probe-inserter) ***:\n# Machine code for function main: NoPHIs, TracksLiveness, NoVRegs, TiedOpsRewritten\nFrame Objects:\n  fi#-1: size=8, align=16, fixed, at location [SP-8]\n  fi#0: size=4, align=4, at location [SP-12]\n\nbb.0 (%ir-block.0):\n  frame-setup PUSH64r killed $rbp, implicit-def $rsp, implicit $rsp\n  CFI_INSTRUCTION def_cfa_offset 16\n  CFI_INSTRUCTION offset $rbp, -16\n  $rbp = frame-setup MOV64rr $rsp\n  CFI_INSTRUCTION def_cfa_register $rbp\n  $rsp = frame-setup SUB64ri8 $rsp(tied-def 0), 16, implicit-def dead $eflags\n  MOV32mi $rbp, 1, $noreg, -4, $noreg, 0 :: (store (s32) into %ir.1)\n  renamable $rdi = LEA64r $rip, 1, $noreg, @.str, $noreg\n  $al = MOV8ri 0\n  CALL64pcrel32 target-flags(x86-plt) @printf, <regmask $bh $bl $bp $bph $bpl $bx $ebp $ebx $hbp $hbx $rbp $rbx $r12 $r13 $r14 $r15 $r12b $r13b $r14b $r15b $r12bh $r13bh $r14bh $r15bh $r12d $r13d $r14d $r15d $r12w $r13w $r14w $r15w $r12wh and 3 more...>, implicit $rsp, implicit $ssp, implicit killed $al, implicit killed $rdi, implicit-def $eax\n  renamable $eax = XOR32rr undef $eax(tied-def 0), undef $eax, implicit-def dead $eflags\n  $rsp = frame-destroy ADD64ri8 $rsp(tied-def 0), 16, implicit-def dead $eflags\n  $rbp = frame-destroy POP64r implicit-def $rsp, implicit $rsp\n  CFI_INSTRUCTION def_cfa $rsp, 8\n  RET64 implicit killed $eax\n\n# End machine code for function main.\n\n1 warning generated.\n"
      ],

      "liste_explicationO1": ["explication1"],
      "liste_llO1": [
        [
          "; ModuleID = 'fichier.c' EXEMPLE 1",
          "source_filename = \"fichier.c\"",
          "target datalayout = \"e-m:e-p270:32:32-p271:32:32-p272:64:64-i64:64-f80:128-n8:16:32:64-S128\"",
          "target triple = \"x86_64-pc-linux-gnu\""
        ]
      ],
      "liste_passesO1": [`; ModuleID = 'fichier.c' EXEMPLE 1\nsource_filename = "non"\ntarget datalayout = "e-m:e-p270:32:32-p271:32:32-p272:64:64-i64:64-f80:128-n8:16:32:64-S128"\ntarget triple = "toujours pas"`],
      "liste_diffsO1": [`-; ModuleID = 'fichier.c' EXEMPLE 1\n+target triple = "toujours pas"`],

      "liste_explicationO2": ["explication2"],
      "liste_llO2": [
        [
          "; ModuleID = 'fichier.c' EXEMPLE 2",
          "source_filename = \"fichier.c\"",
          "target datalayout = \"e-m:e-p270:32:32-p271:32:32-p272:64:64-i64:64-f80:128-n8:16:32:64-S128\"",
          "target triple = \"x86_64-pc-linux-gnu\""
        ]
      ],
      "liste_passesO2": ["pass2"],
      "liste_diffsO2": ["difference2"],

      "liste_explicationO3": ["explication3"],
      "liste_llO3": [
        [
          "; ModuleID = 'fichier.c' EXEMPLE 3",
          "source_filename = \"fichier.c\"",
          "target datalayout = \"e-m:e-p270:32:32-p271:32:32-p272:64:64-i64:64-f80:128-n8:16:32:64-S128\"",
          "target triple = \"x86_64-pc-linux-gnu\""
        ]
      ],
      "liste_passesO3": ["pass3"],
      "liste_diffsO3": ["difference3"],


      "status": "success"
    };
    //ajout du ll comme premier pass à chaque niveau d'opti
    for (let niveau of ["0", "1", "2", "3"]) {
      var codeIR = donnees["liste_llO"+niveau].map((elem) => elem.join("\n"));
      codeIR = codeIR.join("\n");
      donnees["liste_passesO"+niveau].unshift(codeIR);
    }
    reponseIA.current = {
      liste_c: donnees["liste_c"],
      liste_explicationO0: donnees["liste_explicationO0"],
      liste_llO0: donnees["liste_llO0"],
      liste_passesO0: donnees["liste_passesO0"],
      liste_diffsO0: donnees["liste_diffsO0"],
      liste_explicationO1: donnees["liste_explicationO1"],
      liste_llO1: donnees["liste_llO1"],
      liste_passesO1: donnees["liste_passesO1"],
      liste_diffsO1: donnees["liste_diffsO1"],
      liste_explicationO2: donnees["liste_explicationO2"],
      liste_llO2: donnees["liste_llO2"],
      liste_passesO2: donnees["liste_passesO2"],
      liste_diffsO2: donnees["liste_diffsO2"],
      liste_explicationO3: donnees["liste_explicationO3"],
      liste_llO3: donnees["liste_llO3"],
      liste_passesO3: donnees["liste_passesO3"],
      liste_diffsO3: donnees["liste_diffsO3"],
    };
    
    majReponseIA(reponseIA.current?.liste_llO0 ?? [], reponseIA.current?.liste_explicationO0 ?? [], reponseIA.current?.liste_diffsO0 ?? [])
  }, []);


  useEffect(() => { //met à jour l'affichage lors de l'appuie sur les flèches.
    let listePass = reponseIA.current?.["liste_passesO" + niveau_optimisation] ?? [];
    previousPass.current.dispatch({
      changes: {
        from: 0,
        to: previousPass.current.state.doc.length,
        insert: listePass[currentPass] ?? "",
      }
    });
    nextPass.current.dispatch({
      changes: {
        from: 0,
        to: nextPass.current.state.doc.length,
        insert: listePass[currentPass + 1] ?? "",
      }
    });

    requestUpdateLines(previousPass.current, currentPass)
    requestUpdateLines(nextPass.current, currentPass)
  }, [currentPass]);

  //met à jour la langue dans les éléments de index.html
  useEffect(() => {
    const h = document.getElementById('app-header');
    const title = document.getElementById('app-title');
    if (h) h.textContent = t('title');
    if (title) title.textContent = t('app-title');
  }, [t, i18n.language]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      e = e || window.event;
      if (e.keyCode === 37) {
        handleNavigation('previous');
      } else if (e.keyCode === 39) {
        handleNavigation('next');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleNavigation]);

  function majReponseIA(listeLL, listeExplications, listeDiffs) {
    const isResponseObject = reponseIA.current && typeof reponseIA.current === 'object' && listeLL;

    let listePass = reponseIA.current?.["liste_passesO" + niveau_optimisation] ?? [];

    if (isResponseObject) {
      setMessage('');
      var code = "";
      var h = 150; //hue
      var lesCouleursOutput = [];
      var lesCouleursInput = [];
      var tabNumLignesCodeIR = []; //représente la structure du code IR en blocs
      var tabNumLignesCodeC = []; //représente la structure du code C en blocs de 1 ligne
      var numLigneIR = 1;
      var numLigneC = 1;
      //création du bloc de code et de la liste des couleurs pour chaque ligne de l'outputEditor et de l'inputEditor
      for (let bloc of listeLL) {
        const couleur = `hsla(${h} 65 65 / 40%)`;
        tabNumLignesCodeIR.push([]); //on ajoute un bloc de code IR
        tabNumLignesCodeC.push([numLigneC++]);
        for (let ligne of bloc) {
          tabNumLignesCodeIR.at(-1).push(numLigneIR++); //on ajoute une ligne (représentée par son numéro) au bloc 
          code += ligne + "\n";
          lesCouleursOutput.push("background: " + couleur);
        }
        lesCouleursInput.push("background: " + couleur);
        h = (h + 30) % 360;
      }
      code = code.slice(0, -2); //supprime le dernier \n

      outputRef.current.dispatch({
        changes: {
          from: 0,
          to: outputRef.current.state.doc.length,
          insert: code,
        },
        effects: outputHighlighterCompartment.reconfigure(
          createLineHoverHighlighter(
            lesCouleursOutput,
            listeExplications,
            tabNumLignesCodeC,
            tabNumLignesCodeIR,
            setExplications,
            'output',
            inputRef,
            outputRef)
        )
      });
      inputRef.current.dispatch({
        effects: inputHighlighterCompartment.reconfigure(
          createLineHoverHighlighter(
            lesCouleursInput,
            listeExplications,
            tabNumLignesCodeC,
            tabNumLignesCodeIR,
            setExplications,
            'input',
            inputRef,
            outputRef)
        )
      });
      previousPass.current.dispatch({
        changes: {
          from: 0,
          to: previousPass.current.state.doc.length,
          insert: listePass[currentPass] ?? "",
        },
        effects: previousPassHighlighterCompartment.reconfigure(
          createLineDiffHiglighter(
            'previous',
            listeDiffs)
        )
      });
      nextPass.current.dispatch({
        changes: {
          from: 0,
          to: nextPass.current.state.doc.length,
          insert: listePass[currentPass + 1] ?? "",
        },
        effects: nextPassHighlighterCompartment.reconfigure(
          createLineDiffHiglighter(
            'next',
            listeDiffs)
        )
      })
    } else {
      setMessage(typeof reponseIA.current === 'string' ? reponseIA.current : JSON.stringify(reponseIA.current, null, 2));
    }
    setCurrentPass(0);
    const totalPasses = reponseIA.current?.["liste_passesO" + niveau_optimisation]?.length ?? 1;
    setNbPasses(Math.max(0, totalPasses - 1));
  };


  const handleValidate = async () => {
    setMessage('traduction en cours...');
    try {
      const reponse = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inputRef.current.state.doc.toString() })
      })

      const texteBrut = await reponse.text()

      try {
        const donnees = JSON.parse(texteBrut)
        if (donnees.status === 'success') {
          //ajout du code non optimisé de chaque niveau (O0, O1, ..) en première position de leur liste repective
          for (let niveau of ["00", "01", "02", "03"]) {
            var codeIR = donnees["optimisations"][niveau]["liste_ll"].map((elem) => elem.join("\n"));
            codeIR = codeIR.join("\n");
            donnees["optimisations"][niveau]["liste_passes"].unshift(codeIR);
          }
          reponseIA.current = {
            liste_c: donnees["liste_c"],
            liste_explicationO0: donnees["optimisations"]["00"]["liste_explication"],
            liste_llO0: donnees["optimisations"]["00"]["liste_ll"],
            liste_passesO0: donnees["optimisations"]["00"]["liste_passes"],
            liste_diffsO0: donnees["optimisations"]["00"]["liste_diffs"],
            liste_explicationO1: donnees["optimisations"]["01"]["liste_explication"],
            liste_llO1: donnees["optimisations"]["01"]["liste_ll"],
            liste_passesO1: donnees["optimisations"]["01"]["liste_passes"],
            liste_diffsO1: donnees["optimisations"]["01"]["liste_diffs"],
            liste_explicationO2: donnees["optimisations"]["02"]["liste_explication"],
            liste_llO2: donnees["optimisations"]["02"]["liste_ll"],
            liste_passesO2: donnees["optimisations"]["02"]["liste_passes"],
            liste_diffsO2: donnees["optimisations"]["02"]["liste_diffs"],
            liste_explicationO3: donnees["optimisations"]["03"]["liste_explication"],
            liste_llO3: donnees["optimisations"]["03"]["liste_ll"],
            liste_passesO3: donnees["optimisations"]["03"]["liste_passes"],
            liste_diffsO3: donnees["optimisations"]["03"]["liste_diffs"],
          };
        } else {
          reponseIA.current = "Erreur du serveur : " + donnees.message;
        }
      } catch (erreurParse) {
        // 4. Si la transformation plante (ce n'est pas du JSON), on affiche l'erreur brute
        reponseIA.current = "Erreur inattendue (Nginx ou plantage Flask) :\n\n" + texteBrut;
      }
    } catch (error) {
      reponseIA.current = 'Erreur de réseau ou serveur injoignable : ' + error.message;
    }
    majReponseIA(reponseIA.current?.liste_llO0 ?? [], reponseIA.current?.liste_explicationO0 ?? [], reponseIA.current?.liste_diffsO0 ?? []);
  }

  function handleNavigation(direction) {
    const listePass = reponseIA.current?.["liste_passesO" + niveau_optimisation] ?? [];
    const longueurListePass = listePass.length;
    if (longueurListePass === 0) return;
    const maxIndex = Math.max(0, longueurListePass - 2);
    const nextPassIndex = direction === "next"
      ? (currentPass >= maxIndex ? maxIndex : currentPass + 1)
      : (currentPass === 0 ? 0 : currentPass - 1);
    setCurrentPass(nextPassIndex);
  }

  const inputExtensions = [
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    lineNumbers(),
    cpp(),
    inputHighlighterCompartment.of([]),
    lineClickHandler,
    EditorView.lineWrapping
  ]
  const outputExtensions = [
    lineNumbers(),
    outputHighlighterCompartment.of([]),
    lineClickHandler,
    irLanguage,
    syntaxHighlighting(irHighlight),
    EditorState.readOnly.of(true),
    EditorView.lineWrapping,
  ]
  const nextPassExtensions = [
    lineNumbers(),
    irLanguage,
    syntaxHighlighting(irHighlight),
    EditorState.readOnly.of(true),
    EditorView.lineWrapping,
    nextPassHighlighterCompartment.of([]),
  ]
  const previousPassExtensions = [
    lineNumbers(),
    irLanguage,
    syntaxHighlighting(irHighlight),
    EditorState.readOnly.of(true),
    EditorView.lineWrapping,
    previousPassHighlighterCompartment.of([]),
  ]

  return (
    <>
      <div className="language-selector">
        <label htmlFor="language-select">Langue :</label>
        <select id="language-select" value={language} onChange={handleLanguageChange}>
          <option value="fr">Français</option>
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
      </div>
      <div className="flex-container">
        <Editor
          editorRef={inputRef}
          doc={"int main() {\n    printf(\"Hello, world!\\n\");\n    return 0;\n}"}
          extensions={inputExtensions}
          langage={t("C_code")}
        />
        <Editor
          editorRef={outputRef}
          extensions={outputExtensions}
          langage={t("IR_code")}
        />
      </div>
      <div>
        <button onClick={() => { niveau_optimisation = 0; majReponseIA(reponseIA.current?.liste_llO0 ?? [], reponseIA.current?.liste_explicationO0 ?? [], reponseIA.current?.liste_diffsO0 ?? []) }}>O0</button>
        <button onClick={() => { niveau_optimisation = 1; majReponseIA(reponseIA.current?.liste_llO1 ?? [], reponseIA.current?.liste_explicationO1 ?? [], reponseIA.current?.liste_diffsO1 ?? []) }}>O1</button>
        <button onClick={() => { niveau_optimisation = 2; majReponseIA(reponseIA.current?.liste_llO2 ?? [], reponseIA.current?.liste_explicationO2 ?? [], reponseIA.current?.liste_diffsO2 ?? []) }}>O2</button>
        <button onClick={() => { niveau_optimisation = 3; majReponseIA(reponseIA.current?.liste_llO3 ?? [], reponseIA.current?.liste_explicationO3 ?? [], reponseIA.current?.liste_diffsO3 ?? []) }}>O3</button>
        <button className="btnValider" onClick={handleValidate}>{t('submit')}</button>
        <p>{message}</p>
      </div>

      <div className="explications">{explications}</div>

      <div className="flex-container">
        <button className="btnNavigation" onClick={() => handleNavigation("previous")}>previous</button>
        <div><h2>pass {`${currentPass + 1} / ${nbPasses} : ${((reponseIA.current?.["liste_passesO" + niveau_optimisation]?.[currentPass + 1] ?? "").match(/^\s*\*\*\* IR Dump After .* \*\*\*:?$/m)?.[0] ?? "")} `}</h2></div>
        <button className="btnNavigation" onClick={() => handleNavigation("next")}>next</button>
      </div>
      <div className="flex-container">
        <Editor
          editorRef={previousPass}
          extensions={previousPassExtensions}
          langage={t('code_version') + ` ${currentPass + 1}`}
        />
        <Editor
          editorRef={nextPass}
          extensions={nextPassExtensions}
          langage={t('code_version') + ` ${currentPass + 2}`}
        />
      </div>
    </>
  )
}