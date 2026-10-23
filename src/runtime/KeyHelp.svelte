<script lang="ts">
  let { onclose }: { onclose: () => void } = $props()

  const groups: { title: string; keys: [string, string][] }[] = [
    {
      title: 'Navigieren',
      keys: [
        ['→ / ←', 'weiter / zurück auf der aktuellen Ebene (Schritte, Sub-Slides, Geschwister)'],
        ['↓ / Enter', 'ins Detail abtauchen'],
        ['↑ / Esc', 'auftauchen – zurück zum Elternknoten'],
        ['Space / Shift+Space', 'dem Vortragsplan nach: nur der Pfad; Optionales und Anhang werden übersprungen'],
        ['↓ bei Optionalem', 'Ausflug: Space geht die Details durch und führt am Ende zur Abzweigung zurück'],
        ['T', 'Plan aus/an: Space läuft wieder durch alles'],
        ['Home', 'zum Anfang'],
        ['Ctrl+K / /', 'Suche: Folie per Titel oder Inhalt finden und hinspringen'],
      ],
    },
    {
      title: 'Presenter-Fernbedienung',
      keys: [
        ['▶ / ◀ (PageDown / PageUp)', 'wie Space / Shift+Space'],
        ['Play (F5)', 'Vollbild an/aus'],
        ['Schwarzbild (B / .)', 'Bildschirm schwarz / zurück'],
        ['Z', 'Bild vergrößern: die Kamera fährt hinein, Z, Esc oder Klick fährt zurück (Bilder mit {zoom})'],
        ['K', 'Video der Folie starten, anhalten, fortsetzen (→ bei laufendem Video springt ans Ende)'],
        ['S', 'Presenter-View im zweiten Fenster: Notizen, nächste Folie, Timer, Baum'],
        ['P (in der Presenter-View)', 'Vortragsplan bearbeiten: Pfad, Optional, Anhang, Zeitbudget'],
        ['N', 'Notizen unten einblenden (zum Üben mit einem Bildschirm)'],
        ['Strg+W (Desktop-App)', 'Präsentation beenden, auch mit ✕ oben rechts oder in der Presenter-View'],
      ],
    },
    {
      title: 'Ansicht',
      keys: [
        ['O / Ctrl+Shift+O', 'Navigations-Übersicht'],
        ['F', 'Vollbild'],
        ['H', 'Steuerkreuz aus-/einblenden'],
        ['P', 'Druckansicht / PDF'],
        ['Ctrl+P', 'alle Folien drucken'],
        ['?', 'diese Hilfe'],
      ],
    },
  ]
</script>

<div class="key-help" role="dialog" aria-modal="true" aria-label="Tastenkürzel" tabindex="-1"
  onclick={(e) => e.target === e.currentTarget && onclose()} onkeydown={() => {}}>
  <div class="kh-panel">
    <div class="kh-head"><strong>Tastenkürzel</strong><span>beliebige Taste schließt</span></div>
    {#each groups as g (g.title)}
      <section>
        <h3>{g.title}</h3>
        <dl>
          {#each g.keys as [k, v] (k)}
            <dt><kbd>{k}</kbd></dt><dd>{v}</dd>
          {/each}
        </dl>
      </section>
    {/each}
    <p class="kh-foot">Maus: Steuerkreuz unten rechts anklicken · Kacheln und Breadcrumb sind klickbar</p>
  </div>
</div>
