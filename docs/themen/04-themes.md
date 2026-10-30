# Themes und Firmen-Look {id=themes}

```yaml
theme:
  extends: minimal
  tokens:
    color-accent: "#e30613"
    font-heading: "Georgia, serif"
  layouts: ./theme/layouts
  css: ./theme/brand.css
```

::: notes
Ein **Theme** bestimmt das Aussehen: Farben, Schriften, Abstände und auf Wunsch eigene Layouts. Eingebaut sind `minimal` (hell) und `dark-tech` (dunkel, wie dieses Handbuch). Diagramme (Mermaid), Code-Hervorhebung und Hinweiskästen übernehmen die Farben von selbst.

`theme:` in der `deck.yaml` darf ein Name sein (`theme: dark-tech`), ein Pfad zu einer CSS-Datei oder einem Theme-Ordner, oder ein Block wie oben. Das Beispiel-Deck „Eigenes Theme“ zeigt einen vollständigen Firmen-Look.
:::

## Tokens {id=tokens}

| Token | Wofür |
| --- | --- |
| `color-bg`, `color-fg` | Hintergrund und Text |
| `color-accent` | Akzent: Marker, Linien, Hervorhebung |
| `color-heading`, `color-muted` | Überschriften, Nebentext |
| `color-surface`, `color-border` | Flächen von Karten und Kästen |
| `font-heading`, `font-body`, `font-code` | Schriften |
| `radius` | Rundung der Ecken |

::: notes
Tokens sind die Stellschrauben eines Themes. Unter `tokens:` überschreibst du einzelne davon, ohne CSS zu schreiben; der Name ist der Token ohne die zwei Striche (`color-accent` statt `--color-accent`). Tokens gewinnen immer, auch gegen Zusatz-CSS. Weitere Tokens: `color-success`, `color-warning`, `color-important` und `color-danger` für Hinweiskästen und Diagrammklassen, `space-1` bis `space-4` für Abstände und die `shiki-*`-Farben für Code.

Schriften kommen aus dem System, damit alles offline bleibt. Eine eigene Schrift legst du als Datei in den Theme-Ordner und bindest sie per `@font-face` im Zusatz-CSS ein.
:::

## Eigene Layouts {id=eigene-layouts}

```css
.layout-kennzahl .content ul {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}
```

::: notes
Ein eigenes Layout ist eine CSS-Datei im Ordner unter `layouts:`. Der Selektor `.layout-<name>` zählt, auf der Folie setzt du dann `{layout=kennzahl}`. Mit `var(--color-accent)` und den anderen Tokens passt sich das Layout jedem Theme an. Unter `css:` legst du weitere Regeln ab, etwa Logo und Fußzeile; eine Datei oder eine Liste.

Ein Theme-Ordner (`theme.css`, `layouts/`, Bilder, Schriften) lässt sich in mehreren Decks wiederverwenden: `extends: ../acme`.
:::

## Komponenten {id=komponenten}

```html
<aside class="fact">
  <div class="fact-title">{{ title }}</div>
  <div class="fact-text">{{{ body }}}</div>
</aside>
```

::: notes
Eine Komponente ist ein eigener Container aus einer HTML-Vorlage. Die Datei `components/fact.html` im Deck- oder Theme-Ordner macht aus `::: fact title="…"` einen Baustein, `fact.css` daneben gestaltet ihn. `{{ title }}` setzt ein Attribut ein, `{{{ body }}}` den Inhalt als Markdown. Die Vorlage enthält bewusst **keinen Programmcode** (Platzhalter, Schleifen und fertige Funktionen zum Rechnen und Formatieren), das hält Decks sicher und vorhersehbar. Der Editor schlägt eigene Komponenten nach `::: ` vor.

Eingebaut sind `timeline` (Zeitstrahl), `process` (Prozess), `kpis` (Kennzahlen), `person` (Profilkarte), `roadmap`, `pyramid`, `matrix`, `versus` (vorher und nachher), `aside` (Randspalte für `two-col-wide`), `pipeline` (Ablauf mit Status), `states` (Statusautomat, je Schritt leuchtet ein Zustand), `gantt` (Zeitplan) und `checklist` (Checkliste mit Fortschritt). Das Beispiel-Deck „Komponenten“ zeigt sie alle.
:::

### Eigene Komponente in fünf Schritten {id=komponenten-anleitung}

````
mein-deck/
├─ deck.yaml
├─ 01-start.md
└─ components/
   ├─ fact.html      ← 2. Vorlage
   └─ fact.css       ← 4. Gestaltung
````

```markdown
::: fact title="Gut zu wissen"
Ein kurzer Merksatz.
:::
```

::: notes
1. **Ordner anlegen:** `components/` liegt im Deck-Ordner (nur dieses Deck) oder im Theme-Ordner (für alle Decks mit diesem Theme).
2. **Vorlage schreiben:** `components/fact.html` enthält HTML mit Platzhaltern, siehe oben. Der Dateiname ist der Name des Containers.
3. **Kopf ergänzen (empfohlen):** Ein Block `{{!meta … }}` am Anfang der Vorlage beschreibt Attribute und Beispiel. Er speist die Vorschläge im Editor und die Hinweise bei Tippfehlern (Folie „Kopf mit Beschreibung“).
4. **Gestalten:** `components/fact.css` daneben. Hashmark setzt um jede Komponente die Klasse `d-<name>`, also hier `.d-fact`. Mit den Tokens (`var(--color-accent)`) passt sie sich jedem Theme an.
5. **Verwenden:** `::: fact title="…"` in jeder Folie. Es braucht keinen Eintrag in der `deck.yaml`. Beim Speichern lädt die Vorschau neu.

Das Beispiel-Deck „Komponenten“ enthält genau diese Komponente zum Abschauen.

**Im Editor:** Die Schritte 1 bis 4 gehen auch ohne Dateimanager. Links in der Dateiliste steht der Bereich „Komponenten“ mit `+ Komponente`: Name, Beschreibung und Attribute eintragen, und der Editor legt `components/<name>.html` und `.css` als Gerüst an und öffnet die Vorlage. In der Vorlage färbt der Editor die Platzhalter, schlägt sie nach `{{` vor (Strg+Leertaste) und zeigt Fehler wie ein nicht geschlossenes `{{#each}}` mit Zeilennummer. „Beispiel in Folie ansehen“ unten setzt das Beispiel aus dem Kopf als Folie ans Ende der zuletzt geöffneten Datei, die Vorschau zeigt es sofort.
:::

### Platzhalter in der Vorlage {id=komponenten-platzhalter}

| In der Vorlage | Ergebnis |
| --- | --- |
| `{{ title }}` | Attribut des Containers, als Text (Sonderzeichen entschärft) |
| `{{{ body }}}` | Inhalt des Containers, als Markdown gerendert |
| `{{ photo\|image }}` | Attribut als Bildadresse, relativ zum Deck |
| `{{ value\|percent:max }}` | Attribut durch eine Funktion schicken (siehe nächste Folien) |
| `{{#if title}} … {{else}} … {{/if}}` | nur, wenn das Attribut gesetzt ist |
| `{{#if state is warn}} … {{/if}}` | nur, wenn das Attribut diesen Wert hat |
| `{{#each items}} … {{/each}}` | je Listenpunkt (siehe nächste Folie) |
| `{{#each children}} … {{/each}}` | je Kind-Container (siehe nächste Folie) |

::: notes
Die Vorlage enthält **kein JavaScript**: Platzhalter, `if`, `each` und fertige Funktionen (siehe „Rechnen und Formatieren“), aber keine frei geschriebenen Ausdrücke. Das hält Decks sicher und vorhersehbar.

Zwei Klammern (`{{ … }}`) setzen Text ein, drei Klammern (`{{{ … }}}`) setzen Inhalt ein, der als Markdown gerendert wird: Bilder, Code, Diagramme und Schritte funktionieren darin wie auf jeder Folie. `{{ body }}` mit zwei Klammern ergibt einen Hinweis. Ein Attribut ohne Wert (`::: timeline vertical`) gilt als gesetzt. `class`, `id`, `step` und `until` gelten für jeden Container und müssen nirgends aufgeführt werden.
:::

### Kopf mit Beschreibung {id=komponenten-meta}

```html
{{!meta
description: "Merksatz mit Überschrift"
attrs:
  title: Überschrift des Merksatzes
flags:
  wide: volle Breite
required: title
example: |
  ::: fact title="Gut zu wissen"
  Ein kurzer Merksatz.
  :::
}}
<aside class="fact">…</aside>
```

::: notes
Der Kopf ist YAML zwischen `{{!meta` und `}}` ganz am Anfang der Vorlage. Er erscheint nicht auf der Folie. Felder:

| Feld | Bedeutung |
| --- | --- |
| `description` | Kurzbeschreibung, der Editor zeigt sie nach `::: ` |
| `attrs` | Attribute mit Wert: Name und Beschreibung |
| `flags` | Attribute ohne Wert (`::: fact wide`) |
| `required` | Pflichtattribute, ein Name oder eine Liste |
| `defaults` | Standardwerte für Attribute, die der Autor weglässt (`scale: "100"`) |
| `values` | erlaubte Werte eines Attributs (`state: [done, run, open]`): der Editor schlägt sie vor und meldet andere |
| `example` | Beispiel, das der Editor einfügt |
| `children` | erlaubte Kind-Container, jeder mit denselben Feldern |

Mit dem Kopf schlägt der Editor Attribute und Flags vor und markiert Unbekanntes („Attribut ‚titel‘ ist unbekannt, meintest du ‚title‘?“). Ohne Kopf funktioniert die Komponente trotzdem, nur ohne diese Hilfen.
:::

### Rechnen und Formatieren {id=komponenten-funktionen}

```html
<div class="bar-fill" style="width: {{ value | percent:scale }}"></div>
<div class="bar-value">{{ value | number:1 }}{{ unit | default:"" }}</div>
<div class="total">Summe: {{ children | sum:value | number:1 }}</div>
```

| Funktion | Ergebnis |
| --- | --- |
| `default:"–"` | Ersatzwert, wenn das Attribut fehlt oder leer ist |
| `percent:max` | Wert ÷ `max` in Prozent, `72` bei `max` 96 ergibt `75%`; `percent:100:1` mit einer Nachkommastelle |
| `number:1` | Zahl mit Nachkommastellen und Tausenderpunkt, `number:1:"en"` englisch (1,234.6) |
| `date:long` | Datum `2026-10-29` als „29. Oktober 2026“; `short`, `medium`, `long`, `month`, `iso`; `date:short:"en"` englisch |
| `sum:value`, `max:value`, `min:value` | über alle `children` (oder `items`, Feld `text`) |
| `count:state:done` | Zahl der `children`, bei denen `state` gleich `done` ist |
| `share:state:done` | Anteil dieser Einträge in Prozent, bei 2 von 4 ergibt es `50%` |
| `add:1` | Zahl addieren, z. B. für „bis Schritt“ (`{{ at \| add:1 }}`) |
| `upper`, `lower` | Groß- bzw. Kleinbuchstaben |
| `truncate:40` | auf 40 Zeichen kürzen, mit „…“ |
| `image` | Bildadresse relativ zum Deck |

Funktionen lassen sich verketten: `{{ children | sum:value | number:1 }}`.

::: notes
Die Funktionen sind fertig eingebaut, man schreibt keinen Code. Der Editor schlägt sie nach `|` vor und erklärt sie. Sie laufen beim Bauen des Decks und liefern fertigen Text, darum sehen PDF, PowerPoint und Handout genauso aus wie die Präsentation.

**Zahlen lesen:** `1234.5`, `1,5`, `72 %` und `1.234,5` werden verstanden. Steht nur ein Komma da, gilt es als Dezimalkomma. Kommen Punkt und Komma vor, ist das letzte das Dezimalzeichen.

**Argumente:** Ein Name wie `max` in `percent:max` ist ein Attribut des Containers (oder des Kindes). Text steht in Anführungszeichen: `default:"–"`. Bei `sum`, `max` und `min` ist das Argument der Name des Feldes im Kind, kein Attribut des Containers. `percent` rechnet ohne Komma, damit das Ergebnis auch in `width:` taugt.

**Vergleichen:** `{{#if state is warn}}` und `{{#if state is not warn}}` vergleichen mit einem festen Wert, ohne auf Groß- und Kleinschreibung zu achten. Für Zahlen gibt es `>`, `>=`, `<` und `<=`: `{{#if value > 50}}`. Rechts steht immer ein fester Wert.

**Sprache:** `number` und `date` formatieren standardmäßig deutsch. Eine andere Sprache setzt das letzte Argument, etwa `number:1:"en"`.

Das Beispiel-Deck „Komponenten“ zeigt alles in der Komponente `bars` (Folie „Balken mit Rechnung“).
:::

### Kinder und Listen {id=komponenten-kinder}

```html
{{!meta
children:
  phase: { attrs: { label: Beschriftung }, required: label }
}}
<ol class="ablauf">
  {{#each children}}
  <li data-step="{{ step }}">{{ label }}{{{ body }}}</li>
  {{/each}}
</ol>
```

```markdown
::: ablauf steps
::: phase label="Planen"
:::
::: phase label="Bauen"
Mit Beispiel.
:::
:::
```

::: notes
Eine Komponente kann **Kind-Container** haben (`{{#each children}}`, wie `::: kpis` mit `::: kpi`) oder einfach die **Listenpunkte** der obersten Ebene verwenden (`{{#each items}}`, wie `::: timeline`). Liest die Vorlage keins von beiden, gehören Listen und Kinder zum Inhalt (`body`).

In jedem Durchlauf stehen die Attribute des Kindes zur Verfügung, dazu `{{{ body }}}` (Inhalt des Kindes), `{{ number }}` (1, 2, 3 …), `{{ index }}` (ab 0), `{{ first }}`, `{{ last }}` und `{{ step }}`: die Schrittnummer, wenn der Container `steps` trägt (ab `start=…`, sonst 1) oder das Kind ein eigenes `step=` hat. Bei Listenpunkten heißen die Felder `{{{ html }}}` (mit Markdown) und `{{ text }}` (nur Text). `{{ count }}` ist die Zahl der Einträge. Steht im Kopf unter `children:` eine Liste, meldet Hashmark andere Kind-Namen als unbekannt.
:::

### Vorrang und typische Fehler {id=komponenten-fehler}

| Meldung | Ursache und Abhilfe |
| --- | --- |
| Attribut „x“ ist unbekannt | Tippfehler oder im Kopf (`attrs`, `flags`) nicht aufgeführt |
| Attribut „x“ fehlt | steht unter `required`, aber nicht am Container |
| Inhalt wird von der Vorlage nicht verwendet | die Vorlage hat kein `{{{ body }}}` |
| `{{ body }}` ist Inhalt und braucht drei Klammern | `{{{ body }}}` schreiben |
| Zeile 4: `{{#each}}` wird nicht geschlossen | `{{/each}}` ergänzen |
| unbekannte Funktion „x“ | Tippfehler; die erlaubten Funktionen stehen in der Meldung |
| „x“ ist keine Zahl | das Attribut enthält Text, wo gerechnet wird; der Wert bleibt unverändert stehen |
| „sum“ rechnet über eine Liste | `sum`, `max`, `min` gehören hinter `children` oder `items` |
| „x“ ist ein eingebauter Container | der Name der Komponente ist schon vergeben, anderen Namen wählen |
| Kind „x“ ist hier unbekannt | steht nicht unter `children:` im Kopf |

::: notes
**Vorrang:** Eingebaute Container wie `cards`, `notes` oder `columns` gewinnen immer, eine Komponente mit demselben Namen bleibt wirkungslos. Unter den Komponenten gilt: Deck-Ordner vor Theme-Ordner vor den eingebauten Komponenten (`timeline`, `kpis` …). Wer `kpis.html` ins Deck legt, ersetzt also die eingebaute.

**Fehler** zeigt Hashmark als Hinweis mit Zeilennummer, beim Bauen und in `make check`. Eine kaputte Vorlage nimmt nur diese eine Komponente außer Betrieb, die übrigen Komponenten und das Deck laden weiter. Das CSS in `components/` gehört zum Theme.

Komponenten mit eigenen Skripten gibt es nicht und sind für eine spätere Plugin-Schnittstelle vorgesehen. Bis dahin reichen die fertigen Funktionen.
:::
