---
paths:
  - "src/pptx/**"
  - "src/cli/pptx.ts"
---

# PPTX-Export (`src/pptx/`, `src/cli/pptx.ts`)

- Ablauf: Druckansicht in Edge/Chrome (Viewport 1400 × 900, Faktor 2) → `extractPages` (als `fn.toString()` per CDP ausgewertet, **in sich geschlossen**, keine Imports) beschreibt jede Seite als Objekte (`model.ts`) → Aufnahmen → `buildPptx`. Maße in Bühnen-Pixeln (1280 × 720 = 13,33 × 7,5 Zoll), Schrift px × 0,75 = pt.
- Drei Ebenen je Folie: Hintergrundbild (Seite mit durchsichtigem Text, `html.hm-bg`; Bilder/Tabellen/Diagramme per `data-pn/pt/pr` ausgeblendet; Pseudo-Elemente behalten ihre Farbe über `--hm-pb/--hm-pa`), darüber Bilder bzw. Einzelaufnahmen (`html.hm-r`, durchsichtig), darüber der native Text. Dekoration, die im DOM nach einem Bild liegt und es überlappt (Sprechblasen, Rahmen), wird als `overlay`-Bild über das Bild gelegt, sonst läge sie darunter.
- Ohne Dekoration (`solidBg`) gibt es kein Hintergrundbild, nur eine Folienfarbe. Inline-Elemente mit Hintergrund (Inline-Code) werden zur Textmarkierung (`data-ph`), nicht zur Kachel.
- pptxgenjs-Eigenheiten: Ein Lauf mit `bullet` beginnt immer einen neuen Absatz (Absatz-Eigenschaften nur am ersten Lauf); Aufzählungsfarbe fehlt, `colorBullets` setzt `buClr` per XML nach (nur wenn die Anzahl stimmt); Tabellenränder ≥ 1 gelten als Punkte.
- Formeln: `.katex-display` und Absätze/Listenpunkte mit Formel im Satz (`hasInlineMath`) werden Bilder (die Lücke einer Formel im Text per geschützten Leerzeichen zu treffen, war unzuverlässig); in Tabellenzellen bleibt eine Lücke mit gemessener Breite. Rasterbox einer Formel = Vereinigung der Nachkommen (Brüche ragen aus der Box). `\htmlData{step=n}` im Formelbild wird ein eigenes Bild mit Schritt.
- Animationen (`animate.ts`): `extractPages({ animate })` zeigt alle Schritte (`step-hidden`/`step-current` entfernt) und liest `data-step`/`data-until` über `stepOf` (vererbt sich nach unten). Elemente bekommen `from`/`until` (Klick), Listen- und Codeabsätze `Para.from`. Dekoration mit Schritt wird ein `overlay`-Bild (Text unsichtbar, Pseudo-Elemente mit Farbe), Mermaid-Versionen (`.mermaid-state`) und Tabellenzeilen-Gruppen eigene Formen. `timingXml` schreibt `<p:timing>` (Einblenden `presetID=10`, Absatzbereiche `pRg`, `bldP build="p"`), `finish` setzt es nach Namen → Form-IDs ein; davor `<p:transition>`. Aus bei `steps=1` oder `anim=0` (`wantsAnimation`).
- Prüfen: PowerPoint ist hier installiert, `Presentations.Open` + `Export(dir,'PNG',1280,720)` per COM und Vergleich mit Browser-Screenshots. Animationen: `Slide.TimeLine.MainSequence` (Effekte, `Exit`, `Paragraph`) und `SlideShowTransition.EntryEffect` lesen. **Keinen Bildschirm abfotografieren** (`CopyFromScreen` zeigt den echten Desktop des Nutzers) und PowerPoint nie per `taskkill` beenden (könnte das des Nutzers sein): `$app.Quit()` des selbst gestarteten Objekts genügt.
