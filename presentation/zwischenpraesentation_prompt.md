# Prompt für Claude PowerPoint Plugin — Zwischenpräsentation MRE2 / Projekt MONUMENTAL

> Copy-paste den folgenden Block in das PPT-Plugin. Alles in eckigen Klammern `[...]` sind bewusste Platzhalter — bitte als beschriftete graue Rechtecke / Textmarker übernehmen, **nicht** durch Stockbilder oder erfundene Inhalte ersetzen.

---

Erstelle eine **kinoreife, "prächtige" PowerPoint-Präsentation** für die Zwischenpräsentation der Lehrveranstaltung **MRE2 — Robotermodellierung** an der FHTW (SS2026). Dauer max. **5 Minuten**, ca. **11 Folien**. Sprache: **Deutsch**. Stil: **dramatisch-industriell**, wie ein Tech-Keynote-Reveal — nicht wie ein Studienvortrag. Filmisch, mit Build-up.

## Projekt- und Markenbasis

- **Plattform-/Projektname: MONUMENTAL** — durchgängig prominent, in starken Großbuchstaben, gerne mit Spacing (`M O N U M E N T A L`)
- **Roboter-Name: V.I.K.A.** — *Virtual Industrial Kinematic Arm*
  - Zwei Varianten der MONUMENTAL-Plattform:
    - **V.I.K.A.-6** — 6 DOF, Ziegelsetzer, gebaut von **Elias Bitsch**
    - **V.I.K.A.-5** — 5 DOF, Mörtelauftrag, gebaut von **Viktoriia Ovdiienko**
- **Tagline (frei nutzen):** *"Draw a wall. Watch it rise."*
- Konsistentes "Built by V.I.K.A." oder ein V.I.K.A.-Logo-Mark in jeder Folienfußzeile
- Farbschema: tiefes Anthrazit / Schwarz als Basis, **massiver heller Akzentton** (Beton-Weiß oder kaltes Industrie-Orange #FF6B1A), kalkweiß für Typo. Edel, baulastig, kein Pastell.
- Schrift: kräftig serifenlos für Titel (z. B. Inter Bold, Eurostile, Industry), klar für Body (Inter Regular)
- 16:9, randlose Hero-Bilder, viel Negativraum

## Title-Sequenz (FOLIE 1) — bitte besonders aufwendig

- Vollflächig schwarz / Beton-Texturhintergrund (Platzhalter: "[Platzhalter: Beton-/Industriehintergrund]")
- Großer Reveal-Text: **MONUMENTAL** — als **fette 3D-Buchstaben** (extrudierter Texteffekt, **WordArt 3D / Text Effects → 3-D Format → Bevel + Depth**). Wirkung: massiv, betongrau-metallisch, mit klarer Tiefe und seitlicher Lichtkante.
  - Material/Look: dunkler Stein/Beton oder gebürstetes Metall, leichte Specular-Highlights an den Kanten, bevorzugt mit kühler Beleuchtung von oben links
  - Tiefe (Extrusion / Depth): kräftig (z. B. 30–50 pt), Bevel rund oder abgeschrägt
  - Buchstaben-Spacing leicht erhöht (`M O N U M E N T A L`), Großbuchstaben durchgehend
  - Entrance-Animation — **mehrstufige Sequenz, kein einzelner Effekt**:
    1. **Gesamter Titel fällt als ein Block gleichzeitig** von oben in den Bildausschnitt (alle Buchstaben simultan, Motion Path *Lines* nach unten, Geschwindigkeit "Fast" 0.4–0.6 s, Easing am Ende beschleunigend für Aufprall-Gefühl)
    2. **Aufprall-Bounce:** beim Auftreffen kurzes Squash auf den ganzen Block (Scale Y 0.92, 0.08 s) und Rück-Bounce auf 1.0 → wirkt nach echter Masse
    3. **Camera-Shake:** im Aufprall-Moment den gesamten Slide-Inhalt um ±3–6 px in Y kurz (0.15 s) zittern lassen (Animation auf einer Hintergrund-Gruppe)
    4. **Staubwolke beim Aufprall:** unmittelbar mit dem Aufprall am Boden der Buchstaben-Baseline eine **breite Staubwolke** erscheinen lassen
       - Realisierung A (bevorzugt, falls Plugin Video unterstützt): transparentes **Dust-Cloud-Video** (WebM/MP4 mit Alpha) als Overlay einbetten, auf Folienbasis getriggert "With previous animation". Quelle: lizenzfreie VFX-Sammlungen (z. B. Mixkit, Pixabay — *"dust impact alpha"*)
       - Realisierung B (Fallback ohne Video): vorgerenderte **Staubwolken-PNG mit Transparenz** als Bild einfügen. Animation: Eingang *Fade* (0.2 s) + *Grow/Shrink* von 60% auf 130% (0.8 s) + Ausgang *Fade* (0.6 s). Mehrere PNG-Layer leicht versetzt für Volumen-Eindruck.
       - Realisierung C (Notfall, ohne Asset): zwei bis drei graue, semi-transparente Ellipsen mit hohem Blur, einsetzen mit Zoom-In + Fade. Sieht stilisiert aus, aber funktioniert offline.
    5. Nach Setzen der Staubwolke: leichter, langsamer **Fade auf ~30%** (Wolke bleibt als Atmosphäre noch 1–2 s sichtbar, dann weg)
  - Reihenfolge timing-mäßig: Block-Fall (~0.5 s) → Aufprall + Camera-Shake + Staubwolke gleichzeitig (0.15 s Shake, 1.5–2 s Wolke) → Untertitel-Reveal beginnt
  - Falls das Plugin echtes 3D-Text-Rendering nicht beherrscht: Fallback auf eine eingebettete **3D-Text-Bitmap** mit Tiefe + Schatten (z. B. mit Blender/Online-3D-Text-Generator vorgerendert) — als beschrifteten Platzhalter "[Platzhalter: 3D-Titel-Render MONUMENTAL]" einsetzen, dann manuell ersetzen. In dem Fall den Title als **einzelnes Bild** fallen lassen (Block-Drop) und die Staubwolken-Sequenz darauf anwenden.
- Untertitel erscheint nach dem Aufprall, schreibmaschinen-/fade-in: *"Powered by V.I.K.A. — Virtual Industrial Kinematic Arm"*
- Tagline darunter klein: *"Draw a wall. Watch it rise."*
- Footer dezent: "MRE2 SS2026 · Zwischenpräsentation · Elias Bitsch · Viktoriia Ovdiienko"

## Erzählbogen (Story Beat)

Folge diesem dramaturgischen Bogen, NICHT klassischem IMRAD:

1. **Hook** (Title)
2. **Problem & Lösungsbogen** — die Baubranche
3. **Vision** — Tablet-Dashboard → Schwarm
4. **Held** — V.I.K.A. wird vorgestellt
5. **Konstruktive Brillanz** (Detail-Zooms ins 3D-Modell)
6. **Beide Varianten & Aufgabenteilung**
7. **System-Stack**
8. **Bonus: Zirkuläres Bauen** — der Recycling-Pay-off
9. **Status, Roadmap & Live-Demo**

## Folien

**Folie 1 — TITLE**
Wie oben beschrieben (Drop-Aufprall-Reveal MONUMENTAL + V.I.K.A. + Tagline).

**Folie 2 — Das Problem & der Lösungsbogen**
- Großer Halbsatz-Aufmacher: *"Mauern bauen sich nicht von selbst — bisher."*
- Drei kurze Pain-Bullets (max. 4 Wörter each):
  - "Fachkräftemangel am Bau." → niemand will mehr auf die Baustelle
  - "Zeitdruck. Wetterabhängig." → enge Bauzeitpläne, klimaabhängige Arbeit
  - "Körperlich zermürbend." → Rückenschäden, frühe Berufsaufgaben, hoher Krankenstand
- **Bridge-Zeile** unten als Übergang zur Vision (visuell abgesetzt, ggf. in Akzentfarbe): *"MONUMENTAL entlastet — ohne zu ersetzen."* — V.I.K.A. übernimmt die schwere Repetition, Fachkräfte konzentrieren sich auf Planung, Qualität und Maßaufgaben. Schichtbetrieb wird möglich, Bauzeit sinkt.
- Rechts großes Platzhalter-Bild: "[Platzhalter: Baustelle / Maurer]"
- Sprecher-Notiz: *"Drei Schmerzpunkte des Mauerbaus heute. MONUMENTAL adressiert alle drei — durch Automatisierung der körperlich zermürbenden Repetition, ohne den Maurer als Fachkraft zu ersetzen."*

**Folie 3 — Die Vision: Tablet → Schwarm**
- Headline: *"Du zeichnest. Sie bauen."*
- 3-Schritt-Visual horizontal:
  1. **Skizze** — Hand zeichnet Mauer auf Tablet → "[Platzhalter: Tablet-Mockup mit Wand-Skizze]"
  2. **Schwarm** — n V.I.K.A.-Einheiten schwärmen aus → "[Platzhalter: Schwarm-Render]"
  3. **Mauer** — fertige Wand → "[Platzhalter: fertige Mauer]"
- Untertext: *"Vision: Schwarm beliebiger Größe. Proof-of-Concept heute: 2 Einheiten."*
- **Wichtig — Framing für die ganze Präsentation:** der Schwarm ist und bleibt **rein konzeptionell**. Implementiert und demonstriert werden ausschließlich **zwei eigenständige Roboter** (V.I.K.A.-6 + V.I.K.A.-5). Kein Schwarm-Code, keine Schwarm-Koordination als Roadmap-Item. Der Begriff "Schwarm" darf außerhalb dieser Vision-Folie nicht als Implementierungsversprechen auftauchen.

**Folie 4 — Meet V.I.K.A.-6 (Elias' Bau-Roboter)**
- Hero-Bereich vollflächig links → "[3D-Modell-Drop-Zone — Kameraziel: hero, .3mf]"
- Rechts oben: **prominenter Acronym-Reveal** der V.I.K.A.-Auflösung:
  - Jeder Buchstabe groß und farblich akzentuiert vor dem dazugehörigen Wort:
    - **V** — Virtual
    - **I** — Industrial
    - **K** — Kinematic
    - **A** — Arm
  - Layout: untereinander, Buchstaben in Akzentfarbe, Worte in Weiß. Optional buchstabenweise Fade-In als Reveal-Animation.
- Rechts unten kompakte Eckdaten:
  - **6 Achsen, seriell**
  - Reichweite ca. **[Platzhalter] m**
  - Traglast ca. **[Platzhalter] kg**
  - Endeffektor: **Parallelbacken-Greifer** (eigens konstruiert)
- Sprecher-Notiz: *"V.I.K.A. — Virtual Industrial Kinematic Arm. Komplett selbst konstruiert. Was ihr hier seht ist V.I.K.A.-6, mein Bau-Roboter mit 6 Achsen. Viktoriias Mörtel-Variante V.I.K.A.-5 zeige ich gleich."*

**Folie 5 — Detail-Zoom 1: Doppellagerung J2**
- Großer Zoom auf die Schulter-Lagerung im 3D-Modell → "[3D-Modell-Drop-Zone — Kameraziel: J2_bearing, .3mf · Schnittansicht beider Lager]"
- Headline: *"Schulter mit Doppellagerung."*
- Bullets:
  - Beidseitige Lagerung statt fliegender Lagerung
  - Geschätzt **~4× höhere Steifigkeit** am höchstbelasteten Gelenk
  - J2 trägt das gesamte Folgeglied-Moment inklusive Last
  - Resultat: weniger Schwingung, höhere Wiederholgenauigkeit
- *Plugin-Hinweis: wenn 3D-Modell-Embedding mit Kamera-Targets unterstützt wird, Kameraziel auf "J2_bearing" setzen.*

**Folie 6 — Detail-Zoom 2: J4 hinten gegenüber dem Endeffektor**
- Großer Zoom auf das Handgelenk → "[3D-Modell-Drop-Zone — Kameraziel: J4_axis, .3mf · Hebelarm zum Greifer mit Maßlinie als Overlay]"
- Headline: *"Hebel statt Muskel."*
- Bullets:
  - J4-Achse bewusst **hinter** dem TCP positioniert
  - Größerer Hebelarm zwischen J4-Antrieb und Greiflast
  - Weniger Antriebsmoment für gleiche Greifkraft am TCP
  - Kompaktere Antriebseinheit, geringere Spitzenströme
- *Plugin-Hinweis: Kameraziel "J4_axis" mit Maßpfeil zum TCP.*

**Folie 7 — Detail-Zoom 3: Parallelbacken-Greifer**
- Großer Zoom auf den Endeffektor → "[3D-Modell-Drop-Zone — Kameraziel: tool0_flange, .3mf · Backen-Animation offen↔geschlossen wenn unterstützt]"
- Headline: *"Greifen mit Gefühl."*
- Bullets:
  - Parallelbacken-Greifer mit **Mimic-Joint** (linke Backe führt, rechte Backe folgt synchron)
  - Hub und Greifkraft ausgelegt auf Standard-Mauerziegel-Maße
  - Robuste Backenführung für wiederholgenaues Greifen über tausende Zyklen
- *Plugin-Hinweis: Kameraziel "tool0_flange".*

**Folie 8 — Zwei V.I.K.A.-Varianten: Elias' Bau-Bot & Viktoriias Mörtel-Bot**
- Splitscreen: **V.I.K.A.-6** (Elias Bitsch, Bau, 6 Achsen) ↔ **V.I.K.A.-5** (Viktoriia Ovdiienko, Mörtel, 5 Achsen) → "[3D-Modell-Drop-Zone — Splitscreen, .3mf]"
- Headline: *"Gleiche Plattform. Aufgabenoptimierte Kinematik."*
- **V.I.K.A.-6 — Bau-Roboter (Elias):**
  - 6 DOF — volle Orientierungsfreiheit für präzise Ziegelausrichtung in jeder Pose
  - Greifer braucht freie Roll-Achse, um Ziegel an Eck-/Mauerstößen zu drehen
- **V.I.K.A.-5 — Mörtel-Roboter (Viktoriia):** bewusst auf 5 Achsen reduziert, **J4 entfällt**:
  - **Mörteldüse ist rotationssymmetrisch** → eine Wrist-Roll-Achse hätte keinen funktionalen Mehrwert
  - **Schlauch-Torsion vermieden:** kontinuierliche Mörtelförderung läuft durch einen flexiblen Schlauch zur Düse — eine rotierende J4-Achse würde den Schlauch bei jeder Bewegung verdrehen → Materialermüdung, Dichtigkeitsverlust, Standardproblem bei Lackier-/Schweiß-/Dispensier-Robotern
  - Folge: weniger bewegte Masse am Endeffektor → höhere dynamische Bahngenauigkeit beim Auftragen
  - Folge: ein Antrieb weniger → niedrigeres Gewicht, geringere Kosten, weniger Wartungspunkte
- **Wichtige Klarstellung: V.I.K.A.-6 und V.I.K.A.-5 sind zwei eigenständige Roboter mit unterschiedlicher Kinematik — kein Werkzeugwechsel an einem gemeinsamen Modell.** Diese Trennung erfüllt direkt die LV-Vorgabe *"unterschiedliche Roboterkinematik je Gruppenmitglied"* und ist gleichzeitig **technisch begründet** (siehe oben), nicht willkürlich.
- Mobilitäts-Bullet: beide V.I.K.A.-Einheiten bewegen sich entlang der Mauer — **Linearschiene oder Kettenfahrwerk, finale Entscheidung steht aus** (offenes Designtreffen-Thema, im Sprecher-Notizfeld als TBD vermerken)

**Folie 9 — System-Stack**
- Architektur-Diagramm-Platzhalter mit beschrifteten Boxen → "[Platzhalter: Architektur-Diagramm]"
  - Boxen: `description (URDF/xacro)` · `bringup` · `moveit2` · `gazebo` · `hmi (Tablet)` · `mission planner`
  - Pfeile: Tablet → Mission-Planner → MoveIt → Robot Controller
- Stack: ROS 2 Jazzy · Gazebo · MoveIt 2 · selbst-implementiertes Tablet-HMI

**Folie 10 — Bonus: Zirkuläres Bauen**
- Headline: *"Robotik macht Recycling wirtschaftlich."*
- Aufmacher-Bullet: heute werden Mauern beim Abriss **zerschlagen**, weil händisches Trennen zu teuer ist — Bauschutt landet als minderwertiges Verfüllmaterial.
- Wenn Roboter den Aufbau übernehmen, können sie auch den **kontrollierten Rückbau** übernehmen:
  - Stein für Stein abgehoben statt zerschlagen
  - Mörtelfuge sauber getrennt von Ziegel
  - Materialien sortenrein → **echte Wiederverwendung** statt Downcycling
- Wirtschaftliche Pointe: *"Wenn Abbauzeit kein Kostenfaktor mehr ist, wird sortenrein zur Standardoption."*
- Architektonischer Bezug: passt zum Konzept *Design for Disassembly* / **zirkuläres Bauen** — Gebäude als temporäres Materiallager
- Rechts großes Platzhalter-Bild: "[Platzhalter: Robot-gestützter Rückbau / Stapel sortenreiner Ziegel]"
- Sprecher-Notiz: *"Bonus-Argument für die Q&A: V.I.K.A. baut nicht nur — V.I.K.A. baut auch zurück. Damit wird die Mauer von Anfang an zum Materiallager statt zum späteren Bauschutt. Das ist der Punkt, an dem Automatisierung zur Nachhaltigkeitstechnologie wird."*

**Folie 11 — Status, Roadmap, Live-Demo**
- Linke Spalte "Heute": Was steht — URDF/xacro für beide Roboter, RViz-Visualisierung, **V.I.K.A.-6 Detail-CAD fertig (Elias)**, **V.I.K.A.-5 CAD [Platzhalter: Stand bei Viktoriia eintragen]**, Werkstatt-Setup gestartet
- Mittlere Spalte "Bis Endabgabe": Gazebo-Physik, MoveIt-IK, Tablet-HMI, **Zwei-Roboter-Synchronisation** (Setzen ↔ Mörteln), Mörtel-Auftragslogik
  - *Wichtig: NICHT "Schwarm-Koordination" schreiben — der Schwarm ist und bleibt rein konzeptionell, im Projekt arbeiten wir mit genau zwei separaten Robotern.*
- Rechte Spalte "JETZT": **Live-Demo-Cue** — *"Wir zeigen es euch."*
- Backup-Video-Hinweis dezent unten
- Letzte Zeile: *"Draw a wall. Watch it rise."* — als Outro

## Übergänge / Animationen

**Grundregel: durchgehend Morph-Übergänge verwenden** (PowerPoint *Transitions → Morph*). Cuts nur wo Morph nicht passt. Ziel: ein Vortrag, der sich wie eine kontinuierliche Kamerafahrt anfühlt, nicht wie eine Diashow.

### Morph-Mechanik
Damit Morph sauber funktioniert, müssen wiederkehrende Elemente (V.I.K.A.-Render, MONUMENTAL-Wordmark, Akzent-Linien, Footer) auf aufeinanderfolgenden Folien **als dieselben benannten Objekte** angelegt sein, nur mit unterschiedlicher Position/Größe/Rotation. Das ist die einzige Bedingung für saubere Morph-Animation.

### Pro Folie konkret

- **Folie 1 (Title):** Drop-Aufprall-Entrance wie oben spezifiziert (Block-Fall + Squash + Camera-Shake + Staubwolke). Übergang zu Folie 2: **Morph** — der MONUMENTAL-Schriftzug schrumpft und wandert in den Footer-Bereich (wird zum "Markenanker"), gleichzeitig fadet der Beton-Hintergrund auf.
- **Folie 2 → 3:** Morph — die Pain-Bullets fadeten weg, das Bridge-Banner *"MONUMENTAL entlastet — ohne zu ersetzen."* wandert nach oben und wird zur Headline der Vision-Folie *"Du zeichnest. Sie bauen."* (Text-Morph-Effekt).
- **Folie 3 (Vision):** drei Schritt-Visuals (Tablet → Schwarm → Mauer) erscheinen sequenziell durch **Sequence Animation** auf der Folie selbst (jeweils Fade + leichtes Slide-In von rechts, gestaffelt mit ~0.4 s Delay). Übergang zu Folie 4: **Morph** — das Schwarm-Visual zoomt in einen einzelnen V.I.K.A. hinein, dieser wird zum Hero-Render der nächsten Folie.
- **Folie 4 (Meet V.I.K.A.):** der V.I.K.A.-Acronym-Block (V/I/K/A vertikal) erscheint **buchstabenweise** mit Fade-In + leichtem Scale-Up (0.15 s pro Buchstabe, gestaffelt). Übergang zu Folie 5: **Morph** — V.I.K.A.-Render zoomt auf die Schulter (J2-Lager), Kamera wandert ran.
- **Folie 5 → 6:** **Morph** — Kamera wandert vom Schulterbereich (J2) zum Handgelenk (J4). V.I.K.A. bleibt an Position, nur Zoom/Pan ändert sich. Maßlinie zum TCP wächst beim Erscheinen ein (Wipe-Animation).
- **Folie 6 → 7:** **Morph** — Kamera zoomt weiter raus zum Endeffektor (Greifer). Greifer-Backen können auf der Folie selbst eine **Mini-Animation** abspielen (Backen schließen 0.5 s → öffnen 0.5 s, geloopt 1–2 mal).
- **Folie 7 → 8:** **Morph** — Kamera fährt aus, V.I.K.A.-6 wandert zur linken Bildhälfte, gleichzeitig fährt V.I.K.A.-5 von rechts ins Bild → ergibt den Splitscreen. Visuell starke "Zwei-Roboter-Reveal"-Sekunde.
- **Folie 8 → 9 (System-Stack):** Cut oder dezenter Fade — Wechsel von visuell zu schematisch, Morph passt hier nicht. Stack-Boxen erscheinen sequenziell (Fade-In von links nach rechts entlang der Pfeile).
- **Folie 9 → 10 (Bonus Recycling):** **Morph** — eine fertige Mauer auf Folie 9 (falls als Mini-Visual eingebaut) oder die letzte Stack-Box "mission planner" wird zum großen Mauerwerk auf Folie 10. Headline *"Robotik macht Recycling wirtschaftlich."* fadet rein. Stein-für-Stein-Bullets erscheinen mit kurzem Slide-In von rechts.
- **Folie 10 → 11 (Status & Demo):** Cut. Drei Spalten erscheinen sequenziell von links nach rechts (Fade + 0.3 s Stagger). Die rechte Demo-Spalte mit *"Wir zeigen es euch."* hat einen kleinen Pulse-Effekt (Scale 1.0 → 1.05 → 1.0, geloopt) als visueller Cue für die Demo.

### Allgemeine Animations-Regeln

- Bullets: **kein** zeilenweises Reinklicken während des Vortrags (raubt Tempo). Wenn Reveal gewünscht, dann automatisch mit Folien-Eintritt, gestaffelt 0.2–0.4 s.
- Geschwindigkeit aller Animationen: schnell (0.3–0.6 s), nicht behäbig. Wir wollen Tempo, keine Lehrvideos.
- **Verboten:** PowerPoint-Standard-Showeffekte ("Würfel", "Wölbung", "Drehflug", "Origami", "Galerie"). Reines Morph + Fade + Slide.
- **Konsistenz:** wenn Morph nicht möglich, dann **Fade Through Black** (0.3 s) — niemals "Hard Cut" außer bei den dokumentierten Stellen oben.
- Live-Demo-Folie 11: **keine** Auto-Animation am Ende — Folie bleibt ruhig stehen, damit du nahtlos zur Live-Demo überleiten kannst.

## 3D-Modell

- Ich werde das 3D-Modell von V.I.K.A. (Format: **.3mf**) selbst per Drag-and-Drop auf den entsprechenden Folien einsetzen.
- Auf den Folien 4–8 große, klar markierte Drop-Zonen mit Beschriftung lassen (z. B. "[3D-Modell hier ablegen — Kameraziel: J2_bearing]").
- Wenn das Plugin 3D-Embeds mit benannten Kameraposen kennt: Kameraposen `hero`, `J2_bearing`, `J4_axis`, `tool0_flange` als Vorschläge ins Folien-Notizfeld schreiben.

## Designvorgaben

- 16:9
- Folientitel groß (>40 pt), Body kompakt (18–22 pt), Bullets max. 5 pro Folie
- Hero-Bilder dürfen randlos sein
- Folienfußzeile dezent: "MONUMENTAL · MRE2 SS2026 · Folie X / 11"
- Markenanker "Built by V.I.K.A." oder V.I.K.A.-Mark unten links
- **Wichtig:** falls das Plugin von sich aus Footer, Slide-Counter, Branding-Marker oder Wasserzeichen einfügt, diese **deaktivieren / unterdrücken** — nur der hier spezifizierte Footer und Markenanker sollen sichtbar sein. Doppelte Footer-Zeilen sind zu vermeiden.

## Was NICHT auf die Folien

- Kein Programmcode (laut Angabe explizit nicht erwünscht)
- Keine Bug-/Problem-Beichten
- Keine Stockbilder erfinden — Platzhalter explizit als beschriftete graue Rechtecke
- Keine Standard-Powerpoint-Templates ("Ion", "Facette", etc.) — eigenständiger industrieller Look
- Keine endlosen Bullet-Wüsten — Headline + max. 3–5 Bullets reicht

## Sprecher-Notizen

Bitte zu jeder Folie kurze Sprechernotizen (3–5 Sätze) ins Notizfeld schreiben — wir nutzen sie als Referenz beim Halten des Vortrags, nicht zum Vorlesen.
